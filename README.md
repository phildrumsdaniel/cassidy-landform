# Landform

**Cassidy Group's institutional-grade land, development and capital markets platform**

A single-file web app that takes a property deal from raw land sourcing through to investor exit and capital raise — all in one tool, with cloud sync, AI-powered analysis, and a tiered investor marketing suite.

**Current version:** v9.8 (Frontend) · v9.5 (Backend, chunked storage)
**Live URL:** `phildrumsdaniel.github.io/cassidy-landform/`
**Workflow Atlas:** `phildrumsdaniel.github.io/cassidy-landform/flowchart.html`

---

## What Landform Is

A **scenario-planning and deal-packaging platform** for property developers. Not a formal valuation engine.

Landform covers **buy-side, develop-side, sell-side, AND capital-raise** workflows in one tool — most competitors only cover one slice.

| Pipeline stage | Tools provided |
|---|---|
| **Find** | AI land sourcing (Placona), planning monitor, constraint check |
| **Value** | Land appraisal, RLV, SFH/BTR/PBSA mix, tenure blending, capitalisation, grants |
| **Develop** | Planning & viability, financial modelling, due diligence, risk register |
| **Exit** | 17 exit routes compared side-by-side, sector yield benchmarks |
| **Market** | Investor Marketing Suite with tiered shareable links + analytics |
| **Manage** | Cloud-synced portfolio, dashboard, meeting log |

---

## Important — Indicative Only

All figures, valuations, and projections shown in Landform are **indicative** and based on developer assumptions. They do **not** constitute a formal valuation under the RICS Red Book.

Landform is designed to make professional valuation steps faster and better-informed — not to replace them. For commercial commitment, cross-reference with chartered surveyor appraisal and current market evidence.

---

## Architecture

| Layer | Technology |
|---|---|
| Frontend | Single HTML file (~14,800 lines) with React 17 + Babel rendering in-browser |
| Styling | Inline styles, brand: navy #1E1F5C + gold #EDE84A + green #2D7A65 + bronze #B05A35 |
| Backend | Google Apps Script (~1,090 lines) — proxies Claude API + stores data |
| Storage | Google Sheets (chunked payloads — no 50k char limit) |
| File storage | Google Drive (auto-organised per deal) |
| AI | Claude Sonnet 4.6 via Anthropic API |
| Authentication | Email/password, SHA-256 hashed with email salt, 30-day session |
| Hosting | GitHub Pages |
| External data | UK Land Registry SPARQL (live), HMRC postcode lookup |

---

## Major Features

### Process Navigator (entry point)
Three-page guided journey: pick scheme → pick exit → see workflow boxes mirroring sidebar. Click any box to jump straight to that stage. Decision diamonds at RLV checkpoint, Viability gate, DD red-flags. 🎯 Deal Executed endpoint.

### Placona Agent — AI Land Sourcing
- **74 UK areas** organised by 12 regions (whole UK coverage)
- Regional presets including corridor presets (M62, M1/M6, M4)
- Deep Research mode finds 10-15 development sites per search
- Each result: address, postcode, acres, units, price, LPA, planning status, agent contact, constraints, source URL
- **One-click "Load Deal"** auto-populates 12 downstream stages
- Smart scheme detection from text + density

### Asset Exit Optimiser (v9.0–9.4)
For existing/completing assets:
- **13 asset types** (PBSA, BTR, SFH portfolio, hotel, pub, industrial, office, retail, residential, mixed, care, data centre, other)
- **17 exit routes** with yield biases and typical close timelines
- **Asset-fit matrix** — only viable exits shown per asset type
- **Sector yield benchmarks** (mid-2026 institutional)
- **Strategic priority weighting**: Cash now / Best IRR / Strategic value / Risk-off
- **Block accommodation mix** — blend PBSA + Key Worker + BTR + Affordable + commercial in single block, with split-sale opportunity detection
- **Residential workflow** — Land Registry comparables, 6 strategies (Sell as-is / Refurb+sell / HMO / BTL / Remortgage+hold / Demolish+redev)
- **AI strategic analysis** — specific named UK institutional buyers + structuring tips

### Tenure Mix (v9.3)
Mixed-tenure development support — 10 tenures supported:
Open Market · First Homes (70% PSF, S106) · Discounted Market Sale · Shared Ownership · Affordable Rent · Social Rent · Build to Rent · Private Rented Sector · Rent to Buy · Right to Buy Back-buy.

Each has its own pricing factor and buyer type. Outputs blended GDV, tenure-discount %, and a multi-buyer exit roadmap grouped by buyer category.

### Investor Marketing Suite (v9.2)
Three-tier institutional outreach:
- **Tier 1 Teaser** — NDA-free, 1-2 pages, broadcast widely
- **Tier 2 IM** — Post-NDA, IC-ready, 15-25 pages
- **Tier 3 Data Room** — Post-LOI, full DD documents

Per tier:
- Unique shareable links (e.g. `?share=s_abc123`)
- Optional passcode + email gate
- Optional expiry date
- Audience presets (Pension / SWF / Family Office / JV / Trade / REIT / HNI)
- Media: photo uploads to Drive, YouTube/Vimeo embeds, document uploads
- Cassidy-branded public viewer with RICS-aligned indicative-only disclaimer

**Activity analytics** — view counts, time on page, viewer name/email/company captured per link.

### Cloud Sync (v8.8)
- Sign up / sign in (SHA-256 hashed passwords)
- 30-day session via localStorage
- Save Deal pushes to backend AND saves locally
- Portfolio fetches all deals from cloud
- Cross-device access — log in anywhere, see all deals
- **Chunked storage (v9.5)** — payloads now split across multiple cells, no 50k char limit; deals can hold unlimited AI content

### AI Capabilities
Claude Sonnet 4.6 powers AI panels embedded in 20+ stages, each tailored to context:
- Placona land sourcing (Deep Research)
- Site analysis, planning, constraints
- Financial commentary (RLV / Fin / Viability)
- Risk assessment (DD / Risks)
- Exit Strategy buyer-specific advice
- Scorecard / Teaser / IM / Summary generation
- Grants strategy pack
- Asset Optimiser strategic analysis
- Residential strategy analysis
- Planning recovery strategy

POST-based API calls (avoid URL length limits), 5000-token budget for narrative stages.

### Transparent Assumptions (v9.6)
The HRA/BTR stage shows a panel listing every assumed value with its source. Each line distinguishes user-entered (green) vs auto-defaulted (amber). Users can see exactly what's driving the numbers and override any of them.

### Audit-clean Zero Handling (v9.7)
The platform now consistently respects user-entered zeros across every stage. Previously a JavaScript "falsy-zero" pattern silently overrode user 0% inputs with defaults — fixed via a `numOr()` helper applied across SFH, RLV, Fin, HRA, Asset Optimiser, Block Mix, Tenure Mix.

---

## Stage Inventory (28 stages across 6 groups)

**0. Start**
🧭 Process Navigator · 🏛 Asset Exit Optimiser

**1. Find**
🤖 Placona Agent · 🛰 Planning Monitor · ⚠ Constraint Check · 🔍 Land Finder

**2. Value**
🔷 Land Appraisal · 🏠 Property Evaluator · ◆ Land Valuation (RLV) · 🏡 SFH House Mix · 🤝 Tenure Mix · 🏢 BTR / PBSA Block · £ Capitalisation · 💷 Grants & Funding

**3. Develop**
▲ Planning & Viability · ◉ Financial Modelling · 📐 Detailed Appraisal · ◈ Due Diligence · ⬡ Risk Register

**4. Exit**
◆ Exit Strategy (8 routes) · ⚖ Planning Recovery

**5. Report**
🏆 Site Scorecard · 📬 Teaser PDF · 📑 Investor Memorandum · 📁 Data Room · 🎯 Investor Marketing Suite · 📄 Executive Summary

**6. Manage**
📋 Deal Portfolio · 📊 Dashboard · 🤝 Meetings Log

---

## Getting Started

### First-time setup

1. Open `phildrumsdaniel.github.io/cassidy-landform/`
2. Click **Register**
3. Enter email + password (8+ characters)
4. You're in. Session lasts 30 days.

### Running your first deal

1. Sidebar → **0. Start** → **🧭 Process Navigator**
2. Page 1: pick scheme type (or click FAST TRACK "Existing Asset I Own" if you already own it)
3. Page 2: pick most likely exit
4. Page 3: workflow boxes appear — click any to start filling in
5. Move through stages: Land Appraisal → RLV → SFH/BTR mix → Tenure Mix → Financial Modelling → Exit Strategy
6. Click **💾 Save Deal** in topbar to push to cloud
7. Generate AI analysis on any stage with a Generate button
8. When ready, navigate to **🎯 Investor Marketing Suite** to create shareable investor links

### Workflow Atlas

Visit the flowchart at the `/flowchart.html` URL for an interactive visual decision tree. Click any node to expand its detail card.

---

## Investor Sharing — How It Works

1. **Save the deal** (gives it a cloud ID — required for sharing)
2. Navigate to **🎯 Investor Marketing Suite**
3. **Build Package** tab → click "Create link" on Teaser / IM / Data Room
4. Configure: share title, audience preset, optional passcode, optional expiry
5. Click Create → switch to **Share Links** tab → copy URL
6. Send the URL to an investor (e.g. `phildrumsdaniel.github.io/cassidy-landform/?share=s_abc123`)
7. Investor sees Cassidy-branded landing page with hero photo, metrics, video tour, gallery, documents
8. Indicative-only disclaimer included automatically
9. **Activity** tab shows engagement — who viewed, when, how long

---

## Troubleshooting

### "AI not working / Analysis failed"

Hit the diagnostic endpoint:
```
https://script.google.com/macros/s/AKfycbwYCJ6G76EahvVAqgEGee6kjEIxzfbaFPCeWA2pLbNRy6-fXx2boVURdBmyHO2M3uE0/exec?action=diagnose
```

Returns JSON with status. If `ai_status:"OK"` and `ai_response:"pong"` — backend is fine, refresh Landform with cache-bust `?v=98`.

If `ai_error` mentions "credit balance too low" — the API key in Apps Script Script Properties doesn't match an active key on Anthropic. Create new key, paste into `ANTHROPIC_KEY` Script Property.

### "Upload failed — DriveApp permission required"

First-time Drive upload needs manual permission grant:
1. Apps Script editor → function dropdown → select `handleUploadMedia`
2. Click Run ▶
3. Permissions dialog → Review → Allow Drive access
4. Function will error (no data passed) — that's fine
5. Retry upload from Landform — now works

### Forgotten password

Reset via the Users sheet directly OR run a one-time `resetPassword` function in Apps Script (ask repo owner for the script).

### Deal data appears blank after reload

Should not happen with v9.5+ (chunked storage). If it does:
- Don't refresh — your local copy may still have the data
- The frontend now refuses to overwrite local state when cloud data is corrupted
- Re-save the deal with v9.5+ deployed and chunking will store it safely

### Cache issues

After any deploy, force fresh load: `?v=98` on the URL. Mobile Safari: long-press refresh button → "Reload Without Content Blockers".

---

## Deployment

### Frontend (GitHub Pages)
1. Edit `index.html` in repo
2. Commit + push
3. Visit URL with cache-bust `?v=98`

### Backend (Apps Script)
1. Open the Cassidy Landform Backend project
2. Paste new `Code.gs` content
3. Save (Ctrl+S)
4. Deploy → Manage deployments → ✏ on existing → Version: **New version** → Deploy
5. **Existing webhook URL stays the same** — no frontend change needed

### API Key (Script Properties)
1. Apps Script → ⚙ Project Settings → Script Properties
2. Property name: `ANTHROPIC_KEY`
3. Value: API key from `console.anthropic.com/settings/keys` (starts `sk-ant-api03-...`)
4. Save script properties (no redeploy needed)

---

## Known Limitations

- **Apps Script quotas**: 6 mins/execution, 90 mins/day, 20 simultaneous executions. Fine for solo / small team use.
- **File size**: 5MB per upload via Apps Script (Drive limit). Bigger videos use YouTube/Vimeo embed.
- **In-browser Babel**: adds 1-2s mobile load time. Could be pre-compiled for production.
- **Single-tenant**: each user sees only their own deals. No team / organisation feature yet.
- **No NDA workflow**: share links use passcode or email gate only. DocuSign integration possible future.
- **Calibration**: PSF / build cost defaults are based on regional averages. Override with local evidence for accuracy.

---

## Roadmap

### Done in current version (v9.8)
- ✅ Cloud sync + cross-device portfolio
- ✅ Asset Exit Optimiser (13 types, 17 exits)
- ✅ Residential workflow
- ✅ Investor Marketing Suite + analytics
- ✅ Tenure Mix (mixed-tenure schemes)
- ✅ Block Accommodation Mix (PBSA + KW + BTR + commercial)
- ✅ Chunked storage (unlimited deal size)
- ✅ Transparent assumptions panel
- ✅ Indicative-only disclaimers (RICS-aligned)
- ✅ Falsy-zero audit sweep across all stages
- ✅ Whole UK Placona coverage (74 areas)
- ✅ Updated Workflow Atlas

### Pending / Next
- AI IC Memo (institutional-grade combined output)
- Investor CRM (promote share-viewers into a database)
- Red Flag Engine (auto-checks on Save)
- JV Waterfall Modeller
- Capital Stack Engine
- Scenario Engine (Base/Bull/Bear/Stressed)
- Planning Probability Score
- Password change UI inside Landform
- PSF calibration with real Cassidy comparables
- Team accounts / multi-user organisations

---

## Versioning History

| Version | Date | Key changes |
|---|---|---|
| v8.7 | Earlier | Grants moved to Value stage |
| v8.8 | Earlier | Cloud sync infrastructure |
| v8.9 | 27 May 2026 | AI fixes (POST endpoint, expanded tokens) |
| v9.0 | 27 May 2026 | Asset Exit Optimiser |
| v9.1 | 27 May 2026 | Residential workflow within Optimiser |
| v9.2 | 27 May 2026 | Investor Marketing Suite |
| v9.3 | 27 May 2026 | Mixed-Tenure development support |
| v9.4 | 27 May 2026 | Block Accommodation Mix (PBSA+KW etc) |
| v9.5 | 27 May 2026 | Chunked storage (50k cell limit bypass) |
| v9.6 | 27 May 2026 | Audit fixes (studio bug, transparency panel, disclaimers) |
| v9.7 | 28 May 2026 | Audit sweep (numOr applied platform-wide) |
| v9.8 | 28 May 2026 | Whole UK Placona coverage (74 areas, 12 regions) |

---

## Credits

Built by **Phil Daniel** for **Cassidy Group Ltd**, with extensive iteration through paired sessions. Audit input from Cassidy Group colleagues.

Powered by:
- **Claude** (Anthropic) — AI analysis layer
- **Google Apps Script** + Google Sheets / Drive — backend + storage
- **GitHub Pages** — hosting
- **HM Land Registry** (open data SPARQL) — live comparables
- **React 17** + **Babel** — frontend rendering

---

## License & Confidentiality

Internal proprietary tool for Cassidy Group Ltd. All deal data, share links, and investor analytics are confidential. The platform is not a regulated valuation service.

© Cassidy Group Ltd 2026
