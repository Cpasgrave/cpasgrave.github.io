"use strict";

const byId = id => document.getElementById(id);
const melodyInput = byId("melody");
const rhythmInput = byId("rhythm");
const tonic = byId("tonic");
const mode = byId("mode");
const low = byId("low");
const high = byId("high");
const convert = byId("convert");
const loop = byId("loop");
const tempo = byId("tempo");
const sustain = byId("sustain");
const volume = byId("volume");
const demos = byId("demo-select");
const score = byId("score");
const status = byId("music-status");
const playButton = byId("play");
const stopButton = byId("stop");
const defaultDurations = [5, 6, 7, 9];
let notes = [];
let glyphs = [];
let activeNote = 0;
let playing = false;
let paused = false;
let settingsValid = true;
let action = 0;
let resizeFrame = 0;

function highlight(index) {
  glyphs[activeNote]?.classList.remove("current-note");
  activeNote = index;
  glyphs[index]?.classList.add("current-note");
  const glyph = glyphs[index];
  if (!glyph) return;
  const bounds = glyph.getBoundingClientRect();
  const viewport = score.getBoundingClientRect();
  if (bounds.bottom > viewport.bottom || bounds.top < viewport.top) {
    score.scrollTop += bounds.top - viewport.top - 25;
  }
}

function setButtons() {
  playButton.disabled = !settingsValid || notes.length === 0;
  playButton.textContent = playing ? "Pause" : paused ? "Reprendre" : "Écouter";
  stopButton.disabled = !playing && !paused;
}

function setStatus(message, error = false) {
  status.textContent = message;
  status.classList.toggle("is-error", error);
}

function resetPlayback() {
  action++;
  player.stop();
  playing = paused = false;
  glyphs[activeNote]?.classList.remove("current-note");
  activeNote = 0;
  setButtons();
}

const player = createPlayer({
  onNote: highlight,
  onEnd: () => {
    resetPlayback();
    setStatus("Lecture terminée.");
  },
});

function renderScore(nextNotes = notes) {
  // Build off-screen first: a failed conversion or engraving must never erase
  // the last usable score. Resolve VexFlow's SVG elements only after committing.
  const staging = document.createElement("div");
  const nextGlyphs = [];
  if (!nextNotes.length) {
    score.replaceChildren();
    glyphs = [];
    return;
  }
  const { Renderer, Stave, StaveNote, Dot, Accidental, Formatter } = window.Vex.Flow;
  const width = Math.max(200, score.clientWidth);
  const perLine = Math.max(1, Math.floor((width - 72) / 50));
  const staffPositions = nextNotes.filter(note => !note.rest).map(note =>
    (Math.floor(note.pitch / 12) - 1) * 7 + "CDEFGAB".indexOf(PITCHES[note.pitch % 12][0]));
  // Leave room for ledger lines, accidentals and stems at either extreme.
  const above = Math.max(0, (Math.max(44, ...staffPositions) - 44) * 5);
  const below = Math.max(0, (28 - Math.min(28, ...staffPositions)) * 5);
  const lineHeight = 130 + above + below;
  const renderer = new Renderer(staging, Renderer.Backends.SVG);
  renderer.resize(width, Math.ceil(nextNotes.length / perLine) * lineHeight + 10);
  const context = renderer.getContext();

  for (let offset = 0; offset < nextNotes.length; offset += perLine) {
    const stave = new Stave(6, offset / perLine * lineHeight + 17 + above, width - 12);
    stave.addClef("treble").setContext(context).draw();
    const scoreNotes = nextNotes.slice(offset, offset + perLine).map(note => {
      const name = PITCHES[note.pitch % 12];
      const octave = Math.floor(note.pitch / 12) - 1;
      const key = note.rest ? "b/4" : `${name.toLowerCase()}/${octave}`;
      const glyph = new StaveNote({
        keys: [key],
        duration: note.duration + (note.dotted ? "d" : ""),
        auto_stem: true,
      });
      if (note.dotted) Dot.buildAndAttach([glyph], { all: true });
      if (!note.rest && name.length > 1) glyph.addModifier(new Accidental(name[1]), 0);
      return glyph;
    });
    Formatter.FormatAndDraw(context, stave, scoreNotes);
    nextGlyphs.push(...scoreNotes);
  }
  score.replaceChildren(...staging.childNodes);
  glyphs = nextGlyphs.map(glyph => glyph.getSVGElement());
  if (playing || paused) highlight(activeNote);
}

function recalculate() {
  const resume = playing;
  const keepPaused = paused;
  resetPlayback();
  try {
    const [steps, name] = mode.value.split("|");
    const scale = makeScale(Number(tonic.value), MODES[steps][name], Number(low.value), Number(high.value));
    const durations = durationInputs.filter(input => input.checked).map(input => DURATIONS[input.value]);
    const nextNotes = makeMelody(melodyInput.value, rhythmInput.value, scale,
      durations.length ? durations : [DURATIONS[5]], convert.checked);
    renderScore(nextNotes);
    notes = nextNotes;
    settingsValid = true;
    paused = keepPaused && notes.length > 0;
    score.scrollTop = 0;
    const count = notes.filter(note => !note.rest).length;
    const rests = notes.length - count;
    setStatus(notes.length
      ? `${count} note${count === 1 ? "" : "s"}${rests ? ` · ${rests} silence${rests === 1 ? "" : "s"}` : ""}`
      : "Saisis un texte pour créer une mélodie.");
    if (paused) highlight(0);
    if (resume && notes.length) startPlayback();
  } catch (error) {
    settingsValid = false;
    setStatus(`${error.message}${notes.length ? " La dernière partition est conservée ; corrige les réglages pour l’écouter." : ""}`, true);
  }
  setButtons();
}

PITCHES.forEach((name, index) => tonic.add(new Option(name, index)));
Object.entries(MODES).forEach(([steps, modes]) => {
  const group = document.createElement("optgroup");
  group.label = `${steps} notes par octave`;
  Object.keys(modes).forEach(name => group.append(new Option(name, `${steps}|${name}`)));
  mode.append(group);
});
for (let pitch = 24; pitch <= 107; pitch++) {
  low.add(new Option(noteName(pitch), pitch));
  high.add(new Option(noteName(pitch), pitch));
}

const durationInputs = DURATIONS.map((duration, index) => {
  const label = document.createElement("label");
  const input = document.createElement("input");
  input.type = "checkbox";
  input.value = index;
  input.checked = defaultDurations.includes(index);
  label.append(input, duration.name);
  byId("durations").append(label);
  input.addEventListener("change", () => {
    if (!durationInputs.some(option => option.checked)) input.checked = true;
    recalculate();
  });
  return input;
});

function readPitch([pitch, octave]) {
  const spelling = { "D#": "Eb", "G#": "Ab", "A#": "Bb" };
  return 12 * (octave + 1) + PITCHES.indexOf(spelling[pitch] || pitch);
}

tonic.value = "2";
mode.value = "8|Prokofiev";
low.value = readPitch(["E", 3]);
high.value = readPitch(["G", 5]);
for (const name of Object.keys(DEMOS)) demos.add(new Option(name, name));

function updateSliders() {
  byId("tempo-value").textContent = `${tempo.value} BPM`;
  byId("sustain-value").textContent = `${sustain.value} %`;
  byId("volume-value").textContent = `${volume.value} %`;
  player.setVolume(Number(volume.value) / 100);
}

demos.addEventListener("change", () => {
  if (!demos.value) return;
  const [melody, rhythm, root, steps, name, from, to, durations, conversion, , tail, repeat] = DEMOS[demos.value];
  melodyInput.value = melody;
  rhythmInput.value = rhythm;
  tonic.value = PITCHES.indexOf(root);
  mode.value = `${steps}|${name}`;
  low.value = readPitch(from);
  high.value = readPitch(to);
  durationInputs.forEach((input, index) => { input.checked = durations.includes(index); });
  convert.checked = Boolean(conversion);
  tempo.value = Math.max(45, Math.min(200, 300 - tail));
  sustain.value = Math.max(20, Math.min(100, Math.round(tail / 3)));
  loop.checked = Boolean(repeat);
  updateSliders();
  recalculate();
});

for (const input of [melodyInput, rhythmInput, tonic, mode, low, high, convert]) {
  input.addEventListener(input.tagName === "TEXTAREA" ? "input" : "change", () => {
    demos.value = "";
    recalculate();
  });
}

async function startPlayback() {
  if (!settingsValid || !notes.length) return;
  const token = ++action;
  playing = true;
  paused = false;
  setButtons();
  try {
    const started = await player.play(notes, {
      index: activeNote,
      bpm: Number(tempo.value),
      sustain: Number(sustain.value) / 100,
      loop: () => loop.checked,
    });
    if (started && token === action) setStatus("Lecture en cours.");
  } catch (error) {
    if (token !== action) return;
    resetPlayback();
    setStatus(error.message || "Le son n’a pas pu démarrer.", true);
  }
}

function pausePlayback() {
  action++;
  player.stop();
  playing = false;
  paused = true;
  setStatus("En pause.");
  setButtons();
}

playButton.addEventListener("click", () => {
  if (playing) pausePlayback();
  else startPlayback();
});

stopButton.addEventListener("click", () => {
  resetPlayback();
  setStatus("Lecture arrêtée.");
});
[tempo, sustain, volume].forEach(slider => slider.addEventListener("input", updateSliders));
[tempo, sustain].forEach(slider => slider.addEventListener("change", () => {
  if (playing) startPlayback();
}));
document.addEventListener("visibilitychange", () => {
  if (document.hidden && playing) pausePlayback();
});
window.addEventListener("pagehide", resetPlayback);
window.addEventListener("resize", () => {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => {
    try { renderScore(); }
    catch (error) {
      // A resize is only a layout change; retain the working score and playback.
      console.warn("La partition précédente reste affichée.", error);
    }
  });
});
updateSliders();
recalculate();
