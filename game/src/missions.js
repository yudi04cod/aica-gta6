// Solano Nights — the story: five missions for Mara Voss, courier for the fixer
// Ivo Kade. Each mission has a waypoint, on-screen dialogue, objectives that
// complete from real game events, and a cash reward.
import { MISSIONS, PLACES } from './config.js';
import { spawnBreaker } from './combat.js';

export function createMissionState() {
  return {
    index: 0,
    phase: 0, // per-mission step counter
    active: false,
    done: false,
    objective: 'Talk to Ivo — press T to start the first job.',
    waypoint: null, // {x, z, label}
    lines: [],
    lineAt: 0,
    killsNeeded: 0,
    kills: 0,
    startedAt: 0,
    timer: 0,
  };
}

function setObjective(world, text, waypoint) {
  const m = world.mission;
  m.objective = text;
  m.waypoint = waypoint || null;
  world.beacon.position.set(waypoint ? waypoint.x : 0, 0, waypoint ? waypoint.z : 0);
  world.beacon.visible = !!waypoint;
}

function say(world, lines) {
  const m = world.mission;
  m.lines = lines;
  m.lineAt = 0;
  m.lineTimer = 0;
}

export function startMission(world, index) {
  const def = MISSIONS[index];
  if (!def) return false;
  const m = world.mission;
  m.index = index;
  m.phase = 0;
  m.active = true;
  m.done = false;
  m.kills = 0;
  m.startedAt = world.clock;
  say(world, def.lines);
  world.audio.sting();
  if (index === 0) {
    setObjective(world, 'Pick up the package at the Marina', { ...PLACES.marina });
  } else if (index === 1) {
    setObjective(world, 'Steal the blue coupe by the Plaza (walk up, press E)', { x: 14, z: 12, label: 'Blue coupe' });
  } else if (index === 2) {
    setObjective(world, 'Deal with the Breakers at the Plaza (0/3)', { ...PLACES.plaza });
    m.killsNeeded = 3;
    spawnBreaker(world, world.scene, world.rng, 8, 6);
    spawnBreaker(world, world.scene, world.rng, -7, 5);
    spawnBreaker(world, world.scene, world.rng, 2, -9);
  } else if (index === 3) {
    world.addWanted(2, 'framed');
    setObjective(world, 'Lose the cops — break line of sight and lay low', null);
  } else if (index === 4) {
    setObjective(world, 'Get to Meridian Bank and grab the cash', { ...PLACES.bank });
  }
  return true;
}

export function completeMission(world) {
  const def = MISSIONS[world.mission.index];
  const m = world.mission;
  m.active = false;
  m.done = true;
  m.objective = `Job done: ${def.title} — +$${def.reward}`;
  m.waypoint = null;
  world.beacon.visible = false;
  world.player.cash += def.reward;
  world.stats.missionsDone += 1;
  world.audio.cash();
  world.showToast(`JOB COMPLETE — ${def.title}  +$${def.reward}`);
  if (world.mission.index + 1 < MISSIONS.length) {
    m.objective = `Job done. Press T for the next job: ${MISSIONS[world.mission.index + 1].title}.`;
  } else {
    m.objective = 'All jobs done — Port Solano is yours, Mara. Free roam!';
  }
}

// Called by the world when a game event happens (enemy killed, car stolen…).
export function missionEvent(world, event, data) {
  const m = world.mission;
  if (!m.active) return;
  const p = world.player;
  const near = (place, r) => Math.hypot(p.x - place.x, p.z - place.z) < r;
  if (m.index === 0) {
    if (m.phase === 0 && event === 'arrive' && near(PLACES.marina, 6)) {
      m.phase = 1;
      world.audio.pickup();
      world.showToast('Package secured. Take it back to the Garage.');
      setObjective(world, 'Bring the package back to Kade Garage', { ...PLACES.garage });
    } else if (m.phase === 1 && event === 'arrive' && near(PLACES.garage, 6)) {
      completeMission(world);
    }
  } else if (m.index === 1) {
    if (event === 'stole-target') {
      m.phase = 1;
      setObjective(world, 'Deliver the coupe to Kade Garage', { ...PLACES.garage });
    } else if (m.phase === 1 && event === 'arrive' && near(PLACES.garage, 8) && p.car === world.targetCar) {
      completeMission(world);
    }
  } else if (m.index === 2) {
    if (event === 'enemy-down') {
      m.kills += 1;
      setObjective(world, `Deal with the Breakers at the Plaza (${m.kills}/3)`, { ...PLACES.plaza });
      if (m.kills >= m.killsNeeded) completeMission(world);
    }
  } else if (m.index === 3) {
    if (event === 'wanted-clear') completeMission(world);
  } else if (m.index === 4) {
    if (m.phase === 0 && event === 'arrive' && near(PLACES.bank, 6)) {
      m.phase = 1;
      p.cash += 0; // the cash is the escape, not the pickup
      world.addWanted(3, 'bank job');
      world.audio.pickup();
      world.showToast('Vault cash grabbed! Get to the Safehouse — fast.');
      setObjective(world, 'Escape to the Safehouse with the cash', { ...PLACES.safehouse });
    } else if (m.phase === 1 && event === 'arrive' && near(PLACES.safehouse, 8)) {
      completeMission(world);
    }
  }
}

// Per-frame mission logic: arrival checks and dialogue timing.
export function updateMissions(world, dt) {
  const m = world.mission;
  if (m.lines.length > 0) {
    m.lineTimer = (m.lineTimer || 0) + dt;
    if (m.lineTimer > 4.5 && m.lineAt < m.lines.length - 1) {
      m.lineAt += 1;
      m.lineTimer = 0;
    }
  }
  if (!m.active) return;
  const p = world.player;
  // Arrival at the current waypoint fires the mission's arrive event.
  if (m.waypoint) {
    const d = Math.hypot(p.x - m.waypoint.x, p.z - m.waypoint.z);
    if (d < 6) missionEvent(world, 'arrive');
  }
}
