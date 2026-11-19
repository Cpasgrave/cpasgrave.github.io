"use strict";

const QuoridorSounds = (() => {
  const BARRIER = 4;
  const tau = 2 * Math.PI;
  const { random, finish } = WoodSynthesis;

  function glass(data, rate, rng) {
    const pitch = 575 + rng() * 360;
    const drift = (rng() - .5) * .23;
    const wobbleRate = 3 + rng() * 3;
    let phase = 0, friction = 0;
    for (let i = 0; i < data.length; i++) {
      const t = i / rate;
      const noise = rng() * 2 - 1;
      friction += .17 * (noise - friction);
      const stickSlip = Math.sin(tau * wobbleRate * t + .9 * Math.sin(19 * t));
      phase += tau * pitch * (1 + .035 * stickSlip + drift * Math.sin(2.6 * t) + .007 * friction) / rate;
      const ring = Math.sin(phase) + .16 * Math.sin(phase * 2.24) + .09 * Math.sin(phase * 3);
      data[i] = ring * (.34 + .17 * stickSlip) + .18 * friction;
    }
  }

  function guiro(data, rate, rng) {
    const spacing = rate / (27 + rng() * 15);
    const base = 280 + rng() * 145;
    let next = 0, struck = 0, strength = 0, pitch = base, scrape = 0;
    for (let i = 0; i < data.length; i++) {
      if (i >= next) {
        struck = i;
        next = i + spacing * (.65 + rng() * .8);
        strength = .55 + rng() * .45;
        pitch = base * (.87 + rng() * .26);
      }
      const t = (i - struck) / rate;
      const noise = rng() * 2 - 1;
      scrape += .24 * (noise - scrape);
      const knock = Math.sin(tau * pitch * t) * Math.exp(-t / .0085);
      const shell = Math.sin(tau * pitch * 1.82 * t) * Math.exp(-t / .005);
      const ridge = scrape * Math.exp(-t / .003);
      data[i] = strength * (.72 * knock + .24 * shell + .42 * ridge) * Math.min(1, t / .0007);
    }
  }

  function bowedString(data, rate, rng) {
    const notes = [293.66, 329.63, 392, 440, 493.88, 587.33];
    const pitch = notes[Math.floor(rng() * notes.length)] * (.985 + rng() * .03);
    const glide = (rng() < .5 ? -1 : 1) * (.10 + rng() * .12);
    const partials = [1, .38, .28, .29, .13, .11];
    const vibrato = 4.5 + rng() * 1.8;
    let phase = 0, bow = 0;
    for (let i = 0; i < data.length; i++) {
      const t = i / rate;
      const noise = rng() * 2 - 1;
      bow += .2 * (noise - bow);
      const bend = glide * (1 - Math.exp(-t / .22));
      const vibratoDepth = .004 + .006 * Math.min(1, t / .3);
      phase += tau * pitch * (1 + bend + vibratoDepth * Math.sin(tau * vibrato * t)) / rate;
      let string = 0;
      for (let h = 0; h < partials.length; h++) string += partials[h] * Math.sin((h + 1) * phase + .1 * h);
      data[i] = (string * .47 + bow * .24) * (.88 + .1 * Math.sin(17 * t));
    }
  }

  const voices = [null, glass, guiro, bowedString];
  function friction(rate, seconds, seed, piece) {
    const voice = voices[piece];
    if (!voice) return WoodSynthesis.friction(rate, seconds, seed);
    const data = new Float32Array(Math.ceil(rate * Math.min(seconds, 2)));
    voice(data, rate, random(seed));
    for (let i = 0; i < data.length; i++) {
      data[i] *= Math.min(1, i / (rate * .012), (data.length - 1 - i) / (rate * .018));
    }
    return finish(data, piece === 2 ? .56 : .42);
  }

  function contact(rate, seed, family, piece) {
    if (piece !== BARRIER) return WoodSynthesis.contact(rate, seed, family, piece);
    const rng = random(seed);
    const data = new Float32Array(Math.ceil(rate * (.088 + rng() * .036)));
    const pitch = (220 + family * 21) * (.9 + rng() * .2);
    const upper = pitch * (2.15 + rng() * .7);
    const decay = .012 + rng() * .009;
    let noise = 0;
    for (let i = 0; i < data.length; i++) {
      const t = i / rate;
      noise += .22 * (rng() * 2 - 1 - noise);
      const body = Math.sin(tau * pitch * t) * Math.exp(-t / decay);
      const edge = Math.sin(tau * upper * t) * Math.exp(-t / .008);
      const attack = Math.min(1, t / .00065, (data.length - 1 - i) / (rate * .008));
      data[i] = attack * (.47 * body + .19 * edge + .62 * noise * Math.exp(-t / .004));
    }
    return finish(data, .62);
  }

  return { BARRIER, friction, contact };
})();
