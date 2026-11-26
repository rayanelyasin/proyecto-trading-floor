// Campus 3D de Pulso: plaza, caminos, vegetación, estacionamiento y tres edificios con puerta propia.
// Medidas: 120 x 120 m (x y z de -60 a 60). Se camina dentro de ±52 m. Los edificios miran hacia +Z.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildAvatar, animateAvatar, randomAvatar } from './human.js';
import { quality } from './quality.js';
import { BUILDINGS, LAND_SLOTS } from './campus-data.js';

// ---------- modos de control (se comparten con el resto de la app) ----------
export const CONTROL_MODES = {
  teclado: { label: 'Teclado', icon: '⌨', help: 'WASD o flechas para caminar, flechas ← → para girar, Mayús para correr y E para entrar.' },
  mouse: { label: 'Mouse', icon: '🖱', help: 'Haz clic en el suelo o en un edificio para caminar hasta allí. Arrastra para girar la cámara y usa la rueda para acercar.' },
  tactil: { label: 'Táctil', icon: '☝', help: 'Usa el joystick para caminar, arrastra para girar la cámara y toca un edificio para ir a su puerta.' },
};
export function defaultControlMode() {
  const touch = matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints > 0 && innerWidth < 900);
  return touch ? 'tactil' : 'teclado';
}
export function getControlMode() {
  try { const v = localStorage.getItem('pulso:control'); if (CONTROL_MODES[v]) return v; } catch { /* sin almacenamiento */ }
  return defaultControlMode();
}
export function setControlMode(mode) {
  if (!CONTROL_MODES[mode]) return;
  try { localStorage.setItem('pulso:control', mode); } catch { /* ignorar */ }
  dispatchEvent(new CustomEvent('pulso:control', { detail: mode }));
}

const HALF = 52;
const BODY = [
  { id: 'oficina', x: -32, z: -24, w: 20, d: 14, h: 22 },
  { id: 'lab', x: 32, z: -24, w: 22, d: 14, h: 14 },
  { id: 'ai', x: 0, z: -40, w: 24, d: 12, h: 10 },
];
const PLAZA = { x: 0, z: 6, r: 10 };
const LOT = { x: -34, z: 32, w: 28, d: 14 };
const rand = (() => { let s = 20261126; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
const pick = (a) => a[Math.floor(rand() * a.length)];

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}
const grassTex = () => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#5f8f4e'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 2600; i++) { g.fillStyle = `hsl(${95 + rand() * 25},${35 + rand() * 20}%,${30 + rand() * 18}%)`; g.fillRect(rand() * w, rand() * h, 2, 3 + rand() * 3); }
}, [60, 60]);
const stoneTex = (base = '#d8d2c4', line = '#b9b2a2') => canvasTex(128, 128, (g, w, h) => {
  g.fillStyle = base; g.fillRect(0, 0, w, h); g.strokeStyle = line; g.lineWidth = 2;
  for (let y = 0; y < h; y += 32) for (let x = (y / 32) % 2 ? 0 : -32; x < w; x += 64) g.strokeRect(x + 1, y + 1, 62, 30);
}, [8, 8]);
function windowTex(cols, rows, { wall = '#cfc7b8', glass = '#7fa3b8', lit = '#ffd9a0', litRate = 0.35 } = {}) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = wall; g.fillRect(0, 0, w, h);
    const cw = w / cols, ch = h / rows;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      g.fillStyle = rand() < litRate ? lit : glass; g.fillRect(c * cw + cw * 0.14, r * ch + ch * 0.2, cw * 0.72, ch * 0.62);
      g.fillStyle = 'rgba(255,255,255,.28)'; g.fillRect(c * cw + cw * 0.14, r * ch + ch * 0.2, cw * 0.72, ch * 0.1);
    }
  });
}
function signTex(title, sub, fg = '#f5e6c4', bg = '#17140f', w = 512, h = 160) {
  return canvasTex(w, h, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h); g.strokeStyle = fg; g.globalAlpha = 0.6; g.lineWidth = 4; g.strokeRect(8, 8, w - 16, h - 16); g.globalAlpha = 1;
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '600 56px Fraunces, Georgia, serif'; g.fillText(title, w / 2, sub ? h * 0.4 : h / 2, w - 40);
    if (sub) { g.font = '500 26px Inter, sans-serif'; g.globalAlpha = 0.8; g.fillText(sub, w / 2, h * 0.76, w - 40); }
  });
}
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...o });
function box(w, h, d, m, x, y, z, parent) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent?.add(mesh); return mesh;
}

// ---------- personas: los mismos avatares y animaciones que usan los edificios de Pulso ----------
const shadowGeo = new THREE.CircleGeometry(0.42, 24), shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false });
function walker(cfg, isMe = false) {
  const model = buildAvatar(cfg), g = new THREE.Group();
  g.add(model.group);
  const sh = new THREE.Mesh(shadowGeo, shadowMat); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.05; g.add(sh);
  if (isMe) { const ring = new THREE.Mesh(new THREE.RingGeometry(0.46, 0.5, 48), new THREE.MeshBasicMaterial({ color: 0xd9bf8c, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; g.add(ring); }
  g.userData.av = { model, seated: false };
  return g;
}
const animateWalker = (g, speed, dt) => animateAvatar(g.userData.av, speed > 0.05, Math.max(speed, 0.01), dt);
function car(color) {
  const g = new THREE.Group();
  box(1.9, 0.6, 4.2, mat(color, { roughness: 0.35, metalness: 0.4 }), 0, 0.62, 0, g);
  box(1.6, 0.55, 2.1, mat('#bcd4e2', { roughness: 0.15, metalness: 0.5 }), 0, 1.16, -0.15, g);
  for (const [x, z] of [[-0.95, -1.35], [0.95, -1.35], [-0.95, 1.35], [0.95, 1.35]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.28, 14), mat('#15171a')); w.rotation.z = Math.PI / 2; w.position.set(x, 0.36, z); g.add(w); }
  return g;
}

// ---------- API del campus ----------
export function createCampus(container, { me = {}, onEnter, onNear } = {}) {
  const Q = quality();   // misma calidad que los edificios (js/quality.js)
  const renderer = new THREE.WebGLRenderer({ antialias: Q.antialias, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, Q.pixelRatio));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95; renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const SKY = new THREE.Color('#cfe3ee');
  scene.background = SKY; scene.fog = new THREE.Fog(SKY, 90, 280);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 600); // misma lente que la cámara de Pulso
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.3;
  scene.add(new THREE.HemisphereLight(0xdcecff, 0x6b8e5a, 0.8));
  const sun = new THREE.DirectionalLight(0xfff0d2, 2.2);
  sun.position.set(45, 70, 35); sun.castShadow = true; sun.shadow.mapSize.set(Q.shadowMap, Q.shadowMap);
  Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 10, far: 220 }); sun.shadow.bias = -0.0004;
  scene.add(sun);

  // cielo con degradado
  const sky = new THREE.Mesh(new THREE.SphereGeometry(420, 24, 12), new THREE.MeshBasicMaterial({
    side: THREE.BackSide, fog: false,
    map: canvasTex(8, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#6fa6d8'); gr.addColorStop(0.55, '#bfdcf0'); gr.addColorStop(1, '#eaf2ea'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }),
  }));
  scene.add(sky);

  const solids = [], circles = [], targets = [], clickables = [];
  const groundMesh = new THREE.Mesh(new THREE.PlaneGeometry(520, 520), new THREE.MeshStandardMaterial({ map: grassTex(), roughness: 1 }));
  groundMesh.rotation.x = -Math.PI / 2; groundMesh.receiveShadow = true; scene.add(groundMesh);

  // montañas y nubes
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2 + rand() * 0.2, r = 150 + rand() * 60, h = 28 + rand() * 40;
    const m = new THREE.Mesh(new THREE.ConeGeometry(26 + rand() * 24, h, 7), mat(pick(['#6d8a7a', '#5e7d71', '#7f9a8c']), { flatShading: true }));
    m.position.set(Math.cos(a) * r, h / 2 - 2, Math.sin(a) * r); scene.add(m);
    if (h > 50) { const cap = new THREE.Mesh(new THREE.ConeGeometry(9, 12, 7), mat('#f2f5f7', { flatShading: true })); cap.position.set(m.position.x, h - 5, m.position.z); scene.add(cap); }
  }
  const clouds = [];
  for (let i = 0; i < 9; i++) {
    const c = new THREE.Group();
    for (let j = 0; j < 4; j++) { const s = new THREE.Mesh(new THREE.SphereGeometry(5 + rand() * 4, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, fog: false })); s.position.set(j * 6 - 9, rand() * 2, rand() * 4); s.scale.y = 0.55; c.add(s); }
    c.position.set((rand() - 0.5) * 300, 60 + rand() * 25, (rand() - 0.5) * 300); scene.add(c); clouds.push(c);
  }

  // ---------- caminos, plaza y fuente ----------
  const pathMat = new THREE.MeshStandardMaterial({ map: stoneTex(), roughness: 0.95 });
  const door = (id) => { const b = BODY.find((x) => x.id === id); return { x: b.x, z: b.z + b.d / 2 + 2.4 }; };
  function pathBetween(ax, az, bx, bz, w = 4) {
    const len = Math.hypot(bx - ax, bz - az), m = new THREE.Mesh(new THREE.PlaneGeometry(w, len), pathMat);
    m.rotation.set(-Math.PI / 2, 0, 0); const grp = new THREE.Group(); grp.add(m); grp.position.set((ax + bx) / 2, 0.03, (az + bz) / 2); grp.rotation.y = Math.atan2(bx - ax, bz - az); scene.add(grp);
    m.receiveShadow = true; m.material.map.repeat.set(w / 4, len / 4);
  }
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(PLAZA.r, 48), new THREE.MeshStandardMaterial({ map: stoneTex('#e4ddcc', '#c4bba6'), roughness: 0.9 }));
  plaza.rotation.x = -Math.PI / 2; plaza.position.set(PLAZA.x, 0.04, PLAZA.z); plaza.receiveShadow = true; scene.add(plaza);
  const ring = new THREE.Mesh(new THREE.RingGeometry(PLAZA.r - 0.5, PLAZA.r, 48), mat('#d9bf8c')); ring.rotation.x = -Math.PI / 2; ring.position.set(PLAZA.x, 0.05, PLAZA.z); scene.add(ring);
  for (const id of ['oficina', 'lab', 'ai']) { const d = door(id); pathBetween(PLAZA.x, PLAZA.z - 6, d.x, d.z + 0.5, id === 'ai' ? 5 : 4.4); }
  pathBetween(PLAZA.x, PLAZA.z + 8, 0, 54, 5);
  pathBetween(-30, 32, -6, 32, 4); pathBetween(-6, 32, -2, 32, 4);
  // fuente
  const fountain = new THREE.Group(); fountain.position.set(PLAZA.x, 0, PLAZA.z); scene.add(fountain);
  const stone = mat('#cfc7b8');
  const part = (geo, m, y, shadow = false) => { const o = new THREE.Mesh(geo, m); o.position.y = y; o.castShadow = shadow; fountain.add(o); return o; };
  part(new THREE.CylinderGeometry(3.4, 3.6, 0.7, 32), stone, 0.35, true);
  part(new THREE.CylinderGeometry(3, 3, 0.05, 32), mat('#5fb6d4', { roughness: 0.15, metalness: 0.2 }), 0.62);
  part(new THREE.CylinderGeometry(0.35, 0.5, 1.8, 16), stone, 1.3, true);
  part(new THREE.CylinderGeometry(1.3, 0.9, 0.3, 24), stone, 2.0);
  const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.18, 1.4, 10), new THREE.MeshBasicMaterial({ color: 0xbfe9ff, transparent: true, opacity: 0.7 })); jet.position.y = 2.9; fountain.add(jet);
  circles.push({ x: PLAZA.x, z: PLAZA.z, r: 3.9 });
  // bancas y farolas alrededor de la plaza
  const wood = mat('#8a6a43');
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.5, x = PLAZA.x + Math.cos(a) * (PLAZA.r - 1.4), z = PLAZA.z + Math.sin(a) * (PLAZA.r - 1.4);
    const b = new THREE.Group(); b.position.set(x, 0, z); b.rotation.y = -a + Math.PI / 2; scene.add(b);
    box(2, 0.12, 0.6, wood, 0, 0.5, 0, b); box(2, 0.5, 0.1, wood, 0, 0.85, -0.28, b); box(0.1, 0.5, 0.5, mat('#2b2b2b'), -0.85, 0.25, 0, b); box(0.1, 0.5, 0.5, mat('#2b2b2b'), 0.85, 0.25, 0, b);
    circles.push({ x, z, r: 0.9 });
    const lx = PLAZA.x + Math.cos(a + 0.5) * (PLAZA.r + 1.2), lz = PLAZA.z + Math.sin(a + 0.5) * (PLAZA.r + 1.2);
    box(0.14, 4, 0.14, mat('#2a2a2a'), lx, 2, lz, scene); const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffe3a8 })); bulb.position.set(lx, 4.2, lz); scene.add(bulb);
    circles.push({ x: lx, z: lz, r: 0.3 });
  }
  // flores
  const flowerSpots = []; for (let i = 0; i < 90; i++) { const a = rand() * Math.PI * 2, r = PLAZA.r + 2 + rand() * 2.5; flowerSpots.push([PLAZA.x + Math.cos(a) * r, PLAZA.z + Math.sin(a) * r]); }
  const flowers = new THREE.InstancedMesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshStandardMaterial({ roughness: 0.7 }), flowerSpots.length);
  flowerSpots.forEach(([x, z], i) => { flowers.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, 0.25, z)); flowers.setColorAt(i, new THREE.Color(pick(['#f2c14e', '#e86a92', '#f4f1ea', '#9b7ede', '#ff8a5b']))); });
  scene.add(flowers);

  // ---------- edificios ----------
  const entries = {};
  function sign(id, title, sub, fg, bg, y, parent, z) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(8, 2.5), new THREE.MeshBasicMaterial({ map: signTex(title, sub, fg, bg), toneMapped: false }));
    s.position.set(0, y, z); parent.add(s); return s;
  }
  function frontDoor(b, parent, awning) {
    box(3.2, 4, 0.4, mat('#1d1b18'), 0, 2, b.d / 2 + 0.05, parent);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.5), new THREE.MeshBasicMaterial({ color: 0xffd9a0, toneMapped: false })); glow.position.set(0, 1.9, b.d / 2 + 0.27); parent.add(glow);
    box(0.08, 3.6, 0.1, mat('#6b5a3a'), 0, 1.9, b.d / 2 + 0.3, parent);
    box(5.6, 0.25, 2.6, mat(awning), 0, 4.3, b.d / 2 + 1.2, parent);
    for (const x of [-2.6, 2.6]) box(0.18, 4.3, 0.18, mat('#2b2b2b'), x, 2.15, b.d / 2 + 2.3, parent);
  }
  function mark(id, group) {
    group.traverse((o) => { if (o.isMesh) o.userData.targetId = id; });
    clickables.push(group);
  }
  // 1. Oficina Pulso: torre de piedra y vidrio con dorado
  { const b = BODY[0], g = new THREE.Group(); g.position.set(b.x, 0, b.z); scene.add(g);
    const tex = windowTex(5, 11, { wall: '#d6cfc0', glass: '#7e9db3', lit: '#ffd9a0', litRate: 0.3 });
    const faces = [0, 1, 2, 3].map((i) => { const t = tex.clone(); t.needsUpdate = true; t.repeat.set(i % 2 ? 1.6 : 2.2, 1); return new THREE.MeshStandardMaterial({ map: t, roughness: 0.55, metalness: 0.15 }); });
    const body = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), [faces[1], faces[1], mat('#bdb5a4'), mat('#bdb5a4'), faces[0], faces[0]]);
    body.position.y = b.h / 2; body.castShadow = true; body.receiveShadow = true; g.add(body);
    for (let i = 1; i <= 4; i++) box(b.w + 0.4, 0.28, b.d + 0.4, mat('#d9bf8c', { metalness: 0.6, roughness: 0.35 }), 0, i * 5.4, 0, g);
    box(b.w + 1, 0.8, b.d + 1, mat('#2a2722'), 0, b.h + 0.4, 0, g); box(6, 2.4, 4, mat('#9a948a'), -4, b.h + 2, 0, g);
    box(0.2, 6, 0.2, mat('#444'), 6, b.h + 3.6, 0, g);
    frontDoor(b, g, '#c9a461'); sign('oficina', 'Oficina Pulso', 'Piso de trading · 4 plantas', '#f5e6c4', '#17140f', 5.9, g, b.d / 2 + 0.2); mark('oficina', g);
    box(b.w + 3, 0.2, 1.2, mat('#bdb5a4'), 0, 0.1, b.d / 2 + 0.8, g); }
  // 2. Laboratorio: volumen oscuro, banda verde y antena
  { const b = BODY[1], g = new THREE.Group(); g.position.set(b.x, 0, b.z); scene.add(g);
    const tex = windowTex(8, 6, { wall: '#2a2e33', glass: '#3c7e78', lit: '#7ff0d0', litRate: 0.4 });
    tex.repeat.set(1.4, 1);
    const body = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, metalness: 0.25 }));
    body.position.y = b.h / 2; body.castShadow = true; body.receiveShadow = true; g.add(body);
    box(b.w + 0.6, 0.35, b.d + 0.6, mat('#4fd1a1', { emissive: '#1d6e55', emissiveIntensity: 0.5 }), 0, 5, 0, g); box(b.w + 0.6, 0.35, b.d + 0.6, mat('#4fd1a1', { emissive: '#1d6e55', emissiveIntensity: 0.5 }), 0, b.h, 0, g);
    box(8, 3, 6, mat('#3a3f45'), 5, b.h + 1.5, 0, g);
    const dish = new THREE.Mesh(new THREE.SphereGeometry(2.2, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2.4), mat('#e8ecee', { metalness: 0.4, roughness: 0.3, side: THREE.DoubleSide })); dish.rotation.x = Math.PI * 0.82; dish.position.set(-5, b.h + 2.4, 0); g.add(dish);
    box(0.25, 4.5, 0.25, mat('#888'), 7.5, b.h + 5, 0, g);
    frontDoor(b, g, '#2d8a6c'); sign('lab', 'Laboratorio Pulso', 'Minería de estrategias', '#baf5e3', '#0d1f1a', 5.6, g, b.d / 2 + 0.2); mark('lab', g); }
  // 3. Mi oficina IA: loft crema con techo en dientes de sierra y toldo verde
  { const b = BODY[2], g = new THREE.Group(); g.position.set(b.x, 0, b.z); scene.add(g);
    const tex = windowTex(6, 3, { wall: '#efe6d3', glass: '#a9c9b8', lit: '#ffe0a8', litRate: 0.55 }); tex.repeat.set(1.4, 1);
    const body = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75 }));
    body.position.y = b.h / 2; body.castShadow = true; body.receiveShadow = true; g.add(body);
    for (let i = 0; i < 3; i++) { const r = box(b.w / 3 + 0.2, 0.4, b.d + 1, mat('#1e6a55'), -b.w / 3 + i * (b.w / 3), b.h + 0.9, 0, g); r.rotation.z = -0.28; const glass = box(0.12, 1.6, b.d, mat('#a9d8e8', { roughness: 0.2 }), -b.w / 3 + i * (b.w / 3) + b.w / 6 - 0.5, b.h + 1, 0, g); void glass; }
    box(b.w + 1, 0.4, b.d + 1, mat('#8a6a43'), 0, 0.2, 0, g);
    frontDoor(b, g, '#1e6a55'); sign('ai', 'Mi oficina IA', 'Tu equipo de agentes', '#e9f5ee', '#12362c', 7.4, g, b.d / 2 + 0.2); mark('ai', g);
    for (const x of [-6, 6]) { const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.45, 0.9, 12), mat('#b5651d')); pot.position.set(x, 0.45, b.d / 2 + 2.2); g.add(pot); const bush = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 10), mat('#3f7d44')); bush.position.set(x, 1.5, b.d / 2 + 2.2); bush.castShadow = true; g.add(bush); } }
  for (const b of BODY) {
    solids.push({ minX: b.x - b.w / 2 - 0.3, maxX: b.x + b.w / 2 + 0.3, minZ: b.z - b.d / 2 - 0.3, maxZ: b.z + b.d / 2 + 0.3 });
    const d = door(b.id), meta = BUILDINGS.find((x) => x.id === b.id);
    entries[b.id] = { id: b.id, kind: 'building', label: meta.name, detail: meta.detail, x: d.x, z: d.z, r: 3.4, route: meta.route };
    targets.push(entries[b.id]);
  }

  // ---------- estacionamiento y carros ----------
  const lot = new THREE.Mesh(new THREE.PlaneGeometry(LOT.w, LOT.d), mat('#3a3d42', { roughness: 1 })); lot.rotation.x = -Math.PI / 2; lot.position.set(LOT.x, 0.035, LOT.z); lot.receiveShadow = true; scene.add(lot);
  const colors = ['#c0392b', '#2a5fa8', '#e8e6df', '#222428', '#d9a35f', '#2f7d4f', '#8a9bb5', '#7b1e24'];
  for (let row = 0; row < 2; row++) for (let i = 0; i < 6; i++) {
    const x = LOT.x - LOT.w / 2 + 3 + i * 4.4, z = LOT.z + (row ? 3.4 : -3.4);
    box(0.12, 0.02, 4.6, mat('#f2f2f2'), x - 2.2, 0.05, z, scene);
    if (rand() < 0.78) { const c = car(pick(colors)); c.position.set(x, 0, z); c.rotation.y = row ? Math.PI : 0; scene.add(c); solids.push({ minX: x - 1.1, maxX: x + 1.1, minZ: z - 2.3, maxZ: z + 2.3 }); }
  }
  const lotSign = new THREE.Mesh(new THREE.PlaneGeometry(4, 1.2), new THREE.MeshBasicMaterial({ map: signTex('Estacionamiento', '', '#ffffff', '#1c3f6e', 512, 150), toneMapped: false }));
  lotSign.position.set(LOT.x + LOT.w / 2 + 1, 2.6, LOT.z - 7); box(0.12, 2.6, 0.12, mat('#555'), LOT.x + LOT.w / 2 + 1, 1.3, LOT.z - 7, scene); scene.add(lotSign);
  const road = new THREE.Mesh(new THREE.RingGeometry(57, 63, 64), mat('#34373b', { roughness: 1 })); road.rotation.x = -Math.PI / 2; road.position.y = 0.02; road.receiveShadow = true; scene.add(road);
  const traffic = [0, 1, 2].map((i) => { const c = car(pick(colors)); scene.add(c); return { c, a: i * 2.1, v: 0.045 + i * 0.01 }; });

  // ---------- vegetación ----------
  const free = (x, z, pad = 0, avoidSlots = true) => {
    if (avoidSlots && LAND_SLOTS.some((p) => Math.hypot(x - p.x, z - p.z) < 8)) return false;
    if (Math.hypot(x - PLAZA.x, z - PLAZA.z) < PLAZA.r + 4 + pad) return false;
    if (Math.abs(x) < 4 + pad && z > PLAZA.z) return false;
    for (const b of BODY) { if (Math.abs(x - b.x) < b.w / 2 + 4 + pad && z > b.z - b.d / 2 - 3 - pad && z < b.z + b.d / 2 + 9 + pad) return false; }
    if (Math.abs(x - LOT.x) < LOT.w / 2 + 3 + pad && Math.abs(z - LOT.z) < LOT.d / 2 + 3 + pad) return false;
    for (const id of ['oficina', 'lab', 'ai']) { const d = door(id); const ax = PLAZA.x, az = PLAZA.z - 6, bx = d.x, bz = d.z; const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz; const u = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)); if (Math.hypot(x - (ax + u * dx), z - (az + u * dz)) < 4 + pad) return false; }
    return true;
  };
  const treeSpots = [];
  for (let tries = 0; tries < 900 && treeSpots.length < 130; tries++) { const x = (rand() - 0.5) * 112, z = (rand() - 0.5) * 112; if (Math.hypot(x, z) < 56 && free(x, z) && !treeSpots.some(([a, b]) => Math.hypot(a - x, b - z) < 4.2)) treeSpots.push([x, z, 0.8 + rand() * 0.9]); }
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.32, 2.4, 8), mat('#6b4f33'), treeSpots.length);
  const crownA = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.7, 1), new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), treeSpots.length);
  const crownB = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.2, 1), new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), treeSpots.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v3 = new THREE.Vector3(), s3 = new THREE.Vector3();
  treeSpots.forEach(([x, z, s], i) => {
    const place = (mesh, y, k) => { m4.compose(v3.set(x, y * s, z), q.identity(), s3.set(s * k, s * k, s * k)); mesh.setMatrixAt(i, m4); };
    place(trunks, 1.2, 1); place(crownA, 3.6, 1); place(crownB, 5.1, 1);
    const col = new THREE.Color().setHSL(0.27 + rand() * 0.07, 0.45, 0.28 + rand() * 0.12); crownA.setColorAt(i, col); crownB.setColorAt(i, col.clone().offsetHSL(0, 0, 0.05));
    circles.push({ x, z, r: 0.45 });
  });
  for (const m of [trunks, crownA, crownB]) { m.castShadow = true; scene.add(m); }
  // arbustos y rocas
  const bushSpots = []; for (let tries = 0; tries < 400 && bushSpots.length < 80; tries++) { const x = (rand() - 0.5) * 108, z = (rand() - 0.5) * 108; if (Math.hypot(x, z) < 55 && free(x, z)) bushSpots.push([x, z, 0.5 + rand() * 0.6]); }
  const bushes = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), bushSpots.length);
  bushSpots.forEach(([x, z, s], i) => { m4.compose(v3.set(x, s * 0.6, z), q.identity(), s3.set(s * 1.4, s, s * 1.4)); bushes.setMatrixAt(i, m4); bushes.setColorAt(i, new THREE.Color().setHSL(0.3 + rand() * 0.06, 0.4, 0.25 + rand() * 0.1)); });
  scene.add(bushes);
  // estanque con puente
  const pond = new THREE.Mesh(new THREE.CircleGeometry(7, 28), mat('#5aa9c4', { roughness: 0.1, metalness: 0.3 })); pond.rotation.x = -Math.PI / 2; pond.scale.set(1.3, 1, 0.8); pond.position.set(36, 0.05, 30); scene.add(pond);
  circles.push({ x: 36, z: 30, r: 6.5 }); circles.push({ x: 42, z: 30, r: 3.5 }); circles.push({ x: 30, z: 30, r: 3.5 });
  // puerta del campus
  const gate = new THREE.Group(); gate.position.set(0, 0, 54); scene.add(gate);
  box(1.2, 6, 1.2, mat('#cfc7b8'), -5, 3, 0, gate); box(1.2, 6, 1.2, mat('#cfc7b8'), 5, 3, 0, gate); box(11.4, 0.9, 1.2, mat('#d9bf8c', { metalness: 0.5, roughness: 0.4 }), 0, 6.2, 0, gate);
  const gs = new THREE.Mesh(new THREE.PlaneGeometry(7, 0.8), new THREE.MeshBasicMaterial({ map: signTex('Campus Pulso', '', '#1a150c', '#d9bf8c', 512, 80), toneMapped: false })); gs.position.set(0, 6.2, -0.65); gs.rotation.y = Math.PI; gate.add(gs);
  solids.push({ minX: -5.9, maxX: -4.1, minZ: 53.2, maxZ: 54.8 }, { minX: 4.1, maxX: 5.9, minZ: 53.2, maxZ: 54.8 });

  // ---------- lugares del dueño y terrenos ----------
  const placeGroup = new THREE.Group(); scene.add(placeGroup);
  let placeSolids = [];
  function setPlaces(list) {
    placeGroup.clear();
    for (const t of targets.filter((x) => x.kind === 'place')) targets.splice(targets.indexOf(t), 1);
    for (const idx of [...clickables.keys()].reverse()) if (clickables[idx].userData.isPlace) clickables.splice(idx, 1);
    solids.splice(solids.length - placeSolids.length, placeSolids.length); placeSolids = [];
    for (const p of list) {
      const g = new THREE.Group(); g.position.set(p.x, 0, p.z); g.userData.isPlace = true; placeGroup.add(g);
      const col = new THREE.Color(p.color);
      box(5, 0.2, 5, mat('#cfc7b8'), 0, 0.1, 0, g); box(3.4, 3, 3.4, mat('#efe9dd'), 0, 1.7, 0, g); box(4, 0.35, 4, mat(p.color), 0, 3.35, 0, g);
      box(1.1, 2, 0.1, mat('#1d1b18'), 0, 1.2, 1.72, g);
      const s = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.06), new THREE.MeshBasicMaterial({ map: signTex(p.name.slice(0, 22), p.description.slice(0, 40), '#f5e6c4', '#17140f', 512, 160), toneMapped: false })); s.position.set(0, 2.7, 1.73); g.add(s);
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), new THREE.MeshBasicMaterial({ color: col })); beacon.position.set(0, 4.1, 0); g.add(beacon);
      g.traverse((o) => { if (o.isMesh) o.userData.targetId = p.id; }); clickables.push(g);
      const sol = { minX: p.x - 1.9, maxX: p.x + 1.9, minZ: p.z - 1.9, maxZ: p.z + 1.9 }; solids.push(sol); placeSolids.push(sol);
      targets.push({ id: p.id, kind: 'place', label: p.name, detail: p.description, x: p.x, z: p.z + 3.8, r: 3.2, place: p });
    }
    for (const slot of LAND_SLOTS) {
      if (list.some((p) => Math.hypot(p.x - slot.x, p.z - slot.z) < 6)) continue;
      const pad = box(9, 0.12, 9, mat('#b7ad98'), slot.x, 0.06, slot.z, placeGroup);
      pad.receiveShadow = true; pad.castShadow = false;
      const post = box(0.12, 2.2, 0.12, mat('#5a4630'), slot.x + 4, 1.1, slot.z + 4.2, placeGroup);
      const board = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.9), new THREE.MeshBasicMaterial({ map: signTex('Terreno libre', 'Próximo proyecto', '#3a2d1a', '#e6c97a', 512, 190), toneMapped: false })); board.position.set(slot.x + 4, 2.3, slot.z + 4.27); placeGroup.add(board); void post;
    }
  }

  // ---------- jugador, visitantes y marcador ----------
  const player = walker(me.avatar || randomAvatar('visitante'), true);
  player.position.set(0, 0, 42); player.rotation.y = Math.PI; scene.add(player);
  const npcs = Array.from({ length: 9 }, (_, i) => {
    const p = walker(randomAvatar('visitante-' + i));
    const a = rand() * Math.PI * 2, r = 6 + rand() * 30; p.position.set(Math.cos(a) * r * 0.9, 0, 8 + Math.sin(a) * r * 0.6); scene.add(p);
    return { p, tx: p.position.x, tz: p.position.z, wait: rand() * 3, i };
  });
  const marker = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.75, 24), new THREE.MeshBasicMaterial({ color: 0xd9bf8c, transparent: true, opacity: 0.9, side: THREE.DoubleSide })); marker.rotation.x = -Math.PI / 2; marker.visible = false; scene.add(marker);

  // ---------- control y bucle ----------
  const st = { yaw: 0, pitch: 0.785, dist: 15, mode: getControlMode(), keys: new Set(), joy: { x: 0, y: 0 }, target: null, autoEnter: null, paused: false, near: null, speed: 0, picking: null, time: 0 };
  const canvas = renderer.domElement;

  function hits(x, z, r) {
    for (const b of solids) if (x > b.minX - r && x < b.maxX + r && z > b.minZ - r && z < b.maxZ + r) return true;
    for (const c of circles) if (Math.hypot(x - c.x, z - c.z) < c.r + r) return true;
    return false;
  }
  function resolve(pos, r) {
    for (const b of solids) {
      if (pos.x > b.minX - r && pos.x < b.maxX + r && pos.z > b.minZ - r && pos.z < b.maxZ + r) {
        const dl = pos.x - (b.minX - r), dr = b.maxX + r - pos.x, dt = pos.z - (b.minZ - r), db = b.maxZ + r - pos.z, m = Math.min(dl, dr, dt, db);
        if (m === dl) pos.x = b.minX - r; else if (m === dr) pos.x = b.maxX + r; else if (m === dt) pos.z = b.minZ - r; else pos.z = b.maxZ + r;
      }
    }
    for (const c of circles) { const d = Math.hypot(pos.x - c.x, pos.z - c.z), min = c.r + r; if (d < min && d > 0.001) { pos.x = c.x + ((pos.x - c.x) / d) * min; pos.z = c.z + ((pos.z - c.z) / d) * min; } }
    pos.x = Math.max(-HALF, Math.min(HALF, pos.x)); pos.z = Math.max(-HALF, Math.min(HALF, pos.z));
  }
  const typing = () => /^(input|textarea|select)$/i.test(document.activeElement?.tagName || '');
  const onKeyDown = (e) => {
    if (typing() || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift'].includes(k)) { st.keys.add(k); st.target = null; marker.visible = false; if (k.startsWith('arrow')) e.preventDefault(); }
    if (k === 'e' || k === 'enter') interact();
  };
  const onKeyUp = (e) => st.keys.delete(e.key.toLowerCase());
  addEventListener('keydown', onKeyDown); addEventListener('keyup', onKeyUp); addEventListener('blur', () => st.keys.clear());

  // arrastrar para girar la cámara; toque corto = clic
  const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const drag = new Map(); let pinch = null;
  canvas.addEventListener('pointerdown', (e) => { try { canvas.setPointerCapture(e.pointerId); } catch { /* sin captura */ } drag.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() }); if (drag.size === 2) pinch = null; });
  canvas.addEventListener('pointermove', (e) => {
    const d = drag.get(e.pointerId); if (!d) return;
    if (drag.size === 2) { const [a, b] = [...drag.values()]; const dist = Math.hypot(a.x - b.x, a.y - b.y); if (pinch) st.dist = Math.max(7, Math.min(34, st.dist * (pinch / dist))); pinch = dist; d.x = e.clientX; d.y = e.clientY; return; }
    st.yaw -= (e.clientX - d.x) * 0.006; st.pitch = Math.max(0.35, Math.min(1.25, st.pitch + (e.clientY - d.y) * 0.004)); d.x = e.clientX; d.y = e.clientY;
  });
  const endDrag = (e) => {
    const d = drag.get(e.pointerId); drag.delete(e.pointerId); pinch = null; if (!d || e.type === 'pointercancel') return;
    if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 8 && performance.now() - d.t < 450) click(e.clientX, e.clientY);
  };
  canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); st.dist = Math.max(7, Math.min(34, st.dist + e.deltaY * 0.01)); }, { passive: false });

  function click(cx, cy) {
    const r = canvas.getBoundingClientRect(); ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1); raycaster.setFromCamera(ndc, camera);
    const pt = raycaster.intersectObject(groundMesh)[0]?.point;
    if (st.picking) { if (pt) { const cb = st.picking; st.picking = null; cb(Math.max(-HALF + 4, Math.min(HALF - 4, pt.x)), Math.max(-HALF + 4, Math.min(HALF - 4, pt.z))); } return; }
    if (st.mode === 'teclado') return;
    const hit = raycaster.intersectObjects(clickables, true)[0];
    const t = hit && targets.find((x) => x.id === hit.object.userData.targetId);
    if (t) { walkTo(t.x, t.z, t); return; }
    if (st.mode === 'mouse' && pt) walkTo(pt.x, pt.z);
  }
  function walkTo(x, z, target = null) {
    st.target = { x, z }; st.autoEnter = target; marker.position.set(x, 0.08, z); marker.visible = true;
  }
  function interact() { if (st.near) onEnter?.(st.near); }

  // joystick táctil
  const joy = document.createElement('div'); joy.className = 'cmp-joy'; joy.innerHTML = '<i></i>'; joy.hidden = true; container.appendChild(joy);
  const knob = joy.firstChild; let joyId = null;
  const moveJoy = (e) => { const r = joy.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2; let dx = (e.clientX - cx) / (r.width / 2), dy = (e.clientY - cy) / (r.height / 2); const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } st.joy.x = dx; st.joy.y = -dy; knob.style.transform = `translate(${dx * 38}px,${dy * 38}px)`; st.target = null; marker.visible = false; };
  joy.addEventListener('pointerdown', (e) => { joyId = e.pointerId; try { joy.setPointerCapture(e.pointerId); } catch { /* sin captura */ } moveJoy(e); });
  joy.addEventListener('pointermove', (e) => { if (e.pointerId === joyId) moveJoy(e); });
  const joyEnd = (e) => { if (e.pointerId !== joyId) return; joyId = null; st.joy.x = st.joy.y = 0; knob.style.transform = ''; };
  joy.addEventListener('pointerup', joyEnd); joy.addEventListener('pointercancel', joyEnd);

  function setMode(m) { st.mode = m; joy.hidden = m !== 'tactil'; st.joy.x = st.joy.y = 0; if (m === 'teclado') { st.target = null; marker.visible = false; } }
  setMode(st.mode);
  const onMode = (e) => setMode(e.detail); addEventListener('pulso:control', onMode);

  function resize() { const w = container.clientWidth || innerWidth, h = container.clientHeight || innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  const ro = new ResizeObserver(resize); ro.observe(container); resize();

  // minimapa
  let mapCtx = null, mapEl = null;
  function bindMinimap(el) {
    mapEl = el; mapCtx = el.getContext('2d');
    el.addEventListener('click', (e) => {
      const r = el.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width - 0.5) * 120, z = ((e.clientY - r.top) / r.height - 0.5) * 120;
      if (st.picking) { const cb = st.picking; st.picking = null; cb(Math.max(-HALF + 4, Math.min(HALF - 4, x)), Math.max(-HALF + 4, Math.min(HALF - 4, z))); return; }
      const t = targets.find((tt) => Math.hypot(tt.x - x, tt.z - z) < 8);
      if (t) walkTo(t.x, t.z, t); else walkTo(Math.max(-HALF, Math.min(HALF, x)), Math.max(-HALF, Math.min(HALF, z)));
    });
  }
  let mapT = 0;
  function drawMap() {
    if (!mapCtx) return; const g = mapCtx, W = mapEl.width, H = mapEl.height, X = (x) => (x / 120 + 0.5) * W, Z = (z) => (z / 120 + 0.5) * H;
    g.fillStyle = '#4c7a43'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#d8d2c4'; g.beginPath(); g.arc(X(PLAZA.x), Z(PLAZA.z), (PLAZA.r / 120) * W, 0, 7); g.fill();
    g.strokeStyle = '#d8d2c4'; g.lineWidth = 3; for (const id of ['oficina', 'lab', 'ai']) { const d = door(id); g.beginPath(); g.moveTo(X(PLAZA.x), Z(PLAZA.z)); g.lineTo(X(d.x), Z(d.z)); g.stroke(); }
    g.beginPath(); g.moveTo(X(0), Z(PLAZA.z)); g.lineTo(X(0), Z(54)); g.stroke();
    g.fillStyle = '#3a3d42'; g.fillRect(X(LOT.x - LOT.w / 2), Z(LOT.z - LOT.d / 2), (LOT.w / 120) * W, (LOT.d / 120) * H);
    const cols = { oficina: '#d9bf8c', lab: '#4fd1a1', ai: '#3a9f7f' };
    for (const b of BODY) { g.fillStyle = cols[b.id]; g.fillRect(X(b.x - b.w / 2), Z(b.z - b.d / 2), (b.w / 120) * W, (b.d / 120) * H); }
    for (const t of targets) if (t.kind === 'place') { g.fillStyle = t.place.color; g.beginPath(); g.arc(X(t.place.x), Z(t.place.z), 4, 0, 7); g.fill(); }
    g.save(); g.translate(X(player.position.x), Z(player.position.z)); g.rotate(-player.rotation.y + Math.PI); g.fillStyle = '#fff'; g.strokeStyle = '#111'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 5); g.lineTo(-5, 5); g.closePath(); g.fill(); g.stroke(); g.restore();
    if (st.target) { g.strokeStyle = '#d9bf8c'; g.beginPath(); g.arc(X(st.target.x), Z(st.target.z), 5, 0, 7); g.stroke(); }
  }

  let raf = 0, last = performance.now();
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now; if (st.paused) return;
    st.time += dt;
    // cámara con flechas
    if (st.keys.has('arrowleft')) st.yaw += dt * 1.8; if (st.keys.has('arrowright')) st.yaw -= dt * 1.8;
    const fwd = new THREE.Vector2(-Math.sin(st.yaw), -Math.cos(st.yaw)), right = new THREE.Vector2(-fwd.y, fwd.x);
    let mx = 0, mz = 0;
    const f = (st.keys.has('w') || st.keys.has('arrowup') ? 1 : 0) - (st.keys.has('s') || st.keys.has('arrowdown') ? 1 : 0) + st.joy.y;
    const s = (st.keys.has('d') ? 1 : 0) - (st.keys.has('a') ? 1 : 0) + st.joy.x;
    if (Math.abs(f) > 0.05 || Math.abs(s) > 0.05) { mx = fwd.x * f + right.x * s; mz = fwd.y * f + right.y * s; }
    else if (st.target) {
      const dx = st.target.x - player.position.x, dz = st.target.z - player.position.z, d = Math.hypot(dx, dz);
      if (d < 0.5) { const t = st.autoEnter; st.target = null; st.autoEnter = null; marker.visible = false; if (t) { st.near = t; onEnter?.(t); } } else { mx = dx / d; mz = dz / d; }
    }
    const len = Math.hypot(mx, mz);
    let moved = 0;
    if (len > 0.01) {
      const run = st.keys.has('shift') ? 1.7 : 1, sp = 5.2 * run * Math.min(1, len);
      const nx = player.position.x + (mx / len) * sp * dt, nz = player.position.z + (mz / len) * sp * dt;
      const before = player.position.clone(); player.position.x = nx; player.position.z = nz; resolve(player.position, 0.55);
      moved = player.position.distanceTo(before) / dt;
      if (st.target && moved < sp * 0.25) { st.stuck = (st.stuck || 0) + dt; if (st.stuck > 0.6) { st.target = null; st.autoEnter = null; marker.visible = false; st.stuck = 0; } } else st.stuck = 0;
      const ang = Math.atan2(mx, mz); let da = ang - player.rotation.y; da = Math.atan2(Math.sin(da), Math.cos(da)); player.rotation.y += da * Math.min(1, dt * 12);
    }
    animateWalker(player, moved, dt);
    // visitantes
    for (const n of npcs) {
      const dx = n.tx - n.p.position.x, dz = n.tz - n.p.position.z, d = Math.hypot(dx, dz);
      if (d < 0.6) { n.wait -= dt; animateWalker(n.p, 0, dt); if (n.wait < 0) { for (let k = 0; k < 8; k++) { const a = rand() * Math.PI * 2, r = 4 + rand() * 40, x = Math.cos(a) * r, z = 6 + Math.sin(a) * r * 0.9; if (Math.abs(x) < 50 && Math.abs(z) < 50 && !hits(x, z, 1)) { n.tx = x; n.tz = z; break; } } n.wait = 2 + rand() * 6; } }
      else { n.p.position.x += (dx / d) * 1.3 * dt; n.p.position.z += (dz / d) * 1.3 * dt; resolve(n.p.position, 0.5); n.p.rotation.y = Math.atan2(dx, dz); animateWalker(n.p, 1.3, dt); }
    }
    for (const t of traffic) { t.a += t.v * dt * 3; t.c.position.set(Math.cos(t.a) * 60, 0, Math.sin(t.a) * 60); t.c.rotation.y = -t.a; }
    clouds.forEach((c, i) => { c.position.x += dt * (1 + i * 0.1); if (c.position.x > 200) c.position.x = -200; });
    jet.scale.y = 1 + Math.sin(st.time * 5) * 0.12; marker.scale.setScalar(1 + Math.sin(st.time * 6) * 0.12);
    // cámara de seguimiento
    const cp = Math.cos(st.pitch) * st.dist;
    const want = new THREE.Vector3(player.position.x + Math.sin(st.yaw) * cp, player.position.y + 1.6 + Math.sin(st.pitch) * st.dist, player.position.z + Math.cos(st.yaw) * cp);
    // la cámara se acerca si un árbol o un edificio queda entre ella y el personaje
    let frac = 1;
    for (let k = 1; k <= 12; k++) { const t = k / 12, px = player.position.x + (want.x - player.position.x) * t, pz = player.position.z + (want.z - player.position.z) * t; if (hits(px, pz, 0.7)) { frac = Math.max(0.28, (k - 1.5) / 12); break; } }
    want.set(player.position.x + (want.x - player.position.x) * frac, want.y - (1 - frac) * 0.6 * (want.y - 2), player.position.z + (want.z - player.position.z) * frac);
    camera.position.lerp(want, Math.min(1, dt * 8));
    camera.lookAt(player.position.x - Math.sin(st.yaw) * 3, 1.2, player.position.z - Math.cos(st.yaw) * 3);
    // cercanía a puertas y lugares
    let near = null, bd = 1e9;
    for (const t of targets) { const d = Math.hypot(player.position.x - t.x, player.position.z - t.z); if (d < t.r && d < bd) { near = t; bd = d; } }
    if (near !== st.near) { st.near = near; onNear?.(near); }
    mapT += dt; if (mapT > 0.1) { mapT = 0; drawMap(); }
    renderer.render(scene, camera);
  }
  camera.position.set(Math.sin(st.yaw) * 12.5, 12.5, 42 + 12.5);
  raf = requestAnimationFrame(frame);

  return {
    zoomBy(delta) { st.dist = Math.max(7, Math.min(34, st.dist * (1 + delta))); },
    setPlaces, setMode, bindMinimap, interact, targets: () => targets, entries, getMode: () => st.mode,
    setPaused(v) { st.paused = v; last = performance.now(); },
    goTo(id) { const t = targets.find((x) => x.id === id); if (t) walkTo(t.x, t.z, null); },
    teleport(id) { const t = targets.find((x) => x.id === id); if (t) { player.position.set(t.x, 0, t.z + 1); st.target = null; marker.visible = false; } },
    playerPos: () => ({ x: player.position.x, z: player.position.z, yaw: player.rotation.y }),
    canPlace(x, z) { return Math.abs(x) <= HALF - 3 && Math.abs(z) <= HALF - 3 && free(x, z, -2, false) && !hits(x, z, 3.2) && !targets.some((t) => t.kind === 'place' && Math.hypot(t.place.x - x, t.place.z - z) < 7); },
    pick(cb) { st.picking = cb; return () => { if (st.picking === cb) st.picking = null; }; },
    showMarker(x, z) { marker.position.set(x, 0.08, z); marker.visible = x != null; },
    dispose() {
      cancelAnimationFrame(raf); ro.disconnect(); removeEventListener('keydown', onKeyDown); removeEventListener('keyup', onKeyUp); removeEventListener('pulso:control', onMode);
      renderer.dispose(); canvas.remove(); joy.remove();
    },
  };
}
