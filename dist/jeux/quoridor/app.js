"use strict";
const Q = Quoridor, $ = id => document.getElementById(id);
const board = $('board'), frame = $('board-frame'), statusNode = $('status'), hint = $('hint');
const wallTarget = $('wall-preview');
const setup = $('setup-dialog'), rules = $('rules-dialog'), win = $('win-dialog');
const PAWNS = [
  { color: 'brun noir', image: 'brun-noir' },
  { color: 'beige', image: 'beige' },
  { color: 'vert feuille', image: 'vert' },
  { color: 'orange terre cuite', image: 'orange' }
];
const GOALS = { N: 'le haut', E: 'la droite', S: 'le bas', W: 'la gauche' };
const ARROWS = { N: '↑', E: '→', S: '↓', W: '←' };
const STORAGE = 'cepagrave-quoridor-settings-v1';
const defaults = () => ({ count: 2, seats: Array.from({ length: 4 }, (_, i) => ({ type: i === 0 ? 'human' : 'ai', level: 3 })), sound: true, volume: 30, starter: '0' });
let config = defaults();
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE));
  if (saved && [2, 4].includes(saved.count) && saved.seats?.length === 4) {
    config = { ...config, ...saved, seats: saved.seats.map(s => ({ type: s.type === 'human' ? 'human' : 'ai', level: Math.max(1, Math.min(8, Number(s.level) || 3)) })) };
    config.volume = Math.max(0, Math.min(100, Number(config.volume) || 0));
  }
} catch { /* Storage is optional, including private browsing. */ }
let state = Q.createGame(config.count), history = [], active = false;
let interaction = 'move', orientation = 'h', preview = null, drag = null;
let animating = false, thinking = false, epoch = 0, worker = null, aiTimer = 0, watchdog = 0;
let suppressClickUntil = 0, currentLegal = [], legalWallKeys = new Set();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const audio = createWoodAudio({ enabled: () => config.sound, volume: () => config.volume / 100, synthesis: QuoridorSounds });
const dialogsOpen = () => setup.open || rules.open || win.open;
const humanTurn = () => active && state.winner === null && config.seats[state.turn].type === 'human' && !animating && !dialogsOpen();
const label = i => `Joueur ${i + 1}`;
const cellName = position => `${String.fromCharCode(65 + position % 9)}${9 - Math.floor(position / 9)}`;
const wallKey = wall => `${wall.o}${wall.r}${wall.c}`;
const pieceHTML = i => `<img src="assets/pion-${PAWNS[i].image}.webp" alt="" draggable="false">`;
const tokenHTML = i => `<div class="pawn-token finish-${i}">${pieceHTML(i)}</div>`;
function saveConfig() { try { localStorage.setItem(STORAGE, JSON.stringify(config)); } catch {} }

const cells = Array.from({ length: 81 }, (_, position) => {
  const cell = document.createElement('button');
  cell.type = 'button'; cell.className = 'cell'; cell.dataset.position = position;
  cell.style.left = `${position % 9 * 100 / 9 + 2 / 3}%`;
  cell.style.top = `${Math.floor(position / 9) * 100 / 9 + 2 / 3}%`;
  cell.style.backgroundPosition = `center,${position % 9 * 37}px ${Math.floor(position / 9) * 42}px`;
  cell.setAttribute('aria-label', `Case ${cellName(position)}`);
  cell.addEventListener('click', () => { if (performance.now() > suppressClickUntil && humanTurn() && interaction === 'move' && !drag) perform({ type: 'move', to: position }); });
  $('cells').append(cell);
  return cell;
});
const slots = [];
for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
  const slot = document.createElement('button');
  slot.type = 'button'; slot.className = 'wall-slot'; slot.style.left = `${(c + 1) / 9 * 100}%`; slot.style.top = `${(r + 1) / 9 * 100}%`;
  slot.addEventListener('focus', () => showPreview({ r, c, o: orientation }));
  slot.addEventListener('click', event => { event.stopPropagation(); if (performance.now() > suppressClickUntil) attemptWall({ r, c, o: orientation }); });
  slot.dataset.r = r; slot.dataset.c = c; $('wall-slots').append(slot); slots.push(slot);
}

function cancelAI() {
  epoch++; clearTimeout(aiTimer); clearTimeout(watchdog);
  worker?.terminate(); worker = null; thinking = false;
}
function wallPosition(element, wall) {
  element.classList.remove('h', 'v'); element.classList.add(wall.o);
  element.style.left = `${(wall.c + 1) / 9 * 100}%`; element.style.top = `${(wall.r + 1) / 9 * 100}%`;
}
function message(text = '', error = false) {
  // The table stays quiet. Only an invalid action needs a visible explanation.
  hint.textContent = error ? text : ''; hint.hidden = !error;
  hint.classList.toggle('error', error);
}
function showPreview(wall) {
  if (!humanTurn() || interaction !== 'wall') return;
  preview = wall;
  const error = Q.wallError(state, wall);
  wallPosition(wallTarget, wall);
  wallTarget.classList.toggle('invalid', Boolean(error));
  wallTarget.hidden = false;
  message(error, Boolean(error));
}
function clearPreview() { preview = null; wallTarget.hidden = true; }
function updateInteractions() {
  const enabled = humanTurn();
  currentLegal = enabled ? Q.moves(state) : [];
  legalWallKeys = enabled && state.players[state.turn].walls ? new Set(Q.legalWalls(state).map(wallKey)) : new Set();
  cells.forEach((cell, position) => {
    const legal = enabled && interaction === 'move' && !drag && currentLegal.includes(position);
    cell.disabled = !legal;
  });
  board.classList.toggle('placing-wall', enabled && interaction === 'wall');
  slots.forEach(slot => {
    const wall = { r: Number(slot.dataset.r), c: Number(slot.dataset.c), o: orientation };
    slot.disabled = !(enabled && interaction === 'wall'); slot.tabIndex = enabled && interaction === 'wall' ? 0 : -1;
    slot.setAttribute('aria-label', `Barrière ${orientation === 'h' ? 'horizontale' : 'verticale'} près de ${cellName(wall.r * 9 + wall.c)}${legalWallKeys.has(wallKey(wall)) ? '' : ', emplacement indisponible'}`);
  });
  const canWall = enabled && state.players[state.turn].walls > 0;
  for (const id of ['wall-source', 'rotate']) $(id).disabled = !canWall;
  $('wall-source').classList.toggle('vertical', orientation === 'v');
  $('wall-source').classList.toggle('wall-held', interaction === 'wall');
  $('wall-source').querySelector('.barrier').hidden = state.players[state.turn].walls === 0;
  $('wall-source').setAttribute('aria-label', interaction === 'wall' ? 'Reposer la barrière dans la réserve' : `Prendre une barrière ${orientation === 'h' ? 'horizontale' : 'verticale'}`);
  $('wall-source').setAttribute('aria-pressed', interaction === 'wall');
  $('undo').disabled = !history.length || animating;
  $('undo').textContent = config.seats.slice(0, config.count).some(s => s.type === 'human') ? '↶ Revenir à mon tour' : '↶ Revenir d’un coup';
  for (const id of ['settings-open', 'rules-open', 'new-game']) $(id).disabled = animating;
  board.querySelectorAll('.pawn').forEach((pawn, i) => { pawn.disabled = !(enabled && i === state.turn && interaction === 'move'); pawn.dataset.current = enabled && i === state.turn && interaction === 'move'; });
}
function render() {
  document.body.classList.toggle('four-players', state.players.length === 4);
  $('walls').replaceChildren();
  state.walls.forEach(wall => { const element = document.createElement('div'); element.className = 'barrier'; wallPosition(element, wall); $('walls').append(element); });
  $('pawns').replaceChildren();
  state.players.forEach((player, i) => {
    const pawn = document.createElement('button'); pawn.type = 'button'; pawn.className = `pawn finish-${i}`; pawn.dataset.player = i;
    pawn.setAttribute('aria-label', `${label(i)}, pion ${PAWNS[i].color} en ${cellName(player.position)}, arrivée vers ${GOALS[player.goal]}`);
    pawn.style.left = `${(player.position % 9 + .5) / 9 * 100}%`; pawn.style.top = `${(Math.floor(player.position / 9) + .5) / 9 * 100}%`;
    pawn.innerHTML = pieceHTML(i);
    pawn.addEventListener('pointerdown', event => beginDrag(event, 'move', pawn));
    pawn.addEventListener('click', () => { if (performance.now() > suppressClickUntil && humanTurn()) setMode('move'); });
    $('pawns').append(pawn);
  });
  $('players').innerHTML = state.players.map((player, i) => `<section class="player-card finish-${i}${state.turn === i && state.winner === null ? ' active' : ''}"${state.turn === i && state.winner === null ? ' aria-current="true"' : ''} aria-label="${label(i)}, pion ${PAWNS[i].color}, ${config.seats[i].type === 'human' ? 'humain' : 'IA niveau ' + config.seats[i].level}">
    <header>${tokenHTML(i)}<div class="player-identity"><h3>${label(i)}</h3><p>${config.seats[i].type === 'human' ? 'Humain' : `IA · niveau ${config.seats[i].level}`}</p></div></header>
    <div class="wall-tally" aria-label="${player.walls} barrières restantes">${'<i aria-hidden="true"></i>'.repeat(player.walls)}</div>
    <span class="player-direction" role="img" aria-label="Arrivée vers ${GOALS[player.goal]}">${ARROWS[player.goal]}</span></section>`).join('');
  for (const side of Object.keys(GOALS)) {
    const i = state.players.findIndex(player => player.goal === side);
    const marker = $(`goal-${side}`);
    marker.hidden = i < 0;
    marker.className = `goal-marker goal-${side.toLowerCase()}`;
    if (i >= 0) {
      marker.classList.add(`finish-${i}`);
      marker.setAttribute('aria-label', `Arrivée du ${label(i)}, pion ${PAWNS[i].color}`);
    }
  }
  document.body.classList.toggle('thinking', thinking);
  statusNode.textContent = state.winner !== null ? `${label(state.winner)} a trouvé son chemin !` : !active ? 'À deux ou à quatre, chacun son chemin.' : thinking ? `${label(state.turn)} réfléchit…` : config.seats[state.turn].type === 'ai' ? `${label(state.turn)} va jouer…` : `${label(state.turn)} — à toi de jouer`;
  $('reserve-heading').textContent = `${label(state.turn)} · réserve`;
  clearPreview(); updateInteractions();
  message();
}
function setMode(mode) {
  if (!humanTurn()) return;
  if (mode === 'wall' && !state.players[state.turn].walls) return;
  interaction = mode; clearPreview(); updateInteractions();
  message();
}
function rotateWall() {
  if (!humanTurn() || !state.players[state.turn].walls) return;
  orientation = orientation === 'h' ? 'v' : 'h';
  const old = preview; updateInteractions();
  if (drag?.kind === 'wall' && drag.ghost) sizeWallGhost(drag.ghost);
  if (old) showPreview({ ...old, o: orientation });
  else message();
}
function wallAt(x, y) {
  const rect = board.getBoundingClientRect();
  const nx = (x - rect.left) / rect.width, ny = (y - rect.top) / rect.height;
  if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return null;
  return { r: Math.max(0, Math.min(7, Math.round(ny * 9) - 1)), c: Math.max(0, Math.min(7, Math.round(nx * 9) - 1)), o: orientation };
}
function cellAt(x, y) {
  const rect = board.getBoundingClientRect();
  const c = Math.floor((x - rect.left) / rect.width * 9), r = Math.floor((y - rect.top) / rect.height * 9);
  return c >= 0 && c < 9 && r >= 0 && r < 9 ? r * 9 + c : -1;
}
function attemptWall(wall, origin) {
  if (!humanTurn() || !wall) return;
  const error = Q.wallError(state, wall);
  if (error) { showPreview(wall); message(error, true); return; }
  perform({ type: 'wall', ...wall }, origin);
}
function sizeWallGhost(ghost, direction = orientation) {
  const size = board.clientWidth;
  ghost.style.width = `${size * (direction === 'h' ? .215 : .023)}px`;
  ghost.style.height = `${size * (direction === 'h' ? .023 : .215)}px`;
}
function beginDrag(event, kind, source) {
  if (!humanTurn() || drag || event.button !== 0 || (kind === 'wall' && !state.players[state.turn].walls) || (kind === 'move' && interaction === 'wall')) return;
  const previousInteraction = interaction;
  audio.unlock(); setMode(kind === 'move' ? 'move' : 'wall');
  const rect = source.getBoundingClientRect();
  drag = { kind, previousInteraction, source, pointer: event.pointerId, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, lastTime: performance.now(), rect, ghost: null, sound: null };
  source.setPointerCapture(event.pointerId);
  updateInteractions();
}
function cancelDrag() {
  if (drag) {
    drag.sound?.stop(); drag.source.classList.remove('drag-source'); drag.ghost?.remove();
    if (drag.source.hasPointerCapture(drag.pointer)) drag.source.releasePointerCapture(drag.pointer);
  }
  drag = null; document.body.classList.remove('dragging');
  interaction = 'move'; clearPreview(); updateInteractions();
}
document.addEventListener('pointermove', event => {
  if (!drag || event.pointerId !== drag.pointer) return;
  if (!drag.ghost && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 5) {
    const ghost = document.createElement('div');
    ghost.className = drag.kind === 'move' ? `pawn drag-ghost finish-${state.turn}` : 'barrier drag-ghost';
    if (drag.kind === 'move') { ghost.innerHTML = pieceHTML(state.turn); ghost.style.width = `${drag.rect.width}px`; }
    else sizeWallGhost(ghost);
    document.body.append(ghost); drag.ghost = ghost; drag.source.classList.add('drag-source'); document.body.classList.add('dragging');
    if (drag.kind === 'move') drag.sound = audio.startSlide({ piece: state.turn });
  }
  if (!drag.ghost) return;
  event.preventDefault();
  const now = performance.now(), speed = Math.hypot(event.clientX - drag.x, event.clientY - drag.y) / Math.max(1, now - drag.lastTime) * 1000;
  drag.x = event.clientX; drag.y = event.clientY; drag.lastTime = now;
  drag.ghost.style.left = `${drag.x}px`; drag.ghost.style.top = `${drag.y}px`;
  drag.sound?.move({ speed, pan: (drag.x / innerWidth - .5) * .6 });
  if (drag.kind === 'wall') { const wall = wallAt(drag.x, drag.y); if (wall) showPreview(wall); else clearPreview(); }
}, { passive: false });
document.addEventListener('pointerup', event => {
  if (!drag || drag.pointer !== event.pointerId) return;
  const held = drag, moved = Boolean(held.ghost);
  const origin = { x: event.clientX, y: event.clientY, slide: held.sound };
  held.sound = null;
  cancelDrag();
  if (!moved) {
    // A tap toggles taking/returning the wall in the click handler below.
    interaction = held.previousInteraction; updateInteractions();
    return;
  }
  suppressClickUntil = performance.now() + 350;
  if (held.kind === 'wall') attemptWall(wallAt(origin.x, origin.y), origin);
  else {
    const to = cellAt(origin.x, origin.y);
    if (humanTurn() && Q.moves(state).includes(to)) perform({ type: 'move', to }, origin);
    else { origin.slide?.stop(); message('Ce déplacement n’est pas possible.', true); }
  }
});
document.addEventListener('pointercancel', cancelDrag);
board.addEventListener('pointermove', event => { if (!drag && interaction === 'wall') { const wall = wallAt(event.clientX, event.clientY); if (wall) showPreview(wall); } });
board.addEventListener('pointerleave', () => { if (!drag) clearPreview(); });
board.addEventListener('click', event => {
  if (performance.now() <= suppressClickUntil || interaction !== 'wall' || !humanTurn() || event.target.closest('.pawn')) return;
  attemptWall(wallAt(event.clientX, event.clientY));
});
$('wall-source').addEventListener('pointerdown', event => beginDrag(event, 'wall', $('wall-source')));
$('wall-source').addEventListener('click', () => { if (performance.now() > suppressClickUntil) setMode(interaction === 'wall' ? 'move' : 'wall'); });
$('rotate').addEventListener('click', rotateWall);
document.addEventListener('keydown', event => {
  if (dialogsOpen() || /INPUT|SELECT|TEXTAREA/.test(event.target.tagName)) return;
  if (event.key.toLowerCase() === 'r') { event.preventDefault(); rotateWall(); }
  if (event.key === 'Escape') { cancelDrag(); setMode('move'); }
});
document.addEventListener('pointerdown', () => audio.unlock(), { capture: true });
document.addEventListener('keydown', () => audio.unlock(), { capture: true });

async function animateAction(action, origin) {
  if (action.type === 'pass') return;
  const rect = board.getBoundingClientRect(), actor = state.turn;
  const movingPawn = action.type === 'move';
  const soundPiece = movingPawn ? actor : QuoridorSounds.BARRIER;
  const source = movingPawn ? board.querySelector(`[data-player="${actor}"]`) : $('wall-source');
  const fromRect = source.getBoundingClientRect();
  const from = origin || { x: fromRect.left + fromRect.width / 2, y: fromRect.top + fromRect.height / 2 };
  const column = movingPawn ? action.to % 9 + .5 : action.c + 1;
  const row = movingPawn ? Math.floor(action.to / 9) + .5 : action.r + 1;
  const to = {
    x: rect.left + board.clientLeft + column * board.clientWidth / 9,
    y: rect.top + board.clientTop + row * board.clientHeight / 9
  };
  if (reducedMotion.matches) {
    if (origin?.slide) origin.slide.stop({ landed: true });
    else audio.place({ piece: soundPiece });
    return;
  }
  const ghost = document.createElement('div');
  ghost.className = movingPawn ? `pawn drag-ghost finish-${actor}` : 'barrier drag-ghost';
  if (movingPawn) {
    ghost.innerHTML = pieceHTML(actor);
    ghost.style.width = `${fromRect.width}px`;
  } else sizeWallGhost(ghost, action.o);
  ghost.style.left = `${from.x}px`;
  ghost.style.top = `${from.y}px`;
  source.classList.add('drag-source');
  document.body.append(ghost);
  const duration = origin ? 180 : 440, started = performance.now();
  const slide = movingPawn ? (origin?.slide ?? audio.startSlide({ piece: soundPiece })) : null;
  let last = from, lastTime = started;
  await new Promise(resolve => {
    function step(now) {
      const t = Math.min(1, (now - started) / duration), eased = t * t * (3 - 2 * t);
      const x = from.x + (to.x - from.x) * eased, y = from.y + (to.y - from.y) * eased;
      ghost.style.left = `${x}px`; ghost.style.top = `${y}px`;
      slide?.move({ speed: Math.hypot(x - last.x, y - last.y) / Math.max(1, now - lastTime) * 1000, pan: (x / innerWidth - .5) * .6 });
      last = { x, y }; lastTime = now;
      if (t < 1) requestAnimationFrame(step); else resolve();
    }
    requestAnimationFrame(step);
  });
  slide?.stop({ landed: true }); if (!slide) audio.place({ piece: soundPiece });
  ghost.remove(); source.classList.remove('drag-source');
}
async function perform(action, origin) {
  if (!active || animating || state.winner !== null || dialogsOpen()) { origin?.slide?.stop(); return; }
  let next;
  try { next = Q.apply(state, action); } catch (error) { origin?.slide?.stop(); message(error.message, true); return; }
  cancelAI(); animating = true; clearPreview(); updateInteractions();
  const before = state, actor = state.turn;
  try { await animateAction(action, origin); }
  finally { animating = false; }
  history.push({ state: before, actor }); state = next; interaction = 'move';
  render();
  if (state.winner !== null) {
    $('winner-pawn').innerHTML = tokenHTML(state.winner);
    $('win-title').textContent = `${label(state.winner)} gagne !`;
    $('win-text').textContent = `Le pion ${PAWNS[state.winner].color} a rejoint son bord d’arrivée.`;
    win.showModal(); updateInteractions();
  } else scheduleTurn();
}
function scheduleTurn() {
  if (!active || state.winner !== null || animating || dialogsOpen() || document.hidden) return;
  cancelAI();
  if (config.seats[state.turn].type === 'human') {
    render();
    if (!Q.moves(state).length && !Q.legalWalls(state).length) aiTimer = setTimeout(() => perform({ type: 'pass' }), 500);
    return;
  }
  thinking = true; render();
  const id = epoch, began = performance.now(), currentState = state;
  const level = config.seats[state.turn].level;
  const trails = QuoridorAI.pawnTrails(state, history.slice(-32).map(entry => entry.state));
  const accept = result => {
    if (id !== epoch || currentState !== state || dialogsOpen() || !active) return;
    clearTimeout(watchdog); worker?.terminate(); worker = null;
    const action = result?.action || QuoridorAI.choose(state, level, { trails, budget: 40 }).action;
    aiTimer = setTimeout(() => { if (id === epoch) perform(action); }, Math.max(0, 550 - (performance.now() - began)));
  };
  try {
    worker = new Worker('ai-worker.js?v=8-arrivees');
    worker.onmessage = event => { if (event.data.id === id) accept(event.data); };
    worker.onerror = event => { event.preventDefault(); accept(null); };
    watchdog = setTimeout(() => accept(null), 6000);
    worker.postMessage({ id, state, level, trails });
  } catch { accept(null); }
}
$('undo').addEventListener('click', () => {
  if (!history.length || animating) return;
  cancelAI(); cancelDrag();
  let index = history.length - 1;
  const found = history.findLastIndex ? history.findLastIndex(entry => config.seats[entry.actor].type === 'human') : history.map(entry => config.seats[entry.actor].type === 'human').lastIndexOf(true);
  if (found >= 0) index = found;
  state = history[index].state; history = history.slice(0, index); interaction = 'move';
  render(); scheduleTurn();
});

function selectedCount() { return Number(document.querySelector('input[name="count"]:checked').value); }
let setupSeats;
let editingSettings = false;
function buildSeats(seats) {
  const count = selectedCount();
  $('seat-settings').innerHTML = Array.from({ length: count }, (_, i) => `<div class="seat-row">
    <div class="seat-heading">${tokenHTML(i)}<strong>${label(i)}</strong></div>
    <select id="controller-${i}" aria-label="Qui joue pour le joueur ${i + 1} ?"><option value="human"${seats[i].type === 'human' ? ' selected' : ''}>Humain</option><option value="ai"${seats[i].type === 'ai' ? ' selected' : ''}>IA</option></select>
    <div class="seat-level" id="level-row-${i}"${seats[i].type === 'human' ? ' hidden' : ''}><label for="level-${i}">Niveau de l’IA</label><output id="level-output-${i}" for="level-${i}">${seats[i].level} · ${QuoridorAI.LEVELS[seats[i].level].name}</output><input type="range" id="level-${i}" min="1" max="8" step="1" value="${seats[i].level}" aria-label="Niveau de l’IA du joueur ${i + 1}"></div></div>`).join('');
  for (let i = 0; i < count; i++) {
    $(`controller-${i}`).addEventListener('change', () => { $(`level-row-${i}`).hidden = $(`controller-${i}`).value === 'human'; });
    $(`level-${i}`).addEventListener('input', () => { const level = Number($(`level-${i}`).value); $(`level-output-${i}`).textContent = `${level} · ${QuoridorAI.LEVELS[level].name}`; });
  }
  const previousStarter = $('starter').value || config.starter;
  $('starter').innerHTML = '<option value="random">Tirage au sort</option>' + Array.from({ length: count }, (_, i) => `<option value="${i}">${label(i)}</option>`).join('');
  $('starter').value = previousStarter === 'random' || Number(previousStarter) < count ? previousStarter : '0';
  $('apply-settings').hidden = !editingSettings || count !== state.players.length;
}
function readSeats() {
  return setupSeats.map((seat, i) => ({
    type: $(`controller-${i}`)?.value ?? seat.type,
    level: Number($(`level-${i}`)?.value ?? seat.level)
  }));
}
document.querySelectorAll('input[name="count"]').forEach(radio => radio.addEventListener('change', () => {
  setupSeats = readSeats();
  buildSeats(setupSeats);
}));
function openSetup(mode = 'new') {
  if (animating) return;
  cancelAI(); cancelDrag(); audio.stopAll();
  editingSettings = active && mode === 'settings';
  setupSeats = config.seats;
  $('setup-title').textContent = mode === 'settings' ? 'Réglages' : 'Nouvelle partie';
  document.querySelector(`input[name="count"][value="${config.count}"]`).checked = true;
  $('sound-enabled').checked = config.sound; $('sound-volume').value = config.volume; $('sound-output').textContent = `${config.volume} %`;
  $('starter').value = config.starter; buildSeats(setupSeats);
  $('start-game').textContent = editingSettings ? 'Nouvelle partie' : active ? 'Commencer' : 'Jouer';
  setup.showModal(); render();
}
function collectSettings() {
  config = { count: selectedCount(), seats: readSeats(), sound: $('sound-enabled').checked, volume: Number($('sound-volume').value), starter: $('starter').value };
  saveConfig(); audio.updateSettings();
}
$('setup-form').addEventListener('submit', event => {
  event.preventDefault(); cancelAI(); collectSettings();
  const first = config.starter === 'random' ? Math.floor(Math.random() * config.count) : Number(config.starter);
  state = Q.createGame(config.count, first); history = []; active = true; interaction = 'move'; orientation = 'h';
  setup.close(); render(); scheduleTurn();
});
$('apply-settings').addEventListener('click', () => { if (selectedCount() !== state.players.length) return; cancelAI(); collectSettings(); setup.close(); render(); scheduleTurn(); });
$('sound-volume').addEventListener('input', () => { $('sound-output').textContent = `${$('sound-volume').value} %`; });
$('settings-open').addEventListener('click', () => openSetup('settings'));
$('new-game').addEventListener('click', () => openSetup());
$('play-again').addEventListener('click', () => { win.close(); openSetup(); });
$('rules-open').addEventListener('click', () => { cancelAI(); cancelDrag(); rules.showModal(); updateInteractions(); });
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => $(button.dataset.close).close()));
[setup, rules, win].forEach(dialog => dialog.addEventListener('close', () => { render(); scheduleTurn(); }));
document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelAI(); cancelDrag(); audio.stopAll(); } else if (!animating) scheduleTurn(); });
window.addEventListener('pagehide', () => { cancelAI(); cancelDrag(); audio.stopAll(); });
window.addEventListener('resize', () => { cancelDrag(); clearPreview(); });
render(); openSetup();
