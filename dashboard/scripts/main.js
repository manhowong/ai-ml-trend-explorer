/* ============================================================
   main.js — Entry point: boot sequence and event listeners
   ============================================================ */

import { state }                                       from './state.js';
import { loadData, applyNormalizedData, initializeDerivedData } from './data.js';
import { echart, initializeRichStyles,
         applyHover, clearHover,
         fitScreen, updateFontSize, resetFontSize,
         getChartCenter }                              from './chart.js';
import { goOverview, focusCategory, focusChildNode }   from './views.js';
import { setSortMode }                                 from './panel.js';
import { buildDateRangeControls, updateDateText,
         toggleSidebar, initEdgeToggles } from './controls.js';
import { initSearch } from './search.js';


// Expose functions used by inline HTML event handlers -------------------------
// (panel.js generates HTML strings with onclick="..." attributes
//  that call these as globals at runtime)

window.applyHover     = applyHover;
window.clearHover     = clearHover;
window.focusCategory  = focusCategory;
window.focusChildNode = focusChildNode;
window.setSortMode    = setSortMode;


// Sidebar controls ------------------------------------------------------------

document.getElementById('sidebarToggle')
  .addEventListener('click', toggleSidebar);

document.getElementById('panelToggle')
  .addEventListener('click', () => {
    
    document.getElementById('right-panel').classList.toggle('collapsed');
    
    // Shift chart center when the panel is open or closed

    // Check number of nodes in chart. If only 1 node, don't center by chart
    // (because the node sits at the edge of chart in circular layout)
    const isSingle = echart.getOption().series[0].data.length === 1;
    const cx = window.innerWidth / window.innerHeight * 0.2 * 100 ; // calculate horizontal center

    echart.setOption({ series: [{ 
        center: isSingle?[ `${cx}%`, '50%'] : getChartCenter() 
      }] 
    });
  });

document.getElementById('fitBtn')
  .addEventListener('click', fitScreen);

document.getElementById('fontSlider')
  .addEventListener('input', e => updateFontSize(e.target.value));

document.getElementById('fontSizeReset')
  .addEventListener('click', resetFontSize);


// ECharts event listeners -----------------------------------------------------

let longPressTimer = null;
let lastTouchTime  = 0;
let touchedNodeId  = null;   // node id under the finger (set by ECharts mouseover on touch)
const GHOST_DELAY  = 500;
const LONG_PRESS   = 600;

// Classifiers

const isTouch = (e) =>
  e.pointerType === 'touch' || e.type?.includes('touch');

const isGhostMouse = (e) => {
  const isMouse = e.pointerType === 'mouse' || e.type?.includes('mouse');
  return isMouse && (Date.now() - lastTouchTime < GHOST_DELAY);
};

// Actions

const navigateInto = (d) => {
  state.hoveredNode = null;
  if (state.currentView === 'overview' && d._type === 'parent') focusCategory(d._catId || d.id);
  if (state.currentView === 'category' && (d._type === 'child' || d._type === 'ext')) focusChildNode(d.id);
  if (state.currentView === 'child' && d._type === 'conn') focusChildNode(d.id);
};

const navigateBack = () => {
  state.hoveredNode = null;
  if (state.currentView === 'child') focusCategory(state.currentCat);
  else if (state.currentView === 'category') goOverview();
};

const cancelLongPress = () => {
  if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
};

// Mouse hover

echart.on('mouseover', params => {
  if (params.dataType !== 'node') return;
  const e = params.event?.event || {};
  if (isGhostMouse(e)) return;
  if (isTouch(e)) {
    // Track which node the finger is over (for long-press detection)
    touchedNodeId = params.data.id;
    return;
  }
  const id = params.data.id;
  if (state.hoveredNode === id) return;
  state.hoveredNode = id;
  applyHover(id);
});

echart.on('mouseout', params => {
  if (params.dataType !== 'node') return;
  const e = params.event?.event || {};
  if (isGhostMouse(e)) return;
  if (isTouch(e)) { touchedNodeId = null; return; }
  state.hoveredNode = null;
  clearHover();
});

// Mouse click -> navigate into

echart.on('click', params => {
  if (params.dataType !== 'node') return;
  const e = params.event?.event || {};
  if (isTouch(e) || isGhostMouse(e)) return;
  navigateInto(params.data);
});

// Mouse double-click on empty space / edge -> navigate back

echart.getZr().on('dblclick', e => {
  if (isTouch(e) || isGhostMouse(e)) return;
  if (e.target) return;
  navigateBack();
});

// Touch pointerdown -> start long-press timer

echart.getZr().on('pointerdown', e => {
  if (!isTouch(e)) return;
  lastTouchTime = Date.now();
  cancelLongPress();

  longPressTimer = setTimeout(() => {
    longPressTimer = null;
    if (touchedNodeId) {
      // Long-press on node -> navigate into
      const node = state.curNodes.find(n => n.id === touchedNodeId);
      if (node) navigateInto({ ...node._orig, id: touchedNodeId });
    } else {
      // Long-press on empty space / edge -> navigate back
      navigateBack();
    }
  }, LONG_PRESS);
});

// Touch pointerup -> short tap

echart.getZr().on('pointerup', e => {
  if (!isTouch(e)) return;
  if (!longPressTimer) return;   // long-press already fired
  cancelLongPress();

  if (touchedNodeId) {
    // Tap on node -> toggle highlight
    if (state.hoveredNode === touchedNodeId) {
      state.hoveredNode = null;
      clearHover();
    } else {
      state.hoveredNode = touchedNodeId;
      applyHover(touchedNodeId);
    }
  } else {
    // Tap on empty space / edge -> clear highlight
    if (state.hoveredNode) {
      state.hoveredNode = null;
      clearHover();
    }
  }
});

// Touch pointermove -> cancel long-press (finger dragged)

echart.getZr().on('pointermove', e => {
  if (!isTouch(e)) return;
  cancelLongPress();
});


// Responsive ------------------------------------------------------------------

window.addEventListener('resize', () => echart.resize());

// Right panel and sidebar starts collapsed with small screen
if (window.innerWidth <= 768) {
  document.getElementById('right-panel').classList.add('collapsed');
  document.getElementById('sidebar').classList.add('collapsed');
}

//Mobile: click outside of sidebar, close it automatically
document.addEventListener('click', e => {
  if (window.innerWidth > 768) return;
  const sidebar = document.getElementById('sidebar');
  if (sidebar.classList.contains('collapsed')) return;
  if (sidebar.contains(e.target)) return;
  toggleSidebar();
});

// Boot ------------------------------------------------------------------------

async function initializeApp() {
  await loadData();
  buildDateRangeControls();
  applyNormalizedData();
  updateDateText();
  initializeDerivedData();
  initializeRichStyles();
  goOverview();
  initEdgeToggles();
  initSearch();
}

initializeApp().catch(err => {
  console.error(err);
  alert('Failed to load data.');
});