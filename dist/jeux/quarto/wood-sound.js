"use strict";

// Original procedural foley: no recordings, downloads or repeating sound bank.
const WoodSynthesis = (() => {
  function random(seed) {
    let value = seed >>> 0 || 1;
    return () => {
      value ^= value << 13; value ^= value >>> 17; value ^= value << 5;
      return (value >>> 0) / 4294967296;
    };
  }
  function finish(samples, ceiling) {
    let peak = 0;
    for (const value of samples) peak = Math.max(peak, Math.abs(value));
    const scale = peak ? ceiling / peak : 0;
    for (let i = 0; i < samples.length; i++) samples[i] *= scale;
    return samples;
  }
  function friction(sampleRate, seconds, seed) {
    const rng = random(seed), data = new Float32Array(Math.ceil(sampleRate * seconds));
    const bright = 1 - Math.exp(-2 * Math.PI * (1000 + rng() * 1500) / sampleRate);
    const dark = 1 - Math.exp(-2 * Math.PI * (90 + rng() * 130) / sampleRate);
    const grainDecay = Math.exp(-1 / (sampleRate * (.002 + rng() * .004)));
    const density = (45 + rng() * 100) / sampleRate;
    let low = 0, warm = 0, grain = 0, envelope = .7;
    for (let i = 0; i < data.length; i++) {
      const white = rng() * 2 - 1;
      low += bright * (white - low); warm += dark * (white - warm);
      grain = grain * grainDecay + (rng() < density ? rng() * .8 : 0);
      envelope += .003 * ((.6 + rng() * .6) - envelope);
      // Broad, dry noise with irregular tiny grain catches; no sustained musical tone.
      const texture = (low - warm) * (envelope + grain) + (white - low) * .035;
      const edge = Math.min(1, i / (sampleRate * .008), (data.length - 1 - i) / (sampleRate * .008));
      data[i] = Math.tanh(texture * 1.8) * edge;
    }
    return finish(data, .55);
  }
  function contact(sampleRate, seed, family = 0, piece = 0) {
    const rng = random(seed), duration = .095 + rng() * .065;
    const data = new Float32Array(Math.ceil(sampleRate * duration));
    const bases = [460, 690, 880, 530, 760, 360];
    const pitch = bases[family % bases.length] * (.86 + rng() * .28) * (piece & 4 ? .85 : 1);
    const decay = .012 + rng() * .015;
    const ratios = [1, 1.47 + rng() * .24, 2.2 + rng() * .5];
    const phases = ratios.map(() => rng() * Math.PI);
    const rasp = family >= 4;
    let low = 0;
    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate, white = rng() * 2 - 1;
      low += .28 * (white - low);
      let body = 0;
      for (let partial = 0; partial < ratios.length; partial++) {
        body += Math.sin(2 * Math.PI * pitch * ratios[partial] * t + phases[partial]) *
          Math.exp(-t / (decay / (1 + partial * .55))) / (1 + partial);
      }
      const tap = white * Math.exp(-t / .0038) * .38;
      const dry = low * Math.exp(-t / (rasp ? .026 : .011)) * .7;
      const catchGrain = rasp && t > .014 ? low * Math.exp(-(t - .014) / .009) * .25 : 0;
      const attack = Math.min(1, t / .0007);
      const tail = Math.min(1, (duration - t) / .012);
      data[i] = (body * .3 + tap + dry + catchGrain) * attack * Math.max(0, tail);
    }
    data[data.length - 1] = 0;
    return finish(data, .58);
  }
  return { friction, contact, random, finish };
})();

function createWoodAudio({ enabled = () => true, volume = () => .35, synthesis = WoodSynthesis,
  contextFactory = () => new (window.AudioContext || window.webkitAudioContext)({ latencyHint: "interactive" }),
  random = Math.random, visible = () => !document.hidden } = {}) {
  let context = null, master = null, lastFamily = -1, sequence = 0;
  const voices = new Set();
  const seed = () => ((random() * 4294967296) >>> 0) ^ (++sequence);
  const available = () => enabled() && volume() > 0 && visible() && context?.state === "running";
  const hold = (param, time) => {
    if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(time);
    else { const value = param.value; param.cancelScheduledValues(time); param.setValueAtTime(value, time); }
  };
  const panValue = x => Number.isFinite(x) ? Math.max(-.3, Math.min(.3, x)) : 0;
  function unlock() {
    if (!enabled() || volume() <= 0) return;
    try {
      if (!context) {
        context = contextFactory();
        master = context.createGain();
        master.gain.value = volume();
        master.connect(context.destination);
      }
      if (context.state === "suspended") context.resume().catch(() => {});
    } catch { context = null; master = null; }
  }
  function makeVoice(samples, { loop = false, gain = 0, pan = 0 } = {}) {
    const source = context.createBufferSource(), level = context.createGain();
    const buffer = context.createBuffer(1, samples.length, context.sampleRate);
    buffer.copyToChannel(samples, 0);
    source.buffer = buffer; source.loop = loop; level.gain.value = gain;
    const panner = context.createStereoPanner ? context.createStereoPanner() : null;
    source.connect(level);
    if (panner) { panner.pan.value = panValue(pan); level.connect(panner); panner.connect(master); }
    else level.connect(master);
    let stopped = false;
    const cleanup = () => {
      source.disconnect(); level.disconnect(); panner?.disconnect(); voices.delete(voice);
    };
    const voice = {
      source, level, panner,
      stop() {
        if (stopped) return;
        stopped = true;
        const now = context.currentTime;
        hold(level.gain, now);
        level.gain.linearRampToValueAtTime(0, now + .012);
        source.stop(now + .015);
      },
      get stopped() { return stopped; }
    };
    source.onended = cleanup;
    voices.add(voice);
    source.start();
    return voice;
  }
  function place({ piece = 0, scale = 1, pan = 0 } = {}) {
    if (!available()) return;
    // Six contact families, with fresh synthesis and no immediately repeated family.
    lastFamily = (lastFamily + 1 + Math.floor(random() * 5)) % 6;
    makeVoice(synthesis.contact(context.sampleRate, seed(), lastFamily, piece),
      { gain: .6 * scale * (.85 + random() * .15), pan });
  }
  function startSlide({ piece = 0, group = false, pan = 0 } = {}) {
    if (!available()) return null;
    const scale = group ? .23 : 1;
    const voice = makeVoice(synthesis.friction(context.sampleRate, 4, seed(), piece), { loop: true, pan });
    const baseRate = .9 + random() * .2;
    let ended = false, lastPan = pan;
    return {
      move({ speed = 0, pan = lastPan } = {}) {
        if (ended || voice.stopped || !available()) return;
        const now = context.currentTime;
        const amount = Math.min(1, Math.sqrt(Math.max(0, speed) / 650));
        hold(voice.level.gain, now);
        voice.level.gain.setTargetAtTime(.38 * scale * amount, now, .012);
        // No pointer/frame updates means the piece has stopped: fade the friction away.
        voice.level.gain.setTargetAtTime(0, now + .055, .018);
        voice.source.playbackRate.setTargetAtTime(baseRate * (.82 + amount * .3), now, .04);
        lastPan = panValue(pan);
        voice.panner?.pan.setTargetAtTime(lastPan, now, .03);
      },
      stop({ landed = false } = {}) {
        if (ended) return;
        ended = true;
        const wasPlaying = !voice.stopped;
        voice.stop();
        if (landed && wasPlaying) place({ piece, scale: group ? .18 : 1, pan: lastPan });
      }
    };
  }
  function stopAll() { for (const voice of voices) voice.stop(); }
  function updateSettings() {
    if (!enabled() || volume() <= 0) stopAll();
    if (master) {
      const now = context.currentTime;
      hold(master.gain, now);
      master.gain.setTargetAtTime(enabled() ? Math.max(0, Math.min(1, volume())) : 0, now, .015);
    }
  }
  return { unlock, startSlide, place, stopAll, updateSettings };
}

if (typeof module !== "undefined" && module.exports) module.exports = { WoodSynthesis, createWoodAudio };
