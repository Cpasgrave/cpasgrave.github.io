(() => {
  'use strict';

  const { BLACK, WHITE } = TopogoRules;
  const letters = 'ABCDEFGHJKLMNOPQRST';
  const stars = {
    9: [[2, 2], [2, 6], [4, 4], [6, 2], [6, 6]],
    13: [[3, 3], [3, 9], [6, 6], [9, 3], [9, 9]],
    19: [3, 9, 15].flatMap(row => [3, 9, 15].map(col => [row, col])),
  };
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const coordinate = (point, size) => letters[point % size] + (size - Math.floor(point / size));

  function layout(width, size) {
    const margin = width * (size === 9 ? .093 : size === 13 ? .073 : .057);
    const pitch = (width - margin * 2) / (size - 1);
    return { width, margin, pitch, size };
  }

  function center(point, { margin, pitch, size }) {
    return [margin + point % size * pitch, margin + Math.floor(point / size) * pitch];
  }

  function surface(canvas, width) {
    const scale = Math.min(window.devicePixelRatio || 1, 3);
    const pixels = Math.round(width * scale);
    if (canvas.width !== pixels || canvas.height !== pixels) {
      canvas.width = pixels;
      canvas.height = pixels;
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(pixels / width, 0, 0, pixels / width, 0, 0);
    ctx.clearRect(0, 0, width, width);
    return ctx;
  }

  function grid(canvas, { width, margin, pitch, size }) {
    const ctx = surface(canvas, width);
    const end = width - margin;
    const lines = new Path2D();
    for (let i = 0; i < size; i++) {
      const line = margin + i * pitch;
      lines.moveTo(margin, line);
      lines.lineTo(end, line);
      lines.moveTo(line, margin);
      lines.lineTo(line, end);
    }
    ctx.translate(0, .7);
    ctx.strokeStyle = '#fff2c07a';
    ctx.lineWidth = 2;
    ctx.stroke(lines);
    ctx.translate(0, -.7);
    ctx.strokeStyle = '#624226';
    ctx.lineWidth = clamp(pitch * .023, .72, 1.35);
    ctx.stroke(lines);
    ctx.strokeRect(margin, margin, end - margin, end - margin);

    ctx.fillStyle = '#5c3820';
    for (const [row, col] of stars[size]) {
      ctx.beginPath();
      ctx.arc(margin + col * pitch, margin + row * pitch, clamp(pitch * .071, 1.4, 3.8), 0, Math.PI * 2);
      ctx.fill();
    }

    const label = margin * .37;
    ctx.font = '600 ' + clamp(pitch * .26, 8, 16) + 'px "Cormorant Garamond", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < size; i++) {
      const line = margin + i * pitch;
      ctx.fillText(letters[i], line, label);
      ctx.fillText(letters[i], line, width - label);
      ctx.fillText(size - i, label, line);
      ctx.fillText(size - i, width - label, line);
    }
  }

  function stone(ctx, x, y, radius, color, { ghost, dead, marked } = {}) {
    const black = color === BLACK;
    ctx.save();
    ctx.globalAlpha = ghost ? .45 : dead ? .4 : 1;
    if (!ghost) {
      ctx.shadowColor = '#27150c9e';
      ctx.shadowBlur = radius * .22;
      ctx.shadowOffsetY = radius * .19;
    }
    const shade = ctx.createRadialGradient(x - radius * .35, y - radius * .4, 0, x, y, radius);
    shade.addColorStop(0, black ? '#564640' : '#fff8e6');
    shade.addColorStop(.64, black ? '#2d2420' : '#f1e6cd');
    shade.addColorStop(.88, black ? '#1f1815' : '#e4d6b7');
    shade.addColorStop(1, black ? '#100e0c' : '#ad9874');
    ctx.fillStyle = shade;
    ctx.strokeStyle = black ? '#18100b' : '#9f8057';
    ctx.lineWidth = Math.max(.65, radius * .036);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.stroke();
    ctx.restore();
    if (!marked && !dead) return;

    ctx.beginPath();
    if (dead) {
      const arm = radius * .37;
      ctx.moveTo(x - arm, y - arm);
      ctx.lineTo(x + arm, y + arm);
      ctx.moveTo(x + arm, y - arm);
      ctx.lineTo(x - arm, y + arm);
    } else {
      ctx.arc(x, y, Math.max(2, radius * .23), 0, 2 * Math.PI);
    }
    ctx.lineWidth = Math.max(1, radius * .09);
    ctx.strokeStyle = dead ? '#682920' : black ? '#fbeaca' : '#59432d';
    ctx.stroke();
  }

  function rounded(x, y, width, height, radius) {
    const path = new Path2D();
    path.roundRect(x, y, width, height, radius);
    return path;
  }

  function grain(ctx, shape, length, breadth, vertical) {
    ctx.save();
    ctx.clip(shape);
    if (vertical) ctx.rotate(Math.PI / 2);
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(.35, breadth * .027);
    for (let i = 0; i < 10; i++) {
      const y = breadth * (i / 10 - .47);
      const bend = Math.sin(i * 1.6) * breadth * .12;
      const start = -length * (.5 - (i % 4) * .073);
      const end = length * (.49 - (i % 3) * .092);
      ctx.strokeStyle = i % 3 === 0 ? '#fbc09339' : '#3f120e58';
      ctx.beginPath();
      ctx.moveTo(start, y);
      ctx.bezierCurveTo(-length * .16, y + bend, length * .13, y - bend * .5, end, y + bend * .31);
      ctx.stroke();
    }
    ctx.restore();
  }

  // The base and the inset top are drawn independently so the sloped faces remain visible.
  function barrier(ctx, x, y, pitch, length, orientation, { ghost, marked, invalid } = {}) {
    const vertical = orientation === 'vertical';
    const breadth = pitch * (length === 1 ? .78 : .69);
    const span = breadth + (length - 1) * pitch;
    const width = vertical ? breadth : span;
    const height = vertical ? span : breadth;
    const inset = breadth * .19;
    const radius = breadth * .21;
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = ghost ? .55 : 1;
    const base = rounded(-width / 2, -height / 2, width, height, radius);

    if (invalid) {
      ctx.lineWidth = Math.max(1.5, pitch * .042);
      ctx.strokeStyle = '#74190d';
      ctx.setLineDash([pitch * .12, pitch * .08]);
      ctx.stroke(base);
      ctx.restore();
      return;
    }

    const slope = ctx.createLinearGradient(-width * .43, -height * .5, width * .31, height * .5);
    slope.addColorStop(0, '#cb7959');
    slope.addColorStop(.3, '#ac5540');
    slope.addColorStop(.69, '#712a24');
    slope.addColorStop(1, '#4e1f1c');
    ctx.fillStyle = slope;
    if (!ghost) {
      ctx.shadowColor = '#33170faf';
      ctx.shadowBlur = breadth * .15;
      ctx.shadowOffsetX = breadth * .07;
      ctx.shadowOffsetY = breadth * .15;
    }
    ctx.fill(base);
    ctx.shadowColor = 'transparent';
    grain(ctx, base, span, breadth, vertical);
    ctx.lineWidth = Math.max(.75, breadth * .035);
    ctx.strokeStyle = '#54241b';
    ctx.stroke(base);

    const top = rounded(-width / 2 + inset * .8, -height / 2 + inset * .62,
      width - inset * 1.9, height - inset * 1.95, radius * .64);
    const face = ctx.createLinearGradient(0, -height / 2, width * .28, height / 2);
    face.addColorStop(0, '#b7644f');
    face.addColorStop(.47, '#9c4738');
    face.addColorStop(1, '#7c302a');
    ctx.fillStyle = face;
    ctx.fill(top);
    grain(ctx, top, span, breadth * .71, vertical);
    ctx.strokeStyle = marked ? '#f4cf90' : '#dfa08091';
    ctx.lineWidth = Math.max(.55, breadth * (marked ? .042 : .027));
    ctx.stroke(top);
    ctx.restore();
  }

  function position(canvas, geometry, game, { preview, tally, dead }) {
    const ctx = surface(canvas, geometry.width);
    const { pitch } = geometry;
    if (tally) {
      for (let i = 0; i < tally.ownership.length; i++) {
        if (!tally.ownership[i] || (game.board[i] !== 0 && !dead.has(i))) continue;
        const [x, y] = center(i, geometry);
        const size = pitch * .33;
        ctx.fillStyle = tally.ownership[i] === BLACK ? '#403027c4' : '#fff4dce8';
        ctx.fillRect(x - size / 2, y - size / 2, size, size);
      }
    }
    for (let i = 0; i < game.board.length; i++) {
      const color = game.board[i];
      if (color !== BLACK && color !== WHITE) continue;
      const [x, y] = center(i, geometry);
      if (tally && dead.has(i)) {
        const arm = pitch * .10;
        ctx.beginPath();
        ctx.moveTo(x - arm, y - arm);
        ctx.lineTo(x + arm, y + arm);
        ctx.moveTo(x + arm, y - arm);
        ctx.lineTo(x - arm, y + arm);
        ctx.strokeStyle = '#8a3026';
        ctx.lineWidth = Math.max(1.5, pitch * .045);
        ctx.stroke();
        continue;
      }
      stone(ctx, x, y, pitch * .455, color, {
        marked: !tally && game.lastMove?.type === 'stone' && game.lastMove.point === i,
        dead: dead.has(i),
      });
    }
    for (const wall of game.walls) {
      const [x, y] = wallCenter(wall, geometry);
      barrier(ctx, x, y, pitch, wall.length, wall.orientation, { marked: !tally && game.lastMove === wall });
    }
    if (!preview) return;
    if (preview.type === 'stone' && !preview.invalid) {
      const [x, y] = center(preview.point, geometry);
      stone(ctx, x, y, pitch * .455, game.turn, { ghost: true });
    }
    if (preview.type === 'wall') {
      const [x, y] = wallCenter(preview, geometry);
      barrier(ctx, x, y, pitch, preview.length, preview.orientation, { ghost: true, invalid: preview.invalid });
    }
  }

  function wallCenter(wall, geometry) {
    const [x, y] = center(wall.point, geometry);
    const shift = (wall.length - 1) * geometry.pitch / 2;
    return wall.orientation === 'vertical' ? [x, y + shift] : [x + shift, y];
  }

  function sample(canvas, type, color) {
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);
    if (type === 0) stone(ctx, width / 2, height / 2, 22, color);
    else barrier(ctx, width / 2, height / 2, 52, type, 'horizontal');
  }

  function miniature(canvas, size) {
    const { width, height } = canvas;
    const ctx = canvas.getContext('2d');
    const inset = 13;
    const length = width - 2 * inset;
    const pitch = length / (size - 1);
    const wood = rounded(2, 2, width - 4, height - 5, 8);
    const shade = ctx.createLinearGradient(0, 0, width, height);
    shade.addColorStop(0, '#f5d399');
    shade.addColorStop(1, '#c48b51');
    ctx.fillStyle = shade;
    ctx.fill(wood);
    ctx.strokeStyle = '#9a5f35';
    ctx.lineWidth = 2;
    ctx.stroke(wood);
    ctx.strokeStyle = '#704729';
    ctx.lineWidth = size === 19 ? .9 : 1.15;
    ctx.beginPath();
    for (let i = 0; i < size; i++) {
      const line = inset + i * pitch;
      ctx.moveTo(inset, line);
      ctx.lineTo(width - inset, line);
      ctx.moveTo(line, inset);
      ctx.lineTo(line, height - inset);
    }
    ctx.stroke();
    for (const [row, col] of stars[size]) {
      ctx.beginPath();
      ctx.arc(inset + col * pitch, inset + row * pitch, Math.max(1.6, pitch * .16), 0, 2 * Math.PI);
      ctx.fillStyle = '#66402a';
      ctx.fill();
    }
  }

  window.TopogoBoard = { layout, center, grid, position, sample, coordinate, miniature };
})();
