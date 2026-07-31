import { EMPTY, UNKNOWN } from './core/clues.js';
import {
  createBlackWhitePuzzle,
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

const GAMEPLAY_MODE_STORAGE_KEY = 'topomosaic:gameplayMode';

const I18N = {
  en: {
    pageTitle: 'TopoMosaic — Topological Mosaic Logic',
    pageDescription: 'TopoMosaic: fill binary or color mosaics across tilings, lattices, and time paths.',
    skipToPuzzle: 'Skip to mosaic', backToTopoboard: 'Back to Topoboard', openHelp: 'Open rules',
    reportContact: 'Report a mosaic issue', reportLabel: 'Report',
    switchToChinese: 'Switch language to Traditional Chinese', switchToEnglish: 'Switch language to English',
    languageCodeToChinese: '中文', languageCodeToEnglish: 'EN', languageChanged: 'Language switched to English.',
    puzzleConfiguration: 'Mosaic setup', dimensionTimeMode: 'Topology mode', puzzleTools: 'Mosaic mark tools',
    colorPalette: 'Tile palette', zoomOut: 'Zoom out', zoomIn: 'Zoom in', puzzleProgress: 'Mosaic progress',
    viewMode: 'Mosaic view', board2dAria: 'Interactive topological mosaic', board3dAria: 'Interactive 3D lattice mosaic',
    sliceControls: 'Layer controls', previousSlice: 'Previous layer', nextSlice: 'Next layer', sliceLayer: 'Layer',
    timeNavigation: 'Time path', previousFrame: 'Previous frame', nextFrame: 'Next frame',
    currentTimeFrame: 'Current time frame', playAnimation: 'Play time', pauseAnimation: 'Pause time',
    cluesCellInfo: 'Path clues and tile focus', clueDimension: 'Clue axis', previousClueLine: 'Previous path',
    nextClueLine: 'Next path', orderedColoredClues: 'Ordered path runs', selectedTrackCells: 'Tiles on selected path',
    mobilePuzzleTools: 'Mobile mosaic controls', closeHelp: 'Close rules',
    tagline: 'Mosaics through paths, lattices, and time', lattice: 'Topology', puzzle: 'Mosaic',
    gameKind: 'Rule style', colorPicture: 'Color mosaic', blackWhitePicture: 'Binary mosaic',
    tools: 'Marks', paint: 'Fill', empty: 'Blank', clear: 'Clear', inspect: 'Probe', move: 'Navigate / Orbit', moveShort: 'Move', palette: 'Tiles', actions: 'Solve',
    undo: 'Undo', redo: 'Redo', hint: 'Hint', check: 'Verify', reset: 'Reset', view: 'View', fit: 'Fit',
    onionSkin: 'Time ghost', strictMode: 'Mistake guard', board: 'Mosaic', model: 'Lattice',
    slice: 'Layer', track: 'Path', plane: 'Layer axis', spatialClue: 'Space path', timeClue: 'Time path',
    direction: 'Path family', orderedTrack: 'Path strip', trackInstruction: 'Mark this path directly when the mosaic or lattice is hard to reach.',
    selectedCell: 'Tile focus', state: 'Mark', memberships: 'Crossing paths', temporalRun: 'Time run',
    semanticPart: 'Revealed part', modelParts: 'Mosaic parts', whyThisLattice: 'Topology note', clues: 'Paths',
    howToPlay: 'Mosaic rules', sharedRule: 'Runs follow paths',
    pictureTypes: 'Binary and color rules',
    pictureTypesText: 'Binary mosaic uses one fill mark and standard number runs. Color mosaic keeps separate colored runs, so color changes can touch.',
    sharedRuleText: 'Each path clue is an ordered sequence of filled runs. [Yellow 2] [Blue 3] means two yellow tiles followed later, or immediately because the colors differ, by three blue tiles. Matching colors need a blank tile between runs.',
    timeRule: 'Time is another path', timeRuleText: 'In time modes, each frame has space-path clues. Selecting a tile also shows its run through time, so the image evolves as part of the logic.',
    threeDViews: 'Three ways through a lattice', threeDViewsText: 'Lattice gives the full object, Layer exposes a cross-section, and Path isolates one clue line. Use Fill, Blank, or Clear to mark tiles; use Navigate when you want camera control.',
    shortcuts: 'Keyboard', chooseColor: 'Choose tile color', markEmpty: 'Mark blank', clearCell: 'Clear mark',
    orbitCamera: 'Navigate / orbit', undoRedo: 'Undo / redo', changeFrame: 'Step time', startPlaying: 'Enter mosaic',
    completed: 'Mosaic complete', replayAnimation: 'Replay time', nextPuzzle: 'Next mosaic', close: 'Close',
    unknown: 'Unmarked', noPart: 'None', hidden: 'Unrevealed', solved: 'Path resolved', incomplete: 'Path open',
    noRuns: 'No color runs', noFilledCells: 'No filled tiles', given: 'Seed tile', frame: 'Frame', temporal: 'Time', loading3d: 'Loading lattice view…',
    rendererFallback: 'The 3D library could not load. The Path panel remains fully playable; serve online or install dependencies to restore the lattice view.',
    hintApplied: 'One forced tile was filled.', hintAppliedDetailed: (cell, value) => `Hint marked ${cell} as ${value}.`, noHint: 'No forced tile is available from the current state.',
    contradiction: 'The current marks contradict a path clue. Undo or clear a recent mark.',
    checkPerfect: 'All marked tiles match the solution. Keep resolving the remaining unmarked tiles.',
    checkWrong: (count) => `${count} marked tile${count === 1 ? '' : 's'} currently disagree with the solution.`,
    strictRejected: 'That mark does not fit this mosaic in mistake-guard mode.', resetConfirm: 'Reset this mosaic and erase its saved progress?',
    resetDone: 'Mosaic reset. Fill, Blank, and Clear are ready.',
    completeText: (title) => `${title} is complete. Explore the finished mosaic, its parts, or replay its time evolution.`,
    difficultyStarter: 'Starter', difficultyEasy: 'Easy', difficultyMedium: 'Medium', difficultyAdvanced: 'Advanced',
    clueChipTitle: (color, length) => `${color}, run length ${length}`,
    trackCellLabel: (cell, frame, value, given) => `${cell}, Frame ${frame}, ${value}${given ? ', Given' : ''}`,
    mode2: '2D Tiles', mode2t: '2D Time', mode3: '3D Lattice', mode3t: '3D Time',
  },
  zh: {
    pageTitle: 'TopoMosaic — 拓撲馬賽克邏輯',
    pageDescription: 'TopoMosaic：在鋪砌、晶格與時間路徑中填出黑白或彩色馬賽克。',
    skipToPuzzle: '跳到馬賽克', backToTopoboard: '返回 Topoboard', openHelp: '開啟規則',
    reportContact: '回報馬賽克問題', reportLabel: '回報',
    switchToChinese: '切換語言為繁體中文', switchToEnglish: '切換語言為 English',
    languageCodeToChinese: '中文', languageCodeToEnglish: 'EN', languageChanged: '語言已切換為繁體中文。',
    puzzleConfiguration: '馬賽克設定', dimensionTimeMode: '拓撲模式', puzzleTools: '馬賽克標記工具',
    colorPalette: '圖塊色盤', zoomOut: '縮小', zoomIn: '放大', puzzleProgress: '馬賽克進度',
    viewMode: '馬賽克視圖', board2dAria: '互動式拓撲馬賽克', board3dAria: '互動式 3D 晶格馬賽克',
    sliceControls: '分層控制', previousSlice: '上一層', nextSlice: '下一層', sliceLayer: '分層',
    timeNavigation: '時間路徑', previousFrame: '上一幀', nextFrame: '下一幀',
    currentTimeFrame: '目前時間幀', playAnimation: '播放時間', pauseAnimation: '暫停時間',
    cluesCellInfo: '路徑線索與圖塊焦點', clueDimension: '線索軸', previousClueLine: '上一條路徑',
    nextClueLine: '下一條路徑', orderedColoredClues: '有序路徑連段', selectedTrackCells: '所選路徑上的圖塊',
    mobilePuzzleTools: '手機馬賽克控制', closeHelp: '關閉規則',
    tagline: '沿路徑、晶格與時間生成馬賽克', lattice: '拓撲', puzzle: '馬賽克',
    gameKind: '規則樣式', colorPicture: '彩色馬賽克', blackWhitePicture: '黑白馬賽克',
    tools: '標記', paint: '填格', empty: '留白', clear: '清除', inspect: '探查', move: '導覽／旋轉', moveShort: '導覽', palette: '圖塊', actions: '解題',
    undo: '復原', redo: '重做', hint: '提示', check: '驗證', reset: '重設', view: '視圖', fit: '置中',
    onionSkin: '時間殘影', strictMode: '錯誤防護', board: '馬賽克', model: '晶格', slice: '分層', track: '路徑',
    plane: '分層軸', spatialClue: '空間路徑', timeClue: '時間路徑', direction: '路徑族', orderedTrack: '路徑帶',
    trackInstruction: '當馬賽克或晶格不易點選時，可直接在這條路徑上標記。', selectedCell: '圖塊焦點', state: '標記',
    memberships: '交會路徑', temporalRun: '時間連段', semanticPart: '揭示部件', modelParts: '馬賽克部件',
    whyThisLattice: '拓撲註記', clues: '路徑', howToPlay: '馬賽克規則', sharedRule: '連段沿路徑排列',
    pictureTypes: '黑白與彩色規則',
    pictureTypesText: '黑白馬賽克使用單一填格標記與標準數字連段。彩色馬賽克保留不同顏色的連段，因此不同顏色可以相接。',
    sharedRuleText: '每條路徑線索都是依序排列的填格連段。[黃 2] [藍 3] 表示兩格黃色之後，接著或稍後出現三格藍色；因顏色不同可以直接相接。相同顏色的兩段之間需要一格留白。',
    timeRule: '時間也是一條路徑', timeRuleText: '在時間模式中，每一幀都有空間路徑線索。選取圖塊時，也會看到它穿過時間的連段，圖像會成為推理的一部分。',
    threeDViews: '穿越晶格的三種視角', threeDViewsText: '晶格顯示完整物件，分層打開剖面，路徑隔離單一線索線。使用填格、留白或清除標記圖塊；需要控制鏡頭時使用導覽。',
    shortcuts: '鍵盤', chooseColor: '選擇圖塊顏色', markEmpty: '標記留白', clearCell: '清除標記', orbitCamera: '導覽／旋轉',
    undoRedo: '復原／重做', changeFrame: '切換時間', startPlaying: '進入馬賽克', completed: '馬賽克完成',
    replayAnimation: '重播時間', nextPuzzle: '下一幅馬賽克', close: '關閉', unknown: '未標記', noPart: '無', hidden: '尚未揭示',
    solved: '路徑已解', incomplete: '路徑未定', noRuns: '沒有彩色連段', given: '種子圖塊', frame: '幀', temporal: '時間',
    noFilledCells: '沒有填格',
    loading3d: '正在載入晶格視圖…', rendererFallback: '3D 函式庫載入失敗；路徑面板仍可完整解題。以網路伺服器開啟或安裝相依套件後即可恢復晶格視圖。',
    hintApplied: '已填入一個必然圖塊。', hintAppliedDetailed: (cell, value) => `提示已將 ${cell} 標為${value}。`, noHint: '目前狀態沒有可直接推出的圖塊。',
    contradiction: '目前標記與某條路徑線索矛盾，請復原或清除最近的標記。', checkPerfect: '所有已標記圖塊都正確，請繼續解開其餘未標記圖塊。',
    checkWrong: (count) => `目前有 ${count} 個已標記圖塊與答案不一致。`, strictRejected: '錯誤防護模式下不能填入不符合此馬賽克的標記。',
    resetConfirm: '確定重設此馬賽克並刪除已儲存進度？', resetDone: '馬賽克已重設。填格、留白與清除已可使用。',
    completeText: (title) => `「${title}」已完成。可探索完成馬賽克、部件或重播時間演化。`,
    difficultyStarter: '入門', difficultyEasy: '初級', difficultyMedium: '中級', difficultyAdvanced: '進階',
    clueChipTitle: (color, length) => `${color}，連續長度 ${length}`,
    trackCellLabel: (cell, frame, value, given) => `${cell}，第 ${frame} 幀，${value}${given ? '，已知格' : ''}`,
    mode2: '2D 圖塊', mode2t: '2D 時間', mode3: '3D 晶格', mode3t: '3D 時間',
  },
};

const LATTICE_NAMES = {
  en: { square: 'Square tiling', hex: 'Hex tiling', triangle: 'Triangle tiling', sc: 'Cubic lattice', fcc: 'FCC lattice', bcc: 'BCC lattice', hcp: 'HCP lattice' },
  zh: { square: '方格鋪砌', hex: '六角鋪砌', triangle: '三角鋪砌', sc: '立方晶格', fcc: 'FCC 晶格', bcc: 'BCC 晶格', hcp: 'HCP 晶格' },
};

const PALETTE_LABELS = {
  en: {
    yellow: { name: 'Sun yellow', symbol: 'Y' },
    blue: { name: 'Sky blue', symbol: 'B' },
    green: { name: 'Leaf green', symbol: 'G' },
    red: { name: 'Warm red', symbol: 'R' },
    brown: { name: 'Earth brown', symbol: 'E' },
    black: { name: 'Black', symbol: 'B' },
  },
  zh: {
    yellow: { name: '向日黃', symbol: '黃' },
    blue: { name: '天空藍', symbol: '藍' },
    green: { name: '葉綠', symbol: '綠' },
    red: { name: '暖紅', symbol: '紅' },
    brown: { name: '土棕', symbol: '棕' },
    black: { name: '黑色', symbol: '黑' },
  },
};

const DIFFICULTY_KEYS = {
  Starter: 'difficultyStarter',
  Easy: 'difficultyEasy',
  Medium: 'difficultyMedium',
  Advanced: 'difficultyAdvanced',
};

const TRACK_FAMILY_LABELS = {
  en: {
    row: 'Row paths', column: 'Column paths',
    'hex-q': 'Q-axis paths', 'hex-r': 'R-axis paths', 'hex-s': 'S-axis paths',
    'tri-a': 'A weave', 'tri-b': 'B weave', 'tri-c': 'C weave',
    'sc-x': 'X paths', 'sc-y': 'Y paths', 'sc-z': 'Z paths',
    'fcc-110': '[110] paths', 'fcc-1m10': '[1-10] paths', 'fcc-101': '[101] paths', 'fcc-10m1': '[10-1] paths', 'fcc-011': '[011] paths', 'fcc-01m1': '[01-1] paths',
    'bcc-111': '[111] paths', 'bcc-11m1': '[11-1] paths', 'bcc-1m11': '[1-11] paths', 'bcc-m111': '[-111] paths',
    'bcc-100': '[100] guide paths', 'bcc-010': '[010] guide paths', 'bcc-001': '[001] guide paths',
    'hcp-a1': 'Basal a₁ paths', 'hcp-a2': 'Basal a₂ paths', 'hcp-a3': 'Basal a₃ paths', 'hcp-c': 'Axial c paths',
  },
  zh: {
    row: '橫列路徑', column: '直行路徑',
    'hex-q': 'Q 軸路徑', 'hex-r': 'R 軸路徑', 'hex-s': 'S 軸路徑',
    'tri-a': 'A 編織路徑', 'tri-b': 'B 編織路徑', 'tri-c': 'C 編織路徑',
    'sc-x': 'X 路徑', 'sc-y': 'Y 路徑', 'sc-z': 'Z 路徑',
    'fcc-110': '[110] 路徑', 'fcc-1m10': '[1-10] 路徑', 'fcc-101': '[101] 路徑', 'fcc-10m1': '[10-1] 路徑', 'fcc-011': '[011] 路徑', 'fcc-01m1': '[01-1] 路徑',
    'bcc-111': '[111] 路徑', 'bcc-11m1': '[11-1] 路徑', 'bcc-1m11': '[1-11] 路徑', 'bcc-m111': '[-111] 路徑',
    'bcc-100': '[100] 輔助路徑', 'bcc-010': '[010] 輔助路徑', 'bcc-001': '[001] 輔助路徑',
    'hcp-a1': '基面 a₁ 路徑', 'hcp-a2': '基面 a₂ 路徑', 'hcp-a3': '基面 a₃ 路徑', 'hcp-c': 'c 軸路徑',
  },
};

const SLICE_FAMILY_LABELS = {
  en: {
    'slice-x': 'X layers', 'slice-y': 'Y layers', 'slice-z': 'Z layers',
    'fcc-100': '{100} X layers', 'fcc-010': '{100} Y layers', 'fcc-001': '{100} Z layers', 'fcc-111': '{111} close-packed layers',
    'bcc-100-plane': '{100} X layers', 'bcc-010-plane': '{100} Y layers', 'bcc-001-plane': '{100} Z layers', 'bcc-111-plane': '{111} diagonal layers',
    'hcp-basal': 'Basal (0001) layers', 'hcp-prism-a1': 'Prismatic A layers', 'hcp-prism-a2': 'Prismatic B layers',
  },
  zh: {
    'slice-x': 'X 層', 'slice-y': 'Y 層', 'slice-z': 'Z 層',
    'fcc-100': '{100} X 層', 'fcc-010': '{100} Y 層', 'fcc-001': '{100} Z 層', 'fcc-111': '{111} 密排層',
    'bcc-100-plane': '{100} X 層', 'bcc-010-plane': '{100} Y 層', 'bcc-001-plane': '{100} Z 層', 'bcc-111-plane': '{111} 對角層',
    'hcp-basal': '基面 (0001) 層', 'hcp-prism-a1': '柱面 A 層', 'hcp-prism-a2': '柱面 B 層',
  },
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
    const requestedGameplayMode = new URLSearchParams(location.search).get('rules');
    const storedGameplayMode = localStorage.getItem(GAMEPLAY_MODE_STORAGE_KEY)
      || (localStorage.getItem('topomosaic:displayMode') === 'mono' ? 'bw' : null);
    this.gameplayMode = (requestedGameplayMode || storedGameplayMode) === 'bw' ? 'bw' : 'color';
    this.sourcePuzzle = null;
    this.selectedCellIndex = null;
    this.selectedTrack = null;
    this.hintedVariableId = null;
    this.activeFamily = null;
    this.history = [];
    this.redoStack = [];
    this.strictMode = false;
    this.onionSkin = true;
    this.playTimer = null;
    this.saveTimer = null;
    this.toastTimer = null;
    this.hintTimer = null;
    this.rendererNoticeMode = null;
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

  fromLocalizedMap(map, key, fallback = '') {
    return map[this.lang]?.[key] ?? map.en?.[key] ?? fallback;
  }

  puzzleTitle(puzzle = this.puzzle) {
    if (!puzzle) return '';
    return this.lang === 'zh' ? puzzle.titleZh || puzzle.title : puzzle.title;
  }

  puzzleDescription(puzzle = this.puzzle) {
    if (!puzzle) return '';
    return this.lang === 'zh' ? puzzle.descriptionZh || puzzle.description : puzzle.description;
  }

  latticeName(kind) {
    return this.fromLocalizedMap(LATTICE_NAMES, kind, kind);
  }

  difficultyLabel(difficulty) {
    return this.t(DIFFICULTY_KEYS[difficulty] || difficulty);
  }

  trackFamilyLabel(trackOrFamily, fallback = '') {
    const family = typeof trackOrFamily === 'string' ? trackOrFamily : trackOrFamily?.family;
    const source = typeof trackOrFamily === 'string' ? fallback : trackOrFamily?.familyLabel;
    return this.fromLocalizedMap(TRACK_FAMILY_LABELS, family, source || family || '');
  }

  sliceFamilyLabel(family) {
    return this.fromLocalizedMap(SLICE_FAMILY_LABELS, family?.id, family?.label || '');
  }

  paletteInfo(entry) {
    return this.fromLocalizedMap(PALETTE_LABELS, entry?.key, null) || {
      name: entry?.name || String(entry?.id ?? ''),
      symbol: entry?.key?.[0]?.toUpperCase() || String(entry?.id ?? ''),
    };
  }

  paletteName(entry) {
    return this.paletteInfo(entry).name;
  }

  paletteSymbol(entry) {
    return this.paletteInfo(entry).symbol;
  }

  partName(part) {
    if (!part) return '';
    return this.lang === 'zh' ? part.nameZh || part.name : part.name;
  }

  bindEvents() {
    $('#languageButton').addEventListener('click', () => {
      this.lang = this.lang === 'en' ? 'zh' : 'en';
      localStorage.setItem('topomosaic:lang', this.lang);
      localStorage.setItem('topological-boardgame:language', this.lang);
      this.applyLanguage();
      this.refreshDynamicText();
      if (this.puzzle) this.updateUrl();
      this.announce(this.t('languageChanged'));
    });
    $('#helpButton').addEventListener('click', () => $('#helpDialog').showModal());
    $$('#modeSwitch [data-mode]').forEach((button) => button.addEventListener('click', () => this.setMode(button.dataset.mode)));
    $('#latticeSelect').addEventListener('change', () => this.populatePuzzleSelect());
    $('#puzzleSelect').addEventListener('change', () => this.loadPuzzle(findPuzzle($('#puzzleSelect').value)));
    $('#gameplayModeSelect').addEventListener('change', (event) => this.setGameplayMode(event.target.value));
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
    $('#mobileUndoButton').addEventListener('click', () => this.undo());
    $('#mobileRedoButton').addEventListener('click', () => this.redo());
    $('#mobileHintButton').addEventListener('click', () => this.giveHint());
    $('#mobileCheckButton').addEventListener('click', () => this.checkPuzzle());
    $('#mobileResetButton').addEventListener('click', () => this.resetPuzzle());
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
    $$('#modeSwitch [data-mode]').forEach((button) => {
      const active = button.dataset.mode === mode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
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
      element.textContent = this.latticeName(option.id); return element;
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
      option.textContent = this.puzzleTitle(puzzle); return option;
    }));
    select.value = puzzles.some((puzzle) => puzzle.id === previous) ? previous : puzzles[0]?.id;
    const puzzle = findPuzzle(select.value);
    if (puzzle) this.loadPuzzle(puzzle);
  }

  async loadPuzzle(sourcePuzzle) {
    if (!sourcePuzzle) return;
    this.stopPlayback();
    clearTimeout(this.saveTimer);
    this.saveTimer = null;
    this.sourcePuzzle = sourcePuzzle.sourceId ? findPuzzle(sourcePuzzle.sourceId) || sourcePuzzle : sourcePuzzle;
    const puzzle = this.gameplayMode === 'bw' ? createBlackWhitePuzzle(this.sourcePuzzle) : this.sourcePuzzle;
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
    this.clearHint({ redraw: false });
    this.history = [];
    this.redoStack = [];
    this.selectedCellIndex = Math.floor(puzzle.lattice.cells.length / 2);
    this.activeFamily = puzzle.lattice.tracks[0]?.family || null;
    this.selectBestTrack();
    $('#puzzleSelect').value = this.sourcePuzzle.id;
    $('#difficultyBadge').textContent = this.difficultyLabel(puzzle.difficulty);
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
    this.rendererNoticeMode = 'loading3d';
    $('#rendererNotice').textContent = this.t(this.rendererNoticeMode);
    try {
      if (!this.board3d) {
        const { Board3D } = await import('./render/board3d.js');
        this.board3d = new Board3D($('#board3d'), {
          ariaLabel: this.t('board3dAria'),
          onCellPointer: (cell, detail) => this.handleCellPointer(cell, detail),
          onSliceChange: (slice) => this.syncSliceUi(slice),
        });
        this.board3d.renderer.domElement.setAttribute('aria-label', this.t('board3dAria'));
      }
      this.board3d.setPuzzle(this.puzzle, this.state);
      this.board3d.setTool(this.tool);
      this.board3d.setViewMode(this.viewMode);
      this.syncSliceUi(this.board3d.getSliceState());
      $('#rendererNotice').hidden = true;
      this.rendererNoticeMode = null;
    } catch (error) {
      console.error(error);
      $('#rendererNotice').hidden = false;
      this.rendererNoticeMode = 'rendererFallback';
      $('#rendererNotice').textContent = this.t(this.rendererNoticeMode);
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
    $('#puzzleTitle').textContent = this.puzzleTitle();
    $('#puzzleDescription').textContent = this.puzzleDescription();
    $('#difficultyBadge').textContent = this.difficultyLabel(this.puzzle.difficulty);
    const modeKey = this.puzzle.dimension === 2 ? (this.puzzle.hasTime ? 'mode2t' : 'mode2') : (this.puzzle.hasTime ? 'mode3t' : 'mode3');
    $('#modeEyebrow').textContent = `${this.t(modeKey)} · ${this.latticeName(this.puzzle.lattice.kind)}`;
    [...$('#puzzleSelect').options].forEach((option) => {
      const puzzle = findPuzzle(option.value); if (puzzle) option.textContent = this.puzzleTitle(puzzle);
    });
    [...$('#latticeSelect').options].forEach((option) => { option.textContent = this.latticeName(option.value); });
    if (this.rendererNoticeMode) $('#rendererNotice').textContent = this.t(this.rendererNoticeMode);
    this.renderPalette();
    this.renderTrackNavigation();
    this.renderSemanticLegend();
    this.renderClues();
    this.renderTrackStrip();
    this.renderCellCard();
    this.renderTimeline();
    this.updateRenderer();
  }

  applyLanguage() {
    document.documentElement.lang = this.lang === 'zh' ? 'zh-Hant' : 'en';
    document.title = this.t('pageTitle');
    document.querySelector('meta[name="description"]')?.setAttribute('content', this.t('pageDescription'));
    const targetLanguageKey = this.lang === 'en' ? 'switchToChinese' : 'switchToEnglish';
    const languageButton = $('#languageButton');
    languageButton.setAttribute('aria-label', this.t(targetLanguageKey));
    languageButton.title = this.t(targetLanguageKey);
    $('#languageCode').textContent = this.lang === 'en' ? this.t('languageCodeToChinese') : this.t('languageCodeToEnglish');
    const modeLabels = { '2-static': this.t('mode2'), '2-time': this.t('mode2t'), '3-static': this.t('mode3'), '3-time': this.t('mode3t') };
    $$('#modeSwitch [data-mode]').forEach((button) => { button.textContent = modeLabels[button.dataset.mode]; });
    $$('[data-i18n]').forEach((element) => {
      const value = I18N[this.lang][element.dataset.i18n];
      if (typeof value === 'string') element.textContent = value;
    });
    $$('[data-i18n-aria]').forEach((element) => { element.setAttribute('aria-label', this.t(element.dataset.i18nAria)); });
    $$('[data-i18n-title]').forEach((element) => { element.title = this.t(element.dataset.i18nTitle); });
    this.board3d?.renderer?.domElement?.setAttribute('aria-label', this.t('board3dAria'));
    this.syncGameplayModeUi();
    this.renderPlaybackButton();
  }

  syncGameplayModeUi() {
    $('#gameplayModeSelect').value = this.gameplayMode;
    document.body.classList.toggle('game-bw', this.gameplayMode === 'bw');
  }

  setGameplayMode(mode) {
    this.flushSave();
    this.gameplayMode = mode === 'bw' ? 'bw' : 'color';
    localStorage.setItem(GAMEPLAY_MODE_STORAGE_KEY, this.gameplayMode);
    this.syncGameplayModeUi();
    if (this.sourcePuzzle) this.loadPuzzle(this.sourcePuzzle);
  }

  clearHint({ redraw = true } = {}) {
    clearTimeout(this.hintTimer);
    this.hintTimer = null;
    this.hintedVariableId = null;
    if (redraw && this.puzzle) this.updateAll();
  }

  showHint(variableId) {
    clearTimeout(this.hintTimer);
    this.hintedVariableId = variableId;
    this.updateAll();
    this.hintTimer = setTimeout(() => {
      this.hintedVariableId = null;
      this.hintTimer = null;
      this.updateAll();
    }, 6500);
  }

  setTool(tool) {
    this.stopPlayback();
    this.tool = tool;
    $$('#toolGrid [data-tool]').forEach((button) => {
      const active = button.dataset.tool === tool;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    $$('[data-mobile-tool]').forEach((button) => {
      const active = button.dataset.mobileTool === tool;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    this.updateRenderer();
  }

  renderPalette() {
    const renderInto = (container) => {
      if (!container) return;
      container.setAttribute('aria-label', this.t('colorPalette'));
      container.replaceChildren(...this.puzzle.palette.map((entry, index) => {
        const button = document.createElement('button');
        button.type = 'button'; button.className = `palette-button${entry.id === this.selectedColor ? ' active' : ''}`;
        button.setAttribute('role', 'radio'); button.setAttribute('aria-checked', String(entry.id === this.selectedColor));
        button.title = this.paletteName(entry);
        button.setAttribute('aria-label', this.paletteName(entry));
        button.dataset.colorId = String(entry.id);
        button.dataset.tone = entry.key === 'black' || entry.id >= 4 ? 'dark' : 'light';
        button.innerHTML = `<span class="swatch" style="background:${this.colorForValue(entry.id)}"><span>${this.paletteSymbol(entry)}</span></span><span class="key">${index + 1}</span>`;
        button.addEventListener('click', () => {
          this.selectedColor = entry.id; this.setTool('paint'); this.renderPalette();
        });
        return button;
      }));
    };
    renderInto($('#paletteButtons'));
    renderInto($('#mobilePaletteButtons'));
  }

  handleCellPointer(cellIndex, detail) {
    this.stopPlayback();
    this.selectCell(cellIndex);
    if (this.tool === 'inspect' || this.tool === 'orbit' || this.tool === 'move') return;
    let value = this.tool === 'paint' ? this.selectedColor : this.tool === 'empty' ? EMPTY : UNKNOWN;
    if (detail.button === 2) value = EMPTY;
    this.clearHint({ redraw: false });
    this.applyVariable(variableIdFor(this.puzzle, this.currentFrame, cellIndex), value);
  }

  applyVariable(variableId, value, { announce = false, keepHint = false } = {}) {
    if (this.puzzle.givens[variableId]) {
      this.toast(this.t('given')); return false;
    }
    if (this.strictMode && value !== UNKNOWN && value !== this.puzzle.solution[variableId]) {
      this.toast(this.t('strictRejected'), 'error'); return false;
    }
    const previous = this.state[variableId];
    if (previous === value) return false;
    if (!keepHint) this.clearHint({ redraw: false });
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
    this.clearHint({ redraw: false });
    this.state[change.variableId] = change.previous; this.redoStack.push(change);
    const decoded = decodeVariableId(this.puzzle, change.variableId);
    this.currentFrame = decoded.frame; this.selectedCellIndex = decoded.cellIndex; this.selectBestTrack();
    this.scheduleSave(); this.updateAll();
  }

  redo() {
    const change = this.redoStack.pop(); if (!change) return;
    this.clearHint({ redraw: false });
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
    $$('#clueModeTabs [data-clue-mode]').forEach((button) => {
      const active = button.dataset.clueMode === mode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
    });
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
    $$('#viewTabs [data-view]').forEach((button) => {
      const active = button.dataset.view === mode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
    });
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
    const undoDisabled = !this.history.length;
    const redoDisabled = !this.redoStack.length;
    $('#undoButton').disabled = undoDisabled;
    $('#redoButton').disabled = redoDisabled;
    $('#mobileUndoButton').disabled = undoDisabled;
    $('#mobileRedoButton').disabled = redoDisabled;
  }

  activeRenderer() { return this.puzzle.dimension === 2 ? this.board2d : this.board3d; }

  updateRenderer() {
    const data = {
      state: this.state, frame: this.currentFrame, selectedCellIndex: this.selectedCellIndex,
      selectedTrack: this.selectedTrack, tool: this.tool, onionSkin: this.onionSkin, viewMode: this.viewMode,
      displayMode: this.gameplayMode, hintedVariableId: this.hintedVariableId,
    };
    if (this.puzzle.dimension === 2) this.board2d.update(data);
    else this.board3d?.update(data);
    $('#viewportBadge').textContent = this.puzzle.hasTime ? `${this.t('frame')} ${this.currentFrame + 1} / ${this.puzzle.frameCount}` : this.latticeName(this.puzzle.lattice.kind);
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
      familySelect.replaceChildren(...families.map(([id, label]) => new Option(this.trackFamilyLabel(id, label), id)));
      familySelect.value = this.activeFamily;
      familySelect.disabled = false;
    }
    $('#trackFamilyLabel').textContent = this.selectedTrack ? this.trackFamilyLabel(this.selectedTrack) : '—';
    $('#trackLineLabel').textContent = this.selectedTrack?.lineLabel || '—';
  }

  renderClues() {
    const container = $('#clueChips');
    if (!this.selectedTrack?.clues.length) {
      const empty = document.createElement('span');
      empty.className = 'empty-clue';
      empty.textContent = this.t(this.gameplayMode === 'bw' ? 'noFilledCells' : 'noRuns');
      container.replaceChildren(empty);
    } else {
      container.replaceChildren(...this.selectedTrack.clues.map((run) => {
        const palette = this.puzzle.palette.find((entry) => entry.id === run.colorId);
        const chip = document.createElement('span');
        chip.className = `clue-chip${this.gameplayMode === 'bw' ? ' binary-clue' : ''}`;
        chip.style.background = this.gameplayMode === 'bw' ? '#f8fafc' : this.colorForValue(run.colorId);
        chip.title = this.t('clueChipTitle', this.paletteName(palette), run.length);
        chip.innerHTML = this.gameplayMode === 'bw'
          ? `<span>${run.length}</span>`
          : `<span class="clue-pattern" aria-hidden="true"></span><span>${this.paletteSymbol(palette)}${run.length}</span>`;
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
      const stateClass = value > EMPTY ? ' filled' : value === EMPTY ? ' empty' : ' unknown';
      button.className = `track-cell${stateClass}${cellIndex === this.selectedCellIndex && frame === this.currentFrame ? ' selected' : ''}${this.puzzle.givens[variableId] ? ' given' : ''}${variableId === this.hintedVariableId ? ' hinted' : ''}`;
      button.style.background = value > EMPTY
        ? this.colorForValue(value)
        : value === EMPTY
          ? (this.gameplayMode === 'bw' ? '#f8fafc' : '#17202c')
          : (this.gameplayMode === 'bw' ? '#d8e0eb' : '#39465a');
      button.textContent = value === EMPTY ? '×' : value === UNKNOWN ? '?' : '';
      button.innerHTML += `<span class="cell-index">${this.selectedTrack.type === 'time' ? `t${frame + 1}` : offset + 1}</span>`;
      button.setAttribute('role', 'listitem');
      button.setAttribute('aria-label', this.t(
        'trackCellLabel',
        this.describeCell(cellIndex),
        frame + 1,
        this.describeValue(value),
        this.puzzle.givens[variableId],
      ));
      button.addEventListener('click', () => {
        this.currentFrame = frame; this.selectedCellIndex = cellIndex; this.selectBestTrack();
        if (!['inspect', 'orbit', 'move'].includes(this.tool)) {
          const next = this.tool === 'paint' ? this.selectedColor : this.tool === 'empty' ? EMPTY : UNKNOWN;
          this.clearHint({ redraw: false });
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
    $('#cellMemberships').textContent = memberships.map((track) => `${this.trackFamilyLabel(track)} ${track.lineLabel}`).join(' · ') || '—';
    const temporal = this.puzzle.tracks.find((track) => track.type === 'time' && track.cells[0] === this.selectedCellIndex);
    $('#temporalSummary').textContent = temporal ? this.clueText(temporal.clues) : '—';
    const partId = this.puzzle.semanticPartByVariable[variableId];
    const part = this.puzzle.semanticParts.find((entry) => entry.id === partId);
    const revealed = value > EMPTY && value === this.puzzle.solution[variableId];
    $('#semanticPart').textContent = part && revealed ? this.partName(part) : part ? this.t('hidden') : this.t('noPart');
  }

  renderSemanticLegend() {
    const section = $('#semanticLegendSection');
    section.hidden = !this.puzzle.semanticParts.length;
    if (section.hidden) return;
    $('#semanticLegend').replaceChildren(...this.puzzle.semanticParts.map((part) => {
      const item = document.createElement('div'); item.className = 'semantic-item';
      item.innerHTML = `<span class="semantic-swatch" style="background:${this.colorForValue(part.colorId)}"></span><span>${this.partName(part)}</span>`;
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
    select.replaceChildren(...slice.families.map((family) => new Option(this.sliceFamilyLabel(family), family.id)));
    select.value = slice.family?.id || current;
    $('#sliceSlider').max = String(Math.max(0, slice.levels.length - 1));
    $('#sliceSlider').value = String(slice.index);
    $('#sliceLabel').textContent = `${slice.index + 1} / ${Math.max(1, slice.levels.length)}`;
    $('#slicePreviousButton').disabled = slice.index <= 0;
    $('#sliceNextButton').disabled = slice.index >= slice.levels.length - 1;
  }

  clueText(clues) {
    if (!clues.length) return this.t(this.gameplayMode === 'bw' ? 'noFilledCells' : 'noRuns');
    if (this.gameplayMode === 'bw') return clues.map((run) => String(run.length)).join(' · ');
    return clues.map((run) => {
      const palette = this.puzzle.palette.find((entry) => entry.id === run.colorId);
      return `${this.paletteSymbol(palette)}${run.length}`;
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
    const entry = this.puzzle.palette.find((item) => item.id === value);
    return entry ? this.paletteName(entry) : String(value);
  }

  colorForValue(value) {
    if (this.gameplayMode === 'bw' && value > EMPTY) return '#05070a';
    return this.puzzle.palette.find((entry) => entry.id === value)?.color || '#ffffff';
  }

  async giveHint() {
    this.stopPlayback();
    this.clearHint({ redraw: false });
    const result = await this.askSolver('hint');
    if (!result.ok) { this.toast(this.t('contradiction'), 'error'); return; }
    if (!result.moves.length) { this.toast(this.t('noHint')); return; }
    const preferredVariables = new Set(this.selectedTrack?.variables || []);
    const move = result.moves.find((entry) => preferredVariables.has(entry.variableId))
      || result.moves.find((entry) => decodeVariableId(this.puzzle, entry.variableId).frame === this.currentFrame)
      || result.moves[0];
    this.applyVariable(move.variableId, move.value, { announce: true, keepHint: true });
    this.showHint(move.variableId);
    const decoded = decodeVariableId(this.puzzle, move.variableId);
    this.toast(this.t('hintAppliedDetailed', this.describeCell(decoded.cellIndex), this.describeValue(move.value)), 'success');
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
    this.stopPlayback();
    this.clearHint({ redraw: false });
    clearProgress(this.puzzle);
    this.state = createInitialState(this.puzzle);
    this.history = [];
    this.redoStack = [];
    this.currentFrame = 0;
    this.selectedColor = this.puzzle.palette[0]?.id || 1;
    this.clueMode = 'space';
    this.viewMode = this.puzzle.dimension === 2 ? 'board' : 'model';
    this.activeFamily = this.puzzle.lattice.tracks[0]?.family || null;
    this.selectedCellIndex = Math.floor(this.puzzle.lattice.cells.length / 2);
    this.selectBestTrack();
    this.setTool('paint');
    this.setClueMode('space');
    this.setViewMode(this.viewMode);
    this.renderPalette();
    if (this.puzzle.dimension === 2) this.board2d.fitToView();
    else this.board3d?.resetCamera();
    this.updateAll();
    this.toast(this.t('resetDone'), 'success');
  }

  showCompletion() {
    this.stopPlayback();
    $('#completionText').textContent = this.t('completeText', this.puzzleTitle());
    $('#completionParts').replaceChildren(...this.puzzle.semanticParts.map((part) => {
      const item = document.createElement('span'); item.className = 'semantic-item';
      item.innerHTML = `<span class="semantic-swatch" style="background:${this.colorForValue(part.colorId)}"></span><span>${this.partName(part)}</span>`;
      return item;
    }));
    $('#completionDialog').showModal();
  }

  loadNextPuzzle() {
    const matching = this.catalog.filter((puzzle) => puzzle.dimension === this.puzzle.dimension && puzzle.hasTime === this.puzzle.hasTime);
    const currentId = this.sourcePuzzle?.id || this.puzzle.id;
    const index = matching.findIndex((puzzle) => puzzle.id === currentId);
    const next = matching[(index + 1) % matching.length];
    this.setMode(this.modeForPuzzle(next), next.lattice.kind, next.id);
  }

  togglePlayback() { this.playTimer ? this.stopPlayback() : this.startPlayback(true); }

  renderPlaybackButton() {
    const button = $('#playButton');
    if (!button) return;
    const key = this.playTimer ? 'pauseAnimation' : 'playAnimation';
    button.textContent = this.playTimer ? '❚❚' : '▶';
    button.setAttribute('aria-label', this.t(key));
    button.title = this.t(key);
  }

  startPlayback(loop = true) {
    if (!this.puzzle.hasTime) return;
    this.stopPlayback();
    this.playTimer = setInterval(() => {
      if (this.currentFrame >= this.puzzle.frameCount - 1) {
        if (!loop) { this.stopPlayback(); return; }
        this.currentFrame = 0;
      } else this.currentFrame += 1;
      this.selectBestTrack(); this.updateAll();
    }, 720);
    this.renderPlaybackButton();
  }

  stopPlayback() {
    if (this.playTimer) clearInterval(this.playTimer);
    this.playTimer = null;
    this.renderPlaybackButton();
  }

  scheduleSave() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => saveProgress(this.puzzle, { state: this.state, frame: this.currentFrame }), 180);
  }

  flushSave() {
    clearTimeout(this.saveTimer);
    this.saveTimer = null;
    if (this.puzzle?.solution?.length && this.state.length === this.puzzle.solution.length) {
      saveProgress(this.puzzle, { state: this.state, frame: this.currentFrame });
    }
  }

  updateUrl() {
    const url = new URL(location.href);
    url.searchParams.set('dimension', String(this.puzzle.dimension));
    url.searchParams.set('time', this.puzzle.hasTime ? '1' : '0');
    url.searchParams.set('lattice', this.puzzle.lattice.kind);
    url.searchParams.set('puzzle', this.sourcePuzzle?.id || this.puzzle.sourceId || this.puzzle.id);
    url.searchParams.set('rules', this.gameplayMode);
    url.searchParams.set('lang', this.lang);
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
