import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { EMPTY, UNKNOWN } from '../core/clues.js';
import { variableIdFor } from '../core/puzzle.js';
import { latticeVoronoiVertices } from './voronoi.js';

function dot(left, right) {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

function colorFor(puzzle, value) {
  if (value === UNKNOWN) return '#5e6c82';
  if (value === EMPTY) return '#17202c';
  return puzzle.palette.find((entry) => entry.id === value)?.color || '#ffffff';
}

function uniqueLevels(values, tolerance = 1e-5) {
  const sorted = [...values].sort((left, right) => left - right);
  const levels = [];
  for (const value of sorted) {
    if (!levels.length || Math.abs(value - levels.at(-1)) > tolerance) levels.push(value);
  }
  return levels;
}

export class Board3D {
  constructor(container, callbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;
    this.puzzle = null;
    this.state = [];
    this.frame = 0;
    this.selectedCellIndex = null;
    this.selectedTrack = null;
    this.tool = 'paint';
    this.viewMode = 'model';
    this.onionSkin = true;
    this.meshes = [];
    this.outlines = [];
    this.geometryCache = new Map();
    this.materialCache = new Map();
    this.lineMaterialCache = new Map();
    this.sliceFamilyId = null;
    this.sliceIndex = 0;
    this.sliceLevels = new Map();
    this.renderQueued = false;
    this.pointerStart = null;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#10151e');
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.01, 1000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.className = 'three-canvas';
    this.renderer.domElement.setAttribute('aria-label', callbacks.ariaLabel || 'Interactive three-dimensional puzzle view');
    this.renderer.domElement.tabIndex = 0;
    this.container.replaceChildren(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = false;
    this.controls.screenSpacePanning = true;
    this.controls.minDistance = 1.5;
    this.controls.maxDistance = 100;
    this.controls.addEventListener('change', () => this.requestRender());

    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.trackLine = null;

    const hemisphere = new THREE.HemisphereLight(0xd9edff, 0x17202c, 2.1);
    this.scene.add(hemisphere);
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.7);
    keyLight.position.set(6, 9, 11);
    this.scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0x8bbdff, 1.2);
    fillLight.position.set(-8, -3, 5);
    this.scene.add(fillLight);

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.bindEvents();
    this.setTool('paint');
    this.resize();
  }

  bindEvents() {
    const canvas = this.renderer.domElement;
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
    canvas.addEventListener('pointerdown', (event) => {
      this.pointerStart = { x: event.clientX, y: event.clientY, time: performance.now(), button: event.button };
    });
    canvas.addEventListener('pointerup', (event) => {
      if (!this.pointerStart) return;
      const distance = Math.hypot(event.clientX - this.pointerStart.x, event.clientY - this.pointerStart.y);
      const elapsed = performance.now() - this.pointerStart.time;
      const wasClick = distance < 6 && elapsed < 600;
      this.pointerStart = null;
      if (!wasClick || this.tool === 'orbit' || this.tool === 'move') return;
      const cellIndex = this.hitTest(event.clientX, event.clientY);
      if (cellIndex != null) {
        this.callbacks.onCellPointer?.(cellIndex, {
          phase: 'start', button: event.button, pointerType: event.pointerType, originalEvent: event,
        });
      }
    });
  }

  geometryFor(kind, basis = 0) {
    const key = `${kind}:${basis}`;
    if (this.geometryCache.has(key)) return this.geometryCache.get(key);
    const points = latticeVoronoiVertices(kind, basis).map(([x, y, z]) => new THREE.Vector3(x, y, z));
    const geometry = new ConvexGeometry(points);
    geometry.computeVertexNormals();
    const shrink = kind === 'sc' ? 0.9 : 0.84;
    geometry.scale(shrink, shrink, shrink);
    this.geometryCache.set(key, geometry);
    return geometry;
  }

  materialFor({ value, ghost = false, muted = false }) {
    const key = `${value}:${ghost ? 1 : 0}:${muted ? 1 : 0}`;
    if (this.materialCache.has(key)) return this.materialCache.get(key);
    const opacity = ghost ? 0.15 : value === UNKNOWN ? (muted ? 0.12 : 0.44) : (muted ? 0.3 : 0.94);
    const material = new THREE.MeshStandardMaterial({
      color: colorFor(this.puzzle, value),
      roughness: 0.62,
      metalness: this.puzzle.lattice.kind === 'sc' ? 0.02 : 0.12,
      transparent: opacity < 1,
      opacity,
      depthWrite: opacity > 0.55,
      side: THREE.DoubleSide,
    });
    this.materialCache.set(key, material);
    return material;
  }

  lineMaterial(color, opacity = 0.5, width = 1) {
    const key = `${color}:${opacity}:${width}`;
    if (this.lineMaterialCache.has(key)) return this.lineMaterialCache.get(key);
    const material = new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity, linewidth: width });
    this.lineMaterialCache.set(key, material);
    return material;
  }

  clearCells() {
    for (const outline of this.outlines) outline?.geometry?.dispose();
    for (const object of [...this.meshes, ...this.outlines]) this.root.remove(object);
    this.meshes = [];
    this.outlines = [];
    if (this.trackLine) {
      this.root.remove(this.trackLine);
      this.trackLine.geometry.dispose();
      this.trackLine = null;
    }
  }

  setPuzzle(puzzle, state) {
    this.clearCells();
    for (const material of this.materialCache.values()) material.dispose();
    this.materialCache.clear();
    this.puzzle = puzzle;
    this.state = state;
    this.frame = 0;
    this.selectedCellIndex = null;
    this.selectedTrack = null;
    this.viewMode = 'model';
    this.sliceFamilyId = puzzle.lattice.sliceFamilies[0]?.id || null;
    this.sliceIndex = 0;
    this.computeSliceLevels();

    for (const cell of puzzle.lattice.cells) {
      const geometry = this.geometryFor(puzzle.lattice.kind, cell.basis || 0);
      const mesh = new THREE.Mesh(geometry, this.materialFor({ value: UNKNOWN }));
      mesh.position.fromArray(cell.position);
      mesh.userData.cellIndex = cell.index;
      mesh.userData.pickable = true;
      this.root.add(mesh);
      this.meshes[cell.index] = mesh;

      const outlineGeometry = new THREE.EdgesGeometry(geometry, 18);
      const outline = new THREE.LineSegments(outlineGeometry, this.lineMaterial(0x97a6bb, 0.34));
      outline.position.copy(mesh.position);
      outline.userData.cellIndex = cell.index;
      this.root.add(outline);
      this.outlines[cell.index] = outline;
    }

    this.resetCamera();
    this.updateVisibility();
  }

  computeSliceLevels() {
    this.sliceLevels.clear();
    for (const family of this.puzzle?.lattice.sliceFamilies || []) {
      const levels = uniqueLevels(this.puzzle.lattice.cells.map((cell) => dot(cell.position, family.normal)));
      this.sliceLevels.set(family.id, levels);
    }
  }

  getSliceState() {
    const families = this.puzzle?.lattice.sliceFamilies || [];
    const family = families.find((entry) => entry.id === this.sliceFamilyId) || families[0] || null;
    const levels = family ? this.sliceLevels.get(family.id) || [] : [];
    return {
      families,
      family,
      levels,
      index: Math.max(0, Math.min(this.sliceIndex, Math.max(0, levels.length - 1))),
      value: levels[this.sliceIndex] ?? null,
    };
  }

  setSliceFamily(id) {
    if (!this.puzzle?.lattice.sliceFamilies.some((family) => family.id === id)) return;
    this.sliceFamilyId = id;
    this.sliceIndex = 0;
    this.updateVisibility();
    this.callbacks.onSliceChange?.(this.getSliceState());
  }

  setSliceIndex(index) {
    const levels = this.getSliceState().levels;
    this.sliceIndex = Math.max(0, Math.min(Number(index) || 0, Math.max(0, levels.length - 1)));
    this.updateVisibility();
    this.callbacks.onSliceChange?.(this.getSliceState());
  }

  setViewMode(mode) {
    this.viewMode = ['model', 'slice', 'track'].includes(mode) ? mode : 'model';
    this.updateVisibility();
  }

  setTool(tool) {
    this.tool = tool;
    const orbit = tool === 'orbit' || tool === 'move';
    this.controls.mouseButtons.LEFT = orbit ? THREE.MOUSE.ROTATE : null;
    this.controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;
    this.controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
    this.controls.touches.ONE = orbit ? THREE.TOUCH.ROTATE : null;
    this.controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
    this.renderer.domElement.style.cursor = orbit ? 'grab' : 'crosshair';
  }

  update({ state, frame, selectedCellIndex, selectedTrack, tool, onionSkin, viewMode } = {}) {
    if (state) this.state = state;
    if (frame != null) this.frame = frame;
    if (selectedCellIndex !== undefined) this.selectedCellIndex = selectedCellIndex;
    if (selectedTrack !== undefined) this.selectedTrack = selectedTrack;
    if (tool) this.setTool(tool);
    if (onionSkin != null) this.onionSkin = onionSkin;
    if (viewMode) this.viewMode = viewMode;
    this.updateVisibility();
  }

  cellIsInSlice(cell) {
    const slice = this.getSliceState();
    if (!slice.family || slice.value == null) return true;
    return Math.abs(dot(cell.position, slice.family.normal) - slice.value) < 1e-4;
  }

  cellIsOnTrack(cellIndex) {
    if (!this.selectedTrack) return cellIndex === this.selectedCellIndex;
    if (this.selectedTrack.type === 'time') return cellIndex === this.selectedCellIndex;
    return this.selectedTrack.cells.includes(cellIndex);
  }

  updateTrackLine() {
    if (this.trackLine) {
      this.root.remove(this.trackLine);
      this.trackLine.geometry.dispose();
      this.trackLine = null;
    }
    if (!this.selectedTrack || this.selectedTrack.type !== 'space' || this.selectedTrack.cells.length < 2) return;
    const points = this.selectedTrack.cells.map((cellIndex) => (
      new THREE.Vector3(...this.puzzle.lattice.cells[cellIndex].position)
    ));
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    this.trackLine = new THREE.Line(geometry, this.lineMaterial(0x8be9ff, 0.95));
    this.root.add(this.trackLine);
  }

  updateVisibility() {
    if (!this.puzzle) return;
    const activeCells = this.selectedTrack?.type === 'space' ? new Set(this.selectedTrack.cells) : null;
    for (const cell of this.puzzle.lattice.cells) {
      const mesh = this.meshes[cell.index];
      const outline = this.outlines[cell.index];
      const variableId = variableIdFor(this.puzzle, this.frame, cell.index);
      const value = this.state[variableId];
      const inSlice = this.cellIsInSlice(cell);
      const onTrack = this.cellIsOnTrack(cell.index);
      const visibleByMode = this.viewMode === 'model'
        || (this.viewMode === 'slice' && inSlice)
        || (this.viewMode === 'track' && onTrack);

      let displayValue = value;
      let ghost = false;
      if (this.onionSkin && this.frame > 0 && (value === UNKNOWN || value === EMPTY)) {
        const previous = this.state[variableIdFor(this.puzzle, this.frame - 1, cell.index)];
        if (previous > EMPTY) {
          displayValue = previous;
          ghost = true;
        }
      }

      const isSelected = cell.index === this.selectedCellIndex;
      const isEmpty = value === EMPTY && !ghost;
      mesh.visible = visibleByMode && (!isEmpty || isSelected);
      outline.visible = visibleByMode && (this.viewMode !== 'model' || value !== EMPTY || isSelected);
      if (!visibleByMode) continue;

      const muted = Boolean(activeCells && !activeCells.has(cell.index) && this.viewMode === 'model');
      mesh.material = this.materialFor({ value: displayValue, ghost, muted });
      mesh.renderOrder = ghost ? 0 : 1;

      if (isSelected) {
        outline.material = this.lineMaterial(0xffffff, 1);
        outline.scale.setScalar(1.045);
      } else if (activeCells?.has(cell.index)) {
        outline.material = this.lineMaterial(0x8be9ff, 0.9);
        outline.scale.setScalar(1.025);
      } else if (this.puzzle.givens[variableId]) {
        outline.material = this.lineMaterial(0xffe29b, 0.9);
        outline.scale.setScalar(1.015);
      } else {
        outline.material = this.lineMaterial(0x97a6bb, this.viewMode === 'model' ? 0.26 : 0.48);
        outline.scale.setScalar(1);
      }
    }
    this.updateTrackLine();
    this.requestRender();
  }

  hitTest(clientX, clientY) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const intersections = this.raycaster.intersectObjects(this.meshes.filter((mesh) => mesh?.visible), false);
    return intersections[0]?.object.userData.cellIndex ?? null;
  }

  resetCamera() {
    if (!this.puzzle?.lattice.cells.length) return;
    const box = new THREE.Box3();
    for (const cell of this.puzzle.lattice.cells) box.expandByPoint(new THREE.Vector3(...cell.position));
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const radius = Math.max(1, sphere.radius + 0.8);
    this.controls.target.copy(sphere.center);
    this.camera.position.copy(sphere.center).add(new THREE.Vector3(radius * 1.7, radius * 1.35, radius * 1.9));
    this.camera.near = Math.max(0.01, radius / 100);
    this.camera.far = radius * 40;
    this.camera.updateProjectionMatrix();
    this.controls.update();
    this.requestRender();
  }

  zoomBy(factor) {
    const direction = this.camera.position.clone().sub(this.controls.target);
    direction.multiplyScalar(1 / factor);
    const distance = Math.max(this.controls.minDistance, Math.min(this.controls.maxDistance, direction.length()));
    direction.setLength(distance);
    this.camera.position.copy(this.controls.target).add(direction);
    this.controls.update();
    this.requestRender();
  }

  resize() {
    const rect = this.container.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.requestRender();
  }

  requestRender() {
    if (this.renderQueued) return;
    this.renderQueued = true;
    requestAnimationFrame(() => {
      this.renderQueued = false;
      this.renderer.render(this.scene, this.camera);
    });
  }

  destroy() {
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.clearCells();
    for (const geometry of this.geometryCache.values()) geometry.dispose();
    for (const material of this.materialCache.values()) material.dispose();
    for (const material of this.lineMaterialCache.values()) material.dispose();
    this.geometryCache.clear();
    this.materialCache.clear();
    this.lineMaterialCache.clear();
    this.renderer.dispose();
    this.container.replaceChildren();
  }
}
