// Solano Nights — the world: one game state, the per-frame update, the player
// on foot, damage/busted/wasted, and save/load. The modules above do the work;
// this file wires them together.
import * as THREE from 'three';
import { CITY, WORLD, PLAYER, PLACES, SAVE_KEY, MISSIONS } from './config.js';
import { mulberry32, clamp, angleLerp } from './random.js';
import { buildCity, collideCircle } from './city.js';
import { makePersonMesh, makeBeacon } from './render.js';
import { spawnTraffic, spawnParked, updateCars, nearestCar, stealCar, exitCar } from './vehicles.js';
import { spawnPeds, spawnPed, updatePeds, killPed } from './peds.js';
import { addWanted, updateWanted, updatePolice, cleanupPolice, clearAllPolice } from './police.js';
import { shoot, punch, updateEnemies, reload } from './combat.js';
import { createMissionState, startMission, updateMissions, missionEvent } from './missions.js';
import { updateHud } from './hud.js';

export function createWorld(seed, scene, render, audio) {
  const rng = mulberry32(seed);
  const { colliders } = buildCity(scene, rng);
  const world = {
    seed, rng, scene, render, audio,
    clock: 0,
    hours: WORLD.startTime,
    colliders,
    screen: 'title', // title | play | pause | busted | wasted
    paused: false,
    player: {
      x: PLACES.garage.x, z: PLACES.garage.z + 8, heading: Math.PI,
      speed: 0, health: PLAYER.maxHealth, cash: PLAYER.startCash,
      wanted: 0, onFoot: true, car: null,
      weapon: 'fist', ammo: PLAYER.startAmmo, reserveAmmo: 48,
    },
    playerMesh: null,
    cars: [], peds: [], cops: [], officers: [], enemies: [],
    targetCar: null,
    mission: createMissionState(),
    beacon: makeBeacon(),
    gunfireTimer: 0,
    wantedTimer: 0,
    decayAcc: 0,
    spawnCooldown: 0,
    flashWanted: 0,
    lastCrime: '',
    nearCar: null,
    stats: { crimes: 0, carsStolen: 0, missionsDone: 0, kills: 0 },
    camYaw: Math.PI,
    camPitch: 0.32,
    shake: 0,
    showToast: () => {},
    onCleared: null,
    onBusted: null,
    onWasted: null,
  };
  // Wiring: callbacks the modules call back into the world with.
  world.addWanted = (stars, reason) => addWanted(world, stars, reason);
  world.killPed = (ped, cause) => killPed(world, ped, cause);
  world.missionEvent = (event, data) => missionEvent(world, event, data);
  world.spawnPedNear = (x, z, angry) => spawnPed(world, scene, rng, x, z, angry);
  world.damagePlayer = (amount, cause) => damagePlayer(world, amount, cause);
  world.onBump = () => { world.shake = Math.max(world.shake, 0.25); };
  world.onCrash = (other) => {
    world.audio.punch();
    world.shake = Math.max(world.shake, 0.5);
    if (other && !other.traffic) world.addWanted(1, 'crash');
  };
  world.onCleared = () => missionEvent(world, 'wanted-clear');
  world.onBusted = () => busted(world);
  world.onWasted = () => wasted(world);

  // The player character: teal jacket, dark jeans.
  world.playerMesh = makePersonMesh(0x2a9d8f, 0x2e3440, 0xd9a077);
  world.playerMesh.position.set(world.player.x, 0, world.player.z);
  scene.add(world.playerMesh);
  scene.add(world.beacon);

  spawnTraffic(world, scene, rng, 14);
  spawnPeds(world, scene, rng, 22);
  spawnParked(world, scene, rng, [
    [-60, -30, 0], [30, -78, Math.PI / 2], [104, -130, 0], [-104, 78, -Math.PI / 2],
    [156, 26, Math.PI], [52, 130, 0], [-156, -104, Math.PI / 2], [130, -52, 0],
  ]);
  return world;
}

export function damagePlayer(world, amount, cause) {
  const p = world.player;
  if (world.screen !== 'play' || p.health <= 0) return;
  p.health -= amount;
  world.flashWanted = Math.max(world.flashWanted, 0.6);
  world.shake = Math.max(world.shake, 0.4);
  if (p.health <= 0) {
    p.health = 0;
    world.onWasted();
  }
}

function respawn(world, place, fine) {
  const p = world.player;
  if (p.car) { p.car.speed = 0; p.car = null; }
  p.onFoot = true;
  p.x = place.x; p.z = place.z;
  p.heading = 0;
  p.health = PLAYER.maxHealth;
  p.wanted = 0;
  p.cash = Math.max(0, p.cash - fine);
  clearAllPolice(world, world.scene);
  world.wantedTimer = 0;
  world.decayAcc = 0;
}

function busted(world) {
  world.audio.fail();
  world.showToast('BUSTED — The Solano PD took $100 in fines. You walk free.');
  respawn(world, PLACES.garage, 100);
  world.screen = 'busted';
  world.bustedTimer = 2.5;
}

function wasted(world) {
  world.audio.fail();
  world.showToast('WASTED — You wake up at the clinic, $150 lighter.');
  respawn(world, PLACES.hospital, 150);
  world.screen = 'wasted';
  world.bustedTimer = 2.5;
}

// Move the player on foot, camera-relative, with building collision.
function updateOnFoot(world, input, dt) {
  const p = world.player;
  const cam = world.camYaw;
  const f = input.moveY, r = input.moveX;
  const fx = Math.sin(cam), fz = Math.cos(cam);
  const rx = Math.cos(cam), rz = -Math.sin(cam);
  let mx = fx * f + rx * r;
  let mz = fz * f + rz * r;
  const len = Math.hypot(mx, mz);
  if (len > 0.01) {
    mx /= len; mz /= len;
    const speed = input.sprint ? PLAYER.runSpeed : PLAYER.walkSpeed;
    p.speed = speed;
    const wantHeading = Math.atan2(mx, mz);
    p.heading = angleLerp(p.heading, wantHeading, Math.min(1, dt * 12));
    const nx = p.x + mx * speed * dt;
    const nz = p.z + mz * speed * dt;
    const fixed = collideCircle(nx, nz, PLAYER.radius, world.colliders);
    p.x = clamp(fixed.x, -WORLD.half, WORLD.half);
    p.z = clamp(fixed.z, -WORLD.half, WORLD.seaZ - 3);
  } else p.speed = 0;
  // Walk-cycle legs on the player mesh.
  const u = world.playerMesh.userData;
  u.walkPhase += dt * (p.speed > 0 ? p.speed * 2.2 : 0);
  const swing = p.speed > 0 ? Math.sin(u.walkPhase) * 0.55 : 0;
  u.legL.rotation.x = swing;
  u.legR.rotation.x = -swing;
  u.armL.rotation.x = -swing * 0.7;
  u.armR.rotation.x = swing * 0.7;
  world.playerMesh.position.set(p.x, 0, p.z);
  world.playerMesh.rotation.y = p.heading;
  // Traffic that hits you on foot hurts.
  for (const car of world.cars) {
    if (car.traffic && Math.abs(car.speed) > 4 && Math.hypot(car.x - p.x, car.z - p.z) < 2.2) {
      damagePlayer(world, 12, 'hit by car');
      p.x += Math.sin(car.heading) * 2;
      p.z += Math.cos(car.heading) * 2;
      break;
    }
  }
}

export function updateWorld(world, input, dt) {
  if (world.screen !== 'play') return;
  world.clock += dt;
  world.hours = (WORLD.startTime + world.clock / WORLD.dayLength) % 24;
  world.gunfireTimer = Math.max(0, world.gunfireTimer - dt);
  world.render.setTimeOfDay(world.hours);

  const p = world.player;
  // One-shot keys.
  if (input.wasPressed('KeyE')) {
    if (p.onFoot) {
      const car = nearestCar(world);
      if (car) {
        const wasTarget = car.target === true;
        if (stealCar(world, car)) {
          world.audio.door();
          if (wasTarget) missionEvent(world, 'stole-target');
          else if (car.driver === false) world.showToast('Car taken. The city is watching…');
        }
      }
    } else exitCar(world);
  }
  if (input.wasPressed('KeyF') && p.onFoot) punch(world);
  if (input.wasPressed('KeyR')) reload(world);
  if (input.wasPressed('Digit1')) { p.weapon = 'fist'; }
  if (input.wasPressed('Digit2')) { p.weapon = 'pistol'; }
  if (input.wasPressed('KeyT')) {
    if (!world.mission.active) {
      const next = world.mission.done ? world.mission.index + 1 : world.mission.index;
      if (next < MISSIONS.length) startMission(world, next);
      else world.showToast('All jobs done — free roam!');
    }
  }
  if (input.consumeClick() && p.onFoot && p.weapon === 'pistol' && !world.autopilot) {
    // Shoot from the camera through the crosshair.
    const cam = world.render.camera;
    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    const origin = { x: cam.position.x, y: cam.position.y, z: cam.position.z };
    shoot(world, origin, { x: dir.x, y: 0, z: dir.z });
  }
  if (input.wasPressed('KeyM')) world.audio.toggleMute();

  // Player movement or driving.
  if (p.onFoot) {
    updateOnFoot(world, input, dt);
    world.playerMesh.visible = true;
  } else {
    world.playerMesh.visible = false;
    p.x = p.car.x; p.z = p.car.z; p.heading = p.car.heading;
  }
  world.nearCar = p.onFoot ? nearestCar(world) : null;

  updateCars(world, dt, input);
  // Driving over a pedestrian is a crime.
  if (p.car) {
    for (const ped of world.peds) {
      if (!ped.dead && Math.abs(p.car.speed) > 6 && Math.hypot(ped.x - p.x, ped.z - p.z) < 2.4) {
        killPed(world, ped, 'run-over');
        p.car.speed *= 0.6;
      }
    }
  }
  updatePeds(world, dt, world.rng);
  updateWanted(world, dt, world.scene, world.rng);
  updatePolice(world, dt);
  updateEnemies(world, dt, world.rng);
  updateMissions(world, dt);
  cleanupPolice(world, world.scene);
  world.audio.engine(p.car ? Math.abs(p.car.speed) / 34 : 0, !!p.car);

  // Camera: third-person chase; on foot it orbits with the mouse drag.
  const camYawTarget = p.onFoot ? input.camYaw : p.heading + Math.PI;
  if (p.onFoot) world.camYaw = input.camYaw;
  else world.camYaw = angleLerp(world.camYaw, camYawTarget, Math.min(1, dt * 2.5));
  const dist = p.onFoot ? 8 : 11;
  const height = p.onFoot ? 4.2 : 5;
  const cx = p.x - Math.sin(world.camYaw) * dist;
  const cz = p.z - Math.cos(world.camYaw) * dist;
  const cam = world.render.camera;
  cam.position.x += (cx - cam.position.x) * Math.min(1, dt * 6);
  cam.position.y += (height - cam.position.y) * Math.min(1, dt * 6);
  cam.position.z += (cz - cam.position.z) * Math.min(1, dt * 6);
  if (world.shake > 0) {
    world.shake = Math.max(0, world.shake - dt);
    cam.position.x += (Math.random() - 0.5) * world.shake;
    cam.position.y += (Math.random() - 0.5) * world.shake * 0.5;
  }
  cam.lookAt(p.x + Math.sin(world.camYaw) * 4, 1.6, p.z + Math.cos(world.camYaw) * 4);

  // Beacon diamond spins.
  if (world.beacon.visible) {
    world.beacon.userData.diamond.rotation.y += dt * 2;
    world.beacon.userData.diamond.position.y = 6 + Math.sin(world.clock * 2.5) * 0.5;
  }
  world.render.updateParticles(dt);
}

export function saveGame(world) {
  try {
    const p = world.player;
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      x: p.x, z: p.z, heading: p.heading, cash: p.cash, health: p.health,
      missionIndex: world.mission.index, missionDone: world.mission.done,
      missionsDone: world.stats.missionsDone, hours: world.hours,
      ammo: p.ammo, reserveAmmo: p.reserveAmmo, carsStolen: world.stats.carsStolen,
    }));
    return true;
  } catch {
    return false;
  }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function applySave(world, save) {
  const p = world.player;
  p.x = save.x; p.z = save.z; p.heading = save.heading ?? 0;
  p.cash = save.cash ?? 250;
  p.health = save.health ?? 100;
  p.ammo = save.ammo ?? 24;
  p.reserveAmmo = save.reserveAmmo ?? 48;
  world.hours = save.hours ?? WORLD.startTime;
  world.stats.missionsDone = save.missionsDone ?? 0;
  world.stats.carsStolen = save.carsStolen ?? 0;
  world.mission.index = save.missionIndex ?? 0;
  world.mission.done = !!save.missionDone;
  world.mission.objective = world.mission.done
    ? `Job ${world.mission.index + 1} done. Press T for the next job.`
    : 'Press T to start the first job.';
  world.playerMesh.position.set(p.x, 0, p.z);
  world.render.camera.position.set(p.x - Math.sin(world.camYaw) * 9, 5, p.z - Math.cos(world.camYaw) * 9);
}
