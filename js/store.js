// Estado persistente en el navegador (en producción: base de datos del servidor).
const KEY = 'pulso:v1';

const defaults = () => ({
  profile: null,
  accounts: {},            // usuario -> { salt, hash, name, avatar }
  session: null,
  role: 'dueno',
  progress: {},            // courseId -> [índices completados]
  reminders: [],           // ids de salas
  customRooms: [],
  customCourses: [],
  alerts: [
    { id: 'al1', symbol: 'BTCUSDT', type: 'rsi_above', value: 70, tf: '1h', active: true },
    { id: 'al2', symbol: 'ETHUSDT', type: 'price_below', value: 0, active: true, auto: 0.97 },
    { id: 'al3', symbol: 'PAXGUSDT', type: 'price_above', value: 0, active: false, auto: 1.01 },
  ],
  alertLog: [],
  connections: { tradingview: true, exchange: false },
  activity: [],
  floorTools: {},           // usuario -> notas, activos, sesiones y récord de memoria
});

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const state = { ...defaults(), ...JSON.parse(raw) };
      for (const account of Object.values(state.accounts)) {
        if (account?.avatar && !account.avatar.kind) account.avatar.kind = 'legacy';
      }
      if (state.profile?.avatar && !state.profile.avatar.kind) state.profile.avatar.kind = 'legacy';
      return state;
    }
  } catch { /* almacenamiento no disponible */ }
  return defaults();
}

export const store = load();
export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* ignorar */ }
}
export function reset() {
  try { localStorage.removeItem(KEY); } catch {}
  location.reload();
}
