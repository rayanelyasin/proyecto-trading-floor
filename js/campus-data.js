// Datos del campus: edificios fijos y lugares que crea el dueño.
// Los lugares se guardan en la cuenta local (store) y, si el servidor lo permite, en /__campus
// para que aparezcan al entrar desde otro dispositivo que use el mismo servidor.
import { store, save } from './store.js';

export const BUILDINGS = [
  { id: 'oficina', name: 'Oficina Pulso', detail: 'Piso de trading de 4 plantas', route: '#/piso', color: '#d9bf8c' },
  { id: 'lab', name: 'Laboratorio Pulso', detail: 'Mina y prueba estrategias', route: '#/lab', color: '#4fd1a1' },
  { id: 'ai', name: 'Mi oficina IA', detail: 'Tu equipo de agentes', route: '#/ai', color: '#3a9f7f' },
];
export const PLACE_COLORS = ['#d9bf8c', '#4fd1a1', '#8a9bb5', '#d9a35f', '#f06272', '#a0b4d2'];
export const LAND_SLOTS = [{ x: -46, z: -8 }, { x: 46, z: -8 }, { x: -18, z: -46 }, { x: 18, z: -46 }];
export const MAX_PLACES = 40;

const clean = (p) => ({
  id: String(p.id), name: String(p.name || 'Lugar').slice(0, 40), description: String(p.description || '').slice(0, 200),
  x: Math.max(-48, Math.min(48, +p.x || 0)), z: Math.max(-48, Math.min(48, +p.z || 0)),
  color: PLACE_COLORS.includes(p.color) ? p.color : PLACE_COLORS[0],
  link: { type: ['building', 'url', 'none'].includes(p.link?.type) ? p.link.type : 'none', value: String(p.link?.value || '').slice(0, 300) },
});

export async function loadPlaces() {
  let places = Array.isArray(store.campus?.places) ? store.campus.places : [];
  try {
    const res = await fetch('/__campus', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.places) && (data.places.length || !places.length)) places = data.places;
    }
  } catch { /* sin servidor de datos: se usa el almacenamiento local */ }
  places = places.map(clean);
  store.campus = { places };
  save();
  return places;
}

// Devuelve 'servidor' si quedó guardado también en el servidor, o 'local' si solo en este navegador.
export async function savePlaces(places) {
  places = places.slice(0, MAX_PLACES).map(clean);
  store.campus = { places };
  save();
  try {
    const res = await fetch('/__campus', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ places }) });
    if (res.ok) return 'servidor';
  } catch { /* solo local */ }
  return 'local';
}

export const newPlaceId = () => `lugar-${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
