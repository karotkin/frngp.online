/* ============================================================
   node-api — телеметрия нод Ethereum (NodeE) и Base (NodeB).
   Источник: Prometheus HTTP API (скрейпит node_exporter + клиенты
   geth/lighthouse/reth/op-node по WireGuard). Шейпит JSON под фронт.

   Эндпоинты:
     GET /health           — живость
     GET /telemetry        — всё для главной (карты клиентов + железо + ряды)
     GET /debug/names      — список доступных метрик в Prometheus (для отладки имён)

   Имена метрик у клиентов нестабильны между версиями, поэтому каждый
   показатель задан СПИСКОМ кандидатов-выражений: берём первый непустой.
   Отсутствующая метрика -> null (фронт показывает «—», не падает).
   ============================================================ */
const http = require('http');

const PORT = process.env.PORT || 8080;
const PROM = (process.env.PROM_URL || 'http://prometheus:9090').replace(/\/$/, '');
const RANGE_SEC = Number(process.env.SERIES_RANGE_SEC) || 3600; // окно графиков: 1ч
const STEP_SEC = Number(process.env.SERIES_STEP_SEC) || 90;     // ~40 точек

/* instance-метки (как заданы в prometheus.yml как target host:port).
   Переопределяемы через env, чтобы не хардкодить WG-адреса. */
const I = {
  nodee: process.env.NODEE_INSTANCE || '10.8.0.2',
  nodeb: process.env.NODEB_INSTANCE || '10.8.0.3',
};

/* ---------------- Prometheus HTTP ---------------- */
function promGet(path) {
  return new Promise((resolve, reject) => {
    const req = http.get(PROM + path, { timeout: 8000 }, (res) => {
      let d = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { d += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(d)); }
        catch (e) { reject(new Error('prom parse: ' + e.message)); }
      });
    });
    req.on('timeout', () => req.destroy(new Error('prom timeout')));
    req.on('error', reject);
  });
}
const enc = encodeURIComponent;

/* мгновенное значение скаляра первого ряда (или null) */
async function instant(expr) {
  try {
    const j = await promGet(`/api/v1/query?query=${enc(expr)}`);
    const r = j?.data?.result;
    if (!r || !r.length) return null;
    const v = Number(r[0].value[1]);
    return Number.isFinite(v) ? v : null;
  } catch { return null; }
}
/* первый непустой из списка кандидатов */
async function firstOf(exprs) {
  for (const e of exprs) {
    const v = await instant(e);
    if (v != null) return v;
  }
  return null;
}
/* range -> массив значений (ровный шаг), пропуски -> заполняем последним/0 */
async function series(expr) {
  const end = Math.floor(Date.now() / 1000);
  const start = end - RANGE_SEC;
  try {
    const j = await promGet(
      `/api/v1/query_range?query=${enc(expr)}&start=${start}&end=${end}&step=${STEP_SEC}`
    );
    const r = j?.data?.result?.[0]?.values;
    if (!r || !r.length) return [];
    return r.map((p) => {
      const v = Number(p[1]);
      return Number.isFinite(v) ? +v.toFixed(2) : 0;
    });
  } catch { return []; }
}

/* ---------------- выражения железа (node_exporter) ---------------- */
const HW = (inst) => ({
  up: `up{job="node",instance="${inst}:9100"}`,
  cpu: `100 - (avg(rate(node_cpu_seconds_total{mode="idle",instance="${inst}:9100"}[2m])) * 100)`,
  ram: `100 * (1 - node_memory_MemAvailable_bytes{instance="${inst}:9100"} / node_memory_MemTotal_bytes{instance="${inst}:9100"})`,
  temp: `max(node_hwmon_temp_celsius{instance="${inst}:9100"})`,
  netMbit: `8 * sum(rate(node_network_receive_bytes_total{device!~"lo|wg.*|docker.*|veth.*|br.*",instance="${inst}:9100"}[2m]) + rate(node_network_transmit_bytes_total{device!~"lo|wg.*|docker.*|veth.*|br.*",instance="${inst}:9100"}[2m])) / 1e6`,
  diskFreePct: `100 * (node_filesystem_avail_bytes{fstype!~"tmpfs|overlay",instance="${inst}:9100"} / node_filesystem_size_bytes{fstype!~"tmpfs|overlay",instance="${inst}:9100"})`,
  uptimeSec: `node_time_seconds{instance="${inst}:9100"} - node_boot_time_seconds{instance="${inst}:9100"}`,
});

async function host(id, name, inst) {
  const q = HW(inst);
  const [up, cpu, ram, temp, net, dfree, upt] = await Promise.all([
    instant(q.up), instant(q.cpu), instant(q.ram), instant(q.temp),
    instant(q.netMbit), firstOf([`min(${q.diskFreePct})`]), instant(q.uptimeSec),
  ]);
  return {
    id, name, instance: inst,
    up: up === 1,
    cpu: round(cpu), ram: round(ram), temp: round(temp),
    netMbit: round(net), diskFreePct: round(dfree),
    uptime: fmtUptime(upt),
  };
}

/* ---------------- карты клиентов ---------------- */
/* job-метка задаётся в prometheus.yml; head/peers/synced — кандидаты имён */
const CLIENTS = [
  {
    id: 'geth', name: 'Geth', role: 'NodeE · EL', host: 'nodee', inst: () => I.nodee,
    head: ['chain_head_block{job="geth"}'],
    peers: ['p2p_peers{job="geth"}'],
    // geth synced: голова догнала заголовок (нет отставания)
    syncedExpr: '(chain_head_header{job="geth"} - chain_head_block{job="geth"}) < bool 4',
    // отставание в секундах ≈ блоков отставания × 12с
    behindExpr: '12 * clamp_min(chain_head_header{job="geth"} - chain_head_block{job="geth"}, 0)',
  },
  {
    id: 'lighthouse', name: 'Lighthouse', role: 'NodeE · CL', host: 'nodee', inst: () => I.nodee,
    head: ['beacon_head_slot{job="lighthouse"}'],
    peers: ['libp2p_peers{job="lighthouse"}', 'libp2p_peer_count{job="lighthouse"}'],
    syncedExpr: 'sync_eth2_synced{job="lighthouse"}',
    // секунды отставания = (текущий слот − слот головы) × длительность слота
    behindExpr: 'clamp_min(slotclock_present_slot{job="lighthouse"} - beacon_head_slot{job="lighthouse"}, 0) * slotclock_slot_time_seconds{job="lighthouse"}',
  },
  {
    id: 'reth', name: 'base-reth', role: 'NodeB · EL', host: 'nodeb', inst: () => I.nodeb,
    head: ['reth_blockchain_tree_canonical_chain_height{job="reth"}', 'reth_blockchain_tree_in_mem_state_latest_block{job="reth"}'],
    peers: ['reth_network_connected_peers{job="reth"}'],
    syncedExpr: null, // у reth нет чистого synced-gauge; статус по peers/head
    chain: 'base', behindRef: 'head', // отставание оцениваем по расчётному tip
  },
  {
    // base-consensus (Rust) не отдаёт L2 head-номера напрямую; берём из reth
    // (op-node сам выставляет safe/unsafe в reth через forkchoice).
    id: 'opnode', name: 'op-node', role: 'NodeB · CL', host: 'nodeb', inst: () => I.nodeb,
    head: ['reth_blockchain_tree_in_mem_state_latest_block{job="reth"}', 'reth_blockchain_tree_canonical_chain_height{job="reth"}'],
    safe: ['reth_blockchain_tree_safe_block_height{job="reth"}'],
    peers: ['base_node_gossip_peer_count{job="opnode"}'],
    syncedExpr: 'reth_blockchain_tree_safe_block_height{job="reth"} > bool 0',
    chain: 'base', behindRef: 'safe',
  },
];

// Base mainnet L2 genesis (для оценки tip при синхре): timestamp + время блока
const BASE_GENESIS_TS = 1686789347, BASE_BLOCKTIME = 2;

async function clientCard(c) {
  const [head, peers, synced, safe, behindRaw] = await Promise.all([
    firstOf(c.head || []),
    firstOf(c.peers || []),
    c.syncedExpr ? instant(c.syncedExpr) : null,
    firstOf(c.safe || []),
    c.behindExpr ? instant(c.behindExpr) : null,
  ]);

  // секунды отставания от головы
  let behindSec = behindRaw == null ? null : Math.max(0, Math.round(behindRaw));
  if (behindSec == null && c.chain === 'base') {
    const estTip = (Date.now() / 1000 - BASE_GENESIS_TS) / BASE_BLOCKTIME;
    const ref = c.behindRef === 'safe' ? safe : head;
    if (ref != null) behindSec = Math.max(0, Math.round((estTip - ref) * BASE_BLOCKTIME));
  }

  // статус: down если нет метрик; warn если рассинхрон/мало пиров/большое отставание
  let status = 'online';
  if (head == null && peers == null) status = 'down';
  else if (synced === 0 || (peers != null && peers < 1) || (behindSec != null && behindSec > 120)) status = 'warn';
  return {
    id: c.id, name: c.name, role: c.role, host: c.host,
    status,
    head, peers,
    synced: synced == null ? null : synced === 1,
    safe: safe ?? null,
    behindSec,
  };
}

/* ---------------- сборка /telemetry ---------------- */
async function buildTelemetry() {
  const [hostE, hostB, cards] = await Promise.all([
    host('nodee', 'NodeE', I.nodee),
    host('nodeb', 'NodeB', I.nodeb),
    Promise.all(CLIENTS.map(clientCard)),
  ]);
  const hosts = [hostE, hostB];
  const hostById = { nodee: hostE, nodeb: hostB };

  // ряды графиков — с тегом node, чтобы фронт рисовал по нодам ОТДЕЛЬНО
  const dev = 'device!~"lo|wg.*|docker.*|veth.*|br.*"';
  const netIn = (i) => `8*sum(rate(node_network_receive_bytes_total{${dev},instance="${i}:9100"}[2m]))/1e6`;
  const netOut = (i) => `8*sum(rate(node_network_transmit_bytes_total{${dev},instance="${i}:9100"}[2m]))/1e6`;
  const diskR = (i) => `sum(rate(node_disk_read_bytes_total{instance="${i}:9100"}[2m]))/1e6`;
  const diskW = (i) => `sum(rate(node_disk_written_bytes_total{instance="${i}:9100"}[2m]))/1e6`;

  const [
    scpuE, scpuB, niE, noE, niB, noB,
    pGeth, pLH, pReth, pOp, drE, dwE, drB, dwB,
  ] = await Promise.all([
    series(HW(I.nodee).cpu), series(HW(I.nodeb).cpu),
    series(netIn(I.nodee)), series(netOut(I.nodee)),
    series(netIn(I.nodeb)), series(netOut(I.nodeb)),
    series('p2p_peers{job="geth"}'), series('libp2p_peers{job="lighthouse"}'),
    series('reth_network_connected_peers{job="reth"}'), series('base_node_gossip_peer_count{job="opnode"}'),
    series(diskR(I.nodee)), series(diskW(I.nodee)),
    series(diskR(I.nodeb)), series(diskW(I.nodeb)),
  ]);

  const series_ = {
    cpu: [
      { name: 'NodeE', node: 'nodee', unit: '%', color: '#6f9c5b', data: scpuE },
      { name: 'NodeB', node: 'nodeb', unit: '%', color: '#6d8f9b', data: scpuB },
    ],
    net: [
      { name: 'NodeE ↓', node: 'nodee', unit: 'Мбит', color: '#6f9c5b', data: niE },
      { name: 'NodeE ↑', node: 'nodee', unit: 'Мбит', color: '#c8704f', data: noE },
      { name: 'NodeB ↓', node: 'nodeb', unit: 'Мбит', color: '#6f9c5b', data: niB },
      { name: 'NodeB ↑', node: 'nodeb', unit: 'Мбит', color: '#c8704f', data: noB },
    ],
    peers: [
      { name: 'Geth', node: 'nodee', unit: '', color: '#6f9c5b', data: pGeth },
      { name: 'Lighthouse', node: 'nodee', unit: '', color: '#6d8f9b', data: pLH },
      { name: 'reth', node: 'nodeb', unit: '', color: '#cba23e', data: pReth },
      { name: 'op-node', node: 'nodeb', unit: '', color: '#c8704f', data: pOp },
    ],
    disk: [
      { name: 'NodeE чтение', node: 'nodee', unit: 'МБ/с', color: '#6d8f9b', data: drE },
      { name: 'NodeE запись', node: 'nodee', unit: 'МБ/с', color: '#cba23e', data: dwE },
      { name: 'NodeB чтение', node: 'nodeb', unit: 'МБ/с', color: '#6d8f9b', data: drB },
      { name: 'NodeB запись', node: 'nodeb', unit: 'МБ/с', color: '#cba23e', data: dwB },
    ],
  };

  const synced = cards.filter((c) => c.status === 'online').length;
  const peersTotal = cards.reduce((a, c) => a + (c.peers || 0), 0);

  return {
    ts: new Date().toISOString(),
    kpi: {
      clientsTotal: cards.length,
      clientsOnline: synced,
      hostsUp: hosts.filter((h) => h.up).length,
      peersTotal,
    },
    hosts,
    cards: cards.map((c) => ({ ...c, hw: hostById[c.host] || null })),
    series: series_,
  };
}

/* ---------------- helpers ---------------- */
const round = (v) => (v == null ? null : Math.round(v));
function fmtUptime(sec) {
  if (sec == null || !Number.isFinite(sec)) return null;
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  return `${d}д ${String(h).padStart(2, '0')}ч`;
}
const send = (res, code, obj) => {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
};

/* список имён метрик — для отладки реальных имён у клиентов */
async function debugNames(res) {
  const j = await promGet('/api/v1/label/__name__/values').catch(() => null);
  send(res, 200, { count: j?.data?.length || 0, names: j?.data || [] });
}

/* ---------------- router ---------------- */
let cache = null, cacheAt = 0;
const CACHE_MS = 4000;

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://x');
  try {
    if (pathname === '/health') return send(res, 200, { ok: true, prom: PROM });
    if (pathname === '/debug/names') return await debugNames(res);
    if (pathname === '/telemetry' || pathname === '/') {
      if (cache && Date.now() - cacheAt < CACHE_MS) return send(res, 200, cache);
      cache = await buildTelemetry();
      cacheAt = Date.now();
      return send(res, 200, cache);
    }
    send(res, 404, { error: 'not found' });
  } catch (e) {
    console.error(pathname, '->', e.message);
    send(res, 502, { error: 'server error', detail: e.message });
  }
});

server.listen(PORT, () => console.log('node-api on :' + PORT + ' prom=' + PROM));
