"use strict";

const stage = document.querySelector(".eye-stage");
const eyes = [...stage.querySelectorAll(".eye")];
const irises = eyes.map(eye => eye.querySelector(".iris"));
const fly = stage.querySelector(".fly");
const toggle = document.querySelector("#eyes-toggle");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const corners = [[.19, .2], [.81, .2], [.81, .8], [.19, .8]];
let running = !reducedMotion.matches;
let time = 0;
let lastFrame = null;
let frame = 0;
let target = null;
let nextBlink = 1.5;

function render() {
  const flyX = target ? target.x : .5 + .35 * Math.sin(time * 1.45);
  const flyY = target ? target.y : .5 + .27 * Math.sin(time * 2.1 + .45);
  fly.style.left = `${flyX * 100}%`;
  fly.style.top = `${flyY * 100}%`;

  const phase = time / 2.6;
  const step = Math.floor(phase);
  const mix = 1 - Math.pow(1 - Math.min(1, (phase % 1) / .48), 3);
  const ratio = stage.clientWidth / Math.max(1, stage.clientHeight);
  eyes.forEach((eye, index) => {
    const start = corners[(index + step) % 4];
    const end = corners[(index + step + 1) % 4];
    const x = start[0] + (end[0] - start[0]) * mix;
    const y = start[1] + (end[1] - start[1]) * mix;
    eye.style.left = `${x * 100}%`;
    eye.style.top = `${y * 100}%`;
    const dx = (flyX - x) * ratio;
    const dy = flyY - y;
    const length = Math.max(.26, Math.hypot(dx, dy));
    irises[index].style.left = `${50 + 21 * dx / length}%`;
    irises[index].style.top = `${50 + 21 * dy / length}%`;
  });
}

function animate(timestamp) {
  if (lastFrame !== null) time += Math.min(.08, (timestamp - lastFrame) / 1000);
  lastFrame = timestamp;
  if (time >= nextBlink && !reducedMotion.matches) {
    eyes[Math.floor(Math.random() * eyes.length)].classList.add("blink");
    nextBlink = time + 1.65 + Math.random() * 2.8;
  }
  render();
  frame = requestAnimationFrame(animate);
}

function updatePlayback() {
  cancelAnimationFrame(frame);
  lastFrame = null;
  toggle.textContent = running ? "Mettre en pause" : "Animer les yeux";
  render();
  if (running && !document.hidden) frame = requestAnimationFrame(animate);
}

function pointAt(event) {
  const bounds = stage.getBoundingClientRect();
  const clamp = value => Math.max(.08, Math.min(.92, value));
  target = {
    x: clamp((event.clientX - bounds.left) / bounds.width),
    y: clamp((event.clientY - bounds.top) / bounds.height),
  };
  render();
}

eyes.forEach(eye => {
  eye.addEventListener("animationend", () => eye.classList.remove("blink"));
});
stage.addEventListener("pointermove", event => {
  if (event.pointerType === "mouse" || event.buttons) pointAt(event);
});
stage.addEventListener("pointerdown", pointAt);
stage.addEventListener("pointerleave", event => {
  if (event.pointerType !== "mouse") return;
  target = null;
  render();
});
document.querySelector("#fly-move").addEventListener("click", () => {
  target = { x: .12 + .76 * Math.random(), y: .12 + .76 * Math.random() };
  render();
});
toggle.addEventListener("click", () => {
  running = !running;
  if (running) target = null;
  updatePlayback();
});
reducedMotion.addEventListener("change", () => {
  if (reducedMotion.matches) running = false;
  updatePlayback();
});
document.addEventListener("visibilitychange", updatePlayback);
window.addEventListener("resize", render);
updatePlayback();
