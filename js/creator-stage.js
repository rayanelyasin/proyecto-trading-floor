import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { animateAvatar } from './human.js';

function studioLights(scene) {
  scene.add(new THREE.HemisphereLight(0xfff6e9, 0x403a34, 1.04));
  const key = new THREE.DirectionalLight(0xffead6, 2.65);
  key.position.set(-2.8, 4, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(512, 512);
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.012;
  Object.assign(key.shadow.camera, { left: -1.65, right: 1.65, top: 2, bottom: -1.6, far: 12 });
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xe0e9f0, 1.05);
  fill.position.set(3, 2, 2.5);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffdfad, 2.05);
  rim.position.set(0.5, 3, -2);
  scene.add(rim);
}

function makePlatform() {
  const platform = new THREE.Group();
  const surface = new THREE.MeshStandardMaterial({ color: 0x2a2927, roughness: 0.76 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x776143, roughness: 0.44, metalness: 0.65 });
  for (const [radius, base, depth, y, material] of [
    [0.89, 0.93, 0.074, -0.037, surface],
    [0.916, 0.928, 0.014, -0.06, metal],
    [0.93, 0.89, 0.032, -0.09, surface],
  ]) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, base, depth, 80), material);
    mesh.position.y = y;
    mesh.receiveShadow = true;
    platform.add(mesh);
  }
  return platform;
}

function makeStool() {
  const stool = new THREE.Group();
  const leather = new THREE.MeshStandardMaterial({ color: 0x302e2b, roughness: 0.92 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x6c5843, roughness: 0.45, metalness: 0.55 });
  for (const [radius, base, depth, y, material] of [
    [0.22, 0.21, 0.048, 0.45, leather],
    [0.037, 0.049, 0.39, 0.215, metal],
    [0.16, 0.20, 0.038, 0.019, metal],
  ]) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, base, depth, 36), material);
    mesh.position.y = y;
    mesh.castShadow = true;
    stool.add(mesh);
  }
  stool.position.z = -0.08;
  return stool;
}

function releaseAvatar(model) {
  model.mixer.stopAllAction();
  model.mixer.uncacheRoot(model.root);
  const materials = new Set();
  const skeletons = new Set();
  model.root.traverse((object) => {
    if (!object.isMesh) return;
    if (object.isSkinnedMesh) skeletons.add(object.skeleton);
    else object.geometry.dispose();
    for (const material of [object.material].flat()) materials.add(material);
  });
  for (const skeleton of skeletons) skeleton.dispose();
  for (const material of materials) material.dispose();
}

function disposeProps(group) {
  const materials = new Set();
  group.traverse((mesh) => {
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    materials.add(mesh.material);
  });
  for (const material of materials) material.dispose();
}

export function createAvatarStage(canvas, onFailure) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.06);
  scene.environment = environment.texture;
  room.dispose();
  pmrem.dispose();
  studioLights(scene);

  const platform = makePlatform();
  const holder = new THREE.Group();
  const stool = makeStool();
  holder.add(stool);
  scene.add(platform, holder);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.06, 20);
  const actor = { model: null, seated: false, talkUntil: 0 };
  const headPosition = new THREE.Vector3();
  let head = null;
  let frame = 'full';
  let pose = 'idle';
  let yaw = -0.24;
  let zoom = 1;
  let drag = null;
  let raf = 0;
  let last = performance.now();
  let lastShadow = -Infinity;
  let needsSnap = true;

  stool.visible = false;
  function replace(model) {
    if (actor.model) {
      holder.remove(actor.model.group);
      releaseAvatar(actor.model);
    }
    actor.model = model;
    head = model.root.getObjectByName('head') ?? model.root.getObjectByName('Bip01_Head');
    holder.add(model.group);
    needsSnap = true;
    lastShadow = -Infinity;
  }

  function setFrame(value) {
    if (frame === value) return;
    frame = value;
    zoom = 1;
  }

  function rotate(direction) { yaw += direction * Math.PI / 8; }
  function magnify(amount) { zoom = THREE.MathUtils.clamp(zoom * (1 + amount), 0.69, 1.58); }
  function reset() { yaw = -0.24; zoom = 1; }
  function setPose(value) {
    pose = value;
    actor.seated = value === 'sit';
    stool.visible = actor.seated;
  }

  canvas.addEventListener('pointerdown', (event) => {
    if (drag || event.button !== 0) return;
    drag = { pointer: event.pointerId, x: event.clientX };
    canvas.setPointerCapture(event.pointerId);
    canvas.classList.add('is-dragging');
  });
  canvas.addEventListener('pointermove', (event) => {
    if (drag?.pointer !== event.pointerId) return;
    yaw += (event.clientX - drag.x) * 0.012;
    drag.x = event.clientX;
  });
  canvas.addEventListener('lostpointercapture', () => {
    drag = null;
    canvas.classList.remove('is-dragging');
  });
  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    magnify(Math.sign(event.deltaY) * 0.09);
  }, { passive: false });
  canvas.addEventListener('keydown', (event) => {
    const commands = {
      ArrowLeft: () => rotate(-1), ArrowRight: () => rotate(1),
      '+': () => magnify(-0.10), '-': () => magnify(0.11), Home: reset,
    };
    const command = commands[event.key];
    if (!command) return;
    event.preventDefault();
    event.stopPropagation();
    command();
  });

  function contextLost(event) {
    event.preventDefault();
    cancelAnimationFrame(raf);
    onFailure();
  }
  canvas.addEventListener('webglcontextlost', contextLost);

  let focus = 0.87;
  let distance = 3.75;
  function loop(time) {
    raf = requestAnimationFrame(loop);
    if (time - last < 31) return;
    const dt = Math.min((time - last) / 1000, 0.06);
    last = time;
    const { clientWidth: width, clientHeight: height } = canvas;
    if (!width || !height) return;
    const pixelRatio = renderer.getPixelRatio();
    if (canvas.width !== Math.floor(width * pixelRatio) || canvas.height !== Math.floor(height * pixelRatio)) {
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }

    holder.rotation.y = yaw;
    const isWalking = pose === 'walk' || pose === 'run';
    actor.talkUntil = pose === 'talk' ? time + 100 : 0;
    animateAvatar(actor, isWalking, pose === 'run' ? 3.6 : 1.4, dt);
    const modelHeight = actor.model?.height ?? 1.67;
    const faceY = head ? head.getWorldPosition(headPosition).y + 0.062 : modelHeight * 0.92;
    const targetFocus = frame === 'face' ? faceY : (actor.seated ? faceY * 0.51 : modelHeight * 0.468);
    const compact = width < 390;
    const targetDistance = (frame === 'face' ? (compact ? 0.77 : 0.66)
      : (actor.seated ? 3.03 : modelHeight * (compact ? 2.77 : 2.44))) * zoom;
    const smoothing = needsSnap ? 1 : 1 - Math.exp(-11 * dt);
    needsSnap = false;
    focus = THREE.MathUtils.lerp(focus, targetFocus, smoothing);
    distance = THREE.MathUtils.lerp(distance, targetDistance, smoothing);
    camera.position.set(0, focus + (frame === 'face' ? 0.018 : 0.24), distance);
    camera.lookAt(0, focus, 0);
    if (frame === 'full' && time - lastShadow >= 100) {
      renderer.shadowMap.needsUpdate = true;
      lastShadow = time;
    }
    renderer.render(scene, camera);
  }
  raf = requestAnimationFrame(loop);

  return {
    replace, setFrame, rotate, magnify, reset, setPose,
    get model() { return actor.model; },
    dispose() {
      cancelAnimationFrame(raf);
      if (actor.model) releaseAvatar(actor.model);
      disposeProps(platform);
      disposeProps(stool);
      environment.dispose();
      canvas.removeEventListener('webglcontextlost', contextLost);
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
