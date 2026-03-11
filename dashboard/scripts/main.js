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

// Define the actions by mouse (e.g. desktop) and mobile devices

const mouseActions = {
  onNodeHover: (id) => { state.hoveredNode = id; applyHover(id); },
  onNodeLeave: () => { state.hoveredNode = null; clearHover(); },
  onNodeClick: (data) => navigateDown(data),
  onCanvasDblClick: () => navigateUp()
};

const mobileActions = {
  onNodeTap: (id) => { state.hoveredNode = id; applyHover(id); },
  onNodeLongPress: (data) => navigateDown(data),
  onCanvasTap: () => { state.hoveredNode = null; clearHover(); },
  onCanvasLongPress: () => navigateUp()
};

// Navigation functions

function navigateDown(d) {
  state.hoveredNode = null;
  if (state.currentView === 'overview' && d._type === 'parent') focusCategory(d._catId || d.id);
  else if (state.currentView === 'category' && (d._type === 'child' || d._type === 'ext')) focusChildNode(d.id);
  else if (state.currentView === 'child' && d._type === 'conn') focusChildNode(d.id);
}

function navigateUp() {
  state.hoveredNode = null;
  if (state.currentView === 'child') focusCategory(state.currentCat);
  else if (state.currentView === 'category') goOverview();
}

// Determine if the event is touch
const isTouch = (e) => {
  const sourceEvent = e?.event?.event || e?.event || e;
  const touch = (sourceEvent && sourceEvent.pointerType === 'touch');
  return touch;
};

// Mouse events (when isTouch is false)

// --- Hover on node
echart.on('mouseover', (p) => {
  if (p.dataType === 'node' && !isTouch(p)) mouseActions.onNodeHover(p.data.id);
});
// --- Move away from node
echart.on('mouseout', (p) => {
  if (p.dataType === 'node' && !isTouch(p)) mouseActions.onNodeLeave();
});
// --- Click on node
echart.on('click', (p) => {
  if (p.dataType !== 'node' && !isTouch(p)) mouseActions.onNodeClick(p.data);
});
// --- Double click on canvas
echart.getZr().on('dblclick', (e) => {
  if (!e.target && !isTouch(e)) mouseActions.onCanvasDblClick();
});


// Mobile or hybrid events (touch or click)

// --- Top on node or click on node
//     mobile tap: isTouch is true and longPressTimer is not triggered
//     mouse click: everything else
echart.on('click', (p) => {
  if (p.dataType !== 'node') return;

  if (isTouch(p) || state.hoveredNode != p.data.id) {
    mobileActions.onNodeTap(p.data.id); // Highlight node
  } else {
    mouseActions.onNodeClick(p.data); // Navigate down
  }

});

let longPressTimer = null;

// --- Long-press on node
echart.on('mousedown', (p) => {
  if (p.dataType !== 'node') return;
  

    longPressTimer = setTimeout(() => {
      mobileActions.onNodeLongPress(p.data);
      longPressTimer = 'triggered';
    }, 600);

});

// --- Long-press on canvas
echart.getZr().on('mousedown', (e) => {
  if (e.target) return;

  if (isTouch(e)) {
    mobileActions.onCanvasTap(); // Clear hover immediately on tap
    longPressTimer = setTimeout(() => {
      mobileActions.onCanvasLongPress(); // Navigate up
      longPressTimer = 'triggered';
    }, 600);
  }
});

// Reset long press
echart.getZr().on('mouseup', () => {
  if (longPressTimer !== 'triggered') clearTimeout(longPressTimer);
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