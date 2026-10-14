# FloodOne — Technical Requirements Document (TRD)

| Field | Value |
|---|---|
| Companion to | `01_PRD.md` |
| Baseline | Starter in `floodone.zip` (Manus `web-db-user` template) |

---

## 1. Current Baseline (what is already in the repo)

| Layer | What exists |
|---|---|
| Frontend | React 19, TypeScript 5.9, Vite 7, Tailwind 4, wouter, shadcn/Radix UI kit (`client/src/components/ui/*`), Lucide, Recharts, Framer Motion, sonner |
| API | Express 4 + tRPC 11 (`/api/trpc`), superjson, zod 4 |
| Database | Drizzle ORM + MySQL (`mysql2`); only a `users` table exists |
| Auth | Manus OAuth + JWT (`jose`, HS256) session cookie; `protectedProcedure` / `adminProcedure` |
| Storage | S3 presign via Forge API (`server/storage.ts`, `/manus-storage/*` proxy) |
| Jobs | Heartbeat cron helper (`server/_core/heartbeat.ts`, callbacks under `/api/scheduled/`) |
| Tests | Vitest (`server/*.test.ts`) |
| Build | `pnpm build` → Vite client + esbuild server bundle → `dist/`; Dockerfile (Node 22) |
| Existing map component | `client/src/components/Map.tsx` wraps **Google Maps** (needs platform key). `plan.md` calls for OSM, so FloodOne needs a new map component |

**Not yet present (must be added):** geospatial libraries, all `features/flood/*` modules, Home page, brand CSS, route manifest `public/manus-routes.json` (referenced by plan.md but not in the zip).

---

## 2. Architecture Decision

### Phase 1 (MVP) — **Static, client-side analysis**
All file parsing and analysis run in the browser. The Express/tRPC/MySQL stack stays dormant (no feature routers), so uploads never leave the device.

```
┌─────────────────────────── Browser ───────────────────────────┐
│  React UI (Home.tsx)                                          │
│   ├─ Map (MapLibre GL / Leaflet + OSM tiles)                  │
│   ├─ Layer panel · Threshold slider · Ranked queue · Exports  │
│   └─ State store (zustand-style context or useReducer)        │
│                          │ postMessage                        │
│  ┌───────────────────────▼────────────────────────────────┐   │
│  │ Web Worker: analysis.worker.ts                         │   │
│  │  importers → rasterChange → roadImpact → isolation →   │   │
│  │  ranking                                               │   │
│  └────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────┘
        │ tiles only
        ▼
   OpenStreetMap tile servers (attribution required)
```

### Phase 2 — **Server-assisted (pilot)**
Same pure-TypeScript analysis modules move behind a worker/API boundary.

```
Browser ──tRPC──► Express ──► MySQL (incidents, runs, audit)
                    │
                    ├──► S3 (rasters, vectors, result packs)
                    └──► Job runner (Node worker / queue) ──► Sentinel-1 provider
```

**Rule:** analysis modules in `features/flood/` must be **pure functions with no DOM/React imports**, so they run unchanged in a Web Worker now and on the server later.

---

## 3. Technology Choices

| Concern | Choice | Reason |
|---|---|---|
| Map | **MapLibre GL JS** (preferred) or Leaflet | OSM raster tiles, GPU vector rendering, canvas image overlays for the flood mask; no API key |
| GeoTIFF parsing | `geotiff` | Reads COG/strips/tiles in browser, exposes geo-keys & bounding box |
| Projection | `proj4` | Reproject UTM/other CRS ↔ WGS84 |
| Vector ops | `@turf/*` (selective: `bbox`, `length`, `lineIntersect`, `booleanPointInPolygon`, `nearestPointOnLine`, `along`) | Tree-shakeable geometry |
| Spatial index | `rbush` | Fast road ↔ flood-cell lookups |
| Graph / shortest path | Custom adjacency list + BFS/Dijkstra (multi-source) | Small, auditable, no heavy dependency |
| CSV | `papaparse` (export via `unparse`) | Robust quoting |
| State | React context + `useReducer` (or `zustand`) | Simple, typed |
| Validation | `zod` (already installed) | Shared schemas for GeoJSON properties & params |
| Worker bundling | Vite `new Worker(new URL(...), { type: "module" })` | Native support |

Add with: `pnpm add maplibre-gl geotiff proj4 rbush papaparse @turf/helpers @turf/length @turf/bbox @turf/boolean-point-in-polygon @turf/nearest-point-on-line` and `pnpm add -D @types/papaparse @types/rbush`.

---

## 4. Module Specification

```
client/src/
  pages/Home.tsx                     # shell: nav · map · queue
  components/map/
    FloodMap.tsx                     # MapLibre wrapper
    layers.ts                        # style defs, legend
    Legend.tsx
  components/flood/
    LayerPanel.tsx  ThresholdControl.tsx  ImportPanel.tsx
    QueueList.tsx   ImpactDetail.tsx  ProvenanceChip.tsx  CaveatBanner.tsx
  features/flood/
    types.ts            sampleScenario.ts   importers.ts
    rasterChange.ts     roadImpact.ts       isolation.ts
    ranking.ts          exports.ts          analysis.worker.ts
    store.ts            validation.ts       constants.ts
```

### 4.1 `types.ts` (core contracts)

```ts
export type Provenance = "synthetic" | "imported" | "computed";

export interface RasterMeta {
  width: number; height: number; bands: number;
  bbox: [number, number, number, number];        // WGS84 minX,minY,maxX,maxY
  pixelSize: [number, number];                   // degrees or metres + unit
  crs: string;                                   // e.g. "EPSG:4326"
  noData: number | null;
  acquired?: string;                             // ISO if present in tags
  source: string; provenance: Provenance;
}

export interface Community {
  id: string; name: string; geometry: GeoJSON.Point;
  population?: number; urgency?: 1|2|3|4|5;      // optional inputs
  provenance: Provenance;
}
export interface Facility { id: string; name: string; kind: "hospital"|"shelter"; geometry: GeoJSON.Point; }
export interface RoadSegment { id: string; geometry: GeoJSON.LineString; highway?: string; lengthM: number; }

export interface AnalysisParams {
  thresholdDb: number;          // default −3 dB drop in VV backscatter (tunable)
  band: "VV" | "VH";
  minOverlapFraction: number;   // default 0.30 of segment length
  snapToleranceM: number;       // default 50 m
  weights: { population: number; urgency: number; distance: number }; // default 0.5/0.3/0.2
}

export interface CommunityImpact {
  communityId: string; isolated: boolean;
  nearestFacilityId?: string; routeLengthM?: number | null;
  populationAtRisk: number; score: number; rank: number;
  reasons: string[];                              // human-readable explanation
}

export interface AnalysisResult {
  mask: { width: number; height: number; bbox: number[]; data: Uint8Array; floodedFraction: number };
  impassableRoadIds: string[];
  impacts: CommunityImpact[];
  warnings: string[]; params: AnalysisParams; generatedAt: string;
}
```

### 4.2 `importers.ts`
- **GeoTIFF**: `fromBlob` → `getImage()` → read `GeoKeys` for CRS, `getBoundingBox()`, `getResolution()`, `getGDALNoData()`. Reject if pre/post differ in **width, height, bbox (>½ pixel), CRS**, or band count.
- **Size guard**: `width*height > 25 M px` ⇒ downsample with `resampleMethod: "nearest"` window reads, and emit warning "downsampled N×".
- **GeoJSON**: parse; accept `FeatureCollection` of correct geometry types; coerce numeric strings for `population`/`urgency`; return `{ ok, data, issues[] }` where each issue has `{ severity, featureIndex?, message, fix }`.
- **Never throw raw**; always return typed issues for UI display.

### 4.3 `rasterChange.ts`
1. Convert DN → dB if the data is linear (`10*log10(x)`), detected from value range (document the heuristic and let the user override).
2. Compute `diff = post_dB − pre_dB` per pixel.
3. Candidate flood pixel when `diff <= thresholdDb` (a *decrease* in backscatter, i.e. new open water), **and** `post_dB <= waterCeilingDb` (default −15 dB VV) to reduce false positives; skip nodata/NaN.
4. Output `Uint8Array` mask + `floodedFraction`. Optional speckle reduction: 3×3 median before thresholding (toggle).
5. Pure and deterministic; unit-tested on tiny arrays.

### 4.4 `roadImpact.ts`
- Build `rbush` over road segments' bboxes.
- Sample each road at ≤ 10 m (or pixel size) steps; look up mask cell; `overlap = floodedSamples / totalSamples`.
- Mark segment impassable if `overlap >= minOverlapFraction`.

### 4.5 `isolation.ts`
1. Build graph: nodes at segment endpoints and snapped intersections (snap tolerance parameter); edges = segment weighted by length; **skip impassable edges**.
2. Snap each community and facility to the nearest *node* within `snapToleranceM`; if none, flag `"no road access within X m (data issue, not necessarily flood)"`.
3. Run **multi-source Dijkstra from all facilities** over the passable graph. A community is *isolated* if unreachable; if reachable, store route length.
4. Also compute the *pre-flood* reachability (all edges) so we can say "cut off **by flooding**" vs "never connected in the data".

### 4.6 `ranking.ts`
```
score = wP·norm(population) + wU·norm(urgency) + wD·norm(distanceOrUnreachable)
isolated communities get +ISOLATION_BONUS (default 1.0) so they outrank reachable ones
```
`reasons[]` example: `["Isolated: all 3 routes to Kasa Hospital cross flooded segments", "Population 4,200 (supplied)", "Urgency 4/5 (supplied)"]`.

### 4.7 `exports.ts`
- CSV columns: `rank, community_id, name, isolated, population, urgency, nearest_facility, route_length_m, score, reasons, threshold_db, band, generated_at, provenance`.
- GeoJSON: community points + impassable road lines + `metadata` member (params, caveat text).
- Use `Blob` + `URL.createObjectURL`; revoke URL after click.

### 4.8 Worker protocol
```ts
type Req = { id: string; type: "run"; payload: { pre: ArrayBuffer; post: ArrayBuffer; vectors: ...; params: AnalysisParams } };
type Res = { id: string; type: "progress"; stage: string; pct: number }
         | { id: string; type: "done"; result: AnalysisResult }
         | { id: string; type: "error"; message: string; fix?: string };
```
Transfer `ArrayBuffer`s (zero-copy). Cancel by terminating & respawning the worker. Debounce threshold changes and re-run **only** from `rasterChange` downward (cache parsed rasters).

---

## 5. Synthetic Scenario Spec
Deterministic (seeded PRNG, e.g. mulberry32): ~12×12 km fictional area, 60–100 road segments on a grid with a river corridor, 8–12 communities (population 300–6,000), 2 hospitals, 2 shelters, and a prebuilt mask along the river. Every feature carries `provenance: "synthetic"`; a persistent banner states it is illustrative.

## 6. Phase-2 Backend Additions (only when needed)

### Tables (Drizzle / MySQL)
```ts
organizations(id, name, createdAt)
memberships(id, userId→users.id, orgId, role: enum('viewer','analyst','coordinator','admin'))
incidents(id, orgId, name, status: enum('draft','active','closed'), bboxJson, createdBy, createdAt)
datasets(id, incidentId, kind: enum('pre_s1','post_s1','roads','communities','facilities','population'),
         storageKey, sha256, sizeBytes, crs, metaJson, uploadedBy, createdAt)
analysis_runs(id, incidentId, paramsJson, resultKey, status: enum('queued','running','done','failed'),
              errorText, startedAt, finishedAt, createdBy)
audit_log(id, orgId, userId, action, targetType, targetId, ip, ua, createdAt)
```
### tRPC routers
`incident.{list,create,get,close}`, `dataset.{presignUpload,register,list,delete}`, `analysis.{start,status,result}`, `export.{csv,geojson}` — all `protectedProcedure` with org-scoped checks (see `04_AUTH_FLOW.md`).

### Scheduled jobs (existing heartbeat)
`/api/scheduled/purge-expired-datasets` (daily), `/api/scheduled/sentinel-poll` (v2 ingestion).

---

## 7. Performance Budget
| Item | Budget |
|---|---|
| Initial JS (gz) | < 350 KB excluding map lib; map lib lazy-loaded |
| Raster memory | ≤ 25 M px per band (Float32 ≈ 100 MB) — enforced |
| Threshold re-run | < 1 s for 4 M px |
| Road sampling | O(N·k) with rbush; cap 100 k segments (warn above) |
| Main-thread long tasks | none > 50 ms during analysis (worker) |

## 8. Testing Strategy
| Level | Tool | Cases |
|---|---|---|
| Unit | Vitest | rasterChange (thresholds, nodata, dB conversion), roadImpact overlap, isolation (hand-built 6-node graph), ranking order, exports (CSV escaping) |
| Property | fast-check (optional) | Raising threshold strictness never increases flooded pixels |
| Integration | Vitest + fixtures | Synthetic scenario end-to-end → expected isolated set |
| Importer | Vitest | Bad CRS, mismatched grids, wrong geometry type, empty files |
| E2E | Playwright | Load → toggle layer → move slider → export CSV |
| Accessibility | axe-core in Playwright | No serious violations |
| Existing | `server/platform.test.ts`, `auth.logout.test.ts` | Keep green |

## 9. Build, Deploy, Environments
| Env | Notes |
|---|---|
| Local | `pnpm dev` (full stack) or `pnpm dev:static` (client only, port 3000) |
| Build | `pnpm check && pnpm test && pnpm build` |
| MVP deploy | `pnpm build:static` → host `dist/public` on any static host (Vercel/Netlify/Cloudflare Pages/GitHub Pages) |
| Pilot deploy | Docker image (existing Dockerfile) + managed MySQL + S3 |
| CI | GitHub Actions: install → check → test → build → (optional) Lighthouse + axe |

**Cleanup before release:** remove `vite.config.ts.bak`; confirm the debug collector plugin (`vitePluginManusDebugCollector`) and `public/__manus__/debug-collector.js` are dev-only and excluded from production builds; remove unused `AIChatBox`, `ComponentShowcase` route, and Google `Map.tsx` if not used.

## 10. Observability
- MVP: `console` + ErrorBoundary; optional privacy-safe analytics (no file contents ever).
- Pilot: structured JSON logs, `/api/health` (exists), error tracking (Sentry), run-duration metrics, alert on failed runs.

## 11. Open Technical Decisions
1. MapLibre vs Leaflet (default: MapLibre).
2. Reprojection strategy: reproject vectors to raster CRS (cheap) vs. raster to WGS84 (expensive) — default: vectors → raster CRS for analysis, display in WGS84.
3. Pilot job runner: in-process queue vs. Redis/BullMQ vs. cloud functions.
4. Sentinel-1 provider for v2.
