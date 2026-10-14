# FloodOne — Product Requirements Document (PRD)

| Field | Value |
|---|---|
| Product | FloodOne — Flood Response Intelligence |
| Version | 1.0 (MVP / hackathon-ready) → 2.0 (operational pilot) |
| Source | `plan.md` + code in `floodone.zip` |
| Status | Draft for build |

---

## 1. Problem & Vision

**Problem.** After a flood, responders know *where the water is* only roughly, and almost never know *which communities have lost road access to a hospital or shelter*. Satellite change maps exist, but they stop at "water here"; they don't answer "who is cut off and who do we reach first?"

**Vision.** *See the flood signal. Find who is cut off.*

FloodOne turns a flood signal (Sentinel-1 before/after imagery) into an **explainable rescue-priority queue**:

1. Where is the candidate flood signal?
2. Which road links does it cut?
3. Which communities can no longer reach a hospital or shelter?
4. In what order should they be prioritised, and why?

**Honesty principle.** Every output is labelled as an *exploratory screening signal*, never validated flood truth. Synthetic data is always labelled as synthetic.

---

## 2. Goals & Non-Goals

### Goals (MVP)
- G1. Working end-to-end analysis in the browser with **no account and no server dependency**.
- G2. Open instantly in a labelled **synthetic practice scenario** so the app is usable with zero uploads.
- G3. Accept real inputs: pre/post Sentinel-1 GeoTIFFs, roads, communities, facilities (GeoJSON), optional population raster.
- G4. Adjustable change threshold with live overlay refresh.
- G5. Road-impact → graph isolation → community ranking with a **per-row explanation**.
- G6. Export results as CSV and GeoJSON.
- G7. Clear provenance chips: *Synthetic / Imported / Computed*.

### Non-Goals (MVP)
- No automatic satellite discovery/download, no live Copernicus/GFM connection.
- No accounts, remote upload, or incident database in v1.
- No claim of operational readiness or validated accuracy.
- No person-level population counts (population is contextual only).

### Later goals (v2, requires provider/validation decisions)
- Authenticated teams, persistent incidents, background raster processing, Copernicus/Sentinel ingestion, validated flood model, monitoring/alerting.

---

## 3. Users & Personas

| Persona | Needs | Success looks like |
|---|---|---|
| **Response Coordinator** (district/NGO) | A ranked list of cut-off communities fast | Exports a priority CSV within minutes of loading data |
| **GIS / Remote-sensing Analyst** | Control of threshold, visible metadata, caveats | Tunes threshold, inspects raster CRS/resolution, trusts the provenance labels |
| **Field Team Lead** (mobile) | Map + top-5 list on a phone | Taps a community, sees why it's ranked, gets coordinates |
| **Hackathon Judge / Evaluator** | Instant working demo | Sees full flow in <60 s without uploading anything |
| **Admin (v2)** | Manage users, incidents, audit | Reviews who exported what |

---

## 4. User Stories & Acceptance Criteria

### Epic A — Scenario & Map
| ID | Story | Acceptance criteria |
|---|---|---|
| A1 | As a user I open the app and immediately see a working scenario | Synthetic scenario auto-loads; banner reads "Synthetic practice scenario — not observed data" |
| A2 | I toggle layers (flood, roads, cut roads, communities, facilities, population) | Visibility changes in <200 ms; legend updates |
| A3 | I click a map feature | Side panel shows attributes, source chip, and (for communities) ranking explanation |

### Epic B — Data Import
| ID | Story | Acceptance criteria |
|---|---|---|
| B1 | I upload pre & post Sentinel-1 GeoTIFFs | Metadata shown (CRS, size, pixel size, bands, bounds, nodata); mismatched grid/CRS → blocking error with fix hint |
| B2 | I upload roads/communities/facilities GeoJSON | Schema validated (geometry type, required props); invalid files list exact problems; nothing is silently dropped |
| B3 | I upload an optional population raster | Used only if georeferenced; otherwise a clear warning and fallback to feature attributes |
| B4 | I upload an oversized file | App caps/downsamples and states the limit and what was done |

### Epic C — Change Detection
| ID | Story | Acceptance criteria |
|---|---|---|
| C1 | I adjust a threshold slider | Candidate-change mask and downstream results refresh visibly (debounced ≤ 300 ms) |
| C2 | I see caveats | Banner: "Candidate change detected — verify before deployment" + false-positive/negative note |

### Epic D — Isolation Analysis & Ranking
| ID | Story | Acceptance criteria |
|---|---|---|
| D1 | Roads overlapping flood above a configurable fraction are marked impassable | Min-overlap parameter exposed (default documented); affected segment count shown |
| D2 | I see which communities cannot reach any facility | Graph reachability computed with impassable edges removed; isolated list shown |
| D3 | I get a ranked queue | Rank = f(population, urgency inputs, isolation status, distance-to-nearest-facility); each row has a plain-language explanation |
| D4 | Missing data is reported | If no facilities / no roads → explicit message, no empty "success" |

### Epic E — Export & Reporting
| ID | Story | Acceptance criteria |
|---|---|---|
| E1 | Download ranked queue as CSV | Columns documented; includes provenance + threshold used |
| E2 | Download results as GeoJSON | Valid RFC 7946; includes properties for status, rank, reason |

### Epic F — Accessibility & Responsiveness
- WCAG 2.1 AA contrast and visible focus states, keyboard-operable queue and layer controls, `prefers-reduced-motion` respected, map-primary layout on mobile.

---

## 5. Functional Requirements (summary)

| ID | Requirement | Priority |
|---|---|---|
| FR-1 | Synthetic deterministic scenario | P0 |
| FR-2 | Interactive map w/ layer toggles, legend, selection | P0 |
| FR-3 | GeoTIFF pair import + metadata + compatibility check | P0 |
| FR-4 | GeoJSON import + schema validation | P0 |
| FR-5 | Threshold-based candidate change mask | P0 |
| FR-6 | Road-impact + isolation graph analysis | P0 |
| FR-7 | Explainable ranking queue | P0 |
| FR-8 | CSV + GeoJSON export | P0 |
| FR-9 | Provenance chips + caveat banners | P0 |
| FR-10 | Optional population raster | P1 |
| FR-11 | Large-file cap/downsample with notice | P1 |
| FR-12 | Permanent-water mask / terrain filter (UN-SPIDER style) | P2 |
| FR-13 | Accounts, saved incidents, team sharing | v2 |
| FR-14 | Sentinel-1/Copernicus ingestion | v2 |

## 6. Non-Functional Requirements

| Area | Target |
|---|---|
| Performance | Synthetic scenario interactive < 2 s; 1000×1000 px raster pair analysed < 10 s on a mid laptop; heavy work in a Web Worker so UI never freezes |
| Privacy | All uploaded files stay in the browser in MVP; no network transmission |
| Browser support | Last 2 versions of Chrome, Edge, Firefox, Safari; Android Chrome, iOS Safari |
| Accessibility | WCAG 2.1 AA |
| Reliability | Every import path has an error state; ErrorBoundary wraps the app |
| Offline-friendliness | App shell works after first load; OSM tiles degrade gracefully when offline |

---

## 7. Success Metrics

| Metric | Target |
|---|---|
| Time from page load to first meaningful result | < 5 s (synthetic) |
| Import success on valid sample files | ≥ 95 % |
| Invalid-file errors that are actionable (user study / checklist) | 100 % have a stated cause + fix |
| Demo flow completion by a new user without help | ≥ 80 % |
| Exports open correctly in QGIS/Excel | 100 % |

---

## 8. Scientific Assumptions & Caveats (must be shown in-product)

1. Change detection on same-pass Sentinel-1 pre/post imagery is a **screening signal**; thresholds are adjustable and subject to false positives (e.g. wind-roughened water, radar shadow) and false negatives (e.g. flooded vegetation/urban double-bounce).
2. Permanent water should be masked in later versions; MVP flags this limitation.
3. Sen1Floods11 (WGS84, 10 m chips, ~14 GB full set) is an **evaluation/training reference**, not bundled.
4. Population (e.g. WorldPop 100 m) is contextual, not person-level.
5. Copernicus GFM is a **roadmap** source, not a live connection.
6. Public OSM tiles are for prototype volume only.

---

## 9. Release Plan

| Release | Scope |
|---|---|
| **v0.1 Demo** | Shell + synthetic scenario + map + queue |
| **v0.5 Import** | GeoJSON + GeoTIFF import, change mask, isolation, ranking |
| **v1.0 MVP** | Exports, error states, accessibility, provenance, mobile polish |
| **v2.0 Pilot** | Auth, persistence, background processing, ingestion, monitoring |

## 10. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Users treat output as validated truth | High | Persistent caveat banners, provenance chips, wording rules |
| Large rasters crash the tab | High | Size caps, downsampling, Web Worker, progress UI |
| Misaligned CRS/grids produce nonsense | High | Hard validation + reproject-or-reject |
| Wrong road/facility data → wrong priorities | High | Show inputs on map, validation report, "verify before deployment" |
| OSM tile policy limits | Med | Attribution, caching, switchable tile provider |
| Scope creep into "operational" claims | Med | Non-goals list enforced in review |

## 11. Open Questions
1. Which country/region is the first real pilot (drives CRS, road data source, population vintage)?
2. Ranking weights: who sets "urgency inputs" and what scale (1–5)?
3. Languages needed (English only vs. Hindi/Marathi etc.)?
4. Is there a chosen Sentinel-1 provider (Copernicus Data Space, Google Earth Engine, Planetary Computer) for v2?
