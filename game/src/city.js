// Solano Nights — Port Solano: a sun-soaked coastal grid city built from boxes,
// canvas window textures, palms, lamps and a marina. Everything here is original:
// no borrowed map, no borrowed names.
import * as THREE from 'three';
import { CITY, WORLD, PLACES } from './config.js';
import { pick, range, int } from './random.js';

const PALETTE = [0xe8b48a, 0xd9a06b, 0xc98f5f, 0xb7c4c9, 0x9fb4c0, 0xe3d5b8, 0xd17a6b, 0x8fa98f, 0xf0e6d2];
const ROOFS = [0x7a6a58, 0x5d6b73, 0x8a5f4d, 0x6b7a5e];

function windowTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#e8dcc8'; g.fillRect(0, 0, 128, 256);
  for (let y = 12; y < 244; y += 28) {
    for (let x = 10; x < 118; x += 28) {
      g.fillStyle = Math.random() > 0.5 ? '#2e4a63' : '#7fb2d9';
      g.fillRect(x, y, 18, 20);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function roadCentres() {
  const list = [];
  for (let i = 0; i <= CITY.blocks; i += 1) list.push(-WORLD.half + i * CITY.block);
  return list;
}

// Nearest road centre line to a point, and which axis it runs along.
export function nearestRoad(x, z) {
  const centres = roadCentres();
  let best = { axis: 'x', line: centres[0], d: Infinity };
  for (const c of centres) {
    const dx = Math.abs(x - c);
    if (dx < best.d) best = { axis: 'z', line: c, d: dx }; // road running along z (constant x)
    const dz = Math.abs(z - c);
    if (dz < best.d) best = { axis: 'x', line: c, d: dz }; // road running along x (constant z)
  }
  return best;
}

export function onRoad(x, z) {
  return nearestRoad(x, z).d <= CITY.road / 2;
}

// Push a circle out of every building AABB it overlaps.
export function collideCircle(x, z, r, colliders) {
  let nx = x, nz = z;
  for (const b of colliders) {
    const cx = Math.max(b.x - b.hw, Math.min(nx, b.x + b.hw));
    const cz = Math.max(b.z - b.hd, Math.min(nz, b.z + b.hd));
    const dx = nx - cx, dz = nz - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        nx = cx + (dx / d) * r;
        nz = cz + (dz / d) * r;
      } else {
        // centre inside the box: shove out along the smallest penetration axis
        const px = b.hw + r - Math.abs(nx - b.x);
        const pz = b.hd + r - Math.abs(nz - b.z);
        if (px < pz) nx = b.x + (nx >= b.x ? b.hw + r : -(b.hw + r));
        else nz = b.z + (nz >= b.z ? b.hd + r : -(b.hd + r));
      }
    }
  }
  return { x: nx, z: nz };
}

export function buildCity(scene, rng) {
  const colliders = [];
  const centres = roadCentres();
  const winTex = windowTexture();
  const mats = PALETTE.map((c) => new THREE.MeshLambertMaterial({ color: c, map: winTex }));
  const roofMats = ROOFS.map((c) => new THREE.MeshLambertMaterial({ color: c }));
  const group = new THREE.Group();
  group.name = 'city';

  // Ground: sand-grass base, then dark road strips, then pale sidewalk slabs.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 560),
    new THREE.MeshLambertMaterial({ color: 0x9aa578 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, 20);
  ground.receiveShadow = true;
  group.add(ground);

  const roadMat = new THREE.MeshLambertMaterial({ color: 0x4b5158 });
  const walkMat = new THREE.MeshLambertMaterial({ color: 0xb9b3a4 });
  for (const c of centres) {
    for (const [w, l, x, z] of [
      [CITY.road, WORLD.half * 2 + CITY.road, c, 0],
      [WORLD.half * 2 + CITY.road, CITY.road, 0, c],
    ]) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(w, l), roadMat);
      road.rotation.x = -Math.PI / 2;
      road.position.set(x, 0, z);
      road.receiveShadow = true;
      group.add(road);
    }
  }
  // Sidewalk slabs: one per block, roads stay visible between them.
  const walkGeo = new THREE.PlaneGeometry(CITY.block - CITY.road, CITY.block - CITY.road);
  for (let i = 0; i < CITY.blocks; i += 1) {
    for (let j = 0; j < CITY.blocks; j += 1) {
      const slab = new THREE.Mesh(walkGeo, walkMat);
      slab.rotation.x = -Math.PI / 2;
      slab.position.set(-WORLD.half + (i + 0.5) * CITY.block, 0.02, -WORLD.half + (j + 0.5) * CITY.block);
      slab.receiveShadow = true;
      group.add(slab);
    }
  }
  // Centre dashes along every road.
  const dashGeo = new THREE.BoxGeometry(0.5, 0.06, 3);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xe8e4d0 });
  const dashes = [];
  for (const c of centres) {
    for (let t = -WORLD.half; t <= WORLD.half; t += 9) {
      dashes.push([c, t, 0]);
      dashes.push([t, c, 1]);
    }
  }
  const dashMesh = new THREE.InstancedMesh(dashGeo, dashMat, dashes.length);
  const m4 = new THREE.Matrix4();
  dashes.forEach(([x, z, rot], i) => {
    m4.makeRotationY(rot * Math.PI / 2);
    m4.setPosition(x, 0.05, z);
    dashMesh.setMatrixAt(i, m4);
  });
  group.add(dashMesh);

  // Buildings: 1–2 per block, varied heights, window texture, roof cap.
  // The plaza block (3,3) stays open; the marina block (5,6) holds the docks.
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  for (let i = 0; i < CITY.blocks; i += 1) {
    for (let j = 0; j < CITY.blocks; j += 1) {
      const bx = -WORLD.half + (i + 0.5) * CITY.block;
      const bz = -WORLD.half + (j + 0.5) * CITY.block;
      if (i === 3 && j === 3) continue; // plaza
      if (i === 5 && j === 6) continue; // marina
      const count = rng() < 0.55 ? 1 : 2;
      for (let k = 0; k < count; k += 1) {
        const w = range(rng, 12, count === 1 ? 26 : 13);
        const d = range(rng, 12, count === 1 ? 26 : 13);
        const h = range(rng, 9, int(rng, 18, 48));
        const ox = count === 1 ? 0 : (k === 0 ? -7 : 7);
        const oz = count === 1 ? 0 : (k === 0 ? 6 : -6);
        const x = bx + ox, z = bz + oz;
        const mat = pick(rng, mats);
        const b = new THREE.Mesh(boxGeo, mat);
        b.scale.set(w, h, d);
        b.position.set(x, h / 2, z);
        b.castShadow = true;
        b.receiveShadow = true;
        group.add(b);
        const roof = new THREE.Mesh(boxGeo, pick(rng, roofMats));
        roof.scale.set(w + 0.6, 0.8, d + 0.6);
        roof.position.set(x, h + 0.4, z);
        group.add(roof);
        colliders.push({ x, z, hw: w / 2, hd: d / 2, h });
        // A few rooftop AC boxes for skyline variety.
        if (rng() < 0.5) {
          const ac = new THREE.Mesh(boxGeo, roofMats[0]);
          ac.scale.set(2, 1.2, 2);
          ac.position.set(x + w * 0.2, h + 1.4, z - d * 0.2);
          group.add(ac);
        }
      }
    }
  }

  // Plaza: fountain + benches in the open central block.
  const basin = new THREE.Mesh(
    new THREE.CylinderGeometry(6, 6.5, 1.2, 24),
    new THREE.MeshLambertMaterial({ color: 0xcfc8b8 }),
  );
  basin.position.set(0, 0.6, 0);
  basin.castShadow = true;
  group.add(basin);
  const water = new THREE.Mesh(
    new THREE.CylinderGeometry(5.4, 5.4, 0.3, 24),
    new THREE.MeshLambertMaterial({ color: 0x4fb3d9 }),
  );
  water.position.set(0, 1.1, 0);
  group.add(water);
  const spire = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.8, 4, 10),
    new THREE.MeshLambertMaterial({ color: 0xe8e0cc }),
  );
  spire.position.set(0, 3, 0);
  group.add(spire);

  // Marina: wooden pier + moored boats at the south edge.
  const pier = new THREE.Mesh(
    new THREE.BoxGeometry(18, 1, 26),
    new THREE.MeshLambertMaterial({ color: 0x8a6b48 }),
  );
  pier.position.set(PLACES.marina.x, 0.5, PLACES.marina.z + 18);
  pier.castShadow = true;
  group.add(pier);
  const boatMat = new THREE.MeshLambertMaterial({ color: 0xf2f2ee });
  const boatMat2 = new THREE.MeshLambertMaterial({ color: 0xd96a4a });
  for (let k = 0; k < 3; k += 1) {
    const boat = new THREE.Mesh(new THREE.BoxGeometry(4, 1.4, 9), k % 2 ? boatMat2 : boatMat);
    boat.position.set(PLACES.marina.x - 12 + k * 12, 0.4, PLACES.marina.z + 30);
    group.add(boat);
  }

  // The sea beyond the shoreline.
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 90),
    new THREE.MeshLambertMaterial({ color: 0x2f7fb8 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0.05, WORLD.seaZ + 45);
  group.add(sea);
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 16),
    new THREE.MeshLambertMaterial({ color: 0xe3cf9e }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.03, WORLD.seaZ - 8);
  group.add(sand);

  // Palms along the sidewalks and the beach.
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.35, 5, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5a38 });
  const leafGeo = new THREE.SphereGeometry(1.9, 8, 6);
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f8f4f });
  const palmSpots = [];
  for (let i = 0; i < CITY.blocks; i += 1) {
    for (let j = 0; j < CITY.blocks; j += 1) {
      if (rng() < 0.6) {
        palmSpots.push([
          -WORLD.half + (i + 0.5) * CITY.block + range(rng, -12, 12),
          -WORLD.half + (j + 0.5) * CITY.block + range(rng, -12, 12),
        ]);
      }
    }
  }
  for (let k = 0; k < 14; k += 1) palmSpots.push([range(rng, -170, 170), WORLD.seaZ - range(rng, 2, 12)]);
  const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, palmSpots.length);
  const leafMesh = new THREE.InstancedMesh(leafGeo, leafMat, palmSpots.length);
  palmSpots.forEach(([x, z], idx) => {
    m4.identity();
    m4.setPosition(x, 2.5, z);
    trunkMesh.setMatrixAt(idx, m4);
    m4.makeScale(1.4, 0.7, 1.4);
    m4.setPosition(x, 5.6, z);
    leafMesh.setMatrixAt(idx, m4);
  });
  trunkMesh.castShadow = true;
  group.add(trunkMesh);
  group.add(leafMesh);

  // Street lamps at every other intersection, glowing warm at dusk.
  const lampGeo = new THREE.CylinderGeometry(0.12, 0.16, 7, 6);
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x44484e });
  const bulbGeo = new THREE.SphereGeometry(0.5, 8, 6);
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  const lamps = [];
  for (let i = 0; i <= CITY.blocks; i += 1) {
    for (let j = 0; j <= CITY.blocks; j += 1) {
      if ((i + j) % 2 === 0) lamps.push([centres[i] + 8, centres[j] + 8]);
    }
  }
  const lampMesh = new THREE.InstancedMesh(lampGeo, lampMat, lamps.length);
  const bulbMesh = new THREE.InstancedMesh(bulbGeo, bulbMat, lamps.length);
  lamps.forEach(([x, z], idx) => {
    m4.identity(); m4.setPosition(x, 3.5, z); lampMesh.setMatrixAt(idx, m4);
    m4.identity(); m4.setPosition(x, 7.1, z); bulbMesh.setMatrixAt(idx, m4);
  });
  group.add(lampMesh);
  group.add(bulbMesh);

  scene.add(group);
  return { colliders, centres };
}
