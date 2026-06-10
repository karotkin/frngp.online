/* ============================================================
   charts.jsx — SVG-примитивы графиков (без внешних библиотек)
   ============================================================ */
const { useId } = React;

function cssvar(name, fallback) {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/* ---------- Кольцевая диаграмма (как в референсе) ---------- */
function Donut({ size = 110, thickness = 13, segments, center, sub }) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  let offset = 0;
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke="var(--surface-3)" strokeWidth={thickness} />
        {segments.map((s, i) => {
          const len = (s.value / total) * c;
          const dash = `${len} ${c - len}`;
          const el = (
            <circle key={i} cx={size/2} cy={size/2} r={r} fill="none"
              stroke={s.color} strokeWidth={thickness}
              strokeDasharray={dash} strokeDashoffset={-offset}
              strokeLinecap="butt" />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
        <span style={{ fontSize: size * 0.30, fontWeight: 700, color: 'var(--ink)' }}>{center}</span>
        {sub && <span style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 3 }}>{sub}</span>}
      </div>
    </div>
  );
}

/* ---------- Полукруглый датчик (gauge) ---------- */
function Gauge({ value, max = 100, label, unit = '%', color, size = 132 }) {
  const pct = Math.max(0, Math.min(1, value / max));
  const r = size / 2 - 12;
  const cx = size / 2, cy = size / 2;
  const startA = Math.PI * 0.75, endA = Math.PI * 2.25; // 270° дуга
  const a = startA + (endA - startA) * pct;
  const polar = (ang) => [cx + r * Math.cos(ang), cy + r * Math.sin(ang)];
  const arcPath = (a0, a1) => {
    const [x0, y0] = polar(a0), [x1, y1] = polar(a1);
    const large = (a1 - a0) > Math.PI ? 1 : 0;
    return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
  };
  const col = color || (pct > 0.85 ? 'var(--terra)' : pct > 0.65 ? 'var(--gold)' : 'var(--green)');
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size}>
        <path d={arcPath(startA, endA)} fill="none" stroke="var(--surface-3)"
          strokeWidth={11} strokeLinecap="round" />
        <path d={arcPath(startA, a)} fill="none" stroke={col}
          strokeWidth={11} strokeLinecap="round" />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', lineHeight: 1.05 }}>
        <span style={{ fontSize: 30, fontWeight: 700 }}>{value}<span style={{ fontSize: 15, color: 'var(--ink-3)' }}>{unit}</span></span>
        {label && <span style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 5,
          textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600 }}>{label}</span>}
      </div>
    </div>
  );
}

/* ---------- Линейный/площадной график ---------- */
function LineArea({ series, height = 170, max, area = true, showGrid = true, yUnit = '' }) {
  const id = useId().replace(/:/g, '');
  const W = 600, H = height;
  const padL = 4, padR = 4, padT = 12, padB = 6;
  const n = series[0].data.length;
  const allMax = max || Math.max(...series.flatMap(s => s.data)) * 1.12 || 1;
  const x = (i) => padL + (i / (n - 1)) * (W - padL - padR);
  const y = (v) => padT + (1 - v / allMax) * (H - padT - padB);
  const linePath = (data) => data.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const areaPath = (data) => `${linePath(data)} L ${x(n-1)} ${H - padB} L ${x(0)} ${H - padB} Z`;
  const grid = [0, 0.25, 0.5, 0.75, 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height, display: 'block' }}>
      <defs>
        {series.map((s, i) => (
          <linearGradient key={i} id={`${id}-g${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={s.color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={s.color} stopOpacity="0" />
          </linearGradient>
        ))}
      </defs>
      {showGrid && grid.map((g, i) => (
        <line key={i} x1={padL} x2={W - padR} y1={padT + g * (H - padT - padB)} y2={padT + g * (H - padT - padB)}
          stroke="var(--line-soft)" strokeWidth="1" strokeDasharray={i === grid.length-1 ? '0' : '3 4'} />
      ))}
      {area && series.map((s, i) => (
        <path key={`a${i}`} d={areaPath(s.data)} fill={`url(#${id}-g${i})`} />
      ))}
      {series.map((s, i) => (
        <path key={`l${i}`} d={linePath(s.data)} fill="none" stroke={s.color}
          strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}

/* ---------- Спарклайн (мини-график) ---------- */
function Sparkline({ data, color, height = 38, fill = true }) {
  const id = useId().replace(/:/g, '');
  const W = 120, H = height;
  const mx = Math.max(...data) * 1.15 || 1, mn = Math.min(...data) * 0.9;
  const rng = (mx - mn) || 1;
  const x = (i) => (i / (data.length - 1)) * W;
  const y = (v) => H - ((v - mn) / rng) * (H - 4) - 2;
  const line = data.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height, display: 'block' }}>
      <defs>
        <linearGradient id={`${id}-sp`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={`${line} L ${W} ${H} L 0 ${H} Z`} fill={`url(#${id}-sp)`} />}
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round"
        strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/* ---------- Вертикальные столбцы ---------- */
function Bars({ data, color, height = 150, labels, max }) {
  const mx = max || Math.max(...data) * 1.12 || 1;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height }}>
      {data.map((v, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: 6 }}>
          <div style={{ width: '100%', maxWidth: 26, height: `${(v / mx) * 100}%`,
            background: color, borderRadius: '5px 5px 3px 3px', minHeight: 3,
            transition: 'height .4s ease' }} />
          {labels && <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>{labels[i]}</span>}
        </div>
      ))}
    </div>
  );
}

/* ---------- Горизонтальный прогресс ---------- */
function Meter({ value, max = 100, color, height = 7 }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const col = color || (pct > 85 ? 'var(--terra)' : pct > 65 ? 'var(--gold)' : 'var(--green)');
  return (
    <div style={{ background: 'var(--surface-3)', borderRadius: 99, height, overflow: 'hidden', width: '100%' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: col, borderRadius: 99, transition: 'width .5s ease' }} />
    </div>
  );
}

Object.assign(window, { Donut, Gauge, LineArea, Sparkline, Bars, Meter, cssvar });
