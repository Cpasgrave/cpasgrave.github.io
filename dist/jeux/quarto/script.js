"use strict";

const byId = id => document.getElementById(id);
const pieces = [...document.querySelectorAll("#pawnset .pawn")];
const cells = [...document.querySelectorAll("#board_table td")];
const panels = ["nGbox", "rules", "settings"];
let state = Quarto.initialState();
let mode = "ai";
let level = 3;
let keyboardPiece = null;
let worker = null;
let generation = 0;
let started = false;
let popup = true;
let activePanel = "nGbox";
let previousFocus = null;
let drag = null;
const soundVolume = () => Number(byId("sound-volume").value) / 100;
const woodSound = createWoodAudio({ enabled: () => byId("sound-enabled").checked, volume: soundVolume });
const motion = createPieceMotion(pieces, { sound: woodSound });
const legacySounds = new Set();
document.addEventListener("pointerdown", woodSound.unlock, { capture: true });
document.addEventListener("keydown", woodSound.unlock, { capture: true });
document.addEventListener("visibilitychange", () => { if (document.hidden) stopSounds(); });
window.addEventListener("pagehide", stopSounds);
let animating = false;
let motionMessage = "";
let transitionGeneration = 0;
let aiTimer = null;
let fallbackTimer = null;

function cancelAI() {
  generation++;
  clearTimeout(aiTimer);
  clearTimeout(fallbackTimer);
  aiTimer = fallbackTimer = null;
  worker?.terminate();
  worker = null;
}
function humanTurn() {
  return started && !popup && !animating && state.phase !== "over" && !(mode === "ai" && state.turn === 1);
}
function cancelMotion() {
  transitionGeneration++;
  motion.cancel();
  animating = false;
  motionMessage = "";
}
function canDrag(piece) {
  return humanTurn() && (state.phase === "choose" ? state.remaining.includes(piece) : state.pending === piece);
}
function openPanel(id) {
  previousFocus = document.activeElement;
  popup = true;
  cancelMotion();
  activePanel = id;
  keyboardPiece = null;
  drag?.cancel();
  stopSounds();
  document.body.classList.add("panel-open");
  cancelAI();
  for (const panel of panels) byId(panel).hidden = panel !== id;
  byId("overlay").hidden = false;
  render();
  byId(id).querySelector("button, input")?.focus();
}
function closePanel() {
  popup = false;
  activePanel = null;
  document.body.classList.remove("panel-open");
  for (const panel of panels) byId(panel).hidden = true;
  byId("overlay").hidden = true;
  render();
  if (previousFocus?.checkVisibility()) previousFocus.focus();
  else pieces.find(element => element.tabIndex === 0)?.focus();
}
function playSound(path) {
  if (!byId("sound-enabled").checked) return;
  const audio = new Audio(path);
  audio.volume = soundVolume() * .55;
  legacySounds.add(audio);
  audio.onended = () => legacySounds.delete(audio);
  audio.play().catch(() => legacySounds.delete(audio));
}
function stopSounds() {
  woodSound.stopAll();
  for (const audio of legacySounds) audio.pause();
  legacySounds.clear();
}
function startGame(nextMode) {
  cancelAI();
  cancelMotion();
  mode = nextMode;
  const first = started ? 1 - Number(byId("nGbox").dataset.first || 0) : 0;
  byId("nGbox").dataset.first = first;
  state = Quarto.initialState(first);
  keyboardPiece = null;
  started = true;
  closePanel();
  playSound("./Sounds/door_open.mp3");
}
async function perform(action, { fromRect = null, slideSound = null } = {}) {
  if (animating) { slideSound?.stop(); return false; }
  const next = Quarto.applyAction(state, action);
  if (!next) { slideSound?.stop(); return false; }
  const before = motion.capture();
  const movingPiece = state.phase === "choose" ? action.piece : state.pending;
  const actor = state.turn === 0 ? "Joueur 1" : mode === "ai" ? "L’IA" : "Joueur 2";
  motionMessage = actor + (state.phase === "choose" ? " offre une pièce…" : " pose sa pièce…");
  animating = true;
  const token = ++transitionGeneration;
  state = next;
  keyboardPiece = null;
  render();
  await motion.play(before, { movingPiece, fromRect, slideSound });
  if (token !== transitionGeneration) return false;
  animating = false;
  motionMessage = "";
  if (state.phase === "over") playSound("./Sounds/game_over.mp3");
  render();
  return true;
}
function pieceName(piece) {
  return [piece & 8 ? "orange" : "verte", piece & 4 ? "haute" : "basse",
    piece & 2 ? "ronde" : "carrée", piece & 1 ? "creuse" : "pleine"].join(", ");
}
function render() {
  drag?.cancel();
  cancelAI();
  const canPlay = humanTurn();
  const name = state.turn === 0 ? "Joueur 1" : mode === "ai" ? "IA" : "Joueur 2";
  let status;
  if (animating) {
    status = motionMessage;
  } else if (state.phase === "over") {
    status = state.winner === null ? "Égalité — les 16 pièces sont posées." :
      (state.winner === 0 ? "Joueur 1" : mode === "ai" ? "L’IA" : "Joueur 2") + " gagne. Quarto !";
  } else if (mode === "ai" && state.turn === 1) {
    status = "L’IA réfléchit…";
  } else if (keyboardPiece !== null) {
    status = name + (state.phase === "choose" ? " · Pièce en main : Tab puis Entrée sur le réceptacle." :
      " · Pièce en main : Tab puis Entrée sur une case libre.");
  } else {
    status = name + (state.phase === "choose" ? " · Glisse une pièce dans le réceptacle pour l’offrir." :
      " · Dépose la pièce reçue sur une case libre.");
  }
  byId("game-status").textContent = status;
  byId("message2").textContent = state.phase === "choose" ? "Pièce à offrir" : "Pièce reçue";
  byId("chosen_spot").hidden = state.phase === "over" && !animating;
  document.querySelector(".game-table").setAttribute("aria-busy", String(animating));
  pieces.forEach((element, piece) => {
    const cell = state.board.indexOf(piece);
    const destination = cell >= 0 ? cells[cell].firstElementChild :
      state.pending === piece ? byId("pawn_box") : byId("pawnset");
    if (element.parentElement !== destination) destination.appendChild(element);
    element.classList.toggle("keyboard-held", piece === keyboardPiece);
    element.setAttribute("aria-disabled", String(!canDrag(piece)));
    element.setAttribute("aria-pressed", String(piece === keyboardPiece));
    element.tabIndex = canDrag(piece) && keyboardPiece === null ? 0 : -1;
  });
  cells.forEach((element, cell) => {
    const playable = canPlay && state.phase === "place" && state.board[cell] === null;
    element.classList.toggle("free", playable);
    element.classList.toggle("winning", !animating && Boolean(state.line?.includes(cell)));
    element.setAttribute("aria-disabled", String(!playable));
    element.setAttribute("aria-label", "Case " + (cell + 1) + (state.board[cell] === null ? ", vide" : ", " + pieceName(state.board[cell])));
    element.tabIndex = playable && keyboardPiece !== null ? 0 : -1;
  });
  const canGive = canPlay && state.phase === "choose" && keyboardPiece !== null;
  byId("chosen_spot").tabIndex = canGive ? 0 : -1;
  byId("chosen_spot").setAttribute("aria-disabled", String(!canGive));
  byId("chosen_spot").setAttribute("aria-label", state.phase === "choose" ? "Déposer la pièce à offrir" : "Pièce reçue");
  if (!popup && !animating && started && state.phase !== "over" && mode === "ai" && state.turn === 1) runAI();
}
function runAI() {
  const token = generation;
  const thinkingSince = performance.now();
  let accepted = false;
  const accept = action => {
    if (token !== generation || accepted) return;
    accepted = true;
    worker?.terminate();
    worker = null;
    // A fast search still leaves time to read the exchange before the piece moves.
    aiTimer = setTimeout(() => {
      if (token === generation) perform(action);
    }, Math.max(0, 480 - (performance.now() - thinkingSince)));
  };
  const fallback = () => {
    if (token !== generation || accepted) return;
    worker?.terminate();
    worker = null;
    // Browsers may forbid Workers for local files; keep that entry point playable.
    accept(Quarto.chooseAction(state, level, { timeMs: 150, nodes: 2000 }).action);
  };
  try {
    worker = new Worker("./ai-worker.js");
    worker.onmessage = ({ data }) => data.error ? fallback() : accept(data.action);
    worker.onerror = fallback;
    worker.postMessage({ state, level });
  } catch { fallbackTimer = setTimeout(fallback, 30); }
}

// Mouse and touch exclusively use dragging; Enter/Space provide a keyboard equivalent.
function keyboardActivate(element, handler) {
  element.addEventListener("keydown", event => {
    if (event.target !== element || !["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    handler();
  });
}
pieces.forEach((element, piece) => {
  element.setAttribute("role", "button");
  element.setAttribute("aria-label", "Pièce " + pieceName(piece));
  element.querySelector("img").alt = "";
  element.querySelector("img").draggable = false;
  keyboardActivate(element, () => {
    if (!canDrag(piece)) return;
    keyboardPiece = piece;
    render();
    (state.phase === "choose" ? byId("chosen_spot") : cells.find(cell => cell.tabIndex === 0))?.focus();
  });
});
cells.forEach((element, cell) => {
  element.setAttribute("role", "button");
  keyboardActivate(element, async () => {
    if (humanTurn() && state.phase === "place" && keyboardPiece === state.pending) {
      if (await perform({ cell })) pieces.find(piece => piece.tabIndex === 0)?.focus();
    }
  });
});
keyboardActivate(byId("chosen_spot"), async () => {
  if (humanTurn() && state.phase === "choose" && keyboardPiece !== null) {
    const piece = keyboardPiece;
    if (await perform({ piece }) && humanTurn()) pieces[piece].focus();
  }
});
drag = installPieceDrag({
  pieces, canDrag, sound: woodSound,
  onPickUp: () => { keyboardPiece = null; render(); },
  findTarget(piece, target) {
    if (!target || !humanTurn()) return null;
    if (state.phase === "choose" && target.closest("#chosen_spot")) {
      return { element: byId("chosen_spot"), action: { piece } };
    }
    if (state.phase === "place") {
      const element = target.closest("#board_table td");
      const cell = cells.indexOf(element);
      if (cell >= 0 && state.board[cell] === null) return { element, action: { cell } };
    }
    return null;
  },
  onDrop: perform
});
byId("G1P").onclick = () => startGame("ai");
byId("G2P").onclick = () => startGame("hotseat");
byId("new-game").onclick = () => openPanel("nGbox");
byId("rules_button").onclick = () => openPanel("rules");
byId("settings_button").onclick = () => openPanel("settings");
document.querySelectorAll("[data-close]").forEach(button => button.onclick = closePanel);
byId("overlay").onclick = () => { if (started) closePanel(); };
document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    if (popup && started) closePanel();
    else if (keyboardPiece !== null) {
      const piece = keyboardPiece;
      keyboardPiece = null;
      render();
      pieces[piece].focus();
    }
  }
  if (event.key === "Tab" && popup) {
    const focusable = [...byId(activePanel).querySelectorAll("button, input")];
    const index = focusable.indexOf(document.activeElement);
    if (event.shiftKey && index <= 0) { event.preventDefault(); focusable.at(-1)?.focus(); }
    else if (!event.shiftKey && (index < 0 || index === focusable.length - 1)) {
      event.preventDefault(); focusable[0]?.focus();
    }
  }
});
byId("ai-level").oninput = event => {
  level = Number(event.target.value);
  const profile = Quarto.LEVELS[level - 1];
  byId("level-value").textContent = level + " · " + profile.name;
  byId("level-description").textContent = profile.description;
  render();
};
byId("ai-level").dispatchEvent(new Event("input"));
function updateSoundSettings() {
  woodSound.updateSettings();
  if (!byId("sound-enabled").checked || soundVolume() === 0) stopSounds();
  else {
    woodSound.unlock();
    for (const audio of legacySounds) audio.volume = soundVolume() * .55;
  }
  byId("sound-volume-value").textContent = Math.round(soundVolume() * 100) + " %";
}
byId("sound-enabled").onchange = updateSoundSettings;
byId("sound-volume").oninput = updateSoundSettings;
openPanel("nGbox");
