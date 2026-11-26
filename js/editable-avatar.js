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
  hair: 'none', hairTint: '#513925', top: 'tshirt', bottom: 'jeans', shoes: 'shoes',
  topColor: '#7e9eb6', bottomColor: '#52627a', shoeColor: '#454448',
};

const garment = (id) => `clothing_${id}.glb`;
const filesFor = (c) => [garment(c.top), ...(c.top === 'dress' ? [] : [garment(c.bottom)]), garment(c.shoes)];

export function loadEditableAvatar(config) {
  const c = { ...EDITABLE_DEFAULT, ...config };
  return Promise.all(['body.glb', ...filesFor(c)].map(load));
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
  const c = { ...EDITABLE_DEFAULT, ...config };
  const asset = models.get('body.glb');
  const root = clone(asset.scene);
  const body = root.getObjectByName('Body');
  coverBody(body, c);
  for (const file of filesFor(c)) addPiece(body, file);
  root.traverse((object) => {
    if (!object.isMesh) return;
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
  group.scale.setScalar(c.height);
  return { group, root, mixer, actions, config: c, height: 1.67 * c.height };
}
