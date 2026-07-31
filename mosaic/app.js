import { EMPTY, UNKNOWN } from './core/clues.js';
import {
  createInitialState,
  decodeVariableId,
  isComplete,
  puzzleProgress,
  solverPayload,
  trackIsSatisfied,
  variableIdFor,
} from './core/puzzle.js';
import { LATTICE_OPTIONS } from './core/lattices.js';
import { forcedMoves } from './core/solver.js';
import { clearProgress, loadProgress, saveProgress } from './core/storage.js';
import { buildCatalog, findPuzzle } from './data/puzzles.js';
import { Board2D } from './render/board2d.js';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const I18N = {
  en: {
    tagline: 'Spatial & temporal colored logic', lattice: 'Lattice', puzzle: 'Puzzle', tools: 'Tools', paint: 'Paint',
    empty: 'Empty', clear: 'Clear', inspect: 'Inspect', move: 'Move / Orbit', palette: 'Palette', actions: 'Actions',
    undo: 'Undo', redo: 'Redo', hint: 'Hint', check: 'Check', reset: 'Reset', view: 'View', fit: 'Fit',
    onionSkin: 'Previous-frame ghost', strictMode: 'Immediate mistake warning', board: 'Board', model: 'Model',
    slice: 'Slice', track: 'Track', plane: 'Plane', spatialClue: 'Spatial clue', timeClue: 'Time clue',
    direction: 'Direction', orderedTrack: 'Ordered track', trackInstruction: 'Select or edit any cell here when the model is difficult to reach.',
    selectedCell: 'Selected cell', state: 'State', memberships: 'Spatial tracks', temporalRun: 'Temporal clue',
    semanticPart: 'Semantic part', modelParts: 'Model parts', whyThisLattice: 'Why this lattice?', clues: 'Clues',
    howToPlay: 'How to play', sharedRule: 'One rule across every geometry',
    sharedRuleText: 'Each clue is an ordered list of colored runs. [Yellow 2] [Blue 3] means two connected yellow cells followed later—or immediately, because the colors differ—by three connected blue cells. Runs of the same color require at least one empty cell between them.',
    timeRule: 'Time is a real clue direction', timeRuleText: 'In +Time modes, spatial clues apply inside each frame. Selecting one cell also reveals its ordered run through all frames. The timeline is therefore part of the logic, not a countdown.',
    threeDViews: 'Three complementary 3D views', threeDViewsText: 'Model gives context, Slice exposes internal layers, and Track isolates exactly one clue line. Use Paint, Empty, or Clear for editing; use Move / Orbit when you want camera control.',
    shortcuts: 'Keyboard shortcuts', chooseColor: 'Choose color', markEmpty: 'Mark empty', clearCell: 'Clear to unknown',
    orbitCamera: 'Move / orbit', undoRedo: 'Undo / redo', changeFrame: 'Previous / next frame', startPlaying: 'Start playing',
    completed: 'Puzzle completed', replayAnimation: 'Replay animation', nextPuzzle: 'Next puzzle', close: 'Close',
    unknown: 'Unknown', noPart: 'None', hidden: 'Hidden', solved: 'Clue satisfied', incomplete: 'Clue incomplete',
    noRuns: 'No colored cells', given: 'Given', frame: 'Frame', temporal: 'Time', loading3d: 'Loading the 3D lattice viewer…',
    rendererFallback: 'The 3D library could not load. The ordered Track panel remains fully playable; serve the app online or install dependencies to restore the model viewer.',
    hintApplied: 'One logically forced cell was filled.', noHint: 'No forced move is available from the current state.',
    contradiction: 'The current marks contradict at least one clue. Undo or clear a recent mark.',
    checkPerfect: 'Every decided cell is correct. Continue solving the remaining unknown cells.',
    checkWrong: (count) => `${count} decided cell${count === 1 ? '' : 's'} currently disagree with the solution.`,
    strictRejected: 'That value is not compatible with this puzzle in strict mode.', resetConfirm: 'Reset this puzzle and erase its saved progress?',
    completeText: (title) => `${title} is complete. Explore the finished model, its parts, or replay its time evolution.`,
    mode2: '2D', mode2t: '2D + Time', mode3: '3D', mode3t: '3D + Time',
  },
  zh: {
    tagline: '跨空間與時間的彩色邏輯', lattice: '晶格／鋪砌', puzzle: '關卡', tools: '工具', paint: '上色',
    empty: '標記空格', clear: '清除', inspect: '檢視', move: '移動／旋轉', palette: '色盤', actions: '操作',
    undo: '復原', redo: '重做', hint: '提示', check: '檢查', reset: '重設', view: '視圖', fit: '置中',
    onionSkin: '顯示前一幀殘影', strictMode: '立即提示錯誤', board: '盤面', model: '模型', slice: '切片', track: '路徑',
    plane: '切面', spatialClue: '空間線索', timeClue: '時間線索', direction: '方向', orderedTrack: '有序路徑',
    trackInstruction: '模型內部不易選取時，可直接在這裡選擇或編輯任一格。', selectedCell: '目前格子', state: '狀態',
    memberships: '所屬空間路徑', temporalRun: '時間線索', semanticPart: '語意部件', modelParts: '模型部件',
    whyThisLattice: '此晶格的意義', clues: '線索', howToPlay: '玩法說明', sharedRule: '所有幾何共用一套規則',
    sharedRuleText: '每條線索都是依序排列的彩色連續區段。[黃 2] [藍 3] 表示兩格連續黃色，之後出現三格連續藍色；因顏色不同，兩段可以直接相接。相同顏色的兩段之間至少要有一格空白。',
    timeRule: '時間是真正的線索方向', timeRuleText: '在「+時間」模式，每一幀有自己的空間線索；選取一格後，也會看到它跨越所有時間幀的有序線索。因此時間軸參與推理，不是倒數計時。',
    threeDViews: '三種互補的 3D 視圖', threeDViewsText: '模型視圖提供整體脈絡，切片視圖揭露內部，路徑視圖只保留一條線索線。上色、空格與清除負責編輯；需要控制鏡頭時切換到移動／旋轉。',
    shortcuts: '鍵盤快捷鍵', chooseColor: '選擇顏色', markEmpty: '標記空格', clearCell: '清回未知', orbitCamera: '移動／旋轉',
    undoRedo: '復原／重做', changeFrame: '上一幀／下一幀', startPlaying: '開始遊玩', completed: '關卡完成',
    replayAnimation: '重播動畫', nextPuzzle: '下一關', close: '關閉', unknown: '未知', noPart: '無', hidden: '尚未揭示',
    solved: '線索已完成', incomplete: '線索尚未完成', noRuns: '沒有著色格', given: '已知格', frame: '時間幀', temporal: '時間',
    loading3d: '正在載入 3D 晶格檢視器…', rendererFallback: '3D 函式庫載入失敗；右側的有序路徑仍可完整解題。以網路伺服器開啟或安裝相依套件後即可恢復模型視圖。',
    hintApplied: '已填入一個由目前線索必然推出的格子。', noHint: '目前狀態沒有可直接推出的下一格。',
    contradiction: '目前標記與至少一條線索矛盾，請復原或清除最近的操作。', checkPerfect: '所有已決定的格子都正確，請繼續完成其餘未知格。',
    checkWrong: (count) => `目前有 ${count} 個已決定格與答案不一致。`, strictRejected: '嚴格模式下不能填入與本關不相容的狀態。',
    resetConfirm: '確定重設本關並刪除已儲存進度？', completeText: (title) => `「${title}」已完成。可探索完成模型、語意部件或重播時間演化。`,
    mode2: '2D', mode2t: '2D＋時間', mode3: '3D', mode3t: '3D＋時間',
  },
};

const LATTICE_NAMES = {
  en: { square: 'Square cells', hex: 'Hexagonal cells', triangle: 'Triangular cells', sc: 'Simple cubic', fcc: 'FCC Voronoi cells', bcc: 'BCC Voronoi cells', hcp: 'HCP Voronoi cells' },
  zh: { square: '正方格', hex: '六角格', triangle: '三角格', sc: '簡單立方', fcc: 'FCC Voronoi 格', bcc: 'BCC Voronoi 格', hcp: 'HCP Voronoi 格' },
};

class TopoMosaicApp {
  constructor() {
    this.catalog = buildCatalog();
    const requestedLanguage = new URLSearchParams(location.search).get('lang');
    const storedLanguage = localStorage.getItem('topomosaic:lang') || localStorage.getItem('topological-boardgame:language');
    this.lang = (requestedLanguage || storedLanguage || (navigator.language.startsWith('zh') ? 'zh' : 'en')).toLowerCase().startsWith('zh') ? 'zh' : 'en';
    this.puzzle = null;
    this.state = [];
    this.currentFrame = 0;
    this.selectedColor = 1;
    this.tool = 'paint';
    this.clueMode = 'space';
    this.viewMode = 'board';
    this.selectedCellIndex = null;
    this.selectedTrack = null;
    this.activeFamily = null;
    this.history = [];
    this.redoStack = [];
    this.strictMode = false;
    this.onionSkin = true;
    this.playTimer = null;
    this.saveTimer = null;
    this.toastTimer = null;
    this.board2d = new Board2D($('#board2d'), { onCellPointer: (cell, detail) => this.handleCellPointer(cell, detail) });
    this.board3d = null;
    this.worker = null;
    this.workerRequests = new Map();
    this.nextWorkerRequest = 1;
    this.bindEvents();
    this.applyLanguage();
    this.initializeFromUrl();
    this.registerServiceWorker();
  }

  t(key, ...args) {
    const value = I18N[this.lang][key] ?? I18N.en[key] ?? key;
    return typeof value === 'function' ? value(...args) : value;
  }

  bindEvents() {
    $('#languageButton').addEventListener('click', () => {
      this.lang = this.lang === 'en' ? 'zh' : 'en';
      localStorage.setItem('topomosaic:lang', this.lang);
      localStorage.setItem('topological-boardgame:language', this.lang);
      this.applyLanguage();
      this.refreshDynamicText();
    });
    $('#helpButton').addEventListener('click', () => $('#helpDialog').showModal());
    $$('#modeSwitch [data-mode]').forEach((button) => button.addEventListener('click', () => this.setMode(button.dataset.mode)));
    $('#latticeSelect').addEventListener('change', () => this.populatePuzzleSelect());
    $('#puzzleSelect').addEventListener('change', () => this.loadPuzzle(findPuzzle($('#puzzleSelect').value)));
    $$('#toolGrid [data-tool]').forEach((button) => button.addEventListener('click', () => this.setTool(button.dataset.tool)));
    $$('[data-mobile-tool]').forEach((button) => button.addEventListener('click', () => this.setTool(button.dataset.mobileTool)));
    $('#mobileClueButton').addEventListener('click', () => document.body.classList.toggle('clue-open'));
    document.addEventListener('pointerdown', (event) => {
      if (document.body.classList.contains('clue-open') && !event.target.closest('.clue-panel') && !event.target.closest('#mobileClueButton')) {
        document.body.classList.remove('clue-open');
      }
    });

    $('#undoButton').addEventListener('click', () => this.undo());
    $('#redoButton').addEventListener('click', () => this.redo());
    $('#hintButton').addEventListener('click', () => this.giveHint());
    $('#checkButton').addEventListener('click', () => this.checkPuzzle());
    $('#resetButton').addEventListener('click', () => this.resetPuzzle());
    $('#zoomInButton').addEventListener('click', () => this.activeRenderer()?.zoomBy(1.18));
    $('#zoomOutButton').addEventListener('click', () => this.activeRenderer()?.zoomBy(1 / 1.18));
    $('#fitViewButton').addEventListener('click', () => {
      if (this.puzzle.dimension === 2) this.board2d.fitToView();
      else this.board3d?.resetCamera();
    });
    $('#onionSkinToggle').addEventListener('change', (event) => {
      this.onionSkin = event.target.checked; this.updateRenderer();
    });
    $('#strictModeToggle').addEventListener('change', (event) => { this.strictMode = event.target.checked; });

    $$('#viewTabs [data-view]').forEach((button) => button.addEventListener('click', () => this.setViewMode(button.dataset.view)));
    $$('#clueModeTabs [data-clue-mode]').forEach((button) => button.addEventListener('click', () => this.setClueMode(button.dataset.clueMode)));
    $('#trackFamilySelect').addEventListener('change', (event) => this.setTrackFamily(event.target.value));
    $('#previousTrackButton').addEventListener('click', () => this.stepTrack(-1));
    $('#nextTrackButton').addEventListener('click', () => this.stepTrack(1));

    $('#timelineSlider').addEventListener('input', (event) => this.setFrame(Number(event.target.value)));
    $('#previousFrameButton').addEventListener('click', () => this.setFrame(this.currentFrame - 1));
    $('#nextFrameButton').addEventListener('click', () => this.setFrame(this.currentFrame + 1));
    $('#playButton').addEventListener('click', () => this.togglePlayback());

    $('#sliceFamilySelect').addEventListener('change', (event) => this.board3d?.setSliceFamily(event.target.value));
    $('#sliceSlider').addEventListener('input', (event) => this.board3d?.setSliceIndex(Number(event.target.value)));
    $('#slicePreviousButton').addEventListener('click', () => this.board3d?.setSliceIndex(Number($('#sliceSlider').value) - 1));
    $('#sliceNextButton').addEventListener('click', () => this.board3d?.setSliceIndex(Number($('#sliceSlider').value) + 1));

    $('#replayAnimationButton').addEventListener('click', () => {
      $('#completionDialog').close(); this.setFrame(0); this.startPlayback(false);
    });
    $('#nextPuzzleButton').addEventListener('click', () => {
      $('#completionDialog').close(); this.loadNextPuzzle();
    });

    window.addEventListener('keydown', (event) => this.handleKeyboard(event));
  }

  initializeFromUrl() {
    const params = new URLSearchParams(location.search);
    const requested = params.get('puzzle') ? findPuzzle(params.get('puzzle')) : null;
    if (requested) {
      this.setMode(this.modeForPuzzle(requested), requested.lattice.kind, requested.id);
      return;
    }
    const dimension = params.get('dimension') === '3' ? 3 : 2;
    const hasTime = params.get('time') !== '0';
    const mode = `${dimension}-${hasTime ? 'time' : 'static'}`;
    this.setMode(mode, params.get('lattice') || (dimension === 2 ? 'square' : 'sc'));
  }

  modeForPuzzle(puzzle) { return `${puzzle.dimension}-${puzzle.hasTime ? 'time' : 'static'}`; }

  setMode(mode, preferredLattice = null, preferredPuzzle = null) {
    this.stopPlayback();
    const [dimensionText, timeText] = mode.split('-');
    this.mode = mode;
    this.modeDimension = Number(dimensionText);
    this.modeHasTime = timeText === 'time';
    $$('#modeSwitch [data-mode]').forEach((button) => button.classList.toggle('active', button.dataset.mode === mode));
    this.populateLatticeSelect(preferredLattice);
    this.populatePuzzleSelect(preferredPuzzle);
  }

  populateLatticeSelect(preferred = null) {
    const select = $('#latticeSelect');
    const options = LATTICE_OPTIONS[this.modeDimension].filter((option) => this.catalog.some((puzzle) => (
      puzzle.dimension === this.modeDimension && puzzle.hasTime === this.modeHasTime && puzzle.lattice.kind === option.id
    )));
    const previous = preferred || select.value;
    select.replaceChildren(...options.map((option) => {
      const element = document.createElement('option'); element.value = option.id;
      element.textContent = LATTICE_NAMES[this.lang][option.id]; return element;
    }));
    select.value = options.some((option) => option.id === previous) ? previous : options[0]?.id;
  }

  populatePuzzleSelect(preferred = null) {
    const lattice = $('#latticeSelect').value;
    const puzzles = this.catalog.filter((puzzle) => (
      puzzle.dimension === this.modeDimension && puzzle.hasTime === this.modeHasTime && puzzle.lattice.kind === lattice
    ));
    const select = $('#puzzleSelect');
    const previous = preferred || select.value;
    select.replaceChildren(...puzzles.map((puzzle) => {
      const option = document.createElement('option'); option.value = puzzle.id;
      option.textContent = this.lang === 'zh' ? puzzle.titleZh : puzzle.title; return option;
    }));
    select.value = puzzles.some((puzzle) => puzzle.id === previous) ? previous : puzzles[0]?.id;
    const puzzle = findPuzzle(select.value);
    if (puzzle) this.loadPuzzle(puzzle);
  }

  async loadPuzzle(puzzle) {
    if (!puzzle) return;
    this.stopPlayback();
    this.puzzle = puzzle;
    const saved = loadProgress(puzzle);
    this.state = saved?.state?.slice() || createInitialState(puzzle);
    for (let index = 0; index < puzzle.givens.length; index += 1) {
      if (puzzle.givens[index]) this.state[index] = puzzle.solution[index];
    }
    this.currentFrame = Math.max(0, Math.min(saved?.frame || 0, puzzle.frameCount - 1));
    this.selectedColor = puzzle.palette[0]?.id || 1;
    this.tool = 'paint';
    this.clueMode = 'space';
    this.viewMode = puzzle.dimension === 2 ? 'board' : 'model';
    this.history = [];
    this.redoStack = [];
    this.selectedCellIndex = Math.floor(puzzle.lattice.cells.length / 2);
    this.activeFamily = puzzle.lattice.tracks[0]?.family || null;
    this.selectBestTrack();
    $('#puzzleSelect').value = puzzle.id;
    $('#difficultyBadge').textContent = puzzle.difficulty;
    this.renderPalette();
    this.configureModeUi();
    this.refreshDynamicText();
    if (puzzle.dimension === 2) this.board2d.setPuzzle(puzzle, this.state);
    if (puzzle.dimension === 3) await this.ensure3DRenderer();
    this.updateAll();
    this.updateUrl();
  }

  async ensure3DRenderer() {
    $('#rendererNotice').hidden = false;
    $('#rendererNotice').textContent = this.t('loading3d');
    try {
      if (!this.board3d) {
        const { Board3D } = await import('./render/board3d.js');
        this.board3d = new Board3D($('#board3d'), {
          onCellPointer: (cell, detail) => this.handleCellPointer(cell, detail),
          onSliceChange: (slice) => this.syncSliceUi(slice),
        });
      }
      this.board3d.setPuzzle(this.puzzle, this.state);
      this.board3d.setTool(this.tool);
      this.board3d.setViewMode(this.viewMode);
      this.syncSliceUi(this.board3d.getSliceState());
      $('#rendererNotice').hidden = true;
    } catch (error) {
      console.error(error);
      $('#rendererNotice').hidden = false;
      $('#rendererNotice').textContent = this.t('rendererFallback');
    }
  }

  configureModeUi() {
    const is3d = this.puzzle.dimension === 3;
    $('#board2d').hidden = is3d;
    $('#board3d').hidden = !is3d;
    $$('#viewTabs [data-view]').forEach((button) => {
      button.hidden = is3d ? button.dataset.view === 'board' : button.dataset.view !== 'board';
    });
    $('#timelinePanel').hidden = !this.puzzle.hasTime;
    $('#clueModeTabs [data-clue-mode="time"]').disabled = !this.puzzle.hasTime;
    $('#temporalSummaryRow').hidden = !this.puzzle.hasTime;
    $('#onionSkinToggle').closest('.toggle-row').hidden = !this.puzzle.hasTime;
    $('#timelineSlider').max = String(this.puzzle.frameCount - 1);
    $('#replayAnimationButton').hidden = !this.puzzle.hasTime;
    this.setViewMode(is3d ? 'model' : 'board');
  }

  refreshDynamicText() {
    if (!this.puzzle) return;
    $('#puzzleTitle').textContent = this.lang === 'zh' ? this.puzzle.titleZh : this.puzzle.title;
    $('#puzzleDescription').textContent = this.lang === 'zh' ? this.puzzle.descriptionZh : this.puzzle.description;
    const modeKey = this.puzzle.dimension === 2 ? (this.puzzle.hasTime ? 'mode2t' : 'mode2') : (this.puzzle.hasTime ? 'mode3t' : 'mode3');
    $('#modeEyebrow').textContent = `${this.t(modeKey)} · ${LATTICE_NAMES[this.lang][this.puzzle.lattice.kind]}`;
    [...$('#puzzleSelect').options].forEach((option) => {
      const puzzle = findPuzzle(option.value); if (puzzle) option.textContent = this.lang === 'zh' ? puzzle.titleZh : puzzle.title;
    });
    [...$('#latticeSelect').options].forEach((option) => { option.textContent = LATTICE_NAMES[this.lang][option.value]; });
    this.renderSemanticLegend();
    this.renderClues();
    this.renderCellCard();
  }

  applyLanguage() {
    document.documentElement.lang = this.lang === 'zh' ? 'zh-Hant' : 'en';
    $('#languageButton').textContent = this.lang === 'en' ? '中' : 'EN';
    const modeLabels = { '2-static': this.t('mode2'), '2-time': this.t('mode2t'), '3-static': this.t('mode3'), '3-time': this.t('mode3t') };
    $$('#modeSwitch [data-mode]').forEach((button) => { button.textContent = modeLabels[button.dataset.mode]; });
    $$('[data-i18n]').forEach((element) => {
      const value = I18N[this.lang][element.dataset.i18n];
      if (typeof value === 'string') element.textContent = value;
    });
  }

  setTool(tool) {
    this.stopPlayback();
    this.tool = tool;
    $$('#toolGrid [data-tool]').forEach((button) => button.classList.toggle('active', button.dataset.tool === tool));
    $$('[data-mobile-tool]').forEach((button) => button.classList.toggle('active', button.dataset.mobileTool === tool));
    this.updateRenderer();
  }

  renderPalette() {
    const container = $('#paletteButtons');
    container.replaceChildren(...this.puzzle.palette.map((entry, index) => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = `palette-button${entry.id === this.selectedColor ? ' active' : ''}`;
      button.setAttribute('role', 'radio'); button.setAttribute('aria-checked', String(entry.id === this.selectedColor));
      button.title = entry.name; button.dataset.colorId = String(entry.id);
      button.innerHTML = `<span class="swatch" style="background:${entry.color}"></span><span class="key">${index + 1}</span>`;
      button.addEventListener('click', () => {
        this.selectedColor = entry.id; this.setTool('paint'); this.renderPalette();
      });
      return button;
    }));
  }

  handleCellPointer(cellIndex, detail) {
    this.stopPlayback();
    this.selectCell(cellIndex);
    if (this.tool === 'inspect' || this.tool === 'orbit' || this.tool === 'move') return;
    let value = this.tool === 'paint' ? this.selectedColor : this.tool === 'empty' ? EMPTY : UNKNOWN;
    if (detail.button === 2) value = EMPTY;
    this.applyVariable(variableIdFor(this.puzzle, this.currentFrame, cellIndex), value);
  }

  applyVariable(variableId, value, { announce = false } = {}) {
    if (this.puzzle.givens[variableId]) {
      this.toast(this.t('given')); return false;
    }
    if (this.strictMode && value !== UNKNOWN && value !== this.puzzle.solution[variableId]) {
      this.toast(this.t('strictRejected'), 'error'); return false;
    }
    const previous = this.state[variableId];
    if (previous === value) return false;
    this.state[variableId] = value;
    this.history.push({ variableId, previous, next: value });
    if (this.history.length > 500) this.history.shift();
    this.redoStack = [];
    const decoded = decodeVariableId(this.puzzle, variableId);
    this.currentFrame = decoded.frame;
    this.selectedCellIndex = decoded.cellIndex;
    this.selectBestTrack();
    this.scheduleSave();
    this.updateAll();
    if (announce) this.announce(`${this.describeCell(decoded.cellIndex)}: ${this.describeValue(value)}`);
    if (isComplete(this.puzzle, this.state)) this.showCompletion();
    return true;
  }

  undo() {
    const change = this.history.pop(); if (!change) return;
    this.state[change.variableId] = change.previous; this.redoStack.push(change);
    const decoded = decodeVariableId(this.puzzle, change.variableId);
    this.currentFrame = decoded.frame; this.selectedCellIndex = decoded.cellIndex; this.selectBestTrack();
    this.scheduleSave(); this.updateAll();
  }

  redo() {
    const change = this.redoStack.pop(); if (!change) return;
    this.state[change.variableId] = change.next; this.history.push(change);
    const decoded = decodeVariableId(this.puzzle, change.variableId);
    this.currentFrame = decoded.frame; this.selectedCellIndex = decoded.cellIndex; this.selectBestTrack();
    this.scheduleSave(); this.updateAll();
  }

  selectCell(cellIndex) {
    this.selectedCellIndex = cellIndex;
    this.selectBestTrack();
    this.updateAll();
  }

  selectBestTrack() {
    if (!this.puzzle) return;
    if (this.clueMode === 'time' && this.puzzle.hasTime) {
      this.selectedTrack = this.puzzle.tracks.find((track) => track.type === 'time' && track.cells[0] === this.selectedCellIndex) || null;
      return;
    }
    const frameTracks = this.puzzle.tracks.filter((track) => track.type === 'space' && track.frame === this.currentFrame);
    const candidates = frameTracks.filter((track) => track.cells.includes(this.selectedCellIndex));
    this.selectedTrack = candidates.find((track) => track.family === this.activeFamily) || candidates[0] || frameTracks[0] || null;
    if (this.selectedTrack) this.activeFamily = this.selectedTrack.family;
  }

  setClueMode(mode) {
    if (mode === 'time' && !this.puzzle.hasTime) return;
    this.clueMode = mode;
    $$('#clueModeTabs [data-clue-mode]').forEach((button) => button.classList.toggle('active', button.dataset.clueMode === mode));
    this.selectBestTrack(); this.updateAll();
  }

  setTrackFamily(family) {
    this.activeFamily = family;
    const tracks = this.familyTracks();
    this.selectedTrack = tracks.find((track) => track.cells.includes(this.selectedCellIndex)) || tracks[0] || this.selectedTrack;
    this.updateAll();
  }

  familyTracks() {
    if (this.clueMode === 'time') return this.puzzle.tracks.filter((track) => track.type === 'time');
    return this.puzzle.tracks.filter((track) => track.type === 'space' && track.frame === this.currentFrame && track.family === this.activeFamily);
  }

  stepTrack(direction) {
    const tracks = this.familyTracks(); if (!tracks.length) return;
    let index = Math.max(0, tracks.findIndex((track) => track.id === this.selectedTrack?.id));
    index = (index + direction + tracks.length) % tracks.length;
    this.selectedTrack = tracks[index];
    this.selectedCellIndex = this.selectedTrack.cells[0];
    this.updateAll();
  }

  setFrame(frame) {
    this.stopPlayback();
    const next = Math.max(0, Math.min(frame, this.puzzle.frameCount - 1));
    if (next === this.currentFrame) return;
    const baseTrackId = this.selectedTrack?.baseTrackId;
    this.currentFrame = next;
    if (this.clueMode === 'space' && baseTrackId) {
      this.selectedTrack = this.puzzle.tracks.find((track) => track.type === 'space' && track.frame === next && track.baseTrackId === baseTrackId) || null;
    }
    this.selectBestTrack(); this.scheduleSave(); this.updateAll();
  }

  setViewMode(mode) {
    if (this.puzzle.dimension === 2) mode = 'board';
    this.viewMode = mode;
    $$('#viewTabs [data-view]').forEach((button) => button.classList.toggle('active', button.dataset.view === mode));
    $('#sliceControls').hidden = !(this.puzzle.dimension === 3 && mode === 'slice');
    this.board3d?.setViewMode(mode);
    this.updateRenderer();
  }

  updateAll() {
    this.updateRenderer();
    this.renderProgress();
    this.renderTrackNavigation();
    this.renderClues();
    this.renderTrackStrip();
    this.renderCellCard();
    this.renderTimeline();
    $('#undoButton').disabled = !this.history.length;
    $('#redoButton').disabled = !this.redoStack.length;
  }

  activeRenderer() { return this.puzzle.dimension === 2 ? this.board2d : this.board3d; }

  updateRenderer() {
    const data = {
      state: this.state, frame: this.currentFrame, selectedCellIndex: this.selectedCellIndex,
      selectedTrack: this.selectedTrack, tool: this.tool, onionSkin: this.onionSkin, viewMode: this.viewMode,
    };
    if (this.puzzle.dimension === 2) this.board2d.update(data);
    else this.board3d?.update(data);
    $('#viewportBadge').textContent = this.puzzle.hasTime ? `${this.t('frame')} ${this.currentFrame + 1} / ${this.puzzle.frameCount}` : LATTICE_NAMES[this.lang][this.puzzle.lattice.kind];
  }

  renderProgress() {
    const progress = puzzleProgress(this.puzzle, this.state);
    const percent = Math.round(progress.decidedRatio * 100);
    $('#progressText').textContent = `${progress.decided} / ${progress.total}`;
    $('#progressPercent').textContent = `${percent}%`;
    $('#progressFill').style.width = `${percent}%`;
  }

  renderTrackNavigation() {
    const familySelect = $('#trackFamilySelect');
    if (this.clueMode === 'time') {
      familySelect.replaceChildren(new Option(this.t('temporal'), 'time'));
      familySelect.disabled = true;
    } else {
      const tracks = this.puzzle.tracks.filter((track) => track.type === 'space' && track.frame === this.currentFrame);
      const families = [...new Map(tracks.map((track) => [track.family, track.familyLabel])).entries()];
      familySelect.replaceChildren(...families.map(([id, label]) => new Option(label, id)));
      familySelect.value = this.activeFamily;
      familySelect.disabled = false;
    }
    $('#trackFamilyLabel').textContent = this.selectedTrack?.familyLabel || '—';
    $('#trackLineLabel').textContent = this.selectedTrack?.lineLabel || '—';
  }

  renderClues() {
    const container = $('#clueChips');
    if (!this.selectedTrack?.clues.length) {
      const empty = document.createElement('span'); empty.className = 'empty-clue'; empty.textContent = this.t('noRuns');
      container.replaceChildren(empty);
    } else {
      container.replaceChildren(...this.selectedTrack.clues.map((run) => {
        const palette = this.puzzle.palette.find((entry) => entry.id === run.colorId);
        const chip = document.createElement('span'); chip.className = 'clue-chip';
        chip.style.background = palette?.color || '#fff'; chip.title = `${palette?.name || run.colorId}: ${run.length}`;
        chip.innerHTML = `<span class="clue-pattern" aria-hidden="true"></span><span>${palette?.key?.[0]?.toUpperCase() || ''}${run.length}</span>`;
        return chip;
      }));
    }
    const satisfied = this.selectedTrack ? trackIsSatisfied(this.selectedTrack, this.state) : false;
    $('#trackStatus').textContent = satisfied ? `✓ ${this.t('solved')}` : this.t('incomplete');
    $('#trackStatus').classList.toggle('solved', satisfied);
  }

  renderTrackStrip() {
    const container = $('#trackStrip');
    if (!this.selectedTrack) { container.replaceChildren(); return; }
    container.replaceChildren(...this.selectedTrack.variables.map((variableId, offset) => {
      const { frame, cellIndex } = decodeVariableId(this.puzzle, variableId);
      const value = this.state[variableId];
      const button = document.createElement('button'); button.type = 'button';
      button.className = `track-cell${cellIndex === this.selectedCellIndex && frame === this.currentFrame ? ' selected' : ''}${this.puzzle.givens[variableId] ? ' given' : ''}`;
      button.style.background = value > EMPTY ? this.colorForValue(value) : value === EMPTY ? '#17202c' : '#39465a';
      button.textContent = value === EMPTY ? '×' : value === UNKNOWN ? '?' : '';
      button.innerHTML += `<span class="cell-index">${this.selectedTrack.type === 'time' ? `t${frame + 1}` : offset + 1}</span>`;
      button.setAttribute('role', 'listitem');
      button.setAttribute('aria-label', `${this.describeCell(cellIndex)}, ${this.t('frame')} ${frame + 1}, ${this.describeValue(value)}`);
      button.addEventListener('click', () => {
        this.currentFrame = frame; this.selectedCellIndex = cellIndex; this.selectBestTrack();
        if (!['inspect', 'orbit', 'move'].includes(this.tool)) {
          const next = this.tool === 'paint' ? this.selectedColor : this.tool === 'empty' ? EMPTY : UNKNOWN;
          this.applyVariable(variableId, next, { announce: true });
        } else this.updateAll();
      });
      return button;
    }));
  }

  renderCellCard() {
    if (this.selectedCellIndex == null) return;
    const cell = this.puzzle.lattice.cells[this.selectedCellIndex];
    const variableId = variableIdFor(this.puzzle, this.currentFrame, this.selectedCellIndex);
    const value = this.state[variableId];
    $('#cellCoordinate').textContent = this.describeCell(this.selectedCellIndex);
    $('#cellState').textContent = this.describeValue(value);
    const memberships = this.puzzle.tracks.filter((track) => track.type === 'space' && track.frame === this.currentFrame && track.cells.includes(this.selectedCellIndex));
    $('#cellMemberships').textContent = memberships.map((track) => `${track.familyLabel} ${track.lineLabel}`).join(' · ') || '—';
    const temporal = this.puzzle.tracks.find((track) => track.type === 'time' && track.cells[0] === this.selectedCellIndex);
    $('#temporalSummary').textContent = temporal ? this.clueText(temporal.clues) : '—';
    const partId = this.puzzle.semanticPartByVariable[variableId];
    const part = this.puzzle.semanticParts.find((entry) => entry.id === partId);
    const revealed = value > EMPTY && value === this.puzzle.solution[variableId];
    $('#semanticPart').textContent = part && revealed ? (this.lang === 'zh' ? part.nameZh || part.name : part.name) : part ? this.t('hidden') : this.t('noPart');
  }

  renderSemanticLegend() {
    const section = $('#semanticLegendSection');
    section.hidden = !this.puzzle.semanticParts.length;
    if (section.hidden) return;
    $('#semanticLegend').replaceChildren(...this.puzzle.semanticParts.map((part) => {
      const item = document.createElement('div'); item.className = 'semantic-item';
      item.innerHTML = `<span class="semantic-swatch" style="background:${this.colorForValue(part.colorId)}"></span><span>${this.lang === 'zh' ? part.nameZh || part.name : part.name}</span>`;
      return item;
    }));
    const note = this.lang === 'zh' ? this.puzzle.educationalNoteZh : this.puzzle.educationalNote;
    $('#educationSection').hidden = !note;
    $('#educationNote').textContent = note || '';
  }

  renderTimeline() {
    if (!this.puzzle.hasTime) return;
    $('#timelineSlider').value = String(this.currentFrame);
    $('#frameLabel').textContent = `${this.currentFrame + 1} / ${this.puzzle.frameCount}`;
    $('#previousFrameButton').disabled = this.currentFrame === 0;
    $('#nextFrameButton').disabled = this.currentFrame === this.puzzle.frameCount - 1;
  }

  syncSliceUi(slice) {
    if (!slice) return;
    const select = $('#sliceFamilySelect');
    const current = select.value;
    select.replaceChildren(...slice.families.map((family) => new Option(family.label, family.id)));
    select.value = slice.family?.id || current;
    $('#sliceSlider').max = String(Math.max(0, slice.levels.length - 1));
    $('#sliceSlider').value = String(slice.index);
    $('#sliceLabel').textContent = `${slice.index + 1} / ${Math.max(1, slice.levels.length)}`;
    $('#slicePreviousButton').disabled = slice.index <= 0;
    $('#sliceNextButton').disabled = slice.index >= slice.levels.length - 1;
  }

  clueText(clues) {
    if (!clues.length) return this.t('noRuns');
    return clues.map((run) => {
      const palette = this.puzzle.palette.find((entry) => entry.id === run.colorId);
      return `${palette?.key?.[0]?.toUpperCase() || run.colorId}${run.length}`;
    }).join(' · ');
  }

  describeCell(cellIndex) {
    const cell = this.puzzle.lattice.cells[cellIndex];
    if (cell.coord.x != null) return `(${cell.coord.x}, ${cell.coord.y}${cell.coord.z != null ? `, ${cell.coord.z}` : ''})`;
    if (cell.coord.q != null) return `(q${cell.coord.q}, r${cell.coord.r}, s${cell.coord.s})`;
    if (cell.coord.orientation) return `(${cell.coord.i}, ${cell.coord.j}, ${cell.coord.orientation === 'up' ? '△' : '▽'})`;
    return `(${Object.values(cell.coord).join(', ')})`;
  }

  describeValue(value) {
    if (value === UNKNOWN) return this.t('unknown');
    if (value === EMPTY) return this.t('empty');
    return this.puzzle.palette.find((entry) => entry.id === value)?.name || String(value);
  }

  colorForValue(value) { return this.puzzle.palette.find((entry) => entry.id === value)?.color || '#ffffff'; }

  async giveHint() {
    this.stopPlayback();
    const result = await this.askSolver('hint');
    if (!result.ok) { this.toast(this.t('contradiction'), 'error'); return; }
    if (!result.moves.length) { this.toast(this.t('noHint')); return; }
    const preferredVariables = new Set(this.selectedTrack?.variables || []);
    const move = result.moves.find((entry) => preferredVariables.has(entry.variableId))
      || result.moves.find((entry) => decodeVariableId(this.puzzle, entry.variableId).frame === this.currentFrame)
      || result.moves[0];
    this.applyVariable(move.variableId, move.value);
    this.toast(this.t('hintApplied'), 'success');
  }

  async checkPuzzle() {
    const result = await this.askSolver('hint');
    if (!result.ok) { this.toast(this.t('contradiction'), 'error'); return; }
    let wrong = 0;
    this.state.forEach((value, index) => { if (value !== UNKNOWN && value !== this.puzzle.solution[index]) wrong += 1; });
    this.toast(wrong ? this.t('checkWrong', wrong) : this.t('checkPerfect'), wrong ? 'error' : 'success');
  }

  async askSolver(type) {
    if (!this.worker) {
      try {
        this.worker = new Worker('./solver.worker.js', { type: 'module' });
        this.worker.addEventListener('message', (event) => {
          const request = this.workerRequests.get(event.data.id); if (!request) return;
          this.workerRequests.delete(event.data.id);
          if (event.data.ok) request.resolve(event.data.result); else request.reject(new Error(event.data.error));
        });
        this.worker.addEventListener('error', () => { this.worker?.terminate(); this.worker = null; });
      } catch { this.worker = null; }
    }
    if (!this.worker) return forcedMoves(solverPayload(this.puzzle), this.state);
    const id = this.nextWorkerRequest++;
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.workerRequests.delete(id); resolve(forcedMoves(solverPayload(this.puzzle), this.state));
      }, 2500);
      this.workerRequests.set(id, {
        resolve: (result) => { clearTimeout(timeout); resolve(result); },
        reject: () => { clearTimeout(timeout); resolve(forcedMoves(solverPayload(this.puzzle), this.state)); },
      });
      this.worker.postMessage({ id, type, payload: solverPayload(this.puzzle), state: this.state });
    });
  }

  resetPuzzle() {
    if (!confirm(this.t('resetConfirm'))) return;
    clearProgress(this.puzzle); this.state = createInitialState(this.puzzle); this.history = []; this.redoStack = [];
    this.currentFrame = 0; this.selectedCellIndex = Math.floor(this.puzzle.lattice.cells.length / 2); this.selectBestTrack(); this.updateAll();
  }

  showCompletion() {
    this.stopPlayback();
    $('#completionText').textContent = this.t('completeText', this.lang === 'zh' ? this.puzzle.titleZh : this.puzzle.title);
    $('#completionParts').replaceChildren(...this.puzzle.semanticParts.map((part) => {
      const item = document.createElement('span'); item.className = 'semantic-item';
      item.innerHTML = `<span class="semantic-swatch" style="background:${this.colorForValue(part.colorId)}"></span><span>${this.lang === 'zh' ? part.nameZh || part.name : part.name}</span>`;
      return item;
    }));
    $('#completionDialog').showModal();
  }

  loadNextPuzzle() {
    const matching = this.catalog.filter((puzzle) => puzzle.dimension === this.puzzle.dimension && puzzle.hasTime === this.puzzle.hasTime);
    const index = matching.findIndex((puzzle) => puzzle.id === this.puzzle.id);
    const next = matching[(index + 1) % matching.length];
    this.setMode(this.modeForPuzzle(next), next.lattice.kind, next.id);
  }

  togglePlayback() { this.playTimer ? this.stopPlayback() : this.startPlayback(true); }

  startPlayback(loop = true) {
    if (!this.puzzle.hasTime) return;
    this.stopPlayback(); $('#playButton').textContent = '❚❚'; $('#playButton').setAttribute('aria-label', 'Pause animation');
    this.playTimer = setInterval(() => {
      if (this.currentFrame >= this.puzzle.frameCount - 1) {
        if (!loop) { this.stopPlayback(); return; }
        this.currentFrame = 0;
      } else this.currentFrame += 1;
      this.selectBestTrack(); this.updateAll();
    }, 720);
  }

  stopPlayback() {
    if (this.playTimer) clearInterval(this.playTimer);
    this.playTimer = null;
    if ($('#playButton')) { $('#playButton').textContent = '▶'; $('#playButton').setAttribute('aria-label', 'Play animation'); }
  }

  scheduleSave() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => saveProgress(this.puzzle, { state: this.state, frame: this.currentFrame }), 180);
  }

  updateUrl() {
    const url = new URL(location.href);
    url.searchParams.set('dimension', String(this.puzzle.dimension));
    url.searchParams.set('time', this.puzzle.hasTime ? '1' : '0');
    url.searchParams.set('lattice', this.puzzle.lattice.kind);
    url.searchParams.set('puzzle', this.puzzle.id);
    history.replaceState(null, '', url);
  }

  handleKeyboard(event) {
    if (event.target.matches('input, select, textarea') || document.querySelector('dialog[open]')) return;
    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && key === 'z') { event.preventDefault(); event.shiftKey ? this.redo() : this.undo(); return; }
    if ((event.ctrlKey || event.metaKey) && key === 'y') { event.preventDefault(); this.redo(); return; }
    if (/^[1-5]$/.test(key)) {
      const entry = this.puzzle.palette[Number(key) - 1]; if (entry) { this.selectedColor = entry.id; this.setTool('paint'); this.renderPalette(); }
    } else if (key === 'x') this.setTool('empty');
    else if (key === 'e') this.setTool('clear');
    else if (key === 'i') this.setTool('inspect');
    else if (key === 'o') this.setTool('orbit');
    else if (key === '[') this.setFrame(this.currentFrame - 1);
    else if (key === ']') this.setFrame(this.currentFrame + 1);
    else if (key === 'arrowup') { event.preventDefault(); this.stepTrack(-1); }
    else if (key === 'arrowdown') { event.preventDefault(); this.stepTrack(1); }
  }

  toast(message, type = '') {
    const toast = $('#toast'); toast.textContent = message; toast.className = `toast show ${type}`;
    clearTimeout(this.toastTimer); this.toastTimer = setTimeout(() => { toast.className = 'toast'; }, 2800);
    this.announce(message);
  }

  announce(message) { $('#liveStatus').textContent = ''; requestAnimationFrame(() => { $('#liveStatus').textContent = message; }); }

  registerServiceWorker() {
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  }
}

new TopoMosaicApp();
