// Solano Nights — the HUD: health bar, cash, wanted stars, speed, ammo, the
// current objective, dialogue lines, toasts, and a live 2D minimap.
import { WORLD, MISSIONS } from './config.js';

export function createHud(document) {
  const el = (id) => document.getElementById(id);
  const hud = {
    healthFill: el('health-fill'),
    healthText: el('health-text'),
    cash: el('cash'),
    stars: el('stars'),
    speed: el('speed'),
    ammo: el('ammo'),
    weapon: el('weapon'),
    objective: el('objective'),
    clock: el('clock'),
    dialogue: el('dialogue'),
    toast: el('toast'),
    hint: el('hint'),
    minimap: el('minimap'),
    wantedFlash: el('wanted-flash'),
  };
  hud.ctx = hud.minimap.getContext('2d');
  hud.toastTimer = 0;
  hud.showToast = (text) => {
    hud.toast.textContent = text;
    hud.toast.style.opacity = '1';
    hud.toastTimer = 3.5;
  };
  return hud;
}

function fmtClock(hours) {
  const h = Math.floor(hours) % 24;
  const m = Math.floor((hours % 1) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function updateHud(hud, world, dt) {
  const p = world.player;
  hud.healthFill.style.width = `${Math.max(0, p.health)}%`;
  hud.healthFill.style.background = p.health > 50 ? '#58c96b' : p.health > 25 ? '#e8c33a' : '#d94a3a';
  hud.healthText.textContent = `${Math.ceil(p.health)}`;
  hud.cash.textContent = `$${p.cash.toLocaleString('en-US')}`;
  hud.stars.textContent = '★'.repeat(p.wanted) + '☆'.repeat(5 - p.wanted);
  hud.stars.style.color = p.wanted > 0 ? '#ffcf3a' : '#ffffff88';
  hud.wantedFlash.style.opacity = world.flashWanted > 0 ? String(Math.min(1, world.flashWanted)) : '0';
  world.flashWanted = Math.max(0, world.flashWanted - dt * 1.5);
  const speedKmh = Math.round(Math.abs(p.car ? p.car.speed : p.speed || 0) * 3.6);
  hud.speed.textContent = p.car ? `${speedKmh} km/h` : '';
  hud.ammo.textContent = p.weapon === 'pistol' ? `${p.ammo} / ${p.reserveAmmo}` : '—';
  hud.weapon.textContent = p.weapon === 'pistol' ? 'PISTOL' : 'FISTS';
  hud.objective.textContent = world.mission.objective;
  hud.clock.textContent = `${fmtClock(world.hours)}  •  ${world.mission.index < MISSIONS.length ? 'JOB ' + (world.mission.index + 1) + '/5' : 'FREE ROAM'}`;
  const m = world.mission;
  hud.dialogue.textContent = m.lines.length > 0 && m.lineAt < m.lines.length ? m.lines[m.lineAt] : '';
  hud.dialogue.style.opacity = m.lines.length > 0 ? '1' : '0';
  if (hud.toastTimer > 0) {
    hud.toastTimer -= dt;
    if (hud.toastTimer <= 0) hud.toast.style.opacity = '0';
  }
  // Context hint: what E does right now.
  let hint = '';
  if (world.nearCar) hint = world.nearCar.target ? 'E — STEAL THE BLUE COUPE' : 'E — STEAL CAR';
  else if (!p.onFoot) hint = 'E — EXIT CAR   •   SPACE — HANDBRAKE';
  else hint = 'WASD — MOVE   •   SHIFT — SPRINT   •   F — PUNCH   •   CLICK — SHOOT   •   T — NEXT JOB   •   P — PAUSE';
  hud.hint.textContent = hint;
  drawMinimap(hud, world);
}

// Top-down minimap: roads, sea, player arrow, cars, cops, waypoint.
function drawMinimap(hud, world) {
  const ctx = hud.ctx;
  const S = 168;
  const half = WORLD.half + 20;
  const toMap = (x, z) => [(x / half) * (S / 2) + S / 2, (z / half) * (S / 2) + S / 2];
  ctx.clearRect(0, 0, S, S);
  ctx.fillStyle = '#10151cd8';
  ctx.fillRect(0, 0, S, S);
  // Sea strip at the bottom (south).
  ctx.fillStyle = '#2f7fb8';
  const [, seaY] = toMap(0, WORLD.seaZ);
  ctx.fillRect(0, seaY, S, S - seaY);
  // Roads.
  ctx.strokeStyle = '#6a7078';
  ctx.lineWidth = 4;
  for (let i = 0; i <= 7; i += 1) {
    const c = -WORLD.half + i * 52;
    const [x] = toMap(c, 0);
    const [, z] = toMap(0, c);
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, S); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, z); ctx.lineTo(S, z); ctx.stroke();
  }
  // Waypoint.
  if (world.mission.waypoint) {
    const [wx, wz] = toMap(world.mission.waypoint.x, world.mission.waypoint.z);
    ctx.fillStyle = '#ffd23a';
    ctx.beginPath();
    ctx.arc(wx, wz, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffd23a';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(wx, wz, 10 + Math.sin(world.clock * 4) * 2, 0, Math.PI * 2); ctx.stroke();
  }
  // Traffic cars (grey), police (blue/red), player (white arrow).
  for (const car of world.cars) {
    if (car.wrecked) continue;
    const [cx, cz] = toMap(car.x, car.z);
    ctx.fillStyle = car.police ? '#3a6cff' : '#c8ccd2';
    ctx.fillRect(cx - 2, cz - 2, 4, 4);
  }
  for (const off of world.officers) {
    if (off.dead) continue;
    const [ox, oz] = toMap(off.x, off.z);
    ctx.fillStyle = '#3a6cff';
    ctx.fillRect(ox - 2, oz - 2, 4, 4);
  }
  const [px, pz] = toMap(world.player.x, world.player.z);
  ctx.save();
  ctx.translate(px, pz);
  ctx.rotate(world.player.heading);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath();
  ctx.fill();
  ctx.restore();
}
