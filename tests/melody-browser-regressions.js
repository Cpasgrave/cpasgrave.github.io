// Run in the local Melody Generator page's main JavaScript context, after
// clicking Écouter once to unlock audio. This exercises the real DOM and VexFlow.
// Reload afterwards to restore the demonstration's initial form values.
async function runMelodyRegressions() {
  const results = [];
  const assert = (ok, label) => { if (!ok) throw new Error(label); };
  const change = (element, value) => {
    if (element.type === 'checkbox') element.checked = value;
    else element.value = value;
    element.dispatchEvent(new Event(element.tagName === 'TEXTAREA' ? 'input' : 'change', { bubbles: true }));
  };
  const currentSVG = () => score.querySelector('svg');
  const checkScore = () => {
    assert(settingsValid && notes.length > 0 && currentSVG(), 'Valid score missing');
    assert(glyphs.length === notes.length && glyphs.every(Boolean), 'Missing notation or playback highlight');
    assert(!playButton.disabled, 'Valid melody cannot be played');
  };
  const checkBounds = () => {
    const svg = currentSVG();
    const bounds = svg.getBBox();
    assert(bounds.y >= 0 && bounds.y + bounds.height <= Number(svg.getAttribute('height')), 'Extreme notes clipped');
  };
  try {
    resetPlayback();
    change(demos, 'Pierre et le loup');
    change(mode, '8|Prokofiev');
    const originalSVG = currentSVG();
    const originalNotes = notes;
    const previousHigh = high.value;
    change(low, 107);
    assert(high.value === previousHigh, 'Changing low silently moves high');
    assert(currentSVG() === originalSVG && notes === originalNotes && playButton.disabled, 'Crossed range erases score');
    change(low, 81);
    change(high, 81);
    assert(!settingsValid && currentSVG() === originalSVG, 'Empty scale erases score');
    change(high, 93);
    checkScore();
    results.push('Crossed and empty ranges preserve the last valid score, then recover');

    const validSVG = currentSVG();
    change(melodyInput, 'Bonjour !');
    assert(!settingsValid && currentSVG() === validSVG, 'Unsupported character erases score');
    change(melodyInput, 'Cépagrave');
    checkScore();
    change(convert, false);
    assert(!settingsValid && currentSVG(), 'Invalid direct conversion erases score');
    change(convert, true);
    checkScore();
    results.push('Invalid text and direct conversion preserve the score and recover');

    const engrave = window.Vex.Flow.Formatter.FormatAndDraw;
    const beforeFailure = currentSVG();
    const notesBeforeFailure = notes;
    try {
      window.Vex.Flow.Formatter.FormatAndDraw = () => { throw new Error('Simulated engraving failure'); };
      change(tonic, 0);
      assert(currentSVG() === beforeFailure && notes === notesBeforeFailure, 'Engraving failure destroys previous score');
    } finally {
      window.Vex.Flow.Formatter.FormatAndDraw = engrave;
    }
    change(tonic, 0);
    checkScore();
    results.push('Engraving commits only after successful rendering');

    for (const name of Object.keys(DEMOS)) {
      change(demos, name);
      checkScore();
      assert(notes.every(note => note.pitch >= Number(low.value) && note.pitch <= Number(high.value)), 'Preset outside range');
    }
    results.push('All five original examples render successfully');

    change(convert, true);
    change(mode, '12|chromatic');
    change(tonic, 0);
    change(high, 107);
    change(low, 96);
    checkScore(); checkBounds();
    change(low, 24);
    change(high, 35);
    checkScore(); checkBounds();
    change(high, 107);
    checkScore(); checkBounds();
    results.push('High, low and full ranges remain inside the visible notation');

    durationInputs.forEach(input => { input.checked = true; });
    melodyInput.value = '0123456789abcdefg';
    rhythmInput.value = melodyInput.value;
    change(convert, false);
    checkScore();
    assert(notes.length === 17 && notes.filter(note => note.rest).length === 4, 'Durations or rests lost');
    results.push('All 17 durations, including dots and rests, render');

    change(demos, 'Pierre et le loup');
    await startPlayback();
    assert(playing, 'Playback failed');
    change(low, 48);
    await Promise.resolve(); await Promise.resolve();
    assert(playing && playButton.textContent === 'Pause', 'Editing stops playback unexpectedly');
    change(tempo, 132);
    await Promise.resolve(); await Promise.resolve();
    assert(playing && playButton.textContent === 'Pause', 'Tempo change pauses playback');
    pausePlayback();
    change(high, 84);
    assert(paused && !playing && playButton.textContent === 'Reprendre', 'Editing while paused starts audio');
    await startPlayback();
    assert(playing, 'Cannot resume edited melody');
    change(low, 100);
    assert(!playing && playButton.disabled && currentSVG(), 'Invalid edit leaves stale audio running');
    change(high, 107);
    checkScore();
    assert(!playing, 'Correcting invalid input starts unrequested audio');
    results.push('Playing, paused, invalid and tempo edits keep coherent audio state');

    change(melodyInput, '');
    assert(notes.length === 0 && !currentSVG() && playButton.disabled, 'Intentional empty input is not handled');
    change(melodyInput, 'Cépagrave');
    checkScore();
    results.push('Empty input and subsequent re-entry recover normally');
    return results;
  } finally {
    resetPlayback();
  }
}
