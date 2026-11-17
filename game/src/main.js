// Solano Nights — bootstrap: build the world, run the loop, own the screens
// (title, pause, busted, wasted) and the save. ?shot= stages a screenshot
// scene instead of showing the title screen.
import { createRenderer } from './render.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { createWorld, updateWorld, saveGame, loadSave, applySave } from './world.js';
import { createHud, updateHud } from './hud.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
const seed = Number(params.get('seed') || '1') || 1;

const canvas = document.getElementById('game');
const render = createRenderer(canvas);
const audio = createAudio();
const input = createInput(canvas);
const hud = createHud(document);
const world = createWorld(seed, render.scene, render, audio);
world.update = (dt, inp) => {
  updateWorld(world, inp, dt);
  updateHud(hud, world, dt);
};
world.showToast = (text) => hud.showToast(text);

const titleEl = document.getElementById('title');
const pauseEl = document.getElementById('pause');
const endEl = document.getElementById('endcard');
const endTitle = document.getElementById('end-title');
const endText = document.getElementById('end-text');
const statusEl = document.getElementById('status');

function show(el, on) { el.style.display = on ? 'flex' : 'none'; }
function setScreen(name) {
  world.screen = name;
  show(titleEl, name === 'title');
  show(pauseEl, name === 'pause');
  show(endEl, name === 'busted' || name === 'wasted');
  if (name === 'busted') { endTitle.textContent = 'BUSTED'; endText.textContent = 'The Solano PD took $100 in fines. You walk free — for now.'; }
  if (name === 'wasted') { endTitle.textContent = 'WASTED'; endText.textContent = 'You wake up at the clinic, $150 lighter. The city keeps moving.'; }
}

function startGame(fromSave) {
  audio.ensure();
  audio.startMusic();
  if (fromSave) {
    const save = loadSave();
    if (save) applySave(world, save);
  }
  setScreen('play');
  statusEl.textContent = 'Solano Nights: playing. Objective: ' + world.mission.objective;
}

document.getElementById('start-btn').addEventListener('click', () => startGame(false));
const continueBtn = document.getElementById('continue-btn');
if (loadSave()) {
  continueBtn.style.display = 'inline-block';
  continueBtn.addEventListener('click', () => startGame(true));
}
document.getElementById('resume-btn').addEventListener('click', () => setScreen('play'));
document.getElementById('save-btn').addEventListener('click', () => {
  saveGame(world);
  hud.showToast('Game saved.');
});
document.getElementById('quit-btn').addEventListener('click', () => {
  saveGame(world);
  setScreen('title');
});
document.getElementById('end-btn').addEventListener('click', () => setScreen('play'));

function resize() {
  render.resize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', resize);
resize();

// Shot mode: stage the scene, hide the menus, play straight away.
if (shotName) {
  show(titleEl, false);
  world.screen = 'play';
  stageShot(world, shotName, seed);
  // The live loop reads the real input's camYaw on foot; keep the staged angle
  // so the screenshot frame is the staged one, not a snapped-away camera.
  input.camYaw = Math.PI;
  render.resize(window.innerWidth, window.innerHeight);
}

let last = performance.now();
let saveTimer = 0;
let lastScreen = world.screen;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  input.poll();
  // The world can flip to busted/wasted on its own; mirror that into the overlay.
  if (world.screen !== lastScreen) {
    lastScreen = world.screen;
    if (world.screen === 'busted' || world.screen === 'wasted') setScreen(world.screen);
  }
  if (input.wasPressed('KeyP') || input.wasPressed('Escape')) {
    if (world.screen === 'play') { saveGame(world); setScreen('pause'); }
    else if (world.screen === 'pause') setScreen('play');
  }
  if (world.screen === 'busted' || world.screen === 'wasted') {
    world.bustedTimer = (world.bustedTimer ?? 2.5) - dt;
    if (world.bustedTimer <= 0) setScreen('play');
  }
  if (world.screen === 'play') {
    world.update(dt, input);
    saveTimer += dt;
    if (saveTimer > 30) { saveTimer = 0; saveGame(world); }
  }
  render.renderer.render(render.scene, render.camera);
}
requestAnimationFrame(frame);
