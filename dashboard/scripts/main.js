/* ============================================================
   main.js — Entry point: boot sequence and event listeners
   ============================================================ */

import { state }                                       from './state.js';
import { loadData, applyNormalizedData, initializeDerivedData } from './data.js';
import { echart, initializeRichStyles,
         refreshThemeVars,
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

// Theme toggle ---------------------------------------------------------------

function rerenderCurrentView() {
  if (state.currentView === 'overview') return goOverview();
  if (state.currentView === 'category') return focusCategory(state.currentCat);
  if (state.currentView === 'child')    return focusChildNode(state.currentChild);
}

function applyTheme(theme, persist = true) {
  document.documentElement.setAttribute('data-theme', theme);
  if (persist) localStorage.setItem('theme', theme);

  const btn = document.getElementById('themeToggle');
  if (btn) {
    btn.textContent = theme === 'dark' ? 'Theme: Dark' : 'Theme: Light';
    btn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
  }

  refreshThemeVars();
  if (state.cats.length) {
    initializeRichStyles();
    rerenderCurrentView();
  }
}

function initThemeToggle() {
  const saved = localStorage.getItem('theme');
  applyTheme(saved || 'dark', false);
  const btn = document.getElementById('themeToggle');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const next = (document.documentElement.getAttribute('data-theme') || 'dark') === 'dark'
      ? 'light'
      : 'dark';
    applyTheme(next, true);
  });
}


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
    onSameNodeTap: (data) => navigateDown(data),
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
    // Dig through the ECharts layers to find the native event
    const sourceEvent = e?.event?.event || e?.event || e;
    // Check for PointerEvents (modern) OR TouchEvents (legacy/specific mobile)
    const isPointerTouch = sourceEvent?.pointerType === 'touch';
    const isStandardTouch = !!(sourceEvent?.touches || sourceEvent?.targetTouches);
    return isPointerTouch || isStandardTouch;
};

// Mouse events (when isTouch is false)

// --- Hover on node (highlight node)
echart.on('mouseover', (e) => {
     if (e.dataType === 'node' && !isTouch(e)) mouseActions.onNodeHover(e.data.id);
});
// --- Move away from node (clear highlight)
echart.on('mouseout', (e) => {
     if (e.dataType === 'node' && !isTouch(e)) mouseActions.onNodeLeave();
});
// --- Click on node (navigate down 1 level)
echart.on('click', (e) => {
      if (e.dataType === 'node' && !isTouch(e)) mouseActions.onNodeClick(e.data);
});
// --- Double click on canvas (navigate up 1 level)
echart.getZr().on('dblclick', (e) => {   // use getZr()
    if (!e.target && !isTouch(e)) mouseActions.onCanvasDblClick();
});


// Mobile events

// --- Tap on node
echart.on('click', (e) => {
    if ( e.dataType === 'node' && isTouch(e) ) {
        if (state.hoveredNode != e.data.id) {
            // Tap on node first time, hightlight it
            mobileActions.onNodeTap(e.data.id);
        } else {
            // Tap on same node again, navigate down
            mobileActions.onSameNodeTap(e.data);
        };
    }
    // Tap elsewhere, clear hover
    if ( e.dataType != 'node' && isTouch(e) ) mobileActions.onCanvasTap();
});

let pressTimer = 0;
let isLongPress = false;

// --- Long-press on canvas (navigate up 1 level)
echart.getZr().on('mousedown', (e) => {   // use getZr()
    if (e.target) return;
    mobileActions.onCanvasTap(); // Clear hover immediately on tap
    pressTimer = setTimeout(() => {
    mobileActions.onCanvasLongPress();
    isLongPress = true;
    }, 600);
});

// The following block works but not needed
// --- Long-press on node (navigate down 1 level)
// echart.on('mousedown', (e) => {
//     if (e.dataType !== 'node') return;
//     pressTimer = setTimeout(() => {
//         mobileActions.onSameNodeTap(e.data);
//         isLongPress = true;
//     }, 600);
// });

// --- Reset long press timer
echart.getZr().on('mouseup', () => {   // use getZr()
    clearTimeout(pressTimer);
    isLongPress = false;
});

// This reset long press timer
const cancelInteraction = () => {
  clearTimeout(pressTimer);
  isLongPress = false;
};

// --- Cancel if finger lifts
echart.getZr().on('mouseup', cancelInteraction);
echart.getZr().on('touchend', cancelInteraction);

// --- Cancel if finger/mouse moves too much
echart.getZr().on('mousemove', cancelInteraction);

// --- Cancel if finger slides off the chart area
echart.getZr().on('globalout', cancelInteraction);


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
  initThemeToggle();
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
