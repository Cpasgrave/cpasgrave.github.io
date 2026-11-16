"use strict";

// The model changes only on a valid drop. During the gesture the real piece stays put.
function installPieceDrag({ pieces, canDrag, findTarget, onDrop, onPickUp, sound = null }) {
  let gesture = null;

  function cancel() {
    if (!gesture) return;
    const { source, pointerId, preview, target } = gesture;
    gesture = null;
    const voice = source.dragSound;
    source.dragSound = null;
    voice?.stop();
    preview?.remove();
    source.classList.remove("drag-source");
    target?.element.classList.remove("drop-ready");
    document.body.classList.remove("dragging");
    if (source.hasPointerCapture(pointerId)) source.releasePointerCapture(pointerId);
  }

  function targetAt(event) {
    return canDrag(gesture.piece) ? findTarget(gesture.piece,
      document.elementFromPoint(event.clientX, event.clientY)) : null;
  }

  pieces.forEach((source, piece) => {
    source.addEventListener("dragstart", event => event.preventDefault());
    source.addEventListener("pointerdown", event => {
      if (gesture || !event.isPrimary || event.button !== 0 || !canDrag(piece)) return;
      event.preventDefault();
      onPickUp?.();
      gesture = { source, piece, pointerId: event.pointerId,
        x: event.clientX, y: event.clientY, rect: source.getBoundingClientRect(),
        lastX: event.clientX, lastY: event.clientY, lastTime: event.timeStamp,
        preview: null, target: null };
      source.setPointerCapture(event.pointerId);
    });
    source.addEventListener("pointermove", event => {
      if (!gesture || event.pointerId !== gesture.pointerId) return;
      if (!canDrag(gesture.piece)) { cancel(); return; }
      const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
      if (!gesture.preview && Math.hypot(dx, dy) < 5) return;
      event.preventDefault();
      if (!gesture.preview) {
        const preview = source.cloneNode(true);
        preview.className = "pawn drag-preview";
        preview.removeAttribute("role");
        preview.removeAttribute("tabindex");
        preview.removeAttribute("aria-disabled");
        preview.setAttribute("aria-hidden", "true");
        Object.assign(preview.style, {
          left: gesture.rect.left + "px", top: gesture.rect.top + "px",
          width: gesture.rect.width + "px", height: gesture.rect.height + "px"
        });
        document.body.appendChild(preview);
        gesture.preview = preview;
        source.dragSound = sound?.startSlide({ piece });
        source.classList.add("drag-source");
        document.body.classList.add("dragging");
      }
      gesture.preview.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
      const elapsed = Math.max(8, (event.timeStamp - gesture.lastTime) || 16);
      const speed = Math.hypot(event.clientX - gesture.lastX, event.clientY - gesture.lastY) * 1000 / elapsed;
      source.dragSound?.move({ speed, pan: event.clientX / window.innerWidth * 2 - 1 });
      gesture.lastX = event.clientX; gesture.lastY = event.clientY; gesture.lastTime = event.timeStamp;
      const target = targetAt(event);
      gesture.target?.element.classList.remove("drop-ready");
      gesture.target = target;
      target?.element.classList.add("drop-ready");
    });
    source.addEventListener("pointerup", event => {
      if (!gesture || event.pointerId !== gesture.pointerId) return;
      const target = gesture.preview ? targetAt(event) : null;
      const fromRect = gesture.preview?.getBoundingClientRect();
      const slideSound = target ? source.dragSound : null;
      if (target) source.dragSound = null; // Continue the same friction through the settling motion.
      cancel();
      if (target) onDrop(target.action, { fromRect, slideSound });
    });
    source.addEventListener("pointercancel", cancel);
    source.addEventListener("lostpointercapture", cancel);
  });
  document.addEventListener("keydown", event => { if (event.key === "Escape") cancel(); });
  window.addEventListener("blur", cancel);
  window.addEventListener("pagehide", cancel);
  window.addEventListener("resize", cancel);
  return { cancel };
}
