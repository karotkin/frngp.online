/* ============================================================
   api — курс валют + персистентная смета закупок в PostgreSQL
   Источник курса: kurs.onliner.by (рыночный), фолбэк: api.nbrb.by
   Данные сметы: таблица purchase_items в PostgreSQL.
   ============================================================ */
const http = require('http');
const https = require('https');
const { Pool } = require('pg');

const PORT = process.env.PORT || 8080;
const TTL_MS = (Number(process.env.RATE_TTL_MIN) || 30) * 60 * 1000;
const ONLINER_URL = 'https://kurs.onliner.by/';
const NBRB_URL = 'https://api.nbrb.by/exrates/rates/USD?parammode=2';

// Pool читает PGHOST/PGUSER/PGPASSWORD/PGDATABASE/PGPORT из окружения
const pool = new Pool({ max: 5 });

/* ---------------- курс ---------------- */
function get(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (frngp api)' },
      timeout: 12000,
    }, (res) => {
      if (res.statusCode >= 400) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve(data));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}
const nums = (s) => (s.match(/\d+\.\d+/g) || []).map(Number);

let rateCache = null;
let rateAt = 0;

async function fromOnliner() {
  const html = await get(ONLINER_URL);
  const m = html.match(/usd\\?\/byn"\s*:\s*\{\s*"buy"\s*:\s*\[(.*?)\]\s*,\s*"(?:sale|sell)"\s*:\s*\[(.*?)\]/);
  if (!m) throw new Error('onliner: usd/byn not found');
  const buy = nums(m[1]);
  const sale = nums(m[2]);
  if (!sale.length && !buy.length) throw new Error('onliner: empty series');
  const lastSale = sale.length ? sale[sale.length - 1] : null;
  const lastBuy = buy.length ? buy[buy.length - 1] : null;
  return { rate: lastSale || lastBuy, buy: lastBuy, sale: lastSale, source: 'onliner', updated: new Date().toISOString() };
}
async function fromNbrb() {
  const json = JSON.parse(await get(NBRB_URL));
  const rate = Number(json.Cur_OfficialRate);
  if (!(rate > 0)) throw new Error('nbrb: bad rate');
  return { rate, buy: null, sale: null, source: 'nbrb', updated: (json.Date || new Date().toISOString()) };
}
async function resolveRate() {
  if (rateCache && Date.now() - rateAt < TTL_MS) return rateCache;
  try { rateCache = await fromOnliner(); }
  catch (e) { console.error('onliner failed:', e.message, '-> nbrb'); rateCache = await fromNbrb(); }
  rateAt = Date.now();
  return rateCache;
}

/* ---------------- helpers ---------------- */
function readBody(req) {
  return new Promise((resolve, reject) => {
    let d = '';
    req.on('data', (c) => { d += c; if (d.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(d ? JSON.parse(d) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}
const send = (res, code, obj) => {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(obj));
};
const clampCur = (c) => (c === 'byn' ? 'byn' : 'usd');
const numOr = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

/* ---------------- смета ---------------- */
async function listPurchases(res) {
  const groups = await pool.query('SELECT id, label, is_server, sort FROM purchase_groups ORDER BY sort, id');
  const items = await pool.query(
    'SELECT id, group_id, category, item, qty, price, cur, sort FROM purchase_items ORDER BY group_id, sort, id'
  );
  send(res, 200, { groups: groups.rows, items: items.rows });
}
async function createItem(req, res) {
  const b = await readBody(req);
  if (!b.group_id) return send(res, 400, { error: 'group_id required' });
  const r = await pool.query(
    `INSERT INTO purchase_items (group_id, category, item, qty, price, cur, sort)
     VALUES ($1,$2,$3,$4,$5,$6, (SELECT COALESCE(MAX(sort)+1,0) FROM purchase_items WHERE group_id=$1))
     RETURNING id, group_id, category, item, qty, price, cur, sort`,
    [b.group_id, b.category || 'Прочее', b.item || '', Math.max(0, Math.trunc(numOr(b.qty, 1))),
     Math.max(0, numOr(b.price, 0)), clampCur(b.cur)]
  ).catch((e) => { send(res, 400, { error: e.message }); return null; });
  if (r) send(res, 201, r.rows[0]);
}
async function updateItem(req, res, id) {
  const b = await readBody(req);
  const fields = [];
  const vals = [];
  const add = (col, val) => { vals.push(val); fields.push(`${col}=$${vals.length}`); };
  if (b.category !== undefined) add('category', String(b.category));
  if (b.item !== undefined) add('item', String(b.item));
  if (b.qty !== undefined) add('qty', Math.max(0, Math.trunc(numOr(b.qty, 0))));
  if (b.price !== undefined) add('price', Math.max(0, numOr(b.price, 0)));
  if (b.cur !== undefined) add('cur', clampCur(b.cur));
  if (!fields.length) return send(res, 400, { error: 'no fields' });
  vals.push(id);
  const r = await pool.query(
    `UPDATE purchase_items SET ${fields.join(', ')}, updated_at=now() WHERE id=$${vals.length}
     RETURNING id, group_id, category, item, qty, price, cur, sort`, vals
  ).catch((e) => { send(res, 400, { error: e.message }); return null; });
  if (r) (r.rowCount ? send(res, 200, r.rows[0]) : send(res, 404, { error: 'not found' }));
}
async function deleteItem(res, id) {
  const r = await pool.query('DELETE FROM purchase_items WHERE id=$1', [id]);
  send(res, r.rowCount ? 200 : 404, { deleted: r.rowCount });
}

/* ---------------- router ---------------- */
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { pathname } = new URL(req.url, 'http://x');
  const method = req.method;
  try {
    if (pathname === '/health') return send(res, 200, { ok: true });

    if (pathname.startsWith('/rate')) {
      const data = await resolveRate();
      res.setHeader('Cache-Control', 'public, max-age=300');
      return send(res, 200, data);
    }

    if (pathname === '/purchases' && method === 'GET') return await listPurchases(res);
    if (pathname === '/purchases/items' && method === 'POST') return await createItem(req, res);

    const m = pathname.match(/^\/purchases\/items\/(\d+)$/);
    if (m) {
      const id = Number(m[1]);
      if (method === 'PATCH' || method === 'PUT') return await updateItem(req, res, id);
      if (method === 'DELETE') return await deleteItem(res, id);
    }

    send(res, 404, { error: 'not found' });
  } catch (e) {
    console.error(method, pathname, '->', e.message);
    send(res, 502, { error: 'server error', detail: e.message });
  }
});

server.listen(PORT, () => console.log('api on :' + PORT));
