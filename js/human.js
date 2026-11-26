// Personas realistas: avatares Microsoft Rocketbox (licencia MIT) con ropa y rostros reales,
// animaciones de captura de movimiento (caminar, correr, sentarse, hablar) y ajustes en tiempo real.
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { buildEditableAvatar } from './editable-avatar.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

export const MODELS = {
  f: ['Female_Adult_01', 'Female_Adult_02', 'Female_Adult_03', 'Female_Adult_05', 'Female_Adult_08', 'Female_Adult_11', 'Female_Adult_12', 'Female_Adult_15', 'Female_Adult_17', 'Female_Party_02'],
  m: ['Male_Adult_01', 'Male_Adult_02', 'Male_Adult_03', 'Male_Adult_04', 'Male_Adult_06', 'Male_Adult_08', 'Male_Adult_09', 'Male_Adult_10', 'Male_Adult_12', 'Male_Adult_14', 'Male_Adult_17', 'Male_Adult_18'],
};
const ALL = [...MODELS.f, ...MODELS.m];

export const OPTIONS = {
  gender: [['f', 'Mujer'], ['m', 'Hombre']],
  skin: ['#ffffff', '#f1d6c0', '#dcb08a', '#b98b66', '#8c6244'],
  hairTint: ['#ffffff', '#2a2522', '#5a3b22', '#8a5a2b', '#b4442d', '#d8c08a', '#9aa0a6', '#6a4c9c'],
  accessory: [['none', 'Ninguno'], ['glasses', 'Gafas'], ['cap', 'Gorra'], ['both', 'Gafas y gorra']],
};
export const DEFAULT_AVATAR = { gender: 'f', model: 'Female_Adult_01', height: 1, build: 1, skin: '#ffffff', hairTint: '#ffffff', accessory: 'none', topColor: '#d9bf8c' };

function normalize(c0) {
  const c = { ...DEFAULT_AVATAR, ...c0 };
  if (c.model?.startsWith('Male')) c.gender = 'm'; else if (c.model?.startsWith('Female')) c.gender = 'f';
  if (c.gender !== 'm') c.gender = 'f';
  if (!MODELS[c.gender].includes(c.model)) c.model = MODELS[c.gender][0];
  if (!['none', 'glasses', 'cap', 'both'].includes(c.accessory)) c.accessory = 'none';
  return c;
}
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const mulberry = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
export function randomAvatar(seed) {
  const rng = typeof seed === 'string' ? mulberry([...seed].reduce((a, c) => a * 31 + c.charCodeAt(0), 7)) : Math.random;
  const gender = rng() < 0.5 ? 'f' : 'm';
  return { gender, model: pick(rng, MODELS[gender]), height: 0.96 + rng() * 0.08, build: 0.96 + rng() * 0.08, skin: '#ffffff', hairTint: '#ffffff', accessory: rng() < 0.82 ? 'none' : pick(rng, ['glasses', 'cap', 'both']), topColor: pick(rng, ['#d9bf8c', '#6f8fb3', '#c47b5a', '#6f9a7f', '#a8677a', '#8a82a8']) };
}

// ---------- carga (una sola vez) ----------
const CLIPFILE = { idle: 'idle_breathe_01', talk: 'gestic_talk_neutral_01', sit: 'sit_chair_breathe_01', sittalk: 'sit_chair_gestic_shrug_01', walk: 'walk_neutral_01', run: 'run_neutral_01' };
const DATA = { fbx: {}, tex: {}, clips: { f: {}, m: {} }, h: {}, ready: null };
const fbxLoader = () => { const m = new THREE.LoadingManager(); m.addHandler(/\.tga$/i, { setPath() {}, setCrossOrigin() {}, load: () => new THREE.Texture() }); return new FBXLoader(m); };
const loadFbx = (url) => new Promise((res, rej) => fbxLoader().load(url, res, undefined, rej));
const loadTex = (url) => new Promise((res, rej) => new THREE.TextureLoader().load(url, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; res(t); }, undefined, rej));

// Quita el avance horizontal de la cadera para que caminen "en el lugar" (el movimiento lo da el mundo).
function inPlace(clip) {
  const t = clip.tracks.find((x) => x.name === 'Bip01.position'); if (!t) return;
  const v = t.values; for (let i = 0; i < v.length; i += 3) { v[i] = v[0]; v[i + 2] = v[2]; }
}

export function preloadAvatars() {
  DATA.ready ||= (async () => {
    const jobs = [];
    for (const g of ['f', 'm']) for (const [k, f] of Object.entries(CLIPFILE)) {
      jobs.push(loadFbx(`assets/rb/anim/${g}_${f}.max.fbx`).then((o) => { const c = o.animations[0].clone(); c.name = k; if (k === 'walk' || k === 'run') inPlace(c); DATA.clips[g][k] = c; }));
    }
    for (const n of ALL) {
      jobs.push(loadFbx(`assets/rb/avatars/${n}.fbx`).then((o) => { DATA.fbx[n] = o; const b = new THREE.Box3().setFromObject(o); DATA.h[n] = b.max.y * 0.01; }));
      for (const [k, ext] of [['body', 'jpg'], ['head', 'jpg'], ['opacity', 'png']]) jobs.push(loadTex(`assets/rb/avatars/${n}_${k}.${ext}`).then((t) => { DATA.tex[`${n}_${k}`] = t; }).catch(() => {}));
    }
    await Promise.all(jobs);
  })();
  return DATA.ready;
}

// ---------- construir una persona ----------
export function buildAvatar(cfg0) {
  if (cfg0?.kind === 'editable') return buildEditableAvatar(cfg0);
  const c = normalize(cfg0);
  const root = SkeletonUtils.clone(DATA.fbx[c.model]);
  let head, mesh;
  root.traverse((o) => { if (o.isSkinnedMesh) mesh = o; if (o.isBone && o.name === 'Bip01_Head') head = o; });
  mesh.castShadow = true; mesh.frustumCulled = false;
  const old = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  mesh.material = old.map((m) => {
    const kind = m.name.split('_').pop(), op = kind === 'opacity';
    const nm = new THREE.MeshStandardMaterial({ map: DATA.tex[`${c.model}_${kind}`], roughness: op ? 0.85 : 0.62, metalness: 0, name: m.name });
    if (op) { nm.transparent = true; nm.alphaTest = 0.4; nm.depthWrite = true; nm.side = THREE.DoubleSide; nm.color.set(c.hairTint); } else nm.color.set(c.skin);
    return nm;
  });
  root.updateMatrixWorld(true);

  // accesorios en el hueso de la cabeza (medidas en cm del modelo original)
  const P = root.worldToLocal(head.getWorldPosition(new THREE.Vector3()));
  const toHead = (obj) => { root.add(obj); root.updateMatrixWorld(true); head.attach(obj); };
  if (c.accessory === 'glasses' || c.accessory === 'both') {
    const gm = new THREE.MeshStandardMaterial({ color: 0x16181b, roughness: 0.3, metalness: 0.6 }), g = new THREE.Group();
    for (const s of [-1, 1]) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(2.7, 0.28, 8, 28), gm); r.position.set(P.x + s * 3.3, P.y + GL.y, P.z + GL.z); g.add(r);
      const a = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 9), gm); a.position.set(P.x + s * 6.1, P.y + GL.y, P.z + GL.z - 4.5); g.add(a);
    }
    const br = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.3, 0.3), gm); br.position.set(P.x, P.y + GL.y + 0.5, P.z + GL.z); g.add(br);
    toHead(g);
  }
  if (c.accessory === 'cap' || c.accessory === 'both') {
    const cm = new THREE.MeshStandardMaterial({ color: c.topColor, roughness: 0.8 }), g = new THREE.Group();
    const dome = new THREE.Mesh(new THREE.SphereGeometry(CAP.r, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), cm); dome.position.set(P.x, P.y + CAP.y, P.z + CAP.z); dome.scale.set(1, 0.95, 1.1); dome.castShadow = true; g.add(dome);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(14, 0.5, 8), cm); visor.position.set(P.x, P.y + CAP.y + 5.2, P.z + CAP.z + CAP.r + 2); visor.rotation.x = 0.12; g.add(visor);
    toHead(g);
  }

  // animaciones
  const mixer = new THREE.AnimationMixer(root), actions = {};
  for (const [k, clip] of Object.entries(DATA.clips[c.gender])) { const a = mixer.clipAction(clip); a.play(); a.setEffectiveWeight(k === 'idle' ? 1 : 0); actions[k] = a; }
  mixer.update(Math.random() * 2);

  const group = new THREE.Group(); group.add(root); root.rotation.y = FRONT_ROT;
  group.scale.set(0.01 * c.build, 0.01 * c.height, 0.01 * c.build);
  return { group, root, mixer, actions, config: c, height: (DATA.h[c.model] || 1.75) * c.height };
}
const FRONT_ROT = 0;                              // giro para que el frente mire a +Z
const GL = { y: 8, z: 9.5 };                      // posición de las gafas respecto al hueso de la cabeza
const CAP = { r: 11.5, y: 10, z: 0 };             // posición de la gorra

export function animateAvatar(av, walking, speed, dt) {
  const m = av.model; if (!m?.mixer) return;
  const talking = performance.now() < (av.talkUntil || 0);
  const want = av.seated ? (talking ? 'sittalk' : 'sit') : walking ? (speed >= 3 ? 'run' : 'walk') : (talking ? 'talk' : 'idle');
  for (const [k, a] of Object.entries(m.actions)) { const w = a.getEffectiveWeight(), t = k === want ? 1 : 0; a.setEffectiveWeight(w + (t - w) * Math.min(1, dt * 8)); }
  if (m.actions.walk) m.actions.walk.timeScale = THREE.MathUtils.clamp(speed / 1.4, 0.7, 1.5);
  if (m.actions.run) m.actions.run.timeScale = THREE.MathUtils.clamp(speed / 3.6, 0.8, 1.4);
  m.mixer.update(dt);
}
