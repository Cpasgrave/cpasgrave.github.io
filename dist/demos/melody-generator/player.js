"use strict";

function createPlayer({ onNote, onEnd }) {
  let context;
  let master;
  let wave;
  let current = null;
  let request = 0;
  let level = .45;
  const voices = new Set();

  function setVolume(value) {
    level = value;
    if (master) master.gain.setTargetAtTime(.6 * level, context.currentTime, .02);
  }

  function stop() {
    request++;
    if (!current) return;
    clearTimeout(current.timer);
    current = null;
    const now = context.currentTime;
    for (const { source, envelope } of voices) {
      envelope.gain.cancelScheduledValues(now);
      envelope.gain.setTargetAtTime(0, now, .004);
      source.stop(now + .013);
    }
  }

  async function unlock() {
    if (!context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) throw new Error("Ce navigateur ne propose pas Web Audio.");
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = .6 * level;
      master.connect(context.destination);
      // A little harmonic colour and a short fade give the notes a plucked sound.
      wave = context.createPeriodicWave(
        new Float32Array([0, 0, 0, 0, 0]),
        new Float32Array([0, 1, .37, .13, .045])
      );
    }
    if (context.state !== "running") await context.resume();
    if (context.state !== "running") throw new Error("Le navigateur a suspendu le son. Réessaie avec Écouter.");
  }

  function playNote(note, when, secondsPerTick, sustain) {
    if (note.rest) return;
    const source = context.createOscillator();
    const envelope = context.createGain();
    const duration = note.ticks * secondsPerTick;
    const end = when + duration * sustain;
    source.setPeriodicWave(wave);
    source.frequency.value = 440 * Math.pow(2, (note.pitch - 69) / 12);
    envelope.gain.setValueAtTime(0, when);
    envelope.gain.linearRampToValueAtTime(.45, when + Math.min(.008, (end - when) / 2));
    envelope.gain.exponentialRampToValueAtTime(.055, end);
    envelope.gain.setTargetAtTime(0, end, .022);
    source.connect(envelope);
    envelope.connect(master);
    const voice = { source, envelope };
    voices.add(voice);
    source.onended = () => { voices.delete(voice); source.disconnect(); envelope.disconnect(); };
    source.start(when);
    source.stop(end + .095);
  }

  async function play(notes, { index, bpm, sustain, loop }) {
    stop();
    const token = request;
    await unlock();
    if (token !== request) return false;
    const secondsPerTick = 60 / (bpm * 16);
    const last = notes[notes.length - 1];
    const duration = (last.start + last.ticks) * secondsPerTick;
    let origin = context.currentTime + .055 - notes[index].start * secondsPerTick;
    let next = index;
    let lastSeen = -1;
    let endAt = Infinity;
    const events = [];
    current = { timer: 0 };

    function tick() {
      if (request !== token) return;
      const now = context.currentTime;
      if (now >= endAt) {
        current = null;
        onEnd();
        return;
      }
      // Schedule on the audio clock and keep only a short queue of upcoming notes.
      while (next < notes.length) {
        const when = origin + notes[next].start * secondsPerTick;
        if (when > now + .13) break;
        const note = notes[next];
        if (when + note.ticks * secondsPerTick > now) {
          events.push({ when, index: next });
          playNote(note, Math.max(now, when), secondsPerTick, sustain);
        }
        next++;
        if (next !== notes.length) continue;
        if (loop()) {
          origin += duration;
          next = 0;
        } else {
          endAt = origin + duration + .095;
        }
      }
      let seen = lastSeen;
      while (events.length && events[0].when <= now) seen = events.shift().index;
      if (seen !== lastSeen) {
        lastSeen = seen;
        onNote(seen);
      }
      current.timer = setTimeout(tick, 25);
    }
    tick();
    return true;
  }

  return { play, stop, setVolume };
}
