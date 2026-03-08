/* ============================================================
   controls.js — Sidebar UI: date-range, dateText, toggle
   ============================================================ */

import { state } from './state.js';
import { applyNormalizedData, initializeDerivedData } from './data.js';
import { initializeRichStyles } from './chart.js';
import { goOverview, focusCategory, focusChildNode } from './views.js';


// ── Date-range selects ───────────────────────────────────────

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


// ── Date Text ────────────────────────────────────────────────

export function updateDateText() {
  const el = document.getElementById('dateText');
  if (!el || !state.selectedStartMonth || !state.selectedEndMonth) return;
  el.textContent = state.selectedStartMonth === state.selectedEndMonth
    ? state.selectedStartMonth
    : `${state.selectedStartMonth} to ${state.selectedEndMonth}`;
}


// ── Sidebar toggles ──────────────────────────────────────────

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


function refreshCurrentView() {
  if      (state.currentView === 'overview') goOverview();
  else if (state.currentView === 'category') focusCategory(state.currentCat);
  else if (state.currentView === 'child')    focusChildNode(state.currentChild);
}