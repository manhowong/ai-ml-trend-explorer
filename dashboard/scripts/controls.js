/* ============================================================
   controls.js — Sidebar UI: date-range, dateText, toggle
   ============================================================ */

import { state } from './state.js';
import { applyNormalizedData, initializeDerivedData } from './data.js';
import { initializeRichStyles } from './chart.js';
import { goOverview, focusCategory, focusChildNode } from './views.js';
import { renderChart, buildAdjMap } from './chart.js';

const PAPER_THRESHOLD_STEPS = [1, 10, 50, 100, 500, 1000];


// Date-range selects ----------------------------------------------------------

/** Populate the start/end month <select> elements and attach handlers. */
export function buildDateRangeControls() {
  const startSelect = document.getElementById('startMonthSelect');
  const endSelect   = document.getElementById('endMonthSelect');
  if (!startSelect || !endSelect) return;

  const options = state.dataMonths
    .map(m => `<option value="${m}">${m}</option>`)
    .join('');

  startSelect.innerHTML = options;
  endSelect.innerHTML   = options;
  startSelect.value     = state.selectedStartMonth;
  endSelect.value       = state.selectedEndMonth;

  startSelect.onchange = onDateRangeChange;
  endSelect.onchange   = onDateRangeChange;
}

export function onDateRangeChange() {
  const startSelect = document.getElementById('startMonthSelect');
  const endSelect   = document.getElementById('endMonthSelect');
  if (!startSelect || !endSelect) return;

  const s = state.dataMonths.indexOf(startSelect.value);
  const e = state.dataMonths.indexOf(endSelect.value);

  if (s <= e) {
    state.selectedStartMonth = startSelect.value;
    state.selectedEndMonth   = endSelect.value;
  } else if (startSelect === document.activeElement) {
    state.selectedStartMonth = startSelect.value;
    state.selectedEndMonth   = startSelect.value;
    endSelect.value          = state.selectedEndMonth;
  } else {
    state.selectedEndMonth   = endSelect.value;
    state.selectedStartMonth = endSelect.value;
    startSelect.value        = state.selectedStartMonth;
  }

  updateDateText();
  applyNormalizedData();
  initializeDerivedData();
  initializeRichStyles();
  goOverview();
}


// Date Text -------------------------------------------------------------------

export function updateDateText() {
  const el = document.getElementById('dateText');
  if (!el || !state.selectedStartMonth || !state.selectedEndMonth) return;
  el.textContent = state.selectedStartMonth === state.selectedEndMonth
    ? state.selectedStartMonth
    : `${state.selectedStartMonth} to ${state.selectedEndMonth}`;
}


// Sidebar toggles -------------------------------------------------------------

export function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const toggle  = document.getElementById('sidebarToggle');
  const collapsed = sidebar.classList.toggle('collapsed');
  toggle.title = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
}

export function initEdgeToggles() {
  document.getElementById('toggleIntraEdges')
    .addEventListener('change', e => {
      if (state.currentView === 'overview') {
        e.target.checked = true;  // snap it back
        return;
      }
      state.showIntraEdges = e.target.checked;
      refreshCurrentView();
    });

  document.getElementById('toggleCrossEdges')
    .addEventListener('change', e => {
      state.showCrossEdges = e.target.checked;
      refreshCurrentView();
    });
}

export function initPaperThresholdControl() {
  const slider = document.getElementById('paperThresholdSlider');
  const value  = document.getElementById('paperThresholdVal');
  if (!slider || !value) return;

  slider.min = 0;
  slider.max = PAPER_THRESHOLD_STEPS.length - 1;
  slider.step = 1;

  const initialIndex = Math.max(0, PAPER_THRESHOLD_STEPS.indexOf(state.paperThreshold));
  slider.value = String(initialIndex);
  value.textContent = `${PAPER_THRESHOLD_STEPS[initialIndex]}`;

  slider.addEventListener('input', e => {
    const idx = parseInt(e.target.value, 10);
    const next = PAPER_THRESHOLD_STEPS[idx] || PAPER_THRESHOLD_STEPS[0];
    if (next === state.paperThreshold) return;
    state.paperThreshold = next;
    value.textContent = `${next}`;
    applyNormalizedData();
    initializeDerivedData();
    initializeRichStyles();
    refreshCurrentView();
  });
}


function refreshCurrentView() {
  if (state.currentView === 'overview') return goOverview();

  if (state.currentView === 'category') {
    if (!state.catMap[state.currentCat]) {
      state.curNodes = [];
      state.curLinks = [];
      state.curAdjMap = buildAdjMap([]);
      return renderChart([], []);
    }
    return focusCategory(state.currentCat);
  }
  
  if (state.currentView === 'child') {
    if (!state.childMap[state.currentChild]) {
      state.curNodes = [];
      state.curLinks = [];
      state.curAdjMap = buildAdjMap([]);
      return renderChart([], []);
    }
    return focusChildNode(state.currentChild);
  }
}
