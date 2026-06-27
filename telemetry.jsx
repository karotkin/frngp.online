/* ============================================================
   telemetry.jsx — Главная: телеметрия нод ETH (NodeE) и Base (NodeB).
   Данные: GET /api/telemetry (node-api -> Prometheus). Поллинг 5с.
   Пока бэкенд недоступен — фолбэк на мок (SERVERS/TELE из data.jsx).
   ============================================================ */
const { useState: useStateT, useEffect: useEffectT } = React;

/* цвета клиентов */
const CLIENT_HEX = { geth: '#6f9c5b', lighthouse: '#6d8f9b', reth: '#cba23e', opnode: '#c8704f' };
const HOST_NAME = { nodee: 'NodeE', nodeb: 'NodeB' };

/* поллер телеметрии: {data, live, err} */
function useTelemetry(intervalMs = 5000) {
  const [state, setState] = useStateT({ data: null, live: false, err: null });
  useEffectT(() => {
    let stop = false;
    const tick = async () => {
      try {
        const r = await fetch('/api/telemetry', { cache: 'no-store' });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const j = await r.json();
        if (!stop) setState({ data: j, live: true, err: null });
      } catch (e) {
        if (!stop) setState((s) => ({ data: s.data, live: false, err: e.message }));
      }
    };
    tick();
    const id = setInterval(tick, intervalMs);
    return () => { stop = true; clearInterval(id); };
  }, [intervalMs]);
  return state;
}

function SectionTitle({ children, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, letterSpacing: '-.01em' }}>{children}</h2>
      {right}
    </div>
  );
}

function Legend({ items }) {
  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
      {items.map((it, i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--ink-2)' }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: it.color }} />{it.name}
        </span>
      ))}
    </div>
  );
}

const dash = (v, suf = '') => (v == null ? '—' : `${typeof v === 'number' ? fmtInt(Math.round(v)) : v}${suf}`);
const statusPill = (st) => {
  if (st === 'online') return { cls: 'green', label: 'online' };
  if (st === 'warn') return { cls: 'gold', label: 'sync' };
  if (st === 'down') return { cls: 'terra', label: 'offline' };
  return { cls: 'gold', label: st || '—' };
};

/* строки метрик ноды под тип клиента */
function nodeStats(c) {
  if (c.id === 'opnode') return [
    { label: 'unsafe', value: dash(c.head) },
    { label: 'safe', value: dash(c.safe) },
    { label: 'пиры', value: dash(c.peers), meter: c.peers, max: 80 },
    { label: 'sync', value: c.safe ? 'ok' : 'wait' },
  ];
  if (c.id === 'lighthouse') return [
    { label: 'слот', value: dash(c.head) },
    { label: 'пиры', value: dash(c.peers), meter: c.peers, max: 100 },
    { label: 'отставание', value: c.lag == null ? '—' : `${c.lag} сл` },
    { label: 'синхро', value: c.synced == null ? '—' : (c.synced ? 'ok' : 'нет') },
  ];
  // EL (geth / reth)
  return [
    { label: 'голова', value: dash(c.head) },
    { label: 'пиры', value: dash(c.peers), meter: c.peers, max: c.id === 'geth' ? 80 : 60 },
    { label: 'синхро', value: c.synced == null ? '—' : (c.synced ? 'ok' : 'нет') },
    { label: 'хост', value: HOST_NAME[c.host] || c.host },
  ];
}

/* ---------- Карточка клиента ---------- */
function NodeCard({ c, spark }) {
  const color = CLIENT_HEX[c.id] || 'var(--green)';
  const pill = statusPill(c.status);
  const hw = c.hw || {};
  const stats = nodeStats(c);
  return (
    <div className="card" style={{ padding: 'var(--pad)', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: color, flexShrink: 0 }} />
            <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-.01em' }}>{c.name}</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 3 }}>{c.role}</div>
        </div>
        <span className={`pill ${pill.cls}`}>
          <span className="dot live-dot" />{pill.label}
        </span>
      </div>

      {/* метрики ноды */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 18px' }}>
        {stats.map((s, i) => <Stat key={i} label={s.label} value={s.value} meter={s.meter} max={s.max || 100} />)}
      </div>

      {/* железо хоста */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12,
        borderTop: '1px solid var(--line-soft)', paddingTop: 11 }}>
        <MiniStat label="CPU" value={hw.cpu == null ? '—' : `${hw.cpu}%`} meter={hw.cpu} />
        <MiniStat label="RAM" value={hw.ram == null ? '—' : `${hw.ram}%`} meter={hw.ram} />
        <MiniStat label="Темп" value={hw.temp == null ? '—' : `${hw.temp}°`} meter={hw.temp} max={90} />
      </div>

      <div style={{ marginTop: 2 }}>
        <Sparkline data={spark && spark.length ? spark : [0, 0]} color={color} height={30} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--ink-3)',
        borderTop: '1px solid var(--line-soft)', paddingTop: 11 }}>
        <span className="mono">{HOST_NAME[c.host] || c.host}</span>
        <span>uptime {hw.uptime || '—'}</span>
      </div>
    </div>
  );
}

function Stat({ label, value, meter, max = 100 }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: meter != null ? 6 : 2 }}>
        <span className="eyebrow" style={{ fontSize: 10 }}>{label}</span>
        <span style={{ fontWeight: 700, fontSize: 15 }} className="tnum">{value}</span>
      </div>
      {meter != null && <Meter value={meter} max={max} />}
    </div>
  );
}
function MiniStat({ label, value, meter, max = 100 }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
        <span className="eyebrow" style={{ fontSize: 9.5 }}>{label}</span>
        <span style={{ fontWeight: 700, fontSize: 13 }} className="tnum">{value}</span>
      </div>
      {meter != null && <Meter value={meter} max={max} height={5} />}
    </div>
  );
}

function HeadStat({ label, value, unit, accent }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingRight: 26, borderRight: '1px solid var(--line)' }}>
      <span className="eyebrow" style={{ fontSize: 10 }}>{label}</span>
      <span style={{ fontSize: 24, fontWeight: 700, color: accent || 'var(--ink)', lineHeight: 1 }} className="tnum">
        {value}<span style={{ fontSize: 13, color: 'var(--ink-3)', fontWeight: 600, marginLeft: 3 }}>{unit}</span>
      </span>
    </div>
  );
}

/* алерты, выведенные из статусов карточек */
function deriveAlerts(cards, hosts) {
  const out = [];
  cards.forEach((c) => {
    if (c.status === 'down') out.push({ level: 'terra', title: `${c.name} · offline`, text: 'клиент не отвечает / нет метрик' });
    else if (c.status === 'warn') out.push({ level: 'gold', title: `${c.name} · рассинхрон`, text: `пиры ${dash(c.peers)}${c.lag != null ? `, отставание ${c.lag} сл` : ''}` });
  });
  hosts.forEach((h) => {
    if (h.diskFreePct != null && h.diskFreePct < 12) out.push({ level: 'gold', title: `${h.name} · диск`, text: `свободно ${h.diskFreePct}%` });
    if (h.temp != null && h.temp > 75) out.push({ level: 'terra', title: `${h.name} · температура`, text: `${h.temp}°C` });
    if (h.up === false) out.push({ level: 'terra', title: `${h.name} · хост недоступен`, text: 'node_exporter молчит' });
  });
  if (!out.length) out.push({ level: 'green', title: 'Все ноды в норме', text: 'EL/CL синхронны, пиры в норме' });
  return out;
}

function TelemetryPage() {
  const { data, live, err } = useTelemetry();
  const [clock, setClock] = useStateT(new Date());
  useEffectT(() => { const id = setInterval(() => setClock(new Date()), 1000); return () => clearInterval(id); }, []);

  // фолбэк на мок, пока бэкенд не отдаёт данные
  if (!data) return <FallbackTelemetry clock={clock} err={err} />;

  const cards = data.cards || [];
  const hosts = data.hosts || [];
  const series = data.series || {};
  const kpi = data.kpi || {};
  const sparkByHost = {};
  (series.cpu || []).forEach((s) => { sparkByHost[s.name] = s.data; });
  const alerts = deriveAlerts(cards, hosts);

  const hasSeries = (s) => Array.isArray(s) && s.some((x) => Array.isArray(x.data) && x.data.length);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div className="eyebrow">Ноды Ethereum · Base — мониторинг</div>
          <h1 style={{ margin: '4px 0 0', fontSize: 27, fontWeight: 700, letterSpacing: '-.02em' }}>Телеметрия нод</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 26 }}>
          <HeadStat label="Клиенты" value={`${kpi.clientsOnline ?? '—'}`} unit={`/ ${kpi.clientsTotal ?? cards.length}`} accent="var(--green-d)" />
          <HeadStat label="Хосты" value={`${kpi.hostsUp ?? '—'}`} unit="/ 2" />
          <HeadStat label="Пиры всего" value={fmtInt(kpi.peersTotal || 0)} unit="" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span className="eyebrow" style={{ fontSize: 10 }}>{live ? 'live' : 'нет связи'}</span>
            <span className="mono" style={{ fontSize: 20, fontWeight: 600, color: live ? 'var(--ink)' : 'var(--terra)' }}>
              {clock.toLocaleTimeString('ru-RU')}
            </span>
          </div>
        </div>
      </div>

      {/* карточки клиентов */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(4, cards.length) || 1}, 1fr)`, gap: 'var(--gap)' }}>
        {cards.map((c) => <NodeCard key={c.id} c={c} spark={sparkByHost[HOST_NAME[c.host]]} />)}
      </div>

      {/* графики ПО НОДАМ отдельно (со шкалами/осями) */}
      {hosts.map((h) => <NodeChartSection key={h.id} host={h} series={series} />)}

      {/* интеграции + алерты */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 'var(--gap)' }}>
        <div className="card" style={{ padding: 'var(--pad)' }}>
          <SectionTitle right={<span className={`pill ${live ? 'green' : 'gold'}`}><span className="dot live-dot" />{live ? 'сбор идёт' : 'lag'}</span>}>Стек мониторинга</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { name: 'Prometheus', kind: 'Сбор метрик', glyph: 'PR', ok: live },
              { name: 'WireGuard', kind: 'Туннель к нодам', glyph: 'WG', ok: kpi.hostsUp > 0 },
              { name: 'node_exporter', kind: `Железо · ${kpi.hostsUp ?? 0}/2 хоста`, glyph: 'NE', ok: kpi.hostsUp === 2 },
              { name: 'node-api', kind: 'Шейпинг JSON', glyph: 'API', ok: live },
            ].map((it, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                background: 'var(--surface-2)', borderRadius: 'var(--radius-s)', border: '1px solid var(--line-soft)' }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--surface)',
                  border: '1px solid var(--line)', display: 'grid', placeItems: 'center', fontWeight: 700,
                  fontSize: 12, color: 'var(--ink-2)', flexShrink: 0 }} className="mono">{it.glyph}</div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{it.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{it.kind}</div>
                </div>
                <span className={`pill ${it.ok ? 'green' : 'gold'}`} style={{ padding: '3px 8px' }}>
                  <span className="dot" />{it.ok ? 'ok' : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: 'var(--pad)' }}>
          <SectionTitle right={<span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{alerts.length} событий</span>}>Алерты</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {alerts.map((a, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '11px 13px', borderRadius: 'var(--radius-s)',
                background: 'var(--surface-2)', border: '1px solid var(--line-soft)' }}>
                <span style={{ width: 6, borderRadius: 99, background: `var(--${a.level === 'green' ? 'green' : a.level})`, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{a.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>{a.text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* таблица клиентов */}
      <div className="card" style={{ padding: 'var(--pad)' }}>
        <SectionTitle right={<span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{cards.length} клиентов</span>}>Клиенты нод</SectionTitle>
        <ClientTable cards={cards} />
      </div>
    </div>
  );
}

function Empty({ height = 150 }) {
  return <div style={{ height, display: 'grid', placeItems: 'center', color: 'var(--ink-3)', fontSize: 12 }}>нет данных за период</div>;
}

/* карточка одного графика: заголовок + легенда + Plot со шкалами */
function ChartCard({ title, series, max, unit, area = true, height = 168 }) {
  const has = (series || []).some((s) => Array.isArray(s.data) && s.data.length);
  return (
    <div className="card" style={{ padding: 'var(--pad)' }}>
      <SectionTitle right={has && <Legend items={series.map((s) => ({ name: s.name, color: s.color }))} />}>{title}</SectionTitle>
      {has ? <Plot series={series} max={max} unit={unit} area={area} height={height} /> : <Empty height={height} />}
    </div>
  );
}

/* секция одной ноды: 4 графика (CPU/Сеть/Пиры/Диск) только её рядов */
function NodeChartSection({ host, series }) {
  const pick = (arr) => (arr || []).filter((s) => s.node === host.id);
  const role = host.id === 'nodee' ? 'Ethereum L1 · Geth + Lighthouse' : 'Base L2 · base-reth + op-node';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div>
          <div className="eyebrow">{role}</div>
          <h2 style={{ margin: '3px 0 0', fontSize: 19, fontWeight: 700, letterSpacing: '-.01em' }}>{host.name}</h2>
        </div>
        <span className={`pill ${host.up ? 'green' : 'terra'}`}>
          <span className="dot live-dot" />{host.up ? 'хост online' : 'offline'}
          {host.up && <span style={{ color: 'var(--ink-3)', marginLeft: 8, fontWeight: 500 }}>uptime {host.uptime || '—'}</span>}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--gap)' }}>
        <ChartCard title="Нагрузка CPU, %" series={pick(series.cpu)} max={100} unit="%" area={false} />
        <ChartCard title="Сеть, Мбит/с" series={pick(series.net)} unit="Мбит" />
        <ChartCard title="P2P-пиры" series={pick(series.peers)} unit="" area={false} />
        <ChartCard title="Диск I/O, МБ/с" series={pick(series.disk)} unit="МБ/с" />
      </div>
    </div>
  );
}

function ClientTable({ cards }) {
  const cols = ['Клиент', 'Хост', 'Роль', 'Голова', 'Пиры', 'Синхро', 'Статус'];
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
        <thead>
          <tr>
            {cols.map((c, i) => (
              <th key={i} style={{ textAlign: i >= 3 && i <= 4 ? 'right' : 'left', padding: '0 14px 10px',
                fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 600,
                borderBottom: '1px solid var(--line)' }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cards.map((c) => {
            const pill = statusPill(c.status);
            return (
              <tr key={c.id} style={{ borderBottom: '1px solid var(--line-soft)' }}>
                <td style={{ padding: '11px 14px', fontWeight: 600 }} className="mono">{c.name}</td>
                <td style={{ padding: '11px 14px', color: 'var(--ink-2)' }}>{HOST_NAME[c.host] || c.host}</td>
                <td style={{ padding: '11px 14px', color: 'var(--ink-3)' }}>{c.role}</td>
                <td style={{ padding: '11px 14px', textAlign: 'right' }} className="tnum">{dash(c.head)}</td>
                <td style={{ padding: '11px 14px', textAlign: 'right' }} className="tnum">{dash(c.peers)}</td>
                <td style={{ padding: '11px 14px' }}>{c.synced == null ? '—' : (c.synced ? 'ok' : (c.safe ? 'safe ok' : 'нет'))}</td>
                <td style={{ padding: '11px 14px' }}>
                  <span className={`pill ${pill.cls}`} style={{ padding: '3px 9px' }}>
                    <span className="dot" />{pill.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- фолбэк: пока бэкенд недоступен, рисуем мок ---------- */
function FallbackTelemetry({ clock, err }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div className="eyebrow">Ноды Ethereum · Base — мониторинг</div>
          <h1 style={{ margin: '4px 0 0', fontSize: 27, fontWeight: 700, letterSpacing: '-.02em' }}>Телеметрия нод</h1>
        </div>
        <span className="pill gold"><span className="dot live-dot" />подключение к /api/telemetry…</span>
      </div>
      <div className="card" style={{ padding: 'var(--pad)', color: 'var(--ink-3)', fontSize: 13 }}>
        Бэкенд телеметрии пока недоступен{err ? ` (${err})` : ''}. Данные появятся, когда поднят Prometheus + node-api
        и ноды отдают метрики по WireGuard. Время: <span className="mono">{clock.toLocaleTimeString('ru-RU')}</span>
      </div>
    </div>
  );
}

Object.assign(window, { TelemetryPage });
