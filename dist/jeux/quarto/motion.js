"use strict";

// Animate a layout change while retaining the real DOM and game state at its destination.
function createPieceMotion(pieces, { sound = null } = {}) {
  const active = new Set();
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const snapshot = element => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left + window.scrollX, top: rect.top + window.scrollY,
      width: rect.width, height: rect.height };
  };
  const capture = () => pieces.map(snapshot);
  const cancel = () => { for (const finish of [...active]) finish(); };

  function play(before, { movingPiece, fromRect = null, slideSound = null } = {}) {
    cancel();
    const instantContact = () => {
      if (slideSound) slideSound.stop({ landed: true });
      else if (movingPiece !== undefined) sound?.place({ piece: movingPiece });
    };
    if (reducedMotion.matches) { instantContact(); return Promise.resolve(); }
    const after = capture();
    let primaryAnimated = false, groupAssigned = false;
    const pending = pieces.map((element, piece) => {
      const destination = after[piece];
      const origin = piece === movingPiece && fromRect ? {
        left: fromRect.left + window.scrollX, top: fromRect.top + window.scrollY,
        width: fromRect.width, height: fromRect.height
      } : before[piece];
      if (!origin || !destination.width || !destination.height || !element.animate) return;
      const dx = origin.left - destination.left, dy = origin.top - destination.top;
      const sx = origin.width / destination.width, sy = origin.height / destination.height;
      if (Math.abs(dx) + Math.abs(dy) < .5 && Math.abs(sx - 1) + Math.abs(sy - 1) < .01) return;
      // AI / keyboard: a readable journey. Drag release: a brief settling movement.
      const duration = piece !== movingPiece ? 340 : fromRect ? 220 :
        Math.min(760, Math.max(480, 360 + Math.hypot(dx, dy) * .45));
      const clone = element.cloneNode(true);
      clone.className = "pawn motion-piece";
      clone.removeAttribute("id");
      clone.removeAttribute("role");
      clone.removeAttribute("tabindex");
      clone.removeAttribute("aria-disabled");
      clone.setAttribute("aria-hidden", "true");
      Object.assign(clone.style, { left: destination.left + "px", top: destination.top + "px",
        width: destination.width + "px", height: destination.height + "px",
        zIndex: piece === movingPiece ? "60" : "50" });
      document.body.appendChild(clone);
      element.classList.add("motion-hidden");
      const primary = piece === movingPiece;
      const groupLead = !primary && !groupAssigned;
      if (primary) primaryAnimated = true;
      if (groupLead) groupAssigned = true;
      // One quiet texture for the reserve group, rather than a chorus of 15 pieces.
      const voice = primary ? slideSound || sound?.startSlide({ piece }) :
        groupLead ? sound?.startSlide({ piece, group: true }) : null;
      return new Promise(resolve => {
        let animation;
        let timer;
        let frame;
        let finished = false;
        const finish = (landed = false) => {
          if (finished) return;
          finished = true;
          clearTimeout(timer);
          if (frame !== undefined) window.cancelAnimationFrame?.(frame);
          animation?.cancel();
          clone.remove();
          element.classList.remove("motion-hidden");
          // Reveal the piece and trigger the contact in the same completion callback.
          voice?.stop({ landed });
          active.delete(finish);
          resolve();
        };
        active.add(finish);
        try {
          animation = clone.animate([
            { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` },
            { transform: "translate(0, 0) scale(1, 1)" }
          ], { duration, easing: "cubic-bezier(.4, 0, .2, 1)", fill: "both" });
          animation.finished.then(() => finish(true), () => finish(false));
          if (voice && window.requestAnimationFrame) {
            let previousProgress = 0, previousTime = null;
            const followMovement = timestamp => {
              if (finished) return;
              const progress = animation.effect.getComputedTiming().progress || 0;
              const elapsed = previousTime === null ? 16.7 : Math.max(1, timestamp - previousTime);
              const speed = Math.hypot(dx, dy) * Math.abs(progress - previousProgress) * 1000 / elapsed;
              const x = destination.left + destination.width / 2 + dx * (1 - progress) - window.scrollX;
              voice.move({ speed, pan: x / window.innerWidth * 2 - 1 });
              previousProgress = progress; previousTime = timestamp;
              if (progress >= 1) finish(true);
              else frame = window.requestAnimationFrame(followMovement);
            };
            frame = window.requestAnimationFrame(followMovement);
          }
          // Also settle if the browser suspends animation promises in a hidden tab.
          timer = setTimeout(() => finish(!document.hidden), duration + 120);
        } catch { finish(true); }
      });
    });
    if (!primaryAnimated) instantContact();
    return Promise.all(pending);
  }
  window.addEventListener("resize", cancel);
  window.addEventListener("pagehide", cancel);
  document.addEventListener("visibilitychange", () => { if (document.hidden) cancel(); });
  reducedMotion.addEventListener("change", cancel);
  return { capture, play, cancel };
}
