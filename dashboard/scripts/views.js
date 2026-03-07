/* ============================================================
   views.js — View transitions and breadcrumb navigation
   ============================================================ */

import { state, EDGE_WIDTH_SCALE } from './state.js';
import {
  echart,
  trendColor, makeLabel, nodeSize, circleAngles, buildAdjMap,
  renderChart,
} from './chart.js';
import { updateRightPanel } from './panel.js';


// ── Breadcrumb ───────────────────────────────────────────────

export function updateTreeBreadcrumb() {
  const container = document.getElementById('treeItems');
  container.innerHTML = '';

  function makeSegment(label, clickable, onclickFn) {
    const span = document.createElement('span');
    span.textContent = label;
    span.className   = 'breadcrumb-segment ' + (clickable ? 'clickable' : 'active');
    if (clickable && onclickFn) span.onclick = onclickFn;
    container.appendChild(span);
  }

  function makeSeparator() {
    const sep = document.createElement('span');
    sep.textContent = '>';
    sep.className   = 'breadcrumb-sep';
    container.appendChild(sep);
  }

  makeSegment('Overview', state.currentView !== 'overview', goOverview);

  if (state.currentView === 'category' || state.currentView === 'child') {
    makeSeparator();
    const cat = state.catMap[state.currentCat];
    makeSegment(cat.name, state.currentView === 'child', () => focusCategory(cat.id));
  }

  if (state.currentView === 'child') {
    makeSeparator();
    makeSegment(state.childMap[state.currentChild].name, false, null);
  }
}


// ── Overview ─────────────────────────────────────────────────

export function goOverview() {
  document.getElementById('toggleIntraEdges').disabled = true; // disable intra edge toggle
  state.currentView  = 'overview';
  state.currentCat   = null;
  state.currentChild = null;
  state.hoveredNode  = null;
  updateTreeBreadcrumb();

  const W  = echart.getWidth();
  const H  = echart.getHeight();
  const cx = W / 2;
  const cy = H / 2 + 20;
  const R  = Math.min(W, H) * 0.25;

  const angles = circleAngles(state.cats.length);
  const maxW   = Math.max(...state.parentEdges.map(e => e.w), 1);

  const nodes = state.cats.map((cat, i) => {
    const tc        = trendColor(cat.trend);
    const itemStyle = { color: tc, borderColor: tc, borderWidth: 2, opacity: 0.85 };
    return {
      id:         cat.id,
      symbolSize: nodeSize(cat.totalpapers, 'overview'),
      itemStyle:  { ...itemStyle },
      label: {
        show:      true,
        formatter: makeLabel(cat.name, cat.totalpapers),
        rich:      state.richStyles,
        position:  'bottom',
        distance:  5,
      },
      _catId: cat.id,
      _type:  'parent',
      _orig: {
        _catId: cat.id, _type: 'parent', trend: cat.trend,
        _name: cat.name, _papers: cat.totalpapers,
        _catName: null, _catColor: null, _dim: false,
        _itemStyle: itemStyle,
      },
    };
  });

  const visibleEdges = state.showCrossEdges ? state.parentEdges : [];
  const links = visibleEdges.map(edge => {
    const w   = Math.max(0.5, edge.w / maxW * 5 * EDGE_WIDTH_SCALE);
    const col = 'rgba(255,255,255,0.1)';
    return {
      source: edge.s, target: edge.t,
      lineStyle: { width: w, color: col, curveness: 0.15 },
      _origWidth: w, _origColor: col,
    };
  });

  state.curNodes  = nodes;
  state.curLinks  = links;
  state.curAdjMap = buildAdjMap(links);
  renderChart(nodes, links);
  updateRightPanel();
}


// ── Category focus ───────────────────────────────────────────

export function focusCategory(catId) {
  document.getElementById('toggleIntraEdges').disabled = false; // enable intra edge toggle

  state.currentView  = 'category';
  state.currentCat   = catId;
  state.currentChild = null;
  state.hoveredNode  = null;
  updateTreeBreadcrumb();

  const cat = state.catMap[catId];
  const W   = echart.getWidth();
  const H   = echart.getHeight();
  const cx  = W / 2;
  const cy  = H / 2 + 20;

  const focusIds = new Set(cat.children.map(c => c.id));

  // Edges that cross the category boundary
  const crossEdges = state.childEdges.filter(e =>
    (focusIds.has(e.s) && !focusIds.has(e.t)) ||
    (focusIds.has(e.t) && !focusIds.has(e.s))
  );

  // External L2 nodes touched by cross-edges
  const extIds = new Set();
  crossEdges.forEach(e => {
    if (!focusIds.has(e.s)) extIds.add(e.s);
    if (!focusIds.has(e.t)) extIds.add(e.t);
  });

  // Inner ring: this category's own children
  const innerR  = Math.min(W, H) * 0.13;
  const fAngles = circleAngles(cat.children.length);

  const nodes = cat.children.map((child, i) => {
    const tc        = trendColor(child.trend);
    const itemStyle = { color: tc, borderColor: tc, borderWidth: 2, opacity: 0.9 };
    return {
      id:         child.id,
      x:          cx + innerR * Math.cos(fAngles[i]),
      y:          cy + innerR * Math.sin(fAngles[i]),
      symbolSize: nodeSize(child.papers, 'category'),
      itemStyle:  { ...itemStyle },
      label: {
        show:      true,
        formatter: makeLabel(child.name, child.papers, ),
        rich:      state.richStyles,
        position:  'bottom',
        distance:  5,
      },
      _catId: catId,
      _type:  'child',
      _orig: {
        _catId:     catId,
        _type:      'child',
        trend:      child.trend,
        _name:      child.name,
        _papers:    child.papers,
        _catName:   cat.name,
        _catColor:  cat.color,
        _dim:       false,
        _itemStyle: itemStyle,
      },
    };
  });

  // Outer ring: external nodes grouped by their parent category
  const extByCat     = {};
  const outerR       = Math.min(W, H) * 0.34;

  extIds.forEach(id => {
    const cid = state.childToCat[id];
    if (!cid) return;
    if (!extByCat[cid]) extByCat[cid] = [];
    extByCat[cid].push(id);
  });

  const extCatIds    = Object.keys(extByCat);
  const extCatAngles = circleAngles(extCatIds.length);

  // Only add external nodes if cross-category links are enabled
  if (state.showCrossEdges) {
    extCatIds.forEach((ecid, ci) => {
      const group     = extByCat[ecid];
      const baseAngle = extCatAngles[ci];
      const spread    = 0.7;
      const gAngles   = group.length === 1
        ? [baseAngle]
        : group.map((_, gi) => baseAngle - spread / 2 + spread * gi / (group.length - 1));

      group.forEach((id, gi) => {
        const child     = state.childMap[id];
        const extCat    = state.catMap[ecid];
        const itemStyle = { color: '#333', borderColor: '#444', borderWidth: 1, opacity: 0.35 };
        nodes.push({
          id:         child.id,
          x:          cx + outerR * Math.cos(gAngles[gi]),
          y:          cy + outerR * Math.sin(gAngles[gi]),
          symbolSize: nodeSize(child.papers, 'category') * 0.7,
          itemStyle:  { ...itemStyle },
          label: {
            show:      true,
            formatter: makeLabel(child.name, child.papers),
            rich:      state.richStyles,
            position:  'bottom',
            distance:  5,
          },
          _catId: ecid,
          _type:  'ext',
          _orig: {
            _catId:     ecid,
            _type:      'ext',
            trend:      child.trend,
            _name:      child.name,
            _papers:    child.papers,
            _catName:   extCat.name,
            _catColor:  extCat.color,
            _dim:       true,
            _itemStyle: itemStyle,
          },
        });
      });
    });
  }

  const intraEdges        = state.childEdges.filter(e => focusIds.has(e.s) && focusIds.has(e.t));
  const visibleCrossEdges = state.showCrossEdges ? crossEdges : [];
  const visibleIntraEdges = state.showIntraEdges ? intraEdges : [];
  const allEdges          = [...visibleCrossEdges, ...visibleIntraEdges];
  const maxW              = Math.max(...allEdges.map(e => e.w), 1);

  const links = [
    ...visibleCrossEdges.map(e => {
      const w   = Math.max(0.5, e.w / maxW * 3 * EDGE_WIDTH_SCALE);
      const col = 'rgba(255,255,255,0.04)';
      return {
        source: e.s, target: e.t,
        lineStyle: { width: w, color: col, curveness: 0.1 },
        _origWidth: w, _origColor: col,
      };
    }),
    ...visibleIntraEdges.map(e => {
      const w   = Math.max(0.5, e.w / maxW * 4 * EDGE_WIDTH_SCALE);
      const col = 'rgba(255,255,255,0.12)';
      return {
        source: e.s, target: e.t,
        lineStyle: { width: w, color: col, curveness: 0.1 },
        _origWidth: w, _origColor: col,
      };
    }),
  ];

  state.curNodes  = nodes;
  state.curLinks  = links;
  state.curAdjMap = buildAdjMap(links);
  renderChart(nodes, links);
  updateRightPanel();
}


// ── Child (topic) focus ──────────────────────────────────────

export function focusChildNode(childId) {
  document.getElementById('toggleIntraEdges').disabled = false; // enable intra edge toggle

  state.currentView  = 'child';
  state.currentChild = childId;
  state.hoveredNode  = null;

  const child      = state.childMap[childId];
  const cat        = state.catMap[child.catId];
  state.currentCat = cat.id;
  updateTreeBreadcrumb();

  const connEdges = state.childEdges.filter(e => e.s === childId || e.t === childId);
  const connIds   = new Set();
  connEdges.forEach(e => { connIds.add(e.s); connIds.add(e.t); });
  connIds.delete(childId);

  const allNodes = [childId, ...[...connIds]];

  const nodes = allNodes.map(id => {
    const isFocus = id === childId;
    const c       = state.childMap[id];
    const extCat  = state.catMap[state.childToCat[id]];
    const tc      = trendColor(c.trend);
    const itemStyle = isFocus
      ? { color: tc, borderColor: tc, borderWidth: 3, opacity: 1 }
      : { color: tc, borderColor: tc, borderWidth: 1.5, opacity: 0.75 };

    return {
      id:         c.id,
      symbolSize: nodeSize(c.papers, 'child'),
      itemStyle:  { ...itemStyle },
      label: {
        show:      true,
        formatter: makeLabel(c.name, c.papers, extCat.name, extCat.color, false),
        rich:      state.richStyles,
        position:  'bottom',
        distance:  isFocus ? 8 : 5,
      },
      _catId: state.childToCat[id],
      _type:  isFocus ? 'focus' : 'conn',
      _orig: {
        _catId:     state.childToCat[id],
        _type:      isFocus ? 'focus' : 'conn',
        trend:      c.trend,
        fixed:      false,
        _name:      c.name,
        _papers:    c.papers,
        _catName:   extCat.name,
        _catColor:  extCat.color,
        _dim:       false,
        _itemStyle: itemStyle,
      },
    };
  });

  const visibleEdges = connEdges.filter(e => {
    const sameCategory = state.childToCat[e.s] === state.childToCat[e.t];
    if (sameCategory  && !state.showIntraEdges) return false;
    if (!sameCategory && !state.showCrossEdges) return false;
    return true;
  });
  const maxW  = Math.max(...visibleEdges.map(e => e.w), 1);
  const links = visibleEdges.map(e => {
    const w   = Math.max(1, e.w / maxW * 5 * EDGE_WIDTH_SCALE);
    const col = 'rgba(255,255,255,0.12)';
    return {
      source: e.s, target: e.t,
      lineStyle: { width: w, color: col, curveness: 0.1 },
      _origWidth: w, _origColor: col,
    };
  });

  state.curNodes  = nodes;
  state.curLinks  = links;
  state.curAdjMap = buildAdjMap(links);
  renderChart(nodes, links);
  updateRightPanel();
}