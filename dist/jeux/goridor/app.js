(() => {
  'use strict';

  const rules = window.GoridorRules;
  const { BLACK, WHITE } = rules;
  const { createBoard, coordinate } = window.GoridorBoard;
  const byId = id => document.getElementById(id);
  const colors = { [BLACK]: 'Noirs', [WHITE]: 'Blancs' };
  const orientations = { horizontal: 'Horizontale', vertical: 'Verticale' };
  const errors = {
    occupied: 'Cette intersection est déjà occupée.',
    bounds: 'Choisissez une intersection du plateau.',
    stock: 'Ce joueur a posé toutes ses barrières.',
    edge: 'Choisissez un croisement de rigoles à l’intérieur du plateau.',
    overlap: 'Une barrière occupe déjà une partie de cette rigole.',
    betweenStones: 'Un segment passerait entre deux pierres déjà posées.',
    lastLiberty: 'Cette barrière enlèverait toutes les libertés d’un groupe.',
    crossing: 'Les barrières ne peuvent pas se croiser.',
    suicide: 'Ce coup laisse un de vos groupes sans liberté.',
    ko: 'Ko. Jouez ailleurs avant de reprendre ici.',
  };

  const canvas = byId('board');
  const board = createBoard(canvas);
  const setup = byId('setup');
  const restartDialog = byId('restart-dialog');
  const rulesDialog = byId('rules-dialog');
  const stoneMode = byId('stone-mode');
  const wallMode = byId('wall-mode');
  const rotateButton = byId('rotate');
  const floatingWall = byId('floating-wall');
  const confirmMove = byId('confirm-move');
  const confirmScore = byId('confirm-score');
  const feedback = byId('feedback');
  const sound = byId('sound');
  const aim = byId('aim');

  let game = rules.createGame(9);
  let phase = 'setup';
  let mode = 'stone';
  let orientation = 'horizontal';
  let pointerType = 'mouse';
  let drag = null;
  let ignoreWallClick = false;
  let hover = null;
  let pending = null;
  let keyboard = null;
  let dead = new Set();
  let count = null;
  let countApproval = BLACK;
  let audio = null;
  let computer = false;
  let allowHistory = false;
  let frames = [];
  let cursor = 0;
  let worker = null;

  const computerTurn = () => phase === 'play' && computer && game.turn === WHITE;

  function snapshot(move, label) {
    return { game, phase, move, label, dead: new Set(dead), count, countApproval };
  }

  function updateScoreFrame() {
    if (allowHistory) frames[cursor] = snapshot(frames[cursor].move, frames[cursor].label);
  }

  function stopComputer() {
    if (worker) worker.terminate();
    worker = null;
  }

  function navigate(index) {
    if (!allowHistory || index < 0 || index >= frames.length) return;
    stopComputer();
    cancelWallDrag();
    cursor = index;
    const frame = frames[index];
    ({game, phase, count, countApproval} = frame);
    dead = new Set(frame.dead);
    mode = 'stone';
    hover = pending = keyboard = null;
    aim.textContent = '';
    announce(frame.label);
    refresh();
  }

  function record(move, label) {
    if (allowHistory) {
      const next = frames[cursor + 1]?.move;
      if (next && ['type','row','col','orientation'].every(key => next[key] === move[key])) {
        navigate(cursor + 1);
        if (cursor === frames.length - 1 && computerTurn()) requestComputer();
        return;
      }
      frames.splice(cursor + 1, frames.length, snapshot(move, label));
      cursor++;
    }
    announce(label);
    refresh();
    if (computerTurn()) requestComputer();
  }

  function requestComputer() {
    if (!computerTurn() || worker) return;
    try {
      const current = new Worker('ai-worker.js?v=mc2');
      worker = current;
      current.onmessage = ({data}) => {
        if (current !== worker) return;
        stopComputer();
        applyMove(data);
      };
      current.onerror = () => {
        if (current !== worker) return;
        stopComputer();
        refresh();
        announce('Calcul interrompu. Vous pouvez relancer le coup des Blancs.', true);
      };
      current.postMessage(game);
      refresh();
    } catch {
      stopComputer();
      refresh();
      announce('Impossible de démarrer le calcul des Blancs.', true);
    }
  }

  const samePoint = (first, second) => first?.row === second?.row && first?.col === second?.col;
  const number = value => value.toLocaleString('fr-FR');
  const positionLabel = target => coordinate(target.row, target.col, game.size);

  function describeTarget(target, type = mode) {
    const start = positionLabel(target);
    if (type === 'stone') return start;
    const end = coordinate(target.row + 1, target.col + 1, game.size);
    return start + '–' + end;
  }

  function announce(message = '', error = false) {
    feedback.textContent = message;
    feedback.classList.toggle('error', error);
  }

  function playSound(type) {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (sound.getAttribute('aria-pressed') !== 'true' || !Audio) return;
    try {
      audio ??= new Audio();
      if (audio.state === 'suspended') audio.resume().catch(() => {});
      const start = audio.currentTime;
      const barrier = type === 'wall';
      const duration = barrier ? .13 : .07;
      const samples = Math.round(audio.sampleRate * duration);
      const buffer = audio.createBuffer(1, samples, audio.sampleRate);
      const data = buffer.getChannelData(0);
      for (let index = 0; index < samples; index++) {
        const time = index / audio.sampleRate;
        const echo = barrier && time > .037 ? .50 * Math.exp(-66 * (time - .037)) : 0;
        data[index] = (Math.random() * 2 - 1) * (Math.exp(-77 * time) + echo);
      }
      const hit = audio.createBufferSource();
      hit.buffer = buffer;
      const filter = audio.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = barrier ? 850 : 2200;
      filter.Q.value = barrier ? .65 : 1.2;
      const gain = audio.createGain();
      gain.gain.value = barrier ? .46 : .40;
      hit.connect(filter).connect(gain).connect(audio.destination);
      hit.start(start);

      const tap = audio.createOscillator();
      const decay = audio.createGain();
      tap.frequency.setValueAtTime(barrier ? 186 : 545, start);
      tap.frequency.exponentialRampToValueAtTime(barrier ? 101 : 360, start + .049);
      decay.gain.setValueAtTime(barrier ? .15 : .10, start);
      decay.gain.exponentialRampToValueAtTime(.001, start + .056);
      tap.connect(decay).connect(audio.destination);
      tap.start(start);
      tap.stop(start + .06);
    } catch {
      // The board remains playable on browsers that restrict audio.
    }
  }

  function proposal(target) {
    return rules.play(game, { type: mode, ...target, orientation });
  }

  function draw() {
    const carrying = Boolean(drag?.active);
    const target = computerTurn() ? null : carrying ? drag.target : hover ?? pending ?? keyboard;
    wallMode.classList.toggle('carrying', carrying);
    document.body.classList.toggle('carrying-wall', carrying);
    floatingWall.hidden = !carrying || Boolean(target);
    if (!floatingWall.hidden) {
      floatingWall.dataset.orientation = orientation;
      floatingWall.style.setProperty('--drag-x', drag.x + 'px');
      floatingWall.style.setProperty('--drag-y', drag.y + 'px');
    }
    const wall = phase === 'play' && mode === 'wall';
    const invalid = phase === 'play' && target && Boolean(proposal(target).error);
    board.draw({ game, wallMode: wall, target, orientation, invalid, dead, score: count });
  }

  function updateMoveControls() {
    const wall = mode === 'wall';
    const selection = pending ? proposal(pending) : null;
    const hint = pending
      ? 'Touchez de nouveau ou confirmez la pose.'
      : wall
        ? 'Glissez la barrière ou visez un croisement de rigoles.'
        : 'Visez une intersection libre pour poser la pierre.';
    const locked = computerTurn();
    byId('move-hint').textContent = locked ? (worker ? 'L’IA choisit son coup.' : 'Utilisez les flèches ou relancez le coup des Blancs.') : hint;
    stoneMode.disabled = byId('pass').disabled = locked;
    stoneMode.setAttribute('aria-pressed', String(!wall));
    wallMode.setAttribute('aria-pressed', String(wall));
    wallMode.disabled = rotateButton.disabled = locked || game.stock[game.turn] === 0;
    wallMode.dataset.orientation = orientation;
    wallMode.setAttribute('aria-label', 'Barrière ' + orientations[orientation].toLowerCase());
    stoneMode.querySelector('.stone-icon').classList.toggle('white-stone', game.turn === WHITE);
    confirmMove.hidden = !pending;
    confirmMove.disabled = Boolean(selection?.error);
  }

  function updateCount() {
    if (!count) return;
    for (const [prefix, player] of [['black', BLACK], ['white', WHITE]]) {
      byId(prefix + '-territory').textContent = count.territory[player];
      byId(prefix + '-prisoners').textContent = count.captures[player];
      byId(prefix + '-total').textContent = number(count.totals[player]);
    }
    byId('count-hint').textContent = phase === 'done'
      ? (computer ? 'Score validé.' : 'Score validé par les deux joueurs.')
      : 'Sélectionnez un groupe pour le marquer mort ou le rétablir.';
    confirmScore.textContent = computer ? 'Valider le score' : 'Valider pour les ' + colors[countApproval];
    confirmScore.hidden = phase === 'done';
  }

  function turnLabel() {
    if (computerTurn()) return worker ? 'Les Blancs réfléchissent…' : 'Aux Blancs de jouer';
    if (phase === 'play') return 'Aux ' + colors[game.turn] + ' de jouer';
    if (phase === 'count') return 'Décompte';
    if (phase === 'done') {
      const difference = count.totals[BLACK] - count.totals[WHITE];
      if (!difference) return 'Partie nulle';
      const winner = difference > 0 ? BLACK : WHITE;
      const margin = Math.abs(difference);
      return 'Les ' + colors[winner] + ' gagnent de ' + number(margin) + (margin > 1 ? ' points' : ' point');
    }
    return '';
  }

  function refresh() {
    const playing = phase === 'play';
    const interactive = (playing && !computerTurn()) || phase === 'count';
    byId('history').hidden = phase === 'setup' || !allowHistory;
    if (allowHistory) {
      byId('previous').disabled = cursor === 0;
      byId('next').disabled = cursor >= frames.length - 1;
      byId('ply').textContent = 'Coup ' + cursor + ' / ' + (frames.length - 1);
    }
    byId('ai-resume').hidden = !computerTurn() || Boolean(worker);
    byId('opponent-label').textContent = phase === 'setup' ? 'Jeu local' : computer ? 'IA Monte-Carlo · Blancs' : 'Deux joueurs · en local';
    setup.hidden = phase !== 'setup';
    byId('restart').hidden = phase === 'setup';
    byId('game-controls').hidden = phase === 'setup';
    byId('play-controls').hidden = !playing;
    byId('scoring').hidden = !count;
    byId('board-size').textContent = 'Plateau ' + game.size + ' × ' + game.size;
    const title = turnLabel();
    if (byId('turn-label').textContent !== title) byId('turn-label').textContent = title;
    for (const [prefix, player] of [['black', BLACK], ['white', WHITE]]) {
      byId('player-' + prefix).classList.toggle('active', playing && game.turn === player);
      byId(prefix + '-captures').textContent = game.captures[player];
      byId(prefix + '-stock').textContent = game.stock[player];
    }
    canvas.tabIndex = interactive ? 0 : -1;
    canvas.toggleAttribute('data-interactive', interactive);
    canvas.setAttribute('aria-label', 'Plateau de Goridor, ' + game.size + ' par ' + game.size);
    if (interactive) canvas.setAttribute('aria-describedby', 'keyboard-help');
    else canvas.removeAttribute('aria-describedby');
    if (playing) updateMoveControls();
    updateCount();
    draw();
  }

  function start(size, focusBoard, options) {
    stopComputer();
    computer = options.querySelector('[data-opponent]').value === 'computer';
    allowHistory = options.querySelector('[data-history]').checked;
    if (restartDialog.open) restartDialog.close();
    game = rules.createGame(size);
    phase = 'play';
    mode = 'stone';
    orientation = 'horizontal';
    cancelWallDrag();
    hover = pending = keyboard = null;
    dead = new Set();
    count = null;
    countApproval = BLACK;
    cursor = 0;
    frames = allowHistory ? [snapshot(null, 'Début de partie.')] : [];
    aim.textContent = '';
    announce();
    refresh();
    if (focusBoard) canvas.focus({ preventScroll: true });
  }

  function setMode(next, focusBoard) {
    if (phase !== 'play' || computerTurn() || (next === 'wall' && !game.stock[game.turn])) return;
    if (mode !== next) {
      mode = next;
      hover = pending = keyboard = null;
      aim.textContent = '';
      announce();
      updateMoveControls();
      draw();
    }
    if (focusBoard) canvas.focus({ preventScroll: true });
  }

  function rotate() {
    if (phase !== 'play' || computerTurn() || !game.stock[game.turn]) return;
    orientation = orientation === 'horizontal' ? 'vertical' : 'horizontal';
    aim.textContent = 'Barrière ' + orientations[orientation].toLowerCase() + '.';
    updateMoveControls();
    draw();
  }

  function wallDragPosition(event) {
    const x = event.clientX;
    const y = event.clientY - (event.pointerType === 'touch' ? 22 : 0);
    return { x, y, target: board.pick({ clientX: x, clientY: y }, true) };
  }

  function cancelWallDrag() {
    if (!drag) return;
    const { id } = drag;
    drag = null;
    if (wallMode.hasPointerCapture(id)) wallMode.releasePointerCapture(id);
  }

  function commit(target) {
    if (phase !== 'play' || computerTurn()) return;
    const move = { type: mode, row: target.row, col: target.col };
    if (mode === 'wall') move.orientation = orientation;
    applyMove(move);
  }

  function applyMove(move) {
    const player = game.turn;
    let label;
    if (move.type === 'pass') {
      game = rules.pass(game);
      label = 'Les ' + colors[player] + ' passent.';
      if (game.passes === 2) {
        phase = 'count';
        count = rules.score(game, dead);
        label += ' Deux passes de suite. Le décompte commence.';
      }
    } else {
      const result = rules.play(game, move);
      if (result.error) {
        announce(errors[result.error], true);
        refresh();
        return;
      }
      const captures = result.game.captures[player] - game.captures[player];
      const action = move.type === 'stone' ? 'Pierre' : 'Barrière ' + orientations[move.orientation].toLowerCase();
      const after = captures ? ' · ' + captures + (captures === 1 ? ' capture' : ' captures') : '';
      label = colors[player] + ' · ' + action + ' en ' + describeTarget(move, move.type) + after + '.';
      playSound(move.type);
      game = result.game;
    }
    cancelWallDrag();
    mode = 'stone';
    hover = pending = keyboard = null;
    aim.textContent = '';
    record(move, label);
  }

  function toggleDead(target) {
    const point = target.row * game.size + target.col;
    if (!game.stones[point]) return;
    const { points } = rules.groupAt(game.stones, game.size, game.edges, point);
    const remove = dead.has(point);
    for (const member of points) {
      if (remove) dead.delete(member);
      else dead.add(member);
    }
    countApproval = BLACK;
    count = rules.score(game, dead);
    updateScoreFrame();
    announce('Groupe en ' + positionLabel(target) + (remove ? ' rétabli.' : ' marqué mort.'));
    refresh();
  }

  function boardAction(target, stageTouch = false) {
    if (phase === 'count') {
      toggleDead(target);
    } else if (phase === 'play' && !computerTurn()) {
      if (stageTouch && !samePoint(target, pending)) {
        pending = target;
        hover = keyboard = null;
        const { error } = proposal(target);
        announce(error ? errors[error] : 'Visée en ' + describeTarget(target) + '.', Boolean(error));
        updateMoveControls();
        draw();
      } else {
        commit(target);
      }
    }
  }

  canvas.addEventListener('pointerdown', event => { pointerType = event.pointerType; });
  canvas.addEventListener('pointermove', event => {
    if (computerTurn() || (phase !== 'play' && phase !== 'count') || event.pointerType !== 'mouse') return;
    const target = board.pick(event, mode === 'wall');
    if (samePoint(hover, target) && !keyboard) return;
    hover = target;
    keyboard = null;
    draw();
  });
  canvas.addEventListener('pointerleave', () => {
    if (!hover) return;
    hover = null;
    draw();
  });
  canvas.addEventListener('click', event => {
    if (computerTurn() || (phase !== 'play' && phase !== 'count')) return;
    const target = board.pick(event, mode === 'wall');
    if (!target) {
      if (phase === 'play') announce(mode === 'wall' ? errors.edge : errors.bounds, true);
      return;
    }
    const pointer = event.pointerType || pointerType;
    boardAction(target, pointer === 'touch' || pointer === 'pen');
  });
  canvas.addEventListener('blur', () => {
    if (!keyboard) return;
    keyboard = null;
    draw();
  });
  canvas.addEventListener('keydown', event => {
    if (computerTurn() || (phase !== 'play' && phase !== 'count')) return;
    const directions = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    const delta = directions[event.key];
    if (!delta && event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    const limit = game.size - (mode === 'wall' ? 2 : 1);
    const center = Math.ceil(limit / 2);
    const target = keyboard ?? hover ?? pending ?? { row: center, col: center };
    hover = pending = null;
    if (delta) {
      const bound = value => Math.min(limit, Math.max(0, value));
      keyboard = { row: bound(target.row + delta[0]), col: bound(target.col + delta[1]) };
      aim.textContent = describeTarget(keyboard) + '.';
      updateMoveControls();
      draw();
    } else if (!event.repeat) {
      keyboard = target;
      boardAction(target);
      draw();
    }
  });

  stoneMode.addEventListener('click', event => setMode('stone', event.detail === 0));
  wallMode.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0 || drag || wallMode.disabled) return;
    ignoreWallClick = false;
    drag = { id: event.pointerId, startX: event.clientX, startY: event.clientY, active: false };
    wallMode.setPointerCapture(event.pointerId);
    setMode('wall', false);
  });
  wallMode.addEventListener('pointermove', event => {
    if (drag?.id !== event.pointerId) return;
    if (!drag.active) {
      if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 5) return;
      drag.active = ignoreWallClick = true;
      hover = pending = keyboard = null;
      updateMoveControls();
    }
    Object.assign(drag, wallDragPosition(event));
    draw();
  });
  wallMode.addEventListener('pointerup', event => {
    if (drag?.id !== event.pointerId) return;
    const target = drag.active ? wallDragPosition(event).target : null;
    drag = null;
    if (target) commit(target);
    draw();
  });
  for (const type of ['pointercancel', 'lostpointercapture']) {
    wallMode.addEventListener(type, event => {
      if (drag?.id !== event.pointerId) return;
      drag = null;
      draw();
    });
  }
  wallMode.addEventListener('click', event => {
    if (ignoreWallClick && event.detail !== 0) {
      ignoreWallClick = false;
      return;
    }
    setMode('wall', event.detail === 0);
  });
  rotateButton.addEventListener('click', rotate);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && drag) {
      cancelWallDrag();
      draw();
      return;
    }
    if (event.key.toLowerCase() === 'r' && !event.ctrlKey && !event.altKey &&
        !event.metaKey && !event.repeat && !rulesDialog.open && !restartDialog.open) {
      rotate();
    }
  });
  confirmMove.addEventListener('click', () => { if (pending) commit(pending); });
  byId('pass').addEventListener('click', () => {
    if (phase === 'play' && !computerTurn()) applyMove({type:'pass'});
  });
  byId('previous').addEventListener('click', () => navigate(cursor - 1));
  byId('next').addEventListener('click', () => navigate(cursor + 1));
  byId('ai-resume').addEventListener('click', requestComputer);
  confirmScore.addEventListener('click', () => {
    if (countApproval === BLACK && !computer) {
      countApproval = WHITE;
      announce('Décompte validé par les Noirs.');
    } else {
      phase = 'done';
      hover = pending = keyboard = null;
      announce();
    }
    updateScoreFrame();
    refresh();
  });
  document.querySelectorAll('button[data-size]').forEach(button => {
    const size = Number(button.dataset.size);
    button.querySelector('.size-stock').textContent = rules.STOCK[size] + ' barrières chacun';
    button.addEventListener('click', event => start(size, event.detail === 0, button.closest('#setup, dialog')));
    button.disabled = false;
  });
  byId('restart').addEventListener('click', () => {
    byId('restart-note').hidden = phase === 'done';
    restartDialog.querySelector('[data-opponent]').value = computer ? 'computer' : 'human';
    restartDialog.querySelector('[data-history]').checked = allowHistory;
    restartDialog.showModal();
  });
  byId('open-rules').addEventListener('click', () => rulesDialog.showModal());
  sound.addEventListener('click', () => {
    const enabled = sound.getAttribute('aria-pressed') !== 'true';
    sound.setAttribute('aria-pressed', String(enabled));
    sound.title = enabled ? 'Couper le son' : 'Activer le son';
  });

  refresh();
})();
