// Solano Nights — the three.js scene: renderer, golden-hour sun, sky, chase
// camera, mesh factories for cars and people, and a tiny particle system.
import * as THREE from 'three';
import { WORLD } from './config.js';
import { clamp, lerp } from './random.js';

const CAR_COLORS = [0xc23b2e, 0x2e6fc2, 0xe8c33a, 0x3a3f45, 0xe8e8e8, 0x4a9e5c, 0xd96a1e, 0x7a4a9e];

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87b5d9);
  scene.fog = new THREE.Fog(0x9fc3dd, 120, 420);

  const sun = new THREE.DirectionalLight(0xffd9a0, 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -220;
  sun.shadow.camera.right = 220;
  sun.shadow.camera.top = 220;
  sun.shadow.camera.bottom = -220;
  sun.shadow.camera.far = 600;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbfd9ee, 0x8a7a5e, 0.9));
  const ambient = new THREE.AmbientLight(0xffe8c8, 0.25);
  scene.add(ambient);

  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 900);
  camera.position.set(0, 12, 18);

  // Particles: one InstancedMesh of small glowing boxes, recycled.
  const PMAX = 240;
  const pGeo = new THREE.BoxGeometry(0.28, 0.28, 0.28);
  const pMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const pMesh = new THREE.InstancedMesh(pGeo, pMat, PMAX);
  pMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  pMesh.count = 0;
  pMesh.frustumCulled = false;
  scene.add(pMesh);
  const parts = [];
  for (let i = 0; i < PMAX; i += 1) parts.push({ life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r: 0, g: 0, b: 0 });

  const api = {
    renderer, scene, camera, sun,
    resize(w, h) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },
    // Golden late afternoon at 16:36, sliding toward dusk as the clock runs.
    setTimeOfDay(hours) {
      const t = clamp((hours - 16) / 5, 0, 1); // 0 = afternoon, 1 = dusk
      const elev = lerp(0.9, 0.18, t);
      const azim = lerp(0.7, 1.35, t);
      sun.position.set(Math.cos(azim) * 220 * Math.cos(elev), Math.sin(elev) * 220, Math.sin(azim) * 220 * Math.cos(elev));
      sun.intensity = lerp(2.6, 1.4, t);
      sun.color.setHSL(0.09, lerp(0.55, 0.75, t), lerp(0.75, 0.6, t));
      scene.background.setHSL(0.58, lerp(0.45, 0.6, t), lerp(0.72, 0.42, t));
      scene.fog.color.copy(scene.background);
      ambient.intensity = lerp(0.25, 0.12, t);
    },
    burst(x, y, z, color, n = 12, speed = 6) {
      const c = new THREE.Color(color);
      let placed = 0;
      for (const p of parts) {
        if (p.life > 0) continue;
        p.life = 0.5 + Math.random() * 0.4;
        p.x = x; p.y = y; p.z = z;
        const a = Math.random() * Math.PI * 2;
        const s = speed * (0.4 + Math.random() * 0.8);
        p.vx = Math.cos(a) * s; p.vz = Math.sin(a) * s; p.vy = 2 + Math.random() * 5;
        p.r = c.r; p.g = c.g; p.b = c.b;
        if (++placed >= n) break;
      }
    },
    updateParticles(dt) {
      const m = new THREE.Matrix4();
      const col = new THREE.Color();
      let count = 0;
      for (const p of parts) {
        if (p.life <= 0) continue;
        p.life -= dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        p.vy -= 14 * dt;
        if (p.y < 0.1) { p.y = 0.1; p.vy *= -0.3; }
        const s = 0.6 + p.life;
        m.makeScale(s, s, s);
        m.setPosition(p.x, p.y, p.z);
        pMesh.setMatrixAt(count, m);
        col.setRGB(p.r, p.g, p.b);
        pMesh.setColorAt(count, col);
        count += 1;
      }
      pMesh.count = count;
      pMesh.instanceMatrix.needsUpdate = true;
      if (pMesh.instanceColor) pMesh.instanceColor.needsUpdate = true;
    },
  };
  return api;
}

// A low-poly car: body, cabin, four wheels, headlights. `police` adds a light bar.
export function makeCarMesh(color, police = false) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), bodyMat);
  body.position.y = 0.62;
  body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.1), new THREE.MeshLambertMaterial({ color: 0x1c2733 }));
  cabin.position.set(0, 1.18, -0.25);
  cabin.castShadow = true;
  g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14161a });
  const wheels = [];
  for (const [x, z] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.38, z);
    g.add(w);
    wheels.push(w);
  }
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const x of [-0.65, 0.65]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.16, 0.1), lightMat);
    h.position.set(x, 0.62, 2.22);
    g.add(h);
  }
  if (police) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.4), new THREE.MeshBasicMaterial({ color: 0x2233ff }));
    bar.position.set(0, 1.55, -0.25);
    g.add(bar);
    g.userData.lightBar = bar;
    g.userData.blink = 0;
  }
  g.userData.wheels = wheels;
  return g;
}

export function randomCarColor(rng) {
  return CAR_COLORS[Math.floor(rng() * CAR_COLORS.length)];
}

// A low-poly person: torso, head, legs that swing while walking.
export function makePersonMesh(shirt, pants, skin = 0xd9a077) {
  const g = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.75, 0.34), new THREE.MeshLambertMaterial({ color: shirt }));
  torso.position.y = 1.08;
  torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), new THREE.MeshLambertMaterial({ color: skin }));
  head.position.y = 1.66;
  head.castShadow = true;
  g.add(head);
  const legMat = new THREE.MeshLambertMaterial({ color: pants });
  const legGeo = new THREE.BoxGeometry(0.22, 0.7, 0.22);
  const legL = new THREE.Mesh(legGeo, legMat);
  legL.position.set(-0.16, 0.35, 0);
  const legR = new THREE.Mesh(legGeo, legMat);
  legR.position.set(0.16, 0.35, 0);
  g.add(legL);
  g.add(legR);
  const armMat = new THREE.MeshLambertMaterial({ color: shirt });
  const armGeo = new THREE.BoxGeometry(0.16, 0.6, 0.16);
  const armL = new THREE.Mesh(armGeo, armMat);
  armL.position.set(-0.4, 1.1, 0);
  const armR = new THREE.Mesh(armGeo, armMat);
  armR.position.set(0.4, 1.1, 0);
  g.add(armL);
  g.add(armR);
  g.userData = { legL, legR, armL, armR, walkPhase: Math.random() * 6 };
  return g;
}

// The mission waypoint: a glowing beacon column and a floating diamond.
export function makeBeacon() {
  const g = new THREE.Group();
  const col = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 30, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
  );
  col.position.y = 15;
  g.add(col);
  const dia = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.9),
    new THREE.MeshBasicMaterial({ color: 0xffd23a }),
  );
  dia.position.y = 6;
  g.add(dia);
  g.userData.diamond = dia;
  g.visible = false;
  return g;
}
