/* ============================================================
   chart.js — ECharts instance, rendering helpers, hover logic,
               rich-label styles, fit-screen, font-size control
   ============================================================ */

import { state, DEFAULT_FONT_SIZE } from './state.js';

let themeVars = null;

function readThemeVars() {
  const styles = getComputedStyle(document.documentElement);
  themeVars = {
    trendUp:  styles.getPropertyValue('--trend-up').trim()  || '#e84b4b',
    trendDown: styles.getPropertyValue('--trend-down').trim() || '#541ffd',
    trendFlat: styles.getPropertyValue('--trend-flat').trim() || '#94a3b8',
    chartLabel: styles.getPropertyValue('--chart-label').trim() || '#ccc',
    chartLabelDim: styles.getPropertyValue('--chart-label-dim').trim() || '#444',
    chartCount: styles.getPropertyValue('--chart-count').trim() || '#fff',
    chartCountDim: styles.getPropertyValue('--chart-count-dim').trim() || '#555',
    badgeDimText: styles.getPropertyValue('--chart-badge-dim-text').trim() || '#777',
    badgeDimBg: styles.getPropertyValue('--chart-badge-dim-bg').trim() || '#2a2a2a',
    linkCross: styles.getPropertyValue('--link-cross').trim() || 'rgba(255,255,255,0.10)',
    linkIntra: styles.getPropertyValue('--link-intra').trim() || 'rgba(255,255,255,0.12)',
    linkCrossDim: styles.getPropertyValue('--link-cross-dim').trim() || 'rgba(255,255,255,0.04)',
    linkHoverActive: styles.getPropertyValue('--link-hover-active').trim() || 'rgba(255,255,255,0.25)',
    linkHoverDim: styles.getPropertyValue('--link-hover-dim').trim() || 'rgba(255,255,255,0.02)',
    nodeDimFill: styles.getPropertyValue('--node-dim-fill').trim() || '#333',
    nodeDimBorder: styles.getPropertyValue('--node-dim-border').trim() || '#444',
    nodeHoverBorder: styles.getPropertyValue('--node-hover-border').trim() || '#fff',
    nodeHoverShadow: styles.getPropertyValue('--node-hover-shadow').trim() || '#aaa',
    extNodeFill: styles.getPropertyValue('--ext-node-fill').trim() || '#333',
    extNodeBorder: styles.getPropertyValue('--ext-node-border').trim() || '#444',
  };
}

export function refreshThemeVars() {
  readThemeVars();
  state.richStyles = buildRichStyles();
}

export function themeVar(key) {
  if (!themeVars) readThemeVars();
  return themeVars[key];
}

// ECharts instance ------------------------------------------------------------

export const echart = echarts.init(
  document.getElementById('chart'),
  null,
  { renderer: 'canvas' },
);


// Colour / size helpers -------------------------------------------------------

export function trendColor(trend) {
  if (!themeVars) readThemeVars();
  if (trend ===  1) return themeVars.trendUp;
  if (trend === -1) return themeVars.trendDown;
  return themeVars.trendFlat;
}

export function formatCount(n) {
  return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n);
}

export function nodeSize(papers, level) {

  // Set node size range at different levels
  // So nodes can't be too big that graph is dominated by super big nodes
  const minSize = level === 'overview' ? 10 : (level === 'category' ? 5 : 5);
  const maxSize = level === 'overview' ? 250 : (level === 'category' ? 70 : 70);

  // Normalization: Nodes grow in size as data grows.
  // Use relative size to keep the graph's node density consistent.

  // method 1: normalize to max in current render
//   const rangeMax = Math.max(state.nodeSizeMax || 0, 1);
//   const t = Math.sqrt(Math.max(papers, 0) / rangeMax);
//   return minSize + (maxSize - minSize) * t;

  // method 2: normalize to total in current render (stable density)
  const total = Math.max(state.nodeSizeTotal || 0, 1);
  const t = Math.sqrt(Math.max(papers, 0) / total);
  return minSize + (maxSize - minSize) * t;
}

export function circleAngles(n) {
  return Array.from({ length: n }, (_, i) => (2 * Math.PI / n * i) - Math.PI / 2);
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

function setLabelPostions(nodes, distance) {
  const rads = circleAngles(nodes.length);  // node radians from circleAngles
  nodes.forEach((node, i) => {
    
    const rad = - rads[i]; // Negative radian: measured clockwise

    // Align label either left or right of the node depending on 
    // node's position in the circular layout
    const sin = Math.sin(rad);
    // Option 1: Labels outside the ring of nodes
    let align = Math.abs(sin) < 0.01 ? 'right' : (sin >= 0 ? 'left' : 'right');
    // Option 2: Labels inside the ring of nodes
    // const align = Math.abs(sin) < 0.01 ? 'left' : (sin >= 0 ? 'right' : 'left');

    let deg = 0; // Degrees to rotate
    let placement = 'inside'; // label placed inside the node
    
    // Rotate labels radially (clockwise) if there are more than 12 nodes
    if (nodes.length > 12) {
      deg = rad * 180 / Math.PI  // convert radian to degree
      // Shift the rotation (so labels of nodes at 90 deg remain horizontal)
      deg = deg + 90;
      // switch rotation direction for nodes in the opposite part of the circular layout
      if (deg > 90 || deg < -90) deg += 180;  
    } else {
      align = 'center'; // label aligned to the center of the node
      placement = 'bottom'; // label placed below the node
    };

    node.label = {
      ...(node.label || {}),
      position: placement,
      distance, // Distance from the node, if position is set to outside (e.g. bottom)
      rotate: deg,
      align,
      verticalAlign: 'middle',
    };
  });
  return nodes;
}

function labelDistance() {
  return state.currentView === 'overview' ? 8 : 12;
}

// Rich-label helpers ----------------------------------------------------------

/**
 * Build an ECharts formatter string using the `rich` style map.
 * Optionally includes a coloured category badge below the name.
 */
export function makeLabel(name, papers, catName, catColor, dim = false) {
  const nameKey  = dim ? 'nameDim'  : 'name';
  const countKey = dim ? 'countDim' : 'count';

  let label = `{${nameKey}|${name} | }{${countKey}|${formatCount(papers)}}`;

  if (catName && catColor) {
    const badgeKey = 'badge' + catColor.replace('#', '') + (dim ? 'Dim' : '');
    label += `\n{${badgeKey}|${catName}}`;
  }

  return label;
}

/** Rebuild the `rich` style map from state.allColors. */
export function buildRichStyles() {
  if (!themeVars) readThemeVars();
  const rich = {
    name:     { fontSize: 10, color: themeVars.chartLabel, padding: [0, 0, 2, 0] },
    nameDim:  { fontSize: 10, color: themeVars.chartLabelDim, padding: [0, 0, 2, 0] },
    count:    { fontSize:  8, fontWeight: 'bold', color: themeVars.chartCount, padding: [0, 0, 2, 0] },
    countDim: { fontSize:  8, fontWeight: 'bold', color: themeVars.chartCountDim, padding: [0, 0, 2, 0] },
  };

  state.allColors.forEach(hex => {
    const key = 'badge' + hex.replace('#', '');
    rich[key] = {
      fontSize: 7, color: '#fff', backgroundColor: hex,
      borderRadius: 3, padding: [2, 5],
    };
    rich[key + 'Dim'] = {
      fontSize: 7, color: themeVars.badgeDimText, backgroundColor: themeVars.badgeDimBg,
      borderRadius: 3, padding: [2, 5],
    };
  });

  return rich;
}

/** Derive allColors from cats and (re)build richStyles. */
export function initializeRichStyles() {
  readThemeVars();
  state.allColors  = [...new Set(state.cats.map(c => c.color))];
  state.richStyles = buildRichStyles();
}


// Chart centre ----------------------------------------------------------------

export function getChartCenter() {
// Center by chart
// The right panel overlays the right ~33% of the canvas.
// Visual centre of the free area = ~33% from the left.
// When collapsed the true canvas centre (50%) is used.

  const panel = document.getElementById('right-panel');
  if (panel && panel.classList.contains('collapsed')) return ['50%', '50%'];
  return ['59%', '50%'];
}


// Core render function --------------------------------------------------------

export function renderChart(nodes, links) {
  // Check number of nodes in chart. If only 1 node, don't center by chart
  // (because the node sits at the edge of chart in circular layout)
  const isSingle = nodes.length === 1;
  const cx = window.innerWidth / window.innerHeight * 0.2 * 100 ; // calculate horizontal center

  const centerPct = isSingle ? [ `${cx}%`, '50%' ] : getChartCenter();

  const labeledNodes = setLabelPostions(nodes, labelDistance());
  const emptyMessage = 'Lower the threshold to\nsee more nodes.';

  echart.setOption({
    backgroundColor:   'transparent',
    animation:          true,
    animationDuration:  1000,
    graphic: nodes.length
      ? []
      : [{
          type: 'text',
          left: `${cx}%`,
          top: 'center',
          silent: true,
          style: {
            text: emptyMessage,
            fontSize: 17,
            fill: themeVar('chartLabelDim'),
            textAlign: 'left',
            textVerticalAlign: 'middle'
          },
        }],
    series: [{
      type:      'graph',
      layout:    'circular',
      roam:      true,
      zoom:      0.7,
      center:    centerPct,
      draggable: false,
      data:      labeledNodes,
      links,
      emphasis:  { disabled: true },
      label:     { show: true, color: themeVar('chartLabel'), fontSize: 10, silent: true}, // silent labels (i.e. no response to click)
      lineStyle: { opacity: 1 },
      symbol:    'circle',
      cursor:    'pointer',
    }],
  }, true);
}


// Hover highlighting ----------------------------------------------------------

export function applyHover(hoveredId) {
  if (!state.curNodes.length) return;

  const neighbours  = state.curAdjMap[hoveredId] || new Set();
  const highlighted = new Set([hoveredId, ...neighbours]);

  const nodes = state.curNodes.map(node => {
    const orig  = node._orig;
    const isDim = !highlighted.has(node.id);
    const tc    = trendColor(orig.trend);

    const itemStyle = isDim
      ? { color: themeVar('nodeDimFill'), borderColor: themeVar('nodeDimBorder'), borderWidth: 1, opacity: 0.12 }
      : {
          color:       tc,
          borderColor: node.id === hoveredId ? themeVar('nodeHoverBorder') : tc,
          borderWidth: node.id === hoveredId ? 3 : (orig._type === 'focus' ? 3 : 2),
          borderWidth: orig._type === 'focus' ? 3 : 2,
          opacity:     orig._type === 'ext'   ? 0.6 : 0.9,
          shadowBlur:  node.id === hoveredId ? 20 : 0,
          shadowColor: node.id === hoveredId ? themeVar('nodeHoverShadow') : 'transparent',
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
        color:     isActive ? themeVar('linkHoverActive') : themeVar('linkHoverDim'),
        curveness: link.lineStyle.curveness,
      },
      _origWidth: link._origWidth,
    };
  });

  const labeledNodes = setLabelPostions(nodes, labelDistance());
  echart.setOption({ series: [{ data: labeledNodes, links }]}, false);
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

  const labeledNodes = setLabelPostions(nodes, labelDistance());
  echart.setOption({ series: [{ data: labeledNodes, links }]}, false);
}


// Fit-screen ------------------------------------------------------------------

export function fitScreen() {

  // Check number of nodes in chart. If only 1 node, don't center by chart
  // (because the node sits at the edge of chart in circular layout)
  const isSingle = echart.getOption().series[0].data.length === 1;
  const cx = window.innerWidth / window.innerHeight * 0.2 * 100 ; // calculate horizontal center
  echart.resize();
  echart.setOption({ series: [{ 
      zoom: 0.85, 
      center: isSingle?[ `${cx}%`, '50%'] : getChartCenter()
    }] 
  });
}

// Font-size control -----------------------------------------------------------

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

  const labeledNodes = setLabelPostions(nodes, labelDistance());
  echart.setOption({ series: [{ data: labeledNodes }]}, false);
}

export function resetFontSize() {
  document.getElementById('fontSlider').value = DEFAULT_FONT_SIZE;
  updateFontSize(DEFAULT_FONT_SIZE);
}
