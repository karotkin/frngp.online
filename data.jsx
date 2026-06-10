/* ============================================================
   data.jsx — мок-данные и хелперы
   ============================================================ */

/* курс: 1 USD -> BYN (редактируемый в шапке закупок) */
const DEFAULT_RATE = 3.27;

const fmtUSD = (n) => '$' + Number(n).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtBYN = (n) => Number(n).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Br';
const fmtInt = (n) => Number(n).toLocaleString('ru-RU');

/* генератор псевдо-временного ряда */
function wave(base, amp, n = 40, seed = 1, noise = 0.4) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const s = Math.sin((i / n) * Math.PI * 2 * (1 + seed * 0.3) + seed);
    const s2 = Math.sin((i / n) * Math.PI * 6 + seed * 2) * 0.4;
    const r = (Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453) % 1;
    out.push(Math.max(0, +(base + amp * (s + s2) + amp * noise * (r - 0.5) * 2).toFixed(1)));
  }
  return out;
}

/* 4 сервера парка — названия редактируются */
const SERVERS = [
  { id: 'dc',   name: 'ЦОД',    role: 'Хранение · NAS',      ip: '10.0.0.11', cpu: 34, ram: 61, temp: 47, net: 312, power: 218, uptime: '142д 06ч', status: 'online' },
  { id: 'proc', name: 'ML/AL',  role: 'Compute · ETL',       ip: '10.0.0.12', cpu: 78, ram: 73, temp: 64, net: 540, power: 295, uptime: '142д 06ч', status: 'online' },
  { id: 'parse',name: 'SNIPER', role: 'Scraping · Workers',  ip: '10.0.0.13', cpu: 52, ram: 44, temp: 55, net: 880, power: 247, uptime: '58д 19ч',  status: 'online' },
  { id: 'conv', name: 'NAS',    role: 'Media · Transcode',   ip: '10.0.0.14', cpu: 91, ram: 58, temp: 71, net: 196, power: 331, uptime: '142д 05ч', status: 'warn' },
];

const SERVER_COLORS = {
  dc: 'var(--green)', proc: 'var(--slate)', parse: 'var(--gold)', conv: 'var(--terra)',
};
const SERVER_HEX = { dc: '#6f9c5b', proc: '#6d8f9b', parse: '#cba23e', conv: '#c8704f' };

/* временные ряды телеметрии (40 точек ≈ последний час) */
const TELE = {
  cpu:  SERVERS.map((s, i) => ({ name: s.name, color: SERVER_HEX[s.id], data: wave(s.cpu, 14, 40, i + 1) })),
  net:  [
    { name: 'Входящий',  color: '#6f9c5b', data: wave(420, 160, 40, 2) },
    { name: 'Исходящий', color: '#c8704f', data: wave(260, 120, 40, 5) },
  ],
  disk: [
    { name: 'Чтение',  color: '#6d8f9b', data: wave(140, 90, 40, 3) },
    { name: 'Запись',  color: '#cba23e', data: wave(90, 70, 40, 7) },
  ],
  power: wave(1090, 120, 24, 4, 0.25).map(v => Math.round(v)),
};

/* процессы */
const PROCESSES = [
  { pid: 4821, name: 'postgres', server: 'ЦОД',        cpu: 12.4, mem: 8.2, memMb: 2620, status: 'running' },
  { pid: 9120, name: 'etl-worker', server: 'Обработчик', cpu: 64.1, mem: 22.8, memMb: 7290, status: 'running' },
  { pid: 3344, name: 'spark-driver', server: 'Обработчик', cpu: 18.7, mem: 14.1, memMb: 4510, status: 'running' },
  { pid: 7781, name: 'scrapy-cluster', server: 'Парсер',  cpu: 41.2, mem: 9.6, memMb: 3070, status: 'running' },
  { pid: 7782, name: 'redis-queue', server: 'Парсер',     cpu: 6.3, mem: 4.2, memMb: 1340, status: 'running' },
  { pid: 5510, name: 'ffmpeg', server: 'Конвертор',       cpu: 88.5, mem: 11.7, memMb: 3740, status: 'running' },
  { pid: 5511, name: 'transcode-q', server: 'Конвертор',  cpu: 9.1, mem: 3.4, memMb: 1090, status: 'throttle' },
  { pid: 2201, name: 'node-exporter', server: 'ЦОД',      cpu: 1.2, mem: 0.8, memMb: 256, status: 'running' },
  { pid: 8890, name: 'nginx', server: 'ЦОД',              cpu: 3.4, mem: 1.1, memMb: 352, status: 'running' },
  { pid: 6677, name: 'docker-proxy', server: 'Обработчик', cpu: 2.1, mem: 1.9, memMb: 610, status: 'running' },
];

/* интеграции */
const INTEGRATIONS = [
  { name: 'Prometheus', kind: 'Сбор метрик',     sync: '4 сек назад',  status: 'ok',   glyph: 'PR' },
  { name: 'Grafana',    kind: 'Визуализация',     sync: '12 сек назад', status: 'ok',   glyph: 'GR' },
  { name: 'Proxmox VE', kind: 'Гипервизор',       sync: '38 сек назад', status: 'ok',   glyph: 'PX' },
  { name: 'Docker',     kind: '24 контейнера',    sync: '6 сек назад',  status: 'ok',   glyph: 'DK' },
  { name: 'Telegram',   kind: 'Алерты в бот',      sync: '2 мин назад',  status: 'ok',   glyph: 'TG' },
  { name: 'Cloudflare', kind: 'DNS · туннель',     sync: '1 мин назад',  status: 'warn', glyph: 'CF' },
];

/* алерты */
const ALERTS = [
  { level: 'terra', title: 'Конвертор · CPU > 90%', time: '3 мин', text: 'ffmpeg удерживает нагрузку 88% более 10 минут' },
  { level: 'gold',  title: 'Cloudflare · задержка туннеля', time: '14 мин', text: 'Время ответа 480 мс на cf-tunnel-2' },
  { level: 'gold',  title: 'Парсер · диск 82%', time: '46 мин', text: '/var/data заполнен на 82% — 1.1 ТБ свободно' },
  { level: 'green', title: 'ЦОД · бэкап завершён', time: '1 ч', text: 'Снапшот NAS 2.4 ТБ загружен в хранилище' },
];

/* ---------- шаблон закупок ---------- */
/* типовой набор комплектующих на сервер (цены в USD, допилишь позже) */
const buildKit = () => ([
  { cat: 'Процессор',    item: 'AMD EPYC 7402P (24c)',        qty: 1, price: 720 },
  { cat: 'Память',       item: 'DDR4 ECC 32 ГБ 3200',         qty: 4, price: 78 },
  { cat: 'Накопитель',   item: 'NVMe 2 ТБ Gen4',              qty: 2, price: 165 },
  { cat: 'Материнка',    item: 'Supermicro H12SSL-i',         qty: 1, price: 540 },
  { cat: 'Блок питания', item: 'Seasonic 850W Platinum',      qty: 1, price: 145 },
  { cat: 'Корпус',       item: 'Корпус 4U rackmount',         qty: 1, price: 190 },
  { cat: 'Охлаждение',   item: 'СО башенный + 3× 120мм',      qty: 1, price: 95 },
  { cat: 'Сетевая',      item: '10GbE SFP+ адаптер',          qty: 1, price: 130 },
]);

/* сопутствующие товары (общие) */
const buildAccessories = () => ([
  { cat: 'Стойка',     item: 'Серверная стойка 18U',         qty: 1, price: 340 },
  { cat: 'ИБП',        item: 'APC Smart-UPS 3000VA',         qty: 1, price: 980 },
  { cat: 'Сеть',       item: 'Коммутатор 24×1GbE + 4 SFP+',  qty: 1, price: 410 },
  { cat: 'Кабели',     item: 'Патч-корды Cat6a (комплект)',  qty: 12, price: 6 },
  { cat: 'Питание',    item: 'PDU 16A с мониторингом',       qty: 2, price: 120 },
  { cat: 'Прочее',     item: 'KVM-консоль + термопаста',     qty: 1, price: 165 },
]);

const CATEGORIES = ['Процессор','Память','Накопитель','Материнка','Блок питания','Корпус','Охлаждение','Сетевая','Стойка','ИБП','Сеть','Кабели','Питание','Прочее'];

Object.assign(window, {
  DEFAULT_RATE, fmtUSD, fmtBYN, fmtInt, wave,
  SERVERS, SERVER_COLORS, SERVER_HEX, TELE, PROCESSES, INTEGRATIONS, ALERTS,
  buildKit, buildAccessories, CATEGORIES,
});
