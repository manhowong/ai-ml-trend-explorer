# AI / ML Trend Explorer

An interactive graph visualisation of AI/ML research trends derived from arXiv paper statistics. Topics are grouped into categories, connected by co-occurrence edges, and colour-coded by trend direction (heating up / cooling off / stable).

**ATTENTION**: The [live demo](https://manhowong.github.io/ai-ml-trend-explorer/) uses mock data.

---

## Architecture

```mermaid
flowchart TD
    HTML["index.html\nMarkup + ECharts CDN"]
    MAIN["main.js\nEntry point"]
    STATE["state.js\nShared mutable state\n& constants"]
    DATA["data.js\nFetch · Normalise\nDerived lookups"]
    CHART["chart.js\nECharts instance\nRender · Hover\nFit · Font size"]
    VIEWS["views.js\ngoOverview\nfocusCategory\nfocusChildNode\nBreadcrumb"]
    PANEL["panel.js\nRight-panel renderers\nSort controls"]
    CONTROLS["controls.js\nDate-range selects\nSidebar toggle\nSubheading"]
    META["data/metadata.json\nNode taxonomy"]
    TS["data/timeseries.json\nMonthly volumes\nKeywords · Edges"]

    HTML -->|"type=module"| MAIN

    MAIN -->|imports| STATE
    MAIN -->|imports| DATA
    MAIN -->|imports| CHART
    MAIN -->|imports| VIEWS
    MAIN -->|imports| PANEL
    MAIN -->|imports| CONTROLS
    MAIN -->|"window.* globals\nfor inline onclick"| HTML

    DATA -->|reads/writes| STATE
    CHART -->|reads/writes| STATE
    VIEWS -->|reads/writes| STATE
    PANEL -->|reads| STATE
    CONTROLS -->|reads/writes| STATE

    VIEWS -->|calls| CHART
    VIEWS -->|calls| PANEL
    CONTROLS -->|calls| DATA
    CONTROLS -->|calls| CHART
    CONTROLS -->|calls| VIEWS

    DATA -->|fetch| META
    DATA -->|fetch| TS
```

### Module responsibilities

| Module | Responsibility |
|---|---|
| `main.js` | Boots the app; wires all DOM and ECharts event listeners; exposes five functions as `window` globals for use in panel-generated HTML |
| `state.js` | Single `state` object holding all mutable data — raw JSON, derived maps, view state, sort modes, font size, rich styles |
| `data.js` | Fetches JSON; computes per-node paper volumes and hotness over the selected date range; builds `childEdges`, `keywordData`, and the category-level `parentEdges` lookup |
| `chart.js` | Owns the ECharts instance; provides `renderChart`, `applyHover`/`clearHover`, `fitScreen`, `updateFontSize`, rich-label helpers (`makeLabel`, `buildRichStyles`) |
| `views.js` | Implements the three views (`goOverview`, `focusCategory`, `focusChildNode`); places nodes on circular layouts and assembles link lists; updates the breadcrumb |
| `panel.js` | Renders the right-panel info boxes and sort dropdowns for each view; exposes `setSortMode` which is called from inline `onchange` handlers in generated HTML |
| `controls.js` | Manages the date-range `<select>` elements and triggers a full data re-derive + re-render on change; handles sidebar collapse and the subheading text |

## Data Flow

```mermaid
sequenceDiagram
    actor User
    participant main.js
    participant data.js
    participant state.js
    participant views.js
    participant chart.js
    participant panel.js

    main.js->>data.js: loadData()
    data.js->>state.js: store rawMetadata, rawTimeseries
    main.js->>data.js: applyNormalizedData()
    data.js->>state.js: write cats, childEdges, keywordData
    main.js->>data.js: initializeDerivedData()
    data.js->>state.js: write childMap, catMap, parentEdges
    main.js->>chart.js: initializeRichStyles()
    main.js->>views.js: goOverview()
    views.js->>state.js: update currentView, curNodes, curLinks
    views.js->>chart.js: renderChart(nodes, links)
    views.js->>panel.js: updateRightPanel()

    User->>chart.js: click node
    chart.js->>views.js: focusCategory() or focusChildNode()
    views.js->>chart.js: renderChart(nodes, links)
    views.js->>panel.js: updateRightPanel()

    User->>panel.js: change sort dropdown
    panel.js->>state.js: update level1/2SortMode
    panel.js->>panel.js: updateRightPanel()
```

## Getting Started

The app fetches JSON at runtime so it must be served over HTTP — opening `index.html` directly as a `file://` URL will not work.

Any static file server will do:

```bash
# Python
python -m http.server 8080

# Node (npx)
npx serve .

# VS Code
# Use the Live Server extension
```

Then open `http://localhost:8080` in your browser.

## Adding Data

- **`data/metadata.json`** — defines the node taxonomy. Each node needs `L` (level: 1 or 2), `N` (name), and for L2 nodes `P` (parent category id).
- **`data/timeseries.json`** — keyed by month string (`"YYYY-MM"`). Each month contains `nodes_L1`, `nodes_L2` (with `V` monthly volume and `VC` cumulative volume), `links` (with `S`, `T`, `J` Jaccard similarity), and per-node `K` keyword arrays.
