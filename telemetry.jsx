/* ============================================================
   telemetry.jsx — Главная: телеметрия, графики, интеграции
   ============================================================ */
const { useState: useStateT, useEffect: useEffectT } = React;

/* живые «дышащие» числа для эффекта реального времени */
function useLive(initial, amp, lo, hi) {
  const [v, setV] = useStateT(initial);
  useEffectT(() => {
    const id = setInterval(() => {
      setV(prev => {
        let n = prev + (Math.random() - 0.5) * amp;
        if (lo != null) n = Math.max(lo, n);
        if (hi != null) n = Math.min(hi, n);
        return Math.round(n);
      });
    }, 2200);
    return () => clearInterval(id);
  }, []);
  return v;
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

/* ---------- Карточка сервера ---------- */
function ServerCard({ s, names, color }) {
  const cpu = useLive(s.cpu, 9, 8, 99);
  const ram = useLive(s.ram, 5, 20, 95);
  const temp = useLive(s.temp, 3, 38, 84);
  const net = useLive(s.net, 60, 40, 990);
  const spark = TELE.cpu.find(c => c.name === s.name)?.data || [];
  const isWarn = cpu > 88 || temp > 70;
  return (
    <div className="card" style={{ padding: 'var(--pad)', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: color, flexShrink: 0 }} />
            <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-.01em' }}>{names[s.id] || s.name}</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 3 }}>{s.role}</div>
        </div>
        <span className={`pill ${isWarn ? 'gold' : 'green'}`}>
          <span className="dot live-dot" />{isWarn ? 'нагрузка' : 'online'}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '13px 18px' }}>
        <Stat label="CPU" value={`${cpu}%`} meter={cpu} />
        <Stat label="RAM" value={`${ram}%`} meter={ram} />
        <Stat label="Темп." value={`${temp}°`} meter={temp} max={90} />
        <Stat label="Сеть" value={`${net} Мбит`} />
      </div>

      <div style={{ marginTop: 2 }}>
        <Sparkline data={spark} color={SERVER_HEX[s.id]} height={34} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--ink-3)',
        borderTop: '1px solid var(--line-soft)', paddingTop: 11 }}>
        <span className="mono">{s.ip}</span>
        <span>uptime {s.uptime}</span>
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

/* ---------- KPI шапки ---------- */
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

function TelemetryPage({ names }) {
  const totalPower = useLive(1091, 30, 900, 1300);
  const reqs = useLive(8420, 220, 6000, 11000);
  const [clock, setClock] = useStateT(new Date());
  useEffectT(() => { const id = setInterval(() => setClock(new Date()), 1000); return () => clearInterval(id); }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div className="eyebrow">Парк серверов · мониторинг</div>
          <h1 style={{ margin: '4px 0 0', fontSize: 27, fontWeight: 700, letterSpacing: '-.02em' }}>Телеметрия и процессы</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 26 }}>
          <HeadStat label="Активны" value="4" unit="/ 4" accent="var(--green-d)" />
          <HeadStat label="Питание" value={fmtInt(totalPower)} unit="Вт" />
          <HeadStat label="Запросы/мин" value={fmtInt(reqs)} unit="" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span className="eyebrow" style={{ fontSize: 10 }}>Локально</span>
            <span className="mono" style={{ fontSize: 20, fontWeight: 600 }}>
              {clock.toLocaleTimeString('ru-RU')}
            </span>
          </div>
        </div>
      </div>

      {/* server cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--gap)' }}>
        {SERVERS.map(s => <ServerCard key={s.id} s={s} names={names} color={SERVER_HEX[s.id]} />)}
      </div>

      {/* charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 'var(--gap)' }}>
        <div className="card" style={{ padding: 'var(--pad)' }}>
          <SectionTitle right={<Legend items={TELE.cpu.map(c => ({ name: c.name, color: c.color }))} />}>
            Нагрузка CPU · последний час
          </SectionTitle>
          <LineArea series={TELE.cpu} height={200} max={110} area={false} />
        </div>
        <div className="card" style={{ padding: 'var(--pad)' }}>
          <SectionTitle right={<Legend items={TELE.net} />}>Сетевой трафик, Мбит/с</SectionTitle>
          <LineArea series={TELE.net} height={200} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.1fr', gap: 'var(--gap)' }}>
        <div className="card" style={{ padding: 'var(--pad)' }}>
          <SectionTitle right={<Legend items={TELE.disk} />}>Диски · I/O, МБ/с</SectionTitle>
          <LineArea series={TELE.disk} height={150} />
        </div>
        <div className="card" style={{ padding: 'var(--pad)' }}>
          <SectionTitle>Энергопотребление, Вт</SectionTitle>
          <Bars data={TELE.power} color="var(--gold)" height={150}
            labels={TELE.power.map((_, i) => i % 4 === 0 ? `${i}ч` : '')} />
        </div>
        <div className="card" style={{ padding: 'var(--pad)' }}>
          <SectionTitle>Температура ядер, °C</SectionTitle>
          <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', gap: 6, paddingTop: 6 }}>
            {SERVERS.map(s => (
              <div key={s.id} style={{ textAlign: 'center' }}>
                <Gauge value={s.temp} max={90} unit="°" size={104}
                  color={s.temp > 70 ? 'var(--terra)' : s.temp > 58 ? 'var(--gold)' : 'var(--green)'} />
                <div style={{ fontSize: 11.5, color: 'var(--ink-2)', marginTop: 4 }}>{names[s.id] || s.name}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* integrations + alerts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 'var(--gap)' }}>
        <div className="card" style={{ padding: 'var(--pad)' }}>
          <SectionTitle right={<span className="pill green"><span className="dot live-dot" />всё синхронно</span>}>Интеграции</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {INTEGRATIONS.map((it, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                background: 'var(--surface-2)', borderRadius: 'var(--radius-s)', border: '1px solid var(--line-soft)' }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--surface)',
                  border: '1px solid var(--line)', display: 'grid', placeItems: 'center', fontWeight: 700,
                  fontSize: 13, color: 'var(--ink-2)', flexShrink: 0 }} className="mono">{it.glyph}</div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{it.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{it.kind}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className={`pill ${it.status === 'ok' ? 'green' : 'gold'}`} style={{ padding: '3px 8px' }}>
                    <span className="dot" />{it.status === 'ok' ? 'ok' : 'lag'}
                  </span>
                  <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 4 }}>{it.sync}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: 'var(--pad)' }}>
          <SectionTitle right={<span style={{ fontSize: 12, color: 'var(--ink-3)' }}>4 события</span>}>Алерты</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {ALERTS.map((a, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '11px 13px', borderRadius: 'var(--radius-s)',
                background: 'var(--surface-2)', border: '1px solid var(--line-soft)' }}>
                <span style={{ width: 6, borderRadius: 99, background: `var(--${a.level === 'green' ? 'green' : a.level})`, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 13.5 }}>{a.title}</span>
                    <span style={{ fontSize: 11, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{a.time} назад</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>{a.text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* processes */}
      <div className="card" style={{ padding: 'var(--pad)' }}>
        <SectionTitle right={<span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{PROCESSES.length} активных</span>}>Запущенные процессы</SectionTitle>
        <ProcessTable names={names} />
      </div>
    </div>
  );
}

function ProcessTable({ names }) {
  const cols = ['PID', 'Процесс', 'Сервер', 'CPU %', 'Память', 'MEM %', 'Статус'];
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
        <thead>
          <tr>
            {cols.map((c, i) => (
              <th key={i} style={{ textAlign: i >= 3 && i <= 5 ? 'right' : 'left', padding: '0 14px 10px',
                fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 600,
                borderBottom: '1px solid var(--line)' }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PROCESSES.map((p, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--line-soft)' }}>
              <td className="mono" style={{ padding: '11px 14px', color: 'var(--ink-3)' }}>{p.pid}</td>
              <td style={{ padding: '11px 14px', fontWeight: 600 }} className="mono">{p.name}</td>
              <td style={{ padding: '11px 14px', color: 'var(--ink-2)' }}>{p.server}</td>
              <td style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 600,
                color: p.cpu > 60 ? 'var(--terra)' : 'var(--ink)' }} className="tnum">{p.cpu.toFixed(1)}</td>
              <td style={{ padding: '11px 14px', textAlign: 'right', color: 'var(--ink-2)' }} className="tnum">{fmtInt(p.memMb)} МБ</td>
              <td style={{ padding: '11px 14px', textAlign: 'right' }} className="tnum">{p.mem.toFixed(1)}</td>
              <td style={{ padding: '11px 14px' }}>
                <span className={`pill ${p.status === 'running' ? 'green' : 'gold'}`} style={{ padding: '3px 9px' }}>
                  <span className="dot" />{p.status === 'running' ? 'работает' : 'throttle'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

Object.assign(window, { TelemetryPage });
