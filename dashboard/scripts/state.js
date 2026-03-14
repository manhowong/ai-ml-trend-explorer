/* ============================================================
   state.js - Single source of truth for all mutable state
   ============================================================ */

export const state = {
  // Raw data from JSON files
  cats:               [],   // runtime category array (built by applyNormalizedData)
  catsAll:            [],   // all categories (including zero-article) for lists/search
  childEdges:         [],   // L2-level co-occurrence edges
  keywordData:        {},   // topicId â†’ [{ id, name, papers, trend }]
  rawMetadata:        null,
  rawTimeseries:      null,
  dataMonths:         [],   // sorted month strings, e.g. ["2024-01", ...]
  selectedStartMonth: null,
  selectedEndMonth:   null,

  // Derived lookup tables (built by initializeDerivedData)
  childMap:    {},   // nodeId   â†’ L2 node object
  childToCat:  {},   // L2 id   â†’ parent category id
  catMap:      {},   // cat id  â†’ category object
  parentEdges: [],   // category-level rolled-up edges
  childMapAll:   {}, // nodeId to L2 node object (all, incl. unassigned)
  childToCatAll: {}, // L2 id to parent category id (all)
  catMapAll:     {}, // cat id to category object (all)

  // View state
  currentView:  'overview',  // 'overview' | 'category' | 'child'
  currentCat:   null,
  currentChild: null,
  hoveredNode:  null,

  // Current render snapshot (used for hover diff)
  curNodes:  [],
  curLinks:  [],
  curAdjMap: {},

  // Node-size scaling inputs (set per view)
  nodeSizeMax: 0,
  nodeSizeTotal: 0,

  // Sort modes
  level1SortMode: 'papers',  // 'papers' | 'hotness'
  level2SortMode: 'papers',  // 'papers' | 'hotness' | 'links'

  // ECharts rich-label styles
  allColors:  [],
  richStyles: {},

  // Font
  currentFontSize: 10,

  // Paper count threshold
  paperThreshold: 1,

  // Edge
  showIntraEdges: true,   // within-category links
  showCrossEdges: true,   // cross-category links
};

export const DEFAULT_FONT_SIZE = 10;

export const categoryColorById = {
  A: '#be185d',
  B: '#7c3aed',
  C: '#0d9488',
  D: '#0369a1',
  E: '#b45309',
  F: '#dc2626',
  G: '#059669',
  H: '#1d4ed8',
  I: '#a16207',
};

export const EDGE_WIDTH_SCALE = 10;
