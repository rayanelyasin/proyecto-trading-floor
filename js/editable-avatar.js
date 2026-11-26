import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

const directory = new URL('../assets/editable/', import.meta.url);
const pending = new Map();
const models = new Map();

function load(file) {
  if (!pending.has(file)) {
    pending.set(file, new GLTFLoader().loadAsync(new URL(file, directory).href).then((model) => {
      models.set(file, model);
      return model;
    }).catch((error) => {
      pending.delete(file);
      throw error;
    }));
  }
  return pending.get(file);
}

export const EDITABLE_DEFAULT = {
  kind: 'editable', shape: 0, height: 1, age: 0, weight: 0, muscle: 0,
  nose: 0, eyes: 0, jaw: 0, lips: 0, skin: '#ffffff', eyeColor: '#80583c',
  hair: 'short02', hairTint: '#513925', top: 'tshirt', bottom: 'jeans', shoes: 'shoes',
  topColor: '#7e9eb6', bottomColor: '#52627a', shoeColor: '#454448',
};

export const HAIR = [
  ['none', 'Rapado'], ['short02', 'Corto'], ['short04', 'Corto liso'],
  ['bob01', 'Media melena'], ['bob02', 'Bob'], ['long01', 'Largo'],
  ['ponytail01', 'Coleta'], ['braid01', 'Trenza'], ['afro01', 'Afro'],
];

export const BODY_CONTROLS = [
  ['shape', 'Forma corporal', -1, 1], ['height', 'Altura', 0.88, 1.12],
  ['age', 'Edad adulta', 0, 1], ['weight', 'Peso', -1, 1], ['muscle', 'Musculatura', -1, 1],
];

export const FACE_CONTROLS = [
  ['nose', 'Anchura de nariz', -1, 1], ['eyes', 'Tamaño de ojos', -1, 1],
  ['jaw', 'Anchura de mandíbula', -1, 1], ['lips', 'Volumen de labios', -1, 1],
  ['noseLength', 'Largo de nariz', -1, 1], ['eyeSpacing', 'Separación de ojos', -1, 1],
  ['chin', 'Mentón', -1, 1], ['cheeks', 'Pómulos', -1, 1],
];

const tintKeys = ['skin', 'eyeColor', 'hairTint', 'topColor', 'bottomColor', 'shoeColor'];

export function normalizeEditable(config) {
  const c = { ...EDITABLE_DEFAULT, ...config };
  for (const [key, , min, max] of [...BODY_CONTROLS, ...FACE_CONTROLS]) {
    c[key] = THREE.MathUtils.clamp(Number.isFinite(c[key]) ? c[key] : EDITABLE_DEFAULT[key] ?? 0, min, max);
  }
  for (const key of tintKeys) {
    if (!/^#[a-f0-9]{6}$/i.test(c[key])) c[key] = EDITABLE_DEFAULT[key];
  }
  if (!HAIR.some(([id]) => id === c.hair)) c.hair = EDITABLE_DEFAULT.hair;
  return c;
}

const pairs = {
  shape: ['gender_female', 'gender_male'], weight: ['weight_min', 'weight_max'],
  muscle: ['muscle_min', 'muscle_max'], nose: ['face_nose_width_decr', 'face_nose_width_incr'],
  eyes: ['face_eye_size_decr', 'face_eye_size_incr'], jaw: ['face_jaw_width_decr', 'face_jaw_width_incr'],
  lips: ['face_lips_decr', 'face_lips_incr'], noseLength: ['face_nose_length_decr', 'face_nose_length_incr'],
  eyeSpacing: ['face_eye_spacing_decr', 'face_eye_spacing_incr'], chin: ['face_chin_decr', 'face_chin_incr'],
  cheeks: ['face_cheekbones_decr', 'face_cheekbones_incr'],
};

export function updateEditableAvatar(avatar, config) {
  const c = normalizeEditable(config);
  avatar.config = c;
  avatar.group.scale.setScalar(c.height);
  avatar.height = 1.67 * c.height;
  const weights = { age_old: c.age * 0.8 };
  for (const [key, [low, high]] of Object.entries(pairs)) {
    const factor = key === 'shape' ? 0.65 : 0.8;
    weights[low] = Math.max(0, -c[key]) * factor;
    weights[high] = Math.max(0, c[key]) * factor;
  }
  for (const mesh of avatar.meshes) {
    for (const [name, i] of Object.entries(mesh.morphTargetDictionary ?? {})) {
      if (name.startsWith('corr_')) {
        const [a, b] = name.slice(5).split('__');
        mesh.morphTargetInfluences[i] = (weights[a] ?? 0) * (weights[b] ?? 0);
      } else {
        mesh.morphTargetInfluences[i] = weights[name] ?? 0;
      }
    }
    const material = mesh.material;
    if (material.name === 'Skin') material.color.copy(material.userData.baseColor).multiply(new THREE.Color(c.skin));
    if (material.name === 'Iris') material.color.set(c.eyeColor);
    if (material.name.startsWith('Hair_')) material.color.set(c.hairTint);
  }
}

const garment = (id) => `clothing_${id}.glb`;
const filesFor = (c) => [garment(c.top), ...(c.top === 'dress' ? [] : [garment(c.bottom)]), garment(c.shoes)];

export function loadEditableAvatar(config) {
  const c = normalizeEditable(config);
  return Promise.all(['body.glb', ...filesFor(c), ...(c.hair === 'none' ? [] : [`hair_${c.hair}.glb`])].map(load));
}

function meshWithin(root) {
  let mesh;
  root.traverse((object) => { if (object.isSkinnedMesh) mesh = object; });
  return mesh;
}

function addPiece(body, file) {
  const source = meshWithin(models.get(file).scene);
  const mesh = source.clone();
  const bones = new Map(body.skeleton.bones.map((bone) => [bone.name, bone]));
  mesh.bind(new THREE.Skeleton(
    source.skeleton.bones.map((bone) => bones.get(bone.name)),
    source.skeleton.boneInverses,
  ), source.bindMatrix);
  body.parent.add(mesh);
  return mesh;
}

const COVERAGE = { tshirt: 8, jeans: 2, shoes: 1 };
const maskedBodies = new Map();

function coverBody(body, config) {
  const mask = COVERAGE[config.top] | COVERAGE[config.bottom] | COVERAGE[config.shoes];
  if (!maskedBodies.has(mask)) {
    const source = body.geometry;
    const zone = source.getAttribute('_cczone');
    const index = source.index;
    const visible = [];
    for (let i = 0; i < index.count; i += 3) {
      const a = index.getX(i), b = index.getX(i + 1), c = index.getX(i + 2);
      if ((zone.getX(a) & zone.getX(b) & zone.getX(c) & mask) === 0) visible.push(a, b, c);
    }
    const geometry = new THREE.BufferGeometry();
    for (const [name, attribute] of Object.entries(source.attributes)) geometry.setAttribute(name, attribute);
    geometry.morphAttributes = source.morphAttributes;
    geometry.morphTargetsRelative = source.morphTargetsRelative;
    geometry.setIndex(visible);
    maskedBodies.set(mask, geometry);
  }
  body.geometry = maskedBodies.get(mask);
}

function aim(root, from, to, direction) {
  const bone = root.getObjectByName(from);
  const joint = root.getObjectByName(to);
  const start = bone.getWorldPosition(new THREE.Vector3());
  const axis = joint.getWorldPosition(new THREE.Vector3()).sub(start).normalize();
  const turn = new THREE.Quaternion().setFromUnitVectors(axis, new THREE.Vector3(...direction).normalize());
  const parent = bone.parent.getWorldQuaternion(new THREE.Quaternion());
  bone.quaternion.premultiply(parent.clone().invert().multiply(turn).multiply(parent));
  root.updateMatrixWorld(true);
}

function socialClip(template, name, seated, talking) {
  const root = clone(template);
  const bones = meshWithin(root).skeleton.bones;
  const rest = bones.map((bone) => ({ rotation: bone.quaternion.clone(), position: bone.position.clone() }));
  const times = [0, 0.5, 1, 1.5, 2];
  const rotationFrames = bones.map(() => []);
  const pelvisFrames = [];
  for (let frame = 0; frame < times.length; frame++) {
    bones.forEach((bone, i) => {
      bone.quaternion.copy(rest[i].rotation);
      bone.position.copy(rest[i].position);
    });
    root.updateMatrixWorld(true);
    const pelvis = root.getObjectByName('pelvis');
    if (seated) {
      const origin = pelvis.getWorldPosition(new THREE.Vector3());
      origin.y = 0.51;
      pelvis.position.copy(pelvis.parent.worldToLocal(origin));
      for (const side of ['l', 'r']) {
        const sign = side === 'l' ? 1 : -1;
        aim(root, `thigh_${side}`, `calf_${side}`, [sign * 0.10, -0.12, 1]);
        aim(root, `calf_${side}`, `foot_${side}`, [0, -1, 0.10]);
        aim(root, `foot_${side}`, `ball_${side}`, [0, -0.50, 1]);
      }
    }
    for (const side of ['l', 'r']) {
      const sign = side === 'l' ? 1 : -1;
      aim(root, `upperarm_${side}`, `lowerarm_${side}`, [sign * 0.16, -1, 0.08]);
      const lift = talking ? [0, 0.65, 0.12, 0.53, 0][frame] : 0;
      aim(root, `lowerarm_${side}`, `hand_${side}`, [sign * 0.13, (seated ? -0.23 : -1) + lift, seated ? 1 : 0.25 + lift]);
    }
    bones.forEach((bone, i) => rotationFrames[i].push(...bone.quaternion.toArray()));
    pelvisFrames.push(...pelvis.position.toArray());
  }
  const tracks = bones.map((bone, i) => new THREE.QuaternionKeyframeTrack(`${bone.name}.quaternion`, times, rotationFrames[i]));
  tracks.push(new THREE.VectorKeyframeTrack('pelvis.position', times, pelvisFrames));
  return new THREE.AnimationClip(name, 2, tracks);
}

let social;
export function buildEditableAvatar(config) {
  const c = normalizeEditable(config);
  const asset = models.get('body.glb');
  const root = clone(asset.scene);
  const body = root.getObjectByName('Body');
  coverBody(body, c);
  for (const file of filesFor(c)) addPiece(body, file);
  if (c.hair !== 'none') addPiece(body, `hair_${c.hair}.glb`);
  const meshes = [];
  root.traverse((object) => {
    if (!object.isMesh) return;
    object.material = object.material.clone();
    object.material.userData.baseColor = object.material.color.clone();
    meshes.push(object);
    object.morphTargetInfluences?.fill(0);
    object.castShadow = true;
    object.frustumCulled = false;
  });

  social ??= [
    socialClip(asset.scene, 'sit', true, false),
    socialClip(asset.scene, 'talk', false, true),
    socialClip(asset.scene, 'sittalk', true, true),
  ];
  const mixer = new THREE.AnimationMixer(root);
  const actions = {};
  for (const clip of [...asset.animations, ...social]) {
    const action = mixer.clipAction(clip).play();
    action.setEffectiveWeight(clip.name === 'idle' ? 1 : 0);
    actions[clip.name] = action;
  }
  mixer.update(0);
  const group = new THREE.Group();
  group.add(root);
  const avatar = { group, root, mixer, actions, meshes };
  updateEditableAvatar(avatar, c);
  return avatar;
}
