# FloodOne — Security Plan

Scope: Phase 1 (static, client-side) and Phase 2 (server + DB + storage).
Method: assets → threats (STRIDE) → controls → findings in the current code → verification.

---

## 1. Assets & Sensitivity

| Asset | Sensitivity | Where |
|---|---|---|
| Uploaded rasters / vectors | Medium–High (community locations, population, facility sites can be sensitive in conflict or disaster contexts) | Browser memory (P1); S3 (P2) |
| Analysis results & ranked queue | High (drives rescue decisions — integrity matters most) | Browser / DB |
| User identity (openId, name, email) | PII | MySQL `users` |
| Session JWT & `MANUS_JWT_SECRET` | Critical | Cookie / server env |
| `MANUS_API_KEY`, `DATABASE_URL`, S3 presign access | Critical | Server env only |
| Audit log | High (integrity) | DB |

**Security priority order:** Integrity of results > Confidentiality of locations > Availability.

---

## 2. Threat Model (STRIDE, summarized)

| Threat | Example | Phase | Mitigation (ref §3) |
|---|---|---|---|
| **S**poofing | Stolen session cookie; forged OAuth callback | 2 | C-AUTH-1…6 |
| **T**ampering | Malicious GeoJSON to skew ranking; altered export | 1,2 | C-INPUT-*, C-INTEG-* |
| **R**epudiation | "I never deleted that dataset" | 2 | C-AUDIT-* |
| **I**nformation disclosure | Cross-org data read (IDOR); secrets in client bundle; PII in localStorage | 2 | C-AUTHZ-*, C-SEC-* |
| **D**enial of service | 2 GB raster freezes tab; 50 MB JSON body flood | 1,2 | C-DOS-* |
| **E**levation | Viewer runs analysis; user → admin | 2 | C-AUTHZ-* |
| Supply chain | Malicious npm package; compromised CDN | 1,2 | C-SUPPLY-* |
| XSS | Feature `name` property rendered as HTML in a popup | 1,2 | C-XSS-* |
| Misuse / misinformation | Users present screening output as validated truth | 1,2 | C-HONEST-* |

---

## 3. Controls

### 3.1 Input handling (C-INPUT)
| ID | Control |
|---|---|
| C-INPUT-1 | Validate every upload with `zod` schemas (geometry type, coordinate bounds −180..180 / −90..90, finite numbers) |
| C-INPUT-2 | Hard caps: raster ≤ 25 M px (downsample above), vector ≤ 100 k features, file ≤ 200 MB (client) — fail with a message, never crash |
| C-INPUT-3 | Parse in a **Web Worker**; wrap in try/catch; timeouts (e.g., 60 s) with cancel |
| C-INPUT-4 | Reject GeoTIFF with decompression-bomb characteristics (declared dimensions × bytes-per-sample vs. file size sanity check) |
| C-INPUT-5 | Sanitize/limit string properties (name ≤ 200 chars); numeric coercion for `population`, `urgency` with range checks |
| C-INPUT-6 | Never `eval`, never `new Function` on data; no `JSON.parse` reviver tricks |

### 3.2 XSS & client hardening (C-XSS)
| ID | Control |
|---|---|
| C-XSS-1 | Render feature properties **only via React text nodes**; never `dangerouslySetInnerHTML`; for map popups build DOM with `textContent`, not `innerHTML` |
| C-XSS-2 | Strict **Content-Security-Policy** (see §4) |
| C-XSS-3 | `Referrer-Policy: strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` (or `frame-ancestors 'self'`) |
| C-XSS-4 | Export CSV: prefix cells starting with `= + - @` with `'` to prevent **CSV/formula injection** |
| C-XSS-5 | Sanitize filenames in downloads (`[a-z0-9-_.]` only) |

### 3.3 Authentication & sessions (C-AUTH) — see `04_AUTH_FLOW.md`
| ID | Control |
|---|---|
| C-AUTH-1 | OAuth `state` + `__Host-` nonce cookie CSRF check (**already implemented** — keep, add test) |
| C-AUTH-2 | Server allow-list for `redirectUri` origins |
| C-AUTH-3 | HttpOnly + Secure cookies; `SameSite=Lax` in production |
| C-AUTH-4 | Session TTL 8 h, rotation, `jti` revocation list |
| C-AUTH-5 | Disable Bearer-header fallback outside preview |
| C-AUTH-6 | Rate limit auth endpoints |
| C-AUTH-7 | `MANUS_JWT_SECRET` ≥ 32 random bytes; rotate via `kid` support; **fail startup** if empty in production |

### 3.4 Authorization (C-AUTHZ)
| ID | Control |
|---|---|
| C-AUTHZ-1 | Org-scoped RBAC middleware on every procedure (default deny) |
| C-AUTHZ-2 | All DB queries parameterised through Drizzle; every query on incident/dataset joins on `orgId` (anti-IDOR) |
| C-AUTHZ-3 | Presigned S3 URLs: short expiry (≤ 5 min), key prefix `org/{orgId}/incident/{id}/…`, content-type & size limits enforced at presign |
| C-AUTHZ-4 | `/manus-storage/*` proxy must check the requesting user's membership for the key's org before redirecting (currently it redirects any key to a signed URL — **fix before storing user data**) |

### 3.5 Transport & infrastructure (C-INFRA)
| ID | Control |
|---|---|
| C-INFRA-1 | HTTPS only, HSTS (`max-age=31536000; includeSubDomains`) |
| C-INFRA-2 | Add `helmet` to Express |
| C-INFRA-3 | Run container as non-root, read-only filesystem where possible; pin base image digest |
| C-INFRA-4 | Secrets only in environment/secret manager; never commit `.env`; `.gitignore` already present — verify it ignores `.env*` |
| C-INFRA-5 | DB: least-privilege user, TLS to DB, daily encrypted backups, restore test quarterly |
| C-INFRA-6 | S3 bucket private, SSE enabled, no public ACLs, lifecycle rule deletes uploads after N days |

### 3.6 Denial-of-service (C-DOS)
| ID | Control |
|---|---|
| C-DOS-1 | Lower Express body limits from the current **50 MB** JSON/urlencoded to **1 MB** default; large files go via presigned upload only |
| C-DOS-2 | Global rate limit (e.g., 300 req/5 min/IP) + stricter on mutations & analysis start |
| C-DOS-3 | Per-user concurrent analysis runs ≤ 2; queue with timeout and memory cap |
| C-DOS-4 | Client: worker termination on cancel; progress UI prevents repeated clicks |

### 3.7 Integrity & honesty (C-INTEG / C-HONEST)
| ID | Control |
|---|---|
| C-INTEG-1 | Every result bundle records `params`, input SHA-256 hashes, app version, timestamp (reproducible) |
| C-INTEG-2 | Exports include a `metadata` block with caveat text and provenance |
| C-INTEG-3 | Deterministic analysis (seeded, no hidden randomness) + unit tests pin outputs |
| C-HONEST-1 | Synthetic data labelled everywhere including export filenames (`..._SYNTHETIC.csv`) |
| C-HONEST-2 | Persistent "exploratory screening signal — verify before deployment" banner |
| C-HONEST-3 | Warnings for implausible results (e.g., > 60 % flooded) |

### 3.8 Supply chain (C-SUPPLY)
| ID | Control |
|---|---|
| C-SUPPLY-1 | Commit `pnpm-lock.yaml` (present); CI uses `pnpm install --frozen-lockfile` (Dockerfile already does) |
| C-SUPPLY-2 | `pnpm audit --prod` in CI, fail on high/critical |
| C-SUPPLY-3 | Dependabot/Renovate weekly; review diffs for geospatial libs |
| C-SUPPLY-4 | **No third-party scripts from CDNs at runtime**; bundle everything; map tiles only from the allow-listed tile host |
| C-SUPPLY-5 | Subresource Integrity for any unavoidable external asset |
| C-SUPPLY-6 | Prefer well-known packages (`geotiff`, `proj4`, `@turf/*`, `maplibre-gl`); pin exact versions for them |

### 3.9 Privacy (C-PRIV)
| ID | Control |
|---|---|
| C-PRIV-1 | **Phase 1: no uploaded data leaves the browser** — state this in the UI and verify via network tab in tests |
| C-PRIV-2 | Phase 2: data-minimisation, retention policy (default 90 days after incident closure), user-initiated deletion |
| C-PRIV-3 | No file contents or coordinates in analytics/logs |
| C-PRIV-4 | Store only name/email/openId; remove `localStorage` user-info mirror |
| C-PRIV-5 | Privacy notice + data-processing terms before any pilot with real community data |

### 3.10 Audit & monitoring (C-AUDIT)
| ID | Control |
|---|---|
| C-AUDIT-1 | Append-only `audit_log` for login, role change, dataset upload/delete, run start, export |
| C-AUDIT-2 | Alerts: > 10 failed logins/min, 403 spikes, run failures, unusual export volume |
| C-AUDIT-3 | Log scrub: no tokens, no cookies, no raw file bytes |

---

## 4. Recommended Headers (Express, production)

```ts
import helmet from "helmet";
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "default-src": ["'self'"],
      "script-src": ["'self'"],                       // no inline scripts in prod
      "worker-src": ["'self'", "blob:"],
      "img-src": ["'self'", "data:", "blob:", "https://*.basemaps.cartocdn.com", "https://*.cartocdn.com", "https://tile.openstreetmap.org", "https://*.tile.openstreetmap.org"],
      "connect-src": ["'self'", "https://*.basemaps.cartocdn.com", "https://*.cartocdn.com", "https://tile.openstreetmap.org", "https://*.tile.openstreetmap.org"],
      "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      "font-src": ["'self'", "https://fonts.gstatic.com"],
      "frame-ancestors": ["'self'"],
      "object-src": ["'none'"],
      "base-uri": ["'self'"],
      "form-action": ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));
```
Note: the current `/api/platform/config.js` is an inline-style script served as a *file*, so it works with `script-src 'self'`. Self-host fonts later to drop Google Fonts.

---

## 5. Findings in the Current Code (prioritised)

| # | Sev | Finding | File | Fix |
|---|---|---|---|---|
| F1 | **High** | `/manus-storage/*` redirects to a signed URL for **any key** without checking who is asking | `server/_core/storageProxy.ts` | Require auth + org membership check; or disable until storage is used |
| F2 | **High** | Session cookie valid **1 year**, `SameSite=None` | `shared/const.ts`, `cookies.ts`, `oauth.ts` | 8 h TTL; `Lax` in production; revocation |
| F3 | **Med** | Body limit **50 MB** for JSON and urlencoded on all routes | `server/_core/index.ts` | 1 MB default; per-route override only if needed |
| F4 | **Med** | Full user object mirrored into `localStorage` | `client/src/_core/hooks/useAuth.ts` | Remove |
| F5 | **Med** | Bearer-token fallback from `sessionStorage` is on in all environments | `main.tsx`, `sdk.ts` | Gate by `PREVIEW_MODE` |
| F6 | **Med** | No rate limiting, no `helmet`/CSP | `server/_core/index.ts` | Add (see §3.5, §4) |
| F7 | **Med** | Debug collector plugin + `public/__manus__/debug-collector.js` (28 KB) and `/__manus__/logs` endpoint exist | `vite.config.ts`, `client/public/__manus__` | Confirm dev-only; exclude from production build; delete file from `dist` |
| F8 | **Low** | `vite.config.ts.bak` committed | repo root | Delete |
| F9 | **Low** | `redirectUri` is taken from client-controlled `state` for token exchange | `shared/const.ts`, `sdk.ts` | Server allow-list of origins |
| F10 | **Low** | Auth warnings logged on every anonymous request | `sdk.ts` | Downgrade to debug |
| F11 | **Low** | Unused heavy surfaces shipped (`AIChatBox`, `ComponentShowcase`, LLM/image/voice helpers) | `client/`, `server/_core/` | Remove or leave unrouted; fewer endpoints = smaller attack surface |
| F12 | **Info** | `drizzle` + MySQL only has `users`; no tenant model yet | — | Add org tables before storing incident data (see TRD §6) |

Positive findings to preserve: OAuth nonce cookie with `__Host-` prefix; JWT algorithm pinned to HS256; `appId` claim check; `publicConfig` whitelists only named values and escapes `<`; unit test proving secrets aren't serialised.

---

## 6. Incident Response (Pilot)
1. **Detect** — alert fires or user report.
2. **Contain** — revoke sessions (`UPDATE sessions SET revokedAt=NOW()`), rotate `MANUS_JWT_SECRET`, disable affected org.
3. **Eradicate/Recover** — patch, redeploy, restore from backup if needed.
4. **Notify** — affected org admins within 72 h; regulators if required by jurisdiction.
5. **Review** — blameless post-mortem within 5 working days; add test for the root cause.

## 7. Security Testing Plan
| Activity | When | Tool |
|---|---|---|
| Dependency audit | Every PR | `pnpm audit`, Dependabot |
| Static analysis | Every PR | ESLint security rules, CodeQL |
| Unit tests for auth guards, IDOR, CSV injection, oversize input | Every PR | Vitest |
| Fuzz importers with malformed GeoJSON/GeoTIFF | Pre-release | fast-check / custom corpus |
| Header check | Pre-release | securityheaders.com / `curl -I` |
| DAST scan | Pre-pilot | OWASP ZAP baseline |
| Pen-test / external review | Before real-data pilot | Third party |
| Restore drill | Quarterly | Manual |

## 8. Security Release Gate (must all be ✔)
- [ ] F1, F2, F3, F5, F6 fixed (before any server-side data)
- [ ] CSP + helmet active and tested
- [ ] No secrets in client bundle (`grep` the built `dist/public`)
- [ ] CSV injection test passes
- [ ] RBAC/IDOR tests pass
- [ ] `pnpm audit` clean of high/critical
- [ ] Debug collector absent from production build
- [ ] Privacy notice published; retention job scheduled
