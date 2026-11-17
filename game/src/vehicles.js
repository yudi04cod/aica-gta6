// Solano Nights — cars: arcade driving for the player, lane-following traffic,
// stealing (walk up, press E, the driver gets out), and simple collisions.
import * as THREE from 'three';
import { CAR, TRAFFIC, WORLD, CITY } from './config.js';
import { clamp, range, pick } from './random.js';
import { nearestRoad, onRoad, collideCircle } from './city.js';
import { makeCarMesh, randomCarColor } from './render.js';

export function makeCar(x, z, heading, color, traffic, scene) {
  const mesh = makeCarMesh(color, false);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  scene.add(mesh);
  return {
    x, z, heading, speed: 0, color, traffic, mesh,
    driver: traffic, // traffic cars have a driver; parked ones do not
    wrecked: false, steer: 0, ai: null, brakeLight: false,
  };
}

// Spawn traffic on road centrelines, facing along the road.
export function spawnTraffic(world, scene, rng, count) {
  const centres = [];
  for (let i = 0; i <= CITY.blocks; i += 1) centres.push(-WORLD.half + i * CITY.block);
  for (let n = 0; n < count; n += 1) {
    const alongZ = rng() < 0.5;
    const line = pick(rng, centres);
    const t = range(rng, -WORLD.half + 10, WORLD.half - 10);
    const lane = rng() < 0.5 ? -3.5 : 3.5;
    const dir = rng() < 0.5 ? 1 : -1;
    let x, z, heading;
    if (alongZ) { x = line + lane; z = t; heading = dir > 0 ? 0 : Math.PI; }
    else { x = t; z = line + lane; heading = dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
    const car = makeCar(x, z, heading, randomCarColor(rng), true, scene);
    car.speed = range(rng, 6, TRAFFIC.maxSpeed);
    car.ai = { alongZ, line, dir, lane, turnAt: null };
    world.cars.push(car);
  }
}

// A few parked cars on side streets for the player to find and steal.
export function spawnParked(world, scene, rng, spots) {
  for (const [x, z, heading] of spots) {
    const car = makeCar(x, z, heading, randomCarColor(rng), false, scene);
    car.driver = false;
    world.cars.push(car);
  }
  // The mission-2 target: a blue coupe by the plaza.
  const coupe = makeCar(14, 12, Math.PI / 2, 0x2e6fc2, false, scene);
  coupe.driver = false;
  coupe.target = true;
  world.cars.push(coupe);
  world.targetCar = coupe;
}

// Traffic AI: follow the lane, slow for the car ahead, turn at intersections.
function updateTrafficCar(car, dt, world) {
  const ai = car.ai;
  const ahead = 9;
  const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
  let blocked = false;
  for (const other of world.cars) {
    if (other === car || other.wrecked) continue;
    const dx = other.x - car.x, dz = other.z - car.z;
    const along = dx * fx + dz * fz;
    const side = Math.abs(dx * fz - dz * fx);
    if (along > 0 && along < ahead && side < 2.4) { blocked = true; break; }
  }
  const want = blocked ? 0 : TRAFFIC.maxSpeed;
  car.speed += clamp(want - car.speed, -18 * dt, 8 * dt);
  // At an intersection, sometimes turn onto the cross road.
  const road = nearestRoad(car.x, car.z);
  const nearCentre = road.d < 1.2;
  if (nearCentre && ai.turnAt === null && Math.random() < 0.012) {
    ai.turnAt = true;
  }
  if (ai.turnAt) {
    // steer toward the cross-road direction
    const target = ai.alongZ ? (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (Math.random() < 0.5 ? 0 : Math.PI);
    let d = target - car.heading;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    car.heading += clamp(d, -1.6 * dt, 1.6 * dt);
    if (Math.abs(d) < 0.15) {
      ai.alongZ = !ai.alongZ;
      ai.turnAt = null;
    }
  }
  car.x += Math.sin(car.heading) * car.speed * dt;
  car.z += Math.cos(car.heading) * car.speed * dt;
  // Wrap around the city edge so traffic never runs out.
  if (car.x < -WORLD.half - 6) car.x = WORLD.half + 5;
  if (car.x > WORLD.half + 6) car.x = -WORLD.half - 5;
  if (car.z < -WORLD.half - 6) car.z = WORLD.half + 5;
  if (car.z > WORLD.half + 6) car.z = -WORLD.half - 5;
}

// Arcade driving: accelerate, steer (stronger at speed), handbrake, drag.
export function drivePlayerCar(car, input, dt, world) {
  const fwd = input.moveY;
  const steer = input.moveX;
  const speedSign = car.speed >= 0 ? 1 : -1;
  if (fwd > 0) car.speed += CAR.accel * dt;
  else if (fwd < 0) {
    if (car.speed > 0.5) car.speed -= CAR.brake * dt; // brake first
    else car.speed -= CAR.reverseAccel * dt;
  } else {
    car.speed -= Math.sign(car.speed) * CAR.drag * 6 * dt;
    if (Math.abs(car.speed) < 0.3) car.speed = 0;
  }
  if (input.brake) car.speed -= Math.sign(car.speed) * 26 * dt;
  car.speed = clamp(car.speed, -CAR.maxReverse, CAR.maxSpeed);
  const steerAmt = steer * CAR.turnRate * clamp(Math.abs(car.speed) / 8, 0, 1) * speedSign;
  car.heading += steerAmt * dt;
  car.steer = steer;
  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  // Buildings block the car; the sea and the map edge do too.
  const fixed = collideCircle(nx, nz, 2.0, world.colliders);
  if (fixed.x !== nx || fixed.z !== nz) {
    car.speed *= 0.35;
    world.onBump?.(Math.abs(car.speed));
  }
  car.x = clamp(fixed.x, -WORLD.half - 4, WORLD.half + 4);
  car.z = clamp(fixed.z, -WORLD.half - 4, WORLD.seaZ - 2);
  // Gentle car-to-car shove.
  for (const other of world.cars) {
    if (other === car || other.wrecked) continue;
    const dx = car.x - other.x, dz = car.z - other.z;
    const d2 = dx * dx + dz * dz;
    if (d2 < 16 && d2 > 0.01) {
      const d = Math.sqrt(d2);
      const push = (4 - d) * 0.5;
      car.x += (dx / d) * push;
      car.z += (dz / d) * push;
      if (Math.abs(car.speed) > 12 && !other.traffic) world.onCrash?.(other);
      car.speed *= 0.92;
    }
  }
}

export function updateCars(world, dt, input) {
  for (const car of world.cars) {
    if (car.wrecked) continue;
    if (car === world.player.car) drivePlayerCar(car, input, dt, world);
    else if (car.traffic) updateTrafficCar(car, dt, world);
    // Sync the mesh; wheels spin with speed.
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    const spin = car.speed * dt * 2.4;
    for (const w of car.mesh.userData.wheels) w.rotation.x += spin;
  }
}

// Nearest stealable car within reach of the player on foot.
export function nearestCar(world, maxDist = 4) {
  let best = null, bestD = maxDist * maxDist;
  for (const car of world.cars) {
    if (car.wrecked) continue;
    const dx = car.x - world.player.x, dz = car.z - world.player.z;
    const d2 = dx * dx + dz * dz;
    if (d2 < bestD) { bestD = d2; best = car; }
  }
  return best;
}

// Steal: if the car has a driver, they get out (and get angry); the player gets in.
export function stealCar(world, car) {
  if (!car) return false;
  if (car.driver) {
    car.driver = false;
    world.spawnPedNear(car.x + 2, car.z + 1, true);
    world.addWanted(1, 'carjacking');
  }
  world.player.car = car;
  world.player.onFoot = false;
  car.traffic = false;
  car.ai = null;
  world.stats.carsStolen += 1;
  return true;
}

export function exitCar(world) {
  const car = world.player.car;
  if (!car) return;
  const p = world.player;
  p.car = null;
  p.onFoot = true;
  p.x = car.x - Math.sin(car.heading + Math.PI / 2) * 2.4;
  p.z = car.z - Math.cos(car.heading + Math.PI / 2) * 2.4;
  p.heading = car.heading;
  p.speed = 0;
  const fixed = collideCircle(p.x, p.z, 0.6, world.colliders);
  p.x = fixed.x; p.z = fixed.z;
}
