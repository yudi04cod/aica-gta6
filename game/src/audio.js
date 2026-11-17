// Solano Nights — all sound is synthesized with WebAudio: no audio files.
// A small procedural music loop (bass + chords + hats) and one-shot effects
// for shots, punches, sirens, engines, pickups and mission stings.
export function createAudio() {
  const audio = {
    ctx: null,
    master: null,
    musicGain: null,
    muted: false,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    musicTimer: null,
    step: 0,
  };

  audio.ensure = () => {
    if (audio.ctx) {
      if (audio.ctx.state === 'suspended') audio.ctx.resume().catch(() => {});
      return true;
    }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      audio.ctx = new Ctx();
      audio.master = audio.ctx.createGain();
      audio.master.gain.value = 0.5;
      audio.master.connect(audio.ctx.destination);
      audio.musicGain = audio.ctx.createGain();
      audio.musicGain.gain.value = 0.16;
      audio.musicGain.connect(audio.master);
      return true;
    } catch {
      return false;
    }
  };

  audio.toggleMute = () => {
    audio.muted = !audio.muted;
    if (audio.master) audio.master.gain.value = audio.muted ? 0 : 0.5;
    return audio.muted;
  };

  function tone(freq, dur, type, vol, slideTo, when = 0) {
    if (!audio.ctx || audio.muted) return;
    const t0 = audio.ctx.currentTime + when;
    const osc = audio.ctx.createOscillator();
    const g = audio.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g); g.connect(audio.master);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol, lowpass, when = 0) {
    if (!audio.ctx || audio.muted) return;
    const t0 = audio.ctx.currentTime + when;
    const len = Math.max(1, Math.floor(audio.ctx.sampleRate * dur));
    const buf = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = audio.ctx.createBufferSource();
    src.buffer = buf;
    const filt = audio.ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = lowpass;
    const g = audio.ctx.createGain();
    g.gain.value = vol;
    src.connect(filt); filt.connect(g); g.connect(audio.master);
    src.start(t0);
  }

  audio.shot = () => { noise(0.14, 0.5, 2800); tone(160, 0.09, 'square', 0.22, 60); };
  audio.punch = () => { noise(0.08, 0.35, 900); tone(120, 0.08, 'sine', 0.3, 70); };
  audio.hit = () => tone(220, 0.1, 'triangle', 0.25, 110);
  audio.pickup = () => { tone(660, 0.09, 'sine', 0.3); tone(990, 0.14, 'sine', 0.3, null, 0.08); };
  audio.cash = () => { tone(880, 0.08, 'sine', 0.28); tone(1174, 0.08, 'sine', 0.28, null, 0.07); tone(1568, 0.16, 'sine', 0.28, null, 0.14); };
  audio.sting = () => { tone(392, 0.5, 'triangle', 0.3); tone(523, 0.5, 'triangle', 0.25, null, 0.1); tone(659, 0.7, 'triangle', 0.25, null, 0.2); };
  audio.fail = () => { tone(220, 0.4, 'sawtooth', 0.2, 110); };
  audio.horn = () => tone(370, 0.18, 'square', 0.12, 370);
  audio.sirenBlip = () => { tone(700, 0.12, 'sine', 0.12, 950); tone(950, 0.12, 'sine', 0.12, 700, 0.12); };
  audio.reload = () => { tone(500, 0.05, 'square', 0.15); tone(700, 0.05, 'square', 0.15, null, 0.12); };
  audio.door = () => { noise(0.1, 0.2, 1200); tone(90, 0.08, 'sine', 0.25, 55); };

  // Continuous engine hum whose pitch follows the player's speed.
  audio.engine = (speed01, on) => {
    if (!audio.ctx || audio.muted) return;
    if (on && !audio.engineOsc) {
      audio.engineOsc = audio.ctx.createOscillator();
      audio.engineOsc.type = 'sawtooth';
      audio.engineGain = audio.ctx.createGain();
      audio.engineGain.gain.value = 0;
      const filt = audio.ctx.createBiquadFilter();
      filt.type = 'lowpass'; filt.frequency.value = 600;
      audio.engineOsc.connect(filt); filt.connect(audio.engineGain); audio.engineGain.connect(audio.master);
      audio.engineOsc.start();
    }
    if (!on && audio.engineOsc) {
      try { audio.engineOsc.stop(); } catch { /* already stopped */ }
      audio.engineOsc = null; audio.engineGain = null;
      return;
    }
    if (audio.engineOsc) {
      audio.engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, audio.ctx.currentTime, 0.08);
      audio.engineGain.gain.setTargetAtTime(0.05 + speed01 * 0.05, audio.ctx.currentTime, 0.1);
    }
  };

  // Two-tone police siren while wanted.
  audio.siren = (on) => {
    if (!audio.ctx || audio.muted) return;
    if (on && !audio.sirenOsc) {
      audio.sirenOsc = audio.ctx.createOscillator();
      audio.sirenOsc.type = 'sine';
      audio.sirenGain = audio.ctx.createGain();
      audio.sirenGain.gain.value = 0.045;
      audio.sirenOsc.connect(audio.sirenGain); audio.sirenGain.connect(audio.master);
      audio.sirenOsc.start();
      audio.sirenOsc.frequency.setValueAtTime(750, audio.ctx.currentTime);
      audio.sirenOsc.frequency.linearRampToValueAtTime(1050, audio.ctx.currentTime + 0.45);
    } else if (!on && audio.sirenOsc) {
      try { audio.sirenOsc.stop(); } catch { /* already stopped */ }
      audio.sirenOsc = null; audio.sirenGain = null;
    }
    if (audio.sirenOsc && audio.ctx) {
      const t = audio.ctx.currentTime % 0.9;
      const f = t < 0.45 ? 750 + (t / 0.45) * 300 : 1050 - ((t - 0.45) / 0.45) * 300;
      audio.sirenOsc.frequency.setTargetAtTime(f, audio.ctx.currentTime, 0.05);
    }
  };

  // Procedural loop: Am — F — C — G, a walking bass and a hat tick.
  // Chords as (root, third, fifth) in Hz; step = eighth note at 96 BPM.
  const CHORDS = [
    [110, 130.8, 164.8], [87.3, 110, 130.8], [130.8, 164.8, 196], [98, 123.5, 146.8],
  ];
  audio.startMusic = () => {
    if (!audio.ctx || audio.musicTimer) return;
    audio.musicTimer = setInterval(() => {
      if (audio.muted || !audio.ctx) return;
      const bar = Math.floor(audio.step / 8) % 4;
      const chord = CHORDS[bar];
      const beat = audio.step % 8;
      if (beat === 0) tone(chord[0] / 2, 0.5, 'sine', 0.5);
      if (beat === 4) tone(chord[0] / 2, 0.4, 'sine', 0.4);
      if (beat % 2 === 0) tone(chord[beat % 3], 0.35, 'triangle', 0.12);
      if (beat === 2 || beat === 6) noise(0.03, 0.05, 6000);
      audio.step += 1;
    }, 312);
  };

  return audio;
}
