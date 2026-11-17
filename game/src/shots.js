// Solano Nights — staged screenshot scenes. Each one plays the real rules
// forward from a fixed seed with a simple autopilot, so the frame is what a
// short game really looks like and the same seed always gives the same frame.
// ?shot=start|drive|chase|mission (any other name is start).
import { PLACES } from './config.js';
import { startMission } from './missions.js';
import { shoot } from './combat.js';
import { stealCar } from './vehicles.js';

const STEP = 1 / 30;

function fakeInput() {
  return {
    moveX: 0, moveY: 0, brake: false, sprint: false,
    camYaw: 0.6, camPitch: 0.32,
    wasPressed: () => false,
    consumeClick: () => false,
  };
}

// Steer a car toward a point on the road ahead (pure pursuit).
function driveToward(world, input, tx, tz) {
  const car = world.player.car;
  if (!car) return;
  const want = Math.atan2(tx - car.x, tz - car.z);
  let d = want - car.heading;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  input.moveX = Math.max(-1, Math.min(1, d * 1.8));
  input.moveY = 1;
}

// Put the player in a car on a road, ready to drive.
function putInCar(world, x, z, heading) {
  const p = world.player;
  const car = world.cars.find((c) => !c.traffic && !c.wrecked && Math.hypot(c.x - x, c.z - z) < 30)
    || world.cars.find((c) => !c.traffic && !c.wrecked);
  car.x = x; car.z = z; car.heading = heading; car.speed = 0;
  car.mesh.position.set(x, 0, z);
  car.mesh.rotation.y = heading;
  stealCar(world, car);
  return car;
}

export function stageShot(world, name, seed = 1) {
  const input = fakeInput();
  world.autopilot = true;
  world.screen = 'play';
  const p = world.player;

  if (name === 'drive') {
    // Cruise up Meridian Row in a stolen coupe, traffic around.
    putInCar(world, -26, -150, 0);
    input.camYaw = Math.PI;
    for (let i = 0; i < 8 / STEP; i += 1) {
      driveToward(world, input, -26, world.player.car.z + 30);
      world.update(STEP, input);
    }
    return { screen: 'play' };
  }

  if (name === 'chase') {
    // Three stars, police on your tail, foot down on the coast road.
    putInCar(world, 78, -140, 0);
    world.addWanted(3, 'staged chase');
    input.camYaw = Math.PI;
    for (let i = 0; i < 10 / STEP; i += 1) {
      driveToward(world, input, 78, world.player.car.z + 30);
      // Swerve a little so the chase reads as a chase.
      input.moveX += Math.sin(i * STEP * 0.8) * 0.15;
      world.update(STEP, input);
    }
    return { screen: 'play' };
  }

  if (name === 'mission') {
    // Mission 3: the Breakers at the Plaza. Mara takes aim with the pistol —
    // staged mid-fight, so the gang is still standing in the frame.
    p.x = 0; p.z = 12; p.heading = Math.PI;
    p.weapon = 'pistol';
    p.ammo = 24;
    world.playerMesh.position.set(p.x, 0, p.z);
    startMission(world, 2);
    input.camYaw = Math.PI;
    let shootCd = 0.3;
    for (let i = 0; i < 3 / STEP; i += 1) {
      shootCd -= STEP;
      const alive = world.enemies.find((e) => !e.dead);
      if (alive && shootCd <= 0) {
        shootCd = 1.1;
        const dx = alive.x - p.x, dz = alive.z - p.z;
        const d = Math.hypot(dx, dz) || 1;
        shoot(world, { x: p.x, y: 1.4, z: p.z }, { x: dx / d, y: 0, z: dz / d });
        p.heading = Math.atan2(dx, dz);
      }
      world.update(STEP, input);
    }
    return { screen: 'play' };
  }

  // start (default): on foot at the Plaza, first job on the board, city alive.
  // Mara stands at the fountain's edge, the plaza and the city ahead of her.
  p.x = PLACES.plaza.x; p.z = 14; p.heading = Math.PI;
  world.playerMesh.position.set(p.x, 0, p.z);
  startMission(world, 0);
  input.camYaw = Math.PI;
  for (let i = 0; i < 5 / STEP; i += 1) {
    world.update(STEP, input);
  }
  return { screen: 'play' };
}
