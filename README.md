# FloodOne — Flood Response Intelligence

> **"See the flood signal. Find who is cut off."**

FloodOne is an operational, explainable flood-screening intelligence application built to turn Sentinel-1 Synthetic Aperture Radar (SAR) change signals into a ranked, transparent rescue-priority queue for disaster responders, NGOs, and field coordinators.

---

## 🌊 Overview & Core Mission

After major flooding events, emergency response teams rarely suffer from a lack of raw satellite maps — rather, they suffer from a lack of connectivity intelligence:
1. Satellite change maps stop at **"water here"**;
2. Responders cannot tell **which remote settlements have lost vehicular access to critical healthcare or emergency shelters**;
3. Responders need to know **who to reach first and why**.

FloodOne bridges this gap through a 4-stage browser-native spatial intelligence pipeline:
- **Stage 1 (SAR Change Mask)**: Computes differential backscatter ($\Delta \text{dB} = \text{Post}_{\text{dB}} - \text{Pre}_{\text{dB}}$) on Sentinel-1 VV/VH imagery. Specular reflection off open floodwaters produces an explainable, adjustable backscatter drop (default $\le -3.0\text{ dB}$).
- **Stage 2 (Road Submergence)**: Cross-indexes road networks with the flood mask using an R-Bush spatial index. Segments with submerged fractions exceeding the threshold (default 30%) are flagged as impassable.
- **Stage 3 (Graph Isolation)**: Executes multi-source Dijkstra reachability from all regional hospitals and emergency shelters over passable edges, isolating communities that have completely lost connectivity.
- **Stage 4 (Explainable Prioritization)**: Generates a prioritized response queue with transparent, human-readable rationale:
  $$\text{Score} = w_P \cdot \text{norm}(\text{Pop}) + w_U \cdot \text{norm}(\text{Urgency}) + w_D \cdot \text{norm}(\text{Distance}) + \text{ISOLATION\_BONUS}$$

---

## ⚡ Key Capabilities (MVP v1.0)

- **Instant Zero-Upload Benchmark**: Auto-loads a deterministic, seeded synthetic practice scenario (12×12 km river valley, 10 communities, 2 hospitals, 2 shelters, 80+ road segments) with an amber disclaimer banner.
- **Client-Side Privacy**: 100% in-browser processing via Web Workers. No satellite imagery, road networks, or community coordinates ever leave the user's device.
- **Real Operational Data Ingestion**:
  - Drag-and-drop pre/post Sentinel-1 GeoTIFFs with automated CRS detection (WGS84, UTM via `proj4`), dimensions compatibility checks, and memory protection (automatic downsampling if $> 25\text{ Mpx}$).
  - Drag-and-drop GeoJSON roads, communities, and facilities with Zod-based schema validation and actionable fix instructions.
- **Live Interactive Tuning**: Debounced live threshold slider ($\le 300\text{ ms}$) dynamically recomputes road submergence and priority queues.
- **Rich Cartographic UI with CARTO Platform**: MapLibre GL JS engine powered by high-resolution authenticated **CARTO basemaps** (Dark Matter, Positron, Voyager) with live style switching, dynamic canvas raster mask overlay, vermilion cut-road highlights, and individual community evidence cards.
- **CARTO API Key Integration**: Seamless API authentication (`VITE_CARTO_API_KEY`) for crisp `@2x` retina tiles and high-throughput tilesets across field operations.
- **Hardened Reporting**: One-click exports to CSV (with formula-injection guards) and RFC 7946 GeoJSON.

---

## 🔬 Scientific Honesty & Caveats

- **Exploratory Screening Signal**: All outputs are strictly labeled as screening signals, **never validated flood truth**.
- **Radar SAR Physics**: Specular reflection over open water creates backscatter drops, but is subject to false positives (calm water surfaces, airport runways, radar shadow) and false negatives (flooded dense vegetation or urban double-bounce).
- **Mandatory Verification**: Always verify road accessibility with ground reconnaissance or aerial spotters before physical asset deployment.

---

## 🚀 Quickstart & Development

### Requirements
- Node.js $\ge 18$
- npm $\ge 9$ or pnpm

### Installation
```bash
npm install
```

### Run Locally
```bash
# Starts local Vite development server on port 3000
npm run dev:static
```

### Run Tests
```bash
# Executes pure TypeScript Vitest test suite
npm test
```

### TypeScript Verification
```bash
npm run check
```

### Production Build
```bash
npm run build
```

---

## 📂 Architecture & Directory Structure

```
client/src/
  ├── components/
  │    ├── brand/FloodOneLogo.tsx            # F-channel bridge logo
  │    ├── common/ErrorBoundary.tsx          # Resilient crash boundary
  │    ├── flood/
  │    │    ├── CaveatBanner.tsx             # Scientific disclaimer strip
  │    │    ├── ExportDialog.tsx             # CSV & GeoJSON export modal
  │    │    ├── HelpModal.tsx                # Methodology guide
  │    │    ├── ImpactDetail.tsx             # Selected community evidence card
  │    │    ├── ImportPanel.tsx              # Drag-and-drop validation modal
  │    │    ├── LayerPanel.tsx               # Map visibility switches
  │    │    ├── ProvenanceChip.tsx           # Synthetic / Imported / Computed chips
  │    │    ├── QueueList.tsx                # Priority response queue
  │    │    └── ThresholdControl.tsx         # dB slider and live metrics
  │    └── map/
  │         ├── FloodMap.tsx                 # MapLibre GL JS engine & canvas mask
  │         └── Legend.tsx                   # Symbology card
  ├── features/flood/
  │    ├── __tests__/floodEngine.test.ts     # Pure TS test suite
  │    ├── analysis.worker.ts               # Background web worker
  │    ├── constants.ts                     # Defaults and copy
  │    ├── exports.ts                       # CSV injection guard & GeoJSON export
  │    ├── importers.ts                     # GeoTIFF parser & compatibility check
  │    ├── isolation.ts                     # Multi-source Dijkstra reachability
  │    ├── ranking.ts                       # Weighted scoring & plain-English reasons
  │    ├── rasterChange.ts                  # dB difference & thresholding
  │    ├── roadImpact.ts                    # RBush spatial line-sampling
  │    ├── sampleScenario.ts                # Mulberry32 seeded PRNG benchmark
  │    ├── store.tsx                        # React state management
  │    ├── types.ts                         # Domain contracts & interfaces
  │    └── validation.ts                    # Zod GeoJSON schema validator
  ├── pages/Home.tsx                        # Master mission-control dashboard
  ├── App.tsx                               # Application root
  ├── index.css                             # Cartographic dark theme tokens
  └── main.tsx                              # Entry point
```

---

## 📜 Specifications
See the included reference documents for complete details:
- `01_PRD.md` — Product Requirements Document
- `02_TRD.md` — Technical Requirements Document
- `03_UIUX_FLOW.md` — UI/UX Design System & Flow
- `04_AUTH_FLOW.md` — Authentication & Authorization Roadmap
- `05_SECURITY_PLAN.md` — STRIDE Threat Model & Security Controls
- `06_IMPLEMENTATION_PLAN.md` — Milestones & Work Breakdown
