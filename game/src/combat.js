// Solano Nights — combat: fists up close, a hitscan pistol with ammo and
// reload, muzzle flash particles, and the rival Breakers who fight back.
import * as THREE from 'three';
import { PLAYER } from './config.js';
import { clamp } from './random.js';
import { makePersonMesh } from './render.js';

export function spawnBreaker(world, scene, rng, x, z) {
  const mesh = makePersonMesh(0x8a1f1f, 0x2e3440, 0xd9a077);
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.14, 0.52), new THREE.MeshLambertMaterial({ color: 0xffd23a }));
  band.position.y = 1.88;
  mesh.add(band);
  mesh.position.set(x, 0, z);
  scene.add(mesh);
  const e = {
    x, z, heading: rng() * Math.PI * 2, speed: 0, mesh,
    hp: 60, dead: false, phase: rng() * 6, shootCd: 1 + rng(), state: 'guard',
  };
  world.enemies.push(e);
  return e;
}

// Hitscan pistol: ray from the camera through the crosshair; nearest enemy,
// officer, ped or cop car in the cone takes damage. Returns what was hit.
export function shoot(world, origin, dir) {
  const p = world.player;
  if (p.ammo <= 0) { world.audio.reload(); return 'empty'; }
  p.ammo -= 1;
  world.audio.shot();
  world.gunfireTimer = 2;
  const muzzle = { x: origin.x + dir.x * 1.2, y: origin.y, z: origin.z + dir.z * 1.2 };
  world.render.burst(muzzle.x, muzzle.y, muzzle.z, 0xffd23a, 6, 4);
  let best = null, bestD = PLAYER.pistolRange;
  const targets = [];
  for (const e of world.enemies) if (!e.dead) targets.push({ kind: 'enemy', obj: e, x: e.x, z: e.z, r: 1 });
  for (const o of world.officers) if (!o.dead) targets.push({ kind: 'officer', obj: o, x: o.x, z: o.z, r: 1 });
  for (const ped of world.peds) if (!ped.dead) targets.push({ kind: 'ped', obj: ped, x: ped.x, z: ped.z, r: 0.8 });
  for (const t of targets) {
    const dx = t.x - origin.x, dz = t.z - origin.z;
    const along = dx * dir.x + dz * dir.z;
    if (along < 0 || along > bestD) continue;
    const perp = Math.abs(dx * dir.z - dz * dir.x);
    if (perp < t.r + along * 0.02) { best = { ...t, along }; bestD = along; }
  }
  if (!best) {
    // Tracer into the distance so the shot still reads.
    world.render.burst(origin.x + dir.x * 30, 1, origin.z + dir.z * 30, 0x888888, 2, 2);
    return 'miss';
  }
  const hx = origin.x + dir.x * bestD, hz = origin.z + dir.z * bestD;
  world.render.burst(hx, 1.2, hz, 0xff5544, 10, 5);
  if (best.kind === 'enemy') {
    best.obj.hp -= PLAYER.pistolDamage;
    world.audio.hit();
    if (best.obj.hp <= 0) killEnemy(world, best.obj);
  } else if (best.kind === 'officer') {
    best.obj.hp -= PLAYER.pistolDamage;
    world.addWanted(2, 'shooting a cop');
    if (best.obj.hp <= 0) killOfficer(world, best.obj);
  } else {
    world.killPed(best.obj, 'shot');
  }
  return best.kind;
}

export function killEnemy(world, e) {
  if (e.dead) return;
  e.dead = true;
  e.mesh.rotation.x = -Math.PI / 2;
  e.mesh.position.y = 0.4;
  world.render.burst(e.x, 1, e.z, 0xff5544, 16, 7);
  world.player.cash += 50;
  world.stats.kills += 1;
  world.missionEvent?.('enemy-down');
  setTimeout(() => { e.mesh.visible = false; }, 5000);
}

export function killOfficer(world, o) {
  if (o.dead) return;
  o.dead = true;
  o.mesh.rotation.x = -Math.PI / 2;
  o.mesh.position.y = 0.4;
  world.addWanted(2, 'shooting a cop');
  world.stats.kills += 1;
}

// Fists: a short-range swing that hurts the nearest hostile or ped.
export function punch(world) {
  const p = world.player;
  world.audio.punch();
  const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
  const hx = p.x + fx * 1.4, hz = p.z + fz * 1.4;
  world.render.burst(hx, 1.2, hz, 0xffffff, 4, 3);
  for (const e of world.enemies) {
    if (!e.dead && Math.hypot(e.x - p.x, e.z - p.z) < PLAYER.fistRange) {
      e.hp -= PLAYER.fistDamage;
      world.audio.hit();
      if (e.hp <= 0) killEnemy(world, e);
      return 'enemy';
    }
  }
  for (const o of world.officers) {
    if (!o.dead && Math.hypot(o.x - p.x, o.z - p.z) < PLAYER.fistRange) {
      o.hp -= PLAYER.fistDamage;
      if (o.hp <= 0) killOfficer(world, o);
      return 'officer';
    }
  }
  for (const ped of world.peds) {
    if (!ped.dead && Math.hypot(ped.x - p.x, ped.z - p.z) < PLAYER.fistRange) {
      world.killPed(ped, 'punch');
      return 'ped';
    }
  }
  return 'miss';
}

// Breakers guard their turf and shoot back when the player gets close.
export function updateEnemies(world, dt, rng) {
  const p = world.player;
  for (const e of world.enemies) {
    if (e.dead) continue;
    const d = Math.hypot(e.x - p.x, e.z - p.z);
    if (d < 26) {
      e.state = 'fight';
      e.heading = Math.atan2(p.x - e.x, p.z - e.z);
      e.shootCd -= dt;
      if (e.shootCd <= 0 && d > 4) {
        e.shootCd = 1.4 + rng() * 0.8;
        world.audio.shot();
        world.gunfireTimer = 1;
        world.render.burst(e.x, 1.4, e.z, 0xffd23a, 5, 4);
        if (rng() < 0.4) world.damagePlayer(7, 'shot');
      } else if (d <= 4) {
        e.shootCd -= dt * 2;
        if (e.shootCd <= -0.8) {
          e.shootCd = 0.4;
          world.damagePlayer(6, 'beaten');
          world.audio.punch();
        }
      }
    } else if (e.state === 'fight') {
      e.state = 'guard';
    }
    e.phase += dt * 3;
    const swing = Math.sin(e.phase) * 0.3;
    e.mesh.userData.legL.rotation.x = swing;
    e.mesh.userData.legR.rotation.x = -swing;
    e.mesh.position.set(e.x, 0, e.z);
    e.mesh.rotation.y = e.heading;
  }
}

export function reload(world) {
  const p = world.player;
  if (p.ammo >= 24 || p.reserveAmmo <= 0) return;
  const take = Math.min(24 - p.ammo, p.reserveAmmo);
  p.ammo += take;
  p.reserveAmmo -= take;
  world.audio.reload();
}
