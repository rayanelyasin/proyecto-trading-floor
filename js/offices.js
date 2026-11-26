// Interiores de los edificios 2 y 3 del campus, construidos con las mismas piezas de Pulso
// (muros, escritorios, sillas, monitores, racks, quioscos, avatares y cámara de scene.js).
// Piso 5: Laboratorio Pulso (agentes de trading). Piso 6: Mi oficina IA (los agentes del artefacto).
import * as THREE from 'three';
import { OFICINA } from './oficina-ai-data.js';

export const LAB_FLOOR = { n: 5, name: 'Laboratorio', description: 'Minería de estrategias, incubadora y agentes de trading', color: '#4fd1a1', building: 'lab', title: 'Laboratorio Pulso' };
export const AI_FLOOR = { n: 6, name: 'Mi oficina IA', description: 'Tu equipo de agentes de IA, por departamentos', color: '#6fc3a0', building: 'ai', title: 'Mi oficina IA' };

const PI = Math.PI;
const zone = (id, label, detail, panel, arg, x, z, r, extra = {}) => ({ id, label, detail, panel, arg, x, z, r, ...extra });

// ---------- Laboratorio (piso 5) ----------
export const LAB_AGENTS = [
  { id: 'dir', name: 'Directora', role: 'Dirección', color: '#d9bf8c', focus: 'Convoca el comité y decide qué pasa al examen.', tool: 'comite' },
  { id: 'rie', name: 'Riesgos', role: 'Departamento de riesgos', color: '#f06272', focus: 'Bloquea lo que no cumple caída máxima, costos y robustez.', tool: 'riesgos' },
  { id: 'mac', name: 'Macro', role: 'Economista macro', color: '#8a9bb5', focus: 'Lee el mercado y la agenda del día.', tool: 'mercado' },
  { id: 'ana', name: 'Análisis', role: 'Analista de mercado', color: '#4fd1a1', focus: 'Calcula tendencia, RSI y niveles de cada activo.', tool: 'mercado' },
  { id: 'min', name: 'Minero', role: 'Minería de estrategias', color: '#d9a35f', focus: 'Prueba miles de combinaciones con velas reales.', tool: 'mineria' },
  { id: 'qua', name: 'Quant', role: 'Reparto por riesgo', color: '#a0b4d2', focus: 'Vigila la incubadora y reparte el capital simulado.', tool: 'incubadora' },
];
const LAB_XS = [-15, -10.5, -6], LAB_ZS = [-7.2, -2.6];
export const LAB_SEATS = LAB_AGENTS.map((a, i) => {
  const x = LAB_XS[i % 3], z = LAB_ZS[Math.floor(i / 3)];
  return { floor: 5, ...a, key: `lab:${a.id}`, x, z: z + 0.95, rot: PI, desk: [x, z], stand: [x, z + 0.95 + 1.25], lines: [a.focus] };
});
export const LAB_ZONES = [
  zone('mineria', 'Minería', 'Prueba estrategias con velas reales', 'lab', 'mineria', -16, -11.55, 2.1, { station: [-16, -13.4] }),
  zone('incubadora', 'Incubadora', 'Examen en simulación de cada estrategia', 'lab', 'incubadora', -11.5, -11.55, 2.1, { station: [-11.5, -13.4] }),
  zone('ranking', 'Ranking', 'Las mejores estrategias del laboratorio', 'lab', 'ranking', -7, -11.55, 2.1, { station: [-7, -13.4] }),
  zone('riesgos', 'Riesgos', 'Reglas que bloquean lo inseguro', 'lab', 'riesgos', -2.5, -11.55, 2.1, { station: [-2.5, -13.4] }),
  zone('mercado', 'Muro de mercado', 'Gráficos, indicadores y calculadora', 'analisis', undefined, 9, -9.3, 3.8),
  zone('comite', 'Sala de comité', 'La directora reúne a todos los equipos', 'lab', 'comite', 4, 6.6, 2.6),
  zone('conexiones', 'Servidores', 'Qué está activo y qué falta conectar', 'lab', 'conexiones', 16.5, -6.5, 2.2),
  zone('alertas', 'Alertas', 'Avisos de precio e indicadores', 'alertas', undefined, -8, 10.35, 1.9, { station: [-8, 12.2, PI] }),
  zone('seguimiento', 'Seguimiento', 'Activos favoritos y sus precios', 'seguimiento', undefined, -3.5, 10.35, 1.9, { station: [-3.5, 12.2, PI] }),
  zone('agentes', 'Piso de agentes', 'Lecturas de los agentes de Pulso', 'agentes', undefined, 1, 10.35, 1.9, { station: [1, 12.2, PI] }),
  ...LAB_SEATS.map((s) => zone(`ag-${s.key}`, s.name, s.role, 'agente', s.key, s.stand[0], s.stand[1], 1.25, { agent: true })),
];
export const LAB_SPAWN = { x: 2, z: 9.5 };

// ---------- Mi oficina IA (piso 6) ----------
const E = Object.fromEntries(OFICINA.empleados.map((e) => [e.id, e]));
const ROOMS = [
  { id: 'creacion', name: 'Creación', rug: '#4a3d32', plaque: [-11, -9.9], xs: [-16.5, -12.9, -9.3, -5.7], zs: [-8, -3.5], ids: ['ganchos', 'guiones', 'captions', 'calendario', 'carruseles', 'ideas', 'mi-voz', 'contratar'], rect: [-18.4, -4.2, -10.5, -0.2] },
  { id: 'negocio', name: 'Negocio', rug: '#35463f', plaque: [9.5, -9.9], xs: [7, 12], zs: [-8, -3.5], ids: ['atencion-clientes', 'contabilidad', 'correos', 'cotizaciones'], rect: [5.2, 13.6, -10.5, -0.2] },
  { id: 'pedidos', name: 'Pedidos', rug: '#3f3b52', plaque: [-12, 2.5], xs: [-14.5, -9.5], zs: [4.5, 9], ids: ['whatsapp-crm', 'confirmar-pedidos', 'enviar-guias', 'rastrear-pedidos'], rect: [-16.4, -7.6, 2.1, 11.6] },
  { id: 'crecimiento', name: 'Crecimiento', rug: '#523b3b', plaque: [11.5, 1.6], xs: [7.5, 11.5, 15.5], zs: [3.5, 7.5, 11.5], ids: ['cobranzas', 'reporte-semanal', 'anuncios', 'meta-ads', 'inventario', 'resenas', 'panel', 'editor', 'color'], rect: [5.4, 17.6, 1.6, 13.4] },
];
const palette = ['#d9bf8c', '#6f8fb3', '#6f9a7f', '#c47b5a', '#8a82a8', '#d9a35f', '#a0b4d2', '#99c0aa'];
export const AI_SEATS = [
  { key: 'ai:director', id: 'director', room: 'dirección', x: 0, z: -10.05, rot: PI, desk: [0, -11], stand: [0, -8.6] },
  ...ROOMS.flatMap((r) => r.ids.map((id, i) => {
    const x = r.xs[i % r.xs.length], z = r.zs[Math.floor(i / r.xs.length)];
    return { key: `ai:${id}`, id, room: r.name, x, z: z + 0.95, rot: PI, desk: [x, z], stand: [x, z + 0.95 + 1.25] };
  })),
].map((s, i) => ({ floor: 6, ...s, name: E[s.id].puesto, role: E[s.id].hace, doing: E[s.id].haciendo, delivers: E[s.id].entrega, color: palette[i % palette.length], lines: [E[s.id].haciendo] }));
export const AI_ZONES = [
  zone('director', 'Director', 'Reparte el trabajo a todos', 'oficinaai', 'director', 0, -8.6, 1.6),
  zone('trabajos', 'Nuevo trabajo', 'Elige un flujo y mira quién lo hace', 'oficinaai', 'trabajos', -4.5, 11.75, 1.8, { station: [-4.5, 13.6, PI] }),
  zone('negocio', 'Mi negocio', 'Tus números y tu agenda', 'oficinaai', 'negocio', -0.5, 11.75, 1.8, { station: [-0.5, 13.6, PI] }),
  zone('entregas', 'Entregas', 'Lo que tus agentes dejaron listo', 'oficinaai', 'entregas', 3.5, 11.75, 1.8, { station: [3.5, 13.6, PI] }),
  ...AI_SEATS.filter((s) => s.id !== 'director').map((s) => zone(`ag-${s.key}`, s.name, s.role, 'agente', s.key, s.stand[0], s.stand[1], 1.25, { agent: true })),
];
export const AI_SPAWN = { x: 0, z: 8.5 };

// ---------- pantallas ----------
function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }
const FONT = '"Inter", system-ui, sans-serif', SERIF = 'Georgia, "Fraunces", serif';
export function drawLabBoard(s, d = {}) {
  const { ctx, canvas: c } = s, W = c.width, H = c.height;
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#15161a'); g.addColorStop(1, '#0b0c0e'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#4fd1a1'; ctx.fillRect(0, 0, 12, H);
  ctx.fillStyle = '#f1e7d7'; ctx.font = `500 ${H * 0.1}px ${SERIF}`; ctx.fillText('Laboratorio Pulso', 60, H * 0.14);
  ctx.fillStyle = '#9a958c'; ctx.font = `500 ${H * 0.04}px ${FONT}`; ctx.fillText(d.live ? 'Precios en vivo · estrategias en simulación' : 'Conectando con el mercado…', 60, H * 0.205);
  const prices = d.prices || [];
  prices.forEach((p, i) => {
    const y = H * 0.32 + i * H * 0.115;
    ctx.fillStyle = '#d9bf8c'; ctx.font = `600 ${H * 0.06}px ${FONT}`; ctx.fillText(p.name, 60, y);
    ctx.fillStyle = '#efece6'; ctx.font = `600 ${H * 0.06}px ${FONT}`; ctx.textAlign = 'right'; ctx.fillText(p.price, W * 0.46, y);
    ctx.fillStyle = p.change >= 0 ? '#4fd1a1' : '#f06272'; ctx.fillText(`${p.change >= 0 ? '+' : '−'}${Math.abs(p.change).toFixed(2)} %`, W * 0.62, y); ctx.textAlign = 'left';
  });
  ctx.fillStyle = '#d9bf8c'; ctx.font = `600 ${H * 0.05}px ${FONT}`; ctx.fillText('Incubadora', W * 0.66, H * 0.14);
  const list = d.strategies || [];
  if (!list.length) { ctx.fillStyle = '#9a958c'; ctx.font = `500 ${H * 0.04}px ${FONT}`; ctx.fillText('Sin estrategias todavía.', W * 0.66, H * 0.24); ctx.fillText('Mina algunas en el quiosco', W * 0.66, H * 0.3); ctx.fillText('de Minería.', W * 0.66, H * 0.36); }
  list.slice(0, 6).forEach((s2, i) => {
    const y = H * 0.24 + i * H * 0.12;
    ctx.fillStyle = s2.inPosition ? '#4fd1a1' : '#6b6760'; ctx.beginPath(); ctx.arc(W * 0.67, y - H * 0.014, H * 0.016, 0, 7); ctx.fill();
    ctx.fillStyle = '#efece6'; ctx.font = `500 ${H * 0.04}px ${FONT}`; ctx.fillText(String(s2.name).slice(0, 24), W * 0.69, y);
    ctx.fillStyle = '#9a958c'; ctx.font = `500 ${H * 0.032}px ${FONT}`; ctx.fillText(`${s2.status} · ${s2.inPosition ? 'compra' : 'fuera'}`, W * 0.69, y + H * 0.04);
  });
  s.texture.needsUpdate = true;
}
function drawMetaBoard(s) {
  const { ctx, canvas: c } = s, W = c.width, H = c.height;
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#16231f'); g.addColorStop(1, '#0c1512'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#6fc3a0'; ctx.fillRect(0, 0, 12, H);
  ctx.fillStyle = '#e9f5ee'; ctx.font = `600 ${H * 0.16}px ${SERIF}`; ctx.fillText(OFICINA.marca, 60, H * 0.28);
  ctx.fillStyle = '#9fc4b3'; ctx.font = `500 ${H * 0.06}px ${FONT}`; ctx.fillText(`Oficina de ${OFICINA.dueno} · ${OFICINA.empleados.length} agentes`, 60, H * 0.4);
  ctx.fillStyle = '#6fc3a0'; ctx.font = `600 ${H * 0.06}px ${FONT}`; ctx.fillText(OFICINA.meta.titulo.toUpperCase(), 60, H * 0.62);
  ctx.fillStyle = '#e9f5ee'; ctx.font = `600 ${H * 0.2}px ${FONT}`; ctx.fillText(OFICINA.meta.valor, 60, H * 0.84);
  ctx.fillStyle = '#9fc4b3'; ctx.font = `500 ${H * 0.05}px ${FONT}`; ctx.fillText(OFICINA.meta.detalle, W * 0.6, H * 0.84);
  s.texture.needsUpdate = true;
}

// ---------- construcción de los pisos ----------
export function buildLab(h) {
  const { M, box, cyl, desk, officeChair, monitor, makeScreen, workstation, plant, sofa, laptop, rack, glassWall, plaque, tag, ob, spot, warm, dark } = h;
  warm(-8, 4.6, -6, 40); warm(8, 4.6, 0, 40);
  // muro de mercado con pantalla grande y escritorio de análisis
  const wall = makeScreen(13, 5.4, 1536);
  wall.mesh.position.set(9, 3.6, -14.8); tag(wall.mesh, 'mercado');
  drawLabBoard(wall, {});
  desk(9, -11.4, 8, 1.0);
  [-2.6, 0, 2.6].forEach((dx, i) => { const s = monitor(9 + dx, -11.4, 1.1, 0.62); h.paintMini(s, i - 1); tag(s.mesh, 'mercado'); officeChair(9 + dx, -10.5, PI); });
  ob(5, 9, -11.4, 8.2, 1.1);
  plaque('Laboratorio', -9, 3.6, -14.9, 0, 3.4);
  // trading: un puesto por agente, con su pantalla y su silla
  LAB_SEATS.forEach((s) => workstation(5, s.desk[0], s.desk[1], 2, 2.6, 'chart'));
  // centro de cómputo (servidores) con vidrio
  { const fl = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 9), new THREE.MeshStandardMaterial({ color: 0x1c1e21, roughness: 0.5, metalness: 0.4 })); fl.rotation.x = -PI / 2; fl.position.set(16.5, 0.014, -8.2); fl.receiveShadow = true; h.scene.add(fl); }
  [-11.4, -9.9, -8.4, -6.9, -5.4].forEach((z) => { rack(18.7, z, -PI / 2); rack(14.3, z, PI / 2); ob(5, 18.7, z, 0.95, 0.85); ob(5, 14.3, z, 0.95, 0.85); });
  glassWall(14.75, -3.9, 2.3, 0.06); glassWall(18.4, -3.9, 2.2, 0.06); glassWall(13.6, -8.2, 0.06, 8.6);
  ob(5, 14.75, -3.9, 2.3, 0.2); ob(5, 18.4, -3.9, 2.2, 0.2); ob(5, 13.6, -8.2, 0.2, 8.6);
  plaque('Servidores', 16.55, 3.35, -3.92, 0, 3.4);
  // sala de comité
  { const rg = new THREE.Mesh(new THREE.PlaneGeometry(8, 6), new THREE.MeshStandardMaterial({ color: 0x3a3532, roughness: 1 })); rg.rotation.x = -PI / 2; rg.position.set(4, 0.012, 4); rg.receiveShadow = true; h.scene.add(rg); }
  desk(4, 4, 4.4, 1.4);
  for (let i = 0; i < 3; i++) { officeChair(2.6 + i * 1.4, 2.7, 0); officeChair(2.6 + i * 1.4, 5.3, PI); laptop(2.6 + i * 1.4, 3.7, PI); }
  ob(5, 4, 4, 4.6, 2.6);
  plaque('Comité', 4, 3.0, 0.9, 0, 2.6);
  // descanso y plantas
  sofa(17, 8.5, 3.0, -PI / 2, M.fabric); ob(5, 17.4, 8.5, 1.2, 3.2);
  plant(-18.6, 12.6, 1.2); plant(18.6, 13.2, 1.2); plant(-18.6, -13, 1.1); plant(2, -5.5, 1); plant(-1, 0, 0.9);
  spot(5, [0, 2], [-3, 5.5], [8, 0.5], [12, 6], [-12, 0.2], [-1, -9], [5, -8.2], [15, 4], [-17, 6], [-6, 8]);
  void box; void cyl; void dark; void monitor;
  return { wall };
}
export function buildAIOffice(h) {
  const { M, desk, officeChair, makeScreen, workstation, plant, sofa, plaque, tag, ob, spot, warm } = h;
  warm(-8, 4.6, -4, 40); warm(10, 4.6, 6, 40);
  const meta = makeScreen(11, 4.6, 1536);
  meta.mesh.position.set(0, 3.55, -14.8); tag(meta.mesh, 'director'); drawMetaBoard(meta);
  // alfombras y rótulos de cada departamento
  for (const r of ROOMS) {
    const [x1, x2, z1, z2] = r.rect;
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(x2 - x1, z2 - z1), new THREE.MeshStandardMaterial({ color: r.rug, roughness: 1 }));
    rug.rotation.x = -PI / 2; rug.position.set((x1 + x2) / 2, 0.012, (z1 + z2) / 2); rug.receiveShadow = true; h.scene.add(rug);
    plaque(r.name, r.plaque[0], 3.2, r.plaque[1], 0, 3.4);
  }
  // el director en el centro del fondo y un puesto por cada agente
  workstation(6, 0, -11, 2, 2.6, 'code');
  for (const r of ROOMS) r.ids.forEach((id, i) => workstation(6, r.xs[i % r.xs.length], r.zs[Math.floor(i / r.xs.length)], 2, 2.4, i % 2 ? 'code' : 'chart'));
  void desk; void officeChair;
  sofa(-18, 0, 3.2, PI / 2, M.fabric); ob(6, -18.3, 0, 1.2, 3.4);
  plant(-18.6, -13, 1.2); plant(18.6, -13, 1.2); plant(18.6, 13.4, 1.2); plant(-18.6, 13.4, 1.2); plant(-3, 1, 1); plant(3, 1, 1);
  spot(6, [0, 0], [-3, 6], [3, 6], [0, 4], [-2.4, -6], [2.4, -6], [-4, 12], [4.5, 9.4], [-8, 1.2], [16, 0.8], [0, 10.5]);
}
