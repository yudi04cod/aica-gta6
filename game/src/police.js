// Solano Nights — the wanted system and the police who enforce it. Stars rise
// with crime, police cars chase and ram, officers on foot try to arrest you,
// and the heat fades when you stay out of sight and out of trouble.
import * as THREE from 'three';
import { POLICE, WORLD, PLACES, PLAYER } from './config.js';
import { clamp, range } from './random.js';
import { collideCircle } from './city.js';
import { makeCarMesh, makePersonMesh } from './render.js';

export function addWanted(world, stars, reason) {
  if (world.player.wanted >= 5) return;
  world.player.wanted = clamp(world.player.wanted + stars, 0, 5);
  world.wantedTimer = 0; // reset the decay clock on every new crime
  world.lastCrime = reason;
  world.flashWanted = 1;
  if (world.player.wanted >= 1) world.audio.sirenBlip();
}

export function spawnPoliceCar(world, scene, rng) {
  const p = world.player;
  const a = rng() * Math.PI * 2;
  const x = clamp(p.x + Math.cos(a) * POLICE.spawnDist, -WORLD.half, WORLD.half);
  const z = clamp(p.z + Math.sin(a) * POLICE.spawnDist, -WORLD.half, WORLD.seaZ - 4);
  const mesh = makeCarMesh(0x1c2733, true);
  // White doors read as a police car at a glance.
  const door = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.4, 1.6), new THREE.MeshLambertMaterial({ color: 0xf2f2ee }));
  door.position.y = 0.62;
  mesh.add(door);
  mesh.position.set(x, 0, z);
  scene.add(mesh);
  const car = {
    x, z, heading: Math.atan2(p.x - x, p.z - z), speed: 0,
    mesh, police: true, traffic: false, driver: true, wrecked: false, steer: 0,
  };
  world.cops.push(car);
  world.cars.push(car);
  return car;
}

export function spawnOfficer(world, scene, rng, x, z) {
  const mesh = makePersonMesh(0x1c2733, 0x1c2733, 0xc9a06a);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.5), new THREE.MeshLambertMaterial({ color: 0x11151c }));
  cap.position.y = 1.86;
  mesh.add(cap);
  mesh.position.set(x, 0, z);
  scene.add(mesh);
  const off = { x, z, heading: 0, speed: 0, mesh, officer: true, bustTimer: 0, hp: 50, dead: false, phase: 0 };
  world.officers.push(off);
  return off;
}

// Keep the pursuit sized to the wanted level; fade the heat when laying low.
export function updateWanted(world, dt, scene, rng) {
  const p = world.player;
  world.wantedTimer += dt;
  const wantedCars = world.cops.filter((c) => !c.wrecked).length;
  const wantCars = p.wanted === 0 ? 0 : Math.min(POLICE.maxCars, p.wanted + 1);
  if (p.wanted > 0 && wantedCars < wantCars && world.spawnCooldown <= 0) {
    spawnPoliceCar(world, scene, rng);
    world.spawnCooldown = 2.5;
  }
  world.spawnCooldown = Math.max(0, world.spawnCooldown - dt);
  // Officers on foot join the chase at 2+ stars when the player is on foot.
  if (p.wanted >= 2 && p.onFoot && world.officers.filter((o) => !o.dead).length < p.wanted) {
    const a = rng() * Math.PI * 2;
    spawnOfficer(world, scene, rng, clamp(p.x + Math.cos(a) * 18, -WORLD.half, WORLD.half), clamp(p.z + Math.sin(a) * 18, -WORLD.half, WORLD.seaZ - 4));
  }
  // Decay: only after a quiet spell, and only while no cop can see you.
  if (p.wanted > 0 && world.wantedTimer > POLICE.decayDelay) {
    const seen = world.cops.some((c) => !c.wrecked && Math.hypot(c.x - p.x, c.z - p.z) < 45);
    if (!seen) {
      world.decayAcc += dt;
      if (world.decayAcc >= POLICE.decayEvery) {
        world.decayAcc = 0;
        p.wanted -= 1;
        if (p.wanted === 0) world.onCleared?.();
      }
    } else world.decayAcc = 0;
  }
  world.audio.siren(p.wanted > 0 && !world.muted);
}

// Police cars chase the player's position and ram; officers run you down.
export function updatePolice(world, dt) {
  const p = world.player;
  for (const car of world.cops) {
    if (car.wrecked) continue;
    const dx = p.x - car.x, dz = p.z - car.z;
    const d = Math.hypot(dx, dz);
    const wantHeading = Math.atan2(dx, dz);
    let diff = wantHeading - car.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.heading += clamp(diff, -2.2 * dt, 2.2 * dt);
    const target = d > 6 ? POLICE.ramSpeed : 12;
    car.speed += clamp(target - car.speed, -30 * dt, 16 * dt);
    const nx = car.x + Math.sin(car.heading) * car.speed * dt;
    const nz = car.z + Math.cos(car.heading) * car.speed * dt;
    const fixed = collideCircle(nx, nz, 2.0, world.colliders);
    if (fixed.x !== nx || fixed.z !== nz) car.speed *= 0.3;
    car.x = clamp(fixed.x, -WORLD.half - 4, WORLD.half + 4);
    car.z = clamp(fixed.z, -WORLD.half - 4, WORLD.seaZ - 2);
    // Ram the player's car: shove it and damage the player a little.
    if (p.car && d < 4.6) {
      p.car.speed *= 0.94;
      p.car.x += (dx / (d || 1)) * -1.2 * dt * 10;
      p.car.z += (dz / (d || 1)) * -1.2 * dt * 10;
      if (Math.abs(car.speed) > 14) world.damagePlayer(4, 'rammed');
      car.speed *= 0.6;
    }
    // Blink the light bar.
    const bar = car.mesh.userData.lightBar;
    if (bar) {
      car.mesh.userData.blink += dt;
      bar.material.color.setHex(Math.floor(car.mesh.userData.blink * 4) % 2 ? 0xff2233 : 0x2233ff);
    }
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    const spin = car.speed * dt * 2.4;
    for (const w of car.mesh.userData.wheels) w.rotation.x += spin;
  }
  for (const off of world.officers) {
    if (off.dead) continue;
    const dx = p.x - off.x, dz = p.z - off.z;
    const d = Math.hypot(dx, dz);
    if (p.onFoot && p.wanted > 0 && d < 60) {
      off.heading = Math.atan2(dx, dz);
      off.speed = 6.8;
      off.x += Math.sin(off.heading) * off.speed * dt;
      off.z += Math.cos(off.heading) * off.speed * dt;
      if (d < POLICE.bustDist) {
        off.bustTimer += dt;
        if (off.bustTimer > POLICE.bustTime) world.onBusted?.();
      } else off.bustTimer = 0;
    } else {
      off.speed = 0;
      off.bustTimer = 0;
    }
    const fixed = collideCircle(off.x, off.z, 0.5, world.colliders);
    off.x = fixed.x; off.z = fixed.z;
    off.phase += dt * off.speed * 2.4;
    const swing = Math.sin(off.phase) * 0.5;
    off.mesh.userData.legL.rotation.x = swing;
    off.mesh.userData.legR.rotation.x = -swing;
    off.mesh.position.set(off.x, 0, off.z);
    off.mesh.rotation.y = off.heading;
  }
}

// Remove wrecked/old police cars when the heat is gone so the city resets.
export function cleanupPolice(world, scene) {
  if (world.player.wanted > 0) return;
  for (const car of [...world.cops]) {
    if (car.wrecked) continue;
    const d = Math.hypot(car.x - world.player.x, car.z - world.player.z);
    if (d > 90) {
      scene.remove(car.mesh);
      world.cars.splice(world.cars.indexOf(car), 1);
      world.cops.splice(world.cops.indexOf(car), 1);
    }
  }
  for (const off of [...world.officers]) {
    if (off.dead) continue;
    const d = Math.hypot(off.x - world.player.x, off.z - world.player.z);
    if (d > 90) {
      scene.remove(off.mesh);
      world.officers.splice(world.officers.indexOf(off), 1);
    }
  }
}

export function clearAllPolice(world, scene) {
  for (const car of [...world.cops]) {
    scene.remove(car.mesh);
    const i = world.cars.indexOf(car);
    if (i >= 0) world.cars.splice(i, 1);
  }
  world.cops.length = 0;
  for (const off of [...world.officers]) scene.remove(off.mesh);
  world.officers.length = 0;
}

export { PLACES };
