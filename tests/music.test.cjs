const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const context = vm.createContext({});
for (const name of ['presets.js', 'music.js']) {
  vm.runInContext(readFileSync(join(__dirname, '../dist/demos/melody-generator', name), 'utf8'), context);
}
const music = vm.runInContext('({makeScale, makeMelody, digitsFor, MODES, DEMOS, DURATIONS, PITCHES})', context);
const { makeScale, makeMelody, digitsFor, MODES, DEMOS, DURATIONS, PITCHES } = music;

test('crossed range is rejected, without silently moving either boundary', () => {
  assert.throws(() => makeScale(2, MODES[8].Prokofiev, 81, 79), /note la plus basse/);
});

test('one excluded note reports an empty scale; one included note remains usable', () => {
  const empty = makeScale(2, MODES[8].Prokofiev, 81, 81);
  assert.equal(empty.length, 0);
  assert.throws(() => makeMelody('Cépagrave', '', empty, [DURATIONS[5]], true), /tessiture/);
  const notes = makeMelody('Cépagrave', '', [80], [DURATIONS[5]], true);
  assert.equal(notes.length, 9);
  assert.ok(notes.every(note => note.pitch === 80));
});

test('accents normalize consistently and invalid direct digits give a useful error', () => {
  assert.deepEqual(Array.from(digitsFor('Cépagrave', 12, true)), Array.from(digitsFor('Cepagrave', 12, true)));
  assert.throws(() => digitsFor('Cépagrave', 12, false), /active la conversion/);
  assert.throws(() => digitsFor('bonjour!', 12, true), /lettres/);
  assert.equal(digitsFor('', 12, true).length, 0);
  assert.equal(digitsFor('z'.repeat(128), 2, true).length, 768);
});

function checkNotes(notes, scale) {
  assert.ok(notes.length);
  let start = 0;
  for (const note of notes) {
    assert.ok(scale.includes(note.pitch));
    assert.ok(Number.isFinite(note.pitch));
    assert.ok(note.ticks > 0);
    assert.equal(note.start, start);
    start += note.ticks;
  }
}

test('all original examples keep valid notes, durations and consecutive timing', () => {
  const aliases = { 'D#': 'Eb', 'G#': 'Ab', 'A#': 'Bb' };
  const pitch = ([name, octave]) => 12 * (octave + 1) + PITCHES.indexOf(aliases[name] || name);
  for (const demo of Object.values(DEMOS)) {
    const [melody, rhythm, root, steps, mode, low, high, durations, convert] = demo;
    const scale = makeScale(PITCHES.indexOf(root), MODES[steps][mode], pitch(low), pitch(high));
    checkNotes(makeMelody(melody, rhythm, scale, durations.map(i => DURATIONS[i]), convert), scale);
  }
});

test('every mode and tonic works across low, high, narrow and full ranges', () => {
  for (const modes of Object.values(MODES)) {
    for (const mask of Object.values(modes)) {
      for (let tonic = 0; tonic < 12; tonic++) {
        for (const [low, high] of [[24, 35], [96, 107], [24, 107], [60, 61], [72, 72]]) {
          const scale = makeScale(tonic, mask, low, high);
          assert.ok(scale.every(pitch => pitch >= low && pitch <= high));
          if (scale.length) checkNotes(makeMelody('Cépagrave', 'Bois', scale, DURATIONS, true), scale);
          else assert.throws(() => makeMelody('Cépagrave', 'Bois', scale, DURATIONS, true), /tessiture/);
        }
      }
    }
  }
});
