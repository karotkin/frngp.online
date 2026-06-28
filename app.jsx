/* ============================================================
   app.jsx — оболочка: сайдбар, роутинг, tweaks
   ============================================================ */
const { useState, useEffect } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "light",
  "density": "regular",
  "font": "Golos Text",
  "accent": ["#6f9c5b", "#c8704f", "#cba23e"],
  "name_dc": "ЦОД",
  "name_proc": "ML/AL",
  "name_parse": "SNIPER",
  "name_conv": "NAS",
  "rate": 3.27
}/*EDITMODE-END*/;

const NAV = [
  { id: 'tele', label: 'Телеметрия', glyph: '◷', hint: 'процессы и графики' },
  { id: 'buy',  label: 'Закупки',    glyph: '▦', hint: 'смета комплектующих' },
];

function Sidebar({ page, setPage, online, theme, onSetTheme }) {
  return (
    <aside className="app-sidebar" style={{ width: 232, flexShrink: 0, borderRight: '1px solid var(--line)',
      background: 'var(--surface)', display: 'flex', flexDirection: 'column', padding: '22px 16px',
      position: 'sticky', top: 0, height: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '4px 8px 22px' }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--green)', display: 'grid',
          placeItems: 'center', color: '#fff', fontWeight: 700, fontSize: 16 }} className="mono">f</div>
        <div style={{ lineHeight: 1.1 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>frngp<span style={{ color: 'var(--ink-3)' }}>.online</span></div>
          <div style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>серверный парк</div>
        </div>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {NAV.map(n => {
          const on = page === n.id;
          return (
            <button key={n.id} onClick={() => setPage(n.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 12px', borderRadius: 10,
                border: 'none', background: on ? 'var(--surface-2)' : 'transparent', textAlign: 'left',
                color: on ? 'var(--ink)' : 'var(--ink-2)', transition: 'all .15s', width: '100%' }}>
              <span style={{ fontSize: 17, width: 20, textAlign: 'center', color: on ? 'var(--green)' : 'var(--ink-3)' }}>{n.glyph}</span>
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontWeight: 600, fontSize: 14 }}>{n.label}</span>
                <span style={{ display: 'block', fontSize: 11, color: 'var(--ink-3)' }}>{n.hint}</span>
              </span>
              {on && <span style={{ width: 5, height: 22, borderRadius: 99, background: 'var(--green)' }} />}
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer" style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* переключатель темы */}
        <div style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--surface-2)',
          borderRadius: 'var(--radius-s)', border: '1px solid var(--line-soft)' }}>
          {[['light', '☀', 'Светлая'], ['dark', '☾', 'Тёмная']].map(([val, ic, lbl]) => {
            const on = theme === val;
            return (
              <button key={val} onClick={() => onSetTheme(val)} title={lbl + ' тема'}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  border: 'none', borderRadius: 8, padding: '7px 4px', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  background: on ? 'var(--surface)' : 'transparent', color: on ? 'var(--ink)' : 'var(--ink-3)',
                  boxShadow: on ? 'var(--shadow-s)' : 'none', transition: 'all .15s' }}>
                <span style={{ fontSize: 13 }}>{ic}</span>{lbl}
              </button>
            );
          })}
        </div>

        <div style={{ padding: '12px 13px', background: 'var(--surface-2)', borderRadius: 'var(--radius-s)',
          border: '1px solid var(--line-soft)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600 }}>
            <span className="dot live-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)' }} />
            Все системы в норме
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 5 }}>{online}/4 серверов · uptime 99.98%</div>
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--ink-3)', padding: '0 8px' }}>Нажмите «Tweaks» в&nbsp;тулбаре, чтобы сменить шрифт, акценты и&nbsp;названия серверов.</div>
      </div>
    </aside>
  );
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [page, setPage] = useState('tele');
  const [rate, setRate] = useState(t.rate);

  useEffect(() => { setRate(t.rate); }, [t.rate]);

  // применяем тему/плотность/шрифт/акценты к :root
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', t.theme);
    root.setAttribute('data-density', t.density);
    root.style.setProperty('--font', `'${t.font}', system-ui, sans-serif`);
    const [g, te, go] = t.accent;
    root.style.setProperty('--green', g);
    root.style.setProperty('--terra', te);
    root.style.setProperty('--gold', go);
  }, [t.theme, t.density, t.font, t.accent]);

  const names = { dc: t.name_dc, proc: t.name_proc, parse: t.name_parse, conv: t.name_conv };

  return (
    <div className="app-shell" style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar page={page} setPage={setPage} online={4} theme={t.theme} onSetTheme={(v) => setTweak('theme', v)} />
      <main className="app-main" style={{ flex: 1, minWidth: 0, padding: '26px 30px 60px', maxWidth: 1500, margin: '0 auto', width: '100%' }}>
        {page === 'tele'
          ? <TelemetryPage names={names} />
          : <PurchasesPage names={names} rate={rate} setRate={(v) => { setRate(v); setTweak('rate', v); }} />}
      </main>

      <TweaksPanel>
        <TweakSection label="Оформление" />
        <TweakRadio label="Тема" value={t.theme} options={['light', 'dark']}
          onChange={v => setTweak('theme', v)} />
        <TweakRadio label="Плотность" value={t.density} options={['compact', 'regular', 'comfy']}
          onChange={v => setTweak('density', v)} />
        <TweakSelect label="Шрифт" value={t.font}
          options={['Golos Text', 'Manrope', 'Onest', 'Nunito Sans']}
          onChange={v => setTweak('font', v)} />
        <TweakColor label="Акценты" value={t.accent}
          options={[
            ['#6f9c5b', '#c8704f', '#cba23e'],
            ['#3a7ca5', '#5fb0a5', '#c98a3e'],
            ['#5a8f6b', '#b8654a', '#8a7fb5'],
            ['#5a5fd8', '#22a06b', '#e0823d'],
          ]}
          onChange={v => setTweak('accent', v)} />

        <TweakSection label="Названия серверов" />
        <TweakText label="Сервер 1" value={t.name_dc} onChange={v => setTweak('name_dc', v)} />
        <TweakText label="Сервер 2" value={t.name_proc} onChange={v => setTweak('name_proc', v)} />
        <TweakText label="Сервер 3" value={t.name_parse} onChange={v => setTweak('name_parse', v)} />
        <TweakText label="Сервер 4" value={t.name_conv} onChange={v => setTweak('name_conv', v)} />

        <TweakSection label="Закупки" />
        <TweakNumber label="Курс $ → Br" value={t.rate} min={0} max={10} step={0.01}
          onChange={v => { setTweak('rate', v); setRate(v); }} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
