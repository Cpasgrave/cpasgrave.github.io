"use strict";

const wheel = document.querySelector("#wheel");
const rod = document.querySelector("#rod");
const piston = document.querySelector("#piston");
const pin = document.querySelector("#crank-pin");
const toggle = document.querySelector("#piston-toggle");
const speed = document.querySelector("#piston-speed");
const speedValue = document.querySelector("#piston-speed-value");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const center = { x: 200, y: 316 };
const crankRadius = 70;
const rodLength = 198;
const spokeAngle = 82; // Angle du rayon portant le boulon dans l’image d’origine.
const turn = 2 * Math.PI;
let angle = 0;
let frame = 0;
let lastFrame = null;
let running = !reducedMotion.matches;

function render() {
  const offsetX = crankRadius * Math.sin(angle);
  const crankY = center.y - crankRadius * Math.cos(angle);
  const pistonY = crankY - Math.sqrt(rodLength ** 2 - offsetX ** 2);
  const rodAngle = Math.atan2(crankY - pistonY, offsetX) * 180 / Math.PI;
  wheel.setAttribute("transform", `rotate(${angle * 180 / Math.PI - spokeAngle} ${center.x} ${center.y})`);
  rod.setAttribute("transform", `translate(${center.x} ${pistonY}) rotate(${rodAngle})`);
  piston.setAttribute("transform", `translate(0 ${pistonY})`);
  pin.setAttribute("transform", `translate(${center.x + offsetX} ${crankY})`);
}

function animate(timestamp) {
  if (lastFrame !== null) {
    const seconds = Math.min(.08, (timestamp - lastFrame) / 1000);
    angle = (angle + Number(speed.value) * turn / 60 * seconds) % turn;
  }
  lastFrame = timestamp;
  render();
  frame = requestAnimationFrame(animate);
}

function updatePlayback() {
  cancelAnimationFrame(frame);
  lastFrame = null;
  toggle.textContent = running ? "Mettre en pause" : "Animer le piston";
  render();
  if (running && !document.hidden) frame = requestAnimationFrame(animate);
}

toggle.addEventListener("click", () => {
  running = !running;
  updatePlayback();
});
speed.addEventListener("input", () => { speedValue.textContent = `${speed.value} tr/min`; });
reducedMotion.addEventListener("change", () => {
  if (reducedMotion.matches) running = false;
  updatePlayback();
});
document.addEventListener("visibilitychange", updatePlayback);
updatePlayback();
