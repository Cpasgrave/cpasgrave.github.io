// Run in the main JavaScript context of the local Quoridor page, after closing
// its setup dialog. The temporary all-human game is restored after the checks.
async function testQuoridorInteractions() {
  const original = { state, config, history, active, interaction, orientation };
  const results = [];
  const assert = (condition, description) => { if (!condition) throw new Error(description); };
  const settle = () => new Promise(resolve => {
    const check = () => animating ? setTimeout(check, 20) : resolve(); check();
  });
  try {
    cancelAI(); cancelDrag();
    config = { ...config, count: 4, sound: false, seats: config.seats.map(s => ({ ...s, type: 'human' })) };
    state = Q.createGame(4); history = []; active = true; orientation = 'h'; render();
    assert(!document.querySelector('#move-mode,#wall-mode,.pawn-number,#reserve-text,#last-action,.turn-banner'), 'Removed interface elements remain');
    assert(cells.every(cell => getComputedStyle(cell, '::after').content === 'none'), 'Move dots remain visible');
    assert(slots.every(slot => getComputedStyle(slot).backgroundColor === 'rgba(0, 0, 0, 0)'), 'Wall dots remain visible');
    assert($('hint').hidden, 'An instruction occupies the table');
    assert(document.querySelectorAll('.wall-tally span').length === 0, 'Numeric wall counters remain');
    results.push('No mode buttons, points, pawn numbers, counters or routine hints');

    $('rotate').click();
    assert(orientation === 'v' && !cells[67].disabled, 'Rotating the reserve blocks the pawn');
    $('rotate').click();
    assert(orientation === 'h' && interaction === 'move', 'Rotation unexpectedly takes a wall');
    results.push('The rotation button changes only the reserve orientation');

    $('wall-source').click();
    assert(cells.every(cell => cell.disabled), 'Pawn can move while a wall is held');
    cells[67].click();
    assert(state.ply === 0 && !animating, 'A held wall did not prevent a pawn move');
    $('wall-source').click();
    assert(!cells[67].disabled && interaction === 'move', 'Returning the wall leaves pawn controls locked');
    cells[67].click(); await settle();
    assert(state.ply === 1 && state.players[0].position === 67, 'Direct cell click did not move the pawn');
    assert(document.querySelector('.player-card[aria-current="true"]').getAttribute('aria-label').startsWith('Joueur 2'), 'Turn border did not follow the next player');
    results.push('Taking/returning a wall blocks/restores direct pawn movement');

    $('wall-source').click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert(interaction === 'move' && !cells[37].disabled, 'Escape did not return the wall');
    $('wall-source').click();
    document.dispatchEvent(new Event('pointercancel'));
    assert(interaction === 'move' && !cells[37].disabled, 'Cancelled gesture leaves the pawn locked');
    results.push('Escape and interrupted touches return the wall safely');

    $('wall-source').click();
    slots.find(slot => slot.dataset.r === '3' && slot.dataset.c === '3').click();
    await settle();
    assert(state.walls.length === 1 && state.players[1].walls === 4 && state.turn === 2, 'Wall placement or inventory failed');
    assert(document.querySelectorAll('.wall-tally')[1].querySelectorAll('i').length === 4, 'Visual wall stock did not update');
    assert(interaction === 'move' && $('wall-source').getAttribute('aria-pressed') === 'false', 'A wall remains held after its placement');
    results.push('Placing a wall consumes exactly one visible stock item and ends the turn');

    state.players[2].walls = 0; render();
    assert($('wall-source').disabled && $('wall-source').querySelector('.barrier').hidden, 'Empty reserve still offers a wall');
    results.push('Empty reserve has no draggable barrier');
    return results;
  } finally {
    cancelAI(); cancelDrag();
    ({ state, config, history, active, interaction, orientation } = original);
    render(); scheduleTurn();
  }
}
