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
    echart.setOption({ series: [{ center: getChartCenter() }] });
  });

document.getElementById('fitBtn')
  .addEventListener('click', fitScreen);

document.getElementById('fontSlider')
  .addEventListener('input', e => updateFontSize(e.target.value));

document.getElementById('fontSizeReset')
  .addEventListener('click', resetFontSize);


// ECharts event listeners -----------------------------------------------------

echart.on('mouseover', params => {
  if (params.dataType !== 'node') return;
  const id = params.data.id;
  if (state.hoveredNode === id) return;
  state.hoveredNode = id;
  applyHover(id);
});

echart.on('mouseout', params => {
  if (params.dataType !== 'node') return;
  state.hoveredNode = null;
  clearHover();
});

echart.on('click', params => {
  if (params.dataType !== 'node') return;
  const d = params.data;
  state.hoveredNode = null;
  if (state.currentView === 'overview' && d._type === 'parent')                        focusCategory(d._catId || d.id);
  if (state.currentView === 'category' && (d._type === 'child' || d._type === 'ext')) focusChildNode(d.id);
  if (state.currentView === 'child'    && d._type === 'conn')                          focusChildNode(d.id);
});

// Click on empty canvas → navigate one level back up
echart.getZr().on('dblclick', e => {
  if (e.target) return;
  state.hoveredNode = null;
  if      (state.currentView === 'child')    focusCategory(state.currentCat);
  else if (state.currentView === 'category') goOverview();
});

// Long-press on empty canvas (mobile) → navigate back up
let longPressTimer = null;

echart.getZr().on('mousedown', e => {
  if (e.target) return;
  longPressTimer = setTimeout(() => {
    state.hoveredNode = null;
    if      (state.currentView === 'child')    focusCategory(state.currentCat);
    else if (state.currentView === 'category') goOverview();
  }, 500);
});
echart.getZr().on('mouseup',   () => clearTimeout(longPressTimer));
echart.getZr().on('mousemove', () => clearTimeout(longPressTimer));


// Responsive resize -----------------------------------------------------------

window.addEventListener('resize', () => echart.resize());

// Right panel and sidebar starts collapsed with small screen
if (window.innerWidth <= 768) {
  document.getElementById('right-panel').classList.add('collapsed');
  document.getElementById('sidebar').classList.add('collapsed');
}

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
}

initializeApp().catch(err => {
  console.error(err);
  alert('Failed to load data.');
});