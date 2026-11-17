// Solano Nights — keyboard + mouse input. WASD/arrows to move and drive,
// Shift to sprint, E to enter/steal a car, F to punch, R to reload the pistol,
// Space to brake/handbrake, 1/2 to switch weapon, P or Esc to pause, M to mute.
// Mouse drag orbits the camera; click fires the pistol.
export function createInput(canvas) {
  const keys = new Set();
  const state = {
    keys,
    // virtual axes, -1..1, filled by the game loop from keys or the autopilot
    moveX: 0,
    moveY: 0,
    brake: false,
    sprint: false,
    camYaw: 0.6,
    camPitch: 0.32,
    dragging: false,
    clicked: false,
    pressed: new Set(), // keys pressed since last consume
  };
  const code = (e) => e.code;

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (!e.repeat) state.pressed.add(e.code);
    keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousedown', (e) => {
    state.dragging = true;
    state.lastX = e.clientX;
    state.lastY = e.clientY;
  });
  window.addEventListener('mouseup', (e) => {
    if (state.dragging && Math.abs(e.clientX - (state.downX ?? e.clientX)) < 6 && Math.abs(e.clientY - (state.downY ?? e.clientY)) < 6) {
      state.clicked = true;
    }
    state.dragging = false;
  });
  canvas.addEventListener('mousedown', (e) => { state.downX = e.clientX; state.downY = e.clientY; });
  window.addEventListener('mousemove', (e) => {
    if (!state.dragging) return;
    state.camYaw -= (e.clientX - state.lastX) * 0.005;
    state.camPitch = Math.max(0.05, Math.min(1.1, state.camPitch + (e.clientY - state.lastY) * 0.004));
    state.lastX = e.clientX;
    state.lastY = e.clientY;
  });

  // Read the held keys into the movement axes.
  state.poll = () => {
    const f = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
    const r = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
    state.moveY = f;
    state.moveX = r;
    state.brake = keys.has('Space');
    state.sprint = keys.has('ShiftLeft') || keys.has('ShiftRight');
  };
  state.wasPressed = (c) => {
    if (state.pressed.has(c)) { state.pressed.delete(c); return true; }
    return false;
  };
  state.consumeClick = () => {
    const c = state.clicked;
    state.clicked = false;
    return c;
  };
  return state;
}
