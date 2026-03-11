/* ============================================================
   search.js — Search modal: find and navigate to any node
   ============================================================ */

import { state }                               from './state.js';
import { trendColor, formatCount, applyHover } from './chart.js';
import { focusCategory, focusChildNode }        from './views.js';


// -- Helpers --------------------------------------------------

function getAllNodes() {
  const results = [];

  // L1 — categories
  state.cats.forEach(cat => {
    results.push({
      id:      cat.id,
      name:    cat.name,
      level:   1,
      papers:  cat.totalpapers,
      trend:   cat.trend,
      catName: null,
      catColor: null,
    });
  });

  // L2 — topics
  Object.values(state.childMap).forEach(child => {
    const cat = state.catMap[child.catId];
    results.push({
      id:       child.id,
      name:     child.name,
      level:    2,
      papers:   child.papers,
      trend:    child.trend,
      catName:  cat ? cat.name  : '',
      catColor: cat ? cat.color : '#94a3b8',
    });
  });

  return results;
}

function filterNodes(query) {
  if (!query.trim()) return [];
  const lower = query.toLowerCase();
  return getAllNodes()
    .filter(n => n.name.toLowerCase().includes(lower))
    .sort((a, b) => {
      // Exact match first, then starts-with, then contains
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      if (aName === lower && bName !== lower) return -1;
      if (bName === lower && aName !== lower) return  1;
      if (aName.startsWith(lower) && !bName.startsWith(lower)) return -1;
      if (bName.startsWith(lower) && !aName.startsWith(lower)) return  1;
      return b.papers - a.papers;  // sort by paper count as tiebreaker
    })
    .slice(0, 30);  // cap at 30 results
}


// -- Render results -------------------------------------------

function renderResults(nodes, query) {
  const container = document.getElementById('search-results');

  if (!query.trim()) {
    container.innerHTML = '';
    return;
  }

  if (!nodes.length) {
    container.innerHTML = '<p class="search-empty">No results in selected date range.</p>';
    return;
  }

  container.innerHTML = nodes.map(node => `
    <div class="search-result-row" data-id="${node.id}" data-level="${node.level}">
      <span class="search-result-dot" style="background:${trendColor(node.trend)}"></span>
      <span class="search-result-name">${highlightMatch(node.name, query)}</span>
      <span class="search-result-papers">${formatCount(node.papers)}</span>
      ${node.catName
        ? `<span class="search-result-badge" style="background:${node.catColor}">${node.catName}</span>`
        : `<span class="search-result-badge search-result-badge--category">Category</span>`
      }
    </div>
  `).join('');

  // Attach click handlers
  container.querySelectorAll('.search-result-row').forEach(row => {
    row.addEventListener('click', () => {
      const id    = row.dataset.id;
      const level = parseInt(row.dataset.level, 10);
      closeSearch();
      navigateToNode(id, level);
    });
  });
}

/** Wrap matched substring in a highlight span */
function highlightMatch(name, query) {
  const idx = name.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return name;
  return (
    name.slice(0, idx) +
    `<mark class="search-highlight">${name.slice(idx, idx + query.length)}</mark>` +
    name.slice(idx + query.length)
  );
}


// -- Navigation -----------------------------------------------

function navigateToNode(id, level) {
  if (level === 1) {
    focusCategory(id);
  } else {
    focusChildNode(id);
  }

  // Only hightlight nodes when a level 2 node (topic node) is selected
  if (level === 2) {
    // Delay node highlight so the chart has finished rendering and animation
    requestAnimationFrame(() => {
        setTimeout(() => {
        state.hoveredNode = id;
        applyHover(id);
        }, 500);
    });
  }

}

// Select result by keyboard Up/Down arrows
let selectedIndex = -1;
function updateSelection(rows) {
  rows.forEach((row, i) => {
    row.classList.toggle('search-result-selected', i === selectedIndex);
    if (i === selectedIndex) row.scrollIntoView({ block: 'nearest' });
  });
}

document.getElementById('search-input').addEventListener('keydown', e => {
  const rows = [...document.querySelectorAll('.search-result-row')];
  if (!rows.length) return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    selectedIndex = Math.min(selectedIndex + 1, rows.length - 1);
    updateSelection(rows);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    selectedIndex = Math.max(selectedIndex - 1, 0);
    updateSelection(rows);
  } else if (e.key === 'Enter' && selectedIndex >= 0) {
    e.preventDefault();
    rows[selectedIndex].click();
  }
});

// -- Open / close ---------------------------------------------

function openSearch() {
  document.getElementById('search-overlay').classList.add('active');
  document.getElementById('search-input').value = '';
  document.getElementById('search-results').innerHTML = '';
  setTimeout(() => document.getElementById('search-input').focus(), 50);
}

function closeSearch() {
  document.getElementById('search-overlay').classList.remove('active');
}


// -- Init -----------------------------------------------------

export function initSearch() {
  document.getElementById('searchBtn')
    .addEventListener('click', openSearch);

  document.getElementById('search-backdrop')
    .addEventListener('click', closeSearch);

  document.getElementById('search-input')
    .addEventListener('input', e => {
      const query   = e.target.value;
      const results = filterNodes(query);
      renderResults(results, query);
    });

  // Keyboard shortcuts: Ctrl+K to Open; Esc to close
  document.addEventListener('keydown', e => {

    // Cmd+K or Ctrl+K
    if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();  // prevent browser default (e.g. focus address bar)
        document.getElementById('search-overlay').classList.contains('active')
        ? closeSearch()
        : openSearch();
    }
    
    // Escape
    if (e.key === 'Escape') closeSearch();

  });
}
