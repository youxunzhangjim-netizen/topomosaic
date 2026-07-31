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
    this.displayMode = 'color';
    this.hintedVariableId = null;
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

  update({ state, frame, selectedCellIndex, selectedTrack, tool, onionSkin, displayMode, hintedVariableId } = {}) {
    if (state) this.state = state;
    if (frame != null) this.frame = frame;
    if (selectedCellIndex !== undefined) this.selectedCellIndex = selectedCellIndex;
    if (selectedTrack !== undefined) this.selectedTrack = selectedTrack;
    if (tool) this.tool = tool;
    if (onionSkin != null) this.onionSkin = onionSkin;
    if (displayMode) this.displayMode = displayMode;
    if (hintedVariableId !== undefined) this.hintedVariableId = hintedVariableId;
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

  hasBoardAxisClues() {
    return ['square', 'hex', 'triangle'].includes(this.puzzle?.lattice.kind);
  }

  spaceTracks() {
    return this.puzzle?.tracks.filter((track) => track.type === 'space' && track.frame === this.frame) || [];
  }

  axisTracks() {
    const tracks = this.spaceTracks();
    return {
      rows: tracks.filter((track) => track.family === 'row'),
      columns: tracks.filter((track) => track.family === 'column'),
    };
  }

  axisTrackGroups() {
    const groups = new Map();
    for (const track of this.spaceTracks()) {
      if (!groups.has(track.family)) groups.set(track.family, []);
      groups.get(track.family).push(track);
    }
    return [...groups.entries()].map(([family, tracks]) => ({ family, tracks }));
  }

  clueFamilySide(family, index = 0) {
    const preferred = {
      'hex-q': 'left',
      'hex-r': 'top',
      'hex-s': 'right',
      'tri-a': 'left',
      'tri-b': 'top',
      'tri-c': 'right',
    };
    return preferred[family] || ['top', 'left', 'right', 'bottom'][index % 4];
  }

  axisClueGutters(width, height) {
    if (!this.hasBoardAxisClues()) return { left: 26, top: 26, right: 26, bottom: 26 };
    const { rows, columns } = this.axisTracks();
    const compact = Math.min(width, height) < 560;
    const tokenWidth = compact ? 21 : 25;
    const tokenHeight = compact ? 18 : 22;
    if (this.puzzle?.lattice.kind === 'square') {
      const maxRowRuns = Math.max(1, ...rows.map((track) => track.clues.length));
      const maxColumnRuns = Math.max(1, ...columns.map((track) => track.clues.length));
      return {
        left: Math.min(width * 0.34, 34 + maxRowRuns * (tokenWidth + 4)),
        top: Math.min(height * 0.3, 34 + maxColumnRuns * (tokenHeight + 4)),
        right: compact ? 14 : 22,
        bottom: compact ? 14 : 22,
      };
    }

    const gutters = { left: compact ? 72 : 88, top: compact ? 66 : 84, right: compact ? 72 : 88, bottom: compact ? 18 : 24 };
    this.axisTrackGroups().forEach((group, index) => {
      const maxRuns = Math.max(1, ...group.tracks.map((track) => track.clues.length));
      const side = this.clueFamilySide(group.family, index);
      if (side === 'left' || side === 'right') {
        gutters[side] = Math.min(width * 0.3, 34 + maxRuns * (tokenWidth + 4));
      } else {
        gutters[side] = Math.min(height * 0.28, 34 + maxRuns * (tokenHeight + 4));
      }
    });
    return gutters;
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
    const gutter = this.axisClueGutters(width, height);
    const availableWidth = Math.max(90, width - gutter.left - gutter.right);
    const availableHeight = Math.max(90, height - gutter.top - gutter.bottom);
    this.view.scale = Math.min(availableWidth / worldWidth, availableHeight / worldHeight);
    const centerX = (this.worldBounds.minX + this.worldBounds.maxX) / 2;
    const centerY = (this.worldBounds.minY + this.worldBounds.maxY) / 2;
    this.view.offsetX = gutter.left + availableWidth / 2 - centerX * this.view.scale;
    this.view.offsetY = gutter.top + availableHeight / 2 - centerY * this.view.scale;
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
    if (this.displayMode === 'bw') {
      if (value === UNKNOWN) return `rgba(216,223,234,${0.62 * alpha})`;
      if (value === EMPTY) return `rgba(248,250,252,${alpha})`;
      return `rgba(3,5,8,${alpha})`;
    }
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
    const useLightInk = this.displayMode === 'bw' || paletteEntry?.id >= 4;
    context.strokeStyle = useLightInk ? 'rgba(255,255,255,0.38)' : 'rgba(4,10,18,0.3)';
    context.fillStyle = useLightInk ? 'rgba(255,255,255,0.44)' : 'rgba(4,10,18,0.34)';
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

  paletteEntry(value) {
    return this.puzzle.palette.find((entry) => entry.id === value);
  }

  paletteSymbol(entry) {
    return {
      yellow: 'Y',
      blue: 'B',
      green: 'G',
      red: 'R',
      brown: 'E',
      black: 'B',
    }[entry?.key] || entry?.key?.[0]?.toUpperCase() || String(entry?.id ?? '');
  }

  paletteTone(entry) {
    return entry?.key === 'black' || entry?.id >= 4 ? 'dark' : 'light';
  }

  clueTokens(clues) {
    if (!clues.length) return [{ text: '0', background: 'rgba(11,15,22,0.8)', ink: '#9cabc0', border: 'rgba(156,171,192,0.35)', tone: 'empty' }];
    return clues.map((run) => {
      const entry = this.paletteEntry(run.colorId);
      if (this.displayMode === 'bw') {
        return {
          text: String(run.length),
          background: '#f8fafc',
          ink: '#071018',
          border: 'rgba(255,255,255,0.9)',
          tone: 'light',
        };
      }
      const color = this.valueColor(run.colorId);
      return {
        text: String(run.length),
        background: 'rgba(7,11,17,0.84)',
        ink: color,
        border: color,
        tone: this.paletteTone(entry),
      };
    });
  }

  roundedRect(context, x, y, width, height, radius) {
    const corner = Math.min(radius, width / 2, height / 2);
    context.beginPath();
    context.moveTo(x + corner, y);
    context.lineTo(x + width - corner, y);
    context.quadraticCurveTo(x + width, y, x + width, y + corner);
    context.lineTo(x + width, y + height - corner);
    context.quadraticCurveTo(x + width, y + height, x + width - corner, y + height);
    context.lineTo(x + corner, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - corner);
    context.lineTo(x, y + corner);
    context.quadraticCurveTo(x, y, x + corner, y);
    context.closePath();
  }

  drawClueToken(context, token, x, y, width, height, active = false) {
    context.save();
    this.roundedRect(context, x, y, width, height, 6);
    context.fillStyle = token.background || token.color || 'rgba(11,15,22,0.8)';
    context.fill();
    context.lineWidth = active ? 2 : 1;
    context.strokeStyle = active ? '#8be9ff' : token.border || 'rgba(255,255,255,0.5)';
    context.stroke();
    context.fillStyle = token.ink || (token.tone === 'dark' ? '#ffffff' : token.tone === 'empty' ? '#9cabc0' : '#071018');
    context.shadowColor = token.tone === 'empty' ? 'transparent' : 'rgba(0,0,0,0.7)';
    context.shadowBlur = token.background === '#f8fafc' ? 0 : 5;
    context.font = `800 ${Math.max(10, Math.min(13, height * 0.58))}px Inter, system-ui, sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(token.text, x + width / 2, y + height / 2 + 0.5, width - 3);
    context.restore();
  }

  drawSquareAxisClues(context) {
    if (this.puzzle?.lattice.kind !== 'square') return;
    const { rows, columns } = this.axisTracks();
    if (!rows.length || !columns.length) return;

    const width = this.canvas.width / (this.pixelRatio || 1);
    const height = this.canvas.height / (this.pixelRatio || 1);
    const compact = Math.min(width, height) < 560;
    const tokenWidth = compact ? 21 : 25;
    const tokenHeight = compact ? 18 : 22;
    const gap = compact ? 3 : 4;
    const [leftA, topA] = this.worldToScreen([this.worldBounds.minX, this.worldBounds.minY]);
    const [rightA, bottomA] = this.worldToScreen([this.worldBounds.maxX, this.worldBounds.maxY]);
    const boardLeft = Math.min(leftA, rightA);
    const boardRight = Math.max(leftA, rightA);
    const boardTop = Math.min(topA, bottomA);
    const selectedId = this.selectedTrack?.type === 'space' ? this.selectedTrack.id : null;

    context.save();
    context.font = `800 ${compact ? 10 : 11}px Inter, system-ui, sans-serif`;
    context.fillStyle = 'rgba(156,171,192,0.9)';
    context.textBaseline = 'middle';
    context.textAlign = 'center';
    context.fillText('X', boardLeft - 14, boardTop - 14);
    context.fillText('Y', boardLeft - 14, boardTop + 12);

    for (const track of rows) {
      const tokens = this.clueTokens(track.clues);
      const points = track.cells.map((cellIndex) => this.worldToScreen(this.puzzle.lattice.cells[cellIndex].position));
      const y = points.reduce((sum, point) => sum + point[1], 0) / points.length - tokenHeight / 2;
      const totalWidth = tokens.length * tokenWidth + (tokens.length - 1) * gap;
      const startX = boardLeft - 12 - totalWidth;
      tokens.forEach((token, index) => {
        this.drawClueToken(context, token, startX + index * (tokenWidth + gap), y, tokenWidth, tokenHeight, track.id === selectedId);
      });
    }

    for (const track of columns) {
      const tokens = this.clueTokens(track.clues);
      const points = track.cells.map((cellIndex) => this.worldToScreen(this.puzzle.lattice.cells[cellIndex].position));
      const x = points.reduce((sum, point) => sum + point[0], 0) / points.length - tokenWidth / 2;
      const totalHeight = tokens.length * tokenHeight + (tokens.length - 1) * gap;
      const startY = boardTop - 12 - totalHeight;
      tokens.forEach((token, index) => {
        this.drawClueToken(context, token, x, startY + index * (tokenHeight + gap), tokenWidth, tokenHeight, track.id === selectedId);
      });
    }

    context.strokeStyle = 'rgba(139,233,255,0.22)';
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(boardLeft - 4, boardTop);
    context.lineTo(boardLeft - 4, this.worldToScreen([0, this.worldBounds.maxY])[1]);
    context.moveTo(boardLeft, boardTop - 4);
    context.lineTo(boardRight, boardTop - 4);
    context.stroke();
    context.restore();
  }

  boardScreenBounds() {
    const [leftA, topA] = this.worldToScreen([this.worldBounds.minX, this.worldBounds.minY]);
    const [rightA, bottomA] = this.worldToScreen([this.worldBounds.maxX, this.worldBounds.maxY]);
    return {
      left: Math.min(leftA, rightA),
      right: Math.max(leftA, rightA),
      top: Math.min(topA, bottomA),
      bottom: Math.max(topA, bottomA),
    };
  }

  familyShortLabel(family) {
    if (family.startsWith('hex-')) return family.at(-1).toUpperCase();
    if (family.startsWith('tri-')) return family.at(-1).toUpperCase();
    return family.split('-').at(-1)?.toUpperCase() || family.toUpperCase();
  }

  drawGeneralizedAxisClues(context) {
    if (!['hex', 'triangle'].includes(this.puzzle?.lattice.kind)) return;
    const groups = this.axisTrackGroups();
    if (!groups.length) return;

    const width = this.canvas.width / (this.pixelRatio || 1);
    const height = this.canvas.height / (this.pixelRatio || 1);
    const compact = Math.min(width, height) < 560;
    const tokenWidth = compact ? 21 : 25;
    const tokenHeight = compact ? 18 : 22;
    const gap = compact ? 3 : 4;
    const labelGap = compact ? 11 : 14;
    const board = this.boardScreenBounds();
    const boardWidth = Math.max(1, board.right - board.left);
    const boardHeight = Math.max(1, board.bottom - board.top);
    const selectedId = this.selectedTrack?.type === 'space' ? this.selectedTrack.id : null;

    context.save();
    context.font = `800 ${compact ? 10 : 11}px Inter, system-ui, sans-serif`;
    context.fillStyle = 'rgba(156,171,192,0.92)';
    context.textAlign = 'center';
    context.textBaseline = 'middle';

    groups.forEach((group, groupIndex) => {
      const side = this.clueFamilySide(group.family, groupIndex);
      const tracks = group.tracks;
      const axis = this.familyShortLabel(group.family);
      const labelX = side === 'left' ? board.left - labelGap : side === 'right' ? board.right + labelGap : board.left - labelGap;
      const labelY = side === 'top' ? board.top - labelGap : side === 'bottom' ? board.bottom + labelGap : board.top - labelGap;
      context.fillText(axis, labelX, labelY);

      tracks.forEach((track, trackIndex) => {
        const tokens = this.clueTokens(track.clues);
        const active = track.id === selectedId;
        if (side === 'left' || side === 'right') {
          const totalWidth = tokens.length * tokenWidth + (tokens.length - 1) * gap;
          const x = side === 'left' ? board.left - 12 - totalWidth : board.right + 12;
          const y = board.top + ((trackIndex + 0.5) / tracks.length) * boardHeight - tokenHeight / 2;
          tokens.forEach((token, index) => {
            this.drawClueToken(context, token, x + index * (tokenWidth + gap), y, tokenWidth, tokenHeight, active);
          });
        } else {
          const totalHeight = tokens.length * tokenHeight + (tokens.length - 1) * gap;
          const x = board.left + ((trackIndex + 0.5) / tracks.length) * boardWidth - tokenWidth / 2;
          const y = side === 'top' ? board.top - 12 - totalHeight : board.bottom + 12;
          tokens.forEach((token, index) => {
            this.drawClueToken(context, token, x, y + index * (tokenHeight + gap), tokenWidth, tokenHeight, active);
          });
        }
      });
    });

    context.strokeStyle = 'rgba(139,233,255,0.18)';
    context.lineWidth = 1;
    context.strokeRect(board.left - 4, board.top - 4, boardWidth + 8, boardHeight + 8);
    context.restore();
  }

  drawBoardAxisClues(context) {
    this.drawSquareAxisClues(context);
    this.drawGeneralizedAxisClues(context);
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
      const hinted = variableId === this.hintedVariableId;
      const onTrack = !activeCells || activeCells.has(cell.index);
      const alpha = onTrack ? 1 : 0.42;
      const screenPolygon = cell.polygon.map((point) => this.worldToScreen(point));
      const traceCell = () => {
        context.beginPath();
        screenPolygon.forEach(([x, y], index) => (index ? context.lineTo(x, y) : context.moveTo(x, y)));
        context.closePath();
      };
      traceCell();

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
        ? (this.displayMode === 'bw' ? `rgba(4,10,18,${0.62 * alpha})` : `rgba(102,119,144,${0.42 * alpha})`)
        : `rgba(130,151,180,${0.55 * alpha})`;
      context.lineWidth = Math.max(1, this.view.scale * 0.025);
      context.stroke();

      if (value === EMPTY) {
        const [cx, cy] = this.worldToScreen(cell.position);
        const size = Math.min(7, this.view.scale * 0.16);
        context.strokeStyle = this.displayMode === 'bw'
          ? `rgba(4,10,18,${0.7 * alpha})`
          : `rgba(144,160,183,${0.62 * alpha})`;
        context.lineWidth = 1.5;
        context.beginPath();
        context.moveTo(cx - size, cy - size); context.lineTo(cx + size, cy + size);
        context.moveTo(cx + size, cy - size); context.lineTo(cx - size, cy + size);
        context.stroke();
      }

      if (this.puzzle.givens[variableId]) {
        traceCell();
        context.strokeStyle = 'rgba(255,255,255,0.92)';
        context.lineWidth = Math.max(1.5, this.view.scale * 0.045);
        context.stroke();
      }

      if (cell.index === this.selectedCellIndex) {
        traceCell();
        context.strokeStyle = '#ffffff';
        context.lineWidth = Math.max(2.5, this.view.scale * 0.07);
        context.stroke();
      }

      if (hinted) {
        const [cx, cy] = this.worldToScreen(cell.position);
        context.save();
        traceCell();
        context.shadowColor = 'rgba(242,201,76,0.72)';
        context.shadowBlur = 14;
        context.strokeStyle = '#f2c94c';
        context.lineWidth = Math.max(3, this.view.scale * 0.09);
        context.stroke();
        context.shadowBlur = 0;
        context.fillStyle = '#f2c94c';
        context.beginPath();
        context.arc(cx, cy, Math.max(3.5, Math.min(8, this.view.scale * 0.08)), 0, Math.PI * 2);
        context.fill();
        context.restore();
      }
    }

    this.drawBoardAxisClues(context);
  }

  destroy() {
    this.resizeObserver.disconnect();
  }
}
