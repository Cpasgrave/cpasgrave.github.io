"use strict";

(() => {
  const $ = id => document.getElementById(id);
  const forms = ["Sphère", "Cylindre", "Cube", "Cône"];
  const files = ["sphere", "cylindre", "cube", "cone"];
  const colors = ["miel", "vert olive"];
  const preferencesKey = "cepagrave.quantik.v1";
  let prefs = {};
  try { prefs = JSON.parse(localStorage.getItem(preferencesKey)) || {}; } catch {}
  let level = [1,2,3,4,5,6,7,8].includes(prefs.level) ? prefs.level : 4;
  let sound = prefs.sound !== false, mode = prefs.mode === "duo" ? "duo" : "solo";
  let human = prefs.human === 1 ? 1 : 0;
  let state = newState(), history = [], selected = null, focusCell = 0;
  // A physical copy keeps its drawing during a move, a drag and an undo.
  let copies = Array(16).fill(null);
  let timer = null, worker = null, generation = 0, gesture = null, suppressClick = false;
  const audio = createWoodAudio({enabled: () => sound, volume: () => .34});
  const cells = [], racks = [$("rack-one"), $("rack-two")];
  function save() {
    try { localStorage.setItem(preferencesKey, JSON.stringify({level, sound, mode, human})); } catch {}
  }
  function newState() { return Quantik.initial(Math.random() < .5 ? 0 : 1); }
  function computerTurn() { return mode === "solo" && state.turn !== human; }
  function playable() { return state.winner === null && !computerTurn() && !$("rulebook").open && !$("setup").open; }
  function coordinate(cell) { return "ABCD"[cell % 4] + (1 + Math.floor(cell / 4)); }
  function sideOfRack(rack) {
    const first = mode === "solo" ? human : 0;
    return rack === racks[0] ? first : 1-first;
  }
  function source(side, shape, copy) {
    return (side ? "sapin-" : "miel-") + files[shape] + "-" + (copy+1);
  }
  function piece(side, shape, copy) {
    return QuantikPions.make(source(side,shape,copy));
  }
  function inReserve(side, shape, copy) {
    const mask = state.pieces[side*4+shape];
    return !copies.some((value,cell) => value === copy && (mask & (1 << cell)));
  }
  function setupBoard() {
    QuantikTable.carveRegions($("carving"));
    for (let cell = 0; cell < 16; cell++) {
      const button = QuantikTable.makeCell(cell);
      button.addEventListener("click", () => place(cell));
      button.addEventListener("focus", () => setFocusCell(cell));
      button.addEventListener("keydown", e => {
        const dest = {ArrowLeft: cell%4 ? cell-1 : cell, ArrowRight: cell%4<3 ? cell+1 : cell,
          ArrowUp: Math.max(cell-4,cell%4), ArrowDown: Math.min(cell+4,12+cell%4),
          Home: 0, End: 15}[e.key];
        if (dest !== undefined) { e.preventDefault(); cells[dest].focus(); }
      });
      cells[cell] = button; $("board").append(button);
    }
  }
  function setupRacks() {
    for (const rack of racks) for (let slot = 0; slot < 8; slot++) {
      const shape = slot%4, copy = Math.floor(slot/4);
      const button = document.createElement("button");
      button.type = "button"; button.className = "stock";
      button.dataset.shape = shape; button.dataset.copy = copy;
      button.append(piece(sideOfRack(rack),shape,copy));
      button.addEventListener("click", e => {
        if (suppressClick || button.disabled) return;
        audio.unlock();
        select(selected?.shape === shape && selected.copy === copy ? null : {shape,copy});
        if (selected !== null) {
          audio.place({piece: shape, scale: .28});
          if (!e.detail) cells[focusCell].focus();
        }
      });
      button.addEventListener("pointerdown", e => {
        if (!e.isPrimary || e.button !== 0 || button.disabled) return;
        audio.unlock(); endGesture();
        gesture = {id: e.pointerId, x: e.clientX, y: e.clientY, shape, copy, button, ghost: null, over: null};
        button.setPointerCapture(e.pointerId);
      });
      rack.append(button);
    }
    forms.forEach((_, i) => document.querySelector(".samples").append(piece(i%2,i,0)));
  }
  function setFocusCell(index) {
    focusCell = index;
    cells.forEach((button, cell) => { button.tabIndex = cell === index ? 0 : -1; });
  }
  function select(pawn) {
    selected = pawn;
    if (pawn !== null) {
      const mask = Quantik.targets(state, state.turn, pawn.shape);
      if (mask && !(mask & (1 << focusCell))) setFocusCell(31 - Math.clz32(mask & -mask));
    }
    render();
  }
  function place(cell) {
    if (!playable()) return;
    if (selected === null) return;
    if (!commit({shape: selected.shape, cell},selected.copy)) {
      $("announcement").textContent = Quantik.pieceAt(state,cell) >= 0 ? "Case occupée." : "Case interdite à cette forme.";
    }
  }
  function commit(move, copy) {
    const next = Quantik.play(state,move);
    if (!next) return false;
    const physical = copy ?? (inReserve(state.turn,move.shape,0) ? 0 : 1);
    if (!inReserve(state.turn,move.shape,physical)) return false;
    history.push({state,copies}); copies = copies.slice(); copies[move.cell] = physical;
    state = next; selected = null;
    audio.place({piece: move.shape + 4*(1-state.turn), pan: (move.cell%4-1.5)*.14});
    render(); schedule(); return true;
  }
  function undoIndex() {
    for (let i = history.length-1; i >= 0; i--) if (mode === "duo" || history[i].state.turn === human) return i;
    return -1;
  }
  function renderBoard() {
    const legal = selected !== null && playable() ? Quantik.targets(state,state.turn,selected.shape) : 0;
    const won = state.lines.reduce((mask, line) => mask | line, 0);
    cells.forEach((button, cell) => {
      const bit = 1 << cell, id = Quantik.pieceAt(state,cell), last = state.last?.cell === cell;
      const drawing = id < 0 ? "" : source(id >> 2,id%4,copies[cell]);
      const changed = button.dataset.drawing !== drawing;
      if (changed) {
        button.dataset.drawing = drawing;
        button.querySelector(".token").replaceChildren(...(id < 0 ? [] : [piece(id >> 2,id%4,copies[cell])]));
        button.classList.toggle("arrived", last && id >= 0);
      }
      button.classList.toggle("last",last); button.classList.toggle("win",!!(won & bit));
      button.classList.toggle("legal",!!(legal & bit));
      button.setAttribute("aria-disabled", !(legal & bit));
      const content = id < 0 ? "vide" : forms[id%4]+" "+colors[id >> 2];
      button.setAttribute("aria-label",coordinate(cell)+", "+content+(legal & bit ? ", accessible" : "")+(won & bit ? ", combinaison gagnante" : ""));
    });
    setFocusCell(focusCell);
  }
  function renderRacks() {
    racks.forEach((rack,index) => {
      const side = sideOfRack(rack), suffix = index ? "two" : "one";
      rack.classList.toggle("honey-pieces",side === 0);
      const active = state.winner === null && side === state.turn;
      rack.closest(".reserve").classList.toggle("active-rack",active);
      rack.setAttribute("aria-busy",active && computerTurn());
      $("name-"+suffix).textContent = mode === "solo" ? (index ? "Réserve adverse" : "Ta réserve") : "Réserve du joueur "+(1+side);
      Array.from(rack.children).forEach(button => {
        const shape = Number(button.dataset.shape), copy = Number(button.dataset.copy);
        const present = inReserve(side,shape,copy);
        const image = button.firstChild, path = source(side,shape,copy);
        if (image.dataset.drawing !== path) image.replaceWith(QuantikPions.make(path));
        button.disabled = !present || !playable() || side !== state.turn || !Quantik.targets(state,side,shape);
        button.classList.toggle("empty",!present);
        button.setAttribute("aria-hidden",!present);
        button.setAttribute("aria-pressed",selected?.shape === shape && selected.copy === copy && side === state.turn);
        button.title = forms[shape]+" "+colors[side];
        button.setAttribute("aria-label",button.title+", pièce "+(copy+1));
      });
    });
  }
  function render() {
    renderBoard(); renderRacks();
    const outcome = $("outcome");
    outcome.hidden = state.winner === null;
    if (state.winner !== null) {
      const title = mode === "duo" ? "Le joueur "+(state.winner+1)+" gagne !" : state.winner === human ? "Tu as gagné !" : "L’ordinateur gagne !";
      outcome.textContent = title + (state.reason === "blocked" ? " Victoire par blocage." : "");
      $("announcement").textContent = "";
    } else {
      $("announcement").textContent = selected ? "Sélection : "+forms[selected.shape]+". Cases accessibles indiquées." :
        "Trait aux pièces "+colors[state.turn]+".";
    }
    $("undo").disabled = undoIndex() < 0;
    $("level").value = String(level); showLevel(); $("level-control").hidden = mode !== "solo";
    $("sound").setAttribute("aria-pressed", sound);
    $("sound").title = sound ? "Couper le son" : "Activer le son";
    $("sound").querySelector("use").setAttribute("href",sound ? "#audio" : "#muted");
  }
  function cancelAI() {
    generation++; clearTimeout(timer); worker?.terminate(); worker = null;
  }
  function schedule() {
    cancelAI();
    if (!computerTurn() || state.winner !== null || $("rulebook").open || $("setup").open) return;
    const job = generation;
    const fallback = () => {
      if (job !== generation) return;
      worker?.terminate(); worker = null;
      commit(QuantikAI.choose(state,level,{maxMs: 95}));
    };
    timer = setTimeout(() => {
      if (job !== generation) return;
      try {
        worker = new Worker("ai-worker.js");
        worker.onmessage = e => { if (job === generation && !commit(e.data)) fallback(); };
        worker.onerror = e => { e.preventDefault(); fallback(); };
        worker.postMessage({state,level});
      } catch { fallback(); }
    }, 400);
  }
  function endGesture() {
    if (!gesture) return;
    const old = gesture; gesture = null;
    old.over?.classList.remove("drag-over"); old.ghost?.remove();
    if (old.button.hasPointerCapture(old.id)) old.button.releasePointerCapture(old.id);
  }
  document.addEventListener("pointermove", e => {
    if (!gesture || gesture.id !== e.pointerId) return;
    if (!gesture.ghost) {
      if (Math.hypot(e.clientX-gesture.x,e.clientY-gesture.y) < 6) return;
      select({shape:gesture.shape,copy:gesture.copy});
      gesture.ghost = piece(state.turn,gesture.shape,gesture.copy);
      gesture.ghost.classList.add("drag-ghost");
      gesture.ghost.style.width = cells[0].offsetWidth+"px";
      document.body.append(gesture.ghost);
    }
    gesture.ghost.style.left = e.clientX+"px"; gesture.ghost.style.top = e.clientY+"px";
    gesture.over?.classList.remove("drag-over");
    gesture.over = document.elementFromPoint(e.clientX,e.clientY)?.closest(".cell.legal");
    gesture.over?.classList.add("drag-over");
  });
  document.addEventListener("pointerup", e => {
    if (!gesture || gesture.id !== e.pointerId) return;
    const dragged = !!gesture.ghost;
    const target = dragged && document.elementFromPoint(e.clientX,e.clientY)?.closest(".cell");
    endGesture();
    if (dragged) {
      suppressClick = true; setTimeout(() => { suppressClick = false; }, 0);
      if (target) place(Number(target.dataset.cell));
      else select(null);
    }
  });
  function abortGesture() { if (gesture) { endGesture(); select(null); } }
  document.addEventListener("pointercancel", abortGesture);
  document.addEventListener("lostpointercapture", abortGesture);
  window.addEventListener("blur", abortGesture);
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && playable()) { endGesture(); select(null); }
  });
  function openDialog(dialog) {
    endGesture(); cancelAI(); dialog.showModal();
  }
  $("rules").onclick = () => openDialog($("rulebook"));
  $("restart").onclick = () => {
    const form = $("setup-form");
    form.elements.mode.value = mode; form.elements.camp.value = String(human);
    $("pick-side").hidden = mode !== "solo";
    $("start-note").textContent = state.ply && state.winner === null ? "Commencer remplacera la partie en cours." : "";
    openDialog($("setup"));
  };
  $("setup-form").onchange = () => { $("pick-side").hidden = $("setup-form").elements.mode.value !== "solo"; };
  $("setup-form").onsubmit = e => {
    e.preventDefault(); cancelAI(); endGesture();
    mode = e.currentTarget.elements.mode.value; human = Number(e.currentTarget.elements.camp.value);
    state = newState(); history = []; copies = Array(16).fill(null); selected = null; focusCell = 0; save();
    $("setup").close();
  };
  document.querySelectorAll("dialog").forEach(dialog => {
    dialog.querySelectorAll("[data-close]").forEach(button => { button.onclick = () => dialog.close(); });
    dialog.addEventListener("close", () => { render(); schedule(); });
  });
  $("undo").onclick = () => {
    const index = undoIndex();
    if (index < 0) return;
    cancelAI(); endGesture(); ({state,copies} = history[index]); history.length = index; selected = null;
    render(); schedule();
  };
  function showLevel() {
    $("level-value").value = level+" / 8";
    $("level").setAttribute("aria-valuetext","Niveau "+level+" sur 8");
  }
  $("level").oninput = e => { level = Number(e.target.value); showLevel(); save(); schedule(); };
  $("sound").onclick = () => { sound = !sound; audio.unlock(); audio.updateSettings(); if (sound) audio.place({scale: .45}); save(); render(); };
  document.addEventListener("pointerdown", () => audio.unlock(), {capture: true});
  document.addEventListener("keydown", () => audio.unlock(), {capture: true});
  document.addEventListener("visibilitychange", () => { if (document.hidden) audio.stopAll(); });
  setupBoard(); setupRacks(); render(); schedule();
})();
