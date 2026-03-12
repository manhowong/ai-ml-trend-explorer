/* ============================================================
   panel.js — Right-panel renderers and sort-control helpers
   ============================================================ */

import { state } from './state.js';
import { trendColor, formatCount, makeLabel } from './chart.js';


// ── Generic panel helpers ────────────────────────────────────

export function setPanelContent(boxId, title, sortHTML, contentHTML) {
  document.getElementById(boxId + '-title').textContent = title;
  document.getElementById(boxId + '-sort').innerHTML    = sortHTML;
  document.getElementById(boxId + '-content').innerHTML = contentHTML;
}

/** Called from inline onchange="setSortMode(...)" in generated HTML. */
export function setSortMode(level, mode) {
  if (level === 1) state.level1SortMode = mode;
  if (level === 2) state.level2SortMode = mode;
  updateRightPanel();
}

export function buildSortDropdown(level, modes, activeMode) {
  const labelMap = { papers: '# articles', hotness: 'hotness', links: '# links' };
  const options  = modes.map(mode => `
      <option value="${mode}" ${activeMode === mode ? 'selected' : ''}>
        ${labelMap[mode] || mode}
      </option>`).join('');

  return `
    <div class="sort-select-wrap">
      <select id="sort-select-level-${level}" class="sort-select"
              onchange="setSortMode(${level}, this.value)">
        ${options}
      </select>
    </div>`;
}

export function formatMetricValue(mode, value) {
  if (mode === 'hotness') return value > 0 ? `+${value}` : String(value);
  return formatCount(value);
}

export function metricBarWidths(mode, values) {
  if (!values.length) return [];
  if (mode === 'hotness') {
    const minV = Math.min(...values), maxV = Math.max(...values);
    if (maxV === minV) return values.map(() => 100);
    return values.map(v => Math.round((v - minV) / (maxV - minV) * 100));
  }
  const maxV = Math.max(...values, 1);
  return values.map(v => Math.round(v / maxV * 100));
}


// ── Overview panel ───────────────────────────────────────────

export function renderOverviewPanel() {
  const sorted = [...state.cats].sort((a, b) =>
    state.level1SortMode === 'hotness'
      ? b.hotness - a.hotness
      : b.totalpapers - a.totalpapers
  );

  const metricValues = sorted.map(cat =>
    state.level1SortMode === 'hotness' ? cat.hotness : cat.totalpapers
  );
  const barWidths    = metricBarWidths(state.level1SortMode, metricValues);
  const sortDropdown = buildSortDropdown(1, ['papers', 'hotness'], state.level1SortMode);

  const topHTML = `
    <div class="ranked-list">
      ${sorted.map((cat, i) => `
        <div class="ranked-row" data-id="${cat.id}"
            onmouseenter="applyHover('${cat.id}')" onmouseleave="clearHover()"
            onclick="focusCategory('${cat.id}')" style="cursor:pointer">
          <span class="rank-num">${i + 1}</span>
          <span class="rank-dot" style="background:${trendColor(cat.trend)}"></span>
          <span class="rank-name">${cat.name}</span>
          <span class="rank-count">${formatMetricValue(state.level1SortMode, metricValues[i])}</span>
          <div class="rank-bar-wrap"><div class="rank-bar" style="width:${barWidths[i]}%"></div></div>
        </div>`).join('')}
    </div>`;

  const bottomHTML = `
    <div class="instructions">
      <span>AI/ML topics are grouped by categories.</span>
      <ul class="bullet-list">
        <li><b>Click a node</b> (or <b>tap twice</b> on mobile) to go down a level.</li>
        <li><b>Double-click</b> on empty canvas (or <b>long-press</b> on mobile) to navigate back up.</li>
        <li><b>Hover</b> over a node (or <b>tap</b> on mobile) to highlight its links.</li>
        <li><b>Select a date range</b> (> 1 month) to see trends.</li>
        <li>You may also select a node by tapping on it in the <b>node list</b>.</li>
      </ul>
    </div>`;

  setPanelContent('info-top',    'Categories', sortDropdown, topHTML);
  setPanelContent('info-bottom', 'How to Use', '',           bottomHTML);
}


// ── Category panel ───────────────────────────────────────────

export function renderCategoryPanel() {
  const cat = state.catMap[state.currentCat];

  const connCount = {};
  cat.children.forEach(ch => {
    connCount[ch.id] = state.childEdges.filter(e => e.s === ch.id || e.t === ch.id).length;
  });

  const sorted = [...cat.children].sort((a, b) => {
    if (state.level2SortMode === 'papers')      return b.papers       - a.papers;
    if (state.level2SortMode === 'hotness')     return b.hotness      - a.hotness;
    if (state.level2SortMode === 'links') return connCount[b.id] - connCount[a.id];
    return 0;
  });

  const metricValues = sorted.map(child => {
    if (state.level2SortMode === 'papers')      return child.papers;
    if (state.level2SortMode === 'hotness')     return child.hotness;
    if (state.level2SortMode === 'links') return connCount[child.id];
    return child.papers;
  });
  const barWidths    = metricBarWidths(state.level2SortMode, metricValues);
  const sortDropdown = buildSortDropdown(2, ['papers', 'hotness', 'links'], state.level2SortMode);

  const topHTML = `
    <div class="ranked-list">
      ${sorted.map((child, i) => `
        <div class="ranked-row" data-id="${child.id}"
            onmouseenter="applyHover('${child.id}')" onmouseleave="clearHover()"
            onclick="focusChildNode('${child.id}')" style="cursor:pointer">
          <span class="rank-num">${i + 1}</span>
          <span class="rank-dot" style="background:${trendColor(child.trend)}"></span>
          <span class="rank-name">${child.name}</span>
          <span class="rank-count">${formatMetricValue(state.level2SortMode, metricValues[i])}</span>
          <div class="rank-bar-wrap"><div class="rank-bar" style="width:${barWidths[i]}%"></div></div>
        </div>`).join('')}
    </div>`;

  setPanelContent('info-top',    'Topics',              sortDropdown,                                      topHTML);
  setPanelContent('info-bottom', 'Unclassified Topics', '<span class="rank-bar-title"># articles</span>',   '<p class="empty-state">None</p>');
}


// ── Child (topic) panel ──────────────────────────────────────

export function renderChildPanel() {
  const keywords = (state.keywordData[state.currentChild] || []).slice();
  keywords.sort((a, b) => b.papers - a.papers);
  const kwMetrics  = keywords.map(kw => kw.papers);
  const kwBars     = metricBarWidths('papers', kwMetrics);

  const topHTML = keywords.length
    ? `<div class="ranked-list">
        ${keywords.map((kw, i) => `
          <div class="ranked-row">
            <span class="rank-num">${i + 1}</span>
            <span class="rank-dot" style="background:${trendColor(kw.trend)}"></span>
            <span class="rank-name">${kw.name}</span>
            <span class="rank-count">${formatMetricValue('papers', kwMetrics[i])}</span>
            <div class="rank-bar-wrap"><div class="rank-bar" style="width:${kwBars[i]}%"></div></div>
          </div>`).join('')}
       </div>`
    : '<p class="empty-state">No keyword data available.</p>';

  const connEdges = state.childEdges
    .filter(e => e.s === state.currentChild || e.t === state.currentChild)
    .sort((a, b) => b.w - a.w);

  const maxW = Math.max(...connEdges.map(e => e.w), 1);

  const bottomHTML = connEdges.length
    ? `<div class="ranked-list">
        ${connEdges.map((e, i) => {
          const connId   = e.s === state.currentChild ? e.t : e.s;
          const connNode = state.childMap[connId];
          if (!connNode) return '';
          return `
            <div class="ranked-row" data-id="${connId}"
                onmouseenter="applyHover('${connId}')" onmouseleave="clearHover()"
                onclick="focusChildNode('${connId}')" style="cursor:pointer">
              <span class="rank-num">${i + 1}</span>
              <span class="rank-dot" style="background:${trendColor(connNode.trend)}"></span>
              <span class="rank-name">${connNode.name}</span>
              <span class="rank-count">${(e.w * 100).toFixed(1)} %</span>
              <div class="rank-bar-wrap"><div class="rank-bar" style="width:${Math.round(e.w / maxW * 100)}%"></div></div>
            </div>`;
        }).join('')}
       </div>`
    : '<p class="empty-state">No related topics found.</p>';

  setPanelContent('info-top',    'Keywords',       '<span class="rank-bar-title"># articles</span>',      topHTML);
  setPanelContent('info-bottom', 'Overlapping Topics', '<span class="rank-bar-title">Overlap score (DSC)</span>', bottomHTML);
}


// ── Dispatcher ───────────────────────────────────────────────

export function updateRightPanel() {
  if (state.currentView === 'overview') renderOverviewPanel();
  if (state.currentView === 'category') renderCategoryPanel();
  if (state.currentView === 'child')    renderChildPanel();
}