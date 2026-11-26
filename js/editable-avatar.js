import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

const directory = new URL('../assets/editable/', import.meta.url);
const pending = new Map();
const models = new Map();
let jointsRequest;
let jointMorphs;

function loadJointMorphs() {
  jointsRequest ??= fetch(new URL('base_body.joints.json', directory))
    .then((response) => {
      if (!response.ok) throw new Error('No se pudieron cargar los ajustes del esqueleto.');
      return response.json();
    })
    .then(({ morphs }) => { jointMorphs = morphs; })
    .catch((error) => {
      jointsRequest = undefined;
      throw error;
    });
  return jointsRequest;
}

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

export const TOPS = [
  ['tshirt', 'Camiseta'], ['shirt', 'Camisa'], ['hoodie', 'Sudadera'], ['dress', 'Vestido'],
];
export const BOTTOMS = [['jeans', 'Pantalón'], ['shorts', 'Short'], ['skirt', 'Falda']];
export const SHOES = [['shoes', 'Zapatos'], ['boots', 'Botines']];
const clothingOptions = { top: TOPS, bottom: BOTTOMS, shoes: SHOES };

export const BODY_CONTROLS = [
  ['shape', 'Forma corporal', -1, 1], ['height', 'Altura', 0.88, 1.12],
  ['age', 'Edad adulta', 0, 1], ['weight', 'Peso', -1, 1], ['muscle', 'Musculatura', -1, 1],
  ['proportions', 'Proporciones', -1, 1],
];

export const FACE_GROUPS = [
  ['structure', 'Estructura', [
    ['jaw', 'Anchura de mandíbula', -1, 1], ['chin', 'Mentón', -1, 1],
    ['cheeks', 'Pómulos', -1, 1], ['forehead', 'Frente', -1, 1],
    ['ears', 'Tamaño de orejas', -1, 1],
  ]],
  ['eyes', 'Ojos', [
    ['eyes', 'Tamaño de ojos', -1, 1], ['eyeSpacing', 'Separación de ojos', -1, 1],
    ['eyeTilt', 'Inclinación de ojos', -1, 1],
  ]],
  ['nose', 'Nariz', [
    ['nose', 'Anchura de nariz', -1, 1], ['noseLength', 'Largo de nariz', -1, 1],
    ['noseHeight', 'Altura de nariz', -1, 1],
  ]],
  ['mouth', 'Boca', [
    ['lips', 'Volumen de labios', -1, 1], ['mouthWidth', 'Anchura de boca', -1, 1],
  ]],
];
export const FACE_CONTROLS = FACE_GROUPS.flatMap(([, , controls]) => controls);

const tintKeys = ['skin', 'eyeColor', 'hairTint', 'topColor', 'bottomColor', 'shoeColor'];

export function normalizeEditable(config) {
  const c = { ...EDITABLE_DEFAULT, ...config, kind: 'editable' };
  for (const [key, , min, max] of [...BODY_CONTROLS, ...FACE_CONTROLS]) {
    c[key] = THREE.MathUtils.clamp(Number.isFinite(c[key]) ? c[key] : EDITABLE_DEFAULT[key] ?? 0, min, max);
  }
  for (const key of tintKeys) {
    if (!/^#[a-f0-9]{6}$/i.test(c[key])) c[key] = EDITABLE_DEFAULT[key];
  }
  if (!HAIR.some(([id]) => id === c.hair)) c.hair = EDITABLE_DEFAULT.hair;
  for (const [slot, options] of Object.entries(clothingOptions)) {
    if (!options.some(([id]) => id === c[slot])) c[slot] = EDITABLE_DEFAULT[slot];
  }
  return c;
}

const pairs = {
  shape: ['gender_female', 'gender_male'], weight: ['weight_min', 'weight_max'],
  muscle: ['muscle_min', 'muscle_max'], nose: ['face_nose_width_decr', 'face_nose_width_incr'],
  eyes: ['face_eye_size_decr', 'face_eye_size_incr'], jaw: ['face_jaw_width_decr', 'face_jaw_width_incr'],
  lips: ['face_lips_decr', 'face_lips_incr'], noseLength: ['face_nose_length_decr', 'face_nose_length_incr'],
  eyeSpacing: ['face_eye_spacing_decr', 'face_eye_spacing_incr'], chin: ['face_chin_decr', 'face_chin_incr'],
  cheeks: ['face_cheekbones_decr', 'face_cheekbones_incr'],
  proportions: ['proportions_uncommon', 'proportions_ideal'],
  forehead: ['face_forehead_decr', 'face_forehead_incr'],
  ears: ['face_ear_size_decr', 'face_ear_size_incr'],
  eyeTilt: ['face_eye_tilt_decr', 'face_eye_tilt_incr'],
  noseHeight: ['face_nose_height_decr', 'face_nose_height_incr'],
  mouthWidth: ['face_mouth_width_decr', 'face_mouth_width_incr'],
};

export function updateEditableAvatar(avatar, config) {
  const c = normalizeEditable(config);
  avatar.config = c;
  const height = (c.height - 1) / 0.12;
  const weights = {
    age_old: c.age * 0.8,
    height_short: Math.max(0, -height) * 0.8,
    height_tall: Math.max(0, height) * 0.8,
  };
  for (const [key, [low, high]] of Object.entries(pairs)) {
    const factor = key === 'shape' ? 0.65 : key === 'proportions' ? 0.55 : 0.8;
    weights[low] = Math.max(0, -c[key]) * factor;
    weights[high] = Math.max(0, c[key]) * factor;
  }
  for (const name of Object.keys(jointMorphs)) {
    if (!name.startsWith('corr_')) continue;
    const [a, b] = name.slice(5).split('__');
    weights[name] = (weights[a] ?? 0) * (weights[b] ?? 0);
  }
  const headOffset = updateJointOffsets(avatar, weights);
  avatar.height = 1.67 + headOffset;
  for (const mesh of avatar.meshes) {
    for (const [name, i] of Object.entries(mesh.morphTargetDictionary ?? {})) {
      const [a, b] = name.startsWith('corr_') ? name.slice(5).split('__') : [];
      mesh.morphTargetInfluences[i] = a ? (weights[a] ?? 0) * (weights[b] ?? 0) : weights[name] ?? 0;
    }
    const material = mesh.material;
    if (material.name === 'Skin') material.color.copy(material.userData.baseColor).multiply(new THREE.Color(c.skin));
    if (material.name === 'Iris') material.color.set(c.eyeColor);
    if (material.name.startsWith('Hair_')) material.color.set(c.hairTint);
    const slotColor = mesh.userData.pulsoColor;
    if (slotColor) material.color.set(c[slotColor]);
  }
}

const garment = (id) => `clothing_${id}.glb`;
const filesFor = (c) => [garment(c.top), ...(c.top === 'dress' ? [] : [garment(c.bottom)]), garment(c.shoes)];

export function loadEditableAvatar(config) {
  const c = normalizeEditable(config);
  const files = ['body.glb', ...filesFor(c)];
  if (c.hair !== 'none') files.push(`hair_${c.hair}.glb`);
  return Promise.all([loadJointMorphs(), ...files.map(load)]);
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

// Bits de las zonas de la malla CC0, según el catálogo publicado por CharacterCreator.
const COVERAGE = {
  shoes: 1, jeans: 2, skirt: 4, tshirt: 8, shorts: 256,
  shirt: 512, hoodie: 1024, dress: 2048, boots: 8192,
};
const maskedBodies = new Map();

function coverBody(body, config) {
  const mask = COVERAGE[config.top] | COVERAGE[config.shoes]
    | (config.top === 'dress' ? 0 : COVERAGE[config.bottom]);
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

function updateJointOffsets(avatar, weights) {
  const worldOffsets = new Map();
  const delta = new THREE.Vector3();
  for (const [name, weight] of Object.entries(weights)) {
    if (!weight) continue;
    for (const [bone, offset] of Object.entries(jointMorphs[name] ?? {})) {
      if (!worldOffsets.has(bone)) worldOffsets.set(bone, new THREE.Vector3());
      worldOffsets.get(bone).addScaledVector(delta.fromArray(offset), weight);
    }
  }
  const zero = new THREE.Vector3();
  const translation = new THREE.Matrix4();
  for (const joint of avatar.joints) {
    const { bone, offset, parentInverseRotation } = joint;
    const world = worldOffsets.get(bone.name) ?? zero;
    const parent = worldOffsets.get(bone.parent.name) ?? zero;
    bone.position.sub(offset);
    offset.copy(world).sub(parent).applyQuaternion(parentInverseRotation);
    bone.position.add(offset);
  }
  for (const { skeleton, rest } of avatar.skins) {
    skeleton.bones.forEach((bone, i) => {
      const { x, y, z } = worldOffsets.get(bone.name) ?? zero;
      skeleton.boneInverses[i].copy(rest[i]).multiply(translation.makeTranslation(-x, -y, -z));
    });
  }
  return worldOffsets.get('head')?.y ?? 0;
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
  addPiece(body, garment(c.top)).userData.pulsoColor = 'topColor';
  if (c.top !== 'dress') addPiece(body, garment(c.bottom)).userData.pulsoColor = 'bottomColor';
  addPiece(body, garment(c.shoes)).userData.pulsoColor = 'shoeColor';
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
  const template = new Map(asset.scene.getObjectByName('Body').skeleton.bones.map((bone) => [bone.name, bone]));
  const joints = body.skeleton.bones.map((bone) => ({
    bone,
    offset: new THREE.Vector3(),
    parentInverseRotation: template.get(bone.name).parent.getWorldQuaternion(new THREE.Quaternion()).invert(),
  }));
  const skeletons = new Set(meshes.filter((mesh) => mesh.isSkinnedMesh).map((mesh) => mesh.skeleton));
  const skins = [...skeletons].map((skeleton) => {
    const rest = skeleton.boneInverses;
    skeleton.boneInverses = rest.map((matrix) => matrix.clone());
    return { skeleton, rest };
  });
  mixer.update(0);
  const group = new THREE.Group();
  group.add(root);
  const eyelids = meshes.flatMap((mesh) => ['blink_left', 'blink_right']
    .map((name) => mesh.morphTargetDictionary?.[name])
    .filter((index) => index !== undefined)
    .map((index) => [mesh.morphTargetInfluences, index]));
  let nextBlink = 1.8 + Math.random() * 3;
  const avatar = { group, root, mixer, actions, meshes, joints, skins,
    updateAnimation(dt) {
      for (const { bone, offset } of joints) bone.position.sub(offset);
      mixer.update(dt);
      for (const { bone, offset } of joints) bone.position.add(offset);
      nextBlink -= dt;
      if (nextBlink < -0.18) nextBlink = 2.3 + Math.random() * 3.2;
      const blink = nextBlink < 0 ? Math.sin(-nextBlink / 0.18 * Math.PI) : 0;
      for (const [influences, index] of eyelids) influences[index] = blink;
    },
  };
  updateEditableAvatar(avatar, c);
  return avatar;
}
