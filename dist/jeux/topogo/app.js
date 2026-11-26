(() => {
  'use strict';

  const rules = TopogoRules;
  const drawing = TopogoBoard;
  const levels = TopogoLevels;
  const { BLACK, WHITE, WALL, STOCK } = rules;
  const $ = id => document.getElementById(id);
  const colors = { [BLACK]: 'Noirs', [WHITE]: 'Blancs' };
  const cellNames = ['', 'pierre noire', 'pierre blanche', 'barrière'];
  const errors = {
    edge: 'La barrière dépasse du plateau.',
    occupied: 'Cette intersection est déjà occupée.',
    stock: 'Cette barrière a déjà été utilisée.',
    suicide: 'Ce coup laisserait un de tes groupes sans liberté.',
    ko: 'Tu dois jouer ailleurs avant de reprendre ce ko.',
  };
  const formatter = new Intl.NumberFormat('fr-FR');
  const intersections = $('intersections');
  const tools = [$('stone'), $('wall-1'), $('wall-2')];
  const samples = tools.map(button => button.querySelector('canvas'));
  const goban = $('goban');
  const newDialog = $('new-dialog');
  const rulesDialog = $('rules-dialog');
  const setup = $('new-game');
  const setupLevel = $('setup-level');
  const matchLevel = $('match-level');
  let history, view, selection, orientation, focusPoint, hovered, geometry;
  let dead, neutral, tally, finished;
  let opponent = 'local', computerLevel = levels.defaultLevel;
  let worker = null, computerFailed = false;

  const live = () => history.at(-1);
  const shown = () => history[view];
  const reviewing = () => view < history.length - 1;
  const playing = () => !reviewing() && live().passes < 2;
  const computerTurn = () => playing() && opponent === 'computer' && live().turn === WHITE;
  const placing = () => playing() && !computerTurn();

  function announce(message = '') {
    $('message').textContent = message;
    $('message').hidden = !message;
  }

  function create(size, mode = opponent) {
    stopComputer();
    opponent = mode;
    history = [rules.createGame(size)];
    view = 0;
    selection = 0;
    orientation = 'horizontal';
    hovered = null;
    focusPoint = (size * size - 1) / 2;
    matchLevel.open = false;
    clearScore();
    buildIntersections(size);
    resize();
    announce();
    update();
  }

  function stopComputer() {
    worker?.terminate();
    worker = null;
    computerFailed = false;
  }

  function requestComputer() {
    if (!computerTurn() || worker || newDialog.open) return;
    const position = live();
    const fail = () => {
      stopComputer();
      computerFailed = true;
      update();
      announce(location.protocol === 'file:'
        ? 'Le mode contre l’IA s’ouvre depuis le site ou le serveur local.'
        : 'Le calcul des Blancs a été interrompu. Tu peux le relancer.');
    };
    try {
      const current = new Worker('ai-worker.js?v=monte-carlo');
      worker = current;
      computerFailed = false;
      announce();
      current.onmessage = ({ data: move }) => {
        if (current !== worker || live() !== position || !computerTurn()) return;
        const next = move?.type === 'pass' ? rules.pass(position) : move && rules.play(position, move).game;
        if (!next) {
          fail();
          return;
        }
        stopComputer();
        commit(next);
      };
      current.onerror = event => {
        if (current !== worker) return;
        event.preventDefault();
        fail();
      };
      current.postMessage({ game: position, level: computerLevel });
      update();
    } catch {
      fail();
    }
  }

  function clearScore() {
    tally = null;
    dead = new Set();
    neutral = new Set();
    finished = false;
  }

  function buildIntersections(size) {
    const fragment = document.createDocumentFragment();
    for (let point = 0; point < size * size; point++) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.point = point;
      fragment.append(button);
    }
    intersections.replaceChildren(fragment);
  }

  function resize() {
    const width = goban.clientWidth;
    if (!width) return;
    geometry = drawing.layout(width, live().size);
    const { margin, pitch } = geometry;
    intersections.style.setProperty('--offset', (margin - pitch / 2) + 'px');
    intersections.style.setProperty('--pitch', pitch + 'px');
    intersections.style.setProperty('--size', live().size);
    drawing.grid($('grid'), geometry);
    paint();
  }

  function action(point) {
    if (!selection) return { type: 'stone', point };
    return { type: 'wall', point, length: selection, orientation };
  }

  function paint() {
    if (!geometry) return;
    let preview = null;
    if (hovered !== null && placing()) {
      const move = action(hovered);
      preview = { ...move, invalid: Boolean(rules.play(live(), move).error) };
    }
    drawing.position($('pieces'), geometry, shown(), {
      preview,
      tally: reviewing() ? null : tally,
      dead: reviewing() ? new Set() : dead,
    });
  }

  function updateIntersections(game) {
    const isScoring = !reviewing() && game.passes >= 2 && !finished;
    const active = playing() || isScoring;
    for (let point = 0; point < game.board.length; point++) {
      const cell = game.board[point];
      const button = intersections.children[point];
      const coord = drawing.coordinate(point, game.size);
      const label = cellNames[cell] || 'libre';
      const canClick = (placing() && !cell) || (isScoring && cell !== WALL);
      button.tabIndex = active && point === focusPoint ? 0 : -1;
      button.disabled = !active;
      button.setAttribute('aria-disabled', String(!canClick));
      button.setAttribute('aria-label', coord + ', ' + label +
        (isScoring && dead.has(point) ? ', marquée morte' : ''));
    }
  }

  function updatePlayers(game) {
    for (const color of [BLACK, WHITE]) {
      $('player-' + color).classList.toggle('is-turn', color === game.turn && !reviewing() && game.passes < 2);
      const captures = reviewing() ? game.captures[color] : tally?.captures[color] ?? game.captures[color];
      $('captures-' + color).textContent = captures + (captures > 1 ? ' prises' : ' prise');
      const stock = game.stock[color];
      const reserve = $('reserve-' + color);
      const short = STOCK[game.size][1] ? '1 pt × ' + stock[1] + ' · ' : '';
      reserve.textContent = short + '2 pts × ' + stock[2];
      const units = STOCK[game.size][1] ? stock[1] + ' de longueur un, ' : '';
      reserve.setAttribute('aria-label', 'Barrières en réserve, ' + units + stock[2] + ' de longueur deux');
    }
  }

  function updateControls(game) {
    const play = placing();
    const counted = !reviewing() && game.passes >= 2;
    $('game-size').textContent = game.size + ' × ' + game.size;
    $('game-mode').textContent = opponent === 'computer' ? 'IA Monte-Carlo · Blancs' : 'À deux sur le même écran';
    matchLevel.hidden = opponent !== 'computer';
    $('play-controls').hidden = !play;
    $('ai-retry').hidden = !computerTurn() || !computerFailed;
    $('scoring-controls').hidden = !counted;
    $('scoring-hint').hidden = finished;
    $('scoring-actions').hidden = finished;

    let status = 'Aux ' + colors[game.turn] + ' de jouer';
    if (reviewing()) status = 'Historique';
    else if (counted) status = finished ? winner() : 'Décompte';
    else if (computerTurn()) status = worker ? 'L’IA réfléchit…' : 'Tour de l’IA';
    if ($('status').textContent !== status) $('status').textContent = status;

    if (!play) return;
    for (const [index, button] of tools.entries()) {
      button.hidden = index === 1 && !STOCK[game.size][1];
      button.disabled = index > 0 && !game.stock[game.turn][index];
      button.setAttribute('aria-pressed', String(index === selection));
      drawing.sample(samples[index], index, game.turn);
    }
    $('orientation').hidden = selection !== 2;
    const horizontal = orientation === 'horizontal';
    $('direction-label').textContent = horizontal ? 'Horizontale' : 'Verticale';
    $('direction-symbol').textContent = horizontal ? '↔' : '↕';
    $('orientation').setAttribute('aria-label', horizontal
      ? 'Orientation horizontale, tourner à la verticale'
      : 'Orientation verticale, tourner à l’horizontale');
    const hints = [
      'Pose une pierre sur une intersection libre.',
      'Pose la petite barrière sur un point libre.',
      horizontal ? 'La barrière s’étend d’un point vers la droite.' : 'La barrière s’étend d’un point vers le bas.',
    ];
    $('hint').textContent = hints[selection];
  }

  function winner() {
    const difference = tally.totals[BLACK] - tally.totals[WHITE];
    if (difference === 0) return 'Égalité';
    return colors[difference > 0 ? BLACK : WHITE] + ' gagnent de ' + formatter.format(Math.abs(difference));
  }

  function updateHistory(game) {
    $('back').disabled = view === 0;
    $('forward').disabled = !reviewing();
    $('move-number').textContent = 'Coup ' + view + (reviewing() ? ' / ' + (history.length - 1) : '');
    const move = game.lastMove;
    let label = 'Début de partie';
    if (move) {
      const player = colors[move.player];
      if (move.type === 'pass') {
        label = player + ' · passe';
      } else {
        const coords = (move.points ?? [move.point]).map(point => drawing.coordinate(point, game.size));
        label = player + ' · ' + (move.type === 'wall' ? 'barrière ' : '') + coords.join('–');
      }
    }
    $('move-description').textContent = label;
  }

  function updateScore() {
    tally = rules.score(live(), dead, neutral);
    const rows = [BLACK, WHITE].map(color => {
      const label = document.createElement('dt');
      label.textContent = colors[color];
      const value = document.createElement('dd');
      value.textContent = formatter.format(tally.totals[color]);
      const detail = document.createElement('small');
      detail.textContent = tally.territory[color] + ' territoire · ' + tally.captures[color] + ' prises' +
        (color === WHITE ? ' · ' + formatter.format(rules.KOMI) + ' komi' : '');
      value.append(detail);
      return [label, value];
    });
    $('score').replaceChildren(...rows.flat());
  }

  function update() {
    const game = shown();
    updateIntersections(game);
    updatePlayers(game);
    updateControls(game);
    updateHistory(game);
    paint();
  }

  function commit(game) {
    history.push(game);
    view = history.length - 1;
    selection = 0;
    hovered = null;
    if (game.passes >= 2) updateScore();
    announce();
    update();
    requestComputer();
  }

  function mark(point) {
    const game = live();
    const cell = game.board[point];
    if (cell === WALL) return;
    if (cell) {
      const markDead = !dead.has(point);
      for (const member of rules.groupAt(game.board, game.size, point).points) {
        if (markDead) dead.add(member);
        else dead.delete(member);
      }
      neutral.clear();
    } else {
      const region = tally.regions[point];
      if (neutral.has(region)) neutral.delete(region);
      else if (tally.ownership[point]) neutral.add(region);
      else return;
    }
    updateScore();
    update();
  }

  function moveFocus(point) {
    intersections.children[focusPoint].tabIndex = -1;
    focusPoint = point;
    const button = intersections.children[point];
    button.tabIndex = 0;
    return button;
  }

  intersections.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button || reviewing() || finished || computerTurn()) return;
    const point = Number(button.dataset.point);
    moveFocus(point);
    if (!placing()) {
      mark(point);
      return;
    }
    const result = rules.play(live(), action(point));
    if (result.error) announce(errors[result.error] ?? 'Ce coup est interdit.');
    else commit(result.game);
  });

  intersections.addEventListener('pointerover', event => {
    if (event.pointerType === 'touch') return;
    const button = event.target.closest('button');
    hovered = button ? Number(button.dataset.point) : null;
    paint();
  });
  intersections.addEventListener('pointerleave', () => {
    hovered = null;
    paint();
  });
  intersections.addEventListener('focusin', event => {
    if (!event.target.matches(':focus-visible')) return;
    hovered = Number(event.target.dataset.point);
    paint();
  });
  intersections.addEventListener('focusout', () => {
    hovered = null;
    paint();
  });
  intersections.addEventListener('keydown', event => {
    const { size } = shown();
    const offsets = { ArrowUp: -size, ArrowDown: size, ArrowLeft: -1, ArrowRight: 1 };
    const offset = offsets[event.key];
    if (!offset) return;
    event.preventDefault();
    const target = focusPoint + offset;
    if (target < 0 || target >= size * size) return;
    if (Math.abs(offset) === 1 && Math.floor(target / size) !== Math.floor(focusPoint / size)) return;
    moveFocus(target).focus();
  });

  function rotate() {
    orientation = orientation === 'horizontal' ? 'vertical' : 'horizontal';
    announce();
    updateControls(live());
    paint();
  }

  for (const [index, button] of tools.entries()) {
    button.addEventListener('click', () => {
      selection = index;
      announce();
      updateControls(live());
      paint();
    });
  }
  $('orientation').addEventListener('click', rotate);
  document.addEventListener('keydown', event => {
    if (event.key.toLowerCase() === 'r' && !event.repeat && !event.ctrlKey && !event.altKey && !event.metaKey &&
        placing() && selection === 2 && !newDialog.open && !rulesDialog.open) {
      event.preventDefault();
      rotate();
    }
  });

  $('pass').addEventListener('click', () => {
    commit(rules.pass(live()));
    if (tally) $('score-done').focus();
  });
  $('ai-retry').addEventListener('click', requestComputer);
  $('resume').addEventListener('click', () => {
    // A resumed turn keeps the moves leading to the passes available for review.
    history[view] = { ...live(), passes: 0 };
    clearScore();
    announce();
    update();
    if (placing()) $('pass').focus();
    requestComputer();
  });
  $('score-done').addEventListener('click', () => {
    finished = true;
    update();
    $('status').tabIndex = -1;
    $('status').focus();
  });

  function review(offset) {
    stopComputer();
    view += offset;
    hovered = null;
    announce();
    update();
    if (document.activeElement.disabled) (offset < 0 ? $('forward') : $('back')).focus();
    requestComputer();
  }
  $('back').addEventListener('click', () => review(-1));
  $('forward').addEventListener('click', () => review(1));

  function showLevel(control, level) {
    const input = control.querySelector('input');
    const seconds = formatter.format(levels.settings(level).budgetMs / 1000);
    input.value = level;
    input.setAttribute('aria-valuetext', 'Niveau ' + level + ' sur ' + levels.count + ', jusqu’à ' + seconds + ' secondes');
    control.querySelector('output').textContent = level + '/' + levels.count + ' · jusqu’à ' + seconds + ' s';
    if (control !== setupLevel) $('match-level-summary').textContent = level + '/' + levels.count;
  }

  for (const control of document.querySelectorAll('[data-level-control]')) {
    control.append($('level-template').content.cloneNode(true));
    const input = control.querySelector('input');
    input.max = levels.count;
    showLevel(control, computerLevel);
    input.addEventListener('input', () => {
      if (control !== setupLevel) computerLevel = input.valueAsNumber;
      showLevel(control, input.valueAsNumber);
    });
  }
  for (const option of setup.querySelectorAll('[name="size"]')) {
    drawing.miniature(option.labels[0].querySelector('canvas'), Number(option.value));
  }

  function showSoloOptions() {
    setupLevel.hidden = setup.elements.opponent.value !== 'computer';
  }

  $('open-rules').addEventListener('click', () => rulesDialog.showModal());
  $('open-new').addEventListener('click', () => {
    setup.elements.size.value = live().size;
    setup.elements.opponent.value = opponent;
    showSoloOptions();
    showLevel(setupLevel, computerLevel);
    $('restart-warning').hidden = history.length === 1 || finished;
    newDialog.showModal();
    stopComputer();
    update();
  });
  $('cancel-new').addEventListener('click', () => newDialog.close());
  newDialog.addEventListener('close', requestComputer);
  setup.addEventListener('change', showSoloOptions);
  setup.addEventListener('submit', event => {
    event.preventDefault();
    const mode = setup.elements.opponent.value;
    if (mode === 'computer') computerLevel = setupLevel.querySelector('input').valueAsNumber;
    showLevel(matchLevel.querySelector('[data-level-control]'), computerLevel);
    create(Number(setup.elements.size.value), mode);
    newDialog.close();
  });

  create(9);
  new ResizeObserver(resize).observe(goban);
  document.fonts.ready.then(resize);
})();
