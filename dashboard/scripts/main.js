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

// Hover on a node to highlight it
echart.on('mouseover', params => {
  if (params.dataType !== 'node') return;
  const id = params.data.id;
  if (state.hoveredNode === id) return;
  state.hoveredNode = id;
  applyHover(id);
});

// Clear hover
echart.on('mouseout', params => {
  if (params.dataType !== 'node') return;
  state.hoveredNode = null;
  clearHover();
});

// Mobile: Long-press instead of hover on node to hightlight it
let nodeLongPressTimer = null;
let wasLongPress = false;

echart.on('mousedown', params => {
  if (params.dataType !== 'node') return;
  wasLongPress = false;
  nodeLongPressTimer = setTimeout(() => {
    wasLongPress = true;
    state.hoveredNode = params.data.id;
    applyHover(params.data.id);
  }, 500);
});

echart.on('mouseup',   () => clearTimeout(nodeLongPressTimer));
echart.on('mousemove', () => clearTimeout(nodeLongPressTimer));

// Clear hover after long-press by tapping
echart.getZr().on('click', e => {
  if (e.target) return;  // tapped empty canvas
  state.hoveredNode = null;
  clearHover();
});

// Click a node to go one level down
echart.on('click', params => {
  if (params.dataType !== 'node') return;
  if (wasLongPress) { wasLongPress = false; return; }  // block navigation

  const d = params.data;
  state.hoveredNode = null;
  if (state.currentView === 'overview' && d._type === 'parent') focusCategory(d._catId || d.id);
  if (state.currentView === 'category' && (d._type === 'child' || d._type === 'ext')) focusChildNode(d.id);
  if (state.currentView === 'child' && d._type === 'conn') focusChildNode(d.id);
});

// Click on empty canvas, navigate one level back up
echart.getZr().on('dblclick', e => {
  if (e.target) return;
  state.hoveredNode = null;
  if (state.currentView === 'child') focusCategory(state.currentCat);
  else if (state.currentView === 'category') goOverview();
});

// Mobile: Long-press on empty canvas (mobile), navigate back up
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