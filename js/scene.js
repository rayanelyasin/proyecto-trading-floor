// Sala de trading en 3D: ambiente realista y sobrio, personajes animados y pantallas con datos en vivo.
import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildAvatar, randomAvatar, animateAvatar } from './human.js';

const W = 40, D = 30;
const BX = W / 2 - 0.7, BZ = D / 2 - 0.7;
const GOLD = '#d9bf8c', UP = '#4fd1a1', DOWN = '#f06272', INK = '#111214';

const KIOSK_Z = [-5, -1.5, 2, 5.5];
export const FLOORS = [{ n: 1, name: 'Clases' }, { n: 2, name: 'Análisis' }, { n: 3, name: 'Conferencias' }, { n: 4, name: 'Juegos' }];
const ZONES_BY = {
  1: [
    { id: 'aula', label: 'Aula', panel: 'salas', x: -10, z: -8, r: 4.8 },
    { id: 'videoteca', label: 'Videoteca', panel: 'videoteca', x: -17, z: -1, r: 2.6 },
    ...KIOSK_Z.map((z, i) => ({ id: `kiosk-${i}`, label: 'Curso', panel: 'cursos', arg: i, x: 16.6, z, r: 1.6 })),
  ],
  2: [
    { id: 'mercado', label: 'Muro de mercado', panel: 'analisis', x: 8, z: -8.8, r: 4.2 },
    { id: 'agentes', label: 'Mesa de análisis', panel: 'agentes', x: -10, z: 8, r: 4.4 },
    { id: 'alertas', label: 'Panel de alertas', panel: 'alertas', x: 8, z: 13.4, r: 1.9 },
  ],
  3: [{ id: 'tarima', label: 'Tarima', panel: 'conferencia', x: 0, z: -12.2, r: 3.4 }],
  4: [
    { id: 'arcade', label: 'Arcade', panel: 'juegos', arg: 0, x: -9.3, z: -12.4, r: 4.4 },
    { id: 'pingpong', label: 'Ping-pong', panel: 'juegos', arg: 1, x: 6, z: 3, r: 3.4 },
  ],
};

export function createWorld(container, opts) {
  const { me: meInfo, members, agents, minimap } = opts;

  // ---------- render ----------
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  container.appendChild(renderer.domElement);

  const labels = new CSS2DRenderer();
  labels.domElement.className = 'labels';
  container.appendChild(labels.domElement);

  const rscene = new THREE.Scene();
  let sink = rscene, bf = 0, fl = 1;
  const scene = { add: (...a) => sink.add(...a) };
  const FL = {}, IA = { 1: [], 2: [], 3: [], 4: [] };
  for (const n of [1, 2, 3, 4]) { FL[n] = new THREE.Group(); FL[n].visible = n === 1; rscene.add(FL[n]); }
  const useFloor = (n) => { sink = n ? FL[n] : rscene; bf = n; };
  rscene.background = new THREE.Color(0x141312);
  rscene.fog = new THREE.Fog(0x141312, 40, 85);
  const pmrem = new THREE.PMREMGenerator(renderer);
  rscene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
  let zoom = 1;
  const camOffset = new THREE.Vector3(0, 12.5, 12.5);

  // ---------- luz ----------
  scene.add(new THREE.HemisphereLight(0xfff1e0, 0x2a2420, 0.35));
  const sun = new THREE.DirectionalLight(0xffe2bf, 2.4);
  sun.position.set(-22, 24, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 20, bottom: -20, near: 1, far: 80 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 4;
  scene.add(sun);
  const warm = (x, y, z, i = 60) => { const l = new THREE.PointLight(0xffd9a8, i, 0, 2); l.position.set(x, y, z); scene.add(l); return l; };
  warm(-10, 5, -8); warm(8, 5, -8); warm(2, 4.5, 3, 45); warm(-10, 4.5, 8, 45); warm(16, 4, 0, 35);

  // ---------- texturas ----------
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const tex = (canvas, rx = 1, ry = 1) => {
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso;
    return t;
  };
  const woodFloor = tex(woodCanvas('#6e5236', 16, false, 12), W / 5, D / 5);
  const walnut = tex(woodCanvas('#4a3122', 6, true), 1, 1);
  const slats = tex(slatCanvas('#3e2a1d'), 4, 1);
  const plaster = tex(noiseCanvas('#2e2b28', 10), 4, 2);

  // ---------- materiales ----------
  const M = {
    floor: new THREE.MeshStandardMaterial({ map: woodFloor, roughness: 0.42, metalness: 0, envMapIntensity: 0.6 }),
    wall: new THREE.MeshStandardMaterial({ map: plaster, roughness: 0.95 }),
    walnut: new THREE.MeshStandardMaterial({ map: walnut, roughness: 0.45, envMapIntensity: 0.8 }),
    slats: new THREE.MeshStandardMaterial({ map: slats, roughness: 0.6 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xc9a96e, metalness: 1, roughness: 0.28 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x1b1b1d, metalness: 0.85, roughness: 0.35 }),
    fabric: new THREE.MeshStandardMaterial({ color: 0x3b414c, roughness: 0.95 }),
    linen: new THREE.MeshStandardMaterial({ color: 0xcfc5b4, roughness: 0.95 }),
    leather: new THREE.MeshStandardMaterial({ color: 0x6e4228, roughness: 0.5, envMapIntensity: 0.7 }),
    stone: new THREE.MeshStandardMaterial({ color: 0x8c877f, roughness: 0.8 }),
    carpet: new THREE.MeshStandardMaterial({ map: tex(noiseCanvas('#3b3633', 14), 8, 6), roughness: 1 }),
    leaf: new THREE.MeshStandardMaterial({ color: 0x35603e, roughness: 0.75, flatShading: true }),
    leaf2: new THREE.MeshStandardMaterial({ color: 0x4b7a4a, roughness: 0.75, flatShading: true }),
    shade: new THREE.MeshStandardMaterial({ color: 0xf3e6cf, emissive: 0xffd9a0, emissiveIntensity: 0.6, roughness: 0.9 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xbfd4e0, transparent: true, opacity: 0.12, roughness: 0.05, metalness: 0.1 }),
  };

  const add = (m, cast = true) => { m.castShadow = cast; m.receiveShadow = true; scene.add(m); return m; };
  const box = (w, h, d, mat, x, y, z, r = 0.03, parent = scene) => {
    const g = r ? new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2.01, h / 2.01, d / 2.01)) : new THREE.BoxGeometry(w, h, d);
    const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  };
  const cyl = (rt, rb, h, mat, x, y, z, seg = 24, parent = scene) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  };

  // ---------- suelo, muros y ventanales ----------
  const floor = add(new THREE.Mesh(new THREE.PlaneGeometry(W, D), M.floor), false);
  floor.rotation.x = -Math.PI / 2;

  box(W + 0.6, 6.5, 0.3, M.wall, 0, 3.25, -D / 2 - 0.15, 0);                    // fondo
  box(0.3, 6.5, D + 0.6, M.wall, -W / 2 - 0.15, 3.25, 0, 0);                    // izquierda
  box(W, 0.12, 0.06, M.walnut, 0, 0.06, -D / 2 + 0.03, 0);                      // zócalos
  box(0.06, 0.12, D, M.walnut, -W / 2 + 0.03, 0.06, 0, 0);
  box(W + 0.6, 1.0, 0.25, M.walnut, 0, 0.5, D / 2 + 0.12, 0.02);                // murete frontal
  box(W + 0.6, 0.04, 0.3, M.brass, 0, 1.02, D / 2 + 0.12, 0);
  box(0.25, 1.0, D, M.walnut, W / 2 + 0.12, 0.5, 0, 0.02);                      // murete derecho
  box(0.3, 0.04, D, M.brass, W / 2 + 0.12, 1.02, 0, 0);
  // paneles de listones detrás de las pantallas
  const slatPanel = new THREE.Mesh(new THREE.PlaneGeometry(W - 1, 6.2), M.slats);
  slatPanel.position.set(0, 3.15, -D / 2 + 0.02); slatPanel.receiveShadow = true; scene.add(slatPanel);

  // ventanal con vista nocturna de la ciudad
  const city = new THREE.Mesh(new THREE.PlaneGeometry(10, 5), new THREE.MeshBasicMaterial({ map: tex(cityCanvas()), toneMapped: false }));
  city.position.set(-W / 2 + 0.02, 2.85, 8.5); city.rotation.y = Math.PI / 2; scene.add(city);
  for (let i = 0; i <= 5; i++) box(0.08, 5.1, 0.08, M.metal, -W / 2 + 0.06, 2.85, 3.5 + i * 2, 0);
  box(0.1, 0.08, 10.1, M.metal, -W / 2 + 0.06, 0.33, 8.5, 0);
  box(0.1, 0.08, 10.1, M.metal, -W / 2 + 0.06, 5.37, 8.5, 0);

  // ---------- pantallas ----------

  function makeScreen(w, h, px = 1024, { bezel = true, depth = 0.06 } = {}) {
    const canvas = document.createElement('canvas');
    canvas.width = px; canvas.height = Math.round(px * (h / w));
    const ctx = canvas.getContext('2d');
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = maxAniso;
    const mat = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    if (bezel) {
      const frame = new THREE.Mesh(new RoundedBoxGeometry(w + 0.08, h + 0.08, depth, 2, 0.02), M.metal);
      frame.position.z = -depth / 2 - 0.005; frame.castShadow = true; mesh.add(frame);
    }
    scene.add(mesh);
    return { mesh, canvas, ctx, texture, mat };
  }
  const tag = (mesh, zoneId) => { mesh.userData.zoneId = zoneId; IA[bf].push(mesh); };

  // ---------- muebles ----------
  const chairGeo = { seat: new RoundedBoxGeometry(0.52, 0.09, 0.5, 2, 0.04), back: new RoundedBoxGeometry(0.52, 0.5, 0.07, 2, 0.03), leg: new THREE.CylinderGeometry(0.015, 0.015, 0.44, 8) };
  function chair(x, z, rot, mat = M.fabric) {
    const g = new THREE.Group();
    const s = new THREE.Mesh(chairGeo.seat, mat); s.position.y = 0.46;
    const b = new THREE.Mesh(chairGeo.back, mat); b.position.set(0, 0.76, -0.22); b.rotation.x = -0.08;
    [s, b].forEach((m) => { m.castShadow = true; m.receiveShadow = true; g.add(m); });
    for (const [lx, lz] of [[-0.22, -0.2], [0.22, -0.2], [-0.22, 0.2], [0.22, 0.2]]) { const l = new THREE.Mesh(chairGeo.leg, M.metal); l.position.set(lx, 0.22, lz); g.add(l); }
    g.position.set(x, 0, z); g.rotation.y = rot; scene.add(g); return g;
  }
  function officeChair(x, z, rot) {
    const g = new THREE.Group();
    cyl(0.3, 0.3, 0.04, M.metal, 0, 0.06, 0, 5, g);
    cyl(0.03, 0.03, 0.38, M.metal, 0, 0.27, 0, 8, g);
    box(0.56, 0.1, 0.54, M.leather, 0, 0.5, 0, 0.04, g);
    const b = box(0.52, 0.62, 0.08, M.leather, 0, 0.9, -0.25, 0.04, g); b.rotation.x = -0.1;
    g.position.set(x, 0, z); g.rotation.y = rot; scene.add(g); return g;
  }
  function desk(x, z, w, d, rot = 0) {
    const g = new THREE.Group();
    box(w, 0.05, d, M.walnut, 0, 0.74, 0, 0.015, g);
    box(0.05, 0.72, d - 0.1, M.metal, -w / 2 + 0.1, 0.36, 0, 0, g);
    box(0.05, 0.72, d - 0.1, M.metal, w / 2 - 0.1, 0.36, 0, 0, g);
    g.position.set(x, 0, z); g.rotation.y = rot; scene.add(g); return g;
  }
  function monitor(x, z, w = 0.9, h = 0.52, px = 512) {
    cyl(0.02, 0.02, 0.28, M.metal, x, 0.9, z - 0.08, 8);
    box(0.24, 0.015, 0.16, M.metal, x, 0.775, z - 0.08, 0);
    const s = makeScreen(w, h, px, { depth: 0.035 });
    s.mesh.position.set(x, 1.04 + h / 2 - 0.1, z - 0.05);
    return s;
  }
  function sofa(x, z, w, rot, mat = M.linen) {
    const g = new THREE.Group();
    box(w, 0.36, 0.9, mat, 0, 0.26, 0, 0.08, g);
    box(w, 0.5, 0.22, mat, 0, 0.62, -0.34, 0.08, g);
    box(0.2, 0.5, 0.9, mat, -w / 2 + 0.1, 0.4, 0, 0.08, g);
    box(0.2, 0.5, 0.9, mat, w / 2 - 0.1, 0.4, 0, 0.08, g);
    for (let i = 0; i < 2; i++) box(w / 2 - 0.25, 0.12, 0.62, mat, (i - 0.5) * (w / 2 - 0.2), 0.5, 0.08, 0.05, g);
    for (const [lx, lz] of [[-w / 2 + 0.1, -0.35], [w / 2 - 0.1, -0.35], [-w / 2 + 0.1, 0.35], [w / 2 - 0.1, 0.35]]) cyl(0.025, 0.02, 0.08, M.brass, lx, 0.04, lz, 8, g);
    g.position.set(x, 0, z); g.rotation.y = rot; scene.add(g); return g;
  }
  function plant(x, z, s = 1) {
    cyl(0.28 * s, 0.22 * s, 0.55 * s, M.stone, x, 0.275 * s, z, 20);
    const leaves = [[0, 0.95, 0, 0.42], [0.2, 0.8, 0.1, 0.32], [-0.18, 0.85, -0.08, 0.34], [0.05, 1.25, -0.05, 0.3], [-0.1, 1.1, 0.18, 0.28]];
    leaves.forEach(([lx, ly, lz, r], i) => {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r * s, 1), i % 2 ? M.leaf2 : M.leaf);
      m.position.set(x + lx * s, ly * s, z + lz * s); m.scale.y = 1.25; m.castShadow = true; scene.add(m);
    });
  }
  function floorLamp(x, z) {
    cyl(0.18, 0.2, 0.03, M.metal, x, 0.015, z);
    cyl(0.012, 0.012, 1.6, M.brass, x, 0.8, z, 8);
    const s = cyl(0.2, 0.26, 0.32, M.shade, x, 1.7, z, 24); s.castShadow = false;
    const l = new THREE.PointLight(0xffcf8f, 6, 0, 2); l.position.set(x, 1.6, z); scene.add(l);
  }

  // ---------- Aula ----------
  useFloor(1);
  box(11, 0.32, 3, M.walnut, -10, 0.16, -13.5, 0.02);
  box(11, 0.02, 0.03, M.brass, -10, 0.33, -12.0, 0);
  const aulaScreen = makeScreen(9, 5, 1280);
  aulaScreen.mesh.position.set(-10, 3.5, -14.8);
  tag(aulaScreen.mesh, 'aula');
  for (let row = 0; row < 3; row++) for (let i = 0; i < 5; i++) chair(-13.6 + i * 1.8, -9.4 + row * 2, Math.PI, M.fabric);
  plant(-15.8, -11.6, 1.1); plant(-4.2, -11.6, 1.1);

  // ---------- Muro de mercado ----------
  useFloor(2);
  const wallScreen = makeScreen(13, 5.4, 1536);
  wallScreen.mesh.position.set(8, 3.6, -14.8);
  tag(wallScreen.mesh, 'mercado');
  const tickerScreen = makeScreen(13, 0.5, 1536);
  tickerScreen.mesh.position.set(8, 0.62, -14.8);
  desk(8, -11.4, 8, 1.0);
  const minis = [-2.6, 0, 2.6].map((dx, i) => { const s = monitor(8 + dx, -11.4, 1.1, 0.62); paintMini(s, i - 1); return s; });
  void minis;
  [-2.6, 0, 2.6].forEach((dx) => officeChair(8 + dx, -10.5, Math.PI));
  plant(14.4, -13.6, 1.2);

  // ---------- Videoteca ----------
  useFloor(1);
  const videoScreen = makeScreen(5.2, 2.9, 1024);
  videoScreen.mesh.position.set(-W / 2 + 0.08, 2.3, -1);
  videoScreen.mesh.rotation.y = Math.PI / 2;
  tag(videoScreen.mesh, 'videoteca');
  box(0.45, 0.4, 3.6, M.walnut, -W / 2 + 0.3, 0.2, -1, 0.02);              // mueble bajo
  sofa(-15.6, -1, 3.0, -Math.PI / 2, M.fabric);

  // ---------- Mesa de análisis (agentes) ----------
  useFloor(2);
  box(11.2, 3, 0.25, M.walnut, -10, 1.5, 4.6, 0.02);
  box(11.2, 0.03, 0.27, M.brass, -10, 3.01, 4.6, 0);
  desk(-10, 6.1, 9, 0.9);
  const agentUnits = agents.map((a, i) => {
    const x = -14.05 + i * 2.7;
    const screen = makeScreen(2.4, 1.4, 640);
    screen.mesh.position.set(x, 2.0, 4.76);
    tag(screen.mesh, 'agentes');
    return { agent: a, holo: screen, status: 'En espera', line: a.role, busy: false };
  });
  [-12, -8].forEach((x) => officeChair(x, 7.0, Math.PI));
  plant(-3.6, 5, 1);

  // ---------- Panel de alertas ----------
  box(1.0, 2.3, 0.22, M.metal, 8, 1.15, 12.3, 0.03);
  const alertScreen = makeScreen(0.86, 1.6, 400, { bezel: false });
  alertScreen.mesh.position.set(8, 1.3, 12.42);
  tag(alertScreen.mesh, 'alertas');

  // ---------- Cursos (atriles) ----------
  useFloor(1);
  const kiosks = KIOSK_Z.map((z, i) => {
    box(0.5, 1.1, 0.5, M.walnut, 17.8, 0.55, z, 0.02);
    box(0.52, 0.02, 0.52, M.brass, 17.8, 1.11, z, 0);
    const s = makeScreen(1.0, 0.68, 400, { depth: 0.03 });
    s.mesh.position.set(17.6, 1.48, z);
    s.mesh.rotation.y = -Math.PI / 2 + 0.6;
    s.mesh.rotation.x = -0.25;
    tag(s.mesh, `kiosk-${i}`);
    return s;
  });
  plant(18.6, -8, 1.1); plant(18.6, 9, 1.1);

  // ---------- Salón ----------
  function lounge() {
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(7, 5), new THREE.MeshStandardMaterial({ map: tex(rugCanvas()), roughness: 1 }));
  rug.rotation.x = -Math.PI / 2; rug.position.set(2, 0.012, 3.2); rug.receiveShadow = true; scene.add(rug);
  sofa(2, 1.0, 3.2, 0, M.linen);
  sofa(2, 5.4, 3.2, Math.PI, M.linen);
  cyl(0.75, 0.75, 0.05, M.walnut, 2, 0.42, 3.2, 40);
  cyl(0.05, 0.05, 0.4, M.metal, 2, 0.2, 3.2, 10);
  cyl(0.4, 0.4, 0.02, M.metal, 2, 0.01, 3.2, 24);
  floorLamp(-0.4, 0.6);
  plant(5.4, 0.6, 0.9); plant(-14, 13.4, 1.2); plant(18.6, 13.4, 1.2);
  }
  useFloor(1); lounge(); useFloor(2); lounge();

  // ================= PISO 3: CONFERENCIAS =================
  useFloor(3);
  warm(0, 5, -8, 70); warm(-8, 4.5, 0, 40); warm(8, 4.5, 0, 40);
  const aisle = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 15), new THREE.MeshStandardMaterial({ color: 0x5a3030, roughness: 1 }));
  aisle.rotation.x = -Math.PI / 2; aisle.position.set(0, 0.012, -2.5); aisle.receiveShadow = true; scene.add(aisle);
  box(18.6, 0.5, 4.3, M.walnut, 0, 0.25, -12.65, 0.02);                 // tarima
  box(18.6, 0.03, 0.05, M.brass, 0, 0.51, -10.52, 0);
  box(3.2, 0.25, 0.8, M.walnut, 0, 0.125, -10.15, 0.02);                // escalón
  box(0.9, 1.05, 0.6, M.walnut, 0, 1.025, -11.5, 0.02);                 // atril
  box(0.92, 0.03, 0.62, M.brass, 0, 1.56, -11.5, 0);
  cyl(0.012, 0.012, 0.4, M.metal, 0.1, 1.78, -11.55, 8);
  { const mic = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 12), M.metal); mic.position.set(0.1, 2.0, -11.55); scene.add(mic); }
  const confScreen = makeScreen(10, 5.6, 1280);
  confScreen.mesh.position.set(0, 3.55, -14.7);
  tag(confScreen.mesh, 'tarima');
  plant(-8.7, -11.2, 1.2); plant(8.7, -11.2, 1.2); plant(-14.5, 5, 1.2); plant(14.5, 5, 1.2); plant(-14.5, -6, 1.2); plant(14.5, -6, 1.2);
  const SEATS3 = [];
  for (const z of [-6.8, -5, -3.2, -1.4, 0.4]) for (const x of [-8.8, -7.2, -5.6, -4, -2.4, 2.4, 4, 5.6, 7.2, 8.8]) { chair(x, z, Math.PI, M.fabric); SEATS3.push({ x, z }); }

  // ================= PISO 4: SALA DE JUEGOS =================
  useFloor(4);
  warm(-8, 5, 0, 60); warm(8, 5, -6, 50); warm(-8, 5, -12, 40);
  const neon = (() => { const c = document.createElement('canvas'); c.width = 1024; c.height = 200; const x = c.getContext('2d'); x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = 'italic 500 120px Fraunces, Georgia, serif'; x.shadowColor = '#d9bf8c'; x.shadowBlur = 36; x.fillStyle = '#f3e3bf'; x.fillText('Sala de juegos', 512, 100); x.fillText('Sala de juegos', 512, 100); return c; })();
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.76), new THREE.MeshBasicMaterial({ map: tex(neon), transparent: true, toneMapped: false }));
  sign.material.map.wrapS = sign.material.map.wrapT = THREE.ClampToEdgeWrapping; sign.material.map.repeat.set(1, 1);
  sign.position.set(8, 5.2, -14.8); scene.add(sign);
  // billar
  { const g = new THREE.Group(); g.position.set(-8, 0, 2); scene.add(g);
    const felt = new THREE.MeshStandardMaterial({ color: 0x2f6b4a, roughness: 1 }), cush = new THREE.MeshStandardMaterial({ color: 0x24543a, roughness: 0.9 });
    box(3.4, 0.14, 1.9, M.walnut, 0, 0.85, 0, 0.04, g); box(2.9, 0.05, 1.4, felt, 0, 0.93, 0, 0.01, g);
    for (const [lx, lz] of [[-1.5, -0.8], [1.5, -0.8], [-1.5, 0.8], [1.5, 0.8]]) box(0.2, 0.85, 0.2, M.walnut, lx, 0.425, lz, 0.02, g);
    box(2.9, 0.07, 0.1, cush, 0, 0.98, -0.75, 0.02, g); box(2.9, 0.07, 0.1, cush, 0, 0.98, 0.75, 0.02, g); box(0.1, 0.07, 1.4, cush, -1.45, 0.98, 0, 0.02, g); box(0.1, 0.07, 1.4, cush, 1.45, 0.98, 0, 0.02, g);
    const cols = [0xe8c33a, 0x2a5fa8, 0xc0392b, 0x5a2d82, 0xe67e22, 0x2f7d4f, 0x7b1e24, 0x151515, 0xe8c33a];
    let k = 0; for (let r = 0; r < 4; r++) for (let i = 0; i <= r; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 12), new THREE.MeshStandardMaterial({ color: cols[k++ % cols.length], roughness: 0.25 })); b.position.set(0.6 + r * 0.1, 0.99, (i - r / 2) * 0.115); b.castShadow = true; g.add(b); }
    const w = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 12), new THREE.MeshStandardMaterial({ color: 0xf5f2ea, roughness: 0.25 })); w.position.set(-0.8, 0.99, 0); g.add(w);
    cyl(0.012, 0.018, 1.4, M.walnut, 0, 0, 0, 8, g).position.set(-1.9, 0.7, 1.1);
    cyl(0.012, 0.018, 1.4, M.walnut, 0, 0, 0, 8, g).position.set(-1.95, 0.7, 1.2);
    cyl(0.01, 0.01, 2.6, M.metal, 0, 4.9, 0, 6, g); const sh = cyl(0.12, 0.55, 0.3, M.shade, 0, 3.4, 0, 24, g); sh.castShadow = false;
    const pl = new THREE.PointLight(0xffcf8f, 18, 0, 2); pl.position.set(0, 3.1, 0); g.add(pl); }
  // ping-pong
  { const g = new THREE.Group(); g.position.set(6, 0, 3); scene.add(g);
    box(2.74, 0.04, 1.52, new THREE.MeshStandardMaterial({ color: 0x1f4f86, roughness: 0.5 }), 0, 0.76, 0, 0.01, g);
    box(2.74, 0.005, 0.02, M.linen, 0, 0.785, 0, 0, g); box(0.02, 0.005, 1.52, M.linen, 0, 0.785, 0, 0, g);
    box(0.02, 0.15, 1.7, new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 1, transparent: true, opacity: 0.8 }), 0, 0.86, 0, 0, g);
    for (const [lx, lz] of [[-1.25, -0.65], [1.25, -0.65], [-1.25, 0.65], [1.25, 0.65]]) box(0.06, 0.74, 0.06, M.metal, lx, 0.37, lz, 0, g); }
  // arcades
  const arcadeScreens = [-12.6, -10.4, -8.2, -6].map((x, i) => {
    box(1.0, 2.0, 0.9, M.metal, x, 1, -14.1, 0.04);
    box(0.92, 0.22, 0.1, new THREE.MeshStandardMaterial({ color: [0xd9bf8c, 0x6f8fb3, 0xc47b5a, 0x6f9a7f][i], emissive: [0xd9bf8c, 0x6f8fb3, 0xc47b5a, 0x6f9a7f][i], emissiveIntensity: 0.9 }), x, 1.92, -13.64, 0.02);
    box(0.9, 0.12, 0.45, M.metal, x, 1.0, -13.8, 0.02);
    cyl(0.012, 0.012, 0.12, M.brass, x - 0.18, 1.1, -13.62, 8); { const b = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 10), M.brass); b.position.set(x - 0.18, 1.17, -13.62); scene.add(b); }
    for (let j = 0; j < 3; j++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.025, 10, 10), new THREE.MeshStandardMaterial({ color: [0xc0392b, 0xe8c33a, 0x2a5fa8][j], emissive: [0xc0392b, 0xe8c33a, 0x2a5fa8][j], emissiveIntensity: 0.5 })); b.position.set(x + 0.04 + j * 0.1, 1.07, -13.6); scene.add(b); }
    const s = makeScreen(0.74, 0.58, 256, { depth: 0.02 }); s.mesh.position.set(x, 1.5, -13.64); s.mesh.rotation.x = -0.18;
    const { ctx, canvas: cv } = s; ctx.fillStyle = '#0b0c0e'; ctx.fillRect(0, 0, cv.width, cv.height);
    const pal = [['#d9bf8c', '#f3e3bf'], ['#6f8fb3', '#bcd2e8'], ['#c47b5a', '#f0c3a8'], ['#6f9a7f', '#bfe0cb']][i];
    for (let a = 0; a < 5; a++) for (let b = 0; b < 8; b++) { ctx.fillStyle = (a + b + i) % 3 ? pal[0] : pal[1]; ctx.fillRect(28 + b * 26, 30 + a * 22, 18, 12); }
    ctx.fillStyle = pal[1]; ctx.fillRect(100, 218, 56, 8); ctx.fillStyle = '#f2efe9'; ctx.fillRect(124, 190, 6, 14);
    s.texture.needsUpdate = true; tag(s.mesh, 'arcade'); return s; });
  void arcadeScreens;
  // descanso: puffs, mesa, sofá y plantas
  [[12.5, -8, 0xc9a96e], [14.6, -6.4, 0x6f8fb3], [11.8, -5.6, 0xc47b5a]].forEach(([x, z, c]) => { const b = new THREE.Mesh(new THREE.SphereGeometry(0.62, 20, 14), new THREE.MeshStandardMaterial({ color: c, roughness: 0.95 })); b.position.set(x, 0.38, z); b.scale.y = 0.62; b.castShadow = true; b.receiveShadow = true; scene.add(b); });
  cyl(0.5, 0.5, 0.04, M.walnut, 13.2, 0.42, -6.9, 32); cyl(0.04, 0.04, 0.4, M.metal, 13.2, 0.2, -6.9, 8);
  sofa(17, 4, 3.0, -Math.PI / 2, M.fabric);
  plant(18.6, -8, 1.1); plant(18.6, 12, 1.1); plant(-14, 13.4, 1.2); plant(-18, 4, 1.1);
  // diana
  [[0.36, 0x151515], [0.3, 0xf2efe9], [0.2, 0x151515], [0.1, 0xc0392b]].forEach(([r, c], i) => { const d = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.03, 32), new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 })); d.rotation.z = Math.PI / 2; d.position.set(-W / 2 + 0.06 + i * 0.004, 2.3, 8); scene.add(d); });

  // ================= DECORACIÓN: piezas reutilizables =================
  const EX_OB = { 1: [], 2: [], 3: [], 4: [] }, EX_HS = { 1: [], 2: [], 3: [], 4: [] };
  const ob = (f, x, z, w, d) => EX_OB[f].push({ x1: x - w / 2, x2: x + w / 2, z1: z - d / 2, z2: z + d / 2 });
  const obC = (f, x, z, r) => EX_OB[f].push({ cx: x, cz: z, r });
  const spot = (f, ...p) => p.forEach(([x, z]) => EX_HS[f].push({ x, z }));
  const bookTex = tex(booksCanvas(), 1, 1);
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a2c30, metalness: 0.8, roughness: 0.4 });
  const ledG = new THREE.MeshBasicMaterial({ color: 0x4fd1a1 }), ledA = new THREE.MeshBasicMaterial({ color: 0xd9a35f });
  const ledGeo = new THREE.BoxGeometry(0.02, 0.02, 0.01);
  const feltM = new THREE.MeshStandardMaterial({ color: 0x2f6b4a, roughness: 1 });

  function bookcase(x, z, w = 2.3, h = 2.7, rot = 0) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; scene.add(g);
    box(w, h, 0.08, M.walnut, 0, h / 2, -0.16, 0.01, g);
    box(0.06, h, 0.4, M.walnut, -w / 2, h / 2, 0, 0.01, g); box(0.06, h, 0.4, M.walnut, w / 2, h / 2, 0, 0.01, g);
    box(w, 0.06, 0.4, M.walnut, 0, h, 0, 0.01, g); box(w, 0.08, 0.4, M.walnut, 0, 0.04, 0, 0.01, g);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.1, h - 0.15), new THREE.MeshStandardMaterial({ map: bookTex, roughness: 0.9 }));
    p.position.set(0, h / 2, -0.1); g.add(p);
  }
  function roundTable(x, z, n = 4, r = 0.8, mat = M.fabric) {
    cyl(r, r, 0.05, M.walnut, x, 0.75, z, 36); cyl(0.06, 0.06, 0.72, M.metal, x, 0.36, z, 10); cyl(0.35, 0.38, 0.03, M.metal, x, 0.015, z, 20);
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + 0.4, dx = Math.cos(a) * (r + 0.45), dz = Math.sin(a) * (r + 0.45); chair(x + dx, z + dz, Math.atan2(-dx, -dz), mat); }
  }
  function laptop(x, z, rot = 0) {
    const g = new THREE.Group(); g.position.set(x, 0.775, z); g.rotation.y = rot; scene.add(g);
    box(0.34, 0.015, 0.23, M.metal, 0, 0, 0, 0.005, g);
    const l = box(0.34, 0.22, 0.01, M.metal, 0, 0.11, -0.11, 0.005, g); l.rotation.x = -0.25;
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.31, 0.19), new THREE.MeshBasicMaterial({ color: 0x9fb4cf })); s.position.set(0, 0.11, -0.103); s.rotation.x = -0.25; g.add(s);
  }
  function tableLamp(x, y, z) {
    cyl(0.05, 0.06, 0.02, M.brass, x, y + 0.01, z, 16); cyl(0.008, 0.008, 0.3, M.brass, x, y + 0.16, z, 6);
    const s = cyl(0.1, 0.15, 0.18, M.shade, x, y + 0.36, z, 20); s.castShadow = false;
  }
  function stool(x, z, h = 0.72) { cyl(0.2, 0.2, 0.06, M.leather, x, h, z, 20); cyl(0.02, 0.02, h, M.metal, x, h / 2, z, 8); cyl(0.17, 0.19, 0.02, M.metal, x, 0.01, z, 16); }
  function codeScreen(s) {
    const { ctx, canvas: c } = s; bg(ctx, c.width, c.height, '#0f1115', '#0a0b0e');
    const cols = ['#d9bf8c', '#6f8fb3', '#6f9a7f', '#8a8478', '#c47b5a'];
    for (let y = 14; y < c.height - 10; y += 12) { let x = 14 + ((Math.random() * 3) | 0) * 14; for (let i = 0, n = 1 + ((Math.random() * 4) | 0); i < n; i++) { const w = 20 + Math.random() * 70; ctx.fillStyle = cols[(Math.random() * cols.length) | 0]; ctx.fillRect(x, y, w, 5); x += w + 8; } }
    s.texture.needsUpdate = true;
  }
  function workstation(f, x, z, n = 2, w = 2.6, kind = 'code') {
    desk(x, z, w, 0.9);
    for (let i = 0; i < n; i++) { const s = monitor(x + (i - (n - 1) / 2) * 0.98, z, 0.9, 0.52, 384); kind === 'code' ? codeScreen(s) : paintMini(s, (i % 3) - 1); }
    box(0.42, 0.015, 0.14, M.metal, x, 0.775, z + 0.22, 0.004); box(0.06, 0.02, 0.1, M.metal, x + 0.4, 0.775, z + 0.22, 0.008);
    box(0.22, 0.46, 0.46, M.metal, x + w / 2 - 0.3, 0.26, z, 0.02); cyl(0.04, 0.035, 0.09, M.linen, x - w / 2 + 0.3, 0.82, z + 0.2, 12);
    officeChair(x, z + 0.95, Math.PI); ob(f, x, z + 0.4, w, 1.8);
  }
  function rack(x, z, rot = 0) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; scene.add(g);
    box(0.8, 2.1, 0.9, M.metal, 0, 1.05, 0, 0.02, g);
    for (let i = 0; i < 9; i++) {
      box(0.7, 0.14, 0.02, dark, 0, 0.25 + i * 0.2, 0.46, 0, g);
      for (let j = 0; j < 3; j++) { const l = new THREE.Mesh(ledGeo, Math.random() < 0.75 ? ledG : ledA); l.position.set(-0.28 + j * 0.06, 0.25 + i * 0.2, 0.475); g.add(l); }
    }
  }
  function glassWall(x, z, w, d, h = 2.8) {
    const gm = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M.glass); gm.position.set(x, h / 2, z); scene.add(gm);
    box(w, 0.06, d + 0.04, M.metal, x, h, z, 0); box(w, 0.06, d + 0.04, M.metal, x, 0.03, z, 0);
  }
  function plaque(text, x, y, z, ry = 0, w = 3) {
    const c = document.createElement('canvas'); c.width = 768; c.height = 192; const k = c.getContext('2d');
    k.fillStyle = '#16140f'; k.fillRect(0, 0, 768, 192); k.strokeStyle = '#d9bf8c'; k.lineWidth = 6; k.strokeRect(10, 10, 748, 172);
    k.fillStyle = '#f3e3bf'; k.font = '500 72px Fraunces, Georgia, serif'; k.textAlign = 'center'; k.textBaseline = 'middle'; k.fillText(text, 384, 100);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4), new THREE.MeshBasicMaterial({ map: t, toneMapped: false })); m.position.set(x, y, z); m.rotation.y = ry; scene.add(m);
  }
  function wallArt(cv, x, y, z, ry, w, h) {
    box(w + 0.1, h + 0.1, 0.04, M.metal, x, y, z, 0.01).rotation.y = ry;
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, toneMapped: false }));
    m.position.set(x + Math.sin(ry) * 0.03, y, z + Math.cos(ry) * 0.03); m.rotation.y = ry; scene.add(m);
  }
  function artFill(s, i) {
    const { ctx, canvas: cv } = s; ctx.fillStyle = '#0b0c0e'; ctx.fillRect(0, 0, cv.width, cv.height);
    const pal = [['#d9bf8c', '#f3e3bf'], ['#6f8fb3', '#bcd2e8'], ['#c47b5a', '#f0c3a8'], ['#6f9a7f', '#bfe0cb']][i % 4];
    for (let a = 0; a < 5; a++) for (let b = 0; b < 8; b++) { ctx.fillStyle = (a + b + i) % 3 ? pal[0] : pal[1]; ctx.fillRect(28 + b * 26, 30 + a * 22, 18, 12); }
    ctx.fillStyle = pal[1]; ctx.fillRect(100, 218, 56, 8); s.texture.needsUpdate = true;
  }
  function speaker(x, z) {
    box(0.8, 1.7, 0.7, M.metal, x, 0.85, z, 0.03);
    for (const y of [0.55, 1.2]) { const c = cyl(0.26, 0.26, 0.04, dark, x, y, z + 0.36, 24); c.rotation.x = Math.PI / 2; const r = cyl(0.08, 0.08, 0.05, M.brass, x, y, z + 0.37, 16); r.rotation.x = Math.PI / 2; }
  }
  function tripod(x, z) {
    for (let a = 0; a < 3; a++) { const t = (a / 3) * Math.PI * 2, l = cyl(0.015, 0.015, 1.4, M.metal, x + Math.cos(t) * 0.22, 0.66, z + Math.sin(t) * 0.22, 6); l.rotation.set(Math.sin(t) * 0.17, 0, -Math.cos(t) * 0.17); }
    box(0.3, 0.28, 0.55, M.metal, x, 1.5, z, 0.03); const lens = cyl(0.09, 0.11, 0.25, dark, x, 1.5, z - 0.38, 16); lens.rotation.x = Math.PI / 2;
  }
  function cocktail(x, z) {
    cyl(0.4, 0.4, 0.04, M.walnut, x, 1.05, z, 28); cyl(0.04, 0.04, 1.03, M.brass, x, 0.52, z, 8); cyl(0.28, 0.3, 0.03, M.metal, x, 0.015, z, 20);
    for (let i = 0; i < 3; i++) cyl(0.035, 0.03, 0.12, M.glass, x + Math.cos(i * 2.1) * 0.2, 1.13, z + Math.sin(i * 2.1) * 0.2, 12);
  }
  function banner(x, z, ry) {
    box(0.95, 2.3, 0.06, M.metal, x, 1.15, z, 0.02).rotation.y = ry;
    const t = new THREE.CanvasTexture(bannerCanvas()); t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 2.1), new THREE.MeshBasicMaterial({ map: t, toneMapped: false }));
    m.position.set(x + Math.sin(ry) * 0.04, 1.15, z + Math.cos(ry) * 0.04); m.rotation.y = ry; scene.add(m);
  }
  function pinball(x, z, i) {
    const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
    const col = [0x6f8fb3, 0xc47b5a, 0x6f9a7f][i % 3];
    box(0.72, 0.9, 1.3, M.metal, 0, 0.45, 0, 0.03, g);
    box(0.64, 0.03, 1.15, new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.35, roughness: 0.4 }), 0, 0.98, 0.05, 0.01, g).rotation.x = -0.13;
    box(0.72, 0.9, 0.16, M.metal, 0, 1.4, -0.58, 0.03, g);
    const s = makeScreen(0.6, 0.62, 256, { bezel: false }); artFill(s, i); s.mesh.position.set(0, 1.42, -0.49); g.add(s.mesh);
  }
  function jukebox(x, z) {
    const am = new THREE.MeshStandardMaterial({ color: 0xc9902f, emissive: 0xd9a35f, emissiveIntensity: 0.55, roughness: 0.4 });
    box(0.9, 1.5, 0.6, am, x, 0.75, z, 0.04); const d = cyl(0.45, 0.45, 0.6, am, x, 1.5, z, 28); d.rotation.x = Math.PI / 2;
    box(0.7, 0.5, 0.02, dark, x, 1.15, z + 0.31, 0.01); cyl(0.2, 0.2, 0.02, M.brass, x, 1.7, z + 0.31, 24).rotation.x = Math.PI / 2;
  }
  function clawMachine(x, z) {
    box(0.9, 0.8, 0.9, M.metal, x, 0.4, z, 0.03); const gm = new THREE.Mesh(new THREE.BoxGeometry(0.88, 1.1, 0.88), M.glass); gm.position.set(x, 1.35, z); scene.add(gm);
    box(0.92, 0.12, 0.92, new THREE.MeshStandardMaterial({ color: 0xc47b5a, emissive: 0xc47b5a, emissiveIntensity: 0.5 }), x, 2.0, z, 0.02);
    [0xd9bf8c, 0x6f8fb3, 0xc47b5a, 0x6f9a7f, 0xa8677a, 0xf2efe9].forEach((c, i) => { const p = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 })); p.position.set(x + ((i % 3) - 1) * 0.25, 0.95, z + (i < 3 ? -0.18 : 0.18)); scene.add(p); });
    cyl(0.01, 0.01, 0.35, M.metal, x, 1.7, z, 6);
  }
  function foosball(x, z) {
    const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
    box(1.5, 0.14, 0.82, M.walnut, 0, 0.82, 0, 0.03, g); box(1.34, 0.02, 0.66, feltM, 0, 0.9, 0, 0, g);
    for (const [lx, lz] of [[-0.65, -0.34], [0.65, -0.34], [-0.65, 0.34], [0.65, 0.34]]) box(0.1, 0.78, 0.1, M.walnut, lx, 0.39, lz, 0.01, g);
    for (let i = 0; i < 4; i++) {
      const rx = -0.45 + i * 0.3; cyl(0.01, 0.01, 1.15, M.metal, rx, 1.0, 0, 6, g).rotation.x = Math.PI / 2;
      for (const zz of [-0.12, 0.12]) box(0.04, 0.12, 0.05, i % 2 ? M.brass : M.leather, rx, 0.95, zz, 0, g);
      cyl(0.02, 0.02, 0.1, M.walnut, rx, 1.0, 0.62, 8, g).rotation.x = Math.PI / 2;
    }
  }
  function airHockey(x, z) {
    const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
    box(2.0, 0.14, 1.0, M.metal, 0, 0.8, 0, 0.03, g);
    box(1.84, 0.02, 0.84, new THREE.MeshStandardMaterial({ color: 0xdfe8f2, emissive: 0x3a5f8a, emissiveIntensity: 0.25, roughness: 0.3 }), 0, 0.88, 0, 0, g);
    for (const [lx, lz] of [[-0.9, -0.45], [0.9, -0.45], [-0.9, 0.45], [0.9, 0.45]]) box(0.08, 0.76, 0.08, M.metal, lx, 0.38, lz, 0, g);
    cyl(0.07, 0.07, 0.04, new THREE.MeshStandardMaterial({ color: 0xc0392b }), -0.55, 0.92, 0, 20, g); cyl(0.07, 0.07, 0.04, new THREE.MeshStandardMaterial({ color: 0x2a5fa8 }), 0.55, 0.92, 0.1, 20, g);
    cyl(0.04, 0.04, 0.02, dark, 0.05, 0.91, -0.1, 14, g);
  }
  function poker(x, z) {
    cyl(1.25, 1.25, 0.08, M.walnut, x, 0.76, z, 48); cyl(1.12, 1.12, 0.03, feltM, x, 0.81, z, 48); cyl(0.12, 0.2, 0.74, M.metal, x, 0.37, z, 12);
    [0xc0392b, 0x151515, 0x2a5fa8, 0xe8c33a].forEach((c, i) => { const a = i * 1.6 + 0.4; for (let k = 0; k < 3 + i; k++) cyl(0.03, 0.03, 0.02, new THREE.MeshStandardMaterial({ color: c, roughness: 0.4 }), x + Math.cos(a) * 0.6, 0.84 + k * 0.021, z + Math.sin(a) * 0.6, 14); });
    for (let i = 0; i < 5; i++) box(0.06, 0.003, 0.09, M.linen, x - 0.2 + i * 0.09, 0.835, z, 0).rotation.y = i * 0.1;
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2, dx = Math.cos(a) * 1.8, dz = Math.sin(a) * 1.8; chair(x + dx, z + dz, Math.atan2(-dx, -dz), M.leather); }
  }

  // ================= PISO 1: biblioteca, estudio, cafetería, pizarra =================
  useFloor(1);
  [3.5, 6, 8.5, 11, 13.5].forEach((x) => bookcase(x, -14.55)); ob(1, 8.5, -14.4, 12.6, 0.6);
  plaque('Biblioteca', 8.5, 3.6, -14.9, 0, 3.2);
  const rug1 = new THREE.Mesh(new THREE.PlaneGeometry(11, 5), new THREE.MeshStandardMaterial({ map: tex(rugCanvas()), roughness: 1 })); rug1.rotation.x = -Math.PI / 2; rug1.position.set(9, 0.012, -9.5); rug1.receiveShadow = true; scene.add(rug1);
  for (const [x, z] of [[6, -9.5], [11.8, -9]]) { roundTable(x, z, 4, 0.85, M.leather); tableLamp(x, 0.775, z); laptop(x - 0.3, z + 0.2, 0.4); obC(1, x, z, 1.6); spot(1, [x + 1.4, z + 1.2], [x - 1.4, z - 0.8]); }
  sofa(15.4, -11.5, 1.4, -Math.PI / 2, M.leather); floorLamp(15.8, -9.6); ob(1, 15.6, -11.5, 1.1, 1.6);
  for (const [x, z] of [[8.5, 6.8], [13.5, 6.8], [8.5, 10.8], [13.5, 10.8]]) { roundTable(x, z, 4, 0.8); laptop(x - 0.25, z + 0.25, 0.5); laptop(x + 0.3, z - 0.25, -2.6); obC(1, x, z, 1.55); spot(1, [x, z + 1.5], [x - 1.5, z]); }
  box(3.4, 1.0, 0.7, M.walnut, 15.5, 0.5, 13.6, 0.02); box(3.5, 0.05, 0.8, M.brass, 15.5, 1.02, 13.6, 0);
  box(0.4, 0.4, 0.3, dark, 14.6, 1.25, 13.6, 0.03); box(0.3, 0.3, 0.25, M.metal, 15.4, 1.2, 13.6, 0.03);
  for (let i = 0; i < 3; i++) cyl(0.04, 0.035, 0.09, M.linen, 16 + i * 0.2, 1.1, 13.6, 10);
  [14.4, 15.5, 16.6].forEach((x) => stool(x, 12.7)); ob(1, 15.5, 13.2, 3.6, 1.6); spot(1, [15.5, 11.8]);
  { const cv = document.createElement('canvas'); cv.width = 512; cv.height = 240; const k = cv.getContext('2d'); k.fillStyle = '#f7f6f2'; k.fillRect(0, 0, 512, 240);
    k.strokeStyle = '#2a5fa8'; k.lineWidth = 4; k.beginPath(); k.moveTo(30, 190); k.lineTo(120, 120); k.lineTo(190, 150); k.lineTo(290, 60); k.lineTo(380, 90); k.stroke();
    k.strokeStyle = '#c0392b'; k.setLineDash([10, 8]); k.beginPath(); k.moveTo(30, 100); k.lineTo(480, 100); k.stroke(); k.setLineDash([]);
    k.fillStyle = '#1d1c1a'; k.font = '600 26px Inter, sans-serif'; k.fillText('Soportes y resistencias', 30, 40); k.font = '400 20px Inter, sans-serif'; k.fillText('R1 = máximo de giro anterior', 30, 224);
    wallArt(cv, -19.88, 2.3, -9, Math.PI / 2, 4, 1.9); }

  // ================= PISO 2: trading, centro de cómputo, reuniones =================
  useFloor(2);
  plaque('Mesa de trading', -11, 3.6, -14.9, 0, 3.4);
  for (const z of [-10.5, -6]) for (const x of [-16.5, -11.5, -6.5]) { workstation(2, x, z, 3, 3.6, 'chart'); spot(2, [x, z + 1.7]); }
  [-3.6, 1].forEach((z, i) => { const s = makeScreen(2.6, 1.46, 512); s.mesh.position.set(-19.88, 2.7, z); s.mesh.rotation.y = Math.PI / 2; const { ctx, canvas: c } = s; bg(ctx, c.width, c.height, '#101216', '#0a0b0e');
    ctx.fillStyle = '#c0392b'; ctx.fillRect(0, 0, c.width, 46); ctx.fillStyle = '#fff'; ctx.font = '700 28px Inter, sans-serif'; ctx.fillText(i ? '● MERCADOS' : '● EN VIVO', 16, 33);
    ctx.fillStyle = '#e6e3dd'; ctx.font = '500 26px Inter, sans-serif'; (i ? ['Oro rompe resistencia clave', 'Petróleo cierra a la baja', 'Bonos: rendimiento estable', 'Cripto: volumen en aumento'] : ['Dato de inflación esta mañana', 'La Fed mantiene la tasa', 'Futuros abren con cautela', 'Dólar se fortalece frente al euro']).forEach((t, j) => ctx.fillText(t, 16, 100 + j * 56)); s.texture.needsUpdate = true; });
  // centro de cómputo (sala de servidores con vidrio)
  { const fl = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 9), new THREE.MeshStandardMaterial({ color: 0x1c1e21, roughness: 0.5, metalness: 0.4 })); fl.rotation.x = -Math.PI / 2; fl.position.set(16.5, 0.014, -8.2); fl.receiveShadow = true; scene.add(fl); }
  [-11.4, -9.9, -8.4, -6.9, -5.4].forEach((z) => { rack(18.7, z, -Math.PI / 2); rack(14.3, z, Math.PI / 2); ob(2, 18.7, z, 0.95, 0.85); ob(2, 14.3, z, 0.95, 0.85); });
  glassWall(14.75, -3.9, 2.3, 0.06); glassWall(18.4, -3.9, 2.2, 0.06); glassWall(13.6, -8.2, 0.06, 8.6);
  ob(2, 14.75, -3.9, 2.3, 0.2); ob(2, 18.4, -3.9, 2.2, 0.2); ob(2, 13.6, -8.2, 0.2, 8.6);
  box(5.8, 0.08, 0.08, M.metal, 16.55, 2.85, -3.9, 0); plaque('Centro de cómputo', 16.55, 3.35, -3.92, 0, 3.4);
  { const l = new THREE.PointLight(0x7fb7ff, 14, 9, 2); l.position.set(16.5, 2.4, -8); scene.add(l); }
  spot(2, [16.6, -4.6], [16.6, -9]);
  // sala de reuniones
  { const rg = new THREE.Mesh(new THREE.PlaneGeometry(6, 5), new THREE.MeshStandardMaterial({ color: 0x3a3532, roughness: 1 })); rg.rotation.x = -Math.PI / 2; rg.position.set(16, 0.012, 8); rg.receiveShadow = true; scene.add(rg); }
  box(3.8, 0.06, 1.3, M.walnut, 15.4, 0.74, 8, 0.02); box(0.2, 0.72, 1.0, M.metal, 14.2, 0.36, 8, 0.02); box(0.2, 0.72, 1.0, M.metal, 16.6, 0.36, 8, 0.02);
  for (let i = 0; i < 3; i++) { officeChair(14.4 + i * 1.1, 6.9, 0); officeChair(14.4 + i * 1.1, 9.1, Math.PI); }
  officeChair(17.5, 8, -Math.PI / 2);
  box(0.5, 0.5, 1.8, M.walnut, 19.2, 0.25, 8, 0.02); { const tv = makeScreen(1.8, 1.0, 512); tv.mesh.position.set(19.12, 1.4, 8); tv.mesh.rotation.y = -Math.PI / 2; paintMini(tv, 0); }
  ob(2, 16, 8, 5.6, 3.2); ob(2, 19.2, 8, 0.7, 2); spot(2, [13.2, 8], [16, 5.8]);
  // cafetería y plantas
  box(1.6, 1.0, 0.6, M.walnut, -18.2, 0.5, 11.5, 0.02); box(0.35, 0.5, 0.3, dark, -18.4, 1.25, 11.5, 0.03); cyl(0.14, 0.14, 0.45, M.glass, -17.8, 1.22, 11.5, 14); ob(2, -18.2, 11.5, 1.8, 0.8);
  plant(-14, 13, 1.1); plant(2, 12, 1);

  // ================= PISO 3: foyer, sonido, luces, galería =================
  useFloor(3);
  box(19.2, 0.1, 0.1, M.metal, 0, 6.1, -11.0, 0); box(0.1, 6.1, 0.1, M.metal, -9.7, 3.05, -11, 0); box(0.1, 6.1, 0.1, M.metal, 9.7, 3.05, -11, 0);
  for (let i = 0; i < 7; i++) { const x = -8.4 + i * 2.8; const l = cyl(0.1, 0.14, 0.34, dark, x, 5.85, -11.0, 16); l.rotation.x = 0.6; const g = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffe2bf })); g.position.set(x, 5.7, -10.84); scene.add(g); }
  speaker(-10.5, -12.6); speaker(10.5, -12.6); ob(3, -10.5, -12.6, 0.9, 0.8); ob(3, 10.5, -12.6, 0.9, 0.8);
  for (const x of [-12.6, 12.6]) { const s = makeScreen(3.2, 4.4, 384); s.mesh.position.set(x, 3.0, -14.72); paintMini(s, x < 0 ? -1 : 1); }
  for (const x of [-3, 0, 3]) box(0.55, 0.28, 0.4, M.metal, x, 0.64, -10.4, 0.03).rotation.x = 0.4;
  desk(0, 3.8, 2.6, 0.9); { const c = box(1.5, 0.06, 0.5, M.metal, 0, 0.82, 3.7, 0.01); c.rotation.x = 0.15; for (let i = 0; i < 12; i++) cyl(0.015, 0.015, 0.03, i % 3 ? M.brass : M.linen, -0.6 + i * 0.11, 0.86, 3.65, 8); }
  [-0.85, 0.85].forEach((x, i) => { const s = monitor(x, 3.6, 0.8, 0.46, 384); codeScreen(s); void i; }); officeChair(0, 4.8, Math.PI); ob(3, 0, 4.2, 2.8, 2); obC(3, -3.4, 2.6, 0.5); obC(3, 3.4, 2.6, 0.5);
  tripod(-3.4, 2.6); tripod(3.4, 2.6);
  { const fr = new THREE.Mesh(new THREE.PlaneGeometry(14, 5), new THREE.MeshStandardMaterial({ map: tex(rugCanvas()), roughness: 1 })); fr.rotation.x = -Math.PI / 2; fr.position.set(0, 0.012, 11.5); fr.receiveShadow = true; scene.add(fr); }
  box(4.2, 1.1, 0.8, M.walnut, -12, 0.55, 11.5, 0.02); box(4.3, 0.05, 0.9, M.brass, -12, 1.12, 11.5, 0); [-12.9, -11.1].forEach((x) => laptop(x, 11.5 + 0.0, Math.PI)); ob(3, -12, 11.5, 4.4, 1.1);
  plaque('Registro', -12, 1.9, 11.1, 0, 1.8);
  cocktail(-5.5, 10); cocktail(5.5, 10); obC(3, -5.5, 10, 0.6); obC(3, 5.5, 10, 0.6);
  sofa(13, 12.2, 3.2, Math.PI, M.leather); sofa(13, 9, 3.2, 0, M.leather); cyl(0.6, 0.6, 0.04, M.walnut, 13, 0.4, 10.6, 28); ob(3, 13, 10.6, 3.4, 4.4); floorLamp(16, 10.6);
  banner(-16.5, 8, 0.25); banner(16.5, 6, -0.25); ob(3, -16.5, 8, 1, 0.4); ob(3, 16.5, 6, 1, 0.4);
  { const cs = [0, 1, 2].map((i) => { const c = document.createElement('canvas'); c.width = 320; c.height = 208; const k = c.getContext('2d'); k.fillStyle = '#e9e4da'; k.fillRect(0, 0, 320, 208); const pal = ['#c47b5a', '#6f8fb3', '#6f9a7f', '#d9bf8c', '#2a2c30']; for (let n = 0; n < 7; n++) { k.fillStyle = pal[(Math.random() * 5) | 0]; const s = 30 + Math.random() * 90; if ((n + i) % 2) { k.beginPath(); k.arc(Math.random() * 320, Math.random() * 208, s / 2, 0, 7); k.fill(); } else k.fillRect(Math.random() * 280, Math.random() * 170, s, s * 0.7); } return c; });
    [-4, 0, 4].forEach((z, i) => wallArt(cs[i], -19.88, 2.4, z, Math.PI / 2, 2.2, 1.43)); }
  plant(-18.4, 13, 1.2); plant(18.4, 13.4, 1.2);

  // ================= PISO 4: bar, casino, máquinas =================
  useFloor(4);
  [0.4, 2, 3.6].forEach((x, i) => pinball(x, -14.1, i)); ob(4, 2, -14.2, 4, 1.6);
  jukebox(7.4, -14.3); clawMachine(9.5, -14.2); ob(4, 8.5, -14.3, 3.4, 1.1);
  foosball(-3, 4); ob(4, -3, 4, 2.4, 1.3); spot(4, [-3, 5.4], [-3, 2.6]);
  airHockey(-4, 10); ob(4, -4, 10, 2.4, 1.5); spot(4, [-4, 11.4], [-4, 8.6]);
  { const pr = new THREE.Mesh(new THREE.CircleGeometry(2.9, 48), new THREE.MeshStandardMaterial({ color: 0x2a3d33, roughness: 1 })); pr.rotation.x = -Math.PI / 2; pr.position.set(-15, 0.012, 9); pr.receiveShadow = true; scene.add(pr); }
  poker(-15, 9); obC(4, -15, 9, 2.4); spot(4, [-15, 6.4], [-12.4, 9]);
  box(8, 1.1, 0.8, M.walnut, 10, 0.55, 13.5, 0.02); box(8.1, 0.05, 0.9, M.brass, 10, 1.12, 13.5, 0);
  [6.5, 8, 9.5, 11, 12.5].forEach((x) => stool(x, 12.5, 0.78)); ob(4, 10, 13.5, 8.6, 1.6); spot(4, [8, 11.4], [11.5, 11.4]);
  box(8, 0.05, 0.3, M.walnut, 10, 1.45, 14.65, 0); box(8, 0.05, 0.3, M.walnut, 10, 1.95, 14.65, 0);
  box(8, 0.03, 0.03, new THREE.MeshStandardMaterial({ color: 0xd9a35f, emissive: 0xd9a35f, emissiveIntensity: 1.2 }), 10, 2.3, 14.7, 0);
  for (let i = 0; i < 22; i++) { const c = [0x2f5a3a, 0x8a5a1f, 0x3a2a1a, 0x6a8f5a][i % 4]; const b = cyl(0.04, 0.045, 0.3, new THREE.MeshStandardMaterial({ color: c, roughness: 0.3 }), 6.4 + i * 0.36, i % 2 ? 1.62 : 2.12, 14.65, 10); b.castShadow = false; }
  box(0.5, 0.5, 2.2, M.walnut, 12.4, 0.25, 4, 0.02); { const tv = makeScreen(1.9, 1.07, 512); tv.mesh.position.set(12.32, 1.45, 4); tv.mesh.rotation.y = Math.PI / 2; artFill(tv, 1); } ob(4, 12.4, 4, 0.7, 2.4);
  { const gr = new THREE.Mesh(new THREE.PlaneGeometry(6, 5), new THREE.MeshStandardMaterial({ map: tex(rugCanvas()), roughness: 1 })); gr.rotation.x = -Math.PI / 2; gr.position.set(14.8, 0.012, 4); gr.receiveShadow = true; scene.add(gr); }
  spot(4, [14.8, 4], [2, 6.5], [-8, 8]);

  useFloor(0);

  // ---------- colisiones, puntos de paseo y entradas por piso ----------
  const LOUNGE_OB = [{ x1: 0.3, x2: 3.7, z1: 0.5, z2: 1.5 }, { x1: 0.3, x2: 3.7, z1: 4.9, z2: 5.9 }, { cx: 2, cz: 3.2, r: 0.8 }];
  const OB = {
    1: [
      { x1: -15.6, x2: -4.4, z1: -15, z2: -11.9 },
      { x1: -14.2, x2: -5.8, z1: -9.75, z2: -9.05 }, { x1: -14.2, x2: -5.8, z1: -7.75, z2: -7.05 }, { x1: -14.2, x2: -5.8, z1: -5.75, z2: -5.05 },
      { x1: -W / 2, x2: -19.4, z1: -2.9, z2: 0.9 }, { x1: -16.1, x2: -15.1, z1: -2.6, z2: 0.6 },
      ...LOUNGE_OB, ...KIOSK_Z.map((z) => ({ x1: 17.5, x2: 18.1, z1: z - 0.3, z2: z + 0.3 })),
    ],
    2: [{ x1: 3.9, x2: 12.1, z1: -12.0, z2: -10.85 }, { x1: -15.7, x2: -4.3, z1: 4.4, z2: 6.65 }, { x1: 7.4, x2: 8.6, z1: 12.1, z2: 12.5 }, ...LOUNGE_OB],
    3: [...[-6.8, -5, -3.2, -1.4, 0.4].flatMap((z) => [{ x1: -9.6, x2: -1.6, z1: z - 0.35, z2: z + 0.35 }, { x1: 1.6, x2: 9.6, z1: z - 0.35, z2: z + 0.35 }]), { x1: -0.45, x2: 0.45, z1: -11.8, z2: -11.2 }],
    4: [
      { x1: -13.2, x2: -5.4, z1: -15, z2: -13.4 }, { x1: -9.8, x2: -6.2, z1: 0.95, z2: 3.05 }, { x1: 4.6, x2: 7.4, z1: 2.15, z2: 3.85 }, { x1: 16.5, x2: 17.7, z1: 2.4, z2: 5.6 },
      { cx: 12.5, cz: -8, r: 0.7 }, { cx: 14.6, cz: -6.4, r: 0.7 }, { cx: 11.8, cz: -5.6, r: 0.7 }, { cx: 13.2, cz: -6.9, r: 0.55 },
    ],
  };
  const HS = {
    1: [...[-8.4, -6.4, -4.4].flatMap((z) => [-13.6, -11.8, -10, -8.2, -6.4].map((x) => ({ x, z }))), { x: -1.4, z: 3.2 }, { x: 5.4, z: 3.2 }, { x: 2, z: 7.4 }, ...KIOSK_Z.map((z) => ({ x: 16.7, z })), { x: -17, z: -3.6 }, { x: 12, z: 6 }, { x: -4, z: -1 }],
    2: [{ x: 5.4, z: -9.2 }, { x: 8, z: -8.9 }, { x: 10.6, z: -9.2 }, { x: -12, z: 8.6 }, { x: -8, z: 8.6 }, { x: 8, z: 13.5 }, { x: -1.4, z: 3.2 }, { x: 5.4, z: 3.2 }, { x: 2, z: 7.4 }, { x: 12, z: 6 }],
    3: [],
    4: [{ x: -12, z: -12.3 }, { x: -9.6, z: -12.3 }, { x: -7.2, z: -12.3 }, { x: -5.8, z: -12 }, { x: -8, z: 0.3 }, { x: -6, z: 3.7 }, { x: -10, z: 3.7 }, { x: -5.6, z: 2 }, { x: 4.4, z: 4.8 }, { x: 7.6, z: 4.8 }, { x: 4.4, z: 1.2 }, { x: 7.6, z: 1.2 }, { x: 12.4, z: -6 }, { x: 14, z: -7.8 }, { x: 15, z: 3 }, { x: 2, z: 8 }, { x: 12, z: 10 }],
  };
  for (const k of [1, 2, 3, 4]) { OB[k].push(...EX_OB[k]); HS[k].push(...EX_HS[k]); }
  const SPAWN = { 1: { x: 2, z: 9.5 }, 2: { x: 2, z: 9.5 }, 3: { x: 0, z: 5.5 }, 4: { x: 2, z: 9 } };
  const groundY = (f, x, z) => (f === 3 && z < -10.5 && Math.abs(x) < 9.2 ? 0.5 : 0);
  const blocked = (x, z, pad = 0.32, f = fl) => {
    if (x < -BX || x > BX || z < -BZ || z > BZ) return true;
    for (const o of OB[f]) {
      if (o.r) { if (Math.hypot(x - o.cx, z - o.cz) < o.r + pad) return true; }
      else if (x > o.x1 - pad && x < o.x2 + pad && z > o.z1 - pad && z < o.z2 + pad) return true;
    }
    return false;
  };

  // ---------- personajes ----------
  const avatars = [];
  function makeAvatar({ id, name, color, kind, avatar }) {
    const g = new THREE.Group();
    const model = buildAvatar(avatar);
    g.add(model.group);
    color = model.config.topColor;
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.42, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.014; g.add(shadow);
    if (kind === 'me') {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.46, 0.5, 48), new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.016; g.add(ring);
    }
    const el = document.createElement('div');
    el.className = 'avatar-label' + (kind === 'me' ? ' is-me' : '');
    el.innerHTML = `<div class="bubble"></div><div class="name"><i style="background:${color}"></i>${escapeHtml(name)}</div>`;
    const label = new CSS2DObject(el);
    label.position.set(0, model.height + 0.4, 0);
    g.add(label);
    scene.add(g);
    const av = { id, name, color, kind, group: g, model, el, label, floor: 1, bubble: el.querySelector('.bubble'), target: null, idleUntil: 0, speed: kind === 'me' ? 4.2 : 1.3 + Math.random() * 0.3, phase: Math.random() * 6, bubbleT: 0, walking: false };
    avatars.push(av);
    return av;
  }

  const me = makeAvatar({ id: 'me', name: meInfo.name, kind: 'me', avatar: meInfo.avatar });
  me.group.position.set(2, 0, 9.5);
  me.group.rotation.y = Math.PI;

  const seatOrder = SEATS3.map((s, i) => [s, (i * 7919) % 97]).sort((a, b) => a[1] - b[1]).map((x) => x[0]);
  let seatI = 0;
  const npcs = members.map((m) => {
    const a = makeAvatar({ ...m, kind: 'npc', avatar: randomAvatar(m.name) });
    a.member = m; a.floor = m.floor || 1;
    if (a.floor === 3) {
      const s = seatOrder[seatI++ % seatOrder.length];
      a.group.position.set(s.x, 0, s.z + 0.02); a.group.rotation.y = Math.PI; a.static = true; a.seated = true;
    } else {
      let p; do { p = randomPoint(); } while (blocked(p.x, p.z, 0.6, a.floor));
      a.group.position.set(p.x, 0, p.z);
      a.idleUntil = performance.now() + Math.random() * 4000;
    }
    const on = a.floor === fl; a.group.visible = on; a.label.visible = on;
    return a;
  });
  const host = npcs.find((n) => n.name === 'Camila');
  if (host) { host.group.position.set(-12.6, 0.32, -13.2); host.group.rotation.y = 0.25; host.static = true; }

  function randomPoint() { return { x: (Math.random() * 2 - 1) * (BX - 1), z: (Math.random() * 2 - 1) * (BZ - 1) }; }

  function say(av, text, ms = 5200) {
    av.bubble.textContent = text; av.talkUntil = performance.now() + ms;
    av.el.classList.add('talking');
    clearTimeout(av.bubbleT);
    av.bubbleT = setTimeout(() => av.el.classList.remove('talking'), ms);
  }

  // ---------- control ----------
  const keys = new Set();
  const isTyping = () => /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
  const onKey = (e) => {
    if (isTyping()) return;
    const k = e.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
      if (e.type === 'keydown') { keys.add(k); me.target = null; pendingZone = null; marker.visible = false; } else keys.delete(k);
      e.preventDefault();
    }
    if (e.type === 'keydown' && (k === 'e' || k === 'enter') && currentZone) opts.onInteract?.(currentZone);
    if (e.type === 'keydown' && k === 'v') setView(VIEWS[(VIEWS.indexOf(view) + 1) % 3]);
    if (e.type === 'keydown' && /^[1-4]$/.test(k)) setFloor(+k);
  };
  addEventListener('keydown', onKey);
  addEventListener('keyup', onKey);
  addEventListener('blur', () => keys.clear());

  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let pendingZone = null;
  let down = null;
  const marker = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.24, 40), new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
  marker.rotation.x = -Math.PI / 2; marker.visible = false; scene.add(marker);
  const zoneRing = new THREE.Mesh(new THREE.RingGeometry(0.97, 1, 96), new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.0, side: THREE.DoubleSide, depthWrite: false }));
  zoneRing.rotation.x = -Math.PI / 2; zoneRing.position.y = 0.015; scene.add(zoneRing);

  const pick = (e) => {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
  };
  let dragLast = null;
  renderer.domElement.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; dragLast = { x: e.clientX, y: e.clientY }; });
  addEventListener('pointerup', () => { dragLast = null; });
  renderer.domElement.addEventListener('pointermove', (e) => {
    if (!dragLast || !(e.buttons & 1)) return;
    const dx = e.clientX - dragLast.x, dy = e.clientY - dragLast.y; dragLast = { x: e.clientX, y: e.clientY };
    if (view === 'primera') { yaw -= dx * 0.005; pitch = THREE.MathUtils.clamp(pitch - dy * 0.004, -1.2, 1.2); }
    else { azim -= dx * 0.006; if (view === 'maqueta') tilt = THREE.MathUtils.clamp(tilt + dy * 0.004, 0.35, 1.45); }
  });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) return;
    pick(e);
    const hit = ray.intersectObjects(IA[fl], false)[0];
    if (hit) { const zone = ZONES_BY[fl].find((z) => z.id === hit.object.userData.zoneId); if (zone) { goToZone(zone); return; } }
    const fh = ray.intersectObject(floor)[0];
    if (fh) moveTo(fh.point.x, fh.point.z);
  });
  let lastHover = 0;
  renderer.domElement.addEventListener('pointermove', (e) => {
    const t = performance.now(); if (t - lastHover < 60 || e.pointerType !== 'mouse') return; lastHover = t;
    pick(e);
    renderer.domElement.style.cursor = ray.intersectObjects(IA[fl], false).length ? 'pointer' : '';
  });
  renderer.domElement.addEventListener('wheel', (e) => { zoom = THREE.MathUtils.clamp(zoom + Math.sign(e.deltaY) * 0.08, 0.5, 1.5); e.preventDefault(); }, { passive: false });

  function moveTo(x, z) {
    x = THREE.MathUtils.clamp(x, -BX, BX); z = THREE.MathUtils.clamp(z, -BZ, BZ);
    me.target = new THREE.Vector3(x, 0, z);
    pendingZone = null;
    marker.position.set(x, 0.02, z); marker.visible = true;
  }
  function goToZone(zone) {
    if (currentZone?.id === zone.id) { opts.onInteract?.(zone); return; }
    const p = approachPoint(zone);
    moveTo(p.x, p.z);
    pendingZone = zone;
  }
  function approachPoint(zone) {
    if (zone.id.startsWith('kiosk')) return { x: zone.x, z: zone.z };
    return { aula: { x: -10, z: -10.6 }, mercado: { x: 8, z: -9.3 }, agentes: { x: -10, z: 8.4 }, alertas: { x: 8, z: 13.4 }, videoteca: { x: -17.2, z: -1 }, tarima: { x: 0, z: -12.5 }, arcade: { x: -9.3, z: -11.8 }, pingpong: { x: 6, z: 4.9 } }[zone.id] || { x: zone.x, z: zone.z };
  }

  // ---------- movimiento ----------
  const tmp = new THREE.Vector3();
  function step(av, dir, dt) {
    if (dir.lengthSq() < 1e-6) return false;
    dir.normalize();
    const p = av.group.position;
    const dx = dir.x * av.speed * dt, dz = dir.z * av.speed * dt;
    let moved = false;
    if (!blocked(p.x + dx, p.z + dz, 0.32, av.floor)) { p.x += dx; p.z += dz; moved = true; }
    else if (!blocked(p.x + dx, p.z, 0.32, av.floor)) { p.x += dx; moved = true; }
    else if (!blocked(p.x, p.z + dz, 0.32, av.floor)) { p.z += dz; moved = true; }
    p.y = groundY(av.floor, p.x, p.z);
    const ang = Math.atan2(dir.x, dir.z);
    let diff = Math.atan2(Math.sin(ang - av.group.rotation.y), Math.cos(ang - av.group.rotation.y));
    av.group.rotation.y += diff * Math.min(1, dt * 10);
    return moved;
  }
  function updateMe(dt) {
    tmp.set(0, 0, 0);
    const fwd = (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0);
    const str = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
    if (fwd || str) {
      const hd = view === 'primera' ? yaw : azim + Math.PI;     // el movimiento sigue a la cámara
      tmp.set(Math.sin(hd) * fwd - Math.cos(hd) * str, 0, Math.cos(hd) * fwd + Math.sin(hd) * str);
    }
    let walking = false;
    if (tmp.lengthSq()) walking = step(me, tmp, dt);
    else if (me.target) {
      tmp.subVectors(me.target, me.group.position); tmp.y = 0;
      if (tmp.length() < 0.12) { me.target = null; marker.visible = false; }
      else { walking = step(me, tmp, dt); if (!walking) { me.target = null; marker.visible = false; } }
    }
    animate(me, walking, dt);
  }
  function updateNpc(av, dt, now) {
    if (av.static) { animate(av, false, dt); return; }
    let walking = false;
    if (av.target) {
      tmp.subVectors(av.target, av.group.position); tmp.y = 0;
      if (tmp.length() < 0.2) { av.target = null; av.idleUntil = now + 3000 + Math.random() * 8000; if (av.face != null) av.faceTo = av.face; }
      else { walking = step(av, tmp, dt); if (!walking) av.target = null; }
    } else if (now > av.idleUntil) {
      let p, tries = 0;
      do { p = Math.random() < 0.7 ? HS[av.floor][(Math.random() * HS[av.floor].length) | 0] : randomPoint(); tries++; } while (blocked(p.x, p.z, 0.45, av.floor) && tries < 20);
      av.target = new THREE.Vector3(p.x + (Math.random() - 0.5) * 0.4, 0, p.z + (Math.random() - 0.5) * 0.4);
      // al llegar, mira hacia la pantalla más cercana
      av.face = p.z < -3 && p.x < -3 ? Math.PI : p.z < -3 ? Math.PI : p.x > 15 ? Math.PI / 2 : null;
    }
    if (!walking && av.faceTo != null) {
      const d = Math.atan2(Math.sin(av.faceTo - av.group.rotation.y), Math.cos(av.faceTo - av.group.rotation.y));
      av.group.rotation.y += d * Math.min(1, dt * 4);
      if (Math.abs(d) < 0.02) av.faceTo = null;
    }
    animate(av, walking, dt);
  }
  function animate(av, walking, dt) {
    animateAvatar(av, walking, av.speed, dt);
  }

  // charla de fondo
  let nextChat = performance.now() + 3500;
  function npcChatter(now) {
    if (now < nextChat) return;
    nextChat = now + 6000 + Math.random() * 10000;
    const pool = npcs.filter((n) => !n.static && n.floor === fl);
    const n = pool[(Math.random() * pool.length) | 0];
    if (!n) return;
    const line = opts.npcLines[(Math.random() * opts.npcLines.length) | 0];
    say(n, line);
    opts.onChat?.(n, line, dist(n, me));
  }
  const dist = (a, b) => a.group.position.distanceTo(b.group.position);

  // ---------- zonas ----------
  let currentZone = null;
  function updateZone(now, dt) {
    const p = me.group.position;
    let best = null, bd = Infinity;
    for (const z of ZONES_BY[fl]) {
      const d = Math.hypot(p.x - z.x, p.z - z.z);
      if (d < z.r && d < bd) { best = z; bd = d; }
    }
    if (best?.id !== currentZone?.id) {
      currentZone = best;
      if (best?.id === 'tarima') { yaw = 0; pitch = -0.05; me.group.rotation.y = 0; }   // en la tarima miras a la audiencia
      if (best) { zoneRing.position.x = best.x; zoneRing.position.z = best.z; zoneRing.scale.setScalar(best.r); }
      opts.onZone?.(best);
    }
    const o = zoneRing.material.opacity, t = currentZone ? 0.35 + Math.sin(now / 700) * 0.08 : 0;
    zoneRing.material.opacity = o + (t - o) * Math.min(1, dt * 6);
    if (pendingZone && currentZone?.id === pendingZone.id && !me.target) {
      const z = pendingZone; pendingZone = null; opts.onInteract?.(z);
    }
  }

  // ---------- dibujo de pantallas ----------
  const FONT = '"Inter", "Space Grotesk", system-ui, sans-serif';
  const MONO = '"JetBrains Mono", ui-monospace, monospace';
  function bg(ctx, w, h, top = '#15161a', bottom = '#0b0c0e') { const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, top); g.addColorStop(1, bottom); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); }

  let chartState = null;
  function drawWall() {
    const { canvas: c, ctx } = wallScreen; const w = c.width, h = c.height;
    bg(ctx, w, h);
    if (!chartState) { ctx.fillStyle = '#7d8290'; ctx.font = `500 40px ${FONT}`; ctx.fillText('Cargando mercado…', 70, 100); wallScreen.texture.needsUpdate = true; return; }
    const { candles, a, name, tf, price, live, fmt } = chartState;
    const view = candles.slice(-90);
    const padL = 70, padR = 230, padT = 150, padB = 70;
    let hi = Math.max(...view.map((k) => k.high), a.levels.r1), lo = Math.min(...view.map((k) => k.low), a.levels.s1);
    const span = hi - lo; hi += span * 0.06; lo -= span * 0.06;
    const y = (v) => padT + ((hi - v) / (hi - lo)) * (h - padT - padB);
    const cw = (w - padL - padR) / view.length;
    ctx.fillStyle = '#f2efe9'; ctx.font = `600 54px ${FONT}`; ctx.fillText(name, padL, 84);
    ctx.fillStyle = '#7d8290'; ctx.font = `400 30px ${FONT}`; ctx.fillText(`${tf} · ${live ? 'en vivo' : 'simulado'}`, padL, 126);
    const tcol = a.trend === 'alcista' ? UP : a.trend === 'bajista' ? DOWN : GOLD;
    ctx.textAlign = 'right'; ctx.fillStyle = '#f2efe9'; ctx.font = `600 60px ${MONO}`; ctx.fillText(fmt(price), w - 70, 88);
    ctx.font = `500 30px ${FONT}`; ctx.fillStyle = tcol; ctx.fillText(`Tendencia ${a.trend} · RSI ${a.rsi?.toFixed(0) ?? '—'}`, w - 70, 128); ctx.textAlign = 'left';
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) { const yy = padT + (i / 4) * (h - padT - padB); ctx.beginPath(); ctx.moveTo(padL, yy); ctx.lineTo(w - padR, yy); ctx.stroke(); }
    const off = candles.length - view.length;
    const line = (arr, color) => { ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.beginPath(); let s = false; view.forEach((_, i) => { const v = arr[off + i]; if (v == null) return; const xx = padL + i * cw + cw / 2; s ? ctx.lineTo(xx, y(v)) : (ctx.moveTo(xx, y(v)), (s = true)); }); ctx.stroke(); };
    line(a.series.s50, 'rgba(160,180,210,0.55)'); line(a.series.s200, 'rgba(217,191,140,0.55)');
    view.forEach((k, i) => {
      const col = k.close >= k.open ? UP : DOWN; const xx = padL + i * cw + cw / 2;
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(xx, y(k.high)); ctx.lineTo(xx, y(k.low)); ctx.stroke();
      const top = y(Math.max(k.open, k.close)); ctx.fillStyle = col; ctx.fillRect(xx - cw * 0.34, top, cw * 0.68, Math.max(2, y(Math.min(k.open, k.close)) - top));
    });
    const tagAt = (v, label, color, ink = INK) => {
      const yy = y(v); ctx.fillStyle = color; roundRect(ctx, w - padR + 14, yy - 22, padR - 40, 44, 8); ctx.fill();
      ctx.fillStyle = ink; ctx.font = `600 24px ${MONO}`; ctx.fillText(label ? `${label} ${fmt(v)}` : fmt(v), w - padR + 26, yy + 8);
    };
    const lvl = (v, label, color) => { const yy = y(v); ctx.setLineDash([12, 10]); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(padL, yy); ctx.lineTo(w - padR, yy); ctx.stroke(); ctx.setLineDash([]); tagAt(v, label, color); };
    lvl(a.levels.r1, 'R1', DOWN); lvl(a.levels.s1, 'S1', UP);
    const py = y(price); ctx.strokeStyle = 'rgba(217,191,140,0.6)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(padL, py); ctx.lineTo(w - padR, py); ctx.stroke();
    tagAt(price, '', GOLD);
    wallScreen.texture.needsUpdate = true;
  }

  function drawTicker(items) {
    const { canvas: c, ctx } = tickerScreen; const w = c.width, h = c.height;
    ctx.fillStyle = '#0b0c0e'; ctx.fillRect(0, 0, w, h);
    ctx.font = `500 30px ${MONO}`; ctx.textBaseline = 'middle';
    let x = 40;
    for (const it of items) {
      ctx.fillStyle = '#7d8290'; ctx.fillText(it.label, x, h / 2); x += ctx.measureText(it.label).width + 14;
      ctx.fillStyle = '#f2efe9'; ctx.fillText(it.price, x, h / 2); x += ctx.measureText(it.price).width + 14;
      const t = `${it.chg >= 0 ? '+' : ''}${it.chg.toFixed(2)}%`; ctx.fillStyle = it.chg >= 0 ? UP : DOWN; ctx.fillText(t, x, h / 2); x += ctx.measureText(t).width + 70;
    }
    ctx.textBaseline = 'alphabetic'; tickerScreen.texture.needsUpdate = true;
  }

  let slideState = { slide: { title: 'Aula', bullets: ['No hay clase en vivo'] }, index: 0, total: 1, host: '', live: false };
  let screenVideo = null;
  function drawSlide() {
    if (screenVideo) return;
    const { canvas: c, ctx } = aulaScreen; const w = c.width, h = c.height;
    bg(ctx, w, h, '#f4f1ea', '#e9e4da');
    const s = slideState;
    ctx.fillStyle = s.live ? '#c0392b' : '#8a8478'; ctx.font = `600 26px ${FONT}`; ctx.fillText(s.live ? '● EN VIVO' : 'SIN CLASE', 80, 90);
    ctx.fillStyle = '#8a8478'; ctx.font = `400 26px ${FONT}`; ctx.fillText(s.host ? `con ${s.host}` : '', 240, 90);
    ctx.textAlign = 'right'; ctx.fillText(`${s.index + 1} / ${s.total}`, w - 80, 90); ctx.textAlign = 'left';
    ctx.fillStyle = '#1d1c1a'; ctx.font = `600 78px ${FONT}`; ctx.fillText(s.slide.title, 80, 240);
    ctx.fillStyle = '#b8995c'; ctx.fillRect(80, 272, 90, 5);
    ctx.font = `400 44px ${FONT}`;
    s.slide.bullets.forEach((b, i) => { ctx.fillStyle = '#b8995c'; ctx.fillText('—', 80, 380 + i * 84); ctx.fillStyle = '#34322e'; ctx.fillText(b, 140, 380 + i * 84); });
    aulaScreen.texture.needsUpdate = true;
    confScreen.ctx.drawImage(c, 0, 0, confScreen.canvas.width, confScreen.canvas.height); confScreen.texture.needsUpdate = true;
  }

  function drawVideoteca(count) {
    const { canvas: c, ctx } = videoScreen; const w = c.width, h = c.height;
    bg(ctx, w, h, '#1a1917', '#0e0d0c');
    ctx.strokeStyle = GOLD; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(w / 2, h / 2 - 40, 60, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = GOLD; ctx.beginPath(); ctx.moveTo(w / 2 - 16, h / 2 - 72); ctx.lineTo(w / 2 + 30, h / 2 - 40); ctx.lineTo(w / 2 - 16, h / 2 - 8); ctx.fill();
    ctx.textAlign = 'center'; ctx.fillStyle = '#f2efe9'; ctx.font = `600 50px ${FONT}`; ctx.fillText('Videoteca', w / 2, h / 2 + 90);
    ctx.fillStyle = '#7d8290'; ctx.font = `400 28px ${FONT}`; ctx.fillText(`${count} grabaciones`, w / 2, h / 2 + 136); ctx.textAlign = 'left';
    videoScreen.texture.needsUpdate = true;
  }

  function drawKiosk(i, course, done) {
    const s = kiosks[i]; if (!s || !course) return;
    const { canvas: c, ctx } = s; const w = c.width, h = c.height;
    bg(ctx, w, h, '#f4f1ea', '#e9e4da');
    ctx.fillStyle = '#8a8478'; ctx.font = `500 18px ${FONT}`; ctx.fillText(`CURSO · ${course.level.toUpperCase()}`, 22, 40);
    ctx.fillStyle = '#1d1c1a'; ctx.font = `600 32px ${FONT}`; wrap(ctx, course.title, 22, 88, w - 44, 38);
    const pct = done / course.lessons.length;
    ctx.fillStyle = 'rgba(0,0,0,0.08)'; roundRect(ctx, 22, h - 62, w - 44, 10, 5); ctx.fill();
    ctx.fillStyle = '#b8995c'; roundRect(ctx, 22, h - 62, Math.max(10, (w - 44) * pct), 10, 5); ctx.fill();
    ctx.fillStyle = '#8a8478'; ctx.font = `400 18px ${FONT}`; ctx.fillText(`${done} de ${course.lessons.length} lecciones`, 22, h - 24);
    s.texture.needsUpdate = true;
  }

  function drawAgent(u, t) {
    const { canvas: c, ctx } = u.holo; const w = c.width, h = c.height;
    bg(ctx, w, h);
    ctx.fillStyle = u.agent.color; ctx.fillRect(0, 0, 6, h);
    ctx.fillStyle = '#f2efe9'; ctx.font = `600 38px ${FONT}`; ctx.fillText(u.agent.name, 34, 60);
    ctx.fillStyle = '#7d8290'; ctx.font = `400 22px ${FONT}`; ctx.fillText(u.agent.role, 34, 92);
    ctx.fillStyle = u.busy ? GOLD : UP; ctx.beginPath(); ctx.arc(w - 40, 50, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f2efe9'; ctx.font = `500 26px ${FONT}`; ctx.fillText(u.status, 34, 150);
    ctx.fillStyle = '#a7abb5'; ctx.font = `400 21px ${MONO}`; wrap(ctx, u.line, 34, 190, w - 68, 28, 4);
    if (u.busy) { ctx.fillStyle = 'rgba(217,191,140,0.25)'; ctx.fillRect(34, h - 34, w - 68, 6); ctx.fillStyle = GOLD; ctx.fillRect(34, h - 34, ((t / 12) % (w - 68)), 6); }
    u.holo.texture.needsUpdate = true;
  }

  function drawAlertTower(list) {
    const { canvas: c, ctx } = alertScreen; const w = c.width, h = c.height;
    bg(ctx, w, h);
    ctx.fillStyle = GOLD; ctx.font = `600 34px ${FONT}`; ctx.fillText('Alertas', 26, 56);
    ctx.fillStyle = '#7d8290'; ctx.font = `400 20px ${FONT}`; ctx.fillText(`${list.filter((a) => a.active).length} activas`, 26, 88);
    list.slice(0, 6).forEach((a, i) => {
      const yy = 140 + i * 72;
      ctx.fillStyle = a.active ? UP : '#4d505a'; ctx.beginPath(); ctx.arc(34, yy - 6, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e6e3dd'; ctx.font = `400 19px ${FONT}`; wrap(ctx, a.text, 52, yy, w - 74, 24, 2);
    });
    alertScreen.texture.needsUpdate = true;
  }

  function paintMini(s, i) {
    const { canvas: c, ctx } = s; const w = c.width, h = c.height;
    bg(ctx, w, h);
    ctx.strokeStyle = [UP, '#a0b4d2', DOWN][i + 1]; ctx.lineWidth = 3; ctx.beginPath();
    for (let x = 0; x <= w; x += 6) { const yy = h / 2 + Math.sin(x / 26 + i * 2) * h * 0.18 + Math.sin(x / 9) * h * 0.04; x ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); }
    ctx.stroke(); s.texture.needsUpdate = true;
  }

  // ---------- minimapa ----------
  const mctx = minimap?.getContext('2d');
  function drawMinimap() {
    if (!mctx) return;
    const w = minimap.width, h = minimap.height;
    const sx = (x) => ((x + W / 2) / W) * w, sz = (z) => ((z + D / 2) / D) * h;
    mctx.clearRect(0, 0, w, h);
    mctx.fillStyle = 'rgba(20,19,18,0.92)'; roundRect(mctx, 0, 0, w, h, 12); mctx.fill();
    mctx.fillStyle = 'rgba(255,255,255,0.07)';
    for (const o of OB[fl]) { if (o.r) { mctx.beginPath(); mctx.arc(sx(o.cx), sz(o.cz), (o.r / W) * w, 0, Math.PI * 2); mctx.fill(); } else mctx.fillRect(sx(o.x1), sz(o.z1), sx(o.x2) - sx(o.x1), sz(o.z2) - sz(o.z1)); }
    for (const z of ZONES_BY[fl]) {
      if (z.id.startsWith('kiosk')) continue;
      mctx.strokeStyle = currentZone?.id === z.id ? GOLD : 'rgba(217,191,140,0.25)'; mctx.lineWidth = 1.2;
      mctx.beginPath(); mctx.arc(sx(z.x), sz(z.z), (z.r / W) * w, 0, Math.PI * 2); mctx.stroke();
    }
    for (const a of npcs.filter((n) => n.floor === fl)) { mctx.fillStyle = a.color; mctx.beginPath(); mctx.arc(sx(a.group.position.x), sz(a.group.position.z), 3, 0, Math.PI * 2); mctx.fill(); }
    const p = me.group.position;
    mctx.fillStyle = GOLD; mctx.beginPath(); mctx.arc(sx(p.x), sz(p.z), 5, 0, Math.PI * 2); mctx.fill();
    mctx.strokeStyle = '#141312'; mctx.lineWidth = 2; mctx.stroke();
  }
  minimap?.addEventListener('click', (e) => {
    const r = minimap.getBoundingClientRect();
    moveTo(((e.clientX - r.left) / r.width) * W - W / 2, ((e.clientY - r.top) / r.height) * D - D / 2);
  });

  // ---------- bucle ----------
  let lookAhead = 3, baseFov = 40, view = 'tercera', yaw = Math.PI, pitch = 0, azim = 0, tilt = 0.95;
  const VIEWS = ['primera', 'tercera', 'maqueta'];
  const resize = () => {
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setSize(w, h); labels.setSize(w, h);
    camera.aspect = w / h; baseFov = w < 700 ? 52 : 40; camera.fov = view === 'primera' ? 74 : baseFov; camera.updateProjectionMatrix();
    lookAhead = w < 700 ? -1 : 3;
  };
  new ResizeObserver(resize).observe(container);
  resize();

  const clock = new THREE.Clock();
  const camTarget = me.group.position.clone();
  camera.position.copy(me.group.position).add(camOffset);
  let lastMini = 0, lastAgents = 0, running = true;
  function loop() {
    if (!running) return;
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);
    const now = performance.now();
    updateMe(dt);
    for (const n of npcs) if (n.floor === fl) updateNpc(n, dt, now);
    npcChatter(now);
    updateZone(now, dt);
    if (view === 'primera') {
      const px = me.group.position.x, py = me.group.position.y + me.model.height * 0.9, pz = me.group.position.z, cp = Math.cos(pitch);
      camera.position.set(px, py, pz);
      camera.lookAt(px + Math.sin(yaw) * cp, py + Math.sin(pitch), pz + Math.cos(yaw) * cp);
      me.group.rotation.y = yaw;
    } else {
      const maq = view === 'maqueta', k = 1 - Math.exp(-dt * 5);
      const base = maq ? CENTER : me.group.position;
      let ox, oy, oz;
      if (maq) { const R = 40 * zoom, c = Math.cos(tilt); ox = R * c * Math.sin(azim); oy = R * Math.sin(tilt); oz = R * c * Math.cos(azim); }
      else { const d = 12.5 * zoom; ox = d * Math.sin(azim); oy = 12.5 * zoom; oz = d * Math.cos(azim); }
      camera.position.lerp(tmp.set(base.x + ox, base.y + oy, base.z + oz), k);
      camTarget.lerp(base, 1 - Math.exp(-dt * 7));
      const la = maq ? 0 : lookAhead;
      camera.lookAt(camTarget.x - Math.sin(azim) * la, camTarget.y + (maq ? 0 : 1.2), camTarget.z - Math.cos(azim) * la);
    }
    const wantFov = view === 'primera' ? 74 : baseFov;
    if (Math.abs(camera.fov - wantFov) > 0.1) { camera.fov += (wantFov - camera.fov) * Math.min(1, dt * 8); camera.updateProjectionMatrix(); }
    marker.scale.setScalar(1 + Math.sin(now / 160) * 0.1);
    if (now - lastAgents > 150) { lastAgents = now; agentUnits.forEach((u) => drawAgent(u, now)); }
    if (screenVideo) aulaScreen.texture.needsUpdate = true;
    if (now - lastMini > 100) { lastMini = now; drawMinimap(); }
    renderer.render(rscene, camera);
    labels.render(rscene, camera);
  }
  drawWall(); drawSlide(); drawVideoteca(0);
  loop();

  // ---------- pisos y vistas ----------
  const CENTER = new THREE.Vector3(0, 0, 0);
  const floorMats = { wood: M.floor, carpet: M.carpet };
  function setFloor(n) {
    if (n === fl || !FL[n]) return;
    fl = n; me.floor = n;
    for (const k of [1, 2, 3, 4]) FL[k].visible = k === n;
    floor.material = n === 3 ? floorMats.carpet : floorMats.wood;
    for (const a of npcs) { const on = a.floor === n; a.group.visible = on; a.label.visible = on; }
    const sp = SPAWN[n];
    me.group.position.set(sp.x, groundY(n, sp.x, sp.z), sp.z);
    yaw = Math.PI; azim = 0; me.group.rotation.y = Math.PI;
    me.target = null; pendingZone = null; marker.visible = false;
    currentZone = null; zoneRing.material.opacity = 0; opts.onZone?.(null);
    camTarget.copy(me.group.position); camera.position.copy(me.group.position).add(camOffset);
    opts.onFloor?.(n);
  }
  function setView(v) {
    if (!VIEWS.includes(v) || v === view) return;
    view = v;
    const fp = v === 'primera';
    me.model.group.visible = !fp; me.label.visible = !fp;
    if (fp) { yaw = currentZone?.id === 'tarima' ? 0 : me.group.rotation.y; pitch = 0; }
    const maq = v === 'maqueta';                       // maqueta: muros casi transparentes para ver por dentro
    for (const m of [M.wall, M.slats]) { m.transparent = maq; m.opacity = maq ? 0.12 : 1; m.depthWrite = !maq; m.needsUpdate = true; }
    zoom = maq && innerWidth < 900 ? 1.45 : 1; tilt = 0.95;
    camera.fov = fp ? 74 : baseFov; camera.near = fp ? 0.05 : 0.1; camera.updateProjectionMatrix();
    opts.onView?.(v);
  }
  const floorNpcs = () => npcs.filter((n) => n.floor === fl);
  function applause(text = '👏') { floorNpcs().forEach((n, i) => setTimeout(() => say(n, text, 2600), i * 90 + Math.random() * 500)); }

  // ---------- API ----------
  return {
    me, npcs, say, FLOORS, VIEWS, setFloor, setView, floorNpcs, applause, get floor() { return fl; }, get view() { return view; },
    get currentZone() { return currentZone; },
    goToZone(id) { for (const n of [1, 2, 3, 4]) { const z = ZONES_BY[n].find((x) => x.id === id); if (z) { setFloor(n); goToZone(z); return; } } },
    teleport(id) { const z = ZONES_BY[fl].find((x) => x.id === id); if (!z) return; const p = approachPoint(z); me.group.position.set(p.x, 0, p.z); me.target = null; marker.visible = false; },
    nearby(radius = 7) { return npcs.filter((n) => n.floor === fl && dist(n, me) < radius).sort((a, b) => dist(a, me) - dist(b, me)); },
    distanceTo(av) { return dist(av, me); },
    zoneOf(av) { const p = av.group.position; return (ZONES_BY[av.floor] || []).find((z) => Math.hypot(p.x - z.x, p.z - z.z) < z.r) || null; },
    setChart(state) { chartState = state; drawWall(); },
    updatePrice(price) { if (!chartState) return; chartState.price = price; const k = chartState.candles[chartState.candles.length - 1]; k.close = price; k.high = Math.max(k.high, price); k.low = Math.min(k.low, price); drawWall(); },
    setTicker: drawTicker,
    setSlide(s) { slideState = s; drawSlide(); },
    setKiosks(list, progressFn) { list.slice(0, 4).forEach((c, i) => drawKiosk(i, c, progressFn(c))); },
    setVideoteca: drawVideoteca,
    setAlerts: drawAlertTower,
    setAgent(id, patch) { const u = agentUnits.find((x) => x.agent.id === id); if (u) Object.assign(u, patch); },
    setScreenStream(stream) {
      if (stream) {
        const v = document.createElement('video'); v.srcObject = stream; v.muted = true; v.playsInline = true; v.play();
        screenVideo = v; const vt = new THREE.VideoTexture(v); vt.colorSpace = THREE.SRGBColorSpace;
        aulaScreen.mat.map = vt; confScreen.mat.map = vt; aulaScreen.mat.needsUpdate = confScreen.mat.needsUpdate = true;
      } else { screenVideo = null; aulaScreen.mat.map = aulaScreen.texture; confScreen.mat.map = confScreen.texture; aulaScreen.mat.needsUpdate = confScreen.mat.needsUpdate = true; drawSlide(); }
    },
    setMe({ name, color }) { me.name = name; me.el.querySelector('.name').innerHTML = `<i style="background:${color}"></i>${escapeHtml(name)}`; },
    dispose() { running = false; removeEventListener('keydown', onKey); removeEventListener('keyup', onKey); renderer.dispose(); },
  };
}

// ---------- texturas procedurales ----------
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + amt)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
function woodCanvas(base, rows, fine = false, contrast = 26) {
  const c = document.createElement('canvas'); c.width = c.height = 1024; const ctx = c.getContext('2d');
  const ph = 1024 / rows;
  for (let r = 0; r < rows; r++) {
    let x = -Math.random() * 400;
    while (x < 1024) {
      const len = 300 + Math.random() * 420;
      ctx.fillStyle = shade(base, (Math.random() - 0.5) * contrast);
      ctx.fillRect(x, r * ph, len, ph);
      // veta
      for (let g = 0; g < (fine ? 18 : 12); g++) {
        ctx.strokeStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,235,200'},${0.03 + Math.random() * 0.06})`;
        ctx.lineWidth = 0.6 + Math.random() * 1.6;
        const yy = r * ph + Math.random() * ph;
        ctx.beginPath(); ctx.moveTo(x, yy);
        for (let s = 0; s <= len; s += 40) ctx.lineTo(x + s, yy + Math.sin(s / 90 + g) * 2.5);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x + len - 1.5, r * ph, 1.5, ph);
      x += len;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(0, r * ph, 1024, 1.5);
  }
  return c;
}
function slatCanvas(base) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256; const ctx = c.getContext('2d');
  ctx.fillStyle = '#16120f'; ctx.fillRect(0, 0, 512, 256);
  const n = 16, sw = 512 / n;
  for (let i = 0; i < n; i++) {
    const g = ctx.createLinearGradient(i * sw, 0, (i + 1) * sw, 0);
    const col = shade(base, (Math.random() - 0.5) * 14);
    g.addColorStop(0, shade(base, -18)); g.addColorStop(0.2, col); g.addColorStop(0.8, col); g.addColorStop(1, shade(base, -24));
    ctx.fillStyle = g; ctx.fillRect(i * sw + 2, 0, sw - 4, 256);
  }
  return c;
}
function noiseCanvas(base, amp) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const ctx = c.getContext('2d');
  ctx.fillStyle = base; ctx.fillRect(0, 0, 256, 256);
  const img = ctx.getImageData(0, 0, 256, 256);
  for (let i = 0; i < img.data.length; i += 4) { const v = (Math.random() - 0.5) * amp; img.data[i] += v; img.data[i + 1] += v; img.data[i + 2] += v; }
  ctx.putImageData(img, 0, 0);
  return c;
}
function cityCanvas() {
  const c = document.createElement('canvas'); c.width = 2048; c.height = 1024; const ctx = c.getContext('2d');
  const sky = ctx.createLinearGradient(0, 0, 0, 1024);
  sky.addColorStop(0, '#0b1020'); sky.addColorStop(0.55, '#1c2238'); sky.addColorStop(0.85, '#4a3a3a'); sky.addColorStop(1, '#6b4a3a');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, 2048, 1024);
  for (let layer = 0; layer < 3; layer++) {
    let x = 0;
    while (x < 2048) {
      const bw = 60 + Math.random() * 160, bh = 200 + Math.random() * (520 - layer * 120) + layer * 60;
      const top = 1024 - bh;
      ctx.fillStyle = ['#151a28', '#10141f', '#0b0e16'][layer]; ctx.fillRect(x, top, bw, bh);
      for (let wy = top + 14; wy < 1010; wy += 22) for (let wx = x + 8; wx < x + bw - 8; wx += 16) {
        if (Math.random() < 0.28 - layer * 0.05) { ctx.fillStyle = `rgba(255,${200 + (Math.random() * 40) | 0},${130 + (Math.random() * 60) | 0},${0.5 + Math.random() * 0.4})`; ctx.fillRect(wx, wy, 7, 10); }
      }
      x += bw + 6 + Math.random() * 20;
    }
  }
  return c;
}
function rugCanvas() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 732; const ctx = c.getContext('2d');
  ctx.fillStyle = '#4a4038'; ctx.fillRect(0, 0, c.width, c.height);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < img.data.length; i += 4) { const v = (Math.random() - 0.5) * 16; img.data[i] += v; img.data[i + 1] += v; img.data[i + 2] += v; }
  ctx.putImageData(img, 0, 0);
  ctx.strokeStyle = 'rgba(217,191,140,0.55)'; ctx.lineWidth = 6; ctx.strokeRect(40, 40, c.width - 80, c.height - 80);
  ctx.lineWidth = 2; ctx.strokeRect(62, 62, c.width - 124, c.height - 124);
  return c;
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function wrap(ctx, text, x, y, maxW, lh, maxLines = 2) {
  const words = String(text).split(' '); let line = '', n = 0;
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && line) { ctx.fillText(line, x, y + n * lh); line = w; n++; if (n >= maxLines) return; }
    else line = t;
  }
  if (line && n < maxLines) ctx.fillText(line, x, y + n * lh);
}
export function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// ---------- lienzos para la decoración ----------
function booksCanvas() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 512; const k = c.getContext('2d');
  k.fillStyle = '#2a1f17'; k.fillRect(0, 0, 512, 512);
  const pal = ['#6b3a2a', '#2f4a6f', '#8a6b3a', '#3d5a45', '#7a2f3a', '#c9b68a', '#4a4458', '#a8774a', '#d9bf8c'];
  for (let r = 0; r < 5; r++) {
    const y0 = r * 102 + 8; let x = 8;
    while (x < 500) { const w = 12 + Math.random() * 18, h = 62 + Math.random() * 28; k.fillStyle = pal[(Math.random() * pal.length) | 0]; k.fillRect(x, y0 + 90 - h, w, h); k.fillStyle = 'rgba(255,255,255,0.12)'; k.fillRect(x + 2, y0 + 90 - h + 6, 2, h - 12); x += w + 1; }
    k.fillStyle = '#4a3122'; k.fillRect(0, y0 + 90, 512, 12);
  }
  return c;
}
function bannerCanvas() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 640; const k = c.getContext('2d');
  k.fillStyle = '#16140f'; k.fillRect(0, 0, 256, 640); k.strokeStyle = '#d9bf8c'; k.lineWidth = 6; k.strokeRect(12, 12, 232, 616);
  k.fillStyle = '#d9bf8c'; k.beginPath(); k.arc(128, 170, 50, 0, 7); k.fill(); k.strokeStyle = '#16140f'; k.lineWidth = 8; k.beginPath(); k.moveTo(92, 180); k.lineTo(116, 180); k.lineTo(128, 148); k.lineTo(142, 198); k.lineTo(154, 172); k.lineTo(166, 172); k.stroke();
  k.fillStyle = '#f3e3bf'; k.textAlign = 'center'; k.font = 'italic 500 54px Fraunces, Georgia, serif'; k.fillText('Pulso', 128, 340); k.font = '500 26px Inter, sans-serif'; k.fillText('CONFERENCIA', 128, 390); k.fillStyle = '#8a8478'; k.fillText('Trading en vivo', 128, 440);
  return c;
}
