// Solano Nights — pedestrians: sidewalk wanderers who stroll, chat, panic and
// flee from gunfire, plus the angry drivers a carjacking leaves behind.
import * as THREE from 'three';
import { TRAFFIC, WORLD } from './config.js';
import { clamp, pick, range } from './random.js';
import { collideCircle, onRoad } from './city.js';
import { makePersonMesh } from './render.js';

const SHIRTS = [0xe8e8e8, 0xc23b2e, 0x2e6fc2, 0x4a9e5c, 0xe8c33a, 0xd96a1e, 0x7a4a9e, 0x3a3f45];
const PANTS = [0x2e3440, 0x5a4632, 0x3a5a7a, 0x6b6b6b];

export function spawnPed(world, scene, rng, x, z, angry = false) {
  const mesh = makePersonMesh(pick(rng, SHIRTS), pick(rng, PANTS));
  mesh.position.set(x, 0, z);
  scene.add(mesh);
  const ped = {
    x, z, heading: rng() * Math.PI * 2, speed: range(rng, 1.2, 2.2),
    mesh, state: angry ? 'angry' : 'walk', panic: angry ? 6 : 0,
    targetX: x, targetZ: z, retarget: 0, hp: 30, dead: false,
    phase: rng() * 6,
  };
  world.peds.push(ped);
  return ped;
}

export function spawnPeds(world, scene, rng, count) {
  for (let i = 0; i < count; i += 1) {
    // Sidewalk spots: just inside a block edge, never on a road.
    const bx = (Math.floor(rng() * 7) - 3) * 52;
    const bz = (Math.floor(rng() * 7) - 3) * 52;
    const x = bx + range(rng, -13, 13);
    const z = bz + range(rng, -13, 13);
    if (onRoad(x, z)) continue;
    spawnPed(world, scene, rng, x, z);
  }
}

function pickTarget(ped, rng) {
  // A new nearby sidewalk spot to stroll toward.
  const a = rng() * Math.PI * 2;
  const d = range(rng, 8, 26);
  ped.targetX = clamp(ped.x + Math.cos(a) * d, -WORLD.half, WORLD.half);
  ped.targetZ = clamp(ped.z + Math.sin(a) * d, -WORLD.half, WORLD.seaZ - 4);
  ped.retarget = range(rng, 4, 9);
}

export function updatePeds(world, dt, rng) {
  const p = world.player;
  const gunfire = world.gunfireTimer > 0;
  for (const ped of world.peds) {
    if (ped.dead) continue;
    const dp = Math.hypot(ped.x - p.x, ped.z - p.z);
    if (gunfire && dp < 40) ped.panic = Math.max(ped.panic, 4);
    if (ped.state === 'angry') {
      // An angry driver yells at the player, then gives up and walks off.
      ped.panic -= dt;
      if (ped.panic <= 0) ped.state = 'walk';
      ped.heading += dt * 0.5;
    } else if (ped.panic > 0) {
      ped.panic -= dt;
      // Flee away from the player.
      const a = Math.atan2(ped.x - p.x, ped.z - p.z);
      ped.heading = a;
      ped.speed = 5.5;
      ped.x += Math.sin(a) * ped.speed * dt;
      ped.z += Math.cos(a) * ped.speed * dt;
      if (ped.panic <= 0) ped.state = 'walk';
    } else {
      ped.retarget -= dt;
      const dx = ped.targetX - ped.x, dz = ped.targetZ - ped.z;
      const d = Math.hypot(dx, dz);
      if (d < 1 || ped.retarget <= 0) pickTarget(ped, rng);
      else {
        const want = Math.atan2(dx, dz);
        let diff = want - ped.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        ped.heading += clamp(diff, -2.4 * dt, 2.4 * dt);
        ped.x += Math.sin(ped.heading) * ped.speed * dt;
        ped.z += Math.cos(ped.heading) * ped.speed * dt;
      }
    }
    const fixed = collideCircle(ped.x, ped.z, 0.5, world.colliders);
    ped.x = clamp(fixed.x, -WORLD.half, WORLD.half);
    ped.z = clamp(fixed.z, -WORLD.half, WORLD.seaZ - 3);
    // Walk-cycle legs.
    ped.phase += dt * (ped.state === 'walk' ? ped.speed * 2.4 : 8);
    const swing = Math.sin(ped.phase) * 0.5;
    const u = ped.mesh.userData;
    u.legL.rotation.x = swing;
    u.legR.rotation.x = -swing;
    u.armL.rotation.x = -swing * 0.7;
    u.armR.rotation.x = swing * 0.7;
    ped.mesh.position.set(ped.x, 0, ped.z);
    ped.mesh.rotation.y = ped.heading;
  }
}

// A ped hit by a car or a bullet: falls over, fades out, counts as a crime.
export function killPed(world, ped, cause) {
  if (ped.dead) return;
  ped.dead = true;
  ped.mesh.rotation.x = -Math.PI / 2;
  ped.mesh.position.y = 0.4;
  world.addWanted(cause === 'shot' ? 1 : 1, cause === 'shot' ? 'shooting' : 'hit-and-run');
  world.stats.crimes += 1;
  setTimeout(() => {
    ped.mesh.visible = false;
  }, 4000);
}
