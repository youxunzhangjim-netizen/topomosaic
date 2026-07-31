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
    pageTitle: 'TopoMosaic — Spatial & Temporal Logic',
    pageDescription: 'TopoMosaic: colored ordered-track puzzles on 2D tilings, 3D lattices, and time.',
    skipToPuzzle: 'Skip to puzzle', backToTopoboard: 'Back to Topoboard', openHelp: 'Open help',
    reportContact: 'Report contact', reportLabel: 'Report',
    switchToChinese: 'Switch language to Traditional Chinese', switchToEnglish: 'Switch language to English',
    languageCodeToChinese: '中文', languageCodeToEnglish: 'EN', languageChanged: 'Language switched to English.',
    puzzleConfiguration: 'Puzzle configuration', dimensionTimeMode: 'Dimension and time mode', puzzleTools: 'Puzzle tools',
    colorPalette: 'Color palette', zoomOut: 'Zoom out', zoomIn: 'Zoom in', puzzleProgress: 'Puzzle progress',
    viewMode: 'View mode', board2dAria: 'Two-dimensional puzzle board', board3dAria: 'Interactive three-dimensional puzzle view',
    sliceControls: '3D slice controls', previousSlice: 'Previous slice', nextSlice: 'Next slice', sliceLayer: 'Slice layer',
    timeNavigation: 'Time navigation', previousFrame: 'Previous frame', nextFrame: 'Next frame',
    currentTimeFrame: 'Current time frame', playAnimation: 'Play animation', pauseAnimation: 'Pause animation',
    cluesCellInfo: 'Clues and cell information', clueDimension: 'Clue dimension', previousClueLine: 'Previous clue line',
    nextClueLine: 'Next clue line', orderedColoredClues: 'Ordered colored clues', selectedTrackCells: 'Cells on the selected clue track',
    mobilePuzzleTools: 'Mobile puzzle tools', closeHelp: 'Close help',
    tagline: 'Spatial & temporal colored logic', lattice: 'Lattice', puzzle: 'Puzzle',
    gameKind: 'Picture type', colorPicture: 'Color picture', blackWhitePicture: 'Black & white picture',
    tools: 'Tools', paint: 'Draw', empty: 'Empty', clear: 'Clean', inspect: 'Inspect', move: 'Move / Orbit', moveShort: 'Move', palette: 'Palette', actions: 'Actions',
    undo: 'Undo', redo: 'Redo', hint: 'Hint', check: 'Check', reset: 'Reset', view: 'View', fit: 'Fit',
    onionSkin: 'Previous-frame ghost', strictMode: 'Immediate mistake warning', board: 'Board', model: 'Model',
    slice: 'Slice', track: 'Track', plane: 'Plane', spatialClue: 'Spatial clue', timeClue: 'Time clue',
    direction: 'Direction', orderedTrack: 'Ordered track', trackInstruction: 'Select or edit any cell here when the model is difficult to reach.',
    selectedCell: 'Selected cell', state: 'State', memberships: 'Spatial tracks', temporalRun: 'Temporal clue',
    semanticPart: 'Semantic part', modelParts: 'Model parts', whyThisLattice: 'Why this lattice?', clues: 'Clues',
    howToPlay: 'How to play', sharedRule: 'One rule across every geometry',
    pictureTypes: 'Two picture types',
    pictureTypesText: 'Color picture keeps different colors in the clue runs. Black & white picture converts every non-empty picture block into one filled block and uses standard number clues.',
    sharedRuleText: 'Each clue is an ordered list of colored runs. [Yellow 2] [Blue 3] means two connected yellow cells followed later—or immediately, because the colors differ—by three connected blue cells. Runs of the same color require at least one empty cell between them.',
    timeRule: 'Time is a real clue direction', timeRuleText: 'In +Time modes, spatial clues apply inside each frame. Selecting one cell also reveals its ordered run through all frames. The timeline is therefore part of the logic, not a countdown.',
    threeDViews: 'Three complementary 3D views', threeDViewsText: 'Model gives context, Slice exposes internal layers, and Track isolates exactly one clue line. Use Draw, Empty, or Clean for editing; use Move / Orbit when you want camera control.',
    shortcuts: 'Keyboard shortcuts', chooseColor: 'Choose color', markEmpty: 'Mark empty', clearCell: 'Clear to unknown',
    orbitCamera: 'Move / orbit', undoRedo: 'Undo / redo', changeFrame: 'Previous / next frame', startPlaying: 'Start playing',
    completed: 'Puzzle completed', replayAnimation: 'Replay animation', nextPuzzle: 'Next puzzle', close: 'Close',
    unknown: 'Unknown', noPart: 'None', hidden: 'Hidden', solved: 'Clue satisfied', incomplete: 'Clue incomplete',
    noRuns: 'No colored cells', noFilledCells: 'No filled cells', given: 'Given', frame: 'Frame', temporal: 'Time', loading3d: 'Loading the 3D lattice viewer…',
    rendererFallback: 'The 3D library could not load. The ordered Track panel remains fully playable; serve the app online or install dependencies to restore the model viewer.',
    hintApplied: 'One logically forced cell was filled.', hintAppliedDetailed: (cell, value) => `Hint filled ${cell} as ${value}.`, noHint: 'No forced move is available from the current state.',
    contradiction: 'The current marks contradict at least one clue. Undo or clear a recent mark.',
    checkPerfect: 'Every decided cell is correct. Continue solving the remaining unknown cells.',
    checkWrong: (count) => `${count} decided cell${count === 1 ? '' : 's'} currently disagree with the solution.`,
    strictRejected: 'That value is not compatible with this puzzle in strict mode.', resetConfirm: 'Reset this puzzle and erase its saved progress?',
    resetDone: 'Puzzle reset. Draw, Empty, and Clean are ready.',
    completeText: (title) => `${title} is complete. Explore the finished model, its parts, or replay its time evolution.`,
    difficultyStarter: 'Starter', difficultyEasy: 'Easy', difficultyMedium: 'Medium', difficultyAdvanced: 'Advanced',
    clueChipTitle: (color, length) => `${color}, run length ${length}`,
    trackCellLabel: (cell, frame, value, given) => `${cell}, Frame ${frame}, ${value}${given ? ', Given' : ''}`,
    mode2: '2D', mode2t: '2D + Time', mode3: '3D', mode3t: '3D + Time',
  },
  zh: {
    pageTitle: 'TopoMosaic — 空間與時間邏輯',
    pageDescription: 'TopoMosaic：在 2D 鋪砌、3D 晶格與時間軸上解彩色有序路徑謎題。',
    skipToPuzzle: '跳到謎題', backToTopoboard: '返回 Topoboard', openHelp: '開啟說明',
    reportContact: '問題回報聯絡方式', reportLabel: '回報',
    switchToChinese: '切換語言為繁體中文', switchToEnglish: '切換語言為 English',
    languageCodeToChinese: '中文', languageCodeToEnglish: 'EN', languageChanged: '語言已切換為繁體中文。',
    puzzleConfiguration: '關卡設定', dimensionTimeMode: '維度與時間模式', puzzleTools: '謎題工具',
    colorPalette: '色盤', zoomOut: '縮小', zoomIn: '放大', puzzleProgress: '解題進度',
    viewMode: '視圖模式', board2dAria: '二維謎題盤面', board3dAria: '可互動的三維謎題視圖',
    sliceControls: '3D 切片控制', previousSlice: '上一個切片', nextSlice: '下一個切片', sliceLayer: '切片層',
    timeNavigation: '時間導覽', previousFrame: '上一幀', nextFrame: '下一幀',
    currentTimeFrame: '目前時間幀', playAnimation: '播放動畫', pauseAnimation: '暫停動畫',
    cluesCellInfo: '線索與格子資訊', clueDimension: '線索維度', previousClueLine: '上一條線索',
    nextClueLine: '下一條線索', orderedColoredClues: '有序彩色線索', selectedTrackCells: '目前線索路徑上的格子',
    mobilePuzzleTools: '手機謎題工具', closeHelp: '關閉說明',
    tagline: '跨空間與時間的彩色邏輯', lattice: '晶格／鋪砌', puzzle: '關卡',
    gameKind: '圖片類型', colorPicture: '彩色圖片', blackWhitePicture: '黑白圖片',
    tools: '工具', paint: '繪製', empty: '標記空格', clear: '清乾淨', inspect: '檢視', move: '移動／旋轉', moveShort: '移動', palette: '色盤', actions: '操作',
    undo: '復原', redo: '重做', hint: '提示', check: '檢查', reset: '重設', view: '視圖', fit: '置中',
    onionSkin: '顯示前一幀殘影', strictMode: '立即提示錯誤', board: '盤面', model: '模型', slice: '切片', track: '路徑',
    plane: '切面', spatialClue: '空間線索', timeClue: '時間線索', direction: '方向', orderedTrack: '有序路徑',
    trackInstruction: '模型內部不易選取時，可直接在這裡選擇或編輯任一格。', selectedCell: '目前格子', state: '狀態',
    memberships: '所屬空間路徑', temporalRun: '時間線索', semanticPart: '語意部件', modelParts: '模型部件',
    whyThisLattice: '此晶格的意義', clues: '線索', howToPlay: '玩法說明', sharedRule: '所有幾何共用一套規則',
    pictureTypes: '兩種圖片類型',
    pictureTypesText: '彩色圖片會保留不同顏色的連續線索。黑白圖片會把所有非空白圖塊轉成同一種填滿格，並使用標準數字線索。',
    sharedRuleText: '每條線索都是依序排列的彩色連續區段。[黃 2] [藍 3] 表示兩格連續黃色，之後出現三格連續藍色；因顏色不同，兩段可以直接相接。相同顏色的兩段之間至少要有一格空白。',
    timeRule: '時間是真正的線索方向', timeRuleText: '在「+時間」模式，每一幀有自己的空間線索；選取一格後，也會看到它跨越所有時間幀的有序線索。因此時間軸參與推理，不是倒數計時。',
    threeDViews: '三種互補的 3D 視圖', threeDViewsText: '模型視圖提供整體脈絡，切片視圖揭露內部，路徑視圖只保留一條線索線。繪製、空格與清乾淨負責編輯；需要控制鏡頭時切換到移動／旋轉。',
    shortcuts: '鍵盤快捷鍵', chooseColor: '選擇顏色', markEmpty: '標記空格', clearCell: '清回未知', orbitCamera: '移動／旋轉',
    undoRedo: '復原／重做', changeFrame: '上一幀／下一幀', startPlaying: '開始遊玩', completed: '關卡完成',
    replayAnimation: '重播動畫', nextPuzzle: '下一關', close: '關閉', unknown: '未知', noPart: '無', hidden: '尚未揭示',
    solved: '線索已完成', incomplete: '線索尚未完成', noRuns: '沒有著色格', given: '已知格', frame: '時間幀', temporal: '時間',
    noFilledCells: '沒有填滿格',
    loading3d: '正在載入 3D 晶格檢視器…', rendererFallback: '3D 函式庫載入失敗；右側的有序路徑仍可完整解題。以網路伺服器開啟或安裝相依套件後即可恢復模型視圖。',
    hintApplied: '已填入一個由目前線索必然推出的格子。', hintAppliedDetailed: (cell, value) => `提示已將 ${cell} 填為${value}。`, noHint: '目前狀態沒有可直接推出的下一格。',
    contradiction: '目前標記與至少一條線索矛盾，請復原或清除最近的操作。', checkPerfect: '所有已決定的格子都正確，請繼續完成其餘未知格。',
    checkWrong: (count) => `目前有 ${count} 個已決定格與答案不一致。`, strictRejected: '嚴格模式下不能填入與本關不相容的狀態。',
    resetConfirm: '確定重設本關並刪除已儲存進度？', resetDone: '關卡已重設。繪製、空格與清乾淨已可使用。',
    completeText: (title) => `「${title}」已完成。可探索完成模型、語意部件或重播時間演化。`,
    difficultyStarter: '入門', difficultyEasy: '初級', difficultyMedium: '中級', difficultyAdvanced: '進階',
    clueChipTitle: (color, length) => `${color}，連續長度 ${length}`,
    trackCellLabel: (cell, frame, value, given) => `${cell}，第 ${frame} 幀，${value}${given ? '，已知格' : ''}`,
    mode2: '2D', mode2t: '2D＋時間', mode3: '3D', mode3t: '3D＋時間',
  },
};

const LATTICE_NAMES = {
  en: { square: 'Square cells', hex: 'Hexagonal cells', triangle: 'Triangular cells', sc: 'Simple cubic', fcc: 'FCC Voronoi cells', bcc: 'BCC Voronoi cells', hcp: 'HCP Voronoi cells' },
  zh: { square: '正方格', hex: '六角格', triangle: '三角格', sc: '簡單立方', fcc: 'FCC Voronoi 格', bcc: 'BCC Voronoi 格', hcp: 'HCP Voronoi 格' },
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
    row: 'Rows', column: 'Columns',
    'hex-q': 'Q direction', 'hex-r': 'R direction', 'hex-s': 'S direction',
    'tri-a': 'A zigzag', 'tri-b': 'B zigzag', 'tri-c': 'C zigzag',
    'sc-x': 'X tracks', 'sc-y': 'Y tracks', 'sc-z': 'Z tracks',
    'fcc-110': '[110]', 'fcc-1m10': '[1-10]', 'fcc-101': '[101]', 'fcc-10m1': '[10-1]', 'fcc-011': '[011]', 'fcc-01m1': '[01-1]',
    'bcc-111': '[111]', 'bcc-11m1': '[11-1]', 'bcc-1m11': '[1-11]', 'bcc-m111': '[-111]',
    'bcc-100': '[100] secondary', 'bcc-010': '[010] secondary', 'bcc-001': '[001] secondary',
    'hcp-a1': 'Basal a₁', 'hcp-a2': 'Basal a₂', 'hcp-a3': 'Basal a₃', 'hcp-c': 'Axial c',
  },
  zh: {
    row: '橫列', column: '直行',
    'hex-q': 'Q 方向', 'hex-r': 'R 方向', 'hex-s': 'S 方向',
    'tri-a': 'A 鋸齒線', 'tri-b': 'B 鋸齒線', 'tri-c': 'C 鋸齒線',
    'sc-x': 'X 路徑', 'sc-y': 'Y 路徑', 'sc-z': 'Z 路徑',
    'fcc-110': '[110]', 'fcc-1m10': '[1-10]', 'fcc-101': '[101]', 'fcc-10m1': '[10-1]', 'fcc-011': '[011]', 'fcc-01m1': '[01-1]',
    'bcc-111': '[111]', 'bcc-11m1': '[11-1]', 'bcc-1m11': '[1-11]', 'bcc-m111': '[-111]',
    'bcc-100': '[100] 次要', 'bcc-010': '[010] 次要', 'bcc-001': '[001] 次要',
    'hcp-a1': '基面 a₁', 'hcp-a2': '基面 a₂', 'hcp-a3': '基面 a₃', 'hcp-c': 'c 軸',
  },
};

const SLICE_FAMILY_LABELS = {
  en: {
    'slice-x': 'X layers', 'slice-y': 'Y layers', 'slice-z': 'Z layers',
    'fcc-100': '{100} X planes', 'fcc-010': '{100} Y planes', 'fcc-001': '{100} Z planes', 'fcc-111': '{111} close-packed planes',
    'bcc-100-plane': '{100} X planes', 'bcc-010-plane': '{100} Y planes', 'bcc-001-plane': '{100} Z planes', 'bcc-111-plane': '{111} diagonal planes',
    'hcp-basal': 'Basal (0001) layers', 'hcp-prism-a1': 'Prismatic A layers', 'hcp-prism-a2': 'Prismatic B layers',
  },
  zh: {
    'slice-x': 'X 層', 'slice-y': 'Y 層', 'slice-z': 'Z 層',
    'fcc-100': '{100} X 面', 'fcc-010': '{100} Y 面', 'fcc-001': '{100} Z 面', 'fcc-111': '{111} 密排面',
    'bcc-100-plane': '{100} X 面', 'bcc-010-plane': '{100} Y 面', 'bcc-001-plane': '{100} Z 面', 'bcc-111-plane': '{111} 對角面',
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
