(() => {
  'use strict';

  const { BLACK } = window.GoridorRules;
  const LETTERS = 'ABCDEFGHJKLMNOPQRST';
  const STARS = {
    9: [[2, 2], [2, 6], [4, 4], [6, 2], [6, 6]],
    13: [[3, 3], [3, 9], [6, 6], [9, 3], [9, 9]],
    19: [3, 9, 15].flatMap(row => [3, 9, 15].map(col => [row, col])),
  };
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const coordinate = (row, col, size) => LETTERS[col] + (size - row);

  function circle(ctx, x, y, radius) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
  }

  function drawGoban(ctx, { width, origin, pitch, size, channel }) {
    const last = width - origin;
    const edge = origin - pitch / 2;
    const grooves = new Path2D();
    for (let index = 0; index < size - 1; index++) {
      const center = origin + (index + .5) * pitch;
      grooves.moveTo(edge, center);
      grooves.lineTo(width - edge, center);
      grooves.moveTo(center, edge);
      grooves.lineTo(center, width - edge);
    }
    ctx.lineCap = 'round';
    ctx.lineWidth = channel + 1.7;
    ctx.strokeStyle = '#78462038';
    ctx.stroke(grooves);
    ctx.lineWidth = channel;
    ctx.strokeStyle = '#fff0bf8f';
    ctx.stroke(grooves);
    ctx.lineWidth = Math.max(1, channel * .36);
    ctx.strokeStyle = '#fff3d650';
    ctx.stroke(grooves);

    ctx.lineCap = 'square';
    ctx.lineWidth = clamp(pitch * .027, .85, 1.7);
    ctx.strokeStyle = '#503720';
    ctx.beginPath();
    for (let index = 0; index < size; index++) {
      const line = origin + index * pitch;
      ctx.moveTo(origin, line);
      ctx.lineTo(last, line);
      ctx.moveTo(line, origin);
      ctx.lineTo(line, last);
    }
    ctx.stroke();

    ctx.fillStyle = '#523922';
    for (const [row, col] of STARS[size]) {
      circle(ctx, origin + col * pitch, origin + row * pitch, clamp(pitch * .066, 1.45, 3.8));
      ctx.fill();
    }

    const label = origin * .39;
    ctx.font = '600 ' + clamp(pitch * .29, 9, 14) + 'px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let index = 0; index < size; index++) {
      const line = origin + index * pitch;
      ctx.fillText(LETTERS[index], line, label);
      ctx.fillText(LETTERS[index], line, width - label);
      ctx.fillText(size - index, label, line);
      ctx.fillText(size - index, width - label, line);
    }
  }

  function drawStone(ctx, x, y, radius, player, { ghost, dead, marked } = {}) {
    const black = player === BLACK;
    ctx.save();
    ctx.globalAlpha = ghost ? .48 : dead ? .31 : 1;
    if (!ghost && !dead) {
      ctx.shadowColor = '#34201383';
      ctx.shadowOffsetY = radius * .15;
      ctx.shadowBlur = radius * .24;
    }
    const shading = ctx.createRadialGradient(
      x - radius * .28, y - radius * .36, radius * .04, x, y, radius,
    );
    shading.addColorStop(0, black ? '#5b5b53' : '#fffef8');
    shading.addColorStop(.62, black ? '#282823' : '#f1eddf');
    shading.addColorStop(.88, black ? '#181915' : '#e0d7c3');
    shading.addColorStop(1, black ? '#121310' : '#c8bca4');
    circle(ctx, x, y, radius);
    ctx.fillStyle = shading;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = black ? '#070a08b0' : '#b4a58ad9';
    ctx.lineWidth = Math.max(.5, radius * .045);
    ctx.stroke();
    ctx.restore();

    if (marked) {
      circle(ctx, x, y, Math.max(2.35, radius * .258));
      ctx.lineWidth = Math.max(2, radius * .14);
      ctx.strokeStyle = '#3d392bbd';
      ctx.stroke();
      ctx.lineWidth = Math.max(1, radius * .085);
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    }
  }

  function drawWall(ctx, layout, wall, { ghost, marked, invalid } = {}) {
    const { origin, pitch, channel } = layout;
    const x = origin + (wall.col + .5) * pitch;
    const y = origin + (wall.row + .5) * pitch;
    const thickness = channel + .75;
    const length = pitch * 2 - Math.max(1.6, channel * .37);
    ctx.save();
    ctx.translate(x, y);
    if (wall.orientation === 'vertical') ctx.rotate(Math.PI / 2);
    ctx.globalAlpha = ghost ? .75 : 1;
    const shading = ctx.createLinearGradient(0, -thickness / 2, 0, thickness / 2);
    shading.addColorStop(0, invalid ? '#f29a79' : '#e2ba80');
    shading.addColorStop(.25, invalid ? '#ab3d32' : '#a16642');
    shading.addColorStop(1, invalid ? '#92322d' : '#583924');
    ctx.beginPath();
    ctx.roundRect(-length / 2, -thickness / 2, length, thickness, thickness * .28);
    ctx.fillStyle = shading;
    ctx.strokeStyle = marked ? '#fff0af' : invalid ? '#8d2f2b' : '#593c26';
    ctx.lineWidth = marked ? 1.25 : .85;
    ctx.shadowColor = '#4b2c17a6';
    ctx.shadowOffsetY = .85;
    ctx.shadowBlur = 2;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.stroke();
    ctx.restore();
  }

  function drawTargets(ctx, { origin, pitch, size, channel }, walls) {
    const occupied = new Set(walls.map(({ row, col }) => row * size + col));
    ctx.fillStyle = '#72503164';
    for (let row = 0; row < size - 1; row++) {
      for (let col = 0; col < size - 1; col++) {
        if (occupied.has(row * size + col)) continue;
        circle(ctx, origin + (col + .5) * pitch, origin + (row + .5) * pitch, Math.max(1, channel * .32));
        ctx.fill();
      }
    }
  }

  function createBoard(canvas) {
    const ctx = canvas.getContext('2d');
    const surface = document.createElement('canvas');
    const surfaceCtx = surface.getContext('2d');
    let layout;
    let frame;

    function prepare(size) {
      const width = canvas.getBoundingClientRect().width;
      if (!width) return false;
      const ratio = window.devicePixelRatio || 1;
      const pixels = Math.round(width * ratio);
      if (layout?.size === size && layout.pixels === pixels && layout.width === width) return true;
      const origin = clamp(width * .079, 16, 43);
      const pitch = (width - 2 * origin) / (size - 1);
      layout = { width, size, origin, pitch, pixels, channel: clamp(pitch * .096, 1.65, 4.8) };
      canvas.width = canvas.height = surface.width = surface.height = pixels;
      const scale = pixels / width;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      surfaceCtx.setTransform(scale, 0, 0, scale, 0, 0);
      drawGoban(surfaceCtx, layout);
      return true;
    }

    function draw(nextFrame) {
      frame = nextFrame;
      const { game, wallMode, target, orientation, invalid, dead, score } = frame;
      if (!prepare(game.size)) return;
      const { width, size, origin, pitch } = layout;
      const radius = pitch * .371;
      ctx.clearRect(0, 0, width, width);
      ctx.drawImage(surface, 0, 0, width, width);
      if (wallMode) drawTargets(ctx, layout, game.walls);

      const at = (x, y) => [origin + x * pitch, origin + y * pitch];
      for (let point = 0; point < game.stones.length; point++) {
        const [x, y] = at(point % size, Math.floor(point / size));
        if (game.stones[point]) {
          drawStone(ctx, x, y, radius, game.stones[point], {
            dead: dead.has(point),
            marked: !score && point === game.lastStone,
          });
        }
        const territory = score?.ownership[point];
        if (territory) {
          const side = pitch * .22;
          ctx.fillStyle = territory === BLACK ? '#272721' : '#fffaeb';
          ctx.strokeStyle = territory === BLACK ? '#d2ad7b' : '#a37b53';
          ctx.lineWidth = .85;
          ctx.fillRect(x - side / 2, y - side / 2, side, side);
          ctx.strokeRect(x - side / 2, y - side / 2, side, side);
        }
      }
      for (const wall of game.walls) {
        drawWall(ctx, layout, wall, { marked: !score && wall === game.lastWall });
      }
      if (!target) return;
      if (wallMode) {
        drawWall(ctx, layout, { ...target, orientation }, { ghost: true, invalid });
      } else {
        const [x, y] = at(target.col, target.row);
        const point = target.row * size + target.col;
        if (!game.stones[point] && !score) drawStone(ctx, x, y, radius, game.turn, { ghost: true });
        if (invalid || score) {
          circle(ctx, x, y, radius * 1.11);
          ctx.strokeStyle = invalid ? '#a53229' : '#594328';
          ctx.lineWidth = clamp(pitch * .042, 1.2, 2);
          ctx.stroke();
        }
      }
    }

    function pick(event, wallMode) {
      if (!layout) return null;
      const rect = canvas.getBoundingClientRect();
      const { origin, pitch, size } = layout;
      const nearest = wallMode ? Math.floor : Math.round;
      const col = nearest((event.clientX - rect.left - origin) / pitch);
      const row = nearest((event.clientY - rect.top - origin) / pitch);
      const limit = wallMode ? size - 1 : size;
      return row >= 0 && col >= 0 && row < limit && col < limit ? { row, col } : null;
    }

    new ResizeObserver(() => {
      if (frame) draw(frame);
    }).observe(canvas);
    return { draw, pick };
  }

  window.GoridorBoard = { createBoard, coordinate };
})();
