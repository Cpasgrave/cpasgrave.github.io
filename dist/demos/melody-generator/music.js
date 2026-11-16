"use strict";

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ' ";
const PITCHES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const DURATIONS = [
  ["Ronde pointée", 96, "1", true], ["Ronde", 64, "1"],
  ["Blanche pointée", 48, "2", true], ["Blanche", 32, "2"],
  ["Noire pointée", 24, "4", true], ["Noire", 16, "4"],
  ["Croche pointée", 12, "8", true], ["Croche", 8, "8"],
  ["Double croche pointée", 6, "16", true], ["Double croche", 4, "16"],
  ["Triple croche pointée", 3, "32", true], ["Triple croche", 2, "32"],
  ["Quadruple croche", 1, "64"],
  ["Pause", 64, "1r"], ["Demi-pause", 32, "2r"],
  ["Soupir", 16, "4r"], ["Demi-soupir", 8, "8r"],
].map(([name, ticks, duration, dotted = false]) =>
  ({ name, ticks, duration, dotted, rest: duration.endsWith("r") }));

// Version 1.6 used base 64 and this same alphabet for both inputs.
function digitsFor(text, base, convert) {
  const normalized = text.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[‘’]/g, "'")
    .replace(/œ/g, "oe").replace(/Œ/g, "OE")
    .replace(/æ/g, "ae").replace(/Æ/g, "AE")
    .replace(/\s/g, " ");
  const values = Array.from(normalized, char => ALPHABET.indexOf(char));
  if (values.some(value => value < 0)) {
    throw new Error("Utilise des lettres, des chiffres, des espaces ou des apostrophes.");
  }
  if (!normalized.trim()) return [];
  if (!convert) {
    if (values.some(value => value >= base)) {
      throw new Error(`Saisis des caractères parmi ${ALPHABET.slice(0, base).trimEnd()} ou active la conversion.`);
    }
    return values;
  }
  if (base === 1) return values.map(() => 0);
  const inputBase = BigInt(ALPHABET.length);
  const outputBase = BigInt(base);
  let number = values.reduce((acc, value) => acc * inputBase + BigInt(value), BigInt(0));
  const result = [];
  do {
    result.push(Number(number % outputBase));
    number /= outputBase;
  } while (number > 0);
  return result.reverse();
}

function makeScale(tonic, mask, low, high) {
  if (!Number.isInteger(low) || !Number.isInteger(high) || low > high) {
    throw new Error("La note la plus basse doit précéder ou égaler la note la plus haute.");
  }
  const scale = [];
  for (let pitch = low; pitch <= high; pitch++) {
    if (mask[(pitch - tonic + 12) % 12] === "1") scale.push(pitch);
  }
  return scale;
}

function makeMelody(melody, rhythm, scale, durations, convert) {
  if (!scale.length) throw new Error("Choisis une tessiture qui contient une note de la gamme.");
  const rhythms = digitsFor(rhythm, durations.length, convert);
  let start = 0;
  return digitsFor(melody, scale.length, convert).map((digit, index) => {
    const duration = durations[rhythms[index] ?? 0];
    const note = { ...duration, pitch: scale[digit], start };
    start += note.ticks;
    return note;
  });
}

function noteName(pitch) {
  return PITCHES[pitch % 12] + (Math.floor(pitch / 12) - 1);
}
