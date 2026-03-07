/* ============================================================
   chart.js — ECharts instance, rendering helpers, hover logic,
               rich-label styles, fit-screen, font-size control
   ============================================================ */

import { state, DEFAULT_FONT_SIZE } from './state.js';

// ── ECharts instance ─────────────────────────────────────────

export const echart = echarts.init(
  document.getElementById('chart'),
  null,
  { renderer: 'canvas' },
);


// ── Colour / size helpers ────────────────────────────────────

export function trendColor(trend) {
  if (trend ===  1) return '#e84b4b';
  if (trend === -1) return '#541ffd';
  return '#94a3b8';
}

export function formatCount(n) {
  return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n);
}

export function nodeSize(papers, level) {
  if (level === 'overview')  return Math.sqrt(papers) * 0.45 + 18;
  if (level === 'category')  return Math.sqrt(papers) * 0.45 + 12;
  return Math.sqrt(papers) * 0.5 + 14;
}

export function circleAngles(n) {
  return Array.from({ length: n }, (_, i) => (2 * Math.PI * i / n) - Math.PI / 2);
}

export function buildAdjMap(links) {
  const map = {};
  links.forEach(link => {
    const s = typeof link.source === 'string' ? link.source : (link.source.id || link.source);
    const t = typeof link.target === 'string' ? link.target : (link.target.id || link.target);
    if (!map[s]) map[s] = new Set();
    if (!map[t]) map[t] = new Set();
    map[s].add(t);
    map[t].add(s);
  });
  return map;
}


// ── Rich-label helpers ───────────────────────────────────────

/**
 * Build an ECharts formatter string using the `rich` style map.
 * Optionally includes a coloured category badge below the name.
 */
export function makeLabel(name, papers, catName, catColor, dim = false) {
  const nameKey  = dim ? 'nameDim'  : 'name';
  const countKey = dim ? 'countDim' : 'count';

  let label = `{${nameKey}|${name}}\n{${countKey}|${formatCount(papers)}}`;

  if (catName && catColor) {
    const badgeKey = 'badge' + catColor.replace('#', '') + (dim ? 'Dim' : '');
    label += `\n{${badgeKey}|${catName}}`;
  }

  return label;
}

/** Rebuild the `rich` style map from state.allColors. */
export function buildRichStyles() {
  const rich = {
    name:     { fontSize: 10, color: '#ccc', padding: [0, 0, 2, 0], align: 'center' },
    nameDim:  { fontSize: 10, color: '#444', padding: [0, 0, 2, 0], align: 'center' },
    count:    { fontSize:  8, fontWeight: 'bold', color: '#fff', padding: [0, 0, 2, 0], align: 'center' },
    countDim: { fontSize:  8, fontWeight: 'bold', color: '#555', padding: [0, 0, 2, 0], align: 'center' },
  };

  state.allColors.forEach(hex => {
    const key = 'badge' + hex.replace('#', '');
    rich[key] = {
      fontSize: 7, color: '#fff', backgroundColor: hex,
      borderRadius: 3, padding: [2, 5], align: 'center',
    };
    rich[key + 'Dim'] = {
      fontSize: 7, color: '#777', backgroundColor: '#2a2a2a',
      borderRadius: 3, padding: [2, 5], align: 'center',
    };
  });

  return rich;
}

/** Derive allColors from cats and (re)build richStyles. */
export function initializeRichStyles() {
  state.allColors  = [...new Set(state.cats.map(c => c.color))];
  state.richStyles = buildRichStyles();
}


// ── Chart centre ─────────────────────────────────────────────

/**
 * The right panel overlays the right ~33% of the canvas.
 * Visual centre of the free area = ~33% from the left.
 * When collapsed the true canvas centre (50%) is used.
 */
export function getChartCenter() {
  const panel = document.getElementById('right-panel');
  if (panel && panel.classList.contains('collapsed')) return ['50%', '50%'];
  return ['59%', '50%'];
}


// ── Core render function ─────────────────────────────────────

export function renderChart(nodes, links) {
  echart.setOption({
    backgroundColor:   '#0f1117',
    animation:          true,
    animationDuration:  1000,
    series: [{
      type:      'graph',
      layout:    'circular',
      roam:      true,
      zoom:      0.85,
      center:    getChartCenter(),
      draggable: false,
      data:      nodes,
      links,
      emphasis:  { disabled: true },
      label:     { show: true, color: '#ccc', fontSize: 10 },
      lineStyle: { opacity: 1 },
      symbol:    'circle',
      cursor:    'pointer',
    }],
  }, true);
}


// ── Hover highlighting ───────────────────────────────────────

export function applyHover(hoveredId) {
  if (!state.curNodes.length) return;

  const neighbours  = state.curAdjMap[hoveredId] || new Set();
  const highlighted = new Set([hoveredId, ...neighbours]);

  const nodes = state.curNodes.map(node => {
    const orig  = node._orig;
    const isDim = !highlighted.has(node.id);
    const tc    = trendColor(orig.trend);

    const itemStyle = isDim
      ? { color: '#333', borderColor: '#444', borderWidth: 1, opacity: 0.12 }
      : {
          color:       tc,
          borderColor: node.id === hoveredId ? '#fff' : tc,
          borderWidth: node.id === hoveredId ? 3 : (orig._type === 'focus' ? 3 : 2),
          borderWidth: orig._type === 'focus' ? 3 : 2,
          opacity:     orig._type === 'ext'   ? 0.6 : 0.9,
          shadowBlur:  node.id === hoveredId ? 20 : 0,
          shadowColor: node.id === hoveredId ? '#aaa' : 'transparent',
        };

    return {
      id:         node.id,
      fixed:      orig.fixed,
      symbolSize: node.symbolSize,
      itemStyle,
      label: {
        show:      true,
        formatter: makeLabel(orig._name, orig._papers, orig._catName, orig._catColor, isDim),
        rich:      state.richStyles,
        position:  'bottom',
        distance:  orig._type === 'focus' ? 8 : 5,
      },
      _catId: orig._catId,
      _type:  orig._type,
      _orig:  orig,
    };
  });

  const links = state.curLinks.map(link => {
    const isActive = highlighted.has(link.source) && highlighted.has(link.target);
    return {
      source: link.source,
      target: link.target,
      lineStyle: {
        width:     isActive ? link._origWidth * 1.3 : 0.3,
        color:     isActive ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.02)',
        curveness: link.lineStyle.curveness,
      },
      _origWidth: link._origWidth,
    };
  });

  echart.setOption({ series: [{ data: nodes, links }] }, false);
}

export function clearHover() {
  if (!state.curNodes.length) return;

  const nodes = state.curNodes.map(node => {
    const orig = node._orig;
    return {
      id:         node.id,
      fixed:      orig.fixed,
      symbolSize: node.symbolSize,
      itemStyle:  { ...orig._itemStyle },
      label: {
        show:      true,
        formatter: makeLabel(orig._name, orig._papers, 
                     state.currentView === 'child' ? orig._catName : null, 
                     state.currentView === 'child' ? orig._catColor : null, 
                     orig._dim),
        rich:      state.richStyles,
        position:  'bottom',
        distance:  orig._type === 'focus' ? 8 : 5,
      },
      _catId: orig._catId,
      _type:  orig._type,
      _orig:  orig,
    };
  });

  const links = state.curLinks.map(link => ({
    source: link.source,
    target: link.target,
    lineStyle: {
      width:     link._origWidth,
      color:     link._origColor,
      curveness: link.lineStyle.curveness,
    },
    _origWidth: link._origWidth,
    _origColor: link._origColor,
  }));

  echart.setOption({ series: [{ data: nodes, links }] }, false);
}


// ── Fit-screen ───────────────────────────────────────────────

export function fitScreen() {
  echart.resize();
  echart.setOption({ series: [{ zoom: 0.85, center: getChartCenter() }] });
}

// ── Font-size control ────────────────────────────────────────

export function updateFontSize(size) {
  state.currentFontSize = parseInt(size, 10);
  document.getElementById('fontSizeVal').textContent = size + 'px';

  state.richStyles.name.fontSize     = state.currentFontSize;
  state.richStyles.count.fontSize    = Math.max(6, state.currentFontSize - 2);
  state.richStyles.countDim.fontSize = Math.max(6, state.currentFontSize - 2);

  Object.keys(state.richStyles).forEach(key => {
    if (key.startsWith('badge')) {
      state.richStyles[key].fontSize = Math.max(6, state.currentFontSize - 2);
    }
  });

  const nodes = state.curNodes.map(({ x, y, ...node }) => ({
    ...node,
    label: { ...node.label, fontSize: state.currentFontSize, rich: state.richStyles },
  }));

  echart.setOption({ series: [{ data: nodes }] }, false);
}

export function resetFontSize() {
  document.getElementById('fontSlider').value = DEFAULT_FONT_SIZE;
  updateFontSize(DEFAULT_FONT_SIZE);
}