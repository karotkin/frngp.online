/* ============================================================
   purchases.jsx — Закупка комплектующих, реал-тайм $ ↔ Br
   ============================================================ */
const { useState: useStateP, useMemo: useMemoP } = React;

const TABS = [
  ...SERVERS.map(s => ({ id: s.id, server: true })),
  { id: 'acc', label: 'Сопутствующие', server: false },
];
const GROUP_IDS = TABS.map(t => t.id);

/* смета хранится в PostgreSQL через /api/purchases */
const purchasesApi = {
  load:  ()         => fetch('/api/purchases', { cache: 'no-store' }).then(r => r.json()),
  add:   (body)     => fetch('/api/purchases/items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()),
  patch: (id, body) => fetch('/api/purchases/items/' + id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  del:   (id)       => fetch('/api/purchases/items/' + id, { method: 'DELETE' }),
};

const emptyRows = () => Object.fromEntries(GROUP_IDS.map(g => [g, []]));
const toRow = (it) => ({ key: it.id, id: it.id, cat: it.category, item: it.item, qty: it.qty, price: it.price, cur: it.cur || 'usd' });

/* цена позиции, приведённая к USD (цену можно вводить в $ или в Br) */
const priceUSD = (r, rate) => {
  const p = Number(r.price) || 0;
  return r.cur === 'byn' ? (rate > 0 ? p / rate : 0) : p;
};
const lineTotal = (r, rate) => (Number(r.qty) || 0) * priceUSD(r, rate);
const sumRows = (rows, rate) => rows.reduce((s, r) => s + lineTotal(r, rate), 0);

function PurchasesPage({ names, rate, setRate }) {
  const [rows, setRows] = useStateP(emptyRows);
  const [active, setActive] = useStateP('dc');
  const saveTimers = React.useRef({});

  // первичная загрузка сметы из БД
  React.useEffect(() => {
    purchasesApi.load().then(data => {
      const o = emptyRows();
      (data.items || []).forEach(it => { (o[it.group_id] || (o[it.group_id] = [])).push(toRow(it)); });
      setRows(o);
    }).catch(() => {});
  }, []);

  const subtotals = useMemoP(() => {
    const o = {};
    Object.keys(rows).forEach(k => { o[k] = sumRows(rows[k], rate); });
    return o;
  }, [rows, rate]);
  const grand = Object.values(subtotals).reduce((s, v) => s + v, 0);

  // дебаунс-сохранение строки в БД (по 500 мс после правки)
  const queueSave = (row) => {
    if (!row || !row.id) return;
    clearTimeout(saveTimers.current[row.id]);
    saveTimers.current[row.id] = setTimeout(() => {
      purchasesApi.patch(row.id, {
        category: row.cat, item: row.item,
        qty: Number(row.qty) || 0, price: Number(row.price) || 0, cur: row.cur || 'usd',
      });
    }, 500);
  };

  const updateRow = (tab, key, field, val) => {
    setRows(prev => {
      const list = prev[tab].map(r => r.key === key ? { ...r, [field]: val } : r);
      queueSave(list.find(r => r.key === key));
      return { ...prev, [tab]: list };
    });
  };
  const addRow = (tab) => {
    purchasesApi.add({ group_id: tab, category: 'Прочее', item: '', qty: 1, price: 0, cur: 'usd' })
      .then(it => setRows(prev => ({ ...prev, [tab]: [...prev[tab], toRow(it)] })))
      .catch(() => {});
  };
  const delRow = (tab, key) => {
    setRows(prev => ({ ...prev, [tab]: prev[tab].filter(r => r.key !== key) }));
    purchasesApi.del(key);
  };

  const tabLabel = (t) => t.server ? (names[t.id] || SERVERS.find(s => s.id === t.id).name) : t.label;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 18 }}>
        <div>
          <div className="eyebrow">Сборка парка · смета</div>
          <h1 style={{ margin: '4px 0 0', fontSize: 27, fontWeight: 700, letterSpacing: '-.02em' }}>Закупка комплектующих</h1>
        </div>
        <RateEditor rate={rate} setRate={setRate} />
      </div>

      {/* grand total banner */}
      <div className="card" style={{ padding: 'var(--pad)', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', flexWrap: 'wrap', gap: 20, background: 'var(--surface)' }}>
        <div style={{ display: 'flex', gap: 38, flexWrap: 'wrap' }}>
          <div>
            <div className="eyebrow" style={{ fontSize: 10 }}>Итого, USD</div>
            <div style={{ fontSize: 36, fontWeight: 700, lineHeight: 1, letterSpacing: '-.02em' }} className="tnum">{fmtUSD(grand)}</div>
          </div>
          <div style={{ alignSelf: 'flex-end', paddingBottom: 3 }}>
            <div className="eyebrow" style={{ fontSize: 10 }}>Эквивалент</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--green-d)', lineHeight: 1.1 }} className="tnum">{fmtBYN(grand * rate)}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 26, alignItems: 'center' }}>
          {SERVERS.map(s => (
            <div key={s.id} style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{names[s.id] || s.name}</div>
              <div style={{ fontWeight: 700, fontSize: 15 }} className="tnum">{fmtUSD(subtotals[s.id])}</div>
            </div>
          ))}
          <div style={{ textAlign: 'right', paddingLeft: 20, borderLeft: '1px solid var(--line)' }}>
            <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>Сопутствующие</div>
            <div style={{ fontWeight: 700, fontSize: 15 }} className="tnum">{fmtUSD(subtotals.acc)}</div>
          </div>
        </div>
      </div>

      {/* layout: tabs+table | summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 'var(--gap)', alignItems: 'start' }}>
        <div className="card" style={{ padding: 'var(--pad)' }}>
          {/* tabs */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
            {TABS.map(t => {
              const on = active === t.id;
              return (
                <button key={t.id} onClick={() => setActive(t.id)}
                  style={{ border: '1px solid', borderColor: on ? 'transparent' : 'var(--line)',
                    background: on ? 'var(--ink)' : 'var(--surface-2)', color: on ? 'var(--surface)' : 'var(--ink-2)',
                    padding: '8px 15px', borderRadius: 999, fontSize: 13, fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: 8, transition: 'all .15s',
                    whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {t.server && <span style={{ width: 8, height: 8, borderRadius: '50%', background: SERVER_HEX[t.id], flexShrink: 0 }} />}
                  <span style={{ whiteSpace: 'nowrap' }}>{tabLabel(t)}</span>
                  <span style={{ opacity: .6, fontWeight: 500, whiteSpace: 'nowrap' }} className="tnum">{fmtUSD(subtotals[t.id])}</span>
                </button>
              );
            })}
          </div>

          <PurchaseTable
            rows={rows[active]} tab={active} rate={rate}
            onUpdate={updateRow} onAdd={addRow} onDelete={delRow}
          />
        </div>

        {/* summary */}
        <div className="card" style={{ padding: 'var(--pad)', position: 'sticky', top: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="eyebrow">Сводка сметы</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {SERVERS.map(s => {
              const part = grand ? (subtotals[s.id] / grand) * 100 : 0;
              return (
                <div key={s.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: SERVER_HEX[s.id] }} />
                      {names[s.id] || s.name}
                    </span>
                    <span style={{ fontWeight: 600 }} className="tnum">{fmtUSD(subtotals[s.id])}</span>
                  </div>
                  <Meter value={part} color={SERVER_HEX[s.id]} height={5} />
                </div>
              );
            })}
            <div style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 11 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--ink-3)' }} />
                  Сопутствующие
                </span>
                <span style={{ fontWeight: 600 }} className="tnum">{fmtUSD(subtotals.acc)}</span>
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Row k="Подытог" v={fmtUSD(grand)} />
            <Row k="НДС не учтён" v="—" muted />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontWeight: 700 }}>Итого</span>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700, fontSize: 19 }} className="tnum">{fmtUSD(grand)}</div>
                <div style={{ fontSize: 13, color: 'var(--green-d)', fontWeight: 600 }} className="tnum">{fmtBYN(grand * rate)}</div>
              </div>
            </div>
          </div>

          <div style={{ fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.4, background: 'var(--surface-2)',
            padding: '10px 12px', borderRadius: 'var(--radius-xs)' }}>
            Курс 1&nbsp;$ = {rate.toFixed(2)}&nbsp;Br. Эквивалент в&nbsp;Br пересчитывается на&nbsp;лету при&nbsp;вводе цен.
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v, muted }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: muted ? 'var(--ink-3)' : 'var(--ink-2)' }}>
      <span>{k}</span><span className="tnum">{v}</span>
    </div>
  );
}

function RateEditor({ rate, setRate }) {
  // setRate приходит инлайном из App (меняет identity каждый рендер) — держим в ref
  const setRateRef = React.useRef(setRate);
  setRateRef.current = setRate;
  const [meta, setMeta] = useStateP({ status: 'idle', source: null, updated: null, manual: false });

  const load = () => {
    setMeta(m => ({ ...m, status: 'loading' }));
    fetch('/api/rate', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
      .then(d => {
        const v = Number(d.rate);
        if (!(v > 0)) throw new Error('bad rate');
        setRateRef.current(v);
        setMeta({ status: 'ok', source: d.source, updated: d.updated, manual: false });
      })
      .catch(() => setMeta(m => ({ ...m, status: 'error' })));
  };

  // подтягиваем актуальный курс один раз при загрузке
  React.useEffect(() => { load(); }, []);

  const srcLabel = meta.source === 'onliner' ? 'onliner · рынок'
    : meta.source === 'nbrb' ? 'НБ РБ · офиц.' : '';
  const dateLabel = meta.updated ? new Date(meta.updated).toLocaleDateString('ru-RU') : '';
  const status =
      meta.manual ? 'задан вручную'
    : meta.status === 'loading' ? 'обновление…'
    : meta.status === 'error' ? 'источник недоступен'
    : meta.status === 'ok' ? `${srcLabel}${dateLabel ? ' · ' + dateLabel : ''}` : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, background: 'var(--surface)',
      border: '1px solid var(--line)', borderRadius: 'var(--radius-s)', padding: '8px 14px 7px', boxShadow: 'var(--shadow-s)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="eyebrow" style={{ fontSize: 10 }}>Курс</span>
        <span style={{ fontSize: 15, fontWeight: 600 }}>1&nbsp;$&nbsp;=</span>
        <input type="number" step="0.0001" value={rate}
          onChange={e => { setRate(Math.max(0, Number(e.target.value) || 0)); setMeta(m => ({ ...m, manual: true })); }}
          style={{ width: 80, fontSize: 16, fontWeight: 700, textAlign: 'right', border: 'none',
            borderBottom: '2px solid var(--green)', background: 'transparent', outline: 'none', padding: '2px 0' }}
          className="tnum" />
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--green-d)' }}>Br</span>
        <button onClick={load} title="Обновить курс"
          style={{ marginLeft: 2, border: 'none', background: 'transparent', cursor: 'pointer',
            fontSize: 15, color: 'var(--ink-3)', lineHeight: 1, padding: 2,
            transform: meta.status === 'loading' ? 'rotate(180deg)' : 'none', transition: 'transform .3s' }}>↻</button>
      </div>
      <div style={{ fontSize: 10, color: meta.status === 'error' ? 'var(--terra)' : 'var(--ink-3)', minHeight: 12 }}>
        {status}
      </div>
    </div>
  );
}

function PurchaseTable({ rows, tab, rate, onUpdate, onAdd, onDelete }) {
  const sub = sumRows(rows, rate);
  // переключить валюту ввода строки, сохранив реальную стоимость
  const swapCur = (r) => {
    const next = r.cur === 'byn' ? 'usd' : 'byn';
    const p = Number(r.price) || 0;
    const conv = next === 'byn' ? p * rate : (rate > 0 ? p / rate : 0);
    onUpdate(tab, r.key, 'price', +conv.toFixed(next === 'byn' ? 2 : 4));
    onUpdate(tab, r.key, 'cur', next);
  };
  const cell = { padding: '0 12px' };
  const inputBase = {
    border: '1px solid transparent', background: 'transparent', borderRadius: 7,
    padding: '7px 9px', fontSize: 13.5, width: '100%', outline: 'none', transition: 'all .12s',
  };
  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Категория', 'Наименование', 'Кол-во', 'Цена', 'Сумма, $', 'Сумма, Br', ''].map((c, i) => (
                <th key={i} style={{ textAlign: i >= 2 && i <= 5 ? 'right' : 'left', padding: '0 12px 11px',
                  fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3)',
                  fontWeight: 600, borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap' }}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const lt = lineTotal(r, rate);
              const cur = r.cur === 'byn' ? 'byn' : 'usd';
              return (
                <tr key={r.key} style={{ borderBottom: '1px solid var(--line-soft)' }} className="prow">
                  <td style={{ ...cell, width: 130 }}>
                    <select value={r.cat} onChange={e => onUpdate(tab, r.key, 'cat', e.target.value)}
                      style={{ ...inputBase, color: 'var(--ink-2)', cursor: 'pointer', fontSize: 12.5, padding: '7px 6px' }}>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                  <td style={cell}>
                    <input value={r.item} placeholder="наименование…"
                      onChange={e => onUpdate(tab, r.key, 'item', e.target.value)}
                      style={{ ...inputBase, fontWeight: 600 }} className="pinput" />
                  </td>
                  <td style={{ ...cell, width: 78 }}>
                    <input type="number" min="0" value={r.qty}
                      onChange={e => onUpdate(tab, r.key, 'qty', e.target.value)}
                      style={{ ...inputBase, textAlign: 'right' }} className="pinput tnum" />
                  </td>
                  <td style={{ ...cell, width: 132 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <input type="number" min="0" step="0.01" value={r.price}
                        onChange={e => onUpdate(tab, r.key, 'price', e.target.value)}
                        style={{ ...inputBase, textAlign: 'right', padding: '7px 6px' }} className="pinput tnum" />
                      <button type="button" onClick={() => swapCur(r)}
                        title={cur === 'byn' ? 'Ввод в Br · нажмите для $' : 'Ввод в $ · нажмите для Br'}
                        style={{ flexShrink: 0, width: 30, border: '1px solid var(--line)', borderRadius: 7,
                          background: 'var(--surface-2)', color: cur === 'byn' ? 'var(--green-d)' : 'var(--ink-2)',
                          fontSize: 12.5, fontWeight: 700, padding: '6px 0', cursor: 'pointer', lineHeight: 1 }}>
                        {cur === 'byn' ? 'Br' : '$'}
                      </button>
                    </div>
                  </td>
                  <td style={{ ...cell, textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }} className="tnum">{fmtUSD(lt)}</td>
                  <td style={{ ...cell, textAlign: 'right', color: 'var(--green-d)', fontWeight: 600, whiteSpace: 'nowrap' }} className="tnum">{fmtBYN(lt * rate)}</td>
                  <td style={{ ...cell, width: 34, textAlign: 'center' }}>
                    <button onClick={() => onDelete(tab, r.key)} title="Удалить"
                      style={{ border: 'none', background: 'transparent', color: 'var(--ink-3)', fontSize: 18,
                        lineHeight: 1, padding: 4, borderRadius: 6 }}
                      onMouseEnter={e => { e.currentTarget.style.color = 'var(--terra)'; e.currentTarget.style.background = 'var(--terra-bg)'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--ink-3)'; e.currentTarget.style.background = 'transparent'; }}>×</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} style={{ padding: '14px 12px 0' }}>
                <button onClick={() => onAdd(tab)}
                  style={{ border: '1px dashed var(--line)', background: 'var(--surface-2)', color: 'var(--ink-2)',
                    padding: '8px 14px', borderRadius: 9, fontSize: 13, fontWeight: 600 }}>+ Добавить позицию</button>
              </td>
              <td style={{ padding: '14px 12px 0', textAlign: 'right', fontWeight: 700, fontSize: 15 }} className="tnum">{fmtUSD(sub)}</td>
              <td style={{ padding: '14px 12px 0', textAlign: 'right', fontWeight: 700, fontSize: 15, color: 'var(--green-d)' }} className="tnum">{fmtBYN(sub * rate)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

Object.assign(window, { PurchasesPage });
