import { EMPTY, UNKNOWN } from '../core/clues.js';
import { variableIdFor } from '../core/puzzle.js';

function pointInPolygon(point, polygon) {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersects = ((yi > y) !== (yj > y))
      && (x < ((xj - xi) * (y - yi)) / ((yj - yi) || Number.EPSILON) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}

function colorWithAlpha(color, alpha) {
  if (!color?.startsWith('#')) return color || `rgba(255,255,255,${alpha})`;
  const normalized = color.slice(1);
  const hex = normalized.length === 3
    ? normalized.split('').map((part) => part + part).join('')
    : normalized;
  const value = Number.parseInt(hex, 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return `rgba(${red},${green},${blue},${alpha})`;
}

export class Board2D {
  constructor(canvas, callbacks = {}) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.callbacks = callbacks;
    this.puzzle = null;
    this.state = [];
    this.frame = 0;
    this.selectedCellIndex = null;
    this.selectedTrack = null;
    this.tool = 'paint';
    this.onionSkin = true;
    this.view = { scale: 1, offsetX: 0, offsetY: 0 };
    this.worldBounds = null;
    this.dragging = false;
    this.dragMode = null;
    this.dragVisited = new Set();
    this.lastPointer = null;
    this.spacePressed = false;

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.bindEvents();
  }

  bindEvents() {
    this.canvas.addEventListener('contextmenu', (event) => event.preventDefault());
    this.canvas.addEventListener('wheel', (event) => {
      event.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const point = [event.clientX - rect.left, event.clientY - rect.top];
      this.zoomBy(event.deltaY < 0 ? 1.12 : 1 / 1.12, point);
    }, { passive: false });

    this.canvas.addEventListener('pointerdown', (event) => {
      this.canvas.setPointerCapture(event.pointerId);
      this.dragging = true;
      this.lastPointer = [event.clientX, event.clientY];
      this.dragVisited.clear();
      const shouldPan = this.tool === 'orbit' || this.tool === 'move'
        || this.spacePressed || event.button === 1;
      this.dragMode = shouldPan ? 'pan' : 'edit';
      if (this.dragMode === 'edit') this.handleEditPointer(event, 'start');
    });

    this.canvas.addEventListener('pointermove', (event) => {
      if (!this.dragging) return;
      if (this.dragMode === 'pan') {
        const next = [event.clientX, event.clientY];
        this.view.offsetX += next[0] - this.lastPointer[0];
        this.view.offsetY += next[1] - this.lastPointer[1];
        this.lastPointer = next;
        this.draw();
      } else {
        this.handleEditPointer(event, 'move');
      }
    });

    const end = (event) => {
      if (!this.dragging) return;
      if (this.dragMode === 'edit') this.handleEditPointer(event, 'end');
      this.dragging = false;
      this.dragMode = null;
      this.dragVisited.clear();
    };
    this.canvas.addEventListener('pointerup', end);
    this.canvas.addEventListener('pointercancel', end);

    window.addEventListener('keydown', (event) => {
      if (event.code === 'Space' && !event.repeat) this.spacePressed = true;
    });
    window.addEventListener('keyup', (event) => {
      if (event.code === 'Space') this.spacePressed = false;
    });
  }

  handleEditPointer(event, phase) {
    const cellIndex = this.hitTest(event.clientX, event.clientY);
    if (cellIndex == null || this.dragVisited.has(cellIndex)) return;
    this.dragVisited.add(cellIndex);
    this.callbacks.onCellPointer?.(cellIndex, {
      phase,
      button: event.button,
      pointerType: event.pointerType,
      originalEvent: event,
    });
  }

  setPuzzle(puzzle, state) {
    this.puzzle = puzzle;
    this.state = state;
    this.frame = 0;
    this.selectedCellIndex = null;
    this.selectedTrack = null;
    this.calculateBounds();
    this.resize(true);
  }

  update({ state, frame, selectedCellIndex, selectedTrack, tool, onionSkin } = {}) {
    if (state) this.state = state;
    if (frame != null) this.frame = frame;
    if (selectedCellIndex !== undefined) this.selectedCellIndex = selectedCellIndex;
    if (selectedTrack !== undefined) this.selectedTrack = selectedTrack;
    if (tool) this.tool = tool;
    if (onionSkin != null) this.onionSkin = onionSkin;
    this.draw();
  }

  calculateBounds() {
    const points = this.puzzle?.lattice.cells.flatMap((cell) => cell.polygon || []) || [];
    if (!points.length) {
      this.worldBounds = { minX: -1, maxX: 1, minY: -1, maxY: 1 };
      return;
    }
    this.worldBounds = {
      minX: Math.min(...points.map(([x]) => x)),
      maxX: Math.max(...points.map(([x]) => x)),
      minY: Math.min(...points.map(([, y]) => y)),
      maxY: Math.max(...points.map(([, y]) => y)),
    };
  }

  resize(fit = false) {
    const rect = this.canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(rect.width * ratio));
    const height = Math.max(1, Math.round(rect.height * ratio));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    this.pixelRatio = ratio;
    if (fit || !this.view.scale) this.fitToView();
    else this.draw();
  }

  fitToView() {
    if (!this.worldBounds) return;
    const width = this.canvas.width / (this.pixelRatio || 1);
    const height = this.canvas.height / (this.pixelRatio || 1);
    const worldWidth = Math.max(0.1, this.worldBounds.maxX - this.worldBounds.minX);
    const worldHeight = Math.max(0.1, this.worldBounds.maxY - this.worldBounds.minY);
    this.view.scale = Math.min((width - 52) / worldWidth, (height - 52) / worldHeight);
    const centerX = (this.worldBounds.minX + this.worldBounds.maxX) / 2;
    const centerY = (this.worldBounds.minY + this.worldBounds.maxY) / 2;
    this.view.offsetX = width / 2 - centerX * this.view.scale;
    this.view.offsetY = height / 2 - centerY * this.view.scale;
    this.draw();
  }

  zoomBy(factor, screenPoint = null) {
    const width = this.canvas.width / (this.pixelRatio || 1);
    const height = this.canvas.height / (this.pixelRatio || 1);
    const anchor = screenPoint || [width / 2, height / 2];
    const before = this.screenToWorld(anchor);
    this.view.scale = Math.max(12, Math.min(220, this.view.scale * factor));
    this.view.offsetX = anchor[0] - before[0] * this.view.scale;
    this.view.offsetY = anchor[1] - before[1] * this.view.scale;
    this.draw();
  }

  worldToScreen([x, y]) {
    return [x * this.view.scale + this.view.offsetX, y * this.view.scale + this.view.offsetY];
  }

  screenToWorld([x, y]) {
    return [(x - this.view.offsetX) / this.view.scale, (y - this.view.offsetY) / this.view.scale];
  }

  hitTest(clientX, clientY) {
    if (!this.puzzle) return null;
    const rect = this.canvas.getBoundingClientRect();
    const world = this.screenToWorld([clientX - rect.left, clientY - rect.top]);
    for (let index = this.puzzle.lattice.cells.length - 1; index >= 0; index -= 1) {
      const cell = this.puzzle.lattice.cells[index];
      if (pointInPolygon(world, cell.polygon)) return cell.index;
    }
    return null;
  }

  valueColor(value, alpha = 1) {
    if (value === UNKNOWN) return `rgba(44,54,70,${alpha})`;
    if (value === EMPTY) return `rgba(18,23,32,${alpha})`;
    const entry = this.puzzle.palette.find((item) => item.id === value);
    return colorWithAlpha(entry?.color || '#ffffff', alpha);
  }

  drawPattern(context, polygon, paletteEntry) {
    if (!paletteEntry || paletteEntry.pattern === 'solid') return;
    const screen = polygon.map((point) => this.worldToScreen(point));
    const xs = screen.map(([x]) => x);
    const ys = screen.map(([, y]) => y);
    const minX = Math.min(...xs); const maxX = Math.max(...xs);
    const minY = Math.min(...ys); const maxY = Math.max(...ys);
    context.save();
    context.beginPath();
    screen.forEach(([x, y], index) => (index ? context.lineTo(x, y) : context.moveTo(x, y)));
    context.closePath();
    context.clip();
    context.strokeStyle = 'rgba(4,10,18,0.24)';
    context.fillStyle = 'rgba(4,10,18,0.28)';
    context.lineWidth = 1;
    const spacing = 8;
    if (paletteEntry.pattern === 'dots') {
      for (let x = minX; x <= maxX; x += spacing) {
        for (let y = minY; y <= maxY; y += spacing) {
          context.beginPath(); context.arc(x, y, 1.2, 0, Math.PI * 2); context.fill();
        }
      }
    } else if (paletteEntry.pattern === 'waves') {
      for (let y = minY; y <= maxY; y += spacing) {
        context.beginPath();
        for (let x = minX; x <= maxX; x += 2) {
          const py = y + Math.sin((x - minX) / 5) * 1.5;
          if (x === minX) context.moveTo(x, py); else context.lineTo(x, py);
        }
        context.stroke();
      }
    } else if (paletteEntry.pattern === 'cross') {
      for (let x = minX - (maxY - minY); x <= maxX; x += spacing) {
        context.beginPath(); context.moveTo(x, minY); context.lineTo(x + (maxY - minY), maxY); context.stroke();
        context.beginPath(); context.moveTo(x, maxY); context.lineTo(x + (maxY - minY), minY); context.stroke();
      }
    } else {
      for (let x = minX - (maxY - minY); x <= maxX; x += spacing) {
        context.beginPath(); context.moveTo(x, maxY); context.lineTo(x + (maxY - minY), minY); context.stroke();
      }
    }
    context.restore();
  }

  draw() {
    if (!this.context || !this.puzzle) return;
    const ratio = this.pixelRatio || 1;
    const width = this.canvas.width / ratio;
    const height = this.canvas.height / ratio;
    const context = this.context;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);

    const activeCells = this.selectedTrack?.type === 'space'
      ? new Set(this.selectedTrack.cells)
      : null;

    if (this.selectedTrack?.type === 'space' && this.selectedTrack.cells.length > 1) {
      context.save();
      context.strokeStyle = 'rgba(134,227,255,0.42)';
      context.lineWidth = Math.max(4, this.view.scale * 0.13);
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.beginPath();
      this.selectedTrack.cells.forEach((cellIndex, index) => {
        const point = this.worldToScreen(this.puzzle.lattice.cells[cellIndex].position);
        if (index) context.lineTo(point[0], point[1]); else context.moveTo(point[0], point[1]);
      });
      context.stroke();
      context.restore();
    }

    for (const cell of this.puzzle.lattice.cells) {
      const variableId = variableIdFor(this.puzzle, this.frame, cell.index);
      const value = this.state[variableId];
      const onTrack = !activeCells || activeCells.has(cell.index);
      const alpha = onTrack ? 1 : 0.42;
      const screenPolygon = cell.polygon.map((point) => this.worldToScreen(point));
      context.beginPath();
      screenPolygon.forEach(([x, y], index) => (index ? context.lineTo(x, y) : context.moveTo(x, y)));
      context.closePath();

      let fillValue = value;
      let ghost = false;
      if (this.onionSkin && (value === UNKNOWN || value === EMPTY) && this.frame > 0) {
        const previous = this.state[variableIdFor(this.puzzle, this.frame - 1, cell.index)];
        if (previous > EMPTY) {
          fillValue = previous;
          ghost = true;
        }
      }

      context.fillStyle = this.valueColor(fillValue, ghost ? 0.18 * alpha : alpha);
      context.fill();
      if (!ghost && fillValue > EMPTY) {
        this.drawPattern(context, cell.polygon, this.puzzle.palette.find((entry) => entry.id === fillValue));
      }

      context.strokeStyle = value === EMPTY
        ? `rgba(102,119,144,${0.42 * alpha})`
        : `rgba(130,151,180,${0.55 * alpha})`;
      context.lineWidth = Math.max(1, this.view.scale * 0.025);
      context.stroke();

      if (value === EMPTY) {
        const [cx, cy] = this.worldToScreen(cell.position);
        const size = Math.min(7, this.view.scale * 0.16);
        context.strokeStyle = `rgba(144,160,183,${0.62 * alpha})`;
        context.lineWidth = 1.5;
        context.beginPath();
        context.moveTo(cx - size, cy - size); context.lineTo(cx + size, cy + size);
        context.moveTo(cx + size, cy - size); context.lineTo(cx - size, cy + size);
        context.stroke();
      }

      if (this.puzzle.givens[variableId]) {
        context.strokeStyle = 'rgba(255,255,255,0.92)';
        context.lineWidth = Math.max(1.5, this.view.scale * 0.045);
        context.stroke();
      }

      if (cell.index === this.selectedCellIndex) {
        context.strokeStyle = '#ffffff';
        context.lineWidth = Math.max(2.5, this.view.scale * 0.07);
        context.stroke();
      }
    }
  }

  destroy() {
    this.resizeObserver.disconnect();
  }
}
