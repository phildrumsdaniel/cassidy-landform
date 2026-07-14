var useState = React.useState;
var useEffect = React.useEffect;

// ── App logo — the real Cassidy Group brand artwork lives in BRAND_LOGO_PNG (below).
// CASSIDY_LOGO_SRC resolves to it so login / sidebar / Board Proposal share one source.
// (Swap this to a new data-URI when the official "Cassidy Group Ltd" artwork is supplied.)
function cassidyLogoSrc(){ return "data:image/png;base64," + (typeof BRAND_LOGO_PNG!=="undefined"?BRAND_LOGO_PNG:""); }

// v10.53 — a small Cassidy logo mark for the CORNER of any generated/printed report (one-pager,
// teaser, IM, scorecard, exports). Returns a self-contained, absolutely-positioned white chip so
// it can be dropped straight after a report's page container (which just needs position:relative)
// — no per-report CSS. heightPx tunes the mark; pass {corner:"bottom-right"} etc. to move it.
function cassidyReportLogo(opts){
  opts = opts || {};
  var src = (typeof cassidyLogoSrc === "function") ? cassidyLogoSrc() : "";
  if(!src || (typeof BRAND_LOGO_PNG === "undefined") || !BRAND_LOGO_PNG) return "";
  var h = num(opts.heightPx) > 0 ? num(opts.heightPx) : 26;
  var pos = ({ "top-right":"top:8mm;right:8mm", "top-left":"top:8mm;left:8mm",
    "bottom-right":"bottom:8mm;right:8mm", "bottom-left":"bottom:8mm;left:8mm" }[opts.corner]) || "top:8mm;right:8mm";
  return '<div style="position:absolute;'+pos+';z-index:5;background:#fff;border-radius:6px;padding:4px 7px;'+
    'box-shadow:0 1px 5px rgba(0,0,0,.15);-webkit-print-color-adjust:exact;print-color-adjust:exact">'+
    '<img src="'+src+'" alt="Cassidy Group Ltd" style="height:'+h+'px;width:auto;max-width:'+(h*6)+'px;display:block"/></div>';
}

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
var WEBHOOK = "https://script.google.com/macros/s/AKfycbwYCJ6G76EahvVAqgEGee6kjEIxzfbaFPCeWA2pLbNRy6-fXx2boVURdBmyHO2M3uE0/exec";
// v9.71 — shared token sent with every backend request. The Apps Script rejects calls that
// don't carry it, which stops casual/automated abuse of the AI proxy and lets you revoke
// access by rotating this value (change it here AND in the Apps Script). NOTE: a client-side
// app cannot truly hide this — it raises the bar, it is not full server authentication.
var WEBHOOK_TOKEN = "lf_m4p9x2k7q1w8n3r6t5y0";

// ──────────────────────────────────────────────────────────────────────────
// VERSION TRACKING — v9.16
// Every saved deal is stamped with the version it was saved on (_savedVersion).
// When loaded, we compare to CURRENT_VERSION and surface a migration banner
// if breaking calc changes happened in between.
// ──────────────────────────────────────────────────────────────────────────
var CURRENT_VERSION = "10.90";
var VERSION_HISTORY = [
  {v:"10.90", date:"Jul 2026", headline:"Grants can now make a scheme STACK. Affordable-housing grant (Homes England AHP / SAHP) per affordable home now flows into the land-valuation engine — it goes straight to the residual land value (not developer profit), so it can turn an otherwise-negative RLV positive. The Grants page has a new ‘Make it stack’ card: type a grant £/affordable home (with £40k/£80k/£120k quick-picks) and see the RLV before → after; and when the scheme doesn't stack it advises the grant per home needed to reach a positive residual (or to cover the guide price), with a broad AHP/SAHP band and the reminder that an RP partner is required."},
  {v:"10.89", date:"Jul 2026", headline:"Fix: Keystone now HONOURS the unit count you set. A low count on a large greenfield (below ~5 homes/acre on 15+ acres) was being silently inflated to acres × 12 — so a deliberate 200 homes on 88 acres was overridden to 1,056, contradicting the density card which said it develops from 200. The stated figure is now always kept; the land's fuller capacity is surfaced as UPSIDE (the density card's ‘Model N at 20/acre’ button) rather than changing your number. A brief with NO unit count still estimates from density as before."},
  {v:"10.88", date:"Jul 2026", headline:"Two fixes so a NEW project starts clean. (1) Building a deal for a genuinely different site (postcode / address / town changed) no longer drags the previous project's downstream work across — Exit, Constraints, Due Diligence, Grants, Data Room, Risk Register etc. are only carried when it's a RE-RUN of the SAME site (reported: a Ryton & Wolston build inherited a Staplehurst deal's work). (2) The Tenure page's unit total now follows the deal — changing the number of units updates it (it previously stored its own total and lagged behind, showing a stale figure)."},
  {v:"10.87", date:"Jul 2026", headline:"Fix: the Detailed Appraisal (Viability) no longer double-counts costs and flip the profit negative. When the deal's build £/sqft is ALL-IN (covers professional fees, contingency, roads/drainage/SuDS), ‘Auto-Populate from Deal’ was ADDING those lines again on top — inflating the cost stack by ~£230m and showing a false negative developer profit that contradicted the one-pager. It now zeroes the lines the all-in rate already covers (and CIL, folded into the £/plot S106), sources the build rate and the land cost (residual) from the same engine the one-pager uses, so the Detailed Appraisal reconciles with the briefing."},
  {v:"10.86", date:"Jul 2026", headline:"Two more reviewer-proofing touches on the one-pager. (1) A prominent planning-risk banner near the top on an unconsented site: the residual is the land value AT consent, not today — today's strategic / hope value is shown, and the gap is the promotion upside earned over the ~years to consent (buy at hope value; the consented residual is the exit, not the entry). (2) The forward-fund figures are reframed with a ‘read-across (not a loss)’ line — for houses built for sale, forward-funding supports less land than build-to-sell, which simply confirms open-market plot sales as the exit (forward-funding suits flats/BTR). Turns scary red numbers into a clear conclusion."},
  {v:"10.85", date:"Jul 2026", headline:"The Basis of Figures now states plainly that the key value-drivers err on the side of CAUTION — build cost set high (a national builder often builds cheaper), finance at a full 12% cost of money (senior debt is typically keener at ~8-9%), and the sale value carrying only a modest new-build premium. A new ‘Conservative basis’ line spells out that the residual land value is therefore a FLOOR, not an optimistic figure — so a reviewer reads the deal as downside-protected. Appears on the one-pager and the Investor Memorandum."},
  {v:"10.84", date:"Jul 2026", headline:"One-pager polish to pre-empt a technical reviewer: the planning status now prints a clean board-facing label (an unset status showed the raw word ‘none’ — now reads ‘Unallocated / promotion’), and the density line is labelled GROSS with a ‘net developable higher’ note when it looks low, so a ~17 dph gross figure isn't misread as under-using the site. Pairs with the new planning-timeline block so the briefing answers the ‘how long / what stage / why so few homes’ questions on the page."},
  {v:"10.83", date:"Jul 2026", headline:"Planning-timeline defaults are now grounded in research, not rules of thumb. Per MHCLG's official statistics only ~1 in 5 major applications is actually decided within the 13-week statutory target (the ~90% ‘on time’ headline is inflated by Extensions of Time), and Lichfields' ‘Start to Finish’ shows 1,000+ home sites average ~5 years to a detailed consent with a cold, unallocated start being a 6-10 year Local-Plan promotion. So an unconsented site now defaults to ~7 years to consent (was ~4), a strategic allocated site to ~2.5 years, outline ~1 year — with a large-site uplift and the reports citing the MHCLG / Lichfields basis. The AI planning step is also told to estimate to real-world practice, not statutory periods."},
  {v:"10.82", date:"Jul 2026", headline:"Reports now show the timeline as TWO separate clocks plus the total horizon — because a scheme's ‘programme’ isn't just the build. (1) Planning to consent — councils routinely exceed the 13-week statutory target on major/strategic applications, so an unconsented site is a multi-year promotion (defaults by planning status, or uses the assessed figure). (2) Build-out programme. (3) Total money-in-to-exit. e.g. an unconsented 1,800-home site reads ~4 yrs planning + ~6.1 yrs build = ~10.1 yrs total. Added to the one-pager, the blind teaser and the Investor Memorandum, with a note that a forward-fund only starts once the scheme is consented and fundable."},
  {v:"10.81", date:"Jul 2026", headline:"The Quick Appraisal ‘Verify before committing’ panel now has quick-entry boxes right beside the research links — Sale £/sqft, Build £/sqft and S106 £/plot. Check a figure against the linked new-build launches / Land Registry, and if it's different, type the real number straight in: GDV, residual land value and profit recompute instantly and propagate across every stage and report. (The links themselves are read-only research and never change anything — this is how a corrected figure flows through.)"},
  {v:"10.80", date:"Jul 2026", headline:"Building a deal with Keystone now auto-completes the WHOLE journey, not just prices. Previously a fresh build only researched area prices/rents automatically, and the rest — planning, exit, tenure split, grants, constraints, the Land Appraisal scorecard (the 0/100 you saw) and Financial Modelling & Viability — waited for a separate ‘Complete the whole journey with AI’ click. Now a fresh build fills all of it automatically (non-blocking; stages populate as it goes). A REBUILD still only re-prices, so your manual downstream work is preserved. The manual button remains for re-running the journey on demand."},
  {v:"10.79", date:"Jul 2026", headline:"Consistency fix: the figure-driving fields shared across stages — developer profit %, finance rate, build £/sqft, units, affordable %, yield, sale £/sqft, guide price — can no longer show two different values on two screens. Editing any of them already propagated everywhere; now, if a deal is ever loaded with a conflict (e.g. an older saved deal with Financial Modelling on 17.5% while the SFH engine is on 25%), it is reconciled to the authoritative value on load, so every screen agrees. Descriptive labels like city keep the gentler behaviour and are never overwritten."},
  {v:"10.78", date:"Jul 2026", headline:"The Investor Memorandum is rebuilt to the standard a UK institutional investment committee actually interrogates. It now runs off the canonical appraisal engine (matching the rest of the tool) and covers 13 sections in reading order — exec summary & investment case, business plan, site, planning (with 2024 NPPF, mandatory 10% BNG and Building Safety Act gateways), financial appraisal, deal structure & economics (forward-fund coupon/valuation/profit-share), deliverability & security, market evidence, tenure & grant (AHP→SAHP), ESG (Future Homes / EPC C by 2030), legal structure/SPV, risk register, and team. The printed IM also carries a deterministic financial summary, a downside sensitivity grid (margin under GDV × build-cost stress), a forward-fund value-by-yield table and a data-room index — so the pack pre-empts the questions an IC would ask."},
  {v:"10.77", date:"Jul 2026", headline:"New ‘Blind investment teaser’ in the Investor Marketing Suite (Outreach Kit tab). It presents the full financial case — GDV, cost stack, developer profit & margin, forward-fund value and yield table, returns — with the SITE IDENTITY WITHHELD: no address, postcode, planning authority, agent or listing URL. Location shows only as a broad region and market tier. So an investor can judge the numbers and returns, then contact you under NDA to see the site — protecting a live, off-market deal from competing developers. Carries an ‘anticipated questions — answered’ section built to the standard a UK investment committee actually interrogates (deal structure, returns, downside protection, planning under the 2024 NPPF, BNG / Future Homes / Building Safety compliance, exit evidence), so the pack pre-empts their questions. Region and reference code are editable."},
  {v:"10.76", date:"Jul 2026", headline:"New ‘📣 Outreach Kit’ tab in the Investor Marketing Suite. Pick your target audience (pension fund, sovereign wealth, family office, JV partner, REIT, trade, HNW) and Landform generates a full capital-raising campaign from the deal's REAL figures — a targeting plan, a cold email + follow-up, and two LinkedIn posts including a dedicated forward-funding / JV partner call, plus a teaser blurb. Everything's editable and one-click copyable, tuned to attract forward-funding and co-investment. Pair each send with a tracked share link to see who engages."},
  {v:"10.75", date:"Jul 2026", headline:"Hardened the Deal History panel: an older or partial snapshot missing its scheme type used to throw and blank the whole History panel. It now falls back safely, so every saved deal lists and loads. Verified the full round-trip — a saved deal keeps its identity, so loading it and saving again updates the same card rather than making a copy."},
  {v:"10.74", date:"Jul 2026", headline:"The Portfolio now lists deals in order — most recently saved/modified first. Previously the backend returned them in sheet-row order, so the list looked unordered and a deal you'd just saved could appear anywhere. It now sorts on last-modified (falling back to saved/created date), so your latest work is always at the top."},
  {v:"10.73", date:"Jul 2026", headline:"Fix: saving a deal now UPDATES it in place instead of adding a duplicate to the portfolio. Each deal carries a stable id, so pressing 💾 Save Deal (from the top bar, the Investor Suite, or anywhere) replaces that deal's existing portfolio card rather than creating a near-identical second one — the portfolio holds one card per deal. ‘Save As’ is still the deliberate way to branch a copy. The fix also cleans up existing duplicates: the next save of a deal absorbs its older copies into a single card."},
  {v:"10.72", date:"Jul 2026", headline:"‘Complete the whole journey with AI’ now also fills the Financial Modelling and Viability stages. Both screens carry a one-click ‘populate from the deal’ button that Keystone never pressed — so after a full run they stayed blank until you did it manually. The journey now runs both automatically as a deterministic final step (exact engine figures, no AI guesswork), carrying the AI-refined exit yield through to Financial Modelling and setting Viability's target margin to the deal's profit target. Only empty fields are filled, so your own inputs are never overwritten."},
  {v:"10.71", date:"Jul 2026", headline:"Keystone's ‘Complete the whole journey with AI’ now refines two more figures. (1) Affordable tenure split — the Tenure Mix stage's generic 70/30 rent/shared-ownership draft is replaced with a local-plan-accurate split across social rent, affordable rent, shared ownership and First Homes, so the blended GDV reflects real policy. (2) Exit yield — the forward-fund/capitalisation net initial yield is refined by AI to the specific location (prime commuter towns price tighter than the regional table) instead of the flat regional benchmark, clamped to a realistic institutional band. Both indicative, flagged to verify."},
  {v:"10.70", date:"Jul 2026", headline:"Keystone's site appraisal now also estimates the Agricultural / existing-use value (£/acre) on the Land Appraisal screen — the current-use value before any planning uplift, which sets the land-value floor and the pre-consent hope value. Previously it defaulted to a flat £15,000/acre; now AI judges it from land type and location (bare agricultural, arable, paddock/amenity, brownfield), clamped to a sane band so a stray figure can't distort the floor."},
  {v:"10.69", date:"Jul 2026", headline:"‘Complete the whole journey with AI’ now also fills the Land Appraisal scorecard. Keystone assesses the five qualitative dropdowns — Proximity to Demand, Transport Connectivity, Ground Contamination, Land Tenure and Planning Constraints — from the site's location and prior use, so the 0/100 opportunity score is populated by AI instead of sitting at zero. Desktop judgement, flagged to verify on site."},
  {v:"10.68", date:"Jul 2026", headline:"The one-pager now shows TWO SCENARIOS side by side when you override the profit target — the Keystone baseline (what Keystone built at, e.g. 17.5%) and your target (e.g. 25%) — with residual land value, £/plot, £/acre and (if a guide price is entered) the headroom under each. Same scheme, sale values and costs — only the profit target differs — so the board sees both bases explicitly. Keystone now records its baseline profit at build so the comparison is always available. Only appears when your target differs from the baseline."},
  {v:"10.67", date:"Jul 2026", headline:"Fix: the ‘target profit %’ box now actually DRIVES the deal. In v10.66 it was a non-committing what-if — you changed it to 25% but the Quick Appraisal, RLV and one-pager stayed on 18%. It now writes the deal's developer-profit target (same field as ‘Developer profit %’), so setting 25% flows through every figure, the residual land value and the generated one-pager. Relabelled ‘Your target profit % — drives the whole appraisal’, with the plot price shown live."},
  {v:"10.66", date:"Jul 2026", headline:"‘Try any target profit %’ box on the Quick Appraisal profit-sensitivity card — type any developer profit target (e.g. 22%, 25%, 28%) and it shows the land price PER PLOT (and total / per-acre) live, alongside the preset 17.5 / 20 / 25 / 30% columns. A what-if that doesn't change the deal's own profit target. So you can dial straight to the figure a reviewer asks for (‘what's the plot price at 25%?’) and read it off."},
  {v:"10.65", date:"Jul 2026", headline:"Profit-sensitivity reframed as ‘Target profit → what you can pay for the land’, headlined in £/PLOT (Quick Appraisal + one-pager). Pick a developer profit target (17.5 / 20 / 25 / 30%) and read the land price per plot — the more profit you target, the LESS you can pay for the land (higher profit comes out of the same GDV). Adds £/plot and £/acre alongside the total, and states the direction explicitly so it can't be misread. e.g. targeting 25% profit brings the plot price down accordingly."},
  {v:"10.64", date:"Jul 2026", headline:"The Land Valuation ‘No location data set — using Manchester defaults’ warning no longer shows when the location IS known. A town like Paddock Wood (TN12) isn't itself a market entry, so the screen fell back to UK/Manchester averages even though the postcode clearly resolves to Tunbridge Wells. It now resolves the nearest ANCHOR market from the deal's city or postcode area, so it uses the correct local benchmark and shows ‘📍 Market data: Tunbridge Wells’ instead of the fallback warning. Only shows the warning when there's genuinely no resolvable location."},
  {v:"10.63", date:"Jul 2026", headline:"The Land Valuation (RLV) Land Registry search now accepts a postcode OUTCODE (e.g. ‘TN12’), not just a full postcode. The search already filters at outcode/district level, so a full postcode was never actually needed — it just rejected the outcode. Enter TN12 (or TN12 6AB) and it runs the area price search either way. Field relabelled ‘Postcode (outcode or full)’."},
  {v:"10.62", date:"Jul 2026", headline:"Manual TOTAL-HOMES override on Keystone + the units figure is now authoritative. The density slider is whole homes/acre, so it couldn't hit an exact total (6.63/acre snapped to 7 → 1,902 instead of 1,800). Keystone's density card now has a ‘Total homes — manual override’ box: type the exact figure and the whole build reconciles to it (density shown as the implied decimal). And editing ‘Proposed units’ on Land Appraisal now rescales the house mix pro-rata to match, so an already-built deal that drifted (1,789/1,902) snaps back to your number everywhere. New shared scaleMixToUnits() keeps the mix summing to the entered units."},
  {v:"10.61", date:"Jul 2026", headline:"Fixed the ‘1,800 homes shows as 1,789’ drift. The Mix Optimiser (which runs inside ‘Complete with AI’) reallocates floor area between house types and rounded each type's count independently, so the totals no longer summed to the scheme's unit count — 1,800 came out as 1,789. The optimiser now reconciles the counts back to the exact original total (the small rounding difference goes on the largest type), so the headline homes figure stays put when the mix is optimised. Re-run ‘Complete with AI’ (or Keystone) on an existing deal to correct it."},
  {v:"10.60", date:"Jul 2026", headline:"One figure, everywhere: a manually-changed figure now replicates to every page that shows it. The shared-field propagation (edit build £/sqft on any stage → Financial Modelling and RLV update, and every derived £m recomputes via the one engine) was extended to more figures — the land asking/guide price (Quick Appraisal ↔ RLV ↔ Scorecard), average unit size, site address and the local planning authority — and the Quick Appraisal's sale-£/sqft edit now keeps its RLV sibling in step too. So change a number once and it's the same on every page."},
  {v:"10.59", date:"Jul 2026", headline:"NEW ‘🚀 Complete the whole journey with AI’ on Keystone — one click fills the WHOLE SFH journey, not just the pricing. On top of researching per-type sale prices & rents, it now also fills, via AI (using national-builder / market benchmarks): Planning (consent risk, Biodiversity Net Gain, probability & timeline, strategy note), Exit strategy & target buyer (open-market plot sales + bulk sale of affordable to a housing association, and the institutional forward-fund alternative), a Grant & funding strategy (Homes England AHP etc.), and a planning & GIS Constraints screen (Green Belt, flood, AONB, access…). Due Diligence, Meeting Transcripts, Data Room and the Risk Register are deliberately left for a human. Every field stays editable and is flagged indicative — review each stage."},
  {v:"10.58", date:"Jul 2026", headline:"NEW ‘Basis of figures — how each number was derived’ section on BOTH the one-page appraisal and the board proposal, so the substance behind the headline numbers is on the page. It states, per line and pulled from the actual deal: the sale value (AI market research of local new-build launches, or Land Registry £/sqft + new-build premium), the build cost (all-in vs construction-only, BCIS basis), the finance (the exact S-curve / peak-debt calculation), S106, developer profit (with the profit-on-cost note), rents & yield (AI-researched local rents, capitalised at the net initial yield) and that the land figure is the maximum supportable residual — not an agreed price. Same source for both reports so they can't diverge."},
  {v:"10.57", date:"Jul 2026", headline:"The Keystone build now AUTO-FILLS the Capitalisation per-bed rents. Keystone's ‘Complete with AI’ already researches per-house-type rents when it prices the scheme — those now also write straight into the Capitalisation stage's 1/2/3/4-bed rent fields (and the weighted market rent that drives the pension / forward-fund value). So a fresh Keystone build lands with realistic local rents already in place — no separate ‘research & fill area rents’ click needed (the button remains for a manual refresh). Rents stay editable; verify against live listings."},
  {v:"10.56", date:"Jul 2026", headline:"NEW ‘🤖 AI: research & fill area rents’ button on the Capitalisation stage. The per-bed rents were auto-populated from the market table (which can be low/stale for a location); one click now researches typical CURRENT local new-build rents for 1/2/3/4-bed and writes them straight into the rent fields, so the capitalisation NOI and the pension / forward-fund value reflect real local rents. The fields stay editable and are flagged as indicative — verify against live Rightmove/Zoopla listings."},
  {v:"10.55", date:"Jul 2026", headline:"Appraisal-realism upgrade (from a reviewer's queries): (1) FINANCE is now modelled on an S-curve / peak-debt basis — finance = (build) × peak-debt% × rate × programme-years × 0.6 — with editable ‘Programme (years)’ and ‘Peak debt %’ inputs, so a big phased scheme shows a realistic multi-year interest cost (e.g. ~£75m, tunable up for slow sales) instead of a flat 12% of build. (2) Keystone's default house sizes cut to volume-builder norms (avg ~970 sqft, was ~1,159). (3) NEW profit-sensitivity strip — residual land value at 17.5 / 20 / 25 / 30% developer profit, so the Board sees the swing. (4) The forward-fund yield floor is now 4.5% (institutional floor — never capitalise more keenly). (5) NEW ‘Verify before committing’ block — links to check local new-build sale prices (Persimmon/Barratt/Redrow, Land Registry) and local registered providers, plus notes that houses price on GIA (no NIA deduction) and that S106/programme/land value are assumptions. Same changes flow into the printed one-pager"},
  {v:"10.54", date:"Jul 2026", headline:"Clarity fix on the Quick Appraisal forward-fund exit: a NEGATIVE ‘max land’ figure now shows in RED (it was hardcoded green, so a −£120m read like a headline positive), and a plain-English line now compares the two exits directly — e.g. ‘this exit supports −£120.41m of land vs +£78.53m on the build-to-sell appraisal above. Build-to-sell is the stronger exit here — forward-funding suits rental blocks (flats/BTR) more than houses built for sale.’ The build-to-sell residual land value is unchanged; this only stops the forward-fund figure being mistaken for the deal's headline. Same red-for-negative fix applied to the printed one-pager's forward-fund table"},
  {v:"10.53", date:"Jul 2026", headline:"The real Cassidy Group logo now appears on every generated/printed report — not just the Board Proposal. Added to the one-page land appraisal (top-right), the Investor Teaser and Investor Memorandum covers, the Grant Strategy Pack and the Land deal summary, using the same official brand artwork as the login and sidebar. So anything you print or save as PDF carries the Cassidy mark. (Reports keep a text fallback if the artwork ever fails to load.)"},
  {v:"10.52", date:"Jul 2026", headline:"Two board-proposal improvements: (1) the one-page appraisal and board paper now open IN-APP (an overlay with Close and Print / Save-as-PDF buttons) instead of a new browser tab — so on a phone you're no longer stranded on the PDF and can close straight back into Landform and regenerate any time; (2) when NO land guide price is entered, the board proposal and the printed one-pager now show an indicative MARKET land-value guide for the area by land type — agricultural / farmland, greenbelt/strategic hope value, allocated, outline and full-consent £/acre bands (× the site acreage) — so there's a reference for what the land would typically cost, with a note that brownfield ≈ consented value less remediation. Clearly flagged as market context; the residual land value remains the figure to trust for what to actually pay"},
  {v:"10.51", date:"Jul 2026", headline:"Auto-update: the app now picks up a new deploy on its own — whenever you return to it (put the phone down and reopen, or switch back to the tab) it quietly checks whether a newer version is live and, if so, reloads to it. It only reloads when there's genuinely a new build, so ordinary app-switching never interrupts you, and your deal is safe (it's saved continuously). No more manual cache-clearing to see the latest version"},
  {v:"10.50", date:"Jul 2026", headline:"Keystone now builds ALL-IN by default — a raw Keystone build treats the build £/sqft as fully-loaded, so professional fees and contingency are inside the rate (not added on top), roads/drainage/SuDS too, and finance is charged on the build cost alone. Marketing/disposal is left at £0 (a sale-side cost, matching the Quick Appraisal). Previously a fresh Keystone build left the ‘all-in’ toggle off, so it still stacked ~12% fees + ~5% contingency + ~3% marketing on top of the £250 — turning a viable scheme's residual land value negative. Finance and S106 remain (real costs). Turn off ‘Build £/sqft is all-in’ on the SFH / Quick Appraisal stage for a construction-only rate"},
  {v:"10.49", date:"Jul 2026", headline:"NEW forward-fund / capitalisation exit on the Quick Appraisal — see what a pension fund would pay for the WHOLE rented scheme at a net initial yield, with a slider across 3.8%–6% and a sensitivity table showing the investment value, developer profit and margin at each yield (a keener yield means the fund pays more). It compares the forward-fund exit to building-to-sell side by side, and the figure feeds the printable one-page board proposal — which now carries a ‘Forward-fund exit’ block so the report shows both exits. Rent is derived by the one engine from the scheme's own market values, so the page and the PDF can't diverge"},
  {v:"10.48", date:"Jul 2026", headline:"The ‘Build £/sqft is all-in’ toggle now also absorbs PROFESSIONAL FEES and CONTINGENCY — not just roads/drainage/SuDS. When your build rate is a fully-loaded all-in figure (Cassidy's usual basis, e.g. £250/sqft), the engine no longer adds ~12% fees or ~5% contingency on top (they're already inside the rate), and finance is charged on the build cost alone — so nothing is double-counted. Turn the toggle OFF for a construction-only rate and both lines return. Applied in the one engine, so every screen — Quick Appraisal, SFH House Mix, Financial Modelling, RLV, the board one-pager — reconciles. Marketing/disposal stays a separate sale-side cost at £0 by default"},
  {v:"10.47", date:"Jul 2026", headline:"Keystone now develops from what the SOURCE brief states FIRST, then flags the land's fuller capacity as upside. A capacity/allocation phrase (‘room for 1,800 houses’, ‘circa 1,800 units’) is captured as the scheme's unit figure and honoured; a new ‘density’ field captures a stated homes/acre (or dph, converted). The appraisal is built from the stated figure, and a source-led note leads the assumptions: e.g. ‘Source states room for 1,800 homes (~6.3/acre) — the appraisal is built from this. Land capacity: ~5,700 at 20/acre — potential upside.’ The Keystone density card shows the same comparison with a one-click ‘Model N at 20/acre’ button"},
  {v:"10.46", date:"Jul 2026", headline:"Five refinements: (1) ‘Complete with AI’ now AUTO-RUNS on Keystone build — research prices/rents, apply & optimise, no button; (2) the new-build premium is now visible AND tunable on the Quick Appraisal (sale £/sqft shown as ‘£X local + Y% new-build’, with an editable premium %); (3) the Mix Optimiser bounds (min/max % per type) are now editable — tune to how Cassidy sells; (4) NEW Simple mode toggle collapses the menu to Find → Quick Appraisal → Report; (5) sale/build £/sqft labels spell out ‘incl. premium’ vs ‘construction cost, no premium’. Also fixed a duplicate ‘Process Navigator’ nav item"},
  {v:"10.45", date:"Jul 2026", headline:"Keystone fills more of the deal automatically: it now auto-builds the TENURE MIX from the affordable % (open-market / affordable-rent / shared-ownership), so the Tenure Mix stage is complete with no manual entry. And a one-click ‘🤖 Complete with AI’ on Keystone researches the area's new-build sale prices AND rents per house type, applies them to the mix (a 4-bed detached that fetches a lower £/sqft than a 3-bed semi now shows it), feeds the rents into capitalisation, and applies the profit-maximising mix from the optimiser — the whole scheme priced and value-engineered from one click"},
  {v:"10.44", date:"Jul 2026", headline:"NEW Mix Optimiser on the SFH House Mix stage — ranks every house type by profit PER SQFT (the land-efficient metric) and by rent per sqft for a BTR/forward sale, then proposes the mix that maximises the money available for land + profit (within realistic planning/market bounds). It bites when you enter the real per-type prices — a 4-bed detached that sells at a lower £/sqft than a 3-bed semi is correctly shown as less profitable per acre. Includes an AI helper to research area new-build prices & rents by type"},
  {v:"10.43", date:"Jul 2026", headline:"Sale £/sqft is now FLAT across all house types — every home (2-bed semi to 4-bed detached) prices at the same base sale £/sqft, instead of bigger/detached homes getting an inflated £/sqft. GDV = total sqft × base £/sqft. This trims GDV on detached-heavy schemes to a more conservative, realistic figure. Build cost still varies by type (a real cost, not GDV); per-row £/sqft remains editable. The base £/sqft itself still includes the ~17% new-build premium over existing-home comparables"},
  {v:"10.42", date:"Jul 2026", headline:"Quick Appraisal now treats the build £/sqft as ALL-IN by default — roads, drainage and site infrastructure (SuDS) are assumed inside the build rate, not added as separate lines (no double-counting); marketing/disposal is a sale-side cost left at £0. A toggle switches it off for a deal whose build rate is construction-only. Persisted to the deal, so the detailed stages read the same assumption"},
  {v:"10.41", date:"Jul 2026", headline:"Quick Appraisal now generates the one-page A4 board proposal directly — a ‘📄 One-page board proposal (PDF)’ button on the Quick Appraisal page produces the same printable one-pager as the Board Proposal stage, straight from the figures on screen. The one-pager generator is now shared, so the two can never diverge."},
  {v:"10.40", date:"Jul 2026", headline:"NEW ‘⚡ Quick Appraisal’ front door — the whole rule-of-thumb on ONE interactive page: enter the acreage, pick a density (it builds the house mix), set the area sale £/sqft, and it shows homes → GDV → the cost stack → RLV (what the land is worth to us at 17.5% profit) → tested against the landowner's asking price with a plain-English verdict. Same engine as the detailed stages, so nothing can diverge; it sits at the top of the menu as the simple starting point"},
  {v:"10.39", date:"Jul 2026", headline:"Resilience fix: the app's core libraries (React, ReactDOM, SheetJS, pdf.js, mammoth, Leaflet) are now SELF-HOSTED in the repo instead of loaded from the unpkg CDN at runtime. A CDN outage or a network/extension block used to leave React unloaded and the entire tool blank; served from the same origin as the app, they now load as reliably as the app itself. No functional change — pure availability."},
  {v:"10.38", date:"Jul 2026", headline:"Three audit fixes: (1) rebuilding from Keystone now PRESERVES manual downstream work — planning risk/status/BNG/fire gateway, verified sale & build £/sqft (mix repriced to match), and the whole Exit/Constraint-Check/DD stages — with a banner listing what was kept (the scheme itself is still re-derived from the brief); (2) the Site Scorecard's planning score no longer defaults to a rosy ‘Full consent (assumed) 9/10’ when nothing is set — it now reads a neutral ‘Not yet assessed’ 4/10; (3) Financial Modelling's IRR/cashflow now reads the canonical unit count (mix/1,800) instead of a stale fin.units (1,902)"},
  {v:"10.37", date:"Jul 2026", headline:"Keystone now sizes the house mix to the scheme's unit count when it builds a deal — so a brief that quotes an allocation (e.g. ‘circa 1,800 units’) alongside a smaller indicative mix builds the mix at the FULL allocation from the outset. The board paper, one-pager and headline unit count all agree straight out of Keystone, with no manual auto-fill needed on the SFH stage"},
  {v:"10.36", date:"Jul 2026", headline:"One-page appraisal now shows the PATH TO A 15% MARGIN when a scheme falls short: it solves the engine for the exact sale £/sqft, build £/sqft and affordable % that each reach a 15% developer margin (holding the others fixed), plus a balanced combined route — so the board sees not just ‘does not stack’ but the specific figures that make it stack. The affordable lever is only offered when the scheme-level % is a live lever (not when affordable is set as per-row tenure)"},
  {v:"10.35", date:"Jul 2026", headline:"Land guide price & purchase costs: enter what the landowner is asking on the Board Proposal stage and see it tested against the residual land value with the true cost of buying — SDLT (non-residential land bands), legals and acquisition (~1.5%) — for an all-in margin and headroom. A live readout on screen, and a ‘Land — value vs cost to buy’ block on the one-page appraisal"},
  {v:"10.34", date:"Jul 2026", headline:"Scheme sizes to the site allocation: when the brief carries an allocation (e.g. Keystone's ‘circa 1,800 units’), the SFH mix now targets it — so GDV/RLV, the board paper and the one-pager reflect the full site, not a smaller density-only figure. Auto-fill generates a balanced family-housing mix summing exactly to the target; a new readout reconciles the allocation with density (an 1,800-home brief ≈ 16 dph gross ≈ 20 dph on the net-developable area)"},
  {v:"10.33", date:"Jul 2026", headline:"One-page A4 land appraisal: a new ‘is this worth pursuing?’ briefing on the Board Proposal stage — site size, homes (SFH mix), GDV, the full cost stack (build, fees, finance, S106, roads, infra, profit) and residual land value tested against the landowner's asking price, with a clear verdict. Every figure comes straight from the appraisal engine so it reconciles exactly with the full board paper; prints to a single side of A4"},
  {v:"10.32", date:"Jul 2026", headline:"SFH House Mix fixes + Board Proposal viability pathways: editable Sqft/£psf cells now bind to and drive the real per-row figures the engine uses (was showing generic type defaults); new ‘Auto-price sale / type’ button propagates a Base Sale £/sqft correction to every row; scheme-basis reconciliation surfaces modelled-vs-brief unit counts; and the Board Proposal gains a ‘Viability pathways — reasons & actions’ section that quantifies the levers (modular build, affordable %, AHP grant, density, phased/deferred land, JV/promotion-only) to make a marginal scheme stack"},
  {v:"10.31", date:"Jul 2026", headline:"District-level rents: verified rents now key off the site POSTCODE at sector granularity (full → sector → outcode → town), so rents vary by district within an outcode (e.g. CV6 Foleshill vs CV6 Coundon), not just by town"},
  {v:"10.30", date:"Jul 2026", headline:"Single source of truth for exit income: one shared dealNOI() drives the Exit page and Board Proposal (fixes BTR £0 NOI); negative-RLV Sell-Now fallback fixed; pension DCF now discounts at its own 4.5%; verified researched Rugby per-bed rents (2/3/4-bed) replace the generic auto-fill and are labelled 'verified'"},
  {v:"10.29", date:"Jul 2026", headline:"Long-income DCF hold model — CPI-indexed, collared rent over a 25-yr hold with term-and-reversion terminal value; shown alongside the static year-1 basis for the pension/SWF and Retain & Refinance rows on Exit and in the Board Proposal; assumptions editable on the Capitalisation stage"},
  {v:"10.28", date:"Jul 2026", headline:"Board Proposal: 'Exit scenarios' section — multi-buyer valuations, value range, hold-vs-sell, refinancing, yield benchmarks and logged HA/RP offers, live from the Exit engine"},
  {v:"10.27", date:"Jul 2026", headline:"Board Proposal: 'Rent & yield basis' research panel — live portal links, AI rent estimate, and apply to the yield",
   affectsCalc:false,
   changes:["RENT & YIELD RESEARCH — the exit yield is only as good as the rents behind it, so the Board Proposal now has a research panel to ground it in real area rents. It gives one-click links into the live ‘to let’ searches on Rightmove, Zoopla and Home.co.uk (filtered to the site postcode) plus ONS private-rent statistics — so you can verify actual achieved rents for the scheme's bed types. An AI estimate produces a rent range/median per bed size and the implied gross yield (clearly flagged as indicative, to verify against the listings). You then enter the verified average rent (£/month) and the exit yield, which feed the Capitalisation stage so the exit-route table and the generated proposal recalculate. NOTE: the portals block automated scraping, so the links open their real listings for you to confirm — nothing is scraped or applied without your say-so. 345 tests."]},
  {v:"10.26", date:"Jul 2026", headline:"Board Proposal: exit-route & yield profit sensitivity; a Listing / Source URL field on the Land stage",
   affectsCalc:false,
   changes:["BOARD PROPOSAL — EXIT ROUTES & PROFIT SENSITIVITY — a new section estimates the developer profit by exit route so the board can see the return depending on the scheme: open-market plot sales (build & sell) plus an institutional forward sale across a yield range (base yield ±0.5% and +1.0%), each with realised value, estimated profit and margin. Profit is measured against the guide price (or the modelled land value) and clearly labelled as assuming consent.",
     "LAND STAGE — LISTING / SOURCE URL — a new field to paste where the site and guide price came from (agent listing / Rightmove / auction), plus an Agent / Vendor field. These flow straight into the Board Proposal's 'Where the site & guide price came from' card (as a clickable source link) and the Data Room. 345 tests."]},
  {v:"10.25", date:"Jul 2026", headline:"Board Proposal: added a 'how the figures were derived' rationale and dropped the irrelevant raw Placona estimate",
   affectsCalc:false,
   changes:["BOARD PROPOSAL — the appraisal now includes a plain-English 'How these figures were derived' rationale: scheme size (acres × density → homes), GDV (homes valued and blended for the tenure split), development cost, residual land value (GDV less costs less target profit) and the developer margin — so the board sees how each number was reached. The provenance section no longer shows the raw Placona pre-model unit estimate (e.g. '200 homes') that conflicted with the final figure; instead it focuses on WHERE the site and guide price came from — the listing/agent, the as-listed price and area, the Placona score and a link to the original listing. 345 tests."]},
  {v:"10.24", date:"Jul 2026", headline:"Reverted the placeholder recreated logo back to the real Cassidy Group brand artwork",
   affectsCalc:false,
   changes:["LOGO — the hand-drawn SVG logo recreation from v10.23 didn't do the brand justice, so the login, sidebar and Board Proposal are back to the real Cassidy Group artwork. The logo now resolves from a single source (cassidyLogoSrc) so the official 'Cassidy Group Ltd' file can be dropped in one place when supplied. The Board Proposal Sources & Provenance section from v10.23 is unchanged."]},
  {v:"10.23", date:"Jul 2026", headline:"New Cassidy Group Ltd logo across the app + a Sources & Provenance section on the Board Proposal",
   affectsCalc:false,
   changes:["CASSIDY GROUP LTD LOGO — a new scalable brand lockup (interlocking navy/cream 3D monogram + CASSIDY / GROUP LTD wordmark) now appears consistently on the login page, the navigation sidebar and the Board Proposal letterhead. Being an SVG it stays crisp at any size and in print.",
     "BOARD PROPOSAL — SOURCES & DATA PROVENANCE — the board paper now includes a full provenance section: how the site was originated (Placona finder / listing agent / source URL / Placona score / import date), the figures 'as imported' before modelling, the modelling assumptions Landform applied, and the external data sources used (Land Registry comparables, the AI constraint assessment, planning.data.gov.uk layers, postcodes.io geocoding, and the standard government sources). So management can see exactly where every number came from. 345 tests."]},
  {v:"10.22", date:"Jul 2026", headline:"Board Proposal: drop the map pin on the EXACT parcel (postcode only finds the village)",
   affectsCalc:false,
   changes:["EXACT SITE PIN — a postcode geocodes only to a sector centroid, so the board-proposal map pinned near the village rather than on the land. The Board Proposal screen now has an interactive map: drag the pin (or click the map) onto the actual parcel, and those precise coordinates are saved to the deal and used to centre the proposal's map exactly on the site (with a tighter zoom). Falls back to the postcode location until a pin is placed. A 'Centre on postcode' and 'Reset pin' control are provided."]},
  {v:"10.21", date:"Jul 2026", headline:"Correct Cassidy Group logo now used in the navigation sidebar and the Board Proposal",
   affectsCalc:false,
   changes:["BRAND LOGO CONSISTENCY — the navigation sidebar was still showing the older logo variant while the login page uses the real Cassidy Group Ltd brand artwork. The sidebar now uses that same real logo, and the new Board Proposal document uses it in place of the placeholder mark. Both sit on a clean white chip so the logo reads correctly on the dark navy backgrounds."]},
  {v:"10.20", date:"Jul 2026", headline:"New: one-touch Board Proposal — a Cassidy-branded, printable board paper generated from the live deal",
   affectsCalc:false,
   changes:["BOARD PROPOSAL (new report) — a new stage under Report generates a Cassidy-branded board paper from the live deal at the touch of a button. It pulls every figure from the one engine (GDV, units, guide price, residual land value, margin, S106, tenure split) and assembles a management-ready document: letterhead, headline figures, the scheme, a fully-costed appraisal table, planning position, key risks and a Proceed / Hold / Decline decision box. It opens as a web page you can read on screen AND Print / Save as PDF to send to the board, and embeds a real OpenStreetMap of the site geocoded from the postcode (with an indicative site plan as fallback). Regenerate any time as the appraisal changes. 345 tests."]},
  {v:"10.19", date:"Jul 2026", headline:"Scheme density control: clearer units and a type-in box (the '30' was dwellings-per-hectare, default stays 12/acre)",
   affectsCalc:false,
   changes:["SCHEME DENSITY CLARITY — the Keystone density control drives the whole scheme size (units → mix → GDV → RLV). The default is 12 homes/acre, which was shown as '~30 dph' — the per-hectare conversion (12 × 2.471 ≈ 30), which read as if the density were 'set to 30'. The readout now spells it out — 'N homes/acre · ≈M per hectare (dph)' — and there's a type-in box beside the slider and presets so an exact density can be set, not just dragged. Default unchanged at 12/acre; fully adjustable per deal (4–40/acre)."]},
  {v:"10.18", date:"Jul 2026", headline:"Planning Strategy AI now quotes the real S106; Detailed Appraisal 'True vs Sheet' finance explained",
   affectsCalc:false,
   changes:["PLANNING STRATEGY AI SAID 'S106 £0' — the Planning & Viability 'Planning Strategy' narrative claimed the S106 input was £0 even though every screen showed £24.87m. The prompt read the planning-stage S106 TOTAL input field (blank when only the per-unit figure or auto-fill is used) instead of the propagated engine figure. It now quotes the one engine's S106, matching the display — same stale-field class fixed across the other stages.",
     "DETAILED APPRAISAL 'True vs Sheet Finance' clarified — the two finance figures (e.g. £8.83m vs £18.32m) were repeatedly read as an unreconciled error. They're two different methods: Sheet Finance is the quick average-debt estimate that drives the margin; True Finance is the full Normal-Distribution cashflow where staged sales offset the debt (usually lower, more accurate). The on-page note now spells this out so the gap reads as methodology, not a bug. (If you'd prefer the headline margin to use the accurate cashflow finance rather than the conservative sheet estimate, that's a small change on request.) 345 tests."]},
  {v:"10.17", date:"Jul 2026", headline:"Due Diligence: the AI Gap Analysis now receives its full task, and the % complete can't over-count",
   affectsCalc:false,
   changes:["DD GAP ANALYSIS PROMPT — an operator-precedence slip meant the AI never actually received the task. 'Missing: …list… || \"None\" + \". Provide: 1)…2)…3)…4)\"' parsed as '(the whole sentence) OR (the instructions)', and because the sentence is always truthy the entire 'Provide: critical items / deferrable items / missing items / timeline' block was dropped from every run — the AI was left to guess what to do. It now gets the complete, structured task, so the gap analysis is materially more useful.",
     "DD % COMPLETE — the headline counted every ticked key ever stored (including any stale/renamed items), while the per-category counts only counted current items. It now counts only items in the live checklist, so the percentage always agrees with the category tallies and can't exceed 100%. 343 tests."]},
  {v:"10.16", date:"Jul 2026", headline:"Detailed Appraisal Auto-Populate now brings in the land cost (was silently £0, overstating profit)",
   affectsCalc:true,
   changes:["DETAILED APPRAISAL AUTO-POPULATE LAND COST (high impact) — 'Auto-Populate from Deal Data' promised to pull the land cost but left the 'Residual Land Price' field blank whenever the internal land-cost variable and the asking price were both empty. That single gap cascaded: Land % GDV showed 0%, Peak Debt and True Finance showed £0, and profit/margin were overstated by the whole missing land value (~£77m / ~15 margin points on the test case). It now pulls the residual land value straight from the one engine (the same RLV shown on Capitalisation, Tenure Mix, Exit, Dashboard and the Executive Summary), so the appraisal funds the land like every other stage. 343 tests."]},
  {v:"10.15", date:"Jul 2026", headline:"Closed the last GDV outlier (SFH House Mix page) and two cosmetic label/AI-copy quirks",
   affectsCalc:true,
   changes:["SFH HOUSE MIX blended GDV reconciled — this was the last page still showing the old flat-discount figure (£510m) while every other surface read the reconciled engine figure (£525m). It used its own overall-ahPct haircut and stopped there; it now mirrors the engine's exact precedence (per-row tenure > Tenure Mix split > overall ahPct > retail), so its 'Blended Realisable GDV' matches calcDealMetrics everywhere. GDV is now consistent on every single page.",
     "SFH cost-block fee label — the first cost breakdown still read 'Prof Fees (10%)' while calculating the correct 12%. The label is now computed from the actual fees %, matching the second block.",
     "EXECUTIVE SUMMARY profit quote — the AI narrative cited the target-profit assumption (e.g. £91.9m / 17.5%, used only to back-solve the land bid) instead of the deal's actual return (e.g. £163.79m / 31.2%). The prompt now clearly labels the target as an assumption and leads with the actual profit/margin to quote. 341 tests."]},
  {v:"10.14", date:"Jul 2026", headline:"Removed every blocking browser dialog — all alerts and confirmations are now non-blocking in-page toasts",
   affectsCalc:false,
   changes:["NO MORE BLOCKING DIALOGS (freeze-proofing) — native alert()/confirm() dialogs block the whole page until dismissed, and freeze an automated/embedded browser (which read as a 60-90s crash). Every one across the app is gone: 59 alert() calls are now non-blocking toasts (top-right, click or auto-dismiss), and all 15 confirm() prompts are replaced — reversible actions (scenario re-sync/apply/clear, propagation auto-fix, non-standard import) now just proceed with a toast, while genuinely destructive ones (delete transcript(s), reset benchmarks, new deal, reset-to-raw, replace deal on build, restore pre-migration, sign out) show an in-page Confirm/Cancel toast that keeps the safety guard without blocking. 341 tests."]},
  {v:"10.13", date:"Jul 2026", headline:"Ended the GDV fragmentation — Tenure Mix, the SFH engine and every stage now show one reconciled blended GDV",
   affectsCalc:true,
   changes:["ONE BLENDED GDV EVERYWHERE (major) — the Tenure Mix page, the Propagation Audit and the headline engine were showing three different numbers for the same concept (e.g. £379m / £488m / £510m). Two root causes, both fixed: (1) a Tenure Mix split was being IGNORED whenever Keystone had set an overall affordable %, because the cruder ahPct haircut silently took precedence — the specific per-tenure split now wins (per-row house tenure > Tenure Mix split > overall ahPct); (2) the three surfaces each blended off a DIFFERENT open-market base (a basePsf×900 proxy, a basePsf×actual-average proxy, and the real priced house mix) — they now all price off the SFH engine's actual retail total, so the same split yields the same £m. Verified: engine, computeSFHMetrics and computeTenureMetrics reconcile to the penny.",
     "PROPAGATION AUDIT catches GDV drift now — it cross-checks the calculated GDV outputs (engine vs SFH vs Tenure Mix) and flags any >2% disagreement, instead of only comparing raw input fields (which is why the old three-way split stayed invisible). 341 tests."]},
  {v:"10.12", date:"Jul 2026", headline:"Fixed the Capitalisation/S106 button freeze (native dialogs), professional-fees reactivity, and the Risk Register checklist",
   affectsCalc:true,
   changes:["BUTTON FREEZE (Capitalisation Pin, S106 Auto-fill) — these used native alert()/confirm() dialogs, which block the browser (and freeze the automated review tool for 60-90s, looking like a crash). The S106 Auto-fill alert is now a non-blocking inline confirmation, and the five Capitalisation pin/sync confirmations are removed (every one guarded a reversible action — Pin has an Unpin button right beside it). No more freeze.",
     "PROFESSIONAL FEES REACTIVITY — a fresh deal showed 12% in the fees box but silently appraised at 10% (the input placeholder and the engine default disagreed), and the appraisal line was hard-labelled '(10%)'. The engine default is now 12% (matching the input and the rest of the app), the SFH screen and Financial Modelling both read the shared fees %, and every 'Professional fees (x%)' label is now computed from the actual figure. Setting a fees % now takes effect immediately, on load, with the right label. (This raises fees on schemes that were silently on 10% — the correction, not a regression.)",
     "RISK REGISTER CHECKLIST — the Dashboard workflow still showed 'Click to open' for Risk Register because the six standard risks were only displayed, never stored (so the data looked empty). A Keystone build now seeds the standard risk register into the deal, so the stored risks match what's shown and the stage reads complete. 335 tests."]},
  {v:"10.11", date:"Jul 2026", headline:"Capitalisation Multi-Route now reconciles to the affordable-adjusted engine GDV (no more full-market contradiction)",
   affectsCalc:true,
   changes:["CAPITALISATION 'Multi-Route Exit' RECONCILED — this was the one remaining place that could contradict the corrected GDV. It builds its per-route breakdown from the SFH plot rows' exit-route tags; if those were left all-private while the affordable split lived on the Tenure Mix stage, it showed a full-market 'blended realisable GDV' that disagreed with the Dashboard / Financial Modelling. It now detects that case and builds the routes FROM the Tenure Mix (Open Market Sale, Affordable Rent, Social Rent, Shared Ownership…), pricing each at its tenure factor so the panel's blended total equals the ONE engine GDV exactly. When the plot rows DO carry exit-route tags, the existing behaviour is unchanged. So however the affordable split is entered, every stage now agrees. 335 tests."]},
  {v:"10.10", date:"Jul 2026", headline:"Propagation Audit now shows the live calculated GDVs (SFH / HRA / Tenure / engine) for cross-reference",
   affectsCalc:false,
   changes:["PROPAGATION AUDIT — the 'GDV / outputs' group listed four placeholder fields (sfh.totalGDV, hra.totalGDV, tenure.blendedGDV, fin.gdvOverride) that nothing ever wrote, so they always read 'empty'. GDV is an OUTPUT calculated live from the one engine on every render — persisting a copy would drift the instant an input changed (exactly the bug this audit exists to catch). The audit now reads those figures live — SFH scheme GDV, HRA (BTR/PBSA) GDV, Tenure Mix blended GDV, and the single Engine GDV used across every stage — and marks them '✓ Calc (live)', so you get full cross-reference of the calculated outputs without introducing a drift-prone stored copy. No engine change. 332 tests."]},
  {v:"10.9", date:"Jul 2026", headline:"Financial Modelling: affordable-housing GDV now flows into the engine, professional-fees % is connected, and finance rate / sales rate reconciled",
   affectsCalc:true,
   changes:["AFFORDABLE HOUSING NOW REDUCES GDV (major) — the affordable/social split entered on the Tenure Mix stage never reached the headline GDV, so Financial Modelling, Dashboard, Executive Summary, Scorecard and Teaser all showed the pure 100%-open-market GDV and an overstated margin. The Tenure Mix stage used a separate data model the single engine couldn't see. The engine now blends the Tenure Mix split into the one canonical GDV (weighted by each tenure's pricing — Social Rent 50%, Affordable Rent 60%, Shared Ownership 85%, etc.), so a 30% affordable scheme carries its real discount everywhere. Guards prevent double-counting (per-row house-mix tenures still take precedence) and stop a partial allocation from over-discounting. NOTE: this lowers the headline margin on affordable-bearing schemes to a realistic level — that is the correction, not a regression.",
     "PROFESSIONAL FEES % DISCONNECTED — the Financial Modelling 'Professional Fees (% of build)' input did nothing to the SFH appraisal, which was hard-coded at 10%. Fees % is now read from the input and shared across Financial Modelling / SFH / RLV, so setting 12% actually raises the cost line (and correctly trims profit).",
     "TWO FINANCE RATES ON ONE PAGE — the IRR & Phased Cashflow panel used its own finance rate (defaulting to 8%) separate from the appraisal's Finance Rate, so the headline appraisal and the IRR screening silently disagreed. Both now use the one shared finance rate.",
     "SALES RATE vs PROGRAMME — the Private Sales Rate defaulted to a flat 0.75 units/week, implying a 27-year sell-out for a 1,000+ unit scheme and making the two IRR methods disagree wildly. The default now scales so sell-out tracks the programme length. 332 tests."]},
  {v:"10.8", date:"Jul 2026", headline:"Fixed Scorecard Constraint Risk (corrupt verdict regex), the dashboard checklist for Risk Register & Financial Modelling, and Executive Summary truncation",
   affectsCalc:false,
   changes:["SITE SCORECARD 'Constraint Risk' — stayed on 'Not assessed 5/10' even after a real Constraint Check. Root cause: the Constraint Check stage's verdict regex had stray control (backspace) bytes baked into it, so GO/CAUTION/AVOID NEVER parsed — the verdict was always null, the stage banner silently defaulted to '✗ AVOID' (misleading), and the Scorecard read nothing. Fixed the regex (whole-word, case-insensitive, takes the closing verdict) AND added a fallback that derives the verdict from the stored probability score, so the Scorecard/Data Room reflect the real assessment even on deals checked before this fix. (Re-run Constraint Check to capture the model's exact verdict; existing deals now map their score, e.g. 51/100 → CAUTION/Moderate.)",
     "DEAL DASHBOARD workflow checklist — Financial Modelling and Risk Register showed 'Click to open' despite holding complete data. The checklist keyed off a single arbitrary field (fin.exitYield, which a reset wipes) and Risk Register had no completion rule at all. It now uses the same engine completion predicate as the rest of the app, and a missing 'risks' rule was added (complete once the register is populated).",
     "EXECUTIVE SUMMARY — generation succeeded but the text was cut off mid-section (backend response-length cap). The prompt now constrains the whole summary to ~650 words / 2-4 sentences per section so all 10 sections complete end-to-end. (If your developer can raise the backend max output tokens, longer summaries become possible too.) 322 tests."]},
  {v:"10.7", date:"Jul 2026", headline:"New: Reset to raw import — clear the deal back to its raw Placona/Keystone source and re-run fresh",
   affectsCalc:false,
   changes:["RESET TO RAW IMPORT — a new one-click way to start a completely clean re-audit. Every imported deal now keeps its raw source (the Placona site, or the brief Keystone built from). 'Reset to raw import' (on the Keystone builder, with a shortcut on the Dashboard) clears ALL downstream work in the current deal — appraisal figures, AI reports, Due Diligence, risks, constraint checks, assumption toggles — and drops just the raw brief back into the Keystone editor so you can run the build again from scratch. Repeatable, and your saved portfolio deals are never touched. 311 tests."]},
  {v:"10.6", date:"Jul 2026", headline:"AI reports now render as branded, presentation-grade documents (headings, bold figures, bullets, tables) on screen and in PDF",
   affectsCalc:false,
   changes:["STAKEHOLDER-READY AI REPORTS — every AI report used to render as a raw plain-text dump in a monospace/`pre` block. AI report prompts now emit light Markdown (## section headings, **bold** headline figures, - bullet lists, optional tables), and a new dependency-free Markdown renderer (js/lib-mdReport.js) turns that into branded, presentation-grade output — Cassidy-navy section headers with rules, emphasised money figures, clean bulleted risks/next-steps and styled tables — shown the same way on screen and in the Print/PDF export. Applied to the shared AI Analysis panel (so Scorecard narrative, Risk assessment, Teaser rationale etc. all benefit) and the Executive Summary. Plain-text reports still render cleanly (graceful paragraphs), and legacy numbered section titles are auto-detected as headings. 306 tests."]},
  {v:"10.5", date:"Jul 2026", headline:"New: Assumption Mode — present the scheme as if planning/DD/constraints/risks are satisfied, for stakeholder reports",
   affectsCalc:false,
   changes:["ASSUMPTION MODE — a new non-destructive presentation overlay. Toggle any of four dimensions (Planning consented · DD clear · Constraints cleared · Risks mitigated) from the Dashboard or Executive Summary and the readouts present the 'if it all lands' story: Scorecard planning/constraint dimensions, Dashboard planning banner, Data Room §02.1/§02.4/§09.1, Executive Summary completion + AI narrative, and the Teaser all reflect the assumed position. Crucially it writes NOTHING to your real data — planning.status, ddChecked, constraintCheck and the risk register are untouched; toggle off and the true position returns. Every assumed value is labelled '(assumed)', an amber banner sits above every screen while it's on, and exec/teaser/data-room reports carry an 'ILLUSTRATIVE' watermark, so an assumption can never be mistaken for achieved fact.",
     "Also fixed a stale-field read in the Teaser's 'Planning risk' line (it read data.constraint, now the live constraint-check verdict). 297 tests."]},
  {v:"10.4", date:"Jul 2026", headline:"Fixed Executive Summary 'Connection failed' (oversized GET URL) and the Capitalisation pin drift-loop",
   affectsCalc:false,
   changes:["EXECUTIVE SUMMARY — 'Connection failed' after ~38s. It was the one AI feature still sending its ~8,000-character prompt as a GET query string (the URL itself carried the whole prompt), which overruns proxy/gateway URL-length limits so the request hung until the gateway killed it. Every other AI panel had already moved to POST (which also carries the auth token). The summary now goes through the same callAI POST transport and retries once to ride out an Apps Script cold-start. NOTE: if the AI service is genuinely rate-limited or down, generation can still fail — that part is backend, but the transport bug that caused most failures is fixed.",
     "CAPITALISATION 'Pin to current values' — pinning immediately raised 'Target yield was 4.50%, now 4.90%' and wouldn't clear. The pin snapshot stored the raw target-yield field (empty → defaulted to 4.50%) while the drift detector compared against the live deal yield (the area benchmark, e.g. 4.90%) — two different numbers that could never match, so the drift banner fired the instant you pinned. The snapshot now records the same live yield the detector reads, so a fresh pin sits clean. (Existing pinned deals: click 'Keep my values' once to refresh the snapshot.)"]},
  {v:"10.3", date:"Jul 2026", headline:"Constraint Check now flows into the Scorecard & Data Room; Risk Register count no longer reads 0",
   affectsCalc:false,
   changes:["SITE SCORECARD — the 'Constraint Risk' dimension stayed on 5/10 'Not assessed' even after a live Constraint Check returned CAUTION/AVOID, and the planning score ignored the constraint-check probability. Both read data.constraint (never populated) instead of data.constraintCheck.results, where the stage actually stores its verdict and score. They now read the live result, so a CAUTION assessment scores as Moderate risk and a low probability drags the planning score down.",
     "DATA ROOM §02.4 (Constraint Check) — showed 'MISSING' / 'None identified' with no reference to the assessment that had been run, because it read the wrong object. It now surfaces the AI verdict (GO/CAUTION/AVOID), the planning-probability score and the full constraint report, curated for the external room.",
     "DATA ROOM §09.1 (Risk Register) — reported '0 items' / MISSING even though the Risk Register stage shows six risks. The stage seeds six defaults it only saves once you edit one, so the Data Room read an empty array. It now falls back to the same defaults, matching the count the Risk Register screen displays.",
     "DATA ROOM §02.3 / §12.1 — conservation-area detection and the internal planning-probability readout were reading the same stale field; both now use the live constraint-check report. 270 tests."]},
  {v:"10.2", date:"Jul 2026", headline:"Fixed investor-facing cards: Teaser RLV/margin, Data Room £0s, three-way S106, planning-risk on Scorecard/Dashboard",
   affectsCalc:true,
   changes:["TEASER PDF — the summary card showed the ASKING PRICE as the Residual Land Value and a 0.0% margin (it read input fields the engine never fills). It now reads the real residual and margin from the one engine, so a teaser can't go to an investor with a mislabelled RLV.",
     "DATA ROOM — the Development Appraisal section showed GDV £0 / RLV £0 ('MISSING') and an £8k/unit S106 default, all because it read blank input fields. It now reads GDV, RLV, margin and S106 from the engine, so it matches the rest of the deal (and the S106 reflects the propagated per-unit figure, ending the 'three different S106 numbers' problem).",
     "SITE SCORECARD & DEAL DASHBOARD — both ignored a High planning-risk flag and kept showing 'Full consent (assumed) 9/10' / a reassuring green banner. The Scorecard's planning score now drops to reflect a High/Moderate risk level, and the Dashboard switches to an amber 'consent assumed — not yet achieved, treat as upside' banner. So a Green Belt promotion play no longer reads as a clean consented buy. 270 tests."]},
  {v:"10.1", date:"Jul 2026", headline:"Fixed the RLV page contradicting itself (main panel profit vs sensitivity loss)",
   affectsCalc:true,
   changes:["LAND VALUATION (RLV) — the main results panel values the scheme off its priced house mix (new-build), but the Sensitivity Analysis widget re-derived GDV from the single 'Sale £/sqft' field. When the Land Registry lookup filled that field with an EXISTING-stock comparable (e.g. £305), the widget showed a loss while the main panel showed a profit — the same page contradicting itself. The sensitivity now anchors its base to the scheme's actual GDV (effective £/sqft = GDV ÷ total sqft), so its base residual matches the headline and the sliders test movements from the real figure. 270 tests."]},
  {v:"10.0", date:"Jul 2026", headline:"Fixed three cross-stage sync bugs: Scorecard location, Exit yield stat, RLV sale-price sign-flip",
   affectsCalc:true,
   changes:["SITE SCORECARD — Location Quality now reflects the live Land Appraisal dropdowns. The score (0–100) was computed only on the Land screen and never stored, so the Scorecard read 0 and always said 'Poor 3/10' however you filled it. Both screens now share one locationScore() function.",
     "EXIT STRATEGY — the 'Exit Yield' summary tile showed 0.0% because it read a raw field instead of the resolved net initial yield; it now shows the deal yield (e.g. 4.9%), matching the field and banner beside it.",
     "LAND VALUATION (RLV) — when the Land Registry lookup returned an EXISTING-stock £/sqft, it fed that straight into the scheme's sale price. But a new-build scheme sells at the new-build price, so the main panel (mix-based, new-build) and the sensitivity widget (this figure) disagreed — one a profit, one a loss. The lookup now plumbs the new-build value (existing + regional premium) to the scheme, keeping the raw figure only as the on-screen benchmark. 270 tests."]},
  {v:"9.99", date:"Jul 2026", headline:"Fixed: Detailed Appraisal freeze, stuck Land Registry spinner, disagreeing build-out timelines",
   affectsCalc:false,
   changes:["DETAILED APPRAISAL FREEZE: the 'Auto-Populate from Deal Data' button fired a native browser alert() straight after populating. A native alert blocks the entire renderer until dismissed — which an automated/embedded browser can't do — so the page appeared to hang. Removed it (the on-screen 'estimated — verify' banners already carry the warning).",
     "LAND REGISTRY LOOKUP stuck spinner: the 30-second timeout was cleared after the FIRST query, but when that returned no rows a SECOND (broader) query ran unguarded — a hang there left the spinner spinning forever. The timeout now stays armed through the whole lookup, so it always resolves or errors cleanly.",
     "BUILD-OUT TIMELINE: the SFH House Mix screen assumed a single outlet (40 plots/yr → ~27 years for 1,056 homes) while the RLV screen used a phased model (~220/yr → ~5 years). Both now use one shared, size-aware build-rate, so the programmes agree. 267 tests."]},
  {v:"9.98", date:"Jul 2026", headline:"Fixed: green ticks now mean actually done, not merely viewed",
   affectsCalc:true,
   changes:["COMPLETION TRACKING — the big one: stages no longer count as complete just because you navigated away from them. Completeness is now purely data-driven — a stage is complete only when it genuinely holds the data it needs. So Due Diligence and Exit Strategy stay on the 'still need to fill' list until you actually fill them, and green ticks can be trusted.",
     "Two loose checks tightened so placeholder/default data no longer shows as complete: Capitalisation needs a real income to capitalise (not just the default yield the builder sets), and Tenure Mix needs its allocation to cover the scheme (>=90% of units), not a leftover part-allocation. Planning already requires a status (9.97).",
     "RLV sensitivity slider: its 'Base RLV' now includes the disposal cost, so it matches the headline residual instead of showing a stray higher figure.",
     "Exit Strategy: the yield summary falls back to the area benchmark (e.g. 4.9%) instead of showing 0.0%, and 'current value' in the hold-vs-sell now uses the engine residual rather than defaulting to the asking price. 267 tests."]},
  {v:"9.97", date:"Jul 2026", headline:"Fixed: Financial Modelling scenario table + cost reconciliation, Exit value range, Planning completion",
   affectsCalc:true,
   changes:["FINANCIAL MODELLING — scenario table: the Bear/Base/Bull cases were valuing every scenario as a rental capitalisation (NOI divided by yield), so a for-sale scheme's Base case showed a nonsense GDV and a loss right under a 'Viable, 30% margin' box. Scenarios now scale the scheme's own valuation basis — for-sale GDV moves with the sales-price assumption; only genuine rental schemes capitalise NOI.",
     "FINANCIAL MODELLING — cost table: Total Dev Cost and its line items now come from the one engine (build, fees, contingency, finance, S106, roads, infra, disposal, plus acquisition and land), so the itemised costs sum to the total and reconcile with the profit and margin shown beneath them.",
     "EXIT STRATEGY — the headline value range no longer starts at £0: exit routes that don't apply to the scheme are excluded, so the low end is the lowest real route (e.g. the Registered Provider route).",
     "PLANNING — the stage no longer shows a green 'complete' tick on the unit count alone; it requires a planning status to be chosen. 261 tests."]},
  {v:"9.96", date:"Jul 2026", headline:"Fixed: Scorecard now shows the real RLV/margin; the three RLV figures reconcile",
   affectsCalc:true,
   changes:["SITE SCORECARD FIX: it was reading input fields that the engine never fills (data.rlv.rlv, data.fin.marginPct), so it showed the ASKING PRICE as the residual land value and a 0% margin — flagging a strongly profitable scheme as \"Unviable\". It now reads the residual, margin and units straight from the one engine (calcDealMetrics), so the scorecard agrees with the rest of the deal. The bottom verdict tier is relabelled DECLINE (was the confusingly positive-sounding \"PASS\").","RLV RECONCILIATION: the disposal/marketing cost added in v9.89 (3% of GDV) was in the engine's residual but missing from the SFH House Mix screen's own calc and from the RLV screen's displayed cost lines — so the same scheme showed three different residuals (e.g. £74.6m vs £89.9m). The SFH screen now includes it and both screens show a \"Disposal & marketing\" line, so every screen and the engine agree on one residual. 261 tests.","Note: these were display/scorecard-layer bugs surfaced by an end-to-end live test; the core engine numbers (GDV, cost, profit) were already correct and consistent."]},
  {v:"9.95", date:"Jul 2026", headline:"Constraint layers fixed — Green Belt, Conservation Area, AONB, Listed Buildings now draw on the map",
   affectsCalc:false,
   changes:["Fixed the constraint overlays that were failing in live testing: planning.data.gov.uk serves these as GeoJSON (its vector-tile endpoint 404s), so the map now fetches the features intersecting your current view and draws them — Green Belt, Conservation Area, AONB and Listed Buildings, colour-coded, click for the designation name. Zoom to street level to load detail. Verified end-to-end by an automated CI endpoint check that queries the exact same API on every push.","Flood is a one-click deep-link to the official Flood Map for Planning for now (the Environment Agency map endpoint moved; a drawn flood layer will follow once its service is confirmed). Removed the unused vector-tile plug-in."]},
  {v:"9.94", date:"Jul 2026", headline:"Mapped constraint layers on the Placona map — Green Belt, Conservation Area, AONB, Listed Buildings, Flood Zones",
   affectsCalc:false,
   changes:["The Placona map now overlays free, authoritative GOVERNMENT constraint layers you can toggle on and off: Green Belt, Conservation Areas, AONB and Listed Buildings (planning.data.gov.uk vector tiles) plus Flood Zones 2 & 3 (Environment Agency). No API keys, no cost. Each layer is colour-coded with a legend, and every layer links to its official map as a guaranteed fallback. Zoom in on a pin to see whether a site sits in Green Belt, a flood zone, etc. — turning the map from locational into decision-useful, and complementing the AI Constraints Checker (now one click from the map).","This closes the biggest visible gap vs mapped GIS platforms for near-zero cost: authoritative constraints drawn on the map, not just an AI narrative."]},
  {v:"9.93", date:"Jul 2026", headline:"Map view in Placona — see found sites on a map, coloured by score",
   affectsCalc:false,
   changes:["The Placona Site Inbox now shows an interactive MAP (Leaflet + free OpenStreetMap): every shortlisted site is a pin, positioned from its postcode (via the free postcodes.io lookup, with a region-centre fallback), coloured by its Cassidy Opportunity Score. Click a pin to open the site. Toggle the map on/off; it respects the shortlist score slider. Reinforces the Find stage visually — add postcodes for exact pin positions."]},
  {v:"9.92", date:"Jul 2026", headline:"Manual Land Appraisal path also resolves any village by postcode",
   affectsCalc:true,
   changes:["The universal postcode resolution now applies to deals built by hand (not just via Keystone): dealCityKey resolves an unlisted village or suburb to its nearest anchor market from the postcode area, so the engine's pricing, build-cost region, yield and rents all follow the site's postcode wherever the deal was created. Type a village in the city box and add a postcode and it resolves automatically. 258 engine tests."]},
  {v:"9.91", date:"Jul 2026", headline:"Universal location resolution — any UK village resolves from its postcode, no manual list needed",
   affectsCalc:true,
   changes:["Keystone now resolves ANY UK location automatically from its POSTCODE. Every postcode area (NE, TS, CV, LS, EX, …) is mapped to its nearest anchor market, so a village outside Newcastle (NE20), Middlesbrough (TS9) or anywhere else gets the right region, build cost, yield and pricing without being listed by name — and without needing a code change. Sale £/sqft still uses the site's own postcode Land Registry value where available, so it stays hyper-local.","Resolution order: named market → known village alias → POSTCODE area → (last resort) national averages, always clearly flagged with how it resolved. The clear message when nothing resolves: add a postcode.","Region lookup (BCIS build cost) also falls back to the postcode when the town isn't a named market. 255 engine tests."]},
  {v:"9.90", date:"Jul 2026", headline:"Investor yield slider on the exit comparison; finance set to a conservative 12%",
   affectsCalc:true,
   changes:["New INVESTOR YIELD SLIDER on the sell-vs-capitalise comparison (Capitalisation screen): drag the net initial yield the fund would buy on (3.5–6.5%, plus 4.0/4.5/5.0/5.5 presets) and the capitalised value and Cassidy's profit update live — showing the exact yield at which a forward-fund exit beats selling the homes. Built for investor marketing.","Finance now defaults to a conservative 12% all-in (was 7.5%) so headroom is real and not flattered — the prudent basis for deciding what to pay for land. Editable per deal.","Cashflow / programme-based finance is earmarked next as an investor-marketing and data-room deliverable.","246 engine tests."]},
  {v:"9.89", date:"Jul 2026", headline:"Sell vs capitalise — developer profit both ways, with the affordable treatment corrected; disposal costs added",
   affectsCalc:true,
   changes:["NEW capitalisation / forward-fund exit for housing schemes: values the finished scheme as a rented investment sold to an institution (e.g. a pension fund) — net rent capitalised at a yield — alongside the build-to-sell figure. The Capitalisation screen now shows developer PROFIT and margin BOTH ways so you can see which exit pays Cassidy more.","AFFORDABLE TREATMENT CORRECTED for capitalisation: the 30% affordable discount that cuts Cassidy's GDV when selling homes individually is NOT applied to the capitalised value. In a forward-fund deal the affordable is a lower-RENT effect the end investor carries, not a capital haircut on the developer — so the two exits now reflect who actually bears the affordable cost.","House rents for the capitalisation are derived from the scheme's own market values (a gross rental yield), not a flat city apartment rent, so the investment value is realistic. Rent yield, management % and cap yield are all assumptions you can tune.","DISPOSAL / MARKETING costs now modelled (agent + marketing + legal, ~3% of GDV on Keystone-built deals; 0 on hand-built deals for back-compatibility) and flow through the headline RLV and profit.","245 engine tests. Still simplified: finance remains a flat all-in rate rather than a full programme cashflow."]},
  {v:"9.88", date:"Jul 2026", headline:"Best-practice assumption set — a complete appraisal from a thin brief, every figure tweakable",
   affectsCalc:true,
   changes:["Keystone now fills EVERY scheme and cost lever with a sensible, flagged default, so a deal built from just a location + acreage is a complete appraisal on day one — you then tweak as you go. Forward-looking basis: full consent assumed, scheme sized to the land, priced to new-build.","Realistic (not rosy) defaults: 30% affordable housing (70/30 rented/shared-ownership) and £15,000/unit S106/CIL — itemised so obligations like cycleways are visible (Education £5k, Highways & cycleways £3k, Health £1.5k, Open space £2.5k, Sport/community £2k, Monitoring £1k). Plus profit 17.5%, finance 7.5%, contingency 5%, fees 10%. Any value supplied in the brief still wins.","New Assumptions register on the Keystone screen: lists every default it applied and where to change it, with the gaps flagged in amber. Honest note that disposal/marketing costs (~3% of GDV) and programme-based finance are not yet modelled, so the residual is slightly optimistic until they are added.","235 engine tests."]},
  {v:"9.87", date:"Jul 2026", headline:"Density slider on Keystone — size the scheme to the land before you build",
   affectsCalc:false,
   changes:["New \"Scheme density\" control on the Keystone screen: once the brief has an acreage, drag homes/acre (or tap a preset — 8/12/16/20 per acre) and watch the unit count update live, with the gross density in dph. It writes the resulting count straight into the brief, so the mix, GDV and residual land value all size to it before you even build. A draft to refine — trim for constraints, buffers and open space."]},
  {v:"9.86", date:"Jul 2026", headline:"Keystone sizes the scheme to the land, recognises more locations, prices realistically",
   affectsCalc:true,
   changes:["Keystone now sizes the scheme to the LAND. A supplied unit count that implies an implausibly low density on a strategic greenfield (under ~5 homes/acre on 15+ acres — e.g. a portal/AI underestimate of 200 on 88 acres) is treated as an underestimate and upsized to what the acreage can carry (e.g. 1,056 at 12/acre), with the original recorded so it can be restored in one field. Landform is forward-looking: assume the scheme can be consented and test whether it stacks.","Location recognition improved: added Rugby to the market table, mapped Warwickshire villages (Ryton-on-Dunsmore, Wolston, Dunchurch, Bilton and more) to their nearest market, and normalised hyphens so places like \"Ryton-on-Dunsmore\" match. When a location still isn't recognised, Keystone now clearly FLAGS that pricing/build/yield have fallen back to national averages, instead of doing it silently.","Auto-generated house mixes are now priced off a realistic NEW-BUILD sale £/sqft — the postcode's Land Registry value plus the regional new-build premium (e.g. CV8 ≈ £380 +16%), or an owner-occupier cap rate — rather than a conservative rental yield that understated sale values and made viable schemes look unprofitable. The SFH mix, the RLV \"does it stack\" screen and the tenure calc now all price off the same basis.","Net effect on the Ryton/Wolston 88-acre test: units 200 → 1,056, GDV and RLV computed properly, and the land clears its asking price instead of failing on an under-sized, under-priced scheme. All auto-figures remain drafts to refine in SFH House Mix. 230 engine tests."]},
  {v:"9.85", date:"Jul 2026", headline:"Brand slogan on the sign-in screen",
   affectsCalc:false,
   changes:["Added the slogan \"Built by property developers, for property developers\" as a gold tagline under the title on the sign-in screen. Cosmetic only."]},
  {v:"9.84", date:"Jul 2026", headline:"Real Cassidy Group Ltd logo on the sign-in screen",
   affectsCalc:false,
   changes:["The sign-in screen now uses the actual Cassidy Group Ltd brand logo — the navy + gold interlocking 3D C's with the CASSIDY GROUP LTD wordmark — lifted from the brand artwork onto a white background, replacing the earlier vector stand-ins (heart, then drawn C's). It is a touch soft because the source image was low-resolution; a high-res PNG or the vector original can be dropped in for a perfectly crisp version. Cosmetic only."]},
  {v:"9.83", date:"Jul 2026", headline:"Sign-in logo mark corrected to the interlocking C's",
   affectsCalc:false,
   changes:["The sign-in logo mark is now the two interlocking C's (gold + pale gold) inside the navy badge, matching the Cassidy Group Ltd brand — replacing the heart shape used in 9.82. Still a crisp vector recreation; the real artwork file can be swapped in later. Cosmetic only."]},
  {v:"9.82", date:"Jul 2026", headline:"Cassidy Group Ltd logo — crisp vertical lockup on the sign-in screen",
   affectsCalc:false,
   changes:["The sign-in screen now shows the full Cassidy Group Ltd lockup as a sharp vector (SVG): navy badge, mark, 'CASSIDY' over a gold rule, then 'GROUP LTD'. Replaces the previous low-resolution image plus the doubled text that briefly appeared in 9.81. Reads cleanly on the white card and stays crisp at any size. A vector recreation of the brand mark — the real artwork file can be swapped in later. Cosmetic only."]},
  {v:"9.80", date:"Jul 2026", headline:"Forgot-password reset flow — never get locked out again",
   affectsCalc:false,
   changes:["New 'Forgot password?' link on the sign-in screen. Enter your email, receive a 6-digit code by email, then set a new password — a two-step flow with an on-screen success message and a 'send another code' fallback.","The code expires after 15 minutes and is single-use. Any new password is accepted, including one you've used before — there is no password-reuse restriction.","Backend: paste docs/apps-script-password-reset.js into the Apps Script and re-deploy (adds request_reset + reset_password actions using Google's built-in MailApp; codes live in a separate 'Resets' sheet so the Users schema is untouched). Purely account/login plumbing — no change to any figure or calculation."]},
  {v:"9.79", date:"Jul 2026", headline:"Cassidy logo now shows on older iPads/Safari (PNG, not WebP)",
   affectsCalc:false,
   changes:["The Cassidy Group logo was stored as a WebP image, which older iPads and older Safari versions can't display — so it appeared as an empty box on the sign-in screen and elsewhere. The logo is now a PNG, which every device and browser supports. Purely cosmetic; no change to any figure or calculation."]},
  {v:"9.75", date:"Jun 2026", headline:"Scout scoring — rank land finds by a transparent Opportunity Score",
   affectsCalc:false,
   changes:["New Cassidy Opportunity Score (0-100%) on every Placona find: a transparent, weighted blend of five pillars — Viability (35%, run through the real engine), Market strength (20%), Demographics & demand (20%), Planning probability (15%) and Constraints (10%) — each shown with its own sub-score.","A separate CONFIDENCE score flags finds scored on thin data, so false positives can't be promoted blind. The inbox now ranks by score with a shortlist threshold slider, protecting against overload — only the best surface.","Each deal now carries an origination status (Ours to develop / For introduction-sale / Prospect), set in Keystone — future-proofing the sell-on/origination path without building it yet.","The scoring brain is its own module (lib-scoreOpportunity.js) — the Scout agent (external) finds & enriches; Landform scores. 214 engine tests."]},
  {v:"9.74", date:"Jun 2026", headline:"Keystone reads PDFs/Word + Placona sends finds straight to Keystone",
   affectsCalc:false,
   changes:["Keystone now reads text from PDFs (pdf.js) and Word docs (mammoth), as well as spreadsheets — so design & construction briefs, rent reports and ER's can be dropped in directly. (Scanned/image-only PDFs still need pasting by hand.)","New '🪨 Evaluate in Keystone' button on a Placona site: find land in Placona, send it straight to Keystone, and it builds the brief (acreage, price, units, LPA, planning) ready to evaluate and turn into a scheme — find → evaluate → build, one flow."]},
  {v:"9.73", date:"Jun 2026", headline:"Keystone — the Deal Builder PA (front of the journey, auto-picks the journey)",
   affectsCalc:false,
   changes:["New 🪨 Keystone screen at the very start: paste emails/notes and upload documents or spreadsheets, and Keystone builds the whole deal for you and AUTO-CHOOSES the journey (SFH / BTR / PBSA / Land / Property / Recovery) from the data.","The AI only extracts the facts into a brief you review and edit — Landform does every calculation through the one tested engine (buildDealFromBrief), so the numbers stay correct and consistent. You keep full edit rights and save/share it like any deal.","Foundation shipped: lib-dealSchema.js (the brief schema + buildDealFromBrief + auto-journey detection) with engine tests. PDF/Word reading and a saved-agent profile are the next phase."]},
  {v:"9.72", date:"Jun 2026", headline:"HA low-carbon spec build cost + NDSS sizes (Delta/CHP brief)",
   affectsCalc:true,
   changes:["Added a 'HA low-carbon spec' build-cost uplift to the Build Cost Library, capturing a housing-association brief: Air Source Heat Pumps, roof PV + battery storage, EPC band B fabric, NDSS minimum sizes and a 12-year NHBC warranty (~12% / ~£20-30/sqft over a standard build, editable).","New '🌱 HA low-carbon spec' toggle on the SFH House Mix — when on, Auto-cost applies the premium to the affordable rows automatically (or scheme-wide if the scheme is HA-led). So the residual land value reflects what Delta/CHP actually require, not a standard £250/sqft.","Added an NDSS minimum-size reference (the floor area each affordable unit type must meet) to the Build Cost Library."]},
  {v:"9.71", date:"Jun 2026", headline:"Backend requests now carry a shared token (basic abuse protection)",
   affectsCalc:false,
   changes:["Every AI and logging call to the backend now includes a shared token. Once the Apps Script is set to require it, calls without the token are rejected — stopping casual/automated abuse of the AI proxy, and letting you revoke access by rotating the token. Note: a client-side app can't fully hide the token, so this raises the bar rather than being full server authentication."]},
  {v:"9.70", date:"Jun 2026", headline:"House-mix type column now shows the selected house type",
   affectsCalc:false,
   changes:["The house-type dropdown on the SFH House Mix was squeezed to about 50px — only the arrow showed, so a selected type (e.g. '3-bed detached') looked blank until you tapped it. It now has a proper width and shows the selection at a glance."]},
  {v:"9.69", date:"Jun 2026", headline:"Fix: house-mix rows with a blank type are now counted",
   affectsCalc:true,
   changes:["The engine skipped any SFH House Mix row that didn't have a house-TYPE selected — so a mix could show 225 plots on screen while the engine (and Planning/RLV) counted only the typed rows (e.g. 200). Any row with plots and sale data is now counted, type or no type; only a genuinely empty row is ignored. This was the cause of the 225-vs-200 unit mismatch."]},
  {v:"9.68", date:"Jun 2026", headline:"Propagation Audit now catches shared fields that disagree",
   affectsCalc:false,
   changes:["The Propagation Audit checked each field in isolation, so a real mismatch (e.g. affordable housing 30% on Planning/SFH but 35% on Tenure Mix) showed as 'all in sync'. It now cross-checks every shared-field group and lists any that genuinely disagree, so a drift like that can't hide."]},
  {v:"9.67", date:"Jun 2026", headline:"Audit fix: reported target margin % now matches the profit used (SFH)",
   affectsCalc:false,
   changes:["Found during a Maldon audit: for a houses scheme the profit £ correctly used the SFH stage's profit % (e.g. 15%), but the REPORTED 'target margin %' still showed the finance default (17.5%) — so a screen could display '17.5% target' next to a 15% profit figure. The reported target margin now always matches the profit actually used."]},
  {v:"9.66", date:"Jun 2026", headline:"Fix: build-cost benchmark now shows the deal's real region",
   affectsCalc:false,
   changes:["The BCIS build-cost benchmark box on Financial Modelling was hard-coded to 'Worcestershire / South West' regardless of where the site was. It now shows the deal's actual region (e.g. Maldon → East of England), with the indicative rates scaled to the local area."]},
  {v:"9.65", date:"Jun 2026", headline:"Fix: Financial Modelling cost breakdown now reconciles with its total",
   affectsCalc:false,
   changes:["On the Financial Modelling appraisal the Build line (and the fees/contingency/finance derived from it) used a legacy area figure that could read several times too high — so 'Build' showed e.g. £226m while 'Total Dev Cost' was £103m and the breakdown didn't add up. The cost lines now use the same canonical build cost as the total, so every line reconciles."]},
  {v:"9.64", date:"Jun 2026", headline:"Stop the rental-hold view misleading build-and-sell schemes",
   affectsCalc:false,
   changes:["On Capitalisation, the 'Forward Funding Stack' values the scheme as if every home were kept and rented — which always shows big negatives and a scary 'deal does not stack' verdict for a build-and-SELL houses scheme, where it doesn't apply. For a sell scheme it's now replaced by a calm, clearly-labelled note pointing to the real land value (Max Land Bid on Land Valuation), with the full rental detail tucked behind a 'show anyway' toggle so it can't be mistaken for your verdict."]},
  {v:"9.63", date:"Jun 2026", headline:"Fix: edits no longer silently blocked by 'completed' stages",
   affectsCalc:true,
   changes:["ROOT-CAUSE FIX: a stage marked 'complete' used to silently block any change reaching it from another screen — so the 'How to make this scheme stack' Apply buttons did nothing, and editing build cost / profit / S106 on the Land Valuation screen had no effect once the SFH House Mix was ticked complete. 'Complete' is now a progress marker only: every edit takes effect and flows to all the linked stages.","Reminder: for a houses scheme the SFH House Mix is the source of truth — house prices live in the mix rows, so change a price there (not the single sale £/sqft) to move the GDV."]},
  {v:"9.61", date:"Jun 2026", headline:"Land Appraisal uses your full house mix to answer 'can we pay the farmer?'",
   affectsCalc:true,
   changes:["Once you've built your SFH House Mix, the Land Appraisal 'What You Should Pay' panel now values the land off the FULL project — your real house types, sale prices and any rents capitalised — instead of a rough 'assumed homes × £/sqft' estimate. So the developer's exit value flows straight through to whether there's enough margin to meet the landowner's asking price.","Added buttons on the panel to jump to the SFH House Mix and Capitalisation, and a banner showing whether the figures are from your full mix or a quick estimate.","The 'does it stack at the asking price' check now always measures profit against the actual asking price (not a previously-applied scenario land value)."]},
  {v:"9.60", date:"Jun 2026", headline:"Set build cost & sale price right on the Land Appraisal",
   affectsCalc:false,
   changes:["The Land Deal 'What You Should Pay' panel now has Build cost (£/sqft) and Sale price (£/sqft) boxes built in — pre-filled with the area benchmark and editable — so the two numbers that drive the land value are set where you make the land decision, instead of having to go to another screen. They feed the same engine, so figures stay consistent everywhere."]},
  {v:"9.59", date:"Jun 2026", headline:"Land-buying engine: fair price vs the ask, lead with full consent, clarity fixes",
   affectsCalc:true,
   changes:["LAND DEAL — 'WHAT YOU SHOULD PAY': on Land Appraisal, enter the homes you'd get with consent and it values the consented scheme through the same engine as the rest of the tool — showing the agricultural floor, today's risk-adjusted value, the consented ceiling (max you can pay), and a fair offer to the landowner under four deal structures (option / promotion / overage / conditional). It reconciles all that against the asking price and never shows a bare negative.","LEAD WITH FULL CONSENT: the model now opens on the profitable, consented basis — Land Appraisal scenarios default to 100% Full consent when no status is set, the Site Scorecard planning score and the Deal Dashboard reflect the same 'consent assumed' basis, all clearly labelled. Planning risk stays a separate layer (today's value + scenarios).","FIXED: scenario probabilities could total more than 100% (e.g. 150% once Full consent was set), inflating the expected value — defaults now lead 100/0 and the expected value is a proper weighted average regardless of the sum.","RECONCILIATION NOTE: explains why the market-comparable land figure (benchmark/scenarios) can differ hugely from your scheme's worked residual, and that the residual is the one to trust for what to pay — flagging low density / high build cost / low sale price when they diverge.","ONE NET INITIAL YIELD used everywhere (Capitalisation, Exit, BTR/PBSA), defaulting to the area benchmark; build cost separated from sale route in the multi-route table; S106 shown as its own clearly-labelled allowance line on Capitalisation and the appraisals."]},
  {v:"9.49", date:"Jun 2026", headline:"Make-It-Stack solver, full unit catalogue, BTR both-ways, test safety-net",
   affectsCalc:true,
   changes:["NUMERIC 'MAKE IT STACK' SOLVER: when a scheme doesn't work, the Land Valuation screen now shows the exact single change to each lever (sales uplift, build £/sqft, profit %, affordable %, S106, or the build-inclusive toggle) that lifts the residual to cover the asking price or break even — with one-click Apply. Drives the real engine by bisection so answers can't drift.","COMPREHENSIVE UNIT CATALOGUE: 37 dwelling types from studio to mansion, including conversion flats (stately home / office / pub → flats), maisonettes, mews, townhouses, link-detached, executives and bungalows.","MIXED SCHEMES: per-row tenure/exit route (private, affordable, shared ownership, First Homes, DMS, rent-to-buy, BTR, PRS…), per-row Freehold/Leasehold/Commonhold, and per-row build £/sqft (a conversion costs a different rate to a new build).","BTR/PBSA BOTH WAYS: apartment blocks now show the sell-the-flats value AND the rent-capitalised investment value side by side (computeHRAMetrics).","AFFORDABLE RENTS auto-fill from the area's market rent (editable).","WORLD-CLASS PERSONA + plain-English reports, aligned to Cassidy Group, with an auto 'here's a scheme that would stack' when one doesn't.","ROBUSTNESS: 91 automated engine tests + CI on every push; existing portfolio/history deals verified to load on the corrected engine; enter-once propagation extracted to a tested pure function; auto cache-busting so changes reach users without a hard refresh; executive report now grounded in the unified engine."]},
  {v:"9.47", date:"Jun 2026", headline:"One gross-cost engine, optional infrastructure (no double-count), gross RLV vs net land bid",
   affectsCalc:true,
   changes:["calcDealMetrics adopts the canonical gross cost stack (build, fees, contingency, finance, S106, roads, infra, profit) for SFH so the deal-state RLV equals the SFH House Mix screen.","New 'build £/sqft already includes roads/drainage/infrastructure' toggle zeroes those lines so they are never double-counted.","Land acquisition costs (SDLT/legals/agent/land finance) split out of the headline residual into a separate net land bid, shown at the Land Valuation stage.","Land Valuation, SFH and existing-property screens now read one engine each (computeSFHMetrics / computeHRAMetrics / computeEPEMetrics)."]},
  {v:"9.46", date:"Jun 2026", headline:"One blended GDV engine across every screen + AH-tenure control + auto cache-busting",
   affectsCalc:true,
   changes:["Root cause of the SFH AI 'irreconcilable conflict': three screens each computed GDV independently — SFH House Mix (per-type retail, AH ignored), the deal-state wrapper (Tenure Mix capitalised blend) and the RLV screen (flat-psf retail x mix blend factor). The AI was handed two of them in one prompt and refused to reconcile.","computeSFHMetrics is now the single canonical, affordable-housing-aware blended GDV engine. New shared sfhAhFactor() defines the AH haircut once (private units at full MV, AH units at the AH tenure discount) and is not stacked on top of per-row tenure (no double-counting).","calcDealMetrics now takes the canonical sfhGdv for SFH schemes ahead of the Tenure Mix blend; the SFH House Mix screen applies the same factor to its headline GDV/RLV; the RLV screen is driven by computeSFHMetrics when a mix exists. Verified the engine, deal-state, SFH screen and RLV screen return an identical GDV.","Dropped the phantom SFH 'margin' (it always equalled the profit target by construction) from the AI prompt; the real achieved margin comes from the deal state via a new 'sfh' stage focus.","New AH-tenure selector on the SFH House Mix screen (Social Rent 55% / Affordable Rent 60% / Shared Ownership 70% / First Homes 70%) sets the overall-AH% GDV haircut explicitly.","Auto cache-busting: stamp-build.js stamps a content hash on every local script/style in index.html and a GitHub Action runs it on each push, so changed files are always re-fetched without a hard refresh."]},
  {v:"9.45", date:"Jun 2026", headline:"Capitalisation bedroom-mix sync check now compares the split, not just the total",
   affectsCalc:false,
   changes:["Phil flagged the Capitalisation bedroom mix (12/96/32/60) looked mis-populated for an SFH scheme. Root cause: the out-of-sync safeguard only fired when the TOTAL differed from the SFH House Mix. With both at 200, a wrong per-bedroom split showed no warning and the values stayed as stale saved/pinned figures.","Sync check now compares each bedroom bucket (1/2/3/4-bed, with 5-bed rolled into 4) against the SFH House Mix. Any real mismatch shows the amber banner and the one-click 'Sync from SFH' button.","Banner now lists the Cap split vs the SFH split side by side so the mismatch is visible at a glance.","Reminder: this section is informational-only for SFH schemes (0 retained PRS) — it does not affect the blended GDV or land residual."]},
  {v:"9.44", date:"Jun 2026", headline:"Fix: yield-compression figure in Capitalisation key insight was ~200x too high",
   affectsCalc:false,
   changes:["The Capitalised Value key insight read e.g. 'every 0.5% reduction in yield adds approximately 1539.96m' — the formula divided NOI by the yield band but omitted the 0.5% (0.005) step, overstating the figure by ~200x.","Corrected to NOI x 0.005 / ((yield-0.005) x yield). For the Maldon scheme this reads ~7-8m per 0.5%, not 1540m. Display-only — no effect on GDV, RLV or any appraisal calc.","Guarded against a sub-0.5% yield producing a nonsensical value."]},
  {v:"9.43", date:"Jun 2026", headline:"Your figures are locked once entered — AI fills blanks only, never overwrites",
   affectsCalc:false,
   changes:["CRITICAL FIX: AI panels no longer silently overwrite your inputs. The old behaviour auto-applied AI corrections (AI knows best) and could replace a saved figure — e.g. asking price 14m overwritten with an AI-guessed 21.5m.","New rule: any field that already holds a value (typed by you OR auto-filled once) is the source of truth and is never changed by AI or by another page. AI may only fill genuinely EMPTY fields.","To change a locked figure, edit it manually on its own page. Forward-fill of blank fields still works, so the Main Appraisal still flows into RLV / Fin / Exit.","Toast and result card now honestly state how many blanks were filled and how many of your existing figures were kept untouched.","Groundwork for an explicit per-page Lock toggle (data._locks): locked pages reject all programmatic writes."]},
  {v:"9.42", date:"Jun 2026", headline:"Honest AI Wrapper across all AI panels — grounds every prompt in Landform's own figures",
   affectsCalc:false,
   changes:["Every AI panel prompt now routed through buildHonestPrompt(data, task): injects Landform's OWN calculated deal state (GDV, total cost, RLV, margin, build:sale) as the ground truth so the AI stops inventing headline numbers.","Adds non-negotiable honesty rules: no invented fund/buyer/agent names, no fabricated comparables or planning refs, no sycophancy, challenge the inputs rather than validate them, label any default as [ASSUMPTION].","Injects market benchmarks (Land Registry weighted avg + new-build premium estimate, regional build/rent/yield) for the AI to cross-check against — labelled as benchmarks, not the deal's figures.","Auto-flags input deviations the AI must address: e.g. sale £/sqft vs Land Registry, build cost vs regional benchmark, negative RLV, land price above RLV, sub-15% margin, unviable build:sale ratio, yield above the 5% institutional ceiling.","Context for the £420/sqft question: a sale input well above the Land Registry weighted average is now surfaced to the AI as UNVERIFIED until backed by dated new-build comps or a written agent opinion.","RICS Land Valuation panel left on its bespoke v9.41 honest prompt (already grounded) and not double-wrapped."]},
  {v:"9.41", date:"Jun 2026", headline:"CRITICAL: RLV stage blended GDV + RICS AI prompt rewrite + amber banner",
   affectsCalc:true,
   changes:["CRITICAL FIX: RLV stage now uses blended GDV when SFH House Mix has non-private routes. Previously used full retail GDV — same bug as SFH Dev Appraisal had before v9.40. For Maldon scheme, RLV figure shifts from ~£6.89m to ~-£3.7m (deal doesn't stack).","RLV now reads SFH mix and computes a blendedFactor = blendedGDV/retailGDV, applied to RLV's simple units×sqft×psf model","Multi-route banner above GDV breakdown shows: route mix, units per route, MV% per route, and the blended adjustment","Summary card now shows retail GDV, route discount deduction, and blended GDV separately","RICS AI prompt completely rewritten — was letting the AI invent numbers from market benchmarks. Now passes ALL Landform inputs (sale £/sqft, build £/sqft, sqft/unit, all costs, blended GDV, calculated RLV) with explicit instruction 'DO NOT INVENT FIGURES'","Previous AI report said RLV was £17.65m vs Landform's £6.89m — could have caused £10m+ bidding errors","Banner colour: amber when RLV is positive but below 15% margin threshold (was misleadingly green). Red still for negative. Green only when truly viable.","Verdict text: '✓ Viable' (green) / '⚠ Below 15% threshold' (amber) / '✗ Negative — does not stack' (red)"]},
  {v:"9.40", date:"Jun 2026", headline:"CRITICAL: SFH RLV now uses blended GDV + cosmetic fixes",
   affectsCalc:true,
   changes:["CRITICAL FIX: SFH Development Appraisal RLV now uses Multi-Route blended GDV instead of full retail GDV. For schemes with AHP routes, this can shift RLV by tens of millions (previously OVERSTATED).","ROUTE_DISCOUNT lifted to module level so SFH and Cap use the same discount table","SFH Income column shows: per-row tenure label, full retail GDV, route discounts deducted, blended realisable","Fixed [object Object] rendering bug in multi-route exit per-route description (string-concat with React element)","Capitalisation headline now scheme-aware: shows Multi-Route blended GDV for SFH multi-tenure, BTR yield value for BTR/PRS schemes","Forward Funding Stack now has clear 'BTR-only — not your scheme' note for SFH multi-tenure deals","Capitalised Value by Buyer Type table also has 'BTR-only sensitivity' note","Phil's audit feedback: this fix addresses the multiple-sources-of-truth issue specifically for GDV"]},
  {v:"9.39", date:"Jun 2026", headline:"Capitalisation Pin + Drift Detection (Option C stabilisation work)",
   affectsCalc:false,
   changes:["Phil chose Option C: stabilise rather than refactor. Finishing Pin coverage across stages.","Capitalisation now has same Pin + drift pattern as RLV (v9.36)","Pin tracks: SFH plot total, market rent baseline, target yield, SFH mix hash (rows/routes)","If any of these drift after pinning, amber banner shows what changed with Re-sync / Keep / Unpin actions","Empty Cap fields get a 'Pin to current values' button to lock them in one click","Same UX as RLV so workflow is consistent across stages"]},
  {v:"9.38", date:"Jun 2026", headline:"Capitalisation bedroom mix: drift detection + scheme-purpose note",
   affectsCalc:false,
   changes:["Phil reported Capitalisation showing 70 units when SFH has 200 — the bedroom mix had stale saved values from when the SFH mix was smaller","Fixed bedroom classifier to handle 5-bed, executive variants, apartments — previously some house types fell to 2-bed default","Drift warning banner: if Cap bedroom totals don't match SFH House Mix, shows discrepancy + 'Sync from SFH' button","Scheme-purpose banner: clarifies that bedroom mix + yield calc is for retained PRS units only","For SFH schemes with no retained_prs route, the banner now says: 'This section is informational only — the Multi-Route Exit Value card above is your primary GDV'","If retained_prs > 0, green banner confirms it's correctly capitalising the retained portion"]},
  {v:"9.37", date:"Jun 2026", headline:"Critical fix: Land Appraisal blank screen (rules-of-hooks violation)",
   affectsCalc:false,
   changes:["Reverted v9.35's useEffect inside renderLand — hooks can't be in conditionally-rendered functions, was blanking the page","Back to direct setData pattern but with a 'scraper imported' guard flag so auto-fill fires once per scraper result, doesn't refire on cleared fields","setData call deferred via setTimeout so it doesn't fire during render","Page renders normally again"]},
  {v:"9.36", date:"Jun 2026", headline:"Pin + Drift Detection — never hold stale data silently",
   affectsCalc:false,
   changes:["Phil's insight: pinning alone isn't enough — if upstream changes after pinning, the pinned values become false information","RLV Pin now saves a snapshot of upstream values (SFH base PSF, build PSF, profit %, finance %, S106, postcode, city, planning units, asset type)","On render, the snapshot is compared to current upstream values","If drift detected: amber banner lists each field that's changed (was X → now Y) with three actions","[Re-sync to current] clears the pinned RLV values and rebuilds from current upstream","[Keep my values] refreshes the snapshot to today, acknowledging the changes","[Unpin entirely] removes the pin and goes back to live cascade","If pinned and no drift: small green confirmation 'RLV pinned · upstream unchanged'","Same pattern can be extended to Land Appraisal, Planning, Capitalisation, Fin in v9.37+"]},
  {v:"9.35", date:"Jun 2026", headline:"Land Appraisal stability — fix scraper auto-fill anti-pattern + provenance",
   affectsCalc:false,
   changes:["Fixed setData-in-render anti-pattern at top of Land Appraisal (auto-fill from scraper) — was potentially causing 'values reappear after I clear them' feel","Moved scraper auto-fill into useEffect with proper dependency tracking — runs once when scraper data changes, not on every render","Same provenance + 🔒 Pin pattern as RLV: shows when fields are auto-filled from scraper, with one-click lock","Each input label shows 'saved' suffix once you've entered a value","Pre-population from scraper/Process Navigator still works as before — just now properly bounded to one-time effect"]},
  {v:"9.34", date:"Jun 2026", headline:"RLV stability: provenance + 🔒 Pin to current values",
   affectsCalc:false,
   changes:["Phil reported RLV figures changing when editing SFH/Tenure — this is the fallback chain working as designed but confusingly","Added 'X RLV fields using upstream auto-defaults' warning banner that lists each empty field with its current auto-default value","🔒 Pin to current values button: one click saves all auto-defaults to data.rlv so upstream changes no longer affect RLV","Each input now shows 'saved' or 'auto-default' suffix in its label so you know which fields are user-set vs derived","Underlying calc unchanged — this is purely transparency + a way to lock values in"]},
  {v:"9.33", date:"Jun 2026", headline:"Capitalisation: profit by route + £225 build benchmark + postcode rents",
   affectsCalc:true,
   changes:["BCIS Residential houses build cost benchmark updated: mid £225/sqft (was £195), hi £270/sqft (was £240) — reflects 2025 Tier-1 delivered SE England SFH costs","Multi-route exit card now shows Build cost · Fees+S106+roads · Finance · Profit · Margin for EACH route","New 'Deal Evolution' summary panel: Revenue / Costs / Pre-Land Profit / Blended Margin","'Private sales spotlight' panel highlights specifically how much profit comes from private retail units (Phil's specific request)","Market rents now derive from postcode lookup first (CM9 → Maldon → £/month), with city/regional fallback","Rent provenance shown clearly: 'Rents auto-populated from postcode CM9 → Maldon market'"]},
  {v:"9.32", date:"Jun 2026", headline:"Tenure Mix page no longer resets on revisit",
   affectsCalc:false,
   changes:["Removed setData-in-render anti-pattern on Tenure Mix (was causing constant re-render churn)","Fixed falsy-zero bug on header inputs — user-entered 0 no longer falls through to SFH default","Header fields now persist independently — once you type a value, it stays even when SFH changes","Added provenance note explaining which fields auto-fill from SFH","Other stages now compute blended GDV on-read instead of relying on stale data.tenure.blendedGdv"]},
  {v:"9.31", date:"Jun 2026", headline:"Stage Relevance indicator + 'What's incomplete' dashboard checklist",
   affectsCalc:false,
   changes:["Every stage in the sidebar now shows a small badge: REQ (required) / REC (recommended) / N/A (not applicable)","Context-aware: pension/PRS routes in SFH → Capitalisation becomes REQUIRED; AHP routes → Grants becomes REQUIRED; 2+ exit routes → Tenure Mix becomes REQUIRED","Completed required stages show ✓ instead of REQ in the sidebar","Dashboard has a new 'What you still need to fill' panel showing only the stages you actually need for your journey","Clicking any incomplete stage in the checklist jumps you straight there","Once all required stages are filled, panel turns green: 'All required stages complete'"]},
  {v:"9.30", date:"Jun 2026", headline:"Capitalisation now aggregates by Exit Route",
   affectsCalc:true,
   changes:["New 'Multi-route exit value' card at top of Capitalisation stage","Aggregates SFH plot mix by Exit Route (private/pension/AHP/PRS/First Homes)","Applies route-specific discounts: 12% pension bulk, 55% AHP social, 70% AHP shared ownership, 60% AHP affordable rent, 70% First Homes","Retained PRS valued via yield-based NPV using target yield + monthly rents from Cap stage","Blended realisable GDV shown vs. full-retail baseline with blended discount %","Saves multiRouteGdv to data.cap for downstream reports"]},
  {v:"9.29", date:"Jun 2026", headline:"House type expansion + multi-route exit + Tier 1 build",
   affectsCalc:true,
   changes:["Added 1-bed terrace, 1-bed apartment, 2-bed apartment, 4-bed semi to HOUSE_TYPES (used everywhere)","SFH default mix now includes 1-bed terrace (8%) and 4-bed semi (12%)","SFH mix table now has Exit Route column: Private retail / Pension fund bulk / AHP Social Rent / AHP Shared Ownership / AHP Affordable / Retained PRS / First Homes","Rows visually tinted by exit route — pension amber, AHP green, PRS blue, retail green","🏗 Tier 1 contractor toggle on SFH: auto-uplifts build cost to BCIS upper-quartile when subcontracting","Note: capitalisation route-aware aggregation comes in v9.30"]},
  {v:"9.28", date:"Jun 2026", headline:"New-build PSF premium for new developments",
   affectsCalc:true,
   changes:["Sale £/sqft now applies a regional new-build premium when scheme is SFH/BTR/PBSA","Land Registry weighted average is for ALL housing stock — wrong baseline for new builds","Premium ranges from 10% (NI/Scotland rural) to 25% (London/prime commuter belt)","Both figures shown transparently: 'New-build estimate £363 (Land Registry £297 + 22% premium)'","SFH House Mix, RLV stage, and LiveMarketBanner all updated"]},
  {v:"9.27", date:"Jun 2026", headline:"In-app Share button (no more Google Sheets editing)",
   affectsCalc:false,
   changes:["👥 Share button on every deal card you own or can edit","Modal shows every registered Cassidy user with Can-view / Can-edit checkboxes","Owner always has full access (shown as ✓ — not editable)","Editor toggle implies viewer (editors can also view)","Saves directly to Access sheet — no manual Sheets editing","Backend: new endpoints list_users, get_access, update_access"]},
  {v:"9.26", date:"Jun 2026", headline:"RLV sanity checks (zero-profit, low build cost, high £/acre)",
   affectsCalc:false,
   changes:["Critical warning when developer profit is exactly 0% — was a real bug surfaced by external audit","Build cost warning when user override is below BCIS lower-quartile benchmark for scheme type","RLV per-acre sanity check: warns >£500k/acre, errors >£750k/acre","Dev profit row in breakdown table now highlighted red when below 15%","Each warning explains the £ impact so user understands why it matters"]},
  {v:"9.25", date:"Jun 2026", headline:"Show/hide password toggle on login screen",
   affectsCalc:false,
   changes:["👁 Eye button in the password field — tap to reveal what you're typing","🙈 Tap again to hide","Helps avoid typos especially on mobile and when registering new accounts"]},
  {v:"9.24", date:"Jun 2026", headline:"Per-deal access control (viewers + editors)",
   affectsCalc:false,
   changes:["New 'Access' sheet in Google Sheet: dealId | viewers (read) | editors (edit)","Two settings: globalPortfolio (admin override) + defaultPrivacy ('private' / 'team')","Portfolio cards show OWNER / EDITOR / VIEW badge","View-only users see '🔒 View only' instead of Save Deal","Delete hidden for viewers","Use '*' in viewers for whole-team share","Creator always has full access regardless of Access sheet"]},
  {v:"9.23", date:"Jun 2026", headline:"Global portfolio toggle (backend setting)",
   affectsCalc:false,
   changes:["New 'Settings' sheet in Google Sheet backend with toggleable globalPortfolio flag","When ON: all signed-in users see all deals — team-wide visibility","When OFF (default): each user sees only their own deals","Portfolio header shows 'Team Portfolio · Global mode active' when on","Deal cards show 'By: [user]' so creator is always visible","Audit log records who deleted what, including global-mode flag at time of action"]},
  {v:"9.22", date:"Jun 2026", headline:"Deal export / import for team sharing",
   affectsCalc:false,
   changes:["⬇ Export button: download any deal as a portable JSON file","⬆ Import button: load a deal exported from another account","Identity-bound fields stripped on export so deals land cleanly in target account","Migration runs on import so deals from older versions auto-update","Enables team workflow: shared Cassidy account where everyone imports/exports deals"]},
  {v:"9.21", date:"Jun 2026", headline:"Propagation Audit diagnostic stage",
   affectsCalc:false,
   changes:["New 'Propagation Audit' stage (group 7) lists every shared field across stages","Drift / partial / sync / empty status per field","One-click 'Sync' per row + 'Auto-fix all propagation' button","Covers: site facts, units, AH%, S106, finance, build cost, sale PSF, timeline, yield, grants, GDV"]},
  {v:"9.20", date:"Jun 2026", headline:"Scenario drift detection + one-click re-sync",
   affectsCalc:false,
   changes:["SFH and Planning scenario banners now detect when stage values drift from the active scenario","Amber 'Drift detected' indicator lists which fields don't match","One-click 'Re-sync from scenario' button to fix drift without overwriting manual entries elsewhere","Pre-action confirmation dialog shows exactly what will change"]},
  {v:"9.19", date:"Jun 2026", headline:"Scenario propagation extended to scheme-specific stages",
   affectsCalc:true,
   changes:["Scenario Apply now writes to SFH House Mix, BTR/PBSA Block, Tenure Mix, Capitalisation","Auto-migration retroactively populates these stages on load for older scenario-applied deals","Active scenario context banner added to SFH House Mix","Capitalisation: applied scenarios now bump target yield by the scenario's yield-adjustment penalty"]},
  {v:"9.18", date:"Jun 2026", headline:"Cross-stage propagation fixes (units, S106, AH%)",
   affectsCalc:true,
   changes:["Scenario Apply now writes S106pu to Planning, RLV and Fin (was only writing to land.scenarioS106pu)","Scenario Apply writes BOTH ahPct AND afhPct fields (legacy dual naming was leaving Planning AH empty)","Unit-count sync warnings on Planning and RLV stages with one-click resolution","Planning stage now shows AH% input for ALL scheme types (was BTR-only)","Planning stage now shows S106 per-unit input (clearer than total)","Active scenario context banner now appears on Planning stage too"]},
  {v:"9.17", date:"May 2026", headline:"Automatic deal migration on portfolio load",
   affectsCalc:false,
   changes:["Deals loaded from portfolio auto-fix structural issues (schType mismatch, stale slider cache)","Migration banner shows what was changed with full audit trail","'Restore previous values' button if you disagree with auto-fixes","Manual-review flag for numeric fields that look unusual but might be user overrides"]},
  {v:"9.16", date:"May 2026", headline:"Version-aware migration banners for old saved deals",
   affectsCalc:false,
   changes:["Per-deal version stamping on save","Migration banner on load when versions differ","Reset RLV defaults action for stale slider-overwritten inputs"]},
  {v:"9.15", date:"May 2026", headline:"RLV scheme-type + isolated sensitivity sliders",
   affectsCalc:true,
   changes:["Build cost now uses scheme-correct default (SFH = £195/sqft, not £220)","Sensitivity sliders compute each variable in isolation (was: sliders interfered)","Acquisition costs now included in slider calcs","Scheme-type mismatch warning + one-click fix"]},
  {v:"9.14", date:"May 2026", headline:"Save As New Deal",
   affectsCalc:false,
   changes:["🔀 Save As button — duplicate deal under new name for testing alternative scheme types"]},
  {v:"9.13", date:"May 2026", headline:"Planning Scenarios engine",
   affectsCalc:true,
   changes:["5 planning scenarios on Land Appraisal with probability-weighted expected value","Apply scenario → propagates land value, AH%, S106, finance rate, timeline to RLV/Planning/Fin/Exit","Dashboard banner shows active scenario"]},
  {v:"9.12", date:"May 2026", headline:"Acreage + planning-status aware land benchmark",
   affectsCalc:true,
   changes:["Land value benchmark now uses £/acre × actual acreage (was: fixed total)","5 planning tiers with different multipliers","AI grounding rules to prevent inventing missing data"]},
  {v:"9.11", date:"May 2026", headline:"Full UK market data",
   affectsCalc:false,
   changes:["544 postcodes, 449 PSF entries, 430 cities covering whole UK","Maldon-specific market data added"]},
  {v:"9.10", date:"May 2026", headline:"Killed stale Manchester references",
   affectsCalc:true,
   changes:["RLV no longer silently falls back to Manchester data","Essex/Herts/Kent/Surrey postcodes added","Transparency banner when location is unknown"]},
  {v:"9.9", date:"May 2026", headline:"Land value benchmark transparency",
   affectsCalc:true,
   changes:["Fallback warning when city data unavailable","Per-acre indication added"]}
];
function semverCompare(a,b){
  var aParts=String(a||"0.0").split(".").map(Number);
  var bParts=String(b||"0.0").split(".").map(Number);
  for(var i=0;i<Math.max(aParts.length,bParts.length);i++){
    var av=aParts[i]||0,bv=bParts[i]||0;
    if(av!==bv)return av<bv?-1:1;
  }
  return 0;
}
function calcAffectingChangesSince(oldVersion){
  if(!oldVersion) return VERSION_HISTORY.filter(function(v){return v.affectsCalc;});
  return VERSION_HISTORY.filter(function(v){return v.affectsCalc && semverCompare(v.v,oldVersion)>0;});
}
var EXPIRY  = new Date("2027-12-31");
var LOGO    = "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";

// v9.83 — Cassidy Group Ltd lockup as crisp inline SVG (navy badge + two-tone gold
// INTERLOCKING C's + "CASSIDY GROUP LTD"). Vector, so it stays sharp at any size on
// a white background. A vector recreation of the brand mark — swap in the real
// artwork here if a high-res file becomes available.
// v9.84 — the real Cassidy Group Ltd logo (interlocking 3D C's + wordmark),
// lifted from the brand artwork onto a white background. Used on the sign-in screen.
var BRAND_LOGO_PNG = "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";

var BRAND_LOGO_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 172" width="100%" height="100%" font-family="DM Sans, Arial, sans-serif">'
  + '<rect x="74" y="2" width="72" height="72" rx="18" fill="#2E2F8A"/>'
  + '<path d="M112 24 A14 14 0 1 0 118 34" fill="none" stroke="#F1B93C" stroke-width="7.5" stroke-linecap="round"/>'
  + '<path d="M108 52 A14 14 0 1 0 102 42" fill="none" stroke="#F5E4A0" stroke-width="7.5" stroke-linecap="round"/>'
  + '<text x="110" y="122" text-anchor="middle" font-size="34" font-weight="800" letter-spacing="3" fill="#28286E">CASSIDY</text>'
  + '<line x1="60" y1="142" x2="160" y2="142" stroke="#C9A94A" stroke-width="1.5"/>'
  + '<text x="110" y="164" text-anchor="middle" font-size="15" font-weight="700" letter-spacing="7" fill="#2E2F8A">GROUP LTD</text>'
  + '</svg>';

var MKT = {
  london:{btr:2450,pbsa:380,yield:0.042,land:18000000,build:290},
  manchester:{btr:1380,pbsa:195,yield:0.046,land:4200000,build:215},
  birmingham:{btr:1180,pbsa:175,yield:0.047,land:3800000,build:210},
  leeds:{btr:1120,pbsa:168,yield:0.048,land:3200000,build:205},
  bristol:{btr:1650,pbsa:215,yield:0.045,land:5500000,build:230},
  edinburgh:{btr:1750,pbsa:230,yield:0.044,land:6000000,build:235},
  liverpool:{btr:980,pbsa:155,yield:0.049,land:2600000,build:200},
  sheffield:{btr:950,pbsa:148,yield:0.049,land:2200000,build:198},
  nottingham:{btr:850,pbsa:148,yield:0.049,land:1800000,build:192},
  coventry:{btr:820,pbsa:145,yield:0.050,land:1600000,build:190},
  rugby:{btr:900,pbsa:140,yield:0.049,land:1700000,build:190},
  leicester:{btr:800,pbsa:142,yield:0.050,land:1500000,build:188},
  newcastle:{btr:820,pbsa:145,yield:0.049,land:1600000,build:190},
  glasgow:{btr:900,pbsa:158,yield:0.049,land:1900000,build:198},
  cardiff:{btr:880,pbsa:148,yield:0.049,land:1700000,build:192},
  oxford:{btr:1800,pbsa:280,yield:0.043,land:8000000,build:265},
  cambridge:{btr:1900,pbsa:295,yield:0.043,land:9000000,build:268},
  reading:{btr:1350,pbsa:195,yield:0.045,land:5000000,build:225},
  brighton:{btr:1500,pbsa:210,yield:0.045,land:5500000,build:235},
  bath:{btr:1600,pbsa:210,yield:0.045,land:6500000,build:240},
  york:{btr:1050,pbsa:165,yield:0.048,land:3000000,build:208},
  exeter:{btr:1050,pbsa:165,yield:0.048,land:2900000,build:208},
  chester:{btr:950,pbsa:155,yield:0.049,land:2200000,build:200},
  derby:{btr:800,pbsa:138,yield:0.050,land:1500000,build:188},
  hull:{btr:650,pbsa:125,yield:0.050,land:800000,build:178},
  harrogate:{btr:1150,pbsa:165,yield:0.048,land:3500000,build:212},
  guildford:{btr:1650,pbsa:220,yield:0.044,land:7500000,build:248},
  bournemouth:{btr:1100,pbsa:165,yield:0.048,land:3200000,build:210},
  southampton:{btr:980,pbsa:150,yield:0.049,land:2300000,build:200},
  portsmouth:{btr:950,pbsa:148,yield:0.049,land:2200000,build:198},
  worcester:{btr:850,pbsa:138,yield:0.049,land:1700000,build:190},
  wakefield:{btr:750,pbsa:130,yield:0.050,land:1100000,build:182},
  doncaster:{btr:700,pbsa:125,yield:0.050,land:950000,build:180},
  swansea:{btr:720,pbsa:135,yield:0.050,land:1000000,build:182},
  aberdeen:{btr:750,pbsa:145,yield:0.050,land:1100000,build:185},
  dundee:{btr:720,pbsa:140,yield:0.050,land:1000000,build:182},
  inverness:{btr:750,pbsa:145,yield:0.050,land:1100000,build:185},
  tewkesbury:{btr:750,pbsa:0,yield:0.050,land:850000,build:188},
  taunton:{btr:780,pbsa:0,yield:0.050,land:950000,build:188},
  bridgwater:{btr:700,pbsa:0,yield:0.050,land:750000,build:182},
  yeovil:{btr:720,pbsa:0,yield:0.050,land:800000,build:183},
  torquay:{btr:720,pbsa:0,yield:0.050,land:800000,build:182},
  plymouth:{btr:700,pbsa:145,yield:0.050,land:750000,build:180},
  truro:{btr:680,pbsa:0,yield:0.050,land:700000,build:180},
  // ── Essex / East of England (Cassidy focus area) ────────────────────
  chelmsford:{btr:1280,pbsa:175,yield:0.046,land:4500000,build:218},
  maldon:{btr:1258,pbsa:0,yield:0.047,land:3400000,build:212},
  colchester:{btr:1080,pbsa:165,yield:0.048,land:2900000,build:208},
  basildon:{btr:1150,pbsa:0,yield:0.047,land:3200000,build:212},
  chigwell:{btr:1850,pbsa:0,yield:0.044,land:7500000,build:248},
  brentwood:{btr:1550,pbsa:0,yield:0.045,land:5500000,build:235},
  southend:{btr:1100,pbsa:0,yield:0.048,land:2800000,build:208},
  // ── Kent / Surrey / SE commuter belt ────────────────────────────────
  canterbury:{btr:1180,pbsa:185,yield:0.047,land:3200000,build:215},
  maidstone:{btr:1150,pbsa:0,yield:0.047,land:3100000,build:212},
  tunbridge_wells:{btr:1450,pbsa:0,yield:0.045,land:5200000,build:228},
  woking:{btr:1480,pbsa:0,yield:0.045,land:5800000,build:232},
  // ── East Midlands / extra Midlands ──────────────────────────────────
  northampton:{btr:880,pbsa:138,yield:0.049,land:1700000,build:192},
  milton_keynes:{btr:1180,pbsa:165,yield:0.047,land:3400000,build:215},
  peterborough:{btr:850,pbsa:135,yield:0.049,land:1600000,build:188},
  // ── Hertfordshire / N London commuter ───────────────────────────────
  watford:{btr:1650,pbsa:0,yield:0.044,land:6800000,build:245},
  stevenage:{btr:1150,pbsa:0,yield:0.047,land:3100000,build:212},
  st_albans:{btr:1750,pbsa:0,yield:0.044,land:7200000,build:248},
  // Additional Essex/Herts/Kent towns derived from postcode lookup
  harlow:{btr:990,pbsa:0,yield:0.048,land:2200000,build:205},
  braintree:{btr:1050,pbsa:0,yield:0.048,land:2500000,build:208},
  bishops_stortford:{btr:1280,pbsa:0,yield:0.046,land:4200000,build:218},
  romford:{btr:1180,pbsa:0,yield:0.047,land:3400000,build:215},
  hornchurch:{btr:1280,pbsa:0,yield:0.046,land:4200000,build:218},
  upminster:{btr:1400,pbsa:0,yield:0.046,land:5000000,build:225},
  clacton:{btr:880,pbsa:0,yield:0.049,land:1700000,build:198},
  harpenden:{btr:1700,pbsa:0,yield:0.044,land:6800000,build:245},
  welwyn:{btr:1400,pbsa:0,yield:0.046,land:5200000,build:228},
  hatfield:{btr:1350,pbsa:0,yield:0.046,land:4800000,build:225},
  rickmansworth:{btr:1850,pbsa:0,yield:0.044,land:7500000,build:248},
  hemel_hempstead:{btr:1280,pbsa:0,yield:0.046,land:4200000,build:218},
  berkhamsted:{btr:1550,pbsa:0,yield:0.045,land:5800000,build:235},
  amersham:{btr:1750,pbsa:0,yield:0.044,land:7000000,build:248},
  beaconsfield:{btr:1950,pbsa:0,yield:0.043,land:8500000,build:255},
  enfield:{btr:1450,pbsa:0,yield:0.045,land:5500000,build:232},
  barnet:{btr:1650,pbsa:0,yield:0.044,land:6800000,build:245},
  potters_bar:{btr:1550,pbsa:0,yield:0.045,land:6000000,build:238},
  sevenoaks:{btr:1550,pbsa:0,yield:0.045,land:5800000,build:235},
  tonbridge:{btr:1280,pbsa:0,yield:0.046,land:4200000,build:218},
  medway:{btr:1050,pbsa:0,yield:0.048,land:2700000,build:208},
  gillingham:{btr:1000,pbsa:0,yield:0.048,land:2400000,build:205},
  margate:{btr:980,pbsa:0,yield:0.048,land:2200000,build:202},
  ramsgate:{btr:980,pbsa:0,yield:0.048,land:2200000,build:202},
  dover:{btr:880,pbsa:0,yield:0.049,land:1800000,build:198},
  folkestone:{btr:980,pbsa:0,yield:0.048,land:2200000,build:202},
  esher:{btr:1850,pbsa:0,yield:0.044,land:8000000,build:252},
  weybridge:{btr:1750,pbsa:0,yield:0.044,land:7500000,build:250},
  epsom:{btr:1550,pbsa:0,yield:0.045,land:5800000,build:235},
  leatherhead:{btr:1550,pbsa:0,yield:0.045,land:5800000,build:235},
  redhill:{btr:1280,pbsa:0,yield:0.046,land:4200000,build:218},
  reigate:{btr:1450,pbsa:0,yield:0.045,land:5500000,build:232},
  dorking:{btr:1450,pbsa:0,yield:0.045,land:5500000,build:232},
  horsham:{btr:1180,pbsa:0,yield:0.047,land:3400000,build:215},
  crawley:{btr:1080,pbsa:0,yield:0.048,land:2700000,build:208},
  benfleet:{btr:1180,pbsa:0,yield:0.047,land:3200000,build:212},
  canvey:{btr:1000,pbsa:0,yield:0.048,land:2400000,build:205},
  chigwell:{btr:1850,pbsa:0,yield:0.044,land:7500000,build:248},
  woodford:{btr:1750,pbsa:0,yield:0.044,land:7000000,build:245},
  loughton:{btr:1650,pbsa:0,yield:0.044,land:6500000,build:240},

  // ────────────────────────────────────────────────────────────────────
  // V9.11 UK-WIDE MKT DATA — covering all 74 Placona regions
  // Best-effort estimates for mid-2026. Override with local evidence.
  // ────────────────────────────────────────────────────────────────────

  // ── North East ──────────────────────────────────────────────────────
  gateshead:{btr:780,pbsa:140,yield:0.050,land:1300000,build:185},
  sunderland:{btr:720,pbsa:135,yield:0.051,land:1100000,build:182},
  durham:{btr:850,pbsa:155,yield:0.049,land:1700000,build:192},
  middlesbrough:{btr:680,pbsa:130,yield:0.052,land:850000,build:178},
  stockton:{btr:700,pbsa:0,yield:0.052,land:950000,build:180},
  hartlepool:{btr:640,pbsa:0,yield:0.053,land:700000,build:175},
  darlington:{btr:720,pbsa:0,yield:0.051,land:1100000,build:182},
  morpeth:{btr:880,pbsa:0,yield:0.049,land:1800000,build:195},
  alnwick:{btr:850,pbsa:0,yield:0.049,land:1700000,build:193},
  blyth:{btr:680,pbsa:0,yield:0.051,land:900000,build:180},
  hexham:{btr:850,pbsa:0,yield:0.049,land:1700000,build:193},
  // ── North West (rural / gaps) ───────────────────────────────────────
  carlisle:{btr:720,pbsa:138,yield:0.051,land:1100000,build:182},
  penrith:{btr:780,pbsa:0,yield:0.050,land:1400000,build:188},
  kendal:{btr:880,pbsa:0,yield:0.049,land:1800000,build:195},
  whitehaven:{btr:600,pbsa:0,yield:0.053,land:650000,build:172},
  workington:{btr:620,pbsa:0,yield:0.053,land:700000,build:175},
  windermere:{btr:1200,pbsa:0,yield:0.046,land:3500000,build:215},
  lancaster:{btr:880,pbsa:148,yield:0.049,land:1700000,build:195},
  morecambe:{btr:720,pbsa:0,yield:0.051,land:1000000,build:180},
  preston:{btr:880,pbsa:155,yield:0.049,land:1800000,build:198},
  southport:{btr:850,pbsa:0,yield:0.049,land:1700000,build:193},
  chorley:{btr:820,pbsa:0,yield:0.049,land:1500000,build:190},
  leyland:{btr:780,pbsa:0,yield:0.050,land:1300000,build:188},
  blackburn:{btr:700,pbsa:0,yield:0.051,land:950000,build:182},
  burnley:{btr:680,pbsa:0,yield:0.052,land:900000,build:180},
  blackpool:{btr:680,pbsa:0,yield:0.052,land:900000,build:180},
  chester:{btr:1080,pbsa:170,yield:0.047,land:2900000,build:208},
  birkenhead:{btr:820,pbsa:0,yield:0.049,land:1500000,build:188},
  wallasey:{btr:850,pbsa:0,yield:0.049,land:1700000,build:192},
  crewe:{btr:780,pbsa:138,yield:0.050,land:1300000,build:188},
  nantwich:{btr:920,pbsa:0,yield:0.048,land:2100000,build:200},
  northwich:{btr:850,pbsa:0,yield:0.049,land:1700000,build:195},
  macclesfield:{btr:1180,pbsa:0,yield:0.047,land:3400000,build:215},
  warrington:{btr:920,pbsa:148,yield:0.048,land:2100000,build:200},
  altrincham:{btr:1450,pbsa:0,yield:0.045,land:5500000,build:232},
  knutsford:{btr:1550,pbsa:0,yield:0.045,land:6000000,build:238},
  st_helens:{btr:780,pbsa:0,yield:0.050,land:1300000,build:188},
  widnes:{btr:720,pbsa:0,yield:0.051,land:1000000,build:182},
  runcorn:{btr:720,pbsa:0,yield:0.051,land:1000000,build:182},
  bolton:{btr:820,pbsa:0,yield:0.049,land:1500000,build:190},
  bury:{btr:850,pbsa:0,yield:0.049,land:1700000,build:193},
  oldham:{btr:780,pbsa:0,yield:0.050,land:1300000,build:188},
  rochdale:{btr:720,pbsa:0,yield:0.051,land:1000000,build:182},
  stockport:{btr:1050,pbsa:0,yield:0.048,land:2700000,build:205},
  wigan:{btr:780,pbsa:0,yield:0.050,land:1300000,build:188},
  salford:{btr:1280,pbsa:0,yield:0.046,land:4200000,build:218},
  trafford:{btr:1380,pbsa:0,yield:0.046,land:4800000,build:225},
  // ── Yorkshire (gaps) ────────────────────────────────────────────────
  scarborough:{btr:780,pbsa:0,yield:0.050,land:1300000,build:188},
  whitby:{btr:850,pbsa:0,yield:0.049,land:1700000,build:193},
  bridlington:{btr:680,pbsa:0,yield:0.052,land:900000,build:180},
  ripon:{btr:920,pbsa:0,yield:0.048,land:2100000,build:200},
  northallerton:{btr:920,pbsa:0,yield:0.048,land:2100000,build:200},
  richmond:{btr:920,pbsa:0,yield:0.048,land:2100000,build:200},
  bradford:{btr:720,pbsa:138,yield:0.051,land:1000000,build:182},
  halifax:{btr:750,pbsa:0,yield:0.050,land:1100000,build:185},
  huddersfield:{btr:780,pbsa:140,yield:0.050,land:1300000,build:188},
  wakefield:{btr:750,pbsa:130,yield:0.050,land:1100000,build:182},
  dewsbury:{btr:720,pbsa:0,yield:0.051,land:1000000,build:182},
  ilkley:{btr:1180,pbsa:0,yield:0.047,land:3400000,build:215},
  skipton:{btr:980,pbsa:0,yield:0.048,land:2400000,build:202},
  rotherham:{btr:680,pbsa:0,yield:0.052,land:900000,build:180},
  barnsley:{btr:680,pbsa:0,yield:0.052,land:900000,build:180},
  doncaster:{btr:700,pbsa:125,yield:0.050,land:950000,build:180},
  scunthorpe:{btr:680,pbsa:0,yield:0.052,land:850000,build:178},
  grimsby:{btr:660,pbsa:0,yield:0.052,land:800000,build:176},
  beverley:{btr:880,pbsa:0,yield:0.049,land:1800000,build:195},
  goole:{btr:640,pbsa:0,yield:0.053,land:750000,build:175},
  // ── East Midlands (gaps) ────────────────────────────────────────────
  lincoln:{btr:780,pbsa:145,yield:0.050,land:1300000,build:188},
  boston:{btr:680,pbsa:0,yield:0.052,land:850000,build:178},
  spalding:{btr:680,pbsa:0,yield:0.052,land:850000,build:178},
  stamford:{btr:920,pbsa:0,yield:0.048,land:2100000,build:200},
  grantham:{btr:780,pbsa:0,yield:0.050,land:1300000,build:188},
  kettering:{btr:820,pbsa:0,yield:0.049,land:1500000,build:190},
  corby:{btr:720,pbsa:0,yield:0.051,land:1000000,build:182},
  wellingborough:{btr:780,pbsa:0,yield:0.050,land:1300000,build:188},
  daventry:{btr:820,pbsa:0,yield:0.049,land:1500000,build:190},
  oakham:{btr:1080,pbsa:0,yield:0.047,land:2900000,build:208},
  mansfield:{btr:680,pbsa:0,yield:0.052,land:900000,build:180},
  newark:{btr:850,pbsa:0,yield:0.049,land:1700000,build:193},
  matlock:{btr:920,pbsa:0,yield:0.048,land:2100000,build:200},
  bakewell:{btr:1050,pbsa:0,yield:0.048,land:2700000,build:205},
  buxton:{btr:850,pbsa:0,yield:0.049,land:1700000,build:193},
  // ── West Midlands (rural) ───────────────────────────────────────────
  hereford:{btr:850,pbsa:138,yield:0.049,land:1700000,build:193},
  shrewsbury:{btr:920,pbsa:148,yield:0.048,land:2100000,build:200},
  ludlow:{btr:980,pbsa:0,yield:0.048,land:2400000,build:202},
  oswestry:{btr:780,pbsa:0,yield:0.050,land:1300000,build:188},
  bromsgrove:{btr:1050,pbsa:0,yield:0.048,land:2700000,build:205},
  malvern:{btr:1080,pbsa:0,yield:0.047,land:2900000,build:208},
  sutton_coldfield:{btr:1280,pbsa:0,yield:0.046,land:4200000,build:218},
  west_bromwich:{btr:780,pbsa:0,yield:0.050,land:1300000,build:188},
  smethwick:{btr:780,pbsa:0,yield:0.050,land:1300000,build:188},
  halesowen:{btr:920,pbsa:0,yield:0.048,land:2100000,build:200},
  // ── East of England (Norfolk / Suffolk / Cambs rural) ───────────────
  norwich:{btr:980,pbsa:165,yield:0.048,land:2400000,build:202},
  great_yarmouth:{btr:680,pbsa:0,yield:0.052,land:900000,build:180},
  kings_lynn:{btr:780,pbsa:0,yield:0.050,land:1300000,build:188},
  dereham:{btr:780,pbsa:0,yield:0.050,land:1300000,build:188},
  fakenham:{btr:850,pbsa:0,yield:0.049,land:1700000,build:193},
  cromer:{btr:920,pbsa:0,yield:0.048,land:2100000,build:200},
  lowestoft:{btr:680,pbsa:0,yield:0.052,land:900000,build:180},
  ipswich:{btr:980,pbsa:148,yield:0.048,land:2400000,build:202},
  bury_st_edmunds:{btr:1050,pbsa:0,yield:0.048,land:2700000,build:205},
  felixstowe:{btr:980,pbsa:0,yield:0.048,land:2400000,build:202},
  woodbridge:{btr:1180,pbsa:0,yield:0.047,land:3400000,build:215},
  stowmarket:{btr:850,pbsa:0,yield:0.049,land:1700000,build:193},
  ely:{btr:1080,pbsa:0,yield:0.047,land:2900000,build:208},
  huntingdon:{btr:920,pbsa:0,yield:0.048,land:2100000,build:200},
  st_neots:{btr:1050,pbsa:0,yield:0.048,land:2700000,build:205},
  st_ives:{btr:1080,pbsa:0,yield:0.047,land:2900000,build:208},
  newmarket:{btr:1050,pbsa:0,yield:0.048,land:2700000,build:205},
  saffron_walden:{btr:1180,pbsa:0,yield:0.047,land:3400000,build:215},
  thetford:{btr:780,pbsa:0,yield:0.050,land:1300000,build:188},
  wisbech:{btr:680,pbsa:0,yield:0.052,land:900000,build:180},
  flitwick:{btr:980,pbsa:0,yield:0.048,land:2400000,build:202},
  bedford:{btr:980,pbsa:138,yield:0.048,land:2400000,build:202},
  luton:{btr:1050,pbsa:138,yield:0.048,land:2700000,build:205},
  leighton_buzzard:{btr:1080,pbsa:0,yield:0.047,land:2900000,build:208},
  // ── Greater London (already covered, but enrich outer boroughs) ─────
  // (handled by london MKT entry — postcodes all map to "london")
  // ── South East (Hampshire / Berks / Bucks / Oxon / IoW) ─────────────
  winchester:{btr:1450,pbsa:0,yield:0.045,land:5500000,build:232},
  basingstoke:{btr:1180,pbsa:0,yield:0.047,land:3400000,build:215},
  fareham:{btr:1180,pbsa:0,yield:0.047,land:3400000,build:215},
  gosport:{btr:980,pbsa:0,yield:0.048,land:2400000,build:202},
  havant:{btr:1050,pbsa:0,yield:0.048,land:2700000,build:205},
  eastleigh:{btr:1180,pbsa:0,yield:0.047,land:3400000,build:215},
  romsey:{btr:1280,pbsa:0,yield:0.046,land:4200000,build:218},
  newport_iow:{btr:880,pbsa:0,yield:0.049,land:1700000,build:193},
  ryde:{btr:880,pbsa:0,yield:0.049,land:1700000,build:193},
  bracknell:{btr:1280,pbsa:0,yield:0.046,land:4200000,build:218},
  newbury:{btr:1280,pbsa:0,yield:0.046,land:4200000,build:218},
  henley:{btr:1850,pbsa:0,yield:0.044,land:7500000,build:248},
  wokingham:{btr:1450,pbsa:0,yield:0.045,land:5500000,build:232},
  high_wycombe:{btr:1280,pbsa:0,yield:0.046,land:4200000,build:218},
  aylesbury:{btr:1080,pbsa:0,yield:0.047,land:2900000,build:208},
  buckingham:{btr:1180,pbsa:0,yield:0.047,land:3400000,build:215},
  bicester:{btr:1180,pbsa:0,yield:0.047,land:3400000,build:215},
  banbury:{btr:980,pbsa:0,yield:0.048,land:2400000,build:202},
  abingdon:{btr:1280,pbsa:0,yield:0.046,land:4200000,build:218},
  witney:{btr:1080,pbsa:0,yield:0.047,land:2900000,build:208},
  didcot:{btr:1080,pbsa:0,yield:0.047,land:2900000,build:208},
  // ── South West (gaps) ───────────────────────────────────────────────
  gloucester:{btr:880,pbsa:148,yield:0.049,land:1800000,build:195},
  cheltenham:{btr:1280,pbsa:165,yield:0.046,land:4200000,build:218},
  stroud:{btr:1050,pbsa:0,yield:0.048,land:2700000,build:205},
  cirencester:{btr:1280,pbsa:0,yield:0.046,land:4200000,build:218},
  poole:{btr:1280,pbsa:0,yield:0.046,land:4200000,build:218},
  weymouth:{btr:880,pbsa:0,yield:0.049,land:1700000,build:193},
  bridport:{btr:1080,pbsa:0,yield:0.047,land:2900000,build:208},
  taunton:{btr:780,pbsa:0,yield:0.050,land:950000,build:188},
  bridgwater:{btr:700,pbsa:0,yield:0.050,land:750000,build:182},
  yeovil:{btr:720,pbsa:0,yield:0.050,land:800000,build:183},
  wells:{btr:1080,pbsa:0,yield:0.047,land:2900000,build:208},
  glastonbury:{btr:880,pbsa:0,yield:0.049,land:1800000,build:195},
  exeter:{btr:1050,pbsa:165,yield:0.048,land:2900000,build:208},
  plymouth:{btr:700,pbsa:145,yield:0.050,land:750000,build:180},
  torquay:{btr:720,pbsa:0,yield:0.050,land:800000,build:182},
  truro:{btr:880,pbsa:0,yield:0.049,land:1700000,build:193},
  newquay:{btr:780,pbsa:0,yield:0.050,land:1300000,build:185},
  penzance:{btr:780,pbsa:0,yield:0.050,land:1300000,build:185},
  bideford:{btr:720,pbsa:0,yield:0.050,land:1000000,build:182},
  barnstaple:{btr:780,pbsa:0,yield:0.050,land:1300000,build:185},
  // ── Wales ───────────────────────────────────────────────────────────
  newport:{btr:850,pbsa:140,yield:0.049,land:1700000,build:193},
  bridgend:{btr:780,pbsa:0,yield:0.050,land:1300000,build:188},
  caerphilly:{btr:780,pbsa:0,yield:0.050,land:1300000,build:188},
  pontypridd:{btr:720,pbsa:0,yield:0.051,land:1000000,build:182},
  merthyr_tydfil:{btr:660,pbsa:0,yield:0.052,land:850000,build:178},
  rhondda:{btr:640,pbsa:0,yield:0.053,land:750000,build:175},
  porthcawl:{btr:920,pbsa:0,yield:0.048,land:2100000,build:200},
  barry:{btr:880,pbsa:0,yield:0.049,land:1800000,build:195},
  penarth:{btr:1080,pbsa:0,yield:0.047,land:2900000,build:208},
  monmouth:{btr:1080,pbsa:0,yield:0.047,land:2900000,build:208},
  chepstow:{btr:980,pbsa:0,yield:0.048,land:2400000,build:202},
  abergavenny:{btr:920,pbsa:0,yield:0.048,land:2100000,build:200},
  carmarthen:{btr:780,pbsa:0,yield:0.050,land:1300000,build:188},
  llanelli:{btr:680,pbsa:0,yield:0.052,land:900000,build:180},
  neath:{btr:680,pbsa:0,yield:0.052,land:900000,build:180},
  port_talbot:{btr:680,pbsa:0,yield:0.052,land:900000,build:180},
  tenby:{btr:980,pbsa:0,yield:0.048,land:2400000,build:202},
  pembroke:{btr:780,pbsa:0,yield:0.050,land:1300000,build:188},
  haverfordwest:{btr:780,pbsa:0,yield:0.050,land:1300000,build:188},
  fishguard:{btr:720,pbsa:0,yield:0.051,land:1000000,build:182},
  cardigan:{btr:780,pbsa:0,yield:0.050,land:1300000,build:188},
  aberystwyth:{btr:880,pbsa:145,yield:0.049,land:1700000,build:193},
  machynlleth:{btr:780,pbsa:0,yield:0.050,land:1300000,build:188},
  welshpool:{btr:780,pbsa:0,yield:0.050,land:1300000,build:188},
  newtown:{btr:680,pbsa:0,yield:0.052,land:900000,build:180},
  brecon:{btr:920,pbsa:0,yield:0.048,land:2100000,build:200},
  builth_wells:{btr:880,pbsa:0,yield:0.049,land:1800000,build:195},
  llandrindod_wells:{btr:780,pbsa:0,yield:0.050,land:1300000,build:188},
  wrexham:{btr:780,pbsa:140,yield:0.050,land:1300000,build:188},
  denbigh:{btr:850,pbsa:0,yield:0.049,land:1700000,build:193},
  rhyl:{btr:680,pbsa:0,yield:0.052,land:900000,build:180},
  prestatyn:{btr:780,pbsa:0,yield:0.050,land:1300000,build:188},
  llandudno:{btr:980,pbsa:0,yield:0.048,land:2400000,build:202},
  colwyn_bay:{btr:780,pbsa:0,yield:0.050,land:1300000,build:188},
  conwy:{btr:980,pbsa:0,yield:0.048,land:2400000,build:202},
  bangor:{btr:850,pbsa:148,yield:0.049,land:1700000,build:193},
  caernarfon:{btr:780,pbsa:0,yield:0.050,land:1300000,build:188},
  pwllheli:{btr:920,pbsa:0,yield:0.048,land:2100000,build:200},
  porthmadog:{btr:880,pbsa:0,yield:0.049,land:1800000,build:195},
  holyhead:{btr:680,pbsa:0,yield:0.052,land:900000,build:180},
  // ── Scotland ────────────────────────────────────────────────────────
  bearsden:{btr:1280,pbsa:0,yield:0.046,land:4200000,build:218},
  east_kilbride:{btr:880,pbsa:0,yield:0.049,land:1800000,build:195},
  hamilton:{btr:780,pbsa:0,yield:0.050,land:1300000,build:188},
  motherwell:{btr:720,pbsa:0,yield:0.051,land:1000000,build:182},
  paisley:{btr:780,pbsa:0,yield:0.050,land:1300000,build:188},
  greenock:{btr:680,pbsa:0,yield:0.052,land:900000,build:180},
  kilmarnock:{btr:720,pbsa:0,yield:0.051,land:1000000,build:182},
  ayr:{btr:850,pbsa:0,yield:0.049,land:1700000,build:193},
  troon:{btr:980,pbsa:0,yield:0.048,land:2400000,build:202},
  irvine:{btr:720,pbsa:0,yield:0.051,land:1000000,build:182},
  livingston:{btr:880,pbsa:0,yield:0.049,land:1800000,build:195},
  bathgate:{btr:780,pbsa:0,yield:0.050,land:1300000,build:188},
  linlithgow:{btr:1080,pbsa:0,yield:0.047,land:2900000,build:208},
  haddington:{btr:1080,pbsa:0,yield:0.047,land:2900000,build:208},
  north_berwick:{btr:1280,pbsa:0,yield:0.046,land:4200000,build:218},
  musselburgh:{btr:980,pbsa:0,yield:0.048,land:2400000,build:202},
  dalkeith:{btr:920,pbsa:0,yield:0.048,land:2100000,build:200},
  penicuik:{btr:1080,pbsa:0,yield:0.047,land:2900000,build:208},
  peebles:{btr:1080,pbsa:0,yield:0.047,land:2900000,build:208},
  galashiels:{btr:780,pbsa:0,yield:0.050,land:1300000,build:188},
  hawick:{btr:680,pbsa:0,yield:0.052,land:900000,build:180},
  kelso:{btr:880,pbsa:0,yield:0.049,land:1800000,build:195},
  jedburgh:{btr:780,pbsa:0,yield:0.050,land:1300000,build:188},
  dumfries:{btr:720,pbsa:0,yield:0.051,land:1000000,build:182},
  stranraer:{btr:640,pbsa:0,yield:0.053,land:750000,build:175},
  annan:{btr:720,pbsa:0,yield:0.051,land:1000000,build:182},
  kirkcaldy:{btr:780,pbsa:0,yield:0.050,land:1300000,build:188},
  glenrothes:{btr:720,pbsa:0,yield:0.051,land:1000000,build:182},
  dunfermline:{btr:850,pbsa:0,yield:0.049,land:1700000,build:193},
  st_andrews:{btr:1450,pbsa:165,yield:0.045,land:5500000,build:232},
  cupar:{btr:880,pbsa:0,yield:0.049,land:1800000,build:195},
  stirling:{btr:920,pbsa:155,yield:0.048,land:2100000,build:200},
  alloa:{btr:720,pbsa:0,yield:0.051,land:1000000,build:182},
  dunblane:{btr:1280,pbsa:0,yield:0.046,land:4200000,build:218},
  callander:{btr:1180,pbsa:0,yield:0.047,land:3400000,build:215},
  falkirk:{btr:780,pbsa:0,yield:0.050,land:1300000,build:188},
  grangemouth:{btr:680,pbsa:0,yield:0.052,land:900000,build:180},
  perth:{btr:880,pbsa:148,yield:0.049,land:1800000,build:195},
  crieff:{btr:1080,pbsa:0,yield:0.047,land:2900000,build:208},
  pitlochry:{btr:980,pbsa:0,yield:0.048,land:2400000,build:202},
  aviemore:{btr:1080,pbsa:0,yield:0.047,land:2900000,build:208},
  fort_william:{btr:880,pbsa:0,yield:0.049,land:1800000,build:195},
  oban:{btr:980,pbsa:0,yield:0.048,land:2400000,build:202},
  inverness:{btr:850,pbsa:0,yield:0.049,land:1700000,build:195},
  nairn:{btr:920,pbsa:0,yield:0.048,land:2100000,build:200},
  elgin:{btr:780,pbsa:0,yield:0.050,land:1300000,build:188},
  forres:{btr:780,pbsa:0,yield:0.050,land:1300000,build:188},
  ullapool:{btr:880,pbsa:0,yield:0.049,land:1800000,build:195},
  portree:{btr:980,pbsa:0,yield:0.048,land:2400000,build:202},
  thurso:{btr:680,pbsa:0,yield:0.052,land:900000,build:180},
  wick:{btr:640,pbsa:0,yield:0.053,land:750000,build:175},
  kirkwall:{btr:720,pbsa:0,yield:0.051,land:1000000,build:182},
  lerwick:{btr:780,pbsa:0,yield:0.050,land:1300000,build:188},
  stornoway:{btr:720,pbsa:0,yield:0.051,land:1000000,build:182},
  banchory:{btr:1080,pbsa:0,yield:0.047,land:2900000,build:208},
  stonehaven:{btr:980,pbsa:0,yield:0.048,land:2400000,build:202},
  fraserburgh:{btr:680,pbsa:0,yield:0.052,land:900000,build:180},
  peterhead:{btr:680,pbsa:0,yield:0.052,land:900000,build:180},
  ellon:{btr:920,pbsa:0,yield:0.048,land:2100000,build:200},
  inverurie:{btr:920,pbsa:0,yield:0.048,land:2100000,build:200},
  huntly:{btr:780,pbsa:0,yield:0.050,land:1300000,build:188},
  arbroath:{btr:720,pbsa:0,yield:0.051,land:1000000,build:182},
  montrose:{btr:720,pbsa:0,yield:0.051,land:1000000,build:182},
  forfar:{btr:780,pbsa:0,yield:0.050,land:1300000,build:188},
  brechin:{btr:720,pbsa:0,yield:0.051,land:1000000,build:182},
  carnoustie:{btr:880,pbsa:0,yield:0.049,land:1800000,build:195},
  // ── Northern Ireland ────────────────────────────────────────────────
  belfast:{btr:850,pbsa:148,yield:0.049,land:1700000,build:195},
  bangor_ni:{btr:880,pbsa:0,yield:0.049,land:1800000,build:198},
  newtownards:{btr:780,pbsa:0,yield:0.050,land:1300000,build:188},
  newtownabbey:{btr:780,pbsa:0,yield:0.050,land:1300000,build:188},
  lisburn:{btr:850,pbsa:0,yield:0.049,land:1700000,build:195},
  carrickfergus:{btr:720,pbsa:0,yield:0.051,land:1000000,build:182},
  ballymena:{btr:720,pbsa:0,yield:0.051,land:1000000,build:182},
  antrim:{btr:720,pbsa:0,yield:0.051,land:1000000,build:182},
  larne:{btr:680,pbsa:0,yield:0.052,land:900000,build:180},
  ballymoney:{btr:680,pbsa:0,yield:0.052,land:900000,build:180},
  ballyclare:{btr:780,pbsa:0,yield:0.050,land:1300000,build:188},
  coleraine:{btr:720,pbsa:0,yield:0.051,land:1000000,build:182},
  portrush:{btr:920,pbsa:0,yield:0.048,land:2100000,build:200},
  portstewart:{btr:880,pbsa:0,yield:0.049,land:1800000,build:195},
  londonderry:{btr:680,pbsa:140,yield:0.052,land:900000,build:180},
  limavady:{btr:680,pbsa:0,yield:0.052,land:900000,build:180},
  magherafelt:{btr:720,pbsa:0,yield:0.051,land:1000000,build:182},
  cookstown:{btr:680,pbsa:0,yield:0.052,land:900000,build:180},
  omagh:{btr:680,pbsa:0,yield:0.052,land:900000,build:180},
  strabane:{btr:640,pbsa:0,yield:0.053,land:750000,build:175},
  enniskillen:{btr:720,pbsa:0,yield:0.051,land:1000000,build:182},
  dungannon:{btr:680,pbsa:0,yield:0.052,land:900000,build:180},
  craigavon:{btr:680,pbsa:0,yield:0.052,land:900000,build:180},
  armagh:{btr:720,pbsa:0,yield:0.051,land:1000000,build:182},
  banbridge:{btr:780,pbsa:0,yield:0.050,land:1300000,build:188},
  newry:{btr:720,pbsa:0,yield:0.051,land:1000000,build:182},
  downpatrick:{btr:780,pbsa:0,yield:0.050,land:1300000,build:188},
  holywood:{btr:980,pbsa:0,yield:0.048,land:2400000,build:202},
  hillsborough:{btr:1080,pbsa:0,yield:0.047,land:2900000,build:208},
  // ── Catch-all small UK towns referenced via postcodes ───────────────
  // These point to "use the parent district" values via cityName when displayed
  // For any town with no entry here, the system uses national fallback + warns user (v9.10 behaviour)
  newquay:{btr:680,pbsa:130,yield:0.050,land:650000,build:178},
  salisbury:{btr:820,pbsa:0,yield:0.049,land:1200000,build:190},
  swindon:{btr:780,pbsa:0,yield:0.050,land:950000,build:185},
  dorchester:{btr:750,pbsa:0,yield:0.050,land:900000,build:183},
  weymouth:{btr:720,pbsa:0,yield:0.050,land:800000,build:182},
  barnstaple:{btr:680,pbsa:0,yield:0.050,land:680000,build:178},
  weston_super_mare:{btr:700,pbsa:0,yield:0.050,land:750000,build:180},
  tunbridge_wells:{btr:980,pbsa:0,yield:0.049,land:1900000,build:205},
  maidstone:{btr:820,pbsa:0,yield:0.050,land:1100000,build:190},
  crawley:{btr:850,pbsa:0,yield:0.049,land:1300000,build:192},
  horsham:{btr:900,pbsa:0,yield:0.049,land:1500000,build:195},
  woking:{btr:980,pbsa:0,yield:0.049,land:1900000,build:205},
  gloucester:{btr:780,pbsa:145,yield:0.050,land:950000,build:188},
  cheltenham:{btr:950,pbsa:165,yield:0.049,land:1800000,build:200},
  hereford:{btr:700,pbsa:0,yield:0.050,land:700000,build:182},
  shrewsbury:{btr:720,pbsa:0,yield:0.050,land:750000,build:183},
  stafford:{btr:720,pbsa:0,yield:0.050,land:800000,build:183},
  lichfield:{btr:800,pbsa:0,yield:0.049,land:1100000,build:188},
  telford:{btr:680,pbsa:0,yield:0.050,land:700000,build:180},
  redditch:{btr:720,pbsa:0,yield:0.050,land:900000,build:183},
  warwick:{btr:900,pbsa:155,yield:0.049,land:1600000,build:195},
  leamington:{btr:950,pbsa:160,yield:0.049,land:1800000,build:198},
  stratford:{btr:850,pbsa:0,yield:0.049,land:1400000,build:192},
  banbury:{btr:820,pbsa:0,yield:0.049,land:1200000,build:190},
  northampton:{btr:780,pbsa:140,yield:0.050,land:1000000,build:186},
  milton_keynes:{btr:980,pbsa:155,yield:0.049,land:1900000,build:200},
  bedford:{btr:820,pbsa:140,yield:0.049,land:1100000,build:190},
  luton:{btr:850,pbsa:145,yield:0.049,land:1200000,build:192},
  stevenage:{btr:900,pbsa:0,yield:0.049,land:1400000,build:195},
  cambridge_rural:{btr:950,pbsa:0,yield:0.049,land:1600000,build:198},
  stoke:{btr:680,pbsa:0,yield:0.050,land:700000,build:178},
  tamworth:{btr:720,pbsa:0,yield:0.050,land:850000,build:182},
  burton:{btr:700,pbsa:0,yield:0.050,land:780000,build:180},
  cannock:{btr:700,pbsa:0,yield:0.050,land:750000,build:180},
  walsall:{btr:680,pbsa:0,yield:0.050,land:700000,build:178},
  wolverhampton:{btr:720,pbsa:0,yield:0.050,land:850000,build:182},
  dudley:{btr:680,pbsa:0,yield:0.050,land:700000,build:178},
  solihull:{btr:920,pbsa:0,yield:0.049,land:1700000,build:198},
};

var PC_CITY = {
  SW1:"london",SW3:"london",SW7:"london",W1:"london",WC1:"london",EC1:"london",
  EC2:"london",N1:"london",NW1:"london",NW3:"london",E1:"london",E2:"london",
  E14:"london",SE1:"london",SW4:"london",SW8:"london",SW11:"london",SW18:"london",
  W4:"london",W6:"london",W11:"london",TW9:"london",KT1:"london",HA1:"london",
  CR0:"london",BR1:"london",IG1:"london",RM1:"london",
  M1:"manchester",M2:"manchester",M3:"manchester",M4:"manchester",M5:"manchester",
  M14:"manchester",M15:"manchester",M16:"manchester",M20:"manchester",M21:"manchester",
  M25:"manchester",M33:"manchester",SK8:"manchester",SK9:"manchester",
  B1:"birmingham",B2:"birmingham",B3:"birmingham",B5:"birmingham",B13:"birmingham",
  B15:"birmingham",B17:"birmingham",B29:"birmingham",B30:"birmingham",
  CV1:"coventry",CV2:"coventry",CV3:"coventry",CV4:"coventry",CV5:"coventry",
  CV6:"coventry",CV7:"coventry",CV8:"coventry",
  LS1:"leeds",LS2:"leeds",LS6:"leeds",LS7:"leeds",LS8:"leeds",LS16:"leeds",LS17:"leeds",
  S1:"sheffield",S7:"sheffield",S10:"sheffield",S11:"sheffield",S17:"sheffield",
  L1:"liverpool",L2:"liverpool",L3:"liverpool",L8:"liverpool",L17:"liverpool",L18:"liverpool",
  BS1:"bristol",BS2:"bristol",BS3:"bristol",BS6:"bristol",BS7:"bristol",BS8:"bristol",BS9:"bristol",
  BA1:"bath",BA2:"bath",
  EH1:"edinburgh",EH2:"edinburgh",EH3:"edinburgh",EH4:"edinburgh",EH6:"edinburgh",
  EH8:"edinburgh",EH9:"edinburgh",EH10:"edinburgh",EH12:"edinburgh",
  G1:"glasgow",G2:"glasgow",G3:"glasgow",G11:"glasgow",G12:"glasgow",G41:"glasgow",
  CB1:"cambridge",CB2:"cambridge",CB3:"cambridge",CB4:"cambridge",
  OX1:"oxford",OX2:"oxford",OX3:"oxford",OX4:"oxford",
  RG1:"reading",RG2:"reading",GU1:"guildford",
  BN1:"brighton",BN2:"brighton",BN3:"brighton",
  NG1:"nottingham",NG7:"nottingham",NG9:"nottingham",
  DE1:"derby",DE22:"derby",LE1:"leicester",LE2:"leicester",LE3:"leicester",
  NE1:"newcastle",NE2:"newcastle",NE3:"newcastle",
  CF10:"cardiff",CF11:"cardiff",CF14:"cardiff",CF24:"cardiff",
  SA1:"swansea",SA2:"swansea",
  YO1:"york",HG1:"harrogate",
  AB10:"aberdeen",AB15:"aberdeen",DD1:"dundee",
  HU1:"hull",ST1:"stoke",WR1:"worcester",
  SO14:"southampton",PO1:"portsmouth",BH1:"bournemouth",
  GL1:"gloucester",GL2:"gloucester",GL3:"gloucester",GL50:"cheltenham",GL51:"cheltenham",GL52:"cheltenham",
  GL20:"tewkesbury",GL19:"tewkesbury",GL54:"tewkesbury",
  HR1:"hereford",HR2:"hereford",HR4:"hereford",
  SY1:"shrewsbury",SY2:"shrewsbury",SY3:"shrewsbury",
  ST16:"stafford",ST17:"stafford",ST18:"stafford",ST19:"stafford",ST20:"stafford",ST21:"stafford",
  ST1:"stoke",ST2:"stoke",ST3:"stoke",ST4:"stoke",ST5:"stoke",ST6:"stoke",ST7:"stoke",ST8:"stoke",ST9:"stoke",ST10:"stoke",ST11:"stoke",ST12:"stoke",ST13:"stoke",ST14:"stoke",ST15:"stoke",
  WS13:"lichfield",WS14:"lichfield",WS15:"lichfield",WS9:"lichfield",
  WS1:"walsall",WS2:"walsall",WS3:"walsall",WS10:"walsall",WS11:"cannock",WS12:"cannock",
  WV1:"wolverhampton",WV2:"wolverhampton",WV3:"wolverhampton",WV6:"wolverhampton",WV10:"wolverhampton",WV11:"wolverhampton",WV13:"wolverhampton",WV14:"wolverhampton",
  DY1:"dudley",DY2:"dudley",DY3:"dudley",DY8:"dudley",DY10:"dudley",
  B77:"tamworth",B78:"tamworth",B79:"tamworth",
  DE13:"burton",DE14:"burton",DE15:"burton",
  B90:"solihull",B91:"solihull",B92:"solihull",B93:"solihull",B94:"solihull",
  TF1:"telford",TF2:"telford",TF3:"telford",
  B97:"redditch",B98:"redditch",
  CV31:"leamington",CV32:"leamington",CV34:"warwick",
  CV37:"stratford",OX16:"banbury",
  NN1:"northampton",NN3:"northampton",
  MK9:"milton_keynes",MK6:"milton_keynes",
  MK40:"bedford",MK41:"bedford",MK42:"bedford",
  LU1:"luton",LU2:"luton",LU3:"luton",
  SG1:"stevenage",SG2:"stevenage",
  // ── Essex (Cassidy focus area) ──────────────────────────────────────
  CM1:"chelmsford",CM2:"chelmsford",CM3:"chelmsford",CM4:"chelmsford",
  CM9:"maldon",CM0:"maldon",
  CM6:"dunmow",CM7:"braintree",CM8:"witham",
  CM11:"billericay",CM12:"billericay",CM13:"brentwood",CM14:"brentwood",CM15:"brentwood",CM16:"epping",CM17:"harlow",CM18:"harlow",CM19:"harlow",CM20:"harlow",CM21:"sawbridgeworth",CM22:"bishops_stortford",CM23:"bishops_stortford",CM24:"stansted",
  CO1:"colchester",CO2:"colchester",CO3:"colchester",CO4:"colchester",CO5:"colchester",CO6:"colchester",CO7:"colchester",
  CO9:"halstead",CO10:"sudbury",CO11:"manningtree",CO12:"harwich",CO13:"frinton",CO14:"walton",CO15:"clacton",CO16:"clacton",
  SS1:"southend",SS2:"southend",SS3:"southend",SS4:"southend",SS5:"southend",SS6:"southend",SS7:"benfleet",SS8:"canvey",SS9:"southend",SS11:"wickford",SS12:"wickford",SS13:"basildon",SS14:"basildon",SS15:"basildon",SS16:"basildon",SS17:"stanford",
  IG7:"chigwell",IG8:"woodford",IG9:"buckhurst",IG10:"loughton",
  RM1:"romford",RM2:"romford",RM3:"romford",RM4:"romford",RM5:"romford",RM6:"romford",RM12:"hornchurch",RM14:"upminster",
  // ── Hertfordshire commuter belt ─────────────────────────────────────
  AL1:"st_albans",AL2:"st_albans",AL3:"st_albans",AL4:"st_albans",AL5:"harpenden",AL6:"welwyn",AL7:"welwyn",AL8:"welwyn",AL9:"hatfield",AL10:"hatfield",
  WD1:"watford",WD3:"rickmansworth",WD4:"kings_langley",WD5:"abbots_langley",WD6:"borehamwood",WD7:"radlett",WD17:"watford",WD18:"watford",WD19:"watford",WD23:"bushey",WD24:"watford",WD25:"watford",
  HP1:"hemel_hempstead",HP2:"hemel_hempstead",HP3:"hemel_hempstead",HP4:"berkhamsted",HP5:"chesham",HP7:"amersham",HP8:"chalfont",HP9:"beaconsfield",HP23:"tring",
  SG3:"stevenage",SG4:"hitchin",SG5:"hitchin",SG6:"letchworth",SG7:"baldock",SG8:"royston",SG12:"ware",SG13:"hertford",SG14:"hertford",
  EN1:"enfield",EN2:"enfield",EN5:"barnet",EN6:"potters_bar",EN7:"cheshunt",EN8:"cheshunt",EN9:"waltham_abbey",EN10:"hoddesdon",EN11:"hoddesdon",
  // ── Kent expansion ──────────────────────────────────────────────────
  CT1:"canterbury",CT2:"canterbury",CT3:"canterbury",CT4:"canterbury",CT5:"whitstable",CT6:"herne_bay",
  CT9:"margate",CT10:"broadstairs",CT11:"ramsgate",CT12:"ramsgate",CT13:"sandwich",CT14:"deal",CT15:"dover",CT16:"dover",CT17:"dover",CT18:"folkestone",CT19:"folkestone",CT20:"folkestone",CT21:"hythe",
  ME1:"medway",ME2:"medway",ME3:"medway",ME4:"medway",ME5:"chatham",ME6:"snodland",ME7:"gillingham",ME8:"gillingham",ME10:"sittingbourne",ME12:"sheerness",ME13:"faversham",ME14:"maidstone",ME15:"maidstone",ME16:"maidstone",ME17:"maidstone",ME18:"maidstone",ME19:"west_malling",ME20:"larkfield",
  TN1:"tunbridge_wells",TN2:"tunbridge_wells",TN3:"tunbridge_wells",TN4:"tunbridge_wells",TN8:"edenbridge",TN9:"tonbridge",TN10:"tonbridge",TN11:"tonbridge",TN13:"sevenoaks",TN14:"sevenoaks",TN15:"sevenoaks",
  // ── Surrey expansion ────────────────────────────────────────────────
  GU2:"guildford",GU3:"guildford",GU4:"guildford",GU5:"shere",GU7:"godalming",GU8:"witley",GU9:"farnham",GU10:"farnham",
  GU15:"camberley",GU16:"frimley",GU17:"blackwater",GU18:"lightwater",GU19:"bagshot",GU20:"windlesham",GU21:"woking",GU22:"woking",GU23:"send",GU24:"bisley",GU25:"virginia_water",
  KT10:"esher",KT11:"cobham",KT12:"walton",KT13:"weybridge",KT14:"byfleet",KT15:"addlestone",KT16:"chertsey",KT17:"ewell",KT18:"epsom",KT19:"epsom",KT20:"tadworth",KT21:"ashtead",KT22:"leatherhead",KT23:"bookham",KT24:"east_horsley",
  RH1:"redhill",RH2:"reigate",RH3:"betchworth",RH4:"dorking",RH5:"dorking",RH6:"horley",RH7:"lingfield",RH8:"oxted",RH9:"godstone",RH10:"crawley",RH11:"crawley",RH12:"horsham",RH13:"horsham",
  TW20:"egham",
  // Somerset / South West
  TA1:"taunton",TA2:"taunton",TA3:"taunton",TA4:"taunton",TA5:"taunton",
  TA6:"bridgwater",TA7:"bridgwater",TA8:"burnham_on_sea",
  TA9:"highbridge",TA10:"langport",TA11:"glastonbury",TA12:"ilminster",
  TA13:"south_petherton",TA14:"stoke_sub_hamdon",TA15:"montacute",
  TA16:"merriott",TA17:"hinton_st_george",TA18:"crewkerne",
  TA19:"ilminster",TA20:"chard",TA21:"wellington",TA22:"dulverton",
  TA23:"watchet",TA24:"minehead",
  BA1:"bath",BA2:"bath",BA3:"radstock",BA4:"shepton_mallet",
  BA5:"wells",BA6:"glastonbury",BA7:"castle_cary",BA8:"templecombe",
  BA9:"wincanton",BA10:"bruton",BA11:"frome",BA12:"warminster",
  BA13:"westbury",BA14:"trowbridge",BA15:"bradford_on_avon",
  BA16:"street",BA20:"yeovil",BA21:"yeovil",BA22:"yeovil",
  BS1:"bristol",BS2:"bristol",BS3:"bristol",BS4:"bristol",
  BS5:"bristol",BS6:"bristol",BS7:"bristol",BS8:"bristol",
  BS9:"bristol",BS10:"bristol",BS11:"bristol",BS13:"bristol",
  BS14:"bristol",BS15:"bristol",BS16:"bristol",BS20:"portishead",
  BS21:"clevedon",BS22:"weston_super_mare",BS23:"weston_super_mare",
  BS24:"weston_super_mare",BS25:"axbridge",BS26:"axbridge",
  BS27:"cheddar",BS28:"wedmore",BS29:"banwell",BS30:"bristol",
  BS31:"keynsham",BS32:"bristol",BS34:"bristol",BS35:"thornbury",
  BS36:"frampton_cotterell",BS37:"chipping_sodbury",BS39:"paulton",
  BS40:"bristol",BS41:"bristol",BS48:"nailsea",BS49:"congresbury",
  // Devon / Cornwall
  EX1:"exeter",EX2:"exeter",EX3:"exeter",EX4:"exeter",EX5:"exeter",
  EX6:"exeter",EX7:"dawlish",EX8:"exmouth",EX9:"budleigh_salterton",
  EX10:"sidmouth",EX11:"ottery_st_mary",EX12:"seaton",EX13:"axminster",
  EX14:"honiton",EX15:"cullompton",EX16:"tiverton",EX17:"crediton",
  EX18:"chulmleigh",EX19:"winkleigh",EX20:"okehampton",EX21:"beaworthy",
  EX22:"holsworthy",EX23:"bude",EX24:"colyton",EX31:"barnstaple",
  EX32:"barnstaple",EX33:"braunton",EX34:"ilfracombe",EX35:"lynton",
  EX36:"south_molton",EX37:"umberleigh",EX38:"torrington",EX39:"bideford",
  TQ1:"torquay",TQ2:"torquay",TQ3:"paignton",TQ4:"paignton",TQ5:"brixham",
  TQ6:"dartmouth",TQ7:"kingsbridge",TQ8:"salcombe",TQ9:"totnes",
  TQ10:"south_brent",TQ11:"buckfastleigh",TQ12:"newton_abbot",TQ13:"chagford",
  TQ14:"teignmouth",PL1:"plymouth",PL2:"plymouth",PL3:"plymouth",
  PL4:"plymouth",PL5:"plymouth",PL6:"plymouth",PL7:"plymouth",
  PL9:"plymouth",PL12:"saltash",PL17:"callington",PL18:"callington",
  PL19:"tavistock",PL20:"yelverton",PL21:"ivybridge",
  TR1:"truro",TR2:"truro",TR3:"truro",TR4:"truro",TR5:"st_agnes",
  TR7:"newquay",TR8:"newquay",TR10:"penryn",TR11:"falmouth",
  TR12:"helston",TR13:"helston",TR14:"camborne",TR15:"redruth",
  TR16:"redruth",TR18:"penzance",TR19:"penzance",TR20:"penzance",
  TR26:"st_ives",TR27:"hayle",
  // Dorset / Wiltshire
  DT1:"dorchester",DT2:"dorchester",DT3:"weymouth",DT4:"weymouth",
  DT5:"portland",DT6:"bridport",DT7:"lyme_regis",DT8:"beaminster",
  DT9:"sherborne",DT10:"sturminster_newton",DT11:"blandford",
  SP1:"salisbury",SP2:"salisbury",SP3:"salisbury",SP4:"salisbury",
  SP5:"salisbury",SP6:"fordingbridge",SP7:"shaftesbury",SP8:"gillingham",
  SN1:"swindon",SN2:"swindon",SN3:"swindon",SN4:"swindon",SN5:"swindon",
  SN6:"highworth",SN7:"faringdon",SN8:"marlborough",SN9:"pewsey",
  SN10:"devizes",SN11:"calne",SN12:"melksham",SN13:"corsham",
  SN14:"chippenham",SN15:"chippenham",SN16:"malmesbury",SN25:"swindon",
  SN26:"swindon",
  // Hampshire / Surrey / Kent
  GU1:"guildford",GU2:"guildford",GU3:"guildford",GU4:"guildford",
  GU5:"guildford",GU6:"cranleigh",GU7:"godalming",GU8:"godalming",
  GU9:"farnham",GU10:"farnham",GU11:"aldershot",GU12:"aldershot",
  GU14:"farnborough",GU15:"camberley",GU16:"camberley",GU17:"camberley",
  GU21:"woking",GU22:"woking",GU23:"ripley",GU24:"bisley",
  GU25:"virginia_water",GU26:"hindhead",GU27:"haslemere",
  RH1:"redhill",RH2:"reigate",RH3:"betchworth",RH4:"dorking",
  RH5:"dorking",RH6:"horley",RH7:"lingfield",RH8:"oxted",
  RH10:"crawley",RH11:"crawley",RH12:"horsham",RH13:"horsham",
  RH14:"billingshurst",RH15:"burgess_hill",RH16:"haywards_heath",
  RH17:"haywards_heath",RH18:"forest_row",RH19:"east_grinstead",
  ME1:"rochester",ME2:"rochester",ME3:"rochester",ME4:"chatham",
  ME5:"chatham",ME6:"snodland",ME7:"gillingham",ME8:"gillingham",
  ME9:"sittingbourne",ME10:"sittingbourne",ME11:"queenborough",
  ME12:"sheerness",ME13:"faversham",ME14:"maidstone",ME15:"maidstone",
  ME16:"maidstone",ME17:"maidstone",ME18:"west_malling",ME19:"west_malling",
  ME20:"aylesford",CT1:"canterbury",CT2:"canterbury",CT3:"canterbury",
  CT4:"canterbury",CT5:"whitstable",CT6:"herne_bay",CT7:"birchington",
  CT8:"westgate_on_sea",CT9:"margate",CT10:"broadstairs",CT11:"ramsgate",
  CT12:"ramsgate",CT13:"sandwich",CT14:"deal",CT15:"dover",CT16:"dover",
  CT17:"dover",CT18:"folkestone",CT19:"folkestone",CT20:"folkestone",
  CT21:"hythe",TN1:"tunbridge_wells",TN2:"tunbridge_wells",TN3:"tunbridge_wells",
  TN4:"tunbridge_wells",TN5:"wadhurst",TN6:"crowborough",TN7:"hartfield",
  TN8:"edenbridge",TN9:"tonbridge",TN10:"tonbridge",TN11:"tonbridge",
  TN12:"paddock_wood",TN13:"sevenoaks",TN14:"sevenoaks",TN15:"borough_green",
  TN16:"westerham",TN17:"cranbrook",TN18:"hawkhurst",TN19:"etchingham",
  TN20:"mayfield",TN21:"heathfield",TN22:"uckfield",TN23:"ashford",
  TN24:"ashford",TN25:"ashford",TN26:"ashford",TN27:"ashford",
  TN28:"new_romney",TN29:"romney_marsh",TN30:"tenterden",TN31:"rye",
  TN32:"robertsbridge",TN33:"battle",TN34:"hastings",TN35:"hastings",
  TN36:"winchelsea",TN37:"st_leonards",TN38:"st_leonards",TN39:"bexhill",
  TN40:"bexhill",

  // ────────────────────────────────────────────────────────────────────
  // V9.11 UK-WIDE EXPANSION — covers all 74 Placona regions
  // ────────────────────────────────────────────────────────────────────

  // ── NORTH EAST ENGLAND ──────────────────────────────────────────────
  // Tyne & Wear (NE3-NE7 already exist, expand)
  NE4:"newcastle",NE5:"newcastle",NE6:"newcastle",NE7:"newcastle",
  NE8:"gateshead",NE9:"gateshead",NE10:"gateshead",NE11:"gateshead",
  NE12:"longbenton",NE13:"newcastle",NE15:"newcastle",NE16:"whickham",
  NE17:"newcastle",NE20:"ponteland",NE21:"blaydon",NE22:"bedlington",
  NE23:"cramlington",NE24:"blyth",NE25:"whitley_bay",NE26:"whitley_bay",
  NE27:"shiremoor",NE28:"wallsend",NE29:"north_shields",NE30:"tynemouth",
  NE31:"hebburn",NE32:"jarrow",NE33:"south_shields",NE34:"south_shields",
  NE35:"boldon",NE36:"east_boldon",NE37:"washington",NE38:"washington",
  NE39:"rowlands_gill",NE40:"ryton",NE41:"wylam",NE42:"prudhoe",
  NE43:"stocksfield",NE44:"riding_mill",NE45:"corbridge",NE46:"hexham",
  NE61:"morpeth",NE62:"morpeth",NE63:"ashington",NE64:"newbiggin",
  NE65:"alnwick",NE66:"alnwick",NE67:"chathill",NE68:"seahouses",
  NE69:"bamburgh",NE70:"belford",NE71:"wooler",
  SR1:"sunderland",SR2:"sunderland",SR3:"sunderland",SR4:"sunderland",
  SR5:"sunderland",SR6:"sunderland",SR7:"seaham",SR8:"peterlee",
  // County Durham
  DH1:"durham",DH2:"chester_le_street",DH3:"chester_le_street",DH4:"houghton",
  DH5:"hetton",DH6:"durham",DH7:"durham",DH8:"consett",DH9:"stanley",
  // Tees Valley
  TS1:"middlesbrough",TS2:"middlesbrough",TS3:"middlesbrough",TS4:"middlesbrough",
  TS5:"middlesbrough",TS6:"middlesbrough",TS7:"middlesbrough",TS8:"middlesbrough",
  TS9:"stokesley",TS10:"redcar",TS11:"marske",TS12:"saltburn",TS13:"loftus",
  TS14:"guisborough",TS15:"yarm",TS16:"stockton",TS17:"stockton",
  TS18:"stockton",TS19:"stockton",TS20:"stockton",TS21:"stockton",
  TS22:"billingham",TS23:"billingham",TS24:"hartlepool",TS25:"hartlepool",
  TS26:"hartlepool",TS27:"hartlepool",TS28:"hartlepool",TS29:"hartlepool",

  // ── NORTH WEST ENGLAND (gaps) ───────────────────────────────────────
  // Cumbria
  CA1:"carlisle",CA2:"carlisle",CA3:"carlisle",CA4:"carlisle",CA5:"carlisle",
  CA6:"carlisle",CA7:"wigton",CA8:"brampton",CA9:"alston",CA10:"penrith",
  CA11:"penrith",CA12:"keswick",CA13:"cockermouth",CA14:"workington",
  CA15:"maryport",CA16:"appleby",CA17:"kirkby_stephen",CA18:"ravenglass",
  CA19:"gosforth",CA20:"seascale",CA21:"beckermet",CA22:"egremont",
  CA23:"cleator",CA24:"moor_row",CA25:"cleator_moor",CA26:"frizington",
  CA27:"st_bees",CA28:"whitehaven",
  // Lancashire (expansion)
  LA1:"lancaster",LA2:"lancaster",LA3:"morecambe",LA4:"morecambe",
  LA5:"carnforth",LA6:"kirkby_lonsdale",LA7:"milnthorpe",LA8:"kendal",
  LA9:"kendal",LA10:"sedbergh",LA11:"grange_over_sands",LA12:"ulverston",
  LA13:"barrow",LA14:"barrow",LA15:"dalton",LA16:"askam",LA17:"kirkby",
  LA18:"millom",LA19:"millom",LA20:"broughton",LA21:"coniston",LA22:"ambleside",
  LA23:"windermere",
  PR1:"preston",PR2:"preston",PR3:"preston",PR4:"preston",PR5:"preston",
  PR6:"chorley",PR7:"chorley",PR8:"southport",PR9:"southport",PR25:"leyland",
  PR26:"leyland",
  BB1:"blackburn",BB2:"blackburn",BB3:"darwen",BB4:"rossendale",BB5:"accrington",
  BB6:"langho",BB7:"clitheroe",BB8:"colne",BB9:"nelson",BB10:"burnley",
  BB11:"burnley",BB12:"burnley",BB18:"barnoldswick",
  FY1:"blackpool",FY2:"blackpool",FY3:"blackpool",FY4:"blackpool",FY5:"thornton",
  FY6:"poulton",FY7:"fleetwood",FY8:"st_annes",
  // Cheshire
  CH1:"chester",CH2:"chester",CH3:"chester",CH4:"chester",CH5:"deeside",
  CH7:"mold",CH41:"birkenhead",CH42:"birkenhead",CH43:"prenton",CH44:"wallasey",
  CH45:"wallasey",CH46:"moreton",CH47:"hoylake",CH48:"west_kirby",CH49:"upton",
  CH60:"heswall",CH61:"pensby",CH62:"bromborough",CH63:"bebington",CH64:"neston",
  CH65:"ellesmere_port",CH66:"ellesmere_port",
  CW1:"crewe",CW2:"crewe",CW3:"crewe",CW4:"holmes_chapel",CW5:"nantwich",
  CW6:"tarporley",CW7:"winsford",CW8:"northwich",CW9:"northwich",CW10:"middlewich",
  CW11:"sandbach",CW12:"congleton",
  SK10:"macclesfield",SK11:"macclesfield",SK12:"poynton",SK13:"glossop",
  SK14:"hyde",SK22:"new_mills",SK23:"chapel_en_le_frith",
  WA1:"warrington",WA2:"warrington",WA3:"warrington",WA4:"warrington",WA5:"warrington",
  WA6:"frodsham",WA7:"runcorn",WA8:"widnes",WA9:"st_helens",WA10:"st_helens",
  WA11:"st_helens",WA12:"newton_le_willows",WA13:"lymm",WA14:"altrincham",
  WA15:"altrincham",WA16:"knutsford",
  // Merseyside
  L4:"liverpool",L5:"liverpool",L6:"liverpool",L7:"liverpool",L9:"liverpool",
  L10:"liverpool",L11:"liverpool",L12:"liverpool",L13:"liverpool",L14:"liverpool",
  L15:"liverpool",L16:"liverpool",L19:"liverpool",L20:"bootle",L21:"crosby",
  L22:"waterloo",L23:"crosby",L24:"speke",L25:"liverpool",L26:"halewood",
  L27:"liverpool",L28:"stockbridge",L29:"thornton",L30:"netherton",L31:"maghull",
  L32:"kirkby",L33:"kirkby",L34:"prescot",L35:"whiston",L36:"huyton",L37:"formby",
  L38:"hightown",L39:"ormskirk",L40:"burscough",
  // Greater Manchester gaps
  M6:"salford",M7:"salford",M8:"manchester",M9:"manchester",M11:"manchester",
  M12:"manchester",M13:"manchester",M17:"trafford",M18:"manchester",M19:"manchester",
  M22:"wythenshawe",M23:"wythenshawe",M24:"middleton",M26:"radcliffe",M27:"swinton",
  M28:"worsley",M29:"tyldesley",M30:"eccles",M31:"partington",M32:"stretford",
  M34:"denton",M35:"failsworth",M38:"little_hulton",M40:"manchester",M41:"urmston",
  M43:"droylsden",M44:"irlam",M45:"whitefield",M46:"atherton",M50:"salford",
  OL1:"oldham",OL2:"oldham",OL3:"oldham",OL4:"oldham",OL5:"mossley",OL6:"ashton",
  OL7:"ashton",OL8:"oldham",OL9:"oldham",OL10:"heywood",OL11:"rochdale",
  OL12:"rochdale",OL13:"bacup",OL14:"todmorden",OL15:"littleborough",OL16:"rochdale",
  BL1:"bolton",BL2:"bolton",BL3:"bolton",BL4:"farnworth",BL5:"westhoughton",
  BL6:"horwich",BL7:"bromley_cross",BL8:"bury",BL9:"bury",
  WN1:"wigan",WN2:"wigan",WN3:"wigan",WN4:"ashton",WN5:"wigan",WN6:"wigan",
  WN7:"leigh",WN8:"skelmersdale",
  SK1:"stockport",SK2:"stockport",SK3:"stockport",SK4:"stockport",SK5:"stockport",
  SK6:"romiley",SK7:"bramhall",

  // ── YORKSHIRE & HUMBER (gaps) ───────────────────────────────────────
  // North Yorkshire
  YO7:"thirsk",YO8:"selby",YO10:"york",YO11:"scarborough",YO12:"scarborough",
  YO13:"scarborough",YO14:"filey",YO15:"bridlington",YO16:"bridlington",YO17:"malton",
  YO18:"pickering",YO19:"york",YO21:"whitby",YO22:"whitby",YO23:"york",YO24:"york",
  YO25:"driffield",YO26:"york",YO30:"york",YO31:"york",YO32:"york",YO41:"pocklington",
  YO42:"pocklington",YO43:"market_weighton",YO51:"boroughbridge",YO60:"york",
  YO61:"easingwold",YO62:"helmsley",YO63:"north_yorkshire",
  DL1:"darlington",DL2:"darlington",DL3:"darlington",DL4:"shildon",DL5:"newton_aycliffe",
  DL6:"northallerton",DL7:"northallerton",DL8:"hawes",DL9:"catterick",DL10:"richmond",
  DL11:"richmond",DL12:"barnard_castle",DL13:"bishop_auckland",DL14:"bishop_auckland",
  DL15:"crook",DL16:"spennymoor",DL17:"ferryhill",
  HG2:"harrogate",HG3:"harrogate",HG4:"ripon",HG5:"knaresborough",
  // West Yorkshire (gaps)
  LS3:"leeds",LS4:"leeds",LS5:"leeds",LS9:"leeds",LS10:"leeds",LS11:"leeds",
  LS12:"leeds",LS13:"leeds",LS14:"leeds",LS15:"leeds",LS18:"horsforth",
  LS19:"yeadon",LS20:"guiseley",LS21:"otley",LS22:"wetherby",LS23:"boston_spa",
  LS24:"tadcaster",LS25:"garforth",LS26:"rothwell",LS27:"morley",LS28:"pudsey",LS29:"ilkley",
  BD1:"bradford",BD2:"bradford",BD3:"bradford",BD4:"bradford",BD5:"bradford",
  BD6:"bradford",BD7:"bradford",BD8:"bradford",BD9:"bradford",BD10:"bradford",
  BD11:"birkenshaw",BD12:"bradford",BD13:"thornton",BD14:"clayton",BD15:"bradford",
  BD16:"bingley",BD17:"shipley",BD18:"shipley",BD19:"cleckheaton",BD20:"keighley",
  BD21:"keighley",BD22:"keighley",BD23:"skipton",BD24:"settle",
  HX1:"halifax",HX2:"halifax",HX3:"halifax",HX4:"halifax",HX5:"elland",HX6:"sowerby_bridge",HX7:"hebden_bridge",
  HD1:"huddersfield",HD2:"huddersfield",HD3:"huddersfield",HD4:"huddersfield",
  HD5:"huddersfield",HD6:"brighouse",HD7:"huddersfield",HD8:"huddersfield",HD9:"holmfirth",
  WF1:"wakefield",WF2:"wakefield",WF3:"wakefield",WF4:"wakefield",WF5:"ossett",
  WF6:"normanton",WF7:"pontefract",WF8:"pontefract",WF9:"pontefract",WF10:"castleford",
  WF11:"knottingley",WF12:"dewsbury",WF13:"dewsbury",WF14:"mirfield",WF15:"liversedge",
  WF16:"heckmondwike",WF17:"batley",
  // South Yorkshire (gaps)
  S2:"sheffield",S3:"sheffield",S4:"sheffield",S5:"sheffield",S6:"sheffield",
  S8:"sheffield",S9:"sheffield",S12:"sheffield",S13:"sheffield",S14:"sheffield",
  S20:"sheffield",S21:"sheffield",S25:"rotherham",S26:"sheffield",S35:"sheffield",
  S36:"penistone",S60:"rotherham",S61:"rotherham",S62:"rotherham",S63:"rotherham",
  S64:"mexborough",S65:"rotherham",S66:"rotherham",S70:"barnsley",S71:"barnsley",
  S72:"barnsley",S73:"barnsley",S74:"barnsley",S75:"barnsley",
  DN1:"doncaster",DN2:"doncaster",DN3:"doncaster",DN4:"doncaster",DN5:"doncaster",
  DN6:"doncaster",DN7:"doncaster",DN8:"thorne",DN9:"doncaster",DN10:"bawtry",
  DN11:"doncaster",DN12:"doncaster",DN13:"thorne",DN14:"goole",
  // East Yorkshire / Humber
  HU2:"hull",HU3:"hull",HU4:"hull",HU5:"hull",HU6:"hull",HU7:"hull",HU8:"hull",
  HU9:"hull",HU10:"hull",HU11:"hull",HU12:"withernsea",HU13:"hessle",HU14:"hessle",
  HU15:"brough",HU16:"cottingham",HU17:"beverley",HU18:"hornsea",HU19:"withernsea",HU20:"cottingham",
  DN15:"scunthorpe",DN16:"scunthorpe",DN17:"scunthorpe",DN18:"barton",DN19:"barrow",
  DN20:"brigg",DN21:"gainsborough",DN31:"grimsby",DN32:"grimsby",DN33:"grimsby",
  DN34:"grimsby",DN35:"cleethorpes",DN36:"humberston",DN37:"grimsby",DN38:"barnetby",
  DN39:"ulceby",DN40:"immingham",DN41:"immingham",

  // ── EAST MIDLANDS (gaps) ────────────────────────────────────────────
  // Lincolnshire
  LN1:"lincoln",LN2:"lincoln",LN3:"lincoln",LN4:"lincoln",LN5:"lincoln",
  LN6:"lincoln",LN7:"market_rasen",LN8:"market_rasen",LN9:"horncastle",LN10:"woodhall_spa",
  LN11:"louth",LN12:"mablethorpe",LN13:"alford",
  PE1:"peterborough",PE2:"peterborough",PE3:"peterborough",PE4:"peterborough",
  PE5:"peterborough",PE6:"peterborough",PE7:"peterborough",PE8:"oundle",PE9:"stamford",
  PE10:"bourne",PE11:"spalding",PE12:"spalding",PE13:"wisbech",PE14:"wisbech",
  PE15:"march",PE16:"chatteris",PE19:"st_neots",PE20:"boston",PE21:"boston",
  PE22:"boston",PE23:"spilsby",PE24:"skegness",PE25:"skegness",PE26:"huntingdon",
  PE27:"st_ives",PE28:"huntingdon",PE29:"huntingdon",PE30:"kings_lynn",PE31:"kings_lynn",
  PE32:"kings_lynn",PE33:"kings_lynn",PE34:"kings_lynn",PE35:"kings_lynn",
  PE36:"hunstanton",PE37:"swaffham",PE38:"downham_market",
  // Northamptonshire
  NN2:"northampton",NN4:"northampton",NN5:"northampton",NN6:"northampton",
  NN7:"northampton",NN8:"wellingborough",NN9:"wellingborough",NN10:"rushden",
  NN11:"daventry",NN12:"towcester",NN13:"brackley",NN14:"kettering",NN15:"kettering",
  NN16:"kettering",NN17:"corby",NN18:"corby",NN29:"northampton",
  // Rutland
  LE15:"oakham",
  // Derbyshire gaps
  DE4:"matlock",DE5:"ripley",DE7:"ilkeston",DE12:"swadlincote",DE21:"derby",DE24:"derby",
  DE45:"bakewell",DE55:"alfreton",
  // Nottinghamshire gaps
  NG2:"nottingham",NG3:"nottingham",NG4:"nottingham",NG5:"nottingham",NG8:"nottingham",
  NG11:"nottingham",NG13:"bingham",NG17:"sutton_in_ashfield",NG18:"mansfield",
  NG19:"mansfield",NG20:"mansfield",NG21:"mansfield",NG23:"newark",
  // Leicestershire gaps
  LE4:"leicester",LE5:"leicester",LE6:"leicester",LE9:"narborough",LE13:"melton_mowbray",
  LE14:"melton_mowbray",LE18:"wigston",LE19:"leicester",LE67:"coalville",

  // ── WEST MIDLANDS (gaps) ────────────────────────────────────────────
  // Herefordshire
  HR3:"hereford",HR5:"kington",HR6:"leominster",HR7:"bromyard",HR8:"ledbury",HR9:"ross_on_wye",
  // Shropshire
  SY4:"shrewsbury",SY5:"shrewsbury",SY6:"church_stretton",SY7:"ludlow",SY8:"ludlow",
  SY9:"bishops_castle",SY10:"oswestry",SY11:"oswestry",SY12:"ellesmere",SY13:"whitchurch",
  SY14:"malpas",
  // Worcestershire gaps
  WR4:"worcester",WR5:"worcester",WR6:"worcester",WR8:"upton",WR12:"broadway",WR13:"malvern",
  WR15:"tenbury_wells",
  B60:"bromsgrove",B61:"bromsgrove",B62:"halesowen",B63:"halesowen",B64:"cradley_heath",
  B65:"rowley_regis",B66:"smethwick",B67:"smethwick",B68:"oldbury",B69:"oldbury",
  B70:"west_bromwich",B71:"west_bromwich",B72:"sutton_coldfield",B73:"sutton_coldfield",
  B74:"sutton_coldfield",B75:"sutton_coldfield",
  B45:"birmingham",B46:"coleshill",B47:"wythall",B48:"birmingham",
  CV12:"bedworth",

  // ── EAST OF ENGLAND (Norfolk, Suffolk, Cambs gaps) ──────────────────
  // Norfolk
  NR1:"norwich",NR2:"norwich",NR3:"norwich",NR4:"norwich",NR5:"norwich",NR6:"norwich",
  NR7:"norwich",NR8:"norwich",NR9:"norwich",NR10:"norwich",NR11:"north_walsham",
  NR12:"wroxham",NR13:"acle",NR14:"loddon",NR15:"long_stratton",NR16:"attleborough",
  NR17:"attleborough",NR18:"wymondham",NR19:"dereham",NR20:"dereham",NR21:"fakenham",
  NR22:"walsingham",NR23:"wells",NR24:"melton_constable",NR25:"holt",NR26:"sheringham",
  NR27:"cromer",NR28:"north_walsham",NR29:"great_yarmouth",NR30:"great_yarmouth",
  NR31:"great_yarmouth",NR32:"lowestoft",NR33:"lowestoft",NR34:"beccles",NR35:"bungay",
  // Suffolk
  IP1:"ipswich",IP2:"ipswich",IP3:"ipswich",IP4:"ipswich",IP5:"ipswich",IP6:"ipswich",
  IP7:"hadleigh",IP8:"ipswich",IP9:"ipswich",IP10:"ipswich",IP11:"felixstowe",
  IP12:"woodbridge",IP13:"woodbridge",IP14:"stowmarket",IP15:"aldeburgh",IP16:"leiston",
  IP17:"saxmundham",IP18:"southwold",IP19:"halesworth",IP20:"harleston",IP21:"diss",
  IP22:"diss",IP23:"eye",IP24:"thetford",IP25:"thetford",IP26:"thetford",IP27:"brandon",
  IP28:"bury_st_edmunds",IP29:"bury_st_edmunds",IP30:"bury_st_edmunds",IP31:"bury_st_edmunds",
  IP32:"bury_st_edmunds",IP33:"bury_st_edmunds",
  // Cambridgeshire gaps
  CB5:"cambridge",CB6:"ely",CB7:"ely",CB8:"newmarket",CB9:"haverhill",CB10:"saffron_walden",
  CB11:"saffron_walden",CB21:"cambridge",CB22:"cambridge",CB23:"cambridge",CB24:"cambridge",
  CB25:"cambridge",
  // Bedfordshire (full)
  MK43:"bedford",MK44:"bedford",MK45:"flitwick",
  LU4:"luton",LU5:"luton",LU6:"luton",LU7:"leighton_buzzard",

  // ── GREATER LONDON (gaps for outer boroughs) ────────────────────────
  N2:"london",N3:"london",N4:"london",N5:"london",N6:"london",N7:"london",N8:"london",
  N9:"london",N10:"london",N11:"london",N12:"london",N13:"london",N14:"london",N15:"london",
  N16:"london",N17:"london",N18:"london",N19:"london",N20:"london",N21:"london",N22:"london",
  NW2:"london",NW4:"london",NW5:"london",NW6:"london",NW7:"london",NW8:"london",NW9:"london",
  NW10:"london",NW11:"london",
  SE2:"london",SE3:"london",SE4:"london",SE5:"london",SE6:"london",SE7:"london",SE8:"london",
  SE9:"london",SE10:"london",SE11:"london",SE12:"london",SE13:"london",SE14:"london",SE15:"london",
  SE16:"london",SE17:"london",SE18:"london",SE19:"london",SE20:"london",SE21:"london",SE22:"london",
  SE23:"london",SE24:"london",SE25:"london",SE26:"london",SE27:"london",SE28:"london",
  W2:"london",W3:"london",W5:"london",W7:"london",W8:"london",W9:"london",W10:"london",W12:"london",
  W13:"london",W14:"london",
  E2:"london",E3:"london",E4:"london",E5:"london",E6:"london",E7:"london",E8:"london",E9:"london",
  E10:"london",E11:"london",E12:"london",E13:"london",E15:"london",E16:"london",E17:"london",E18:"london",
  EC3:"london",EC4:"london",WC2:"london",
  SW2:"london",SW5:"london",SW6:"london",SW7:"london",SW9:"london",SW10:"london",SW12:"london",
  SW13:"london",SW14:"london",SW15:"london",SW16:"london",SW17:"london",SW19:"london",SW20:"london",

  // ── SOUTH EAST (gaps — Hampshire, Buckinghamshire, Oxfordshire, Berkshire, Isle of Wight) ──
  // Hampshire
  SO15:"southampton",SO16:"southampton",SO17:"southampton",SO18:"southampton",
  SO19:"southampton",SO20:"stockbridge",SO21:"winchester",SO22:"winchester",SO23:"winchester",
  SO24:"alresford",SO30:"southampton",SO31:"locks_heath",SO32:"bishops_waltham",
  SO40:"totton",SO41:"lymington",SO42:"brockenhurst",SO43:"lyndhurst",SO45:"dibden",
  SO50:"eastleigh",SO51:"romsey",SO52:"north_baddesley",SO53:"chandlers_ford",
  PO2:"portsmouth",PO3:"portsmouth",PO4:"portsmouth",PO5:"portsmouth",PO6:"portsmouth",
  PO7:"waterlooville",PO8:"horndean",PO9:"havant",PO10:"emsworth",PO11:"hayling_island",
  PO12:"gosport",PO13:"gosport",PO14:"fareham",PO15:"fareham",PO16:"fareham",PO17:"southwick",
  PO30:"newport_iow",PO31:"cowes",PO32:"east_cowes",PO33:"ryde",PO34:"seaview",
  PO35:"bembridge",PO36:"sandown",PO37:"shanklin",PO38:"ventnor",PO39:"totland_bay",
  PO40:"freshwater",PO41:"yarmouth_iow",
  RG4:"reading",RG5:"reading",RG6:"reading",RG7:"reading",RG8:"pangbourne",
  RG9:"henley",RG10:"twyford",RG12:"bracknell",RG14:"newbury",RG17:"hungerford",
  RG18:"thatcham",RG19:"newbury",RG20:"newbury",RG21:"basingstoke",RG22:"basingstoke",
  RG23:"basingstoke",RG24:"basingstoke",RG25:"basingstoke",RG26:"tadley",RG27:"hook",
  RG28:"whitchurch",RG29:"hartley_wintney",RG30:"reading",RG31:"reading",RG40:"wokingham",
  RG41:"wokingham",RG42:"binfield",RG45:"crowthorne",
  // Buckinghamshire
  HP10:"high_wycombe",HP11:"high_wycombe",HP12:"high_wycombe",HP13:"high_wycombe",
  HP14:"high_wycombe",HP15:"high_wycombe",HP16:"great_missenden",HP17:"aylesbury",
  HP18:"aylesbury",HP19:"aylesbury",HP20:"aylesbury",HP21:"aylesbury",HP22:"aylesbury",HP27:"princes_risborough",
  MK1:"milton_keynes",MK2:"milton_keynes",MK3:"bletchley",MK4:"milton_keynes",
  MK5:"milton_keynes",MK7:"milton_keynes",MK8:"milton_keynes",MK10:"milton_keynes",
  MK11:"stony_stratford",MK12:"wolverton",MK13:"milton_keynes",MK14:"milton_keynes",
  MK15:"milton_keynes",MK16:"newport_pagnell",MK17:"milton_keynes",MK18:"buckingham",
  MK19:"milton_keynes",
  // Oxfordshire
  OX5:"kidlington",OX7:"chipping_norton",OX8:"witney",OX9:"thame",OX10:"wallingford",
  OX11:"didcot",OX12:"wantage",OX13:"abingdon",OX14:"abingdon",OX15:"banbury",
  OX17:"banbury",OX18:"witney",OX20:"woodstock",OX25:"bicester",OX26:"bicester",
  OX27:"bicester",OX28:"witney",OX29:"witney",OX33:"wheatley",OX44:"chalgrove",OX49:"watlington",

  // ── SOUTH WEST (gaps — Wiltshire, Somerset, Dorset extras) ──────────
  // Wiltshire
  BA12:"warminster",BA13:"westbury",BA14:"trowbridge",BA15:"bradford_on_avon",
  SN3:"swindon",SN4:"royal_wootton_bassett",SN5:"swindon",SN6:"swindon",SN7:"faringdon",
  SN8:"marlborough",SN9:"pewsey",SN10:"devizes",SN11:"calne",SN12:"melksham",
  SN13:"corsham",SN14:"chippenham",SN16:"malmesbury",SN25:"swindon",SN26:"swindon",
  // Dorset
  BH1:"bournemouth",BH2:"bournemouth",BH3:"bournemouth",BH4:"bournemouth",BH5:"bournemouth",
  BH6:"southbourne",BH7:"bournemouth",BH8:"bournemouth",BH9:"bournemouth",BH10:"bournemouth",
  BH11:"bournemouth",BH12:"poole",BH13:"poole",BH14:"poole",BH15:"poole",BH16:"poole",
  BH17:"poole",BH18:"broadstone",BH19:"swanage",BH20:"wareham",BH21:"wimborne",
  BH22:"ferndown",BH23:"christchurch",BH24:"ringwood",BH25:"new_milton",
  DT2:"dorchester",DT4:"weymouth",DT5:"portland",DT7:"lyme_regis",DT8:"beaminster",
  DT10:"sturminster_newton",
  // Bristol gaps
  BS1:"bristol",BS2:"bristol",BS3:"bristol",BS7:"bristol",
  // Gloucestershire gaps
  GL4:"gloucester",GL5:"stroud",GL6:"stroud",GL7:"cirencester",GL8:"tetbury",GL9:"chipping_sodbury",
  GL10:"stonehouse",GL11:"dursley",GL12:"wotton_under_edge",GL13:"berkeley",GL14:"newnham",
  GL15:"lydney",GL16:"coleford",GL17:"cinderford",GL18:"newent",
  GL53:"cheltenham",GL55:"chipping_campden",GL56:"moreton_in_marsh",

  // ── WALES ───────────────────────────────────────────────────────────
  // South Wales (Cardiff, Swansea, Newport area)
  CF1:"cardiff",CF2:"cardiff",CF3:"cardiff",CF4:"cardiff",CF5:"cardiff",CF6:"penarth",
  CF7:"barry",CF8:"caerphilly",CF9:"abertillery",CF15:"cardiff",CF23:"cardiff",
  CF31:"bridgend",CF32:"bridgend",CF33:"bridgend",CF34:"maesteg",CF35:"bridgend",
  CF36:"porthcawl",CF37:"pontypridd",CF38:"pontypridd",CF39:"tonypandy",CF40:"tonypandy",
  CF41:"tonypandy",CF42:"merthyr_tydfil",CF43:"rhondda",CF44:"merthyr_tydfil",CF45:"merthyr_tydfil",
  CF46:"merthyr_tydfil",CF47:"merthyr_tydfil",CF48:"merthyr_tydfil",CF61:"llantwit_major",
  CF62:"barry",CF63:"barry",CF64:"penarth",CF71:"cowbridge",CF72:"llantrisant",CF81:"bargoed",
  CF82:"hengoed",CF83:"caerphilly",
  NP4:"pontypool",NP7:"abergavenny",NP8:"crickhowell",NP10:"newport",NP11:"newport",
  NP12:"blackwood",NP13:"abertillery",NP15:"usk",NP16:"chepstow",NP18:"newport",
  NP19:"newport",NP20:"newport",NP22:"tredegar",NP23:"ebbw_vale",NP24:"new_tredegar",
  NP25:"monmouth",NP26:"caldicot",NP44:"cwmbran",
  SA2:"swansea",SA3:"swansea",SA4:"swansea",SA5:"swansea",SA6:"swansea",SA7:"swansea",
  SA8:"pontardawe",SA9:"ystradgynlais",SA10:"neath",SA11:"neath",SA12:"port_talbot",
  SA13:"port_talbot",SA14:"llanelli",SA15:"llanelli",SA16:"burry_port",SA17:"llanelli",
  SA18:"ammanford",SA19:"llandeilo",SA20:"llandovery",SA31:"carmarthen",SA32:"carmarthen",
  SA33:"carmarthen",SA34:"whitland",SA35:"llanfyrnach",SA36:"glogue",SA37:"crymych",
  SA38:"newcastle_emlyn",SA39:"pencader",SA40:"llanybydder",SA41:"crymych",
  SA42:"newport_pembs",SA43:"cardigan",SA44:"llandysul",SA45:"new_quay",SA46:"aberaeron",
  SA47:"llanarth",SA48:"lampeter",SA61:"haverfordwest",SA62:"haverfordwest",
  SA63:"clarbeston_road",SA64:"goodwick",SA65:"fishguard",SA66:"clynderwen",SA67:"narberth",
  SA68:"kilgetty",SA69:"saundersfoot",SA70:"tenby",SA71:"pembroke",SA72:"pembroke_dock",
  SA73:"milford_haven",
  // Mid & West Wales
  SY15:"montgomery",SY16:"newtown",SY17:"caersws",SY18:"llanidloes",SY19:"llanbrynmair",
  SY20:"machynlleth",SY21:"welshpool",SY22:"meifod",SY23:"aberystwyth",SY24:"borth",
  SY25:"tregaron",
  LD1:"llandrindod_wells",LD2:"builth_wells",LD3:"brecon",LD4:"llanwrtyd_wells",
  LD5:"llanwrtyd_wells",LD6:"rhayader",LD7:"knighton",LD8:"presteigne",
  // North Wales
  LL11:"wrexham",LL12:"wrexham",LL13:"wrexham",LL14:"wrexham",LL15:"ruthin",LL16:"denbigh",
  LL17:"st_asaph",LL18:"rhyl",LL19:"prestatyn",LL20:"llangollen",LL21:"corwen",
  LL22:"abergele",LL23:"bala",LL24:"betws_y_coed",LL25:"dolwyddelan",LL26:"llanrwst",
  LL27:"trefriw",LL28:"colwyn_bay",LL29:"colwyn_bay",LL30:"llandudno",LL31:"llandudno_junction",
  LL32:"conwy",LL33:"llanfairfechan",LL34:"penmaenmawr",LL35:"aberdovey",LL36:"tywyn",
  LL37:"llwyngwril",LL38:"fairbourne",LL39:"arthog",LL40:"dolgellau",LL41:"blaenau_ffestiniog",
  LL42:"barmouth",LL43:"talybont",LL44:"dyffryn_ardudwy",LL45:"llanbedr",LL46:"harlech",
  LL47:"talsarnau",LL48:"penrhyndeudraeth",LL49:"porthmadog",LL51:"garndolbenmaen",
  LL52:"criccieth",LL53:"pwllheli",LL54:"caernarfon",LL55:"caernarfon",LL56:"caernarfon",
  LL57:"bangor",LL58:"beaumaris",LL59:"menai_bridge",LL60:"gaerwen",LL61:"llanfairpwllgwyngyll",
  LL62:"bodorgan",LL63:"ty_croes",LL64:"rhosneigr",LL65:"holyhead",LL66:"rhosgoch",
  LL67:"cemaes_bay",LL68:"amlwch",LL69:"penysarn",LL70:"dulas",LL71:"llanerchymedd",
  LL72:"moelfre",LL73:"marianglas",LL74:"benllech",LL75:"pentraeth",LL76:"llanbedrgoch",LL77:"llangefni",LL78:"brynteg",
  CH8:"holywell",
  // Newport area covered above (NP)

  // ── SCOTLAND ────────────────────────────────────────────────────────
  // Glasgow & Strathclyde
  G4:"glasgow",G5:"glasgow",G14:"glasgow",G15:"glasgow",G20:"glasgow",G21:"glasgow",
  G22:"glasgow",G23:"glasgow",G31:"glasgow",G32:"glasgow",G33:"glasgow",G34:"glasgow",
  G40:"glasgow",G42:"glasgow",G43:"glasgow",G44:"glasgow",G45:"glasgow",G46:"glasgow",
  G51:"glasgow",G52:"glasgow",G53:"glasgow",G61:"bearsden",G62:"milngavie",G63:"killearn",
  G64:"bishopbriggs",G65:"kilsyth",G66:"kirkintilloch",G67:"cumbernauld",G68:"cumbernauld",
  G69:"glasgow",G71:"uddingston",G72:"cambuslang",G73:"rutherglen",G74:"east_kilbride",
  G75:"east_kilbride",G76:"clarkston",G77:"newton_mearns",G78:"barrhead",G81:"clydebank",
  G82:"dumbarton",G83:"alexandria",G84:"helensburgh",
  ML1:"motherwell",ML2:"wishaw",ML3:"hamilton",ML4:"bellshill",ML5:"coatbridge",
  ML6:"airdrie",ML7:"shotts",ML8:"carluke",ML9:"larkhall",ML10:"strathaven",ML11:"lanark",ML12:"biggar",
  PA1:"paisley",PA2:"paisley",PA3:"paisley",PA4:"renfrew",PA5:"johnstone",PA6:"houston",
  PA7:"bishopton",PA8:"erskine",PA10:"kilbarchan",PA11:"bridge_of_weir",PA12:"lochwinnoch",
  PA13:"kilmacolm",PA14:"port_glasgow",PA15:"greenock",PA16:"greenock",PA17:"skelmorlie",
  PA18:"wemyss_bay",PA19:"gourock",PA20:"rothesay",PA21:"tighnabruaich",PA22:"colintraive",
  PA23:"dunoon",PA24:"cairndow",PA25:"cairndow",PA26:"inveraray",PA27:"inveraray",
  PA28:"campbeltown",PA29:"tarbert",PA30:"lochgilphead",PA31:"lochgilphead",PA32:"inveraray",
  PA33:"dalmally",PA34:"oban",PA35:"taynuilt",PA36:"bridge_of_orchy",PA37:"connel",
  PA38:"appin",PA39:"ballachulish",PA40:"kinlochleven",PA41:"isle_of_gigha",PA42:"port_ellen",
  PA43:"bridgend_islay",PA44:"isle_of_islay",PA45:"port_charlotte",PA46:"port_askaig",
  PA47:"isle_of_jura",PA48:"isle_of_islay",PA49:"isle_of_islay",PA60:"isle_of_islay",
  PA61:"isle_of_colonsay",PA62:"isle_of_mull",PA63:"isle_of_mull",PA64:"isle_of_mull",
  PA65:"isle_of_mull",PA66:"isle_of_mull",PA67:"isle_of_mull",PA68:"isle_of_mull",
  PA69:"isle_of_mull",PA70:"isle_of_mull",PA71:"isle_of_mull",PA72:"isle_of_mull",
  PA73:"isle_of_mull",PA74:"isle_of_mull",PA75:"isle_of_mull",PA76:"isle_of_iona",
  PA77:"isle_of_tiree",PA78:"isle_of_coll",
  KA1:"kilmarnock",KA2:"kilmarnock",KA3:"kilmarnock",KA4:"galston",KA5:"mauchline",
  KA6:"ayr",KA7:"ayr",KA8:"ayr",KA9:"prestwick",KA10:"troon",KA11:"irvine",KA12:"irvine",
  KA13:"kilwinning",KA14:"beith",KA15:"beith",KA16:"newmilns",KA17:"darvel",KA18:"cumnock",
  KA19:"maybole",KA20:"stevenston",KA21:"saltcoats",KA22:"ardrossan",KA23:"west_kilbride",
  KA24:"dalry",KA25:"kilbirnie",KA26:"girvan",KA27:"isle_of_arran",KA28:"isle_of_cumbrae",
  KA29:"largs",KA30:"largs",
  // Edinburgh & Lothian
  EH5:"edinburgh",EH7:"edinburgh",EH11:"edinburgh",EH13:"edinburgh",EH14:"edinburgh",
  EH15:"edinburgh",EH16:"edinburgh",EH17:"edinburgh",EH18:"lasswade",EH19:"bonnyrigg",
  EH20:"loanhead",EH21:"musselburgh",EH22:"dalkeith",EH23:"gorebridge",EH24:"rosewell",
  EH25:"roslin",EH26:"penicuik",EH27:"kirknewton",EH28:"newbridge",EH29:"kirkliston",
  EH30:"south_queensferry",EH31:"gullane",EH32:"prestonpans",EH33:"tranent",EH34:"pencaitland",
  EH35:"ormiston",EH36:"humbie",EH37:"pathhead",EH38:"heriot",EH39:"north_berwick",
  EH40:"east_linton",EH41:"haddington",EH42:"dunbar",EH43:"walkerburn",EH44:"innerleithen",
  EH45:"peebles",EH46:"west_linton",EH47:"bathgate",EH48:"bathgate",EH49:"linlithgow",
  EH51:"bo_ness",EH52:"broxburn",EH53:"livingston",EH54:"livingston",EH55:"west_calder",
  // Aberdeen & Grampian
  AB11:"aberdeen",AB12:"aberdeen",AB13:"milltimber",AB14:"peterculter",AB15:"aberdeen",
  AB16:"aberdeen",AB21:"aberdeen",AB22:"aberdeen",AB23:"aberdeen",AB24:"aberdeen",
  AB25:"aberdeen",AB30:"laurencekirk",AB31:"banchory",AB32:"westhill",AB33:"alford",
  AB34:"aboyne",AB35:"ballater",AB36:"strathdon",AB37:"ballindalloch",AB38:"aberlour",
  AB39:"stonehaven",AB41:"ellon",AB42:"peterhead",AB43:"fraserburgh",AB44:"macduff",
  AB45:"banff",AB51:"inverurie",AB52:"insch",AB53:"turriff",AB54:"huntly",AB55:"keith",
  AB56:"buckie",
  IV1:"inverness",IV2:"inverness",IV3:"inverness",IV4:"beauly",IV5:"inverness",IV6:"muir_of_ord",
  IV7:"conon_bridge",IV8:"munlochy",IV9:"avoch",IV10:"fortrose",IV11:"cromarty",IV12:"nairn",
  IV13:"tomatin",IV14:"strathpeffer",IV15:"dingwall",IV16:"dingwall",IV17:"alness",IV18:"invergordon",
  IV19:"tain",IV20:"tain",IV21:"gairloch",IV22:"achnasheen",IV23:"garve",IV24:"ardgay",
  IV25:"dornoch",IV26:"ullapool",IV27:"lairg",IV28:"rogart",IV30:"elgin",IV31:"lossiemouth",
  IV32:"fochabers",IV36:"forres",IV40:"kyle",IV41:"isle_of_skye",IV42:"isle_of_skye",
  IV43:"isle_of_skye",IV44:"isle_of_skye",IV45:"isle_of_skye",IV46:"isle_of_skye",
  IV47:"isle_of_skye",IV48:"isle_of_skye",IV49:"isle_of_skye",IV51:"portree",IV52:"plockton",
  IV53:"stromeferry",IV54:"strathcarron",IV55:"isle_of_skye",IV56:"isle_of_skye",
  // Dundee & Tayside
  DD2:"dundee",DD3:"dundee",DD4:"dundee",DD5:"dundee",DD6:"newport_on_tay",DD7:"carnoustie",
  DD8:"forfar",DD9:"brechin",DD10:"montrose",DD11:"arbroath",
  PH1:"perth",PH2:"perth",PH3:"auchterarder",PH4:"auchterarder",PH5:"crieff",PH6:"crieff",
  PH7:"crieff",PH8:"dunkeld",PH9:"birnam",PH10:"blairgowrie",PH11:"blairgowrie",
  PH12:"meigle",PH13:"coupar_angus",PH14:"perth",PH15:"aberfeldy",PH16:"pitlochry",
  PH17:"pitlochry",PH18:"pitlochry",PH19:"dalwhinnie",PH20:"newtonmore",PH21:"kingussie",
  PH22:"aviemore",PH23:"carrbridge",PH24:"boat_of_garten",PH25:"nethy_bridge",PH26:"grantown",
  PH30:"corrour",PH31:"roybridge",PH32:"fort_augustus",PH33:"fort_william",PH34:"spean_bridge",
  PH35:"invergarry",PH36:"acharacle",PH37:"glenfinnan",PH38:"lochailort",PH39:"arisaig",
  PH40:"mallaig",PH41:"mallaig",PH42:"isle_of_eigg",PH43:"isle_of_rhum",PH44:"isle_of_canna",
  PH49:"ballachulish",PH50:"kinlochleven",
  // Fife
  KY1:"kirkcaldy",KY2:"kirkcaldy",KY3:"burntisland",KY4:"cowdenbeath",KY5:"lochgelly",
  KY6:"glenrothes",KY7:"glenrothes",KY8:"leven",KY9:"leven",KY10:"anstruther",KY11:"dunfermline",
  KY12:"dunfermline",KY13:"kinross",KY14:"cupar",KY15:"cupar",KY16:"st_andrews",
  // Stirling & Central
  FK1:"falkirk",FK2:"falkirk",FK3:"grangemouth",FK4:"bonnybridge",FK5:"larbert",FK6:"denny",
  FK7:"stirling",FK8:"stirling",FK9:"stirling",FK10:"alloa",FK11:"menstrie",FK12:"alva",
  FK13:"tillicoultry",FK14:"dollar",FK15:"dunblane",FK16:"doune",FK17:"callander",
  FK18:"callander",FK19:"lochearnhead",FK20:"crianlarich",FK21:"killin",
  // Borders / Dumfries
  TD1:"galashiels",TD2:"lauder",TD3:"earlston",TD4:"melrose",TD5:"kelso",TD6:"melrose",
  TD7:"selkirk",TD8:"jedburgh",TD9:"hawick",TD10:"duns",TD11:"duns",TD12:"coldstream",
  TD13:"cockburnspath",TD14:"eyemouth",TD15:"berwick_upon_tweed",
  DG1:"dumfries",DG2:"dumfries",DG3:"thornhill",DG4:"sanquhar",DG5:"dalbeattie",
  DG6:"kirkcudbright",DG7:"castle_douglas",DG8:"newton_stewart",DG9:"stranraer",DG10:"moffat",
  DG11:"lockerbie",DG12:"annan",DG13:"langholm",DG14:"canonbie",DG16:"gretna",
  // Western Isles / Orkney / Shetland
  HS1:"stornoway",HS2:"stornoway",HS3:"isle_of_harris",HS4:"isle_of_scalpay",HS5:"isle_of_harris",
  HS6:"isle_of_north_uist",HS7:"isle_of_benbecula",HS8:"isle_of_south_uist",HS9:"isle_of_barra",
  KW1:"wick",KW2:"lybster",KW3:"lybster",KW5:"latheron",KW6:"dunbeath",KW7:"berriedale",
  KW8:"helmsdale",KW9:"brora",KW10:"golspie",KW11:"kinbrace",KW12:"halkirk",KW13:"forsinard",
  KW14:"thurso",KW15:"kirkwall",KW16:"stromness",KW17:"orkney",
  ZE1:"lerwick",ZE2:"shetland",ZE3:"shetland",

  // ── NORTHERN IRELAND ────────────────────────────────────────────────
  BT1:"belfast",BT2:"belfast",BT3:"belfast",BT4:"belfast",BT5:"belfast",BT6:"belfast",
  BT7:"belfast",BT8:"belfast",BT9:"belfast",BT10:"belfast",BT11:"belfast",BT12:"belfast",
  BT13:"belfast",BT14:"belfast",BT15:"belfast",BT16:"dundonald",BT17:"belfast",
  BT18:"holywood",BT19:"bangor",BT20:"bangor",BT21:"donaghadee",BT22:"newtownards",
  BT23:"newtownards",BT24:"ballynahinch",BT25:"dromore",BT26:"hillsborough",BT27:"lisburn",
  BT28:"lisburn",BT29:"crumlin",BT30:"downpatrick",BT31:"castlewellan",BT32:"banbridge",
  BT33:"newcastle_ni",BT34:"newry",BT35:"newry",BT36:"newtownabbey",BT37:"newtownabbey",
  BT38:"carrickfergus",BT39:"ballyclare",BT40:"larne",BT41:"antrim",BT42:"ballymena",
  BT43:"ballymena",BT44:"ballymena",BT45:"magherafelt",BT46:"maghera",BT47:"londonderry",
  BT48:"londonderry",BT49:"limavady",BT51:"coleraine",BT52:"coleraine",BT53:"ballymoney",
  BT54:"ballycastle",BT55:"portstewart",BT56:"portrush",BT57:"bushmills",BT60:"armagh",
  BT61:"armagh",BT62:"craigavon",BT63:"craigavon",BT64:"craigavon",BT65:"craigavon",
  BT66:"craigavon",BT67:"craigavon",BT68:"caledon",BT69:"aughnacloy",BT70:"dungannon",
  BT71:"dungannon",BT74:"enniskillen",BT75:"fivemiletown",BT76:"clogher",BT77:"augher",
  BT78:"omagh",BT79:"omagh",BT80:"cookstown",BT81:"castlederg",BT82:"strabane",BT92:"lisnaskea",BT93:"enniskillen",BT94:"enniskillen",
};

var PC_PSF = {
  SW1:1650,SW3:1450,W1:1800,EC1:920,N1:820,NW3:1050,NW1:850,E1:750,E14:680,
  SE1:780,SW4:680,SW8:720,SW11:720,SW18:700,W4:760,W6:720,W11:1100,
  M1:320,M4:310,M20:340,M21:320,SK9:420,
  B1:295,B15:340,B17:310,B29:230,
  CV1:210,CV6:300,CV8:380,
  LS1:280,LS6:260,LS7:270,LS8:310,LS17:330,
  S1:195,S10:240,S11:270,S17:310,
  L1:210,L17:230,L18:260,
  BS1:380,BS6:450,BS8:430,BS9:420,BA1:520,BA2:490,
  EH1:400,EH2:490,EH3:480,EH4:380,EH8:360,EH9:430,
  G1:200,G3:220,G12:250,
  CB1:610,CB2:590,OX1:580,OX4:480,
  RG1:380,GU1:480,BN1:420,BN3:400,
  NG1:220,NG7:195,LE1:195,DE1:195,
  NE1:190,NE2:240,YO1:310,HG1:310,
  CF10:215,CF11:250,SA1:155,HU1:110,
  AB10:185,DD1:150,
  // Somerset / South West
  TA1:260,TA2:255,TA3:260,TA4:240,TA5:250,TA6:230,TA7:220,TA8:235,
  TA9:225,TA10:235,TA11:240,TA18:245,TA19:240,TA20:235,TA21:250,TA24:260,
  BA1:420,BA2:400,BA3:260,BA4:270,BA5:275,BA11:265,BA14:270,BA20:250,BA21:248,
  BS1:360,BS2:340,BS3:330,BS6:380,BS7:360,BS8:400,BS9:380,BS23:260,
  EX1:290,EX2:285,EX4:285,EX8:310,EX10:320,EX31:255,EX39:245,
  TQ1:275,TQ2:270,TQ3:265,TQ9:280,TQ12:265,TQ14:280,
  PL1:200,PL4:205,PL6:215,PL9:220,
  TR1:265,TR7:260,TR11:275,TR18:270,TR26:300,
  DT1:280,DT3:275,DT6:290,DT9:285,DT11:265,
  SP1:295,SP4:280,SN1:260,SN2:258,SN15:275,
  GU1:420,GU7:400,GU9:380,GU21:400,GU25:550,
  RH1:360,RH2:380,RH10:340,RH12:355,RH16:370,
  ME1:260,ME4:255,ME14:265,ME15:260,ME19:295,
  CT1:265,CT5:290,CT9:260,CT14:280,CT20:285,
  TN1:370,TN2:365,TN9:340,TN13:420,TN34:260,TN40:270,
  // Staffordshire (ST), Wolverhampton (WV), Walsall (WS), Telford/Shropshire (TF)
  ST1:165,ST2:160,ST4:170,ST5:180,ST6:158,ST7:185,ST8:175,ST10:190,
  ST11:200,ST12:215,ST13:185,ST14:195,ST15:215,ST16:215,ST17:225,
  ST18:220,ST19:230,ST20:225,ST21:230,
  WV1:175,WV3:200,WV6:240,WV7:230,WV8:220,WV10:170,WV11:185,WV13:175,
  WS1:175,WS2:170,WS3:180,WS9:230,WS10:170,WS13:240,WS14:235,WS15:215,
  TF1:175,TF2:180,TF3:175,TF7:185,TF10:215,TF11:210,TF12:225,TF13:230,
  // Warwickshire (CV remainder, B for north Warwickshire) and Worcestershire (WR, B61-98)
  CV9:235,CV10:215,CV11:215,CV12:210,CV21:215,CV22:220,CV23:240,CV31:280,CV32:295,CV33:285,CV34:295,CV35:280,CV36:265,CV37:285,CV47:255,
  B49:255,B50:260,B76:245,B77:215,B78:200,B79:210,B80:265,B95:285,B96:265,B97:235,B98:225,
  WR1:240,WR2:245,WR3:230,WR5:245,WR7:255,WR9:230,WR10:255,WR11:265,WR14:295,
  // Derbyshire / Nottinghamshire / Leicestershire remainder
  DE3:220,DE6:255,DE11:200,DE13:225,DE14:200,DE15:205,DE22:245,DE23:215,DE56:265,DE65:225,DE72:235,DE73:240,
  NG6:195,NG10:215,NG12:255,NG14:245,NG15:215,NG16:215,NG22:225,NG24:225,NG25:280,NG31:230,NG34:240,
  LE3:200,LE7:240,LE8:225,LE10:215,LE11:220,LE12:235,LE15:255,LE16:245,LE17:225,LE65:255,
  // ── Essex PSF (mid-2026 estimates) ──────────────────────────────────
  CM1:330,CM2:340,CM3:355,CM4:380,CM6:325,CM7:295,CM8:310,
  CM9:340,CM0:325,
  CM11:355,CM12:360,CM13:395,CM14:400,CM15:390,CM16:410,CM17:285,CM18:280,CM19:285,CM20:290,
  CO1:285,CO2:280,CO3:290,CO4:285,CO5:325,CO6:310,CO7:300,
  CO9:290,CO10:305,CO11:295,CO13:320,CO14:315,CO15:265,CO16:260,
  SS1:300,SS2:295,SS3:295,SS6:300,SS7:325,SS8:295,SS9:320,SS13:285,SS14:285,SS15:290,SS16:290,
  IG7:435,IG8:425,IG9:445,IG10:425,
  RM1:340,RM2:355,RM12:360,RM14:395,
  // ── Hertfordshire PSF ────────────────────────────────────────────────
  AL1:475,AL2:485,AL3:470,AL4:465,AL5:490,AL6:455,AL7:430,AL10:425,
  WD1:495,WD3:540,WD6:485,WD7:550,WD17:495,WD18:475,WD19:475,WD23:520,
  HP1:380,HP2:370,HP3:385,HP4:445,HP5:430,HP7:495,HP8:520,HP9:565,
  SG1:340,SG2:335,SG4:395,SG5:390,SG6:355,SG8:380,SG12:365,SG13:380,SG14:395,
  EN1:425,EN5:475,EN6:455,EN7:395,EN10:395,
  // ── Kent PSF expansion ───────────────────────────────────────────────
  CT2:255,CT3:250,CT4:265,CT6:275,CT7:265,CT8:280,
  CT11:255,CT12:250,CT13:275,CT15:255,CT16:240,CT17:235,CT18:265,CT21:280,
  ME2:240,ME3:245,ME5:240,ME6:255,ME7:235,ME8:240,ME10:240,ME12:230,ME13:265,
  ME16:265,ME17:285,ME18:280,ME20:270,
  TN3:355,TN4:355,TN8:380,TN9:340,TN10:340,TN11:345,TN13:425,TN14:415,TN15:410,
  // ── Surrey PSF expansion ─────────────────────────────────────────────
  GU2:430,GU3:435,GU4:425,GU5:460,GU7:415,GU8:445,GU9:430,GU10:415,
  GU15:435,GU16:415,GU20:485,GU21:430,GU22:425,GU23:445,GU24:420,GU25:560,
  KT10:550,KT11:535,KT12:445,KT13:520,KT14:430,KT15:425,KT16:420,KT17:430,KT18:495,KT19:445,KT20:475,KT21:495,KT22:470,KT23:495,
  RH1:380,RH2:425,RH3:455,RH4:425,RH5:415,RH6:325,RH7:355,RH8:415,RH9:395,RH10:330,RH11:325,RH12:355,RH13:345,
};

var BUILD_TYPES = {
  // v9.33 — Updated SFH benchmark per Phil/Cassidy: mid £225/sqft, hi £270/sqft (Tier 1).
  // Reflects current 2025 build costs for Tier-1 delivered SFH schemes in SE England:
  // - Volume housebuilder (Barratt/Persimmon scale, repeat designs): £160-180/sqft (lo)
  // - Mid-market developer with Tier 1 contractor: £210-240/sqft (mid £225 benchmark)
  // - Higher spec / urban / fabric-first energy / smaller scale: £250-290/sqft (hi)
  "Residential apartments":{lo:185,mid:220,hi:280,fees:0.12,plan:8000},
  "Residential houses":{lo:165,mid:225,hi:270,fees:0.10,plan:5000},
  "BTR (Build to Rent)":{lo:200,mid:235,hi:300,fees:0.13,plan:10000},
  "PBSA (Student)":{lo:175,mid:210,hi:265,fees:0.12,plan:8500},
  "Later Living":{lo:195,mid:230,hi:290,fees:0.13,plan:9000},
  "Pub conversion":{lo:180,mid:230,hi:300,fees:0.14,plan:12000},
  "Office conversion":{lo:160,mid:200,hi:260,fees:0.13,plan:10000},
  "Church conversion":{lo:220,mid:280,hi:380,fees:0.15,plan:15000},
  "Barn conversion":{lo:200,mid:260,hi:360,fees:0.14,plan:12000},
  "Industrial/Warehouse":{lo:80,mid:110,hi:150,fees:0.08,plan:5000},
  "Hotel (3-4 star)":{lo:220,mid:285,hi:380,fees:0.14,plan:18000},
  "Care home":{lo:210,mid:260,hi:330,fees:0.13,plan:12000},
  "Mixed use":{lo:200,mid:240,hi:300,fees:0.13,plan:12000},
};

// ──────────────────────────────────────────────────────────────────────
// ROUTE_DISCOUNT (v9.40) — lifted to module level so SFH stage AND Capitalisation
// both use the same values. Previously this lived inside Cap render only, so the
// SFH Dev Appraisal was using full retail GDV — overstating residual land value
// when scheme had AHP routes.
// ──────────────────────────────────────────────────────────────────────
var ROUTE_DISCOUNT = {
  "private":         {pct:1.00, label:"Private retail sale",        col:"#2D7A65", note:"Full Market Value, individual buyers"},
  "pension":         {pct:0.88, label:"Pension/SFR bulk sale",      col:"#9A7B3E", note:"12% institutional discount for scale + yield-based pricing"},
  "ahp_social":      {pct:0.55, label:"AHP — Social Rent",          col:"#4A4BAE", note:"55% MV — sold to RP under AHP grant"},
  "ahp_so":          {pct:0.70, label:"AHP — Shared Ownership",     col:"#4A4BAE", note:"70% MV — first tranche sale to occupier, equity retained"},
  "ahp_affordable":  {pct:0.60, label:"AHP — Affordable Rent",      col:"#4A4BAE", note:"60% MV — sold to RP at affordable rent valuation"},
  "first_homes":     {pct:0.70, label:"First Homes",                col:"#4A4BAE", note:"70% MV cap under First Homes scheme (planning policy)"},
  "dms":             {pct:0.80, label:"Discounted Market Sale",     col:"#9A7B3E", note:"20% discount to open market — local eligibility criteria apply."},
  "rent_to_buy":     {pct:0.85, label:"Rent to Buy",                col:"#9A7B3E", note:"Intermediate rent now, option to buy later — ~85% MV to the provider."},
  "retained_prs":    {pct:0.85, label:"Retained PRS (yield-based)", col:"#B05A35", note:"NOTE: SFH Dev Appraisal uses 85% MV approximation. For exact yield-based value, see Capitalisation."},
  "btr_operator":    {pct:1.00, label:"BTR operator (full rental value)", col:"#2D7A65", note:"Whole-scheme sale to a BTR operator on a rental model — capitalised at target yield, NO affordable discount (100% of value)."}
};

// ──────────────────────────────────────────────────────────────────────
// sfhAhFactor (v9.46) — SINGLE source of the affordable-housing GDV haircut.
// Used by BOTH computeSFHMetrics (the canonical engine) and the SFH House Mix
// screen so their blended GDV always agrees. When a scheme's mix rows already
// carry per-row tenure, that per-row blend is authoritative and this overall
// ahPct haircut is NOT applied on top (avoids double-counting). When the mix is
// all-private but the scheme has an overall AH% (sfh.ahPct), this returns the
// blend factor: private units at full MV, AH units at the AH tenure discount.
// ──────────────────────────────────────────────────────────────────────
function sfhAhFactor(data){
  data = data || {};
  var sfh = data.sfh || {};
  // v9.50 — Affordable % may be entered on the SFH, Planning or Tenure stage.
  // Resolve across all of them (incl. the legacy 'afhPct') so the affordable blend
  // is applied no matter where it was set — keeping GDV/RLV identical across the
  // dashboard, Land Valuation and the Executive Summary.
  var p = data.planning || {}, t = data.tenure || {};
  var ahPct = num(sfh.ahPct) || num(p.ahPct) || num(p.afhPct) || num(t.ahPct) || 0;
  if(ahPct <= 0) return 1;
  // No per-tenure granularity is captured for the overall AH%, so value the AH
  // units at Affordable Rent (60% MV) as a representative default. A scheme that
  // wants a different AH tenure should tag the mix rows individually instead.
  var ahDisc = (ROUTE_DISCOUNT[sfh.ahTenure || t.ahTenure] || ROUTE_DISCOUNT.ahp_affordable).pct;
  var f = Math.min(1, ahPct / 100);
  return (1 - f) + f * ahDisc;
}


// HOUSE_TYPES — each: beds, typical sqft (GIA), adj (sale £/sqft multiplier vs the base
// sale £/sqft), and build (BCIS-style 2026 UK new-build CONSTRUCTION cost £/sqft GIA,
// standard spec, before regional index and Tier-1 main-contractor uplift, and excluding
// land/fees/externals/contingency).
// v10.43 — the SALE adjustment (adj) is now FLAT at 1.00 for every type: every house sells at
// the same base £/sqft (Cassidy's chosen basis), so a bigger/detached home no longer gets an
// inflated £/sqft. GDV = Σ(sqft × count) × base sale £/sqft. Per-row £/sqft is still fully
// editable on the SFH House Mix stage for a deal where types genuinely differ. BUILD cost stays
// per-type (a detached genuinely costs more to build than a terrace — that's a cost, not GDV).
var HOUSE_TYPES = {
  // ── Apartments / flats (new-build) ──
  "Studio apartment":{beds:0,sqft:330,adj:1.00,build:215},
  "1-bed apartment":{beds:1,sqft:520,adj:1.00,build:210},
  "2-bed apartment":{beds:2,sqft:680,adj:1.00,build:210},
  "3-bed apartment":{beds:3,sqft:900,adj:1.00,build:215},
  "2-bed penthouse":{beds:2,sqft:950,adj:1.00,build:245},
  "3-bed penthouse":{beds:3,sqft:1300,adj:1.00,build:255},
  // ── Conversion flats (stately home / office / pub converted to flats) ──
  "Conversion studio":{beds:0,sqft:380,adj:1.00,build:150},
  "Conversion 1-bed flat":{beds:1,sqft:560,adj:1.00,build:150},
  "Conversion 2-bed flat":{beds:2,sqft:800,adj:1.00,build:150},
  "Conversion 3-bed flat":{beds:3,sqft:1100,adj:1.00,build:155},
  "Conversion duplex":{beds:3,sqft:1300,adj:1.00,build:165},
  // ── Maisonettes / coach houses ──
  "1-bed maisonette":{beds:1,sqft:600,adj:1.00,build:180},
  "2-bed maisonette":{beds:2,sqft:820,adj:1.00,build:180},
  "Coach house 2-bed":{beds:2,sqft:700,adj:1.00,build:185},
  // ── Terraces ──
  "1-bed terrace":{beds:1,sqft:550,adj:1.00,build:165},
  "2-bed terrace":{beds:2,sqft:720,adj:1.00,build:165},
  "3-bed terrace":{beds:3,sqft:920,adj:1.00,build:170},
  "4-bed terrace":{beds:4,sqft:1180,adj:1.00,build:175},
  // ── Mews / townhouses ──
  "2-bed mews":{beds:2,sqft:900,adj:1.00,build:180},
  "3-bed mews":{beds:3,sqft:1050,adj:1.00,build:185},
  "3-bed townhouse":{beds:3,sqft:1300,adj:1.00,build:190},
  "4-bed townhouse":{beds:4,sqft:1650,adj:1.00,build:200},
  // ── Semi-detached ──
  "2-bed semi":{beds:2,sqft:820,adj:1.00,build:165},
  "3-bed semi":{beds:3,sqft:1020,adj:1.00,build:170},
  "4-bed semi":{beds:4,sqft:1300,adj:1.00,build:180},
  // ── Link-detached ──
  "3-bed link-detached":{beds:3,sqft:1100,adj:1.00,build:180},
  "4-bed link-detached":{beds:4,sqft:1350,adj:1.00,build:188},
  // ── Detached ──
  "3-bed detached":{beds:3,sqft:1150,adj:1.00,build:185},
  "4-bed detached":{beds:4,sqft:1500,adj:1.00,build:195},
  "4-bed executive":{beds:4,sqft:1900,adj:1.00,build:230},
  "5-bed detached":{beds:5,sqft:2400,adj:1.00,build:215},
  "5-bed executive":{beds:5,sqft:2900,adj:1.00,build:260},
  "6-bed detached":{beds:6,sqft:3400,adj:1.00,build:245},
  // ── Bungalows ──
  "Bungalow 2-bed":{beds:2,sqft:800,adj:1.00,build:190},
  "Bungalow 3-bed":{beds:3,sqft:1050,adj:1.00,build:198},
  // ── Prime / large country houses ──
  "Manor house":{beds:6,sqft:4500,adj:1.00,build:320},
  "Mansion":{beds:8,sqft:6500,adj:1.00,build:380},
};

// BCIS regional index (1.00 = UK average). Tweakable; covers the broad spread a
// QS would apply. Cassidy operates UK-wide ex-London, so the Midlands/regions sit
// near or just below 1.0; the South East and prime areas run higher.
var BUILD_REGION_INDEX = {
  london:1.18, oxford:1.12, cambridge:1.12, guildford:1.12, brighton:1.08, bath:1.06,
  bristol:1.03, manchester:1.0, birmingham:0.99, coventry:0.98, leamington:1.0,
  maldon:1.02, exeter:1.01, taunton:1.0, worcester:0.98, stoke:0.95, telford:0.95,
  wolverhampton:0.97, walsall:0.97, stafford:0.98, tamworth:0.98, lichfield:1.0
};
// Tier-1 main contractor (Winvic, Vinci, Wates etc.) adds main-contractor prelims,
// overheads & profit and programme certainty over a self-delivered/sub-let rate.
var TIER1_BUILD_UPLIFT = 1.12;  // ~12%
// v9.72 — HA low-carbon spec uplift. Captures the build-cost premium of a housing-
// association brief (e.g. CHP/Delta): Air Source Heat Pumps, roof PV + battery storage,
// EPC band B fabric, NDSS minimum sizes, 12-yr NHBC. ~£20-30/sqft on a ~£250 base.
var HA_SPEC_UPLIFT = 1.12;  // ~12% — editable in the Build Cost Library

// Nationally Described Space Standards (NDSS) — minimum gross internal area for a
// 2-storey house, by bed/person size. Used as a floor for affordable units that the
// CHP/Delta brief requires. (m² and the sqft equivalent.)
var NDSS_MIN = {
  "1b2p":{m2:58, sqft:624},
  "2b3p":{m2:70, sqft:753},
  "2b4p":{m2:79, sqft:850},
  "3b4p":{m2:84, sqft:904},
  "3b5p":{m2:93, sqft:1001},
  "4b5p":{m2:97, sqft:1044},
  "4b6p":{m2:106, sqft:1141}
};

// typicalBuildPsf — the benchmark construction cost £/sqft for a house type, with
// optional regional index and Tier-1 main-contractor uplift. A QS-grade starting
// point to validate against an actual cost plan or contractor tender.
function typicalBuildPsf(type, opts){
  opts = opts || {};
  var t = HOUSE_TYPES[type];
  var base = (t && t.build) || 185;
  var region = num(opts.regionIndex) || (opts.city && BUILD_REGION_INDEX[(opts.city||"").toLowerCase()]) || 1.0;
  var f = base * region * (opts.tier1 ? TIER1_BUILD_UPLIFT : 1) * (opts.haSpec ? HA_SPEC_UPLIFT : 1);
  return Math.round(f);
}

// benchmarkBuildPsf — build cost £/sqft for ANY development type in BUILD_TYPES
// (apartments, BTR, PBSA, Later Living, pub/office/church/barn conversions,
// industrial, hotel, care home, mixed use). Applies the regional index and the
// Tier-1 main-contractor uplift, so every product is costed on the same basis as
// the houses. band: "lo" | "mid" (default) | "hi".
function benchmarkBuildPsf(schemeType, opts){
  opts = opts || {};
  var bt = BUILD_TYPES[schemeType] || BUILD_TYPES["Residential apartments"];
  var band = opts.band === "lo" ? bt.lo : opts.band === "hi" ? bt.hi : bt.mid;
  var region = num(opts.regionIndex) || (opts.city && BUILD_REGION_INDEX[(opts.city||"").toLowerCase()]) || 1.0;
  return Math.round(band * region * (opts.tier1 ? TIER1_BUILD_UPLIFT : 1) * (opts.haSpec ? HA_SPEC_UPLIFT : 1));
}
// Map a Landform asset type to its BUILD_TYPES key.
function buildTypeForAsset(assetType){
  return ({btr:"BTR (Build to Rent)", pbsa:"PBSA (Student)", sfh:"Residential houses"})[assetType] || "Residential apartments";
}

// ── BUILD-COST SETTINGS (v9.50) ─────────────────────────────────────────────
// Cassidy / the QS can keep the benchmark library current without code changes.
// Overrides persist in localStorage ("cassidy_build_costs") and merge over the
// code defaults at load, so every build-cost helper picks them up automatically.
var BUILD_TYPES_DEFAULTS = JSON.parse(JSON.stringify(BUILD_TYPES));
var HOUSE_BUILD_DEFAULTS = (function(){ var o={}; Object.keys(HOUSE_TYPES).forEach(function(k){ o[k]=HOUSE_TYPES[k].build; }); return o; })();
var TIER1_BUILD_UPLIFT_DEFAULT = TIER1_BUILD_UPLIFT;
var HA_SPEC_UPLIFT_DEFAULT = HA_SPEC_UPLIFT;
function applyBuildCostSettings(bc){
  if(!bc) return;
  if(num(bc.tier1Uplift) > 0) TIER1_BUILD_UPLIFT = num(bc.tier1Uplift);
  if(num(bc.haSpecUplift) > 0) HA_SPEC_UPLIFT = num(bc.haSpecUplift);
  if(bc.types) Object.keys(bc.types).forEach(function(k){ if(BUILD_TYPES[k]) ["lo","mid","hi"].forEach(function(b){ if(num(bc.types[k][b]) > 0) BUILD_TYPES[k][b] = num(bc.types[k][b]); }); });
  if(bc.houses) Object.keys(bc.houses).forEach(function(k){ if(HOUSE_TYPES[k] && num(bc.houses[k]) > 0) HOUSE_TYPES[k].build = num(bc.houses[k]); });
}
function currentBuildCostSettings(){
  var types = {}; Object.keys(BUILD_TYPES).forEach(function(k){ types[k] = {lo:BUILD_TYPES[k].lo, mid:BUILD_TYPES[k].mid, hi:BUILD_TYPES[k].hi}; });
  var houses = {}; Object.keys(HOUSE_TYPES).forEach(function(k){ houses[k] = HOUSE_TYPES[k].build; });
  return {tier1Uplift:TIER1_BUILD_UPLIFT, haSpecUplift:HA_SPEC_UPLIFT, types:types, houses:houses};
}
function saveBuildCostSettings(bc){ try{ localStorage.setItem("cassidy_build_costs", JSON.stringify(bc)); }catch(e){} applyBuildCostSettings(bc); }
function resetBuildCostSettings(){
  try{ localStorage.removeItem("cassidy_build_costs"); }catch(e){}
  Object.keys(BUILD_TYPES_DEFAULTS).forEach(function(k){ BUILD_TYPES[k] = Object.assign({}, BUILD_TYPES[k], BUILD_TYPES_DEFAULTS[k]); });
  Object.keys(HOUSE_BUILD_DEFAULTS).forEach(function(k){ if(HOUSE_TYPES[k]) HOUSE_TYPES[k].build = HOUSE_BUILD_DEFAULTS[k]; });
  TIER1_BUILD_UPLIFT = TIER1_BUILD_UPLIFT_DEFAULT;
  HA_SPEC_UPLIFT = HA_SPEC_UPLIFT_DEFAULT;
}
(function(){ try{ var bc = JSON.parse(localStorage.getItem("cassidy_build_costs") || "null"); if(bc) applyBuildCostSettings(bc); }catch(e){} })();

var RISK_DEFAULTS = [
  {id:1,cat:"Planning",desc:"Consent delayed or refused",rag:"amber",mit:"Pre-app engaged, LPA meeting scheduled"},
  {id:2,cat:"Ground",desc:"Unknown ground contamination",rag:"amber",mit:"Phase 1 instructed, contingency in appraisal"},
  {id:3,cat:"Construction",desc:"Build cost inflation",rag:"red",mit:"Fixed price D&B tender, QS monthly review"},
  {id:4,cat:"Market",desc:"Rental void exceeds 8% year 1",rag:"green",mit:"Pre-marketing 9 months pre-completion"},
  {id:5,cat:"Finance",desc:"Senior debt facility pulled",rag:"amber",mit:"Two lenders in parallel conversations"},
  {id:6,cat:"Exit",desc:"Yield compression at exit",rag:"amber",mit:"Forward fund terms being negotiated"},
];

var BUYERS = [
  {name:"Greystar",type:"REIM",min:50,status:"Active"},
  {name:"Legal & General",type:"Pension",min:100,status:"Active"},
  {name:"Grainger plc",type:"REIT",min:30,status:"Active"},
  {name:"M&G Real Estate",type:"Fund",min:75,status:"Active"},
  {name:"Heimstaden",type:"Private",min:50,status:"Active"},
  {name:"Apache Capital",type:"REIM",min:40,status:"Active"},
  {name:"Aware Super",type:"Sovereign",min:150,status:"Active"},
  {name:"Invesco RE",type:"Fund",min:100,status:"Selective"},
];

var CITIES = Object.keys(MKT);

// Bedroom rent multipliers (relative to 1-bed base in MKT.btr)
// Source: Rightmove/Savills market data 2025 averages
var BED_MULT = {1:1.00, 2:1.38, 3:1.65, 4:1.92};

// RENT_BED_FACTOR (v9.51) — monthly rent by bedroom count RELATIVE TO A 3-BED
// (the typical home, = MKT[city].btr). Fixes the old assumption that btr was a
// 1-bed rent (which overstated larger homes). Ratios approximate UK/ONS spread.
var RENT_BED_FACTOR = {0:0.50, 1:0.62, 2:0.78, 3:1.00, 4:1.53, 5:1.92, 6:2.30};
// dealCityKey — the deal's actual area, resolved from the city set on ANY stage,
// and falling back to the postcode (so e.g. Maldon CM9 4DY always resolves to
// Maldon). Single source of "which area" for all rent/area lookups.
function dealCityKey(data){
  data = data || {};
  var c = ((data.sfh && data.sfh.city) || (data.land && data.land.city) || (data.rlv && data.rlv.city) || (data.hra && data.hra.city) || (data.tenure && data.tenure.city) || (data.epe && data.epe.city) || "").toLowerCase();
  if(MKT[c]) return c;
  var pc = (data.land && data.land.postcode) || (data.rlv && data.rlv.postcode) || (data.epe && data.epe.postcode) || "";
  var pcd = (pc && typeof lookupPostcode === "function") ? lookupPostcode(pc) : null;
  if(pcd && pcd.city && MKT[pcd.city]) return pcd.city;
  // v9.92 — universal fallback: postcode AREA → nearest anchor market (guaranteed in
  // MKT). So the MANUAL Land Appraisal path resolves any village by postcode too, not
  // just Keystone-built deals.
  if(pc && typeof postcodeMarketKey === "function"){ var a = postcodeMarketKey(pc); if(a) return a; }
  return (pcd && pcd.city) ? pcd.city : c;
}

// v10.52 — landValueGuide: an indicative MARKET land-value guide for a site, by land TYPE /
// planning status, so a board proposal with no asking price still shows what the land would
// typically change hands for in that area. Mirrors the Land Appraisal stage's £/acre bands
// (agricultural floor → strategic/hope value → allocated → outline → full consent), derived
// from the area's consented land value (MKT[key].land, a typical total for a ~5-acre consented
// SFH site). These are broad market ranges to sanity-check an entry price — NOT a substitute for
// the scheme's residual land value (what the land is actually worth to us at target profit).
function landValueGuide(data){
  data = data || {};
  var l = data.land || {};
  var cityKey = (typeof dealCityKey === "function") ? dealCityKey(data) : ((l.city || "").toLowerCase());
  var m = (typeof MKT !== "undefined" && (MKT[cityKey] || MKT.manchester)) || { land:3000000 };
  var acres = num(l.acres) || 0;
  var fullyConsentedPerAcre = (num(m.land) || 3000000) / 5;      // MKT.land ≈ typical 5-acre consented total
  var agriPerAcre = numOr(l.agriValPerAcre, 15000);              // agricultural (current-use) floor £/acre
  var bands = [
    { key:"agricultural", label:"Agricultural / farmland (current use, no planning)", lo:agriPerAcre*0.7,           mid:agriPerAcre,               hi:agriPerAcre*1.3 },
    { key:"strategic",    label:"Greenbelt / strategic — hope value, no consent",     lo:fullyConsentedPerAcre*0.10, mid:fullyConsentedPerAcre*0.18, hi:fullyConsentedPerAcre*0.30 },
    { key:"allocated",    label:"Allocated in a Local Plan",                           lo:fullyConsentedPerAcre*0.35, mid:fullyConsentedPerAcre*0.50, hi:fullyConsentedPerAcre*0.70 },
    { key:"outline",      label:"With outline consent",                               lo:fullyConsentedPerAcre*0.65, mid:fullyConsentedPerAcre*0.80, hi:fullyConsentedPerAcre*1.00 },
    { key:"consented",    label:"With full consent / serviced residential",           lo:fullyConsentedPerAcre*0.85, mid:fullyConsentedPerAcre*1.00, hi:fullyConsentedPerAcre*1.20 }
  ];
  return { cityKey:cityKey, acres:acres, fullyConsentedPerAcre:fullyConsentedPerAcre, agriPerAcre:agriPerAcre, bands:bands };
}

// v10.52 — showReportOverlay: open a generated report (the one-pager or board paper HTML) in an
// IN-APP overlay instead of a new browser tab. On mobile a new tab strands you — you have to
// close it and find your way back to Landform. This shows the report over the app with Close and
// Print buttons, so you stay in Landform and can regenerate any time. Falls back to a new tab if
// the overlay can't be created. Returns true on success.
function showReportOverlay(html, title){
  try{
    if(typeof document === "undefined" || !document.body) return false;
    var old = document.getElementById("lf-report-overlay");
    if(old && old.parentNode) old.parentNode.removeChild(old);
    var ov = document.createElement("div");
    ov.id = "lf-report-overlay";
    ov.setAttribute("style", "position:fixed;inset:0;z-index:99999;background:rgba(20,21,45,0.6);display:flex;flex-direction:column;");
    var bar = document.createElement("div");
    bar.setAttribute("style", "display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;background:#1E1F5C;color:#fff;font-family:DM Sans,sans-serif;");
    var ttl = document.createElement("div");
    ttl.textContent = title || "Report";
    ttl.setAttribute("style", "font-weight:800;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;");
    var btns = document.createElement("div");
    btns.setAttribute("style", "display:flex;gap:8px;flex:0 0 auto;");
    var printBtn = document.createElement("button");
    printBtn.textContent = "🖨 Print / Save PDF";
    printBtn.setAttribute("style", "padding:8px 14px;background:#C9A227;color:#1E1F5C;border:none;border-radius:6px;font-weight:800;font-size:13px;cursor:pointer;font-family:DM Sans,sans-serif;");
    var closeBtn = document.createElement("button");
    closeBtn.textContent = "✕ Close";
    closeBtn.setAttribute("style", "padding:8px 14px;background:rgba(255,255,255,0.18);color:#fff;border:none;border-radius:6px;font-weight:800;font-size:13px;cursor:pointer;font-family:DM Sans,sans-serif;");
    btns.appendChild(printBtn); btns.appendChild(closeBtn);
    bar.appendChild(ttl); bar.appendChild(btns);
    var frame = document.createElement("iframe");
    frame.setAttribute("title", title || "Report");
    frame.setAttribute("style", "flex:1;width:100%;border:none;background:#fff;");
    ov.appendChild(bar); ov.appendChild(frame);
    document.body.appendChild(ov);
    var doc = frame.contentWindow.document; doc.open(); doc.write(html); doc.close();
    function close(){ if(ov.parentNode) ov.parentNode.removeChild(ov); document.removeEventListener("keydown", onKey); }
    function onKey(ev){ if(ev.key === "Escape") close(); }
    closeBtn.onclick = close;
    printBtn.onclick = function(){ try{ frame.contentWindow.focus(); frame.contentWindow.print(); }catch(e){ try{ window.print(); }catch(e2){} } };
    document.addEventListener("keydown", onKey);
    return true;
  }catch(e){ return false; }
}

// v10.58 — basisOfFigures: the RATIONALE behind every headline number, derived from the actual
// deal, so a board paper / one-pager can show the SUBSTANCE behind the figures — where the sale
// value, build cost, rents, finance, S106, profit and land value came from and how they were
// calculated, including whether AI market research was applied. Returns { town, lines:[{k,v}] };
// both report generators render the same lines so they can never diverge.
function basisOfFigures(data){
  data = data || {};
  var sfh = data.sfh || {}, l = data.land || {}, cap = data.capitalise || {};
  var M = (typeof computeSFHMetrics === "function") ? computeSFHMetrics(data) : {};
  var town = (typeof cityName === "function" && typeof dealCityKey === "function") ? cityName(dealCityKey(data)) : (l.city || "the area");
  var pc = (l.postcode || (data.rlv && data.rlv.postcode) || "").toUpperCase();
  var lines = [];

  // Sale value
  var basePsf = Math.round(num(sfh.basePsf) || num(M.basePsf) || 0);
  var premium = num(sfh.nbPremiumPct);
  var aiPriced = sfh.pricesSource === "AI market research";
  lines.push({ k:"Sale value", v:"£" + basePsf + "/sqft. " + (aiPriced
    ? "Per-type prices come from AI market research of comparable new-build launches (Persimmon / Barratt / Redrow-type) in " + town + " — a larger detached home correctly shows a LOWER £/sqft than a smaller semi. Verify against live launches."
    : "Derived from the postcode's Land Registry £/sqft" + (premium > 0 ? " + a " + premium + "% new-build premium" : "") + " — indicative; verify against local new-build launches (Persimmon / Barratt / Redrow) or run ‘Complete with AI’.") });

  // Build cost
  var buildPsf = Math.round(num(sfh.buildPsf) || num(M.buildPsf) || 0);
  lines.push({ k:"Build cost", v:"£" + buildPsf + "/sqft" + (M.buildInclusive
    ? " treated as ALL-IN — covers construction, professional fees, contingency, roads/drainage & SuDS; finance is charged on the build cost."
    : " (construction only; professional fees, contingency, roads & SuDS are added as separate lines).") + " BCIS-range benchmark for the scheme type — confirm with a QS cost plan. Set deliberately on the CAUTIOUS side: a national housebuilder often builds cheaper, so a keener build rate would INCREASE the residual land value — this is a floor, not a stretch." });

  // Finance
  if(num(M.finance) > 0) lines.push({ k:"Finance", v:"S-curve / peak-debt basis: build × " + (num(M.financePeakDebtPct) || "?") + "% peak debt × " + (num(sfh.finRate) || 12) + "% pa × " + (num(M.financeProgYears) || "?") + " yrs × 0.6 average utilisation = " + fmt(num(M.finance)) + ". Reflects a phased programme where sales receipts recycle capital (peak debt « total build). The " + (num(sfh.finRate) || 12) + "% rate is deliberately conservative — senior development debt is typically ~8-9%, so a keener rate would raise the residual. Set ‘Programme (years)’ and ‘Peak debt %’ to your funding plan, or forward-fund." });

  // S106
  var s106pu = num(sfh.s106pu);
  lines.push({ k:"S106 / CIL", v:fmt(s106pu) + "/plot — " + (s106pu > 0 && sfh.s106pu !== "" ? "as entered" : "policy-typical assumption") + " (Education, Highways & cycleways, Health, Open space, Sport/community, Monitoring). Replace with the actual s106 heads of terms and the LPA’s CIL rate." });

  // Developer profit
  var profitPct = Math.round((num(sfh.profitPct) || 17.5) * 10) / 10;
  lines.push({ k:"Developer profit", v:profitPct + "% of GDV — the planning-viability benchmark (15–20%). A housebuilder’s ‘~30% margin’ is usually profit-on-cost (≈ 22–23% on GDV); see the profit-sensitivity table for the swing." });

  // Rents & capitalisation
  if(num(M.capNetRentPa) > 0){
    var y = num(cap.targetYield); if(y > 0 && y < 1) y *= 100; if(!(y > 0)) y = 4.9;
    var aiRents = cap.rentSource === "AI market research";
    lines.push({ k:"Rents & yield", v:"Net rent " + fmt(num(M.capNetRentPa)) + "/yr" + (aiRents
      ? " — per-bed rents from AI market research of local new-build lettings"
      : " — from area market data (run the AI rent research to localise)") + ", capitalised at a " + (Math.round(y * 10) / 10) + "% net initial yield (4.5% institutional floor). Drives the pension / forward-fund exit." });
  }

  // Land value
  lines.push({ k:"Land value", v:"The " + fmt(num(M.rlv)) + " is the RESIDUAL land value — the maximum supportable land price at target profit, not an agreed price. Raw / strategic land trades well below this; the gap is the promotion upside. See the market land-value guide for typical £/acre by planning status." });

  // v10.85 — conservative-basis summary: state plainly that the key value-drivers err to caution,
  // so a reviewer reads the residual as a FLOOR (downside-protected), not an optimistic figure.
  lines.push({ k:"Conservative basis", v:"The key inputs deliberately err on the side of caution — build cost set on the high side (a national builder often builds cheaper), finance at a full cost of money (senior debt is typically keener), and the sale value carries only a modest new-build premium. So the residual land value is a floor: if the real figures beat these, the land value is higher, not lower." });

  return { town:town, pc:pc, lines:lines };
}
// pcParts — split a UK postcode into its outcode / sector / full forms so rent (and other
// hyper-local) lookups can key at the finest available level. Rents vary WITHIN an outcode
// (e.g. CV6 Foleshill is cheaper than CV6 Coundon), so the sector — the outcode plus the first
// digit of the incode, e.g. "CV6 5" — is the granularity that actually separates districts.
//   "CV6 5AB" → { outcode:"CV6", sector:"CV6 5", full:"CV6 5AB" }
//   "CV22"    → { outcode:"CV22", sector:null, full:null }   (outcode only)
function pcParts(pc){
  pc = (pc || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if(pc.length < 3) return null;
  if(pc.length < 5) return { outcode: pc, sector: null, full: null };   // outcode only
  var inc = pc.slice(-3), out = pc.slice(0, -3);
  return { outcode: out, sector: out + " " + inc.charAt(0), full: out + " " + inc };
}

// VERIFIED_RENTS (v10.31) — researched, per-bed MONTHLY rents that OVERRIDE the generic
// area-derived figures. Keyed by POSTCODE at whatever granularity was researched:
//   • full postcode  "CV22 5AB"   — a specific parcel
//   • sector         "CV6 5"      — a district (this is how Foleshill vs Coundon differ)
//   • outcode        "CV22"       — a whole outcode where the district spread is small
// The resolver tries full → sector → outcode → (legacy) town, so the MOST specific researched
// figure always wins. Only the listed bed sizes are overridden; anything not listed (e.g. 1-bed)
// falls back to the generic area derivation. Surfaced as "verified" on the Capitalisation stage.
// To add a district: research it, then add e.g. "CV6 5":{label:"verified — CV6 5 Foleshill …",
// beds:{2:…,3:…,4:…}}. Do NOT guess — only add figures that have actually been checked.
var _VR_RUGBY = { label:"verified — Rugby researched (Rightmove/Zoopla/ONS, 2026)", beds:{ 2:1000, 3:1175, 4:1550 } };
var VERIFIED_RENTS = {
  // Rugby town (researched Jul 2026) — applied across its outcodes until sector-level data exists.
  "CV21": _VR_RUGBY, "CV22": _VR_RUGBY, "CV23": _VR_RUGBY
};
// verifiedRents — the most specific verified rent record for the deal's location, or null.
// Keys off the site POSTCODE (so a Rugby CV22 site gets Rugby figures even though CV geocodes
// to the Coventry anchor market), most-specific first; a legacy town key is a last resort.
function verifiedRents(data){
  var pc = (data && data.land && data.land.postcode) || (data && data.rlv && data.rlv.postcode) || "";
  var p = pcParts(pc);
  if(p){
    if(p.full && VERIFIED_RENTS[p.full]) return VERIFIED_RENTS[p.full];
    if(p.sector && VERIFIED_RENTS[p.sector]) return VERIFIED_RENTS[p.sector];
    if(p.outcode && VERIFIED_RENTS[p.outcode]) return VERIFIED_RENTS[p.outcode];
  }
  var key = (typeof dealCityKey === "function") ? dealCityKey(data) : "";   // legacy town-level fallback
  return (key && VERIFIED_RENTS[key]) ? VERIFIED_RENTS[key] : null;
}
// areaRentPcm — correct monthly rent for a given bedroom count in the DEAL's area
// (city or postcode). Prefers a VERIFIED figure where one exists for this area + bed size;
// otherwise anchored on the local typical (3-bed) rent. Returns 0 if the area has no rent
// benchmark so callers can fall back. Always editable downstream.
function areaRentPcm(data, beds){
  var b = Math.max(0, Math.min(6, Math.round(num(beds) || 3)));
  var vr = (typeof verifiedRents === "function") ? verifiedRents(data) : null;
  if(vr && vr.beds && vr.beds[b] != null) return num(vr.beds[b]);
  var mk = MKT[dealCityKey(data)];
  if(!mk || !mk.btr) return 0;
  return Math.round(mk.btr * (RENT_BED_FACTOR[b] != null ? RENT_BED_FACTOR[b] : 1));
}
// UK region for the deal's area — used to label regional build-cost benchmarks correctly
// (e.g. Maldon → "East of England", not a hard-coded "Worcestershire / South West").
var UK_REGION_BY_CITY = {
  london:"London",
  manchester:"North West", liverpool:"North West", chester:"North West",
  newcastle:"North East",
  leeds:"Yorkshire & Humber", sheffield:"Yorkshire & Humber", york:"Yorkshire & Humber", harrogate:"Yorkshire & Humber", hull:"Yorkshire & Humber", wakefield:"Yorkshire & Humber", doncaster:"Yorkshire & Humber",
  birmingham:"West Midlands", coventry:"West Midlands", rugby:"West Midlands", worcester:"West Midlands",
  nottingham:"East Midlands", leicester:"East Midlands", derby:"East Midlands", northampton:"East Midlands",
  bristol:"South West", bath:"South West", exeter:"South West", plymouth:"South West", truro:"South West", torquay:"South West", taunton:"South West", bridgwater:"South West", yeovil:"South West", tewkesbury:"South West", bournemouth:"South West",
  oxford:"South East", reading:"South East", brighton:"South East", guildford:"South East", woking:"South East", canterbury:"South East", maidstone:"South East", tunbridge_wells:"South East", southampton:"South East", portsmouth:"South East", milton_keynes:"South East",
  cambridge:"East of England", chelmsford:"East of England", maldon:"East of England", colchester:"East of England", basildon:"East of England", chigwell:"East of England", brentwood:"East of England", southend:"East of England", peterborough:"East of England", stevenage:"East of England", st_albans:"East of England", watford:"East of England",
  edinburgh:"Scotland", glasgow:"Scotland", aberdeen:"Scotland", dundee:"Scotland", inverness:"Scotland",
  cardiff:"Wales", swansea:"Wales"
};
// POSTCODE_AREA_TO_MARKET (v9.91) — every UK postcode AREA (the letters before the
// first digit) mapped to its nearest ANCHOR market that exists in MKT. This is how
// Keystone resolves ANY village automatically: a site's postcode → area → anchor city,
// which then gives the region (via UK_REGION_BY_CITY), the yield/rents (via MKT) and a
// sale-price fallback — with no need to list every village by name. Sale £/sqft still
// prefers the site's own postcode (PC_PSF) where available, so it stays hyper-local.
var POSTCODE_AREA_TO_MARKET = {
  // ── North East ──
  NE:"newcastle", SR:"newcastle", DH:"newcastle", DL:"newcastle", TS:"newcastle",
  // ── Yorkshire & Humber ──
  LS:"leeds", BD:"leeds", WF:"wakefield", HD:"leeds", HX:"leeds", HG:"harrogate",
  YO:"york", HU:"hull", S:"sheffield", DN:"doncaster",
  // ── North West ──
  M:"manchester", BL:"manchester", BB:"manchester", OL:"manchester", SK:"manchester",
  WN:"manchester", WA:"manchester", PR:"manchester", FY:"manchester", LA:"manchester",
  CA:"manchester", L:"liverpool", CH:"chester", CW:"chester",
  // ── West Midlands ──
  B:"birmingham", CV:"coventry", WS:"birmingham", WV:"birmingham", DY:"birmingham",
  ST:"birmingham", TF:"birmingham", WR:"worcester", HR:"worcester", SY:"worcester",
  // ── East Midlands ──
  NG:"nottingham", LE:"leicester", DE:"derby", NN:"northampton", LN:"nottingham",
  // ── East of England ──
  CB:"cambridge", PE:"peterborough", IP:"cambridge", NR:"cambridge", CO:"colchester",
  CM:"chelmsford", SS:"southend", SG:"stevenage", AL:"st_albans", LU:"watford",
  EN:"watford", WD:"watford", HP:"watford",
  // ── South East ──
  OX:"oxford", RG:"reading", SL:"reading", MK:"milton_keynes", GU:"guildford",
  RH:"guildford", KT:"guildford", ME:"maidstone", CT:"canterbury", TN:"tunbridge_wells",
  DA:"maidstone", BN:"brighton", PO:"portsmouth", SO:"southampton", SP:"southampton",
  // ── London ──
  E:"london", EC:"london", WC:"london", N:"london", NW:"london", SE:"london",
  SW:"london", W:"london", HA:"london", UB:"london", IG:"london", RM:"london",
  BR:"london", CR:"london", SM:"london", TW:"london",
  // ── South West ──
  BS:"bristol", BA:"bath", GL:"tewkesbury", SN:"bristol", TA:"taunton", DT:"bournemouth",
  BH:"bournemouth", EX:"exeter", PL:"plymouth", TQ:"torquay", TR:"truro",
  // ── Wales ──
  CF:"cardiff", NP:"cardiff", SA:"swansea", LL:"chester", LD:"cardiff",
  // ── Scotland ──
  EH:"edinburgh", G:"glasgow", AB:"aberdeen", DD:"dundee", IV:"inverness", KY:"edinburgh",
  FK:"glasgow", ML:"glasgow", PA:"glasgow", KA:"glasgow", DG:"glasgow", TD:"edinburgh",
  PH:"edinburgh", KW:"inverness", HS:"inverness", ZE:"inverness"
};
// Approx centroid lat/lng per UK region — a graceful fallback for the Placona map when
// a precise postcode geocode isn't available (or the network is blocked).
var REGION_LATLNG = {
  "North East":[54.97,-1.61], "North West":[53.48,-2.24], "Yorkshire & Humber":[53.80,-1.55],
  "West Midlands":[52.48,-1.90], "East Midlands":[52.95,-1.15], "East of England":[52.20,0.12],
  "South East":[51.45,-0.97], "London":[51.51,-0.13], "South West":[50.72,-3.53],
  "Wales":[51.48,-3.18], "Scotland":[55.95,-3.19], "UK (national average)":[54.0,-2.4]
};
// The letter area of a UK postcode, e.g. "NE20 9AB" → "NE", "B15" → "B".
function postcodeArea(pc){
  var m = String(pc || "").toUpperCase().replace(/\s+/g, "").match(/^[A-Z]{1,2}/);
  return m ? m[0] : "";
}
// Postcode → nearest anchor market key (must exist in MKT), else "".
function postcodeMarketKey(pc){
  var area = postcodeArea(pc);
  if(!area) return "";
  var mk = POSTCODE_AREA_TO_MARKET[area];
  return (mk && typeof MKT !== "undefined" && MKT[mk]) ? mk : "";
}
// v9.99 — one phased build-rate (homes/yr) so every screen agrees. Larger schemes run
// multiple outlets/phases concurrently, so a 1,056-home scheme is ~220/yr (≈5 yrs), not
// a single outlet's 40/yr (≈27 yrs). Shared by SFH House Mix and the RLV programme.
function buildRatePerYear(units, isApart){
  units = num(units);
  if(isApart) return units >= 300 ? 250 : units >= 150 ? 200 : 150;
  if(units >= 600) return 220;   // strategic / multi-phase
  if(units >= 300) return 175;   // ~4 outlets
  if(units >= 150) return 115;   // ~3 outlets
  if(units >= 50)  return 70;    // ~2 outlets
  return 40;                     // single outlet
}
// v9.100 — one location score (0–100) from the five Land Appraisal dropdowns, so the Site
// Scorecard reflects the live inputs instead of a value that was only computed on the Land
// screen and never stored.
var LOCATION_SCORE_WEIGHTS = {
  proximity:{excellent:25,good:15,fair:8,poor:0},
  transport:{excellent:20,good:12,fair:6,poor:0},
  contamination:{clean:20,minor:10,major:0,unknown:4},
  tenure:{freehold:15,long_leasehold:10,short_leasehold:3},
  constraint:{none:20,minor:12,moderate:6,major:0}
};
function locationScore(deal){
  var l = (deal && deal.land) || {};
  var s = 0;
  Object.keys(LOCATION_SCORE_WEIGHTS).forEach(function(k){ s += (LOCATION_SCORE_WEIGHTS[k][l[k]] || 0); });
  return s;
}
// ── Constraint Check readers ────────────────────────────────────────────────
// The Constraint Check stage stores its AI output under data.constraintCheck.results
// = {report, score, verdict, site, date}. Several widgets (Scorecard, Data Room)
// were reading data.constraint.* — a different object that stage never writes — so a
// live CAUTION/AVOID assessment read as "Not assessed" and its probability score was
// ignored. These shared readers are the ONE place that path is resolved.
function constraintVerdict(deal){
  var ccr = (deal && deal.constraintCheck && deal.constraintCheck.results) || {};
  var legacy = (deal && deal.constraint) || {};
  var v = String(ccr.verdict || legacy.verdict || "").toUpperCase();
  if(v === "GO" || v === "CAUTION" || v === "AVOID") return v;
  // v10.8 — the Constraint Check verdict parse can miss (the stage's report reliably
  // stores a probability SCORE but the GO/CAUTION/AVOID label sometimes doesn't parse).
  // Derive the verdict from the score so the Scorecard/Data Room still reflect a real
  // assessment instead of "Not assessed".
  var s = Number(ccr.score || legacy.planningScore || 0);
  if(isFinite(s) && s > 0) return s >= 60 ? "GO" : s >= 40 ? "CAUTION" : "AVOID";
  return "";
}
function constraintPlanningScore(deal){
  var ccr = (deal && deal.constraintCheck && deal.constraintCheck.results) || {};
  var legacy = (deal && deal.constraint) || {};
  var n = Number(ccr.score || legacy.planningScore || 0);
  return isFinite(n) ? n : 0;
}
// The constraint verdict → scorecard "Constraint Risk" dimension {s,l}.
function constraintRiskScore(deal){
  // v10.5 — Assumption Mode: presenting a consented, cleared scheme.
  if(assumeConstraintsClear(deal)) return {s:8, l:"Low risk (assumed)"};
  var v = constraintVerdict(deal);
  if(v==="GO")     return {s:8, l:"Low risk"};
  if(v==="CAUTION")return {s:5, l:"Moderate risk"};
  if(v==="AVOID")  return {s:2, l:"High risk"};
  return {s:5, l:"Not assessed"};
}

// ── ASSUMPTION MODE ─────────────────────────────────────────────────────────
// A NON-DESTRUCTIVE presentation overlay. When a dimension is toggled on, the
// READOUTS behave as if that dimension is satisfied (planning consented, DD
// complete, constraints cleared, risks mitigated) so Executive Summary / Teaser /
// Data Room / Scorecard render the "if it all lands" story. It NEVER writes
// optimistic values into the deal — data.ddChecked, planning.status,
// constraintCheck, risks etc. are untouched; flip the flags off and the true
// position returns. Every place that honours a flag also LABELS it "(assumed)"
// so it can never masquerade as real status.
var ASSUME_DIMENSIONS = [
  {k:"planning",    label:"Planning consented", icon:"📋", note:"Treat planning as granted"},
  {k:"dd",          label:"Due diligence clear", icon:"✓",  note:"Treat all DD as satisfied"},
  {k:"constraints", label:"Constraints cleared", icon:"🗺", note:"Treat site constraints as resolved"},
  {k:"risks",       label:"Risks mitigated",     icon:"⚠",  note:"Treat logged risks as mitigated"}
];
function assumeFlags(deal){
  var a = (deal && deal._assume) || {};
  return {planning:!!a.planning, dd:!!a.dd, constraints:!!a.constraints, risks:!!a.risks};
}
function assumeAny(deal){
  var f = assumeFlags(deal);
  return f.planning || f.dd || f.constraints || f.risks;
}
function assumePlanningConsented(deal){ return assumeFlags(deal).planning; }
function assumeDDComplete(deal){        return assumeFlags(deal).dd; }
function assumeConstraintsClear(deal){  return assumeFlags(deal).constraints; }
function assumeRisksMitigated(deal){    return assumeFlags(deal).risks; }
function ukRegionFor(data){
  var c = (typeof dealCityKey === "function") ? dealCityKey(data) : "";
  if(UK_REGION_BY_CITY[c]) return UK_REGION_BY_CITY[c];
  // Fallback: resolve the region from the site's postcode area → anchor market.
  var pc = (data.land && data.land.postcode) || (data.rlv && data.rlv.postcode) || (data.epe && data.epe.postcode) || "";
  var pcMk = postcodeMarketKey(pc);
  if(pcMk && UK_REGION_BY_CITY[pcMk]) return UK_REGION_BY_CITY[pcMk];
  return "UK (national average)";
}
// areaYield — the area's benchmark NET INITIAL yield as a PERCENT (e.g. 4.7 for Maldon).
// Falls back to 4.7% if the area has no benchmark.
function areaYield(data){
  var mk = MKT[dealCityKey(data)];
  var y = (mk && mk.yield) ? mk.yield : 0.047;
  return Math.round(y * 1000) / 10;   // percent, 1 dp
}
// dealYield — the ONE net initial yield used everywhere (Capitalisation, Exit, HRA).
// Returns the user's Capitalisation override if set, otherwise the area benchmark.
// Always returned as a PERCENT (e.g. 4.7). Tolerates a value stored as a fraction.
function dealYield(data){
  data = data || {};
  var t = num((data.capitalise && data.capitalise.targetYield));
  if(t > 0) return t > 1 ? t : t * 100;   // stored as percent normally; tolerate fraction
  return areaYield(data);
}

// v10.82 — projectTimeline: a scheme runs on TWO separate clocks, and lumping them into one
// "programme" understates the horizon. (1) Time to WIN planning consent — councils routinely
// exceed the 13-week statutory target on major/strategic applications, so an unconsented site
// is a multi-year promotion, not a quick decision. (2) The build-out PROGRAMME. Plus the total
// money-in-to-exit horizon. Planning months come from an explicit figure (the AI planning
// filler / user) when set, else a sensible default by planning status. Used by the one-pager,
// the blind teaser and the IM so the timeline reads honestly.
function projectTimeline(data){
  data = data || {};
  var p = data.planning || {}, l = data.land || {};
  var SF = (typeof computeSFHMetrics === "function") ? computeSFHMetrics(data) : {};
  var units = num(SF.totalUnits) || num(p.units) || num(l.units) || 0;
  var buildYears = num(SF.financeProgYears) || Math.max(2, Math.min(10, 1 + units / 350));
  var status = String(p.status || l.planningStatus || "").toLowerCase();
  var planningMonths = num(p.planningTimelineMonths);
  if(!(planningMonths > 0)){
    // v10.83 — defaults grounded in research. MHCLG "Planning applications in England" (2024-25):
    // only ~1 in 5 MAJOR applications is actually decided within the 13-week statutory target —
    // the ~90% "on time" headline is inflated by Extensions of Time. Lichfields "Start to Finish"
    // (3rd ed., 2024): 1,000+ home sites average ~5 years to a detailed consent, and a cold,
    // unallocated start is a 6-10 year Local-Plan promotion. So do NOT default to statutory periods.
    var byStatus = { full:4, outline:12, allocated:12, preapp:30, "pre-app":30, likely:42 };
    planningMonths = (byStatus[status] !== undefined) ? byStatus[status] : 84;   // unallocated / hope value (cold start)
    // Strategic-site uplift: a large ALLOCATED site still needs a full determination + S106
    // (routinely 24-36 months, per the research), not the ~12 a smaller allocated site takes.
    if(status === "allocated" && units >= 500) planningMonths += (units >= 1000 ? 18 : 12);
  }
  planningMonths = Math.round(planningMonths);
  var planningYears = Math.round(planningMonths / 12 * 10) / 10;
  buildYears = Math.round(buildYears * 10) / 10;
  var statusLabel = ({ full:"Full consent", outline:"Outline consent", allocated:"Allocated in local plan",
    preapp:"Pre-application", "pre-app":"Pre-application", likely:"Likely allocation" })[status] || "Unallocated / promotion";
  return { units:units, planningMonths:planningMonths, planningYears:planningYears, buildYears:buildYears,
    totalYears:Math.round((planningYears + buildYears) * 10) / 10, status:status, statusLabel:statusLabel };
}

// v10.90 — grantToStack: how much Homes England grant PER AFFORDABLE HOME would make a marginal
// scheme stack. Grant flows to the residual (computeSFHMetrics adds grantIncome to the RLV), so
// the gap to a target ÷ the number of affordable homes is the grant/home needed. Two targets: a
// POSITIVE residual, and — if a land guide price is entered — COVERING that price. Indicative;
// eligibility & rate are area/tenure-specific (Homes England AHP 2021-26 → SAHP 2026-36).
function grantToStack(data){
  data = data || {};
  var SF = (typeof computeSFHMetrics === "function") ? computeSFHMetrics(data) : {};
  var affHomes = num(SF.affordableHomes) || 0;
  var rlvNoGrant = num(SF.rlvBeforeGrant);
  var price = num((data.land || {}).price);
  function perHome(gap){ return affHomes > 0 ? Math.max(0, gap) / affHomes : 0; }
  var gapToPositive = rlvNoGrant < 0 ? -rlvNoGrant : 0;                         // reach RLV ≥ 0
  var gapToPrice = (price > 0 && rlvNoGrant < price) ? (price - rlvNoGrant) : 0; // reach RLV ≥ guide price
  return {
    affordableHomes: affHomes,
    rlvBeforeGrant: rlvNoGrant,
    grantAppliedPerHome: num(SF.grantPerAffHome),
    grantApplied: num(SF.grantIncome),
    landPrice: price,
    stacksNow: rlvNoGrant >= (price > 0 ? price : 0),
    perHomeToPositive: perHome(gapToPositive),
    perHomeToCoverPrice: perHome(gapToPrice),
    typicalGrantLo: 40000, typicalGrantHi: 130000   // broad indicative AHP/SAHP band (£/home)
  };
}

// ── Multi-year DCF hold model (v10.29) ───────────────────────────────────────
// A term-and-reversion DCF for a long income hold (pension/SWF, retain & refinance).
// Rent grows each year at a CPI-linked rate, collared between a floor and a cap;
// the explicit projection runs `years` years, then year (years+1) rent is capitalised
// at the SAME exit yield for a terminal value; every cash flow plus the terminal value
// is discounted back to present at the exit yield (discount rate = exit yield, per spec).
//
// This is an ADDITIONAL basis shown alongside the static year-1 NOI÷yield figure — it is
// the single source of truth for the "25-yr DCF (indexed)" number on the Exit page and in
// the Board Proposal. All rate inputs tolerate either a fraction (0.045) or a percent (4.5).
var DCF_DEFAULTS = { cpi:2.75, floor:1.0, cap:4.0, years:25 };

// Resolve the DCF assumptions from the Capitalisation stage, falling back to the defaults.
// A blank/absent input uses the default; an explicit 0 is honoured (so 0% growth is valid).
function capDCFParams(data){
  var cap = (data && data.capitalise) || {};
  var pick = function(v, d){ return (v === "" || v == null || !isFinite(Number(v))) ? d : Number(v); };
  return {
    growth: pick(cap.cpiGrowth, DCF_DEFAULTS.cpi),
    floor:  pick(cap.cpiFloor,  DCF_DEFAULTS.floor),
    cap:    pick(cap.cpiCap,    DCF_DEFAULTS.cap),
    years:  Math.max(1, Math.round(pick(cap.holdYears, DCF_DEFAULTS.years)))
  };
}

// computeDCFHoldValue — the reusable core. Both the Exit page and the Board Proposal call this.
//   annualNOI   year-1 stabilised net operating income (£/yr)
//   growthRate  CPI assumption, as a PERCENT (e.g. 2.75) — matches the Capitalisation inputs
//   floor, cap  the collar applied to the growth assumption, as PERCENTS (e.g. 1 and 4)
//   years       explicit hold period (e.g. 25)
//   exitYield   the deal exit/target yield — used as BOTH discount rate and terminal cap rate;
//               tolerant of a fraction (0.047) or a percent (4.7)
// Returns {value, effectiveGrowth, pvIncome, terminalValue, pvTerminal, reversionNOI, years, exitYield}.
// Note: growth/floor/cap are PERCENTS (÷100 unconditionally) so a 1% floor ("1") is never mistaken
// for a 100% fraction; exitYield is auto-detected because yields are never anywhere near 1.0.
function computeDCFHoldValue(annualNOI, growthRate, floor, cap, years, exitYield){
  var pctToFrac = function(r){ r = Number(r); return isFinite(r) ? r/100 : 0; };
  var yieldFrac = function(r){ r = Number(r); if(!isFinite(r)) return 0; return r > 1 ? r/100 : r; };
  annualNOI = Number(annualNOI); if(!isFinite(annualNOI)) annualNOI = 0;
  years = Math.round(Number(years)); if(!isFinite(years) || years < 1) years = 1;
  var g = pctToFrac(growthRate), fl = pctToFrac(floor), cp = pctToFrac(cap), y = yieldFrac(exitYield);
  // Collar the growth assumption: floor binds up, cap binds down.
  if(isFinite(fl) && g < fl) g = fl;
  if(isFinite(cp) && cp > 0 && g > cp) g = cp;
  var empty = { value:0, effectiveGrowth:g, pvIncome:0, terminalValue:0, pvTerminal:0, reversionNOI:0, years:years, exitYield:y };
  if(!(y > 0) || !(annualNOI > 0)) return empty;
  var d = y;                                   // discount rate = exit yield (per spec)
  var pvIncome = 0;
  for(var t = 1; t <= years; t++){
    var noiT = annualNOI * Math.pow(1 + g, t - 1);   // year 1 = base NOI, grows thereafter
    pvIncome += noiT / Math.pow(1 + d, t);
  }
  var reversionNOI = annualNOI * Math.pow(1 + g, years);   // year (years+1) rent, e.g. year 26
  var terminalValue = reversionNOI / y;                    // capitalise at the exit yield
  var pvTerminal = terminalValue / Math.pow(1 + d, years);
  return {
    value: pvIncome + pvTerminal, effectiveGrowth: g, pvIncome: pvIncome,
    terminalValue: terminalValue, pvTerminal: pvTerminal, reversionNOI: reversionNOI,
    years: years, exitYield: y
  };
}

// dealDCFHoldValue — convenience wrapper: resolve the DCF params + exit yield from the deal,
// then run computeDCFHoldValue for a given year-1 NOI. exitYield defaults to dealYield().
function dealDCFHoldValue(data, annualNOI, exitYieldFraction){
  var p = capDCFParams(data);
  var y = (typeof exitYieldFraction === "number" && exitYieldFraction > 0)
    ? exitYieldFraction
    : ((typeof dealYield === "function" ? dealYield(data)/100 : 0) || 0.047);
  return computeDCFHoldValue(annualNOI, p.growth, p.floor, p.cap, p.years, y);
}

// ── dealNOI (v10.30) — the ONE net operating income (£/yr) for the whole appraisal ───────
// Single source of truth for the Exit Strategy page AND the Board Proposal, so the two can
// never compute NOI independently again. Works for every tenure:
//   • SFH: the SFH engine's capitalised net rent (capNetRentPa) when it produced one.
//   • BTR / PBSA / SFH-without-a-mix: net rent built from the planning unit count using the
//     SAME rent + gross-to-net conventions as the engine. This fixes the BTR £0 bug, where
//     the SFH engine returns 0 because a BTR scheme has no priced house mix.
function dealNOI(data){
  data = data || {};
  var SF = (typeof computeSFHMetrics === "function") ? computeSFHMetrics(data) : {};
  if(num(SF.capNetRentPa) > 0) return num(SF.capNetRentPa);   // SFH engine value — single source for SFH
  var cap = data.capitalise || {};
  var at = ((data.assetType || "") + "").toLowerCase();
  var mk = ((typeof MKT !== "undefined") && (MKT[(typeof dealCityKey === "function") ? dealCityKey(data) : ""] || MKT.manchester)) || {btr:900, pbsa:180};
  var units = num(data.planning && data.planning.units) || num(data.rlv && data.rlv.units) || num(SF.totalUnits) || 0;
  if(units <= 0) return 0;
  // Gross rent per unit p.a.: explicit override → area rent → MKT fallback (PBSA weekly, else monthly).
  var grossPerUnitPa = num(cap.marketRentPerUnitPa)
    || ((typeof areaMarketRentPa === "function") ? num(areaMarketRentPa(data)) : 0)
    || (at === "pbsa" ? num(mk.pbsa) * 52 : num(mk.btr) * 12);
  if(!(grossPerUnitPa > 0)) return 0;
  // Affordable units produce a lower rent (income effect), mirroring the engine's ahRentFactor.
  var ahPctR = num((data.planning || {}).ahPct) || num((data.planning || {}).afhPct) || num((data.tenure || {}).ahPct) || num(cap.ahPct) || 0;
  var ahRentFactor = numOr(cap.ahRentFactor, 0.65);
  var privUnits = units * (1 - ahPctR / 100), ahUnits = units * (ahPctR / 100);
  var grossPa = (privUnits + ahUnits * ahRentFactor) * grossPerUnitPa;
  var capMgmtRate = numOr(cap.mgmtRate, 25);   // 25% gross-to-net, same as computeSFHMetrics
  var net = grossPa * (1 - capMgmtRate / 100);
  return net > 0 ? net : 0;
}

// Capitalisation yields by buyer type (lower = higher price)
var CAP_YIELDS = {
  "Pension / Sovereign Fund": {min:0.038, base:0.042, max:0.046, label:"4.2% base (pension-grade)"},
  "BTR Institutional Fund":   {min:0.042, base:0.046, max:0.050, label:"4.6% base (BTR fund)"},
  "Family Office":            {min:0.044, base:0.048, max:0.050, label:"4.8% base (family office)"},
  "Private Investor":         {min:0.046, base:0.050, max:0.050, label:"5.0% base (private)"},
  "PBSA Fund":                {min:0.044, base:0.048, max:0.050, label:"4.8% base (PBSA)"},
};

// Void / management / maintenance deductions by buyer type
var NOI_DEDUCTIONS = {
  residential: {voids:0.05, management:0.10, maintenance:0.08, insurance:0.02},
  pbsa:        {voids:0.08, management:0.15, maintenance:0.06, insurance:0.02},
};

var PROP_TYPES = ["Detached house","Semi-detached house","End of terrace house","Terraced house",
  "Bungalow (detached)","Bungalow (semi)","Flat / Apartment","Farmhouse / Rural",
  "Pub (traditional)","Pub (large / roadside)","Restaurant / Cafe","Hotel / Guest house",
  "Office (small)","Office (large)","Shop / Retail","Warehouse / Industrial",
  "Church / Chapel","Village hall","School / Former school","Care home","Barn",
  "Agricultural building","Vacant land / Brownfield"];

function num(v){return parseFloat(v)||0;}
// numOr — same as num() but treats explicit 0 / "0" as a real value (not falsy)
// Use this when a default should only apply if the user hasn't entered anything.
// Returns the parsed number if the input is a valid number (including 0), otherwise the fallback.
function numOr(v, fallback){
  if(v===null||v===undefined||v==="") return fallback;
  var n = parseFloat(v);
  if(isNaN(n)) return fallback;
  return n;
}
function fmt(n){
  if(n===null||n===undefined||n===""||isNaN(Number(n)))return"—";
  var v=Number(n), a=Math.abs(v);
  if(a>=1000000)return(v<0?"-":"")+"£"+(a/1000000).toFixed(2)+"m";
  if(a>=1000)return(v<0?"-":"")+"£"+Math.round(a/1000)+"k";
  return(v<0?"-":"")+"£"+Math.round(a).toLocaleString();
}
// v9.33 — Compact currency without leading £ (for inline use where context is clear)
function fmtCompact(n){
  if(n===null||n===undefined||n===""||isNaN(Number(n)))return"—";
  var v=Number(n), a=Math.abs(v);
  if(a>=1000000)return(v<0?"-":"")+(a/1000000).toFixed(1)+"m";
  if(a>=1000)return(v<0?"-":"")+Math.round(a/1000)+"k";
  return(v<0?"-":"")+Math.round(a).toLocaleString();
}
function pct(n){
  if(n===null||n===undefined||n===""||isNaN(Number(n)))return"—";
  return Number(n).toFixed(1)+"%";
}
function fmtN(n,dp){if(n===null||n===undefined||isNaN(n))return"—";return Number(n).toLocaleString("en-GB",{maximumFractionDigits:dp||0});}
function cityName(c){return c?c.charAt(0).toUpperCase()+c.replace(/_/g," ").slice(1):"—";}

// Land value benchmarks £/sqft of PLOT AREA (separate from house £/sqft of floor area)
// These are residential development land values based on what developers pay
// Methodology: derived from residual appraisal (GDV minus build costs minus profit)
var LAND_PSF = {
  // London prime (£/sqft plot)
  SW1:800,SW3:750,W1:900,WC1:500,EC1:480,
  NW3:600,NW1:420,SW11:450,SW4:400,SW18:380,
  W11:650,W4:420,W6:400,
  N1:400,SE1:420,E14:380,E1:320,E2:300,
  HA1:280,CR0:220,BR1:240,IG1:200,RM1:190,
  // Manchester (£/sqft plot)
  M1:220,M4:200,M20:240,M21:230,M25:160,
  SK9:320,SK8:280,OL1:120,BL1:130,
  // Birmingham / West Mids
  B1:160,B15:220,B17:200,B29:150,B30:160,
  CV1:90,CV2:75,CV3:80,CV4:85,
  CV5:78,CV6:52,CV7:48,CV8:200,
  WV1:70,WS1:65,DY1:60,
  // Leeds / Yorkshire
  LS1:160,LS2:150,LS6:140,LS7:145,LS8:170,
  LS16:180,LS17:220,LS18:190,
  BD1:80,BD18:120,HX1:90,HD1:85,
  S1:120,S10:160,S11:180,S17:220,
  WF1:80,DN1:75,
  // Liverpool / NW
  L1:130,L2:140,L17:160,L18:180,
  PR1:100,CH1:140,WA1:120,
  // Bristol / SW
  BS1:260,BS2:240,BS3:220,BS6:300,
  BS7:280,BS8:320,BS9:300,
  BA1:280,BA2:260,GL50:200,EX1:180,
  PO1:160,SO14:150,BH1:200,
  // Edinburgh / Scotland
  EH1:280,EH2:320,EH3:300,EH4:240,
  EH8:220,EH9:280,EH10:260,EH12:230,
  G1:140,G3:160,G12:180,G41:150,
  AB10:120,DD1:90,
  // Cambridge / Oxford (premium)
  CB1:380,CB2:360,CB3:400,CB4:320,
  OX1:420,OX2:400,OX3:360,OX4:320,
  // South East premium
  RG1:240,GU1:320,BN1:260,BN3:240,
  // Midlands / East
  NG1:120,NG7:100,LE1:110,LE3:100,
  DE1:90,NN1:85,MK9:160,
  // North East
  NE1:110,NE2:140,YO1:160,HG1:180,
  // Wales
  CF10:130,CF11:150,CF14:120,SA1:80,
  // Misc
  HU1:60,ST1:65,WR1:100,
  // Somerset / South West
  TA1:80,TA2:75,TA3:70,TA4:60,TA5:65,TA6:60,TA7:55,TA18:65,TA20:60,TA21:70,
  BA1:220,BA2:200,BA11:80,BA14:90,BA20:70,BA21:68,
  BS1:200,BS6:220,BS8:240,BS23:75,
  EX1:95,EX2:90,EX4:92,EX8:110,EX31:70,
  TQ1:85,TQ9:90,TQ12:80,PL1:55,PL4:58,PL6:65,
  TR1:80,TR7:78,TR11:90,TR18:85,
  DT1:85,DT3:80,DT6:95,DT9:90,
  SP1:95,SP4:85,SN1:80,
  GU1:280,GU21:250,TN1:240,TN13:280,
  RH1:220,ME14:160,CT1:150,
  SO14:150,PO1:150,BH1:200,
  // Default by broad region (fallback)
  DEFAULT:85
};

function lookupLandPsf(pc) {
  var clean=(pc||"").toUpperCase().replace(/\s/g,"");
  for(var len=4;len>=2;len--){
    var key=clean.substring(0,len);
    if(LAND_PSF[key])return LAND_PSF[key];
  }
  return LAND_PSF.DEFAULT;
}

// ═══════════════════════════════════════════════════════════════════════════
// ASSET EXIT OPTIMISER — Reference Data
// Used by the Asset Exit Optimiser stage to compare exit routes for existing
// owned assets (PBSA, BTR, SFH, pub, industrial, hotel, office, retail, etc).
// ═══════════════════════════════════════════════════════════════════════════

// Asset types the Optimiser supports
var ASSET_TYPES = [
  {key:"pbsa",         label:"PBSA (Student Accommodation)", icon:"🎓", incomeUnit:"per bed pw", typicalSize:"100-500 beds"},
  {key:"btr",          label:"BTR (Build-to-Rent)",          icon:"🏢", incomeUnit:"per unit pcm",typicalSize:"50-400 units"},
  {key:"sfh_portfolio",label:"SFH Estate / Portfolio",       icon:"🏡", incomeUnit:"GDV per house",typicalSize:"10-200 units"},
  {key:"hotel",        label:"Hotel",                        icon:"🏨", incomeUnit:"ADR + occupancy",typicalSize:"40-300 keys"},
  {key:"pub",          label:"Pub / Public House",           icon:"🍺", incomeUnit:"FMT (annual)", typicalSize:"single asset"},
  {key:"industrial",   label:"Industrial / Logistics",       icon:"🏭", incomeUnit:"£/sqft pa",   typicalSize:"5k-500k sqft"},
  {key:"office",       label:"Office",                       icon:"🏢", incomeUnit:"£/sqft pa",   typicalSize:"5k-200k sqft"},
  {key:"retail",       label:"Retail (high street / park)",  icon:"🛍", incomeUnit:"£/sqft pa Zone A",typicalSize:"varies"},
  {key:"residential",  label:"Single Residential (house/flat)",icon:"🏠",incomeUnit:"capital value", typicalSize:"individual"},
  {key:"mixed",        label:"Mixed-use",                    icon:"◈",  incomeUnit:"blended NOI",  typicalSize:"varies"},
  {key:"care",         label:"Care Home / Retirement",       icon:"🏥", incomeUnit:"per bed pw",   typicalSize:"40-120 beds"},
  {key:"data_centre",  label:"Data Centre",                  icon:"💾", incomeUnit:"£/MW or sqft", typicalSize:"varies"},
  {key:"other",        label:"Other / Special",              icon:"◆",  incomeUnit:"manual NOI",   typicalSize:"varies"}
];

// Sector yield benchmarks (Knight Frank / Savills / CBRE composite, mid-2026)
// Format: [prime_low, prime_high, regional_low, regional_high] in %
var SECTOR_YIELDS = {
  pbsa:          { prime:[4.75,5.25], regional:[5.50,6.50], note:"Prime = London/RG cities. Regional = secondary uni towns." },
  btr:           { prime:[4.00,4.50], regional:[4.50,5.50], note:"Stabilised single-block assets to institutions." },
  sfh_portfolio: { prime:[4.50,5.00], regional:[4.75,5.50], note:"AST-let portfolios to PRS investors." },
  hotel:         { prime:[5.50,7.00], regional:[7.00,9.00], note:"Branded > independent. Operator lease vs vacant possession." },
  pub:           { prime:[7.00,9.00], regional:[8.00,11.00],note:"Managed pubs > tenanted. Wet-led > food-led typically tighter." },
  industrial:    { prime:[5.00,6.00], regional:[5.50,7.50], note:"Big-box logistics tightest. Multi-let estates wider." },
  office:        { prime:[5.50,7.00], regional:[7.50,10.00],note:"Post-2024 repricing — regional/secondary offices 9%+." },
  retail:        { prime:[5.50,7.50], regional:[7.50,11.00],note:"Retail parks tighter than high street. Convenience tightest." },
  residential:   { prime:[3.50,4.50], regional:[4.00,5.00], note:"Single AST gross yield — not used for capital value; use comparable." },
  mixed:         { prime:[5.00,6.50], regional:[5.50,7.50], note:"Blended — calculate by weighted component yields." },
  care:          { prime:[5.50,7.00], regional:[6.50,8.50], note:"Operator-let elderly care. Triple-net leases tightest." },
  data_centre:   { prime:[4.50,5.50], regional:[5.50,7.00], note:"Hyperscale-let prime. Wholesale/colo wider." },
  other:         { prime:[6.00,8.00], regional:[7.50,10.00],note:"Default range — depends entirely on covenant + lease." }
};

// Exit routes — universal taxonomy
var EXIT_ROUTES = [
  {key:"pension",      label:"Pension Fund / Long-Income",   icon:"💼", desc:"Domestic UK schemes (LGPS / USS / RPMI). 10-25yr hold. Wants stabilised income with covenant.", yieldBias:0,    timeMonths:"6-9"},
  {key:"sovereign",    label:"Sovereign Wealth Fund",        icon:"🌐", desc:"QIA / GIC / ADIA. £50m+ cheques. Trophy assets only.",                                  yieldBias:-0.25,timeMonths:"4-8"},
  {key:"family",       label:"Family Office",                icon:"👑", desc:"HNW capital. £5-50m typical. Often story-driven over yield-driven.",                   yieldBias:+0.25,timeMonths:"2-4"},
  {key:"reit",         label:"Listed REIT",                  icon:"📈", desc:"Sector-specialist REITs (Big Yellow, Tritax, Unite, Grainger, Empiric).",              yieldBias:0,    timeMonths:"3-6"},
  {key:"btr_op",       label:"BTR / PBSA Operator",          icon:"🏢", desc:"Grainger / Quintain / Packaged Living / Unite / iQ.",                                  yieldBias:+0.10,timeMonths:"3-6"},
  {key:"ha_rp",        label:"Housing Association / RP",     icon:"🏛", desc:"Clarion / Sanctuary / L&Q. Affordable conversion / S106 transfer / bulk sale.",         yieldBias:+0.50,timeMonths:"4-8"},
  {key:"homes_eng",    label:"Homes England",                icon:"🇬🇧", desc:"Government delivery body. AHP grants + completion buy. Resi only.",                    yieldBias:+0.50,timeMonths:"6-12"},
  {key:"open_mkt",     label:"Open Market / Individual Sale",icon:"🏠", desc:"Sell to individual buyers (mainly SFH / residential).",                                yieldBias:-0.50,timeMonths:"3-12"},
  {key:"pubco",        label:"Pubco / Operator Buyer",       icon:"🍺", desc:"Greene King / Marston's / Wetherspoons / regional operators.",                         yieldBias:0,    timeMonths:"3-6"},
  {key:"hotel_op",     label:"Hotel Operator / Brand",       icon:"🏨", desc:"Branded hotel operators or PE hotel platforms (Henderson Park, Tristan, etc).",        yieldBias:0,    timeMonths:"4-8"},
  {key:"industrial_inv",label:"Industrial Investor / Logistics Fund",icon:"🏭",desc:"Tritax Big Box / Segro / Prologis / Blackstone industrial.",                    yieldBias:-0.10,timeMonths:"3-6"},
  {key:"trade_buyer",  label:"Trade Buyer",                  icon:"🤝", desc:"Competitor / consolidator buys for strategic / operational reasons.",                  yieldBias:0,    timeMonths:"3-9"},
  {key:"bank_takeout", label:"Refi + Hold (Bank Take-out)",  icon:"🏦", desc:"You keep asset. Refinance dev debt onto investment debt. Pull out equity tax-efficiently.",yieldBias:0, timeMonths:"2-4"},
  {key:"sale_leaseback",label:"Sale & Leaseback",            icon:"📜", desc:"You sell freehold and lease back as operator. Releases capital, maintains operation.",  yieldBias:+0.25,timeMonths:"4-6"},
  {key:"change_use",   label:"Change of Use / Redevelop",    icon:"⚖",  desc:"Repurpose to higher-value class (pub→resi, office→resi, retail→resi).",                yieldBias:0,    timeMonths:"12-36"},
  {key:"hold",         label:"Hold + Operate Long-Term",     icon:"⏳", desc:"No sale. Run as income asset. Distributions to shareholders / reinvest.",              yieldBias:0,    timeMonths:"ongoing"},
  {key:"forward_fund", label:"Forward-Fund / Pre-completion Sale",icon:"⏩",desc:"Sell to investor pre-completion. They buy income stream. Discounted for risk.",   yieldBias:+0.50,timeMonths:"3-6"}
];

// Which exits realistically work for which asset types (true = good fit)
var ASSET_EXIT_FIT = {
  pbsa:          ["pension","sovereign","reit","btr_op","family","forward_fund","bank_takeout","hold","trade_buyer"],
  btr:           ["pension","sovereign","reit","btr_op","family","forward_fund","bank_takeout","sale_leaseback","hold"],
  sfh_portfolio: ["pension","reit","btr_op","family","ha_rp","homes_eng","open_mkt","bank_takeout","hold"],
  hotel:         ["family","hotel_op","trade_buyer","reit","sale_leaseback","bank_takeout","hold","sovereign"],
  pub:           ["pubco","trade_buyer","family","sale_leaseback","change_use","open_mkt","hold"],
  industrial:    ["pension","sovereign","reit","industrial_inv","family","sale_leaseback","bank_takeout","hold","trade_buyer"],
  office:        ["family","reit","trade_buyer","sale_leaseback","change_use","bank_takeout","hold","pension"],
  retail:        ["family","reit","trade_buyer","change_use","sale_leaseback","bank_takeout","hold"],
  residential:   ["open_mkt","family","ha_rp","bank_takeout","hold","change_use"],
  mixed:         ["family","reit","sovereign","trade_buyer","bank_takeout","hold","change_use"],
  care:          ["family","reit","trade_buyer","pension","sale_leaseback","hold","bank_takeout"],
  data_centre:   ["pension","sovereign","reit","trade_buyer","sale_leaseback","bank_takeout","hold","family"],
  other:         ["family","trade_buyer","bank_takeout","hold","sale_leaseback","change_use"]
};

// ═══════════════════════════════════════════════════════════════════════════
// TENURE MIX — for mixed-tenure development schemes (real UK SFH/BTR reality)
//
// A single scheme can sell units across multiple tenures (Open Market + AR +
// SO + BTR + First Homes etc.) with different buyers and pricing. The
// pricingFactor is applied to the Open Market price to get this tenure's
// effective price per unit. The buyerType drives Exit Strategy recommendations.
// ═══════════════════════════════════════════════════════════════════════════
var TENURE_TYPES = [
  {key:"oms",       label:"Open Market Sale",         short:"OMS",     icon:"🏠", pricingFactor:1.00, buyerType:"individual",     incomeType:"capital",     order:1, desc:"Full retail price to individual buyers via agents."},
  {key:"first_homes", label:"First Homes",            short:"FH",      icon:"🥇", pricingFactor:0.70, buyerType:"individual_ftb", incomeType:"capital",     order:2, desc:"30% discount to local first-time buyers (S106 obligation)."},
  {key:"dms",       label:"Discounted Market Sale",   short:"DMS",     icon:"💸", pricingFactor:0.80, buyerType:"individual",     incomeType:"capital",     order:3, desc:"20% discount on open market — eligibility criteria apply."},
  {key:"so",        label:"Shared Ownership",         short:"SO",      icon:"🤝", pricingFactor:0.85, buyerType:"ha_rp",          incomeType:"mixed",       order:4, desc:"HA buys 100%, sells 25-75% share + rent on rest. HA pays ~85% of OMS to take it on."},
  {key:"ar",        label:"Affordable Rent",          short:"AR",      icon:"🏛", pricingFactor:0.60, buyerType:"ha_rp",          incomeType:"capital",     order:5, desc:"Bulk sale to Housing Association. Rent capped ~80% of market."},
  {key:"sr",        label:"Social Rent",              short:"SR",      icon:"🏛", pricingFactor:0.50, buyerType:"ha_rp",          incomeType:"capital",     order:6, desc:"Lowest rent (formula-based). Bulk sale to HA at deepest discount."},
  {key:"btr",       label:"Build to Rent",            short:"BTR",     icon:"🏢", pricingFactor:0.80, buyerType:"institutional",  incomeType:"capital",     order:7, desc:"Bulk sale to pension fund / BTR operator. Forward-fund or stabilised."},
  {key:"prs",       label:"Private Rented Sector",    short:"PRS",     icon:"🔑", pricingFactor:0.85, buyerType:"individual_llrd", incomeType:"capital",    order:8, desc:"Single landlord investor buys 1-10 units. Smaller discount than BTR."},
  {key:"rtb_lease", label:"Rent to Buy",              short:"RtB",     icon:"⏳", pricingFactor:0.85, buyerType:"individual",     incomeType:"deferred",    order:9, desc:"Tenant pays intermediate rent, option to buy after 5yrs."},
  {key:"rtb_buy",   label:"Right to Buy back-buy",    short:"RtBB",    icon:"♻", pricingFactor:0.70, buyerType:"council",        incomeType:"capital",     order:10, desc:"Council buys back former RTB units at discount."}
];

// v10.9 — the affordable/social discount blend implied by the Tenure Mix stage
// (data.tenure.mix), as a fraction of full open-market GDV. This mirrors
// computeTenureMetrics' blendedGdv/pureMarketGdv ratio, but the omsUnitPrice cancels
// out, so it reduces to the units-weighted average pricingFactor — which we can compute
// from data.tenure alone WITHOUT calling computeSFHMetrics (that would recurse, since
// computeTenureMetrics itself calls computeSFHMetrics). Returns 1 (no discount) unless
// the split genuinely covers the scheme, so a partial/placeholder allocation can't
// over-discount the whole GDV.
function tenureMixBlendFactor(data, schemeUnits){
  var t = (data && data.tenure) || {};
  var mix = t.mix;
  if(!mix) return 1;
  var mode = t.inputMode || "units";
  var alloc = 0, weighted = 0;
  TENURE_TYPES.forEach(function(td){
    var v = num(mix[td.key]); if(!v) return;
    alloc += v;
    weighted += v * td.pricingFactor;
  });
  if(alloc <= 0) return 1;
  // Coverage guard: only blend when the split covers ~the whole scheme (units mode) or
  // sums to ~100% (percentage mode). Otherwise applying the blend to the FULL GDV would
  // discount units that were never allocated as affordable.
  var covered = (mode === "units")
    ? (num(schemeUnits) > 0 ? alloc >= num(schemeUnits) * 0.9 : alloc > 0)
    : (alloc >= 90);
  if(!covered) return 1;
  var f = weighted / alloc;
  return (f > 0 && f < 1) ? f : 1;   // only a genuine discount reduces GDV
}

function getTenureDef(key){
  for(var i=0;i<TENURE_TYPES.length;i++){if(TENURE_TYPES[i].key===key)return TENURE_TYPES[i];}
  return TENURE_TYPES[0];
}

// Default mix presets — common patterns
var TENURE_PRESETS = {
  "all_market":    {label:"100% Open Market",        mix:{oms:100}},
  "standard_s106": {label:"Standard S106 (70/30)",   mix:{oms:70, ar:20, so:10}},
  "intermediate":  {label:"Intermediate-heavy",       mix:{oms:60, so:20, first_homes:10, ar:10}},
  "all_affordable":{label:"100% Affordable (HA-led)", mix:{ar:50, sr:25, so:25}},
  "btr_blend":     {label:"BTR + AR blend",           mix:{btr:80, ar:20}},
  "ftb_focus":     {label:"First Homes focus",        mix:{oms:55, first_homes:25, so:20}}
};

// ═══════════════════════════════════════════════════════════════════════════
// calcDealMetrics(data) — SINGLE SOURCE OF TRUTH for deal-level financial metrics
// Used by Dashboard, Summary, Fin, Exit, Reports, Data Room.
// Returns a normalised object regardless of scheme type (SFH vs BTR vs PBSA vs Mixed).
// Never returns undefined — always returns a number (0 if unknown).
// ═══════════════════════════════════════════════════════════════════════════
function computeSFHMetrics(data){
  data = data || {};
  var sfh = data.sfh || {};
  var l = data.land || {};
  var cityKey = (typeof dealCityKey === "function") ? dealCityKey(data) : (sfh.city || l.city || "").toLowerCase();
  var market = MKT[cityKey] || MKT.manchester;
  var basePsf = num(sfh.basePsf) || (market && market.btr ? Math.max(150, Math.min(650, Math.round(estSalePsfFromRent(market.btr)))) : 260);
  var buildPsf = num(sfh.buildPsf) || (market && market.build) || 195;
  var mix = sfh.mix || [];
  var rows = [];
  var totalUnits = 0, retailGdv = 0, blendedGdv = 0, buildCost = 0, totalSqft = 0;
  mix.forEach(function(row){
    var count = num(row.count); if(!count) return;
    // v9.69 — count any row that has plots + sale data, even if the house-TYPE label is
    // blank. Previously a missing type made the engine skip the whole row, so the screen
    // could show 225 plots while the engine counted only 200. Only a truly empty row
    // (no size and no price and no type) is ignored.
    if(!(row.type || num(row.sqft) || num(row.unitPrice||row.salePrice||row.psf))) return;
    var info = HOUSE_TYPES[row.type] || HOUSE_TYPES["3-bed semi"] || {sqft:900, adj:1};
    var sqft = numOr(row.sqft, info.sqft || 900);
    var unitPrice = num(row.unitPrice || row.salePrice || 0);
    var psf = unitPrice && sqft ? unitPrice / sqft : (num(row.psf) || basePsf * (info.adj || 1));
    var tenure = row.tenure || "private";
    var disc = (ROUTE_DISCOUNT[tenure] || ROUTE_DISCOUNT.private).pct;
    var rowRetail = sqft * psf * count;
    var rowBlended = rowRetail * disc;
    totalUnits += count;
    totalSqft += sqft * count;
    retailGdv += rowRetail;
    blendedGdv += rowBlended;
    buildCost += sqft * (num(row.buildPsf) || buildPsf) * count;   // per-row build £/sqft (e.g. conversion vs new-build) overrides the scheme rate
    rows.push({type:row.type||"House",count:count,sqft:sqft,psf:psf,tenure:tenure,retailGdv:rowRetail,blendedGdv:rowBlended});
  });
  var hasNonPrivate = rows.some(function(r){return r.tenure && r.tenure !== "private";});
  // v9.46 — Canonical blended GDV. Priority: (1) if rows carry per-row tenure,
  // that blend is authoritative; (2) else apply the scheme's overall AH% haircut;
  // (3) else retail. This single value is what every screen/consumer reads.
  var ahFactor = sfhAhFactor(data);
  // v10.9 — when the affordable split was entered on the Tenure Mix stage
  // (data.tenure.mix) rather than as per-row sfh.mix tenures or an overall ahPct, blend
  // it into the ONE engine GDV so Financial Modelling / Dashboard / Executive Summary /
  // Scorecard / Teaser reflect it (previously the Tenure Mix discount never reached GDV,
  // so those all showed the pure open-market GDV and an overstated margin). Precedence
  // prevents double-counting: explicit per-row tenure wins, else the Tenure Mix split,
  // else the overall ahPct haircut, else full retail.
  // v10.13 — a real Tenure Mix split takes PRECEDENCE over the crude overall-ahPct
  // haircut (it's the more specific, per-tenure breakdown of the same affordable units).
  // Previously this was gated behind ahFactor>=1, so a Keystone-set ahPct silently blocked
  // the Tenure Mix the user had entered. Precedence: per-row tenure > Tenure Mix > ahPct.
  var tenureFactor = !hasNonPrivate ? tenureMixBlendFactor(data, totalUnits) : 1;
  var effectiveBlended = hasNonPrivate ? blendedGdv
    : (tenureFactor < 1 ? retailGdv * tenureFactor
    : (ahFactor < 1 ? retailGdv * ahFactor : retailGdv));

  // v9.47 — Canonical GROSS cost stack + residual, mirroring the SFH House Mix
  // screen exactly so every screen and the AI quote the same RLV. Acquisition
  // costs (SDLT/legals/agent) are NOT included here — they are layered on later
  // as the "net land bid". 'buildInclusive' = the user's build £/sqft already
  // covers roads/drainage/site infrastructure, so those lines are zeroed to
  // avoid double-counting (the optional-cost behaviour the user asked for).
  var sfhAcres = num(sfh.acres) || num(l.acres);   // inherit site area from Land Appraisal when not set on SFH
  var buildInclusive = !!sfh.buildInclusive;
  // v10.9 — read the professional-fees % from the input (shared with fin.feesPct /
  // rlv.feesPct) instead of hard-coding 10%. Previously typing 12% in Financial
  // Modelling had no effect on the SFH appraisal — it stayed locked at 10%.
  // v10.12 — default 12% (matching the Financial Modelling input placeholder and the
  // generic-path default), so a fresh deal with no explicit fees% computes what the input
  // shows instead of a silent 10%.
  // v10.48 — when the build £/sqft is declared ALL-IN, it already covers professional fees
  // (design team, planning, QS) and the contingency buffer — the same principle as roads/
  // SuDS. Adding them again would double-count against the rate, so they're zeroed and
  // finance is charged on the build cost alone. Turn the all-in toggle OFF for a
  // construction-only rate and both lines return.
  var sfhFees = buildInclusive ? 0 : buildCost * (numOr(sfh.feesPct, 12) / 100);
  var sfhContingency = buildInclusive ? 0 : buildCost * (numOr(sfh.contingency, 5) / 100);
  // v10.55 — FINANCE on an S-CURVE / PEAK-DEBT basis, not a flat rate × build. For a large
  // phased scheme the interest depends on how long the programme runs and how much debt is
  // outstanding at peak — sales receipts recycle capital, so peak debt is far below the total
  // build cost. Both are derived from the scheme's scale and are editable on the deal:
  //   • programmeYears — bigger schemes run longer (≈ 1 + units/350, clamped 2–10 yrs).
  //   • peakDebtPct — % of (build+fees) outstanding at peak; more phases ⇒ lower peak
  //     (≈ 200 / phases, clamped 30–100%), where phases ≈ ceil(units/300).
  //   finance = (build + fees) × peakDebt% × rate × programmeYears × 0.6 (S-curve avg utilisation)
  // A single-phase small scheme (peak ~100%, ~2 yrs) lands near the old flat figure; a big
  // phased scheme shows a realistic multi-year interest cost. Tune peakDebt up for slow sales.
  var FIN_SCURVE = 0.6;
  var finPhases = num(sfh.phases) > 0 ? num(sfh.phases) : Math.max(1, Math.ceil(totalUnits / 300));
  var finProgYears = num(sfh.programmeYears) > 0 ? num(sfh.programmeYears)
    : Math.max(2, Math.min(10, Math.round((1 + totalUnits / 350) * 10) / 10));
  var finPeakDebtPct = num(sfh.peakDebtPct) > 0 ? num(sfh.peakDebtPct)
    : Math.max(30, Math.min(100, Math.round(200 / finPhases)));
  var sfhFinance = (buildCost + sfhFees) * (finPeakDebtPct / 100) * (numOr(sfh.finRate, 7.5) / 100) * finProgYears * FIN_SCURVE;
  var sfhS106 = totalUnits * numOr(sfh.s106pu, 8000);
  var sfhRoads = buildInclusive ? 0 : totalUnits * numOr(sfh.roads, 12000);
  var sfhInfra = buildInclusive ? 0 : sfhAcres * 53000;
  // v9.89 — disposal / marketing costs (agent + marketing + legal on the sale). Defaults
  // to 0 so hand-built deals are unchanged; Keystone-built deals set ~3% of GDV.
  var sfhMarketing = effectiveBlended * (numOr(sfh.marketingPct, 0) / 100);
  var sfhProfit = effectiveBlended * (numOr(sfh.profitPct, 17.5) / 100);
  var sfhDevCost = buildCost + sfhFees + sfhContingency + sfhFinance + sfhS106 + sfhRoads + sfhInfra + sfhMarketing;
  // v10.90 — AFFORDABLE-HOUSING GRANT (Homes England AHP / SAHP). Grant per affordable home is
  // public subsidy that closes a viability gap on the affordable units. It flows straight to the
  // RESIDUAL (what you can pay for the land) — not to developer profit or marketing — so it can
  // make an otherwise-negative RLV stack. Set grants.grantPerAffHome (£/affordable home) to use it.
  var _ahForGrant = num(sfh.ahPct) || num((data.planning || {}).ahPct) || num((data.planning || {}).afhPct) || num((data.tenure || {}).ahPct) || 0;
  var affordableHomes = Math.round(totalUnits * _ahForGrant / 100);
  var grantPerAffHome = num((data.grants || {}).grantPerAffHome);
  var grantIncome = (grantPerAffHome > 0 && affordableHomes > 0) ? grantPerAffHome * affordableHomes : 0;
  var sfhGrossRlv = effectiveBlended - sfhDevCost - sfhProfit + grantIncome;

  // ── v9.89 — CAPITALISATION / FORWARD-FUND EXIT ─────────────────────────────
  // Value the finished scheme as a rented investment sold to an institution (e.g. a
  // pension fund) rather than sold home-by-home. KEY POINT: the build-to-sell affordable
  // discount (which cuts Cassidy's GDV above) is NOT applied here — in a capitalised deal
  // the affordable units simply produce a lower rent, which the INVESTOR capitalises and
  // lives with. So Cassidy's revenue is the investment value, and affordable is an income
  // effect (lower rent) borne by the end holder, not a capital haircut on the developer.
  var cap = data.capitalise || {};
  var capMk = MKT[(typeof dealCityKey === "function") ? dealCityKey(data) : (sfh.city || l.city || "").toLowerCase()] || null;
  var ahPctR = num(sfh.ahPct) || num((data.planning || {}).ahPct) || num((data.planning || {}).afhPct) || num((data.tenure || {}).ahPct) || 0;
  // House rent is derived from the scheme's OWN market values (a flat city BTR rent
  // badly understates house rents): market unit value × a gross rental yield.
  var capGrossRentYield = numOr(cap.grossRentYield, 4.5) / 100;
  var avgUnitMktValue = totalUnits > 0 ? retailGdv / totalUnits : 0;
  var mktRentPerUnitPa = num(cap.marketRentPerUnitPa) || (avgUnitMktValue * capGrossRentYield) || areaMarketRentPa(data) || (capMk && capMk.btr ? capMk.btr * 12 : 0);
  var ahRentFactor = numOr(cap.ahRentFactor, 0.65);   // affordable/social rent ~65% of market
  var privUnits = totalUnits * (1 - ahPctR / 100), ahUnits = totalUnits * (ahPctR / 100);
  var capGrossRentPa = (privUnits + ahUnits * ahRentFactor) * mktRentPerUnitPa;
  var capMgmtRate = numOr(cap.mgmtRate, 25);
  var capNetRentPa = capGrossRentPa * (1 - capMgmtRate / 100);
  var capYield = num(cap.targetYield); capYield = capYield > 1 ? capYield / 100 : capYield;
  capYield = capYield || (capMk && capMk.yield) || 0.05;
  var capInvestmentValue = (capYield > 0 && capNetRentPa > 0) ? capNetRentPa / capYield : 0;
  // Same development cost stack; developer profit taken on the investment value.
  var capProfit = capInvestmentValue * (numOr(sfh.profitPct, 17.5) / 100);
  var capRlv = capInvestmentValue > 0 ? capInvestmentValue - sfhDevCost - capProfit : 0;

  return {rows:rows,totalUnits:totalUnits,avgSqft:totalUnits>0?totalSqft/totalUnits:0,retailGdv:retailGdv,blendedGdv:effectiveBlended,gdv:effectiveBlended,ahFactor:ahFactor,buildCost:buildCost,hasNonPrivate:hasNonPrivate,basePsf:basePsf,buildPsf:buildPsf,
    acres:sfhAcres,buildInclusive:buildInclusive,fees:sfhFees,contingency:sfhContingency,finance:sfhFinance,s106:sfhS106,roads:sfhRoads,infra:sfhInfra,marketing:sfhMarketing,profit:sfhProfit,devCost:sfhDevCost,rlv:sfhGrossRlv,
    financeProgYears:finProgYears,financePeakDebtPct:finPeakDebtPct,financePhases:finPhases,financeSCurve:FIN_SCURVE,
    capMarketRentPerUnitPa:mktRentPerUnitPa,capGrossRentPa:capGrossRentPa,capNetRentPa:capNetRentPa,capYield:capYield,capInvestmentValue:capInvestmentValue,capProfit:capProfit,capRlv:capRlv,ahPctResolved:ahPctR,
    affordableHomes:affordableHomes,grantPerAffHome:grantPerAffHome,grantIncome:grantIncome,rlvBeforeGrant:sfhGrossRlv-grantIncome};
}

// ── SFH MIX OPTIMISER (v10.44) ─────────────────────────────────────────────
// "Which homes make the most money — and what mix maximises it." For each type in the scheme
// it works out the gross margin PER PLOT and PER SQFT. £/sqft of margin is the key metric,
// because land is used roughly in proportion to floor area — so the home that returns the most
// margin per sqft returns the most per acre of land. It then proposes a mix that leans toward
// the best types WITHIN realistic bounds (no single type above ~40% or below ~10%), because a
// pure optimum would say "build only 3-beds", which planning and sales absorption won't allow.
//   mode "profit" ranks by margin/sqft; mode "rent" ranks by rent/sqft (for a BTR/forward sale).
// It bites when REAL per-type prices/rents are entered (a 4-bed detached often sells at a LOWER
// £/sqft than a 3-bed semi — the exact effect Cassidy flagged). Returns null if there's no mix.
function optimiseSfhMix(data, mode, opts){
  data = data || {}; mode = (mode === "rent") ? "rent" : "profit"; opts = opts || {};
  var sfh = data.sfh || {};
  var cityKey = (typeof dealCityKey === "function") ? dealCityKey(data) : (sfh.city || "").toLowerCase();
  var market = MKT[cityKey] || MKT.manchester;
  var basePsf = num(sfh.basePsf) || (market && market.btr ? Math.max(150, Math.min(650, Math.round(estSalePsfFromRent(market.btr)))) : 260);
  var schemeBuildPsf = num(sfh.buildPsf) || (market && market.build) || 195;
  // v10.48 — an all-in build rate already covers fees + contingency (as it does roads/SuDS),
  // so the optimiser's per-plot cost must zero them too or its margins would diverge from the engine.
  var inclusive = !!sfh.buildInclusive;
  var feesPct = inclusive ? 0 : numOr(sfh.feesPct, 12) / 100, contPct = inclusive ? 0 : numOr(sfh.contingency, 5) / 100, finRate = numOr(sfh.finRate, 7.5) / 100;
  var s106pu = numOr(sfh.s106pu, 8000), mktgPct = numOr(sfh.marketingPct, 0) / 100;
  var roadsPu = inclusive ? 0 : numOr(sfh.roads, 12000);

  var rows = (sfh.mix || []).filter(function(r){ return num(r.count) > 0; });
  if(!rows.length) return null;

  // v10.55 — mirror the engine's S-curve/peak-debt finance so per-plot margins track the appraisal.
  var optUnits = rows.reduce(function(a, r){ return a + num(r.count); }, 0);
  var optPhases = num(sfh.phases) > 0 ? num(sfh.phases) : Math.max(1, Math.ceil(optUnits / 300));
  var optProgYears = num(sfh.programmeYears) > 0 ? num(sfh.programmeYears) : Math.max(2, Math.min(10, Math.round((1 + optUnits / 350) * 10) / 10));
  var optPeakDebtPct = num(sfh.peakDebtPct) > 0 ? num(sfh.peakDebtPct) : Math.max(30, Math.min(100, Math.round(200 / optPhases)));
  var finMult = (optPeakDebtPct / 100) * optProgYears * 0.6;

  // Aggregate by type, then compute per-plot economics.
  var byType = {};
  rows.forEach(function(r){
    var info = HOUSE_TYPES[r.type] || HOUSE_TYPES["3-bed semi"] || { sqft:900, adj:1, beds:3 };
    var sqft = numOr(r.sqft, info.sqft);
    var price = num(r.unitPrice || r.salePrice) || (num(r.psf) ? num(r.psf) * sqft : 0) || Math.round(sqft * basePsf * (info.adj || 1));
    var key = r.type || ("~" + numOr(r.beds, info.beds || 3) + "-bed");
    if(!byType[key]){ byType[key] = { type:key, beds:numOr(r.beds, info.beds || 3), sqft:sqft, price:price, buildPsf:(num(r.buildPsf) || schemeBuildPsf), count:0 }; }
    byType[key].count += num(r.count);
  });
  var types = Object.keys(byType).map(function(k){
    var t = byType[k];
    var build = t.sqft * t.buildPsf;
    var cost = build + build * feesPct + build * contPct + (build + build * feesPct) * finRate * finMult + s106pu + roadsPu + t.price * mktgPct;
    var margin = t.price - cost;                                  // per plot, before land / infra / developer profit
    var rentPcm = (typeof areaRentPcm === "function") ? areaRentPcm(data, t.beds) : 0;
    return { type:t.type, beds:t.beds, sqft:t.sqft, count:t.count,
      salePrice:Math.round(t.price), psf: t.sqft > 0 ? Math.round(t.price / t.sqft) : 0,
      buildPsf:Math.round(t.buildPsf), costToDeliver:Math.round(cost),
      marginPerPlot:Math.round(margin), marginPsf: t.sqft > 0 ? margin / t.sqft : 0,
      rentPcm:Math.round(rentPcm), rentPsfPa: t.sqft > 0 ? (rentPcm * 12 / t.sqft) : 0,
      grossYield: cost > 0 ? (rentPcm * 12 / cost) * 100 : 0 };
  });
  var rankKey = mode === "rent" ? "rentPsfPa" : "marginPsf";
  types.sort(function(a, b){ return b[rankKey] - a[rankKey]; });

  // Optimised mix — reallocate the SAME developable floor area toward the best-ranked types,
  // within [minShare, maxShare] floor-area bounds (greedy: best gets max, worst gets min).
  var T = types.reduce(function(a, t){ return a + t.sqft * t.count; }, 0);
  var n = types.length;
  // v10.46 — tunable bounds (per-type floor-area share). Defaults ~10%–40%; the SFH Mix Optimiser
  // exposes these so Cassidy can match how it actually sells (e.g. allow a 50% dominant type).
  var maxShare = num(opts.maxPct) > 0 ? num(opts.maxPct) / 100 : Math.max(0.40, 1 / n);
  var minShare = num(opts.minPct) >= 0 && opts.minPct !== "" && opts.minPct != null ? num(opts.minPct) / 100 : Math.min(0.10, 1 / (n + 1));
  minShare = Math.max(0, Math.min(minShare, 1 / n));    // feasibility: every type can hold its min
  maxShare = Math.max(maxShare, 1 / n);                 // feasibility: mix can still sum to 100%
  var shares = types.map(function(){ return minShare; });
  var budget = 1 - minShare * n;
  for(var i = 0; i < n && budget > 1e-9; i++){ var add = Math.min(maxShare - minShare, budget); shares[i] += add; budget -= add; }
  var optMix = types.map(function(t, i){
    var cnt = Math.max(0, Math.round((shares[i] * T) / (t.sqft || 1)));
    return { type:t.type, beds:String(t.beds), count:String(cnt), sqft:String(t.sqft),
      unitPrice:String(t.salePrice), psf:"", tenure:"private", buildPsf: t.buildPsf ? String(Math.round(t.buildPsf)) : "" };
  });
  // v10.61 — reconcile the optimised counts back to the ORIGINAL unit total. Rounding each
  // type's floor-area allocation to whole homes independently drifts the headline total
  // (e.g. 1,800 → 1,789); the scheme's unit count must NOT change just because the mix was
  // re-optimised. The difference goes on the largest-count row, preserving the distribution.
  (function(){
    var origUnits = types.reduce(function(a, t){ return a + num(t.count); }, 0);
    var optSum = optMix.reduce(function(a, r){ return a + num(r.count); }, 0);
    var drift = origUnits - optSum;
    if(drift !== 0 && optMix.length){
      var bigIdx = 0;
      for(var _i = 1; _i < optMix.length; _i++){ if(num(optMix[_i].count) > num(optMix[bigIdx].count)) bigIdx = _i; }
      optMix[bigIdx].count = String(Math.max(0, num(optMix[bigIdx].count) + drift));
    }
  })();

  function totals(mix){
    var m = computeSFHMetrics(Object.assign({}, data, { sfh: Object.assign({}, sfh, { mix:mix }) }));
    var acres = num(sfh.acres) || num(data.land && data.land.acres) || 0;
    var surplus = num(m.gdv) - num(m.devCost);                    // £ available for LAND + developer PROFIT
    return { units:num(m.totalUnits), gdv:num(m.gdv), rlv:num(m.rlv), surplus:surplus, surplusPerAcre: acres > 0 ? surplus / acres : 0 };
  }
  var current = totals(sfh.mix || []);
  var optimised = totals(optMix); optimised.mix = optMix;
  return { mode:mode, types:types, current:current, optimised:optimised,
    uplift: optimised.surplus - current.surplus,
    upliftPct: current.surplus > 0 ? ((optimised.surplus - current.surplus) / current.surplus * 100) : 0 };
}

// ──────────────────────────────────────────────────────────────────────────
// computeHRAMetrics (v9.49) — canonical engine for high-rise / apartment (BTR/
// PBSA) blocks. Mirrors the BTR/PBSA Block screen EXACTLY for the sales-based
// value (so screen == engine), and ALSO returns the rent-capitalised investment
// value, so a BTR scheme can be judged BOTH ways: sell the flats individually,
// or sell the whole block to an investor on its rent. Full high-rise cost stack
// (lifts, sprinklers, EWS1, BSA Gateway 2/3, structural premium, amenity).
// ──────────────────────────────────────────────────────────────────────────
function computeHRAMetrics(data){
  data = data || {};
  var h = data.hra || {};
  var cityKey = ((h.city) || (data.land && data.land.city) || (data.sfh && data.sfh.city) || "").toLowerCase();
  var hm = MKT[cityKey] || MKT.manchester;
  var storeys = num(h.storeys), fp = num(h.fp);
  var eff = numOr(h.eff, 80);
  var gia = fp * storeys, nia = gia * (eff / 100);
  var ss = numOr(h.ss, 20), os = numOr(h.os, 50), ts = numOr(h.ts, 30);
  var ssqft = numOr(h.ssqft, 380), osqft = numOr(h.osqft, 520), tsqft = numOr(h.tsqft, 750);
  var su = (nia > 0 && ss > 0 && ssqft > 0) ? Math.round(nia * (ss / 100) / ssqft) : 0;
  var ou = (nia > 0 && os > 0 && osqft > 0) ? Math.round(nia * (os / 100) / osqft) : 0;
  var tu = (nia > 0 && ts > 0 && tsqft > 0) ? Math.round(nia * (ts / 100) / tsqft) : 0;
  var total = su + ou + tu;
  var mktSalePsf = num(data.rlv && data.rlv.salePsf) || (cityKey && typeof PC_PSF !== "undefined" && PC_PSF[cityKey.substring(0,3).toUpperCase()]) || 260;
  var sPsf = num(h.sPsf) || Math.round(mktSalePsf * 0.92);
  var oPsf = num(h.oPsf) || Math.round(mktSalePsf);
  var tPsf = num(h.tPsf) || Math.round(mktSalePsf * 1.08);
  var fl = numOr(h.fl, 0.5);
  var blend = 1 + (storeys > 1 ? (storeys / 2) * fl / 100 : 0);
  var salesGdv = su * ssqft * sPsf * blend + ou * osqft * oPsf * blend + tu * tsqft * tPsf * blend;
  var bcp = numOr(h.bcp, (storeys >= 20 ? 310 : storeys >= 15 ? 280 : storeys >= 10 ? 255 : 230));
  var hBc = gia * bcp;
  var cores = numOr(h.cores, Math.max(1, Math.ceil(gia / 40000)));
  var hrCosts = cores * storeys * 18000           // lifts
    + gia * 18                                      // sprinklers
    + (storeys >= 11 ? 25000 : 0)                   // EWS1
    + (storeys >= 18 ? 45000 : storeys >= 11 ? 28000 : 0)  // Gateway 2/3
    + (storeys >= 20 ? gia * 15 : storeys >= 15 ? gia * 10 : gia * 6)  // structural premium
    + Math.min(total * 3500, 500000);               // amenity
  var fees = hBc * 0.13, cont = hBc * (numOr(h.contingency, 6)) / 100;
  var fin = (hBc + fees) * (numOr(h.finRate, 8)) / 100;
  var s106 = total * (numOr(h.s106pu, 10000)), plan = total * 12000;
  var profitPct = numOr(h.profitPct, 17.5);
  var devCost = hBc + fees + cont + fin + s106 + plan + hrCosts;
  var salesProfit = salesGdv * (profitPct / 100);
  var salesRlv = salesGdv - devCost - salesProfit;

  // Investment value — sell the whole block to an investor on its rent.
  var cap = data.capitalise || {};
  var capYield = num(cap.targetYield); capYield = capYield > 1 ? capYield / 100 : capYield;
  var yld = capYield || (hm && hm.yield) || 0.05;
  var grossRentPa = total * (areaMarketRentPa(data) || (hm && hm.btr ? hm.btr * 12 : 0));
  var netRentPa = grossRentPa * 0.75;   // ~25% gross-to-net (voids, management, opex) — typical BTR
  var investmentValue = (yld > 0 && netRentPa > 0) ? netRentPa / yld : 0;
  var investmentProfit = investmentValue * (profitPct / 100);
  var investmentRlv = investmentValue > 0 ? investmentValue - devCost - investmentProfit : 0;

  return {
    units: total, su: su, ou: ou, tu: tu, gia: gia, nia: nia,
    salesGdv: salesGdv, gdv: salesGdv,
    buildCost: hBc, fees: fees, contingency: cont, finance: fin, s106: s106, planning: plan, hrCosts: hrCosts,
    devCost: devCost, profit: salesProfit, rlv: salesRlv,
    annualRentGross: grossRentPa, annualRentNet: netRentPa, yield: yld,
    investmentValue: investmentValue, investmentRlv: investmentRlv
  };
}

// ──────────────────────────────────────────────────────────────────────────
// computeEPEMetrics (v9.49) — canonical engine for EXISTING PROPERTY (a house,
// pub, office etc. you'd buy as standing, then convert/extend or demolish and
// redevelop). Mirrors the Property Evaluator screen exactly: value as-standing
// (with garden/parking/condition adjustments) vs the redevelopment residual, and
// the uplift between them. Pure + tested so this maths is in the CI safety net.
// ──────────────────────────────────────────────────────────────────────────
function computeEPEMetrics(data){
  data = data || {};
  var ep = data.epe || {};
  var pcData = (typeof lookupPostcode === "function" && ep.postcode) ? lookupPostcode(ep.postcode) : null;
  var eCity = (pcData && pcData.city) || ep.city || "manchester";
  var em = MKT[eCity] || MKT.manchester;
  var salePsf = num(ep.salePsf) || (pcData && pcData.salePsf) || 280;
  var propSqft = num(ep.propSqft) || 900;
  var condMod = ({excellent:1.15, good:1.05, average:1.0, poor:0.88, derelict:0.70})[ep.condition] || 1.0;
  var gLen = num(ep.gLen), gWid = num(ep.gWid), gardenSqft = gLen * gWid;
  var gPsf = (typeof lookupLandPsf === "function") ? lookupLandPsf(ep.postcode || "") : 0;
  var aspMod = ({south:1.08, south_west:1.05, west:1.02, east:1.0, north:0.95})[ep.aspect] || 1.0;
  var gVal = gardenSqft > 0 ? Math.round((Math.min(gardenSqft,500)*gPsf + Math.max(0,Math.min(gardenSqft-500,500))*gPsf*0.65 + Math.max(0,gardenSqft-1000)*gPsf*0.3) * aspMod) : 0;
  var PARK_MODS = {triple_garage:0.15,double_garage:0.10,single_garage:0.06,triple_carport:0.10,double_carport:0.07,single_carport:0.04,balcony:0.04,garage_conversion:0.03,annex:0.06,drive_1:0.02,drive_2:0.04,drive_3:0.05,drive_4:0.06,drive_5:0.07,drive_6plus:0.08,on_street_2plus:0.01,on_street_1:0.00,cpz:-0.03,permit_only:-0.02,no_parking:-0.05};
  var parkBonus = (ep.parkingFeatures || []).reduce(function(a,f){ return a + (PARK_MODS[f] || 0); }, 0);
  var outbuildingMod = ({small_shed:0.01,large_outbuilding:0.03,log_cabin:0.05,annex_detached:0.08,barn:0.06})[ep.outbuildings] || 0;
  var balconyMod = ({juliet:0.01,small:0.02,large:0.04,roof_terrace:0.06,inset:0.03})[ep.balconyType] || 0;
  var poolMod = ({outdoor:0.04,indoor:0.08,hot_tub:0.02})[ep.pool] || 0;
  var storeysMod = ({"1":-0.05,"1.5":0.00,"2":0.00,"2.5":0.03,"3":0.04,"4":0.03,"5plus":0.02})[ep.storeys] || 0;
  var parkMod = 1 + parkBonus + outbuildingMod + balconyMod + poolMod + storeysMod;
  var houseVal = Math.round(propSqft * salePsf * condMod);
  var currentVal = Math.round((houseVal + gVal) * parkMod);
  var newUnits = num(ep.newUnits), newSqft = num(ep.newSqft) || 900, newPsf = num(ep.newPsf) || salePsf;
  var newBuildPsf = num(ep.buildPsf) || (em && em.build) || 195, profitPct = num(ep.profitPct) || 17.5;
  var newGdv = newUnits * newSqft * newPsf;
  var newBuild = newUnits * newSqft * newBuildPsf;
  var demolish = 15000 + (gardenSqft > 5000 ? 8000 : 0);
  var fees = newBuild * 0.10, fin = (newBuild + fees) * (num(ep.finRate) || 7.5) / 100;
  var s106 = newUnits * (num(ep.s106pu) || 8000);
  var devProfit = newGdv * (profitPct / 100);
  var devCost = newBuild + fees + fin + s106 + demolish;
  var devRlv = newGdv - devCost - devProfit;
  return {
    currentVal: currentVal, houseVal: houseVal, gardenVal: gVal, gardenSqft: gardenSqft,
    newUnits: newUnits, newGdv: newGdv, newBuild: newBuild, fees: fees, finance: fin,
    s106: s106, demolish: demolish, profit: devProfit, devCost: devCost, devRlv: devRlv,
    uplift: devRlv - currentVal, viable: devRlv > currentVal * 1.1
  };
}

// ──────────────────────────────────────────────────────────────────────────
// SHARED INPUTS (v9.50) — "enter once, flows everywhere". Each group below lists
// every [stage, fieldKey] that holds the SAME logical value (even where the key
// name differs per stage, e.g. sale £/sqft is sfh.basePsf but rlv.salePsf). Two
// consumers, one map:
//   • applySharedInput  — on edit, copies the new value to the group's siblings
//     (your latest edit wins; completed/locked stages are never clobbered).
//   • normalizeSharedFields — on load/import, fills any BLANK sibling from the
//     first value already present, so data entered upstream shows downstream even
//     for deals built before this existed (e.g. agent-filled deals).
// NOTE: product-specific costs are deliberately NOT cross-linked between houses
// and apartments (e.g. house build £/sqft must not flow into the HRA bcp, which
// is a different, storey-based rate).
// ──────────────────────────────────────────────────────────────────────────
var SHARED_FIELD_GROUPS = [
  // ── Site / location (universal) ──
  [["land","city"],["sfh","city"],["hra","city"],["rlv","city"],["epe","city"]],
  [["land","postcode"],["rlv","postcode"],["epe","postcode"]],
  [["land","acres"],["sfh","acres"]],
  // ── Scheme quantum ──
  // v10.88 — tenure.totalUnits joins the group so changing the unit count updates the Tenure
  // page too (it stored its own total and lagged behind a units change).
  [["planning","units"],["land","units"],["rlv","units"],["fin","units"],["tenure","totalUnits"]],
  // ── Affordable housing % ──
  [["planning","ahPct"],["sfh","ahPct"],["tenure","ahPct"]],
  // ── Sale £/sqft (houses path; different key name per stage) ──
  [["sfh","basePsf"],["rlv","salePsf"]],
  // ── Development cost assumptions (houses / finance cluster only) ──
  [["sfh","buildPsf"],["fin","buildPsf"],["rlv","buildPsf"]],
  [["sfh","profitPct"],["fin","profitPct"],["rlv","profitPct"]],
  [["sfh","finRate"],["fin","finRate"],["rlv","finRate"]],
  // v10.9 — professional fees % (previously not shared, so the Financial Modelling
  // input never reached the SFH/RLV appraisal, which stayed on its hard-coded 10%).
  [["sfh","feesPct"],["fin","feesPct"],["rlv","feesPct"]],
  [["sfh","contingency"],["fin","contingency"],["rlv","contingency"]],
  [["sfh","s106pu"],["fin","s106pu"],["planning","s106pu"],["rlv","s106pu"]],
  [["sfh","buildInclusive"],["fin","buildInclusive"],["rlv","buildInclusive"]],
  // ── Exit / capitalisation yield (stored as a % on each stage) — two-way ──
  [["capitalise","targetYield"],["fin","exitYield"]],
  // v10.60 — more shared figures so a MANUAL change to any of these replicates to every page
  // that shows it (the derived £m figures already recompute via the one engine; these keep the
  // raw INPUT boxes in sync across screens too).
  [["land","price"],["rlv","askingPrice"],["scorecard","askingPrice"]],          // land asking / guide price
  [["sfh","avgSqft"],["rlv","avgSqft"]],                                          // average unit size
  [["land","address"],["constraintCheck","address"],["scorecard","address"]],     // site address
  [["planning","lpa"],["land","lpa"],["constraintCheck","lpa"],["planMonitor","lpa"]]  // local planning authority
];
function _sharedGroupsFor(section, key){
  return SHARED_FIELD_GROUPS.filter(function(g){ return g.some(function(t){ return t[0]===section && t[1]===key; }); });
}
function applySharedInput(d, section, key, val, currentStage, isStageId){
  d = d || {};
  isStageId = isStageId || function(){ return true; };
  // v9.62 — "complete" is a PROGRESS MARKER ONLY; it no longer blocks edits or shared-field
  // propagation. Previously a stage marked complete silently swallowed any change reaching it
  // from another screen, which made the tool feel broken ("I change a figure and nothing
  // happens" — e.g. the Make-It-Stack Apply buttons, or editing build/profit on RLV when the
  // SFH stage was ticked complete). Edits now always take effect and flow to every sibling.
  var next = Object.assign({}, d);
  function writeOne(sec, k, v){
    var o = Object.assign({}, next[sec] || {});
    o[k] = v;
    next[sec] = o;
  }
  writeOne(section, key, val);
  _sharedGroupsFor(section, key).forEach(function(group){
    group.forEach(function(t){ if(!(t[0] === section && t[1] === key)) writeOne(t[0], t[1], val); });
  });
  return next;
}
// Fill blank shared fields from the first value present in each group (used on
// load/import so anything entered upstream appears in the matching downstream
// field, including deals saved before this propagation existed).
// v10.79 — figure-driving numeric fields must be CONSISTENT across the stages that show them.
// A Financial Modelling profit of 17.5% beside an SFH profit of 25% (possible on a legacy/
// imported deal saved before profit propagation existed) is exactly the confusion we can't
// have. For these keys we RECONCILE a conflict to the authoritative (first-in-group) value, not
// just fill blanks. Descriptive fields (city, address, lpa…) keep the gentler blank-fill-only
// behaviour, so a deliberately different label on a sibling stage is never clobbered.
var _RECONCILE_SHARED_KEYS = {profitPct:1,finRate:1,buildPsf:1,feesPct:1,contingency:1,units:1,totalUnits:1,ahPct:1,afhPct:1,s106pu:1,avgSqft:1,salePsf:1,basePsf:1,targetYield:1,exitYield:1,price:1,askingPrice:1};
function normalizeSharedFields(data){
  if(!data || typeof data !== "object") return data;
  var next = Object.assign({}, data);
  function getv(sec, k){ var o = next[sec]; if(!o) return undefined; var v = o[k]; return (v === undefined || v === null || v === "") ? undefined : v; }
  SHARED_FIELD_GROUPS.forEach(function(group){
    var canon;
    for(var i = 0; i < group.length; i++){ var v = getv(group[i][0], group[i][1]); if(v !== undefined){ canon = v; break; } }
    if(canon === undefined) return;
    group.forEach(function(t){
      var cur = getv(t[0], t[1]);
      var reconcile = !!_RECONCILE_SHARED_KEYS[t[1]];
      if(cur === undefined || (reconcile && String(cur) !== String(canon))){
        var o = Object.assign({}, next[t[0]] || {}); o[t[1]] = canon; next[t[0]] = o;
      }
    });
  });
  return next;
}

// areaMarketRentPa (v9.47) — the local open-market rent per unit per year, taken
// from the area data (MKT[city].btr is a monthly market rent). Used to auto-fill
// affordable rents (Social Rent ~60%, Affordable Rent ~80% of market) so they
// reflect the actual location, then the user can override any figure. Returns 0
// when the area has no rent benchmark, so callers fall back to a yield proxy.
function areaMarketRentPa(data){
  var mk = MKT[dealCityKey(data)];
  return (mk && mk.btr) ? mk.btr * 12 : 0;
}
// estSalePsfFromRent (v9.51) — estimate a SALE £/sqft from a monthly rent, used
// ONLY as a fallback when no sale price / Land Registry figure is available.
// Capitalises the rent at a gross yield then divides by a typical unit size — a
// far sounder basis than the old "rent × 8.5 ÷ 12" multiplier, which overstated
// (e.g. £1,180/mo implied ~£836/sqft for Maldon; this gives ~£333/sqft). Clamped.
function estSalePsfFromRent(monthlyRentPcm, opts){
  opts = opts || {};
  var grossYield = num(opts.yield) || 0.05;
  var avgSqft = num(opts.avgSqft) || 850;
  if(!(num(monthlyRentPcm) > 0) || grossYield <= 0 || avgSqft <= 0) return 0;
  var v = (num(monthlyRentPcm) * 12 / grossYield) / avgSqft;
  return Math.round(Math.max(150, Math.min(650, v)));
}
function computeTenureMetrics(data){
  data = data || {};
  var t = data.tenure || {};
  var sfhMetrics = computeSFHMetrics(data);
  var totalSchemeUnits = numOr(t.totalUnits, num(data.land&&data.land.units) || num(data.planning&&data.planning.units) || sfhMetrics.totalUnits || num(data.hra&&data.hra.units) || 0);
  var basePsf = numOr(t.basePsf, num(data.sfh&&data.sfh.basePsf) || num(data.rlv&&data.rlv.salePsf) || 350);
  var avgSqft = numOr(t.avgSqft, sfhMetrics.avgSqft || num(data.sfh&&data.sfh.avgSqft) || 900);
  // v10.13 — price open-market units off the SFH engine's actual retail average (the sum of
  // the priced house-mix rows) so this stage's blended GDV reconciles to the one engine,
  // instead of a basePsf×avgSqft proxy that produced a different "£m" for the same split.
  var omsUnitPrice = numOr(t.omsUnitPrice,
    (num(sfhMetrics.retailGdv) > 0 && num(sfhMetrics.totalUnits) > 0)
      ? sfhMetrics.retailGdv / sfhMetrics.totalUnits
      : basePsf * avgSqft);
  var omsRentPa = numOr(t.omsRentPa, areaMarketRentPa(data) || omsUnitPrice * 0.04);
  var inputMode = t.inputMode || "units";
  var mix = t.mix || null;
  if(!mix) return {rows:[],totalUnits:0,blendedGdv:0,annualIncome:0,pureMarketGdv:0,discountPct:0};
  var rows = [];
  TENURE_TYPES.forEach(function(td){
    var v = num(mix[td.key]); if(!v) return;
    var unitsForTenure = inputMode === "units" ? v : (totalSchemeUnits * v / 100);
    var unitPrice = num(t[td.key+"_unitPrice"]) || (omsUnitPrice * td.pricingFactor);
    var rentPerUnit = num(t[td.key+"_rentPa"]) || (td.incomeType !== "capital" || td.key==="ar" || td.key==="sr" || td.key==="btr" ? omsRentPa * (td.key==="sr" ? 0.6 : td.key==="ar" ? 0.8 : 1.0) : 0);
    rows.push({td:td,units:unitsForTenure,unitPrice:unitPrice,capValue:unitsForTenure*unitPrice,annualRent:rentPerUnit*unitsForTenure});
  });
  var blendedGdv = rows.reduce(function(a,r){return a+r.capValue;},0);
  var annualIncome = rows.reduce(function(a,r){return a+r.annualRent;},0);
  var pureMarketGdv = totalSchemeUnits * omsUnitPrice;
  return {rows:rows,totalUnits:rows.reduce(function(a,r){return a+r.units;},0),blendedGdv:blendedGdv,annualIncome:annualIncome,pureMarketGdv:pureMarketGdv,discountPct:pureMarketGdv>0?(1-blendedGdv/pureMarketGdv)*100:0};
}
function calcDealMetrics(data){
  data = data || {};
  var l = data.land || {};
  var p = data.planning || {};
  var f = data.fin || {};
  var rlvD = data.rlv || {};
  var sfh = data.sfh || {};
  var hra = data.hra || {};
  var cap = data.capitalise || {};
  var at = data.assetType || "btr";

  // ── INPUTS (resolve to numbers safely) ────────────────────────────────
  var acres = num(l.acres);
  // Scenario-aware land cost: if a planning scenario is applied, use its modelled value;
  // else use the asking/agreed price.
  var landPrice = num(l.scenarioLandValue) || num(l.price);
  var landPriceIsScenario = !!num(l.scenarioLandValue);  // for downstream awareness
  var sfhMetrics = computeSFHMetrics(data);
  var tenureMetrics = computeTenureMetrics(data);
  var units = at === "sfh"
    ? num(l.units || p.units || sfh.totalUnits || rlvD.units || sfhMetrics.totalUnits || tenureMetrics.totalUnits || 0)
    : num(p.units || rlvD.units || l.units || sfhMetrics.totalUnits || sfh.totalUnits || tenureMetrics.totalUnits || 0);

  // City for market lookups
  var cityKey = (typeof dealCityKey === "function") ? dealCityKey(data) : (l.city || sfh.city || rlvD.city || "").toLowerCase();
  var m = MKT[cityKey] || MKT.manchester;

  // Sale PSF: prefer live LR > postcode lookup > city derived > field defaults
  var mkt = data.market || {};
  var salePsf = num(rlvD.salePsf) || num(sfh.basePsf) || num(mkt.lrPsf);
  if (!salePsf && l.postcode) {
    var pcData = lookupPostcode(l.postcode);
    if (pcData) salePsf = pcData.salePsf;
  }
  if (!salePsf && m.btr) salePsf = Math.max(150, Math.min(650, Math.round(estSalePsfFromRent(m.btr))));
  salePsf = salePsf || 260;

  // Build PSF: scheme-aware
  var buildPsf = num(rlvD.buildPsf) || num(f.buildPsf) || num(sfh.buildPsf) || (m && m.build) || 195;

  // Average sqft per unit (used for area calcs)
  var avgSqft = num(rlvD.avgSqft) || num(sfh.avgSqft) || num(l.avgSqft) || 850;

  // ── SCHEME-AWARE GDV ──────────────────────────────────────────────────
  // SFH GDV: centralised plot-mix calculation, using live unitPrice/psf and route discounts.
  var sfhGdv = sfhMetrics.gdv;

// BTR/PBSA GDV: capitalised value if rents + yield given
  var btrGdv = 0;
  var capTargetYield = num(cap.targetYield);
  var normalisedTargetYield = capTargetYield > 1 ? capTargetYield / 100 : capTargetYield;
  if (normalisedTargetYield > 0 && cap.netAnnualIncome) {
    btrGdv = num(cap.netAnnualIncome) / normalisedTargetYield;
  } else if (hra.gdv) {
    btrGdv = num(hra.gdv);
  }

  // Manual override on Financial Modelling
  var manualGdv = num(f.manualGdv || f.gdv || f.gdvOverride);

  // Blended GDV from Tenure Mix — takes priority over single-tenure SFH/BTR calcs
  // when the user has set up a tenure split
  var tenureBlendedGdv = tenureMetrics.blendedGdv;

  // Choose the right GDV based on asset type / scheme
  // v9.46 — For SFH schemes the canonical source is computeSFHMetrics (per-type
  // mix, AH-aware blended) so the deal-state matches the SFH House Mix screen.
  // The Tenure Mix capitalised blend is only used for non-SFH multi-tenure schemes.
  var gdv = 0;
  if (manualGdv > 0) gdv = manualGdv;
  else if (at === "sfh" && sfhGdv > 0) gdv = sfhGdv;       // SFH: canonical AH-aware mix blend
  else if (tenureBlendedGdv > 0) gdv = tenureBlendedGdv;  // other mixed-tenure scheme
  else if ((at === "btr" || at === "pbsa") && btrGdv > 0) gdv = btrGdv;
  else if (at !== "btr" && at !== "pbsa" && sfhGdv > 0) gdv = sfhGdv;
  // F7 lockout: only btr/pbsa/asset schemes may fall back to the capitalised BTR GDV,
  // so a stale BTR/PBSA value can no longer leak into an SFH / land / property deal.
  else if ((at === "btr" || at === "pbsa" || at === "asset") && btrGdv > 0) gdv = btrGdv;
  else if (units > 0 && salePsf > 0 && avgSqft > 0) gdv = units * avgSqft * salePsf;

  // ── COSTS ──────────────────────────────────────────────────────────────
  var buildCost = num(f.manualBuildCost || f.buildCost);
  if (!buildCost && units > 0 && avgSqft > 0 && buildPsf > 0) {
    buildCost = (at === "sfh" && sfhMetrics.buildCost > 0) ? sfhMetrics.buildCost : units * avgSqft * buildPsf;
  }

  var feesPct = num(f.feesPct || 12);
  var fees = buildCost * (feesPct / 100);

  var contPct = num(f.contingencyPct || f.contingency || 5);
  var contingency = buildCost * (contPct / 100);

  var s106pu = num(f.s106pu || p.s106pu || 8000);
  var s106 = num(p.s106) || (units * s106pu);

  var finRate = num(f.finRate || 7.5);
  // Simple finance: % of (build + fees) — flagged as 'screening estimate' in UI
  var finance = (buildCost + fees) * (finRate / 100);

  var profitPctTarget = num(f.profitPct || f.marginPct || 17.5);
  var profit = gdv * (profitPctTarget / 100);

  // ── ACQUISITION COSTS (toggle in RLV stage) ─────────────────────────
  // SDLT (5% banded approximation for commercial/non-residential land)
  // Agent fees: 1.5% of land price standard
  // Legal fees: ~£15k or 0.5% (whichever higher)
  // Land finance: 18 months at finRate on land + acq costs
  var includeAcq = !!(rlvD.includeAcqCosts);
  var sdlt = 0, agentFees = 0, legalFees = 0, landFinance = 0;
  if (includeAcq && landPrice > 0) {
    // SDLT non-residential bands (simplified):
    // 0-150k: 0%, 150k-250k: 2%, 250k+: 5%
    if (landPrice > 250000) sdlt = (landPrice - 250000) * 0.05 + (250000 - 150000) * 0.02;
    else if (landPrice > 150000) sdlt = (landPrice - 150000) * 0.02;
    agentFees = landPrice * 0.015;
    legalFees = Math.max(15000, landPrice * 0.005);
    // Land finance: assume 18 months on land + costs at finRate
    landFinance = (landPrice + sdlt + agentFees + legalFees) * (finRate / 100) * 1.5;
  }
  var totalAcqCosts = sdlt + agentFees + legalFees + landFinance;

  // ── SFH: adopt the canonical gross cost stack so the deal-state RLV equals
  // the SFH House Mix screen exactly (one engine). Includes roads/infra (subject
  // to the build-inclusive toggle); fees 10%, finance & S106 from the SFH tab. ──
  var roads = 0, infra = 0, marketing = 0;
  if (at === "sfh" && sfhMetrics.totalUnits > 0) {
    buildCost   = sfhMetrics.buildCost;
    fees        = sfhMetrics.fees;
    contingency = sfhMetrics.contingency;
    finance     = sfhMetrics.finance;
    s106        = sfhMetrics.s106;
    roads       = sfhMetrics.roads;
    infra       = sfhMetrics.infra;
    marketing   = sfhMetrics.marketing || 0;
    profit      = sfhMetrics.profit;
    // v9.67 — keep the REPORTED target margin % in step with the profit £ actually used
    // for SFH (which comes from the SFH stage's profit %, not the finance default), so a
    // screen can't show "17.5% target" beside a profit figure that's really 15%.
    profitPctTarget = gdv > 0 ? (profit / gdv) * 100 : profitPctTarget;
  }

  // ── TOTAL COST ────────────────────────────────────────────────────────
  // Development cost (what it costs to build) is separate from acquisition cost
  // (what it costs to buy the land). The headline residual is GROSS of purchase
  // costs; the net land bid then deducts them.
  var devCost = buildCost + fees + contingency + s106 + finance + roads + infra + marketing;
  var totalCost = devCost + totalAcqCosts;

  // ── RLV / RESIDUAL ────────────────────────────────────────────────────
  // rlv = GROSS residual land value (max land value before purchase costs) — the
  // single headline shared with the SFH screen. netLandBid deducts acquisition.
  var rlv = 0, netLandBid = 0;
  if (gdv > 0) {
    rlv = gdv - devCost - profit;
    netLandBid = rlv - totalAcqCosts;
  }

  // Actual profit (if user has explicit costs)
  var actualProfit = gdv - totalCost - landPrice;
  var marginPct = gdv > 0 ? (actualProfit / gdv) * 100 : 0;
  var roc = (totalCost + landPrice) > 0 ? (actualProfit / (totalCost + landPrice)) * 100 : 0;

  // ── Headroom: difference between RLV and asking price ────────────────
  var headroom = rlv > 0 && landPrice > 0 ? rlv - landPrice : 0;
  var headroomPct = landPrice > 0 && rlv > 0 ? (headroom / landPrice) * 100 : 0;

  // ── Build:Sale ratio diagnostic ──────────────────────────────────────
  var buildSaleRatio = salePsf > 0 ? (buildPsf / salePsf) * 100 : 0;
  var buildSaleVerdict = "unknown";
  if (buildSaleRatio > 0) {
    if (buildSaleRatio <= 60) buildSaleVerdict = "strong";
    else if (buildSaleRatio <= 75) buildSaleVerdict = "tight";
    else buildSaleVerdict = "unviable";
  }

  return {
    // Inputs
    acres: acres,
    units: units,
    avgSqft: avgSqft,
    landPrice: landPrice,
    landPriceIsScenario: landPriceIsScenario,
    salePsf: salePsf,
    buildPsf: buildPsf,
    // GDV components
    gdv: gdv,
    sfhGdv: sfhGdv,
    btrGdv: btrGdv,
    gdvSource: manualGdv > 0 ? "manual" : (at === "sfh" && sfhGdv > 0) ? "sfh" : ((at === "btr" || at === "pbsa") && btrGdv > 0) ? "btr" : (at !== "btr" && at !== "pbsa" && sfhGdv > 0) ? "sfh-fallback" : btrGdv > 0 ? "btr-fallback" : "derived",
    normalisedTargetYield: normalisedTargetYield,
    // Costs
    buildCost: buildCost,
    fees: fees, feesPct: feesPct,
    contingency: contingency, contingencyPct: contPct,
    s106: s106, s106pu: s106pu,
    finance: finance, finRate: finRate,
    roads: roads, infra: infra, marketing: marketing,
    devCost: devCost,
    // ── Capitalisation / forward-fund exit (SFH) — sell the scheme as a rented
    // investment. Affordable is an income effect (lower rent), NOT a capital haircut
    // on the developer, so the profit here can differ materially from build-to-sell. ──
    capInvestmentValue: (at === "sfh") ? (sfhMetrics.capInvestmentValue || 0) : 0,
    capNetRentPa: (at === "sfh") ? (sfhMetrics.capNetRentPa || 0) : 0,
    capYield: (at === "sfh") ? (sfhMetrics.capYield || 0) : 0,
    capRlv: (at === "sfh") ? (sfhMetrics.capRlv || 0) : 0,
    // Developer profit under each exit at the actual land price (sell vs capitalise):
    sellProfit: (gdv > 0) ? (gdv - devCost - landPrice) : 0,
    sellMarginPct: (gdv > 0) ? ((gdv - devCost - landPrice) / gdv) * 100 : 0,
    capProfit: (at === "sfh" && sfhMetrics.capInvestmentValue > 0) ? (sfhMetrics.capInvestmentValue - devCost - landPrice) : 0,
    capMarginPct: (at === "sfh" && sfhMetrics.capInvestmentValue > 0) ? ((sfhMetrics.capInvestmentValue - devCost - landPrice) / sfhMetrics.capInvestmentValue) * 100 : 0,
    // Acquisition (only populated if toggle on)
    includeAcqCosts: includeAcq,
    sdlt: sdlt, agentFees: agentFees, legalFees: legalFees, landFinance: landFinance,
    totalAcqCosts: totalAcqCosts,
    // Profit / margin
    profit: profit, profitPctTarget: profitPctTarget,
    actualProfit: actualProfit,
    marginPct: marginPct,
    roc: roc,
    // Outputs
    totalCost: totalCost,
    rlv: rlv,                 // GROSS residual (before land purchase costs)
    netLandBid: netLandBid,   // net of acquisition costs (SDLT/legals/agent/land finance)
    headroom: headroom,
    headroomPct: headroomPct,
    // Diagnostic
    buildSaleRatio: buildSaleRatio,
    buildSaleVerdict: buildSaleVerdict,
    // Health indicators
    isViable: rlv > 0 && marginPct >= 15,
    isAtRisk: rlv > 0 && marginPct < 15,
    isUnviable: rlv <= 0 || buildSaleRatio > 75
  };
}

// ──────────────────────────────────────────────────────────────────────────
// optimiseScheme (v9.48) — the numeric "MAKE IT STACK" solver.
// When a scheme doesn't work, this works out — exactly — the single change to
// each lever that would lift the residual land value (RLV) to a target (default:
// enough to cover the asking land price; otherwise break even at £0). It drives
// the REAL calcDealMetrics by bisection, so every answer matches the engine the
// screens use — no separate formula to drift. SFH schemes for now.
//
// Returns { stacks, currentRlv, targetRlv, asking, levers:[...], allInOption }.
// Each lever: { key,label,current,required,unit,direction,feasible,stretch,note,resultRlv }.
// ──────────────────────────────────────────────────────────────────────────
function optimiseScheme(data, opts){
  opts = opts || {};
  data = data || {};
  var base = calcDealMetrics(data);
  var asking = num(data.land && data.land.price);
  var targetRlv = (opts.targetRlv != null) ? opts.targetRlv : (asking > 0 ? asking : 0);
  var sfh = data.sfh || {};
  var cityKey = (typeof dealCityKey === "function") ? dealCityKey(data) : ((sfh.city) || (data.land && data.land.city) || "").toLowerCase();
  var mkt = MKT[cityKey] || null;

  function clone(d){ return JSON.parse(JSON.stringify(d)); }
  function rlvWith(mutate){ var d = clone(data); mutate(d); return calcDealMetrics(d).rlv; }
  // Find, by bisection, the value in [lo,hi] that just reaches targetRlv.
  // increasingHelps=true  → bigger value raises RLV (return the smallest that works).
  // increasingHelps=false → smaller value raises RLV (return the largest that works,
  //                         i.e. the least painful reduction).
  function solve(setter, lo, hi, increasingHelps){
    var bestEnd = increasingHelps ? hi : lo;
    if (rlvWith(function(d){ setter(d, bestEnd); }) < targetRlv) return null; // even the max move fails
    var a = lo, b = hi;
    for (var i = 0; i < 50; i++){
      var mid = (a + b) / 2;
      var r = rlvWith(function(d){ setter(d, mid); });
      if (increasingHelps) { if (r < targetRlv) a = mid; else b = mid; }
      else { if (r < targetRlv) b = mid; else a = mid; }
    }
    return increasingHelps ? b : a;
  }

  var levers = [];
  var isSfh = (data.assetType === "sfh" || !data.assetType) && computeSFHMetrics(data).totalUnits > 0;
  if (isSfh) {
    var cur = computeSFHMetrics(data);

    // 1) Sales uplift — scale every unit price by k (an across-the-board % uplift).
    var setSales = function(d, k){ (d.sfh.mix || []).forEach(function(row){
      if (num(row.unitPrice)) row.unitPrice = String(Math.round(num(row.unitPrice) * k));
      else if (num(row.sqft) && num(row.psf)) row.psf = String(num(row.psf) * k);
    }); };
    var kNeeded = solve(setSales, 1.0, 1.8, true);
    if (kNeeded != null) {
      var upliftPct = Math.round((kNeeded - 1) * 100);
      levers.push({ key:"sales", label:"Achieve higher sales values", current:0, required:upliftPct, unit:"% across the board",
        direction:"up", feasible:true, stretch: upliftPct > 12,
        note: upliftPct <= 0 ? "Already sufficient." : "Sales would need to be about "+upliftPct+"% higher than entered"+(upliftPct>12?" — a big ask; back it with dated new-build comparables before relying on it.":" — check against recent local new-build sales.") });
    }

    // 2) Build cost — lower £/sqft.
    var curBuild = num(sfh.buildPsf) || (mkt && mkt.build) || 195;
    var buildNeeded = solve(function(d,v){ d.sfh.buildPsf = v; }, curBuild*0.5, curBuild, false);
    if (buildNeeded != null && buildNeeded < curBuild - 0.5) {
      levers.push({ key:"buildPsf", label:"Reduce build cost", current:Math.round(curBuild), required:Math.round(buildNeeded), unit:"£/sqft",
        direction:"down", feasible:true, stretch: buildNeeded < curBuild*0.85,
        note:"Build would need to come down from £"+Math.round(curBuild)+" to about £"+Math.round(buildNeeded)+"/sqft — tender it, or check the build rate isn't double-counting infra." });
    }

    // 3) Developer profit — accept a thinner margin (floored at 12%).
    var curProfit = numOr(sfh.profitPct, 17.5);
    if (curProfit > 12) {
      var profitNeeded = solve(function(d,v){ d.sfh.profitPct = v; }, 12, curProfit, false);
      if (profitNeeded != null && profitNeeded < curProfit - 0.1) {
        levers.push({ key:"profitPct", label:"Accept a lower profit margin", current:curProfit, required:Math.round(profitNeeded*10)/10, unit:"% of GDV",
          direction:"down", feasible:true, stretch: profitNeeded < 15,
          note:"Trimming target profit to about "+(Math.round(profitNeeded*10)/10)+"% would do it"+(profitNeeded<15?" — but below ~15% most funders get nervous.":".") });
      }
    }

    // 4) Affordable housing — reduce the AH% (planning permitting).
    var curAh = num(sfh.ahPct);
    if (curAh > 0) {
      var ahNeeded = solve(function(d,v){ d.sfh.ahPct = v; }, 0, curAh, false);
      if (ahNeeded != null && ahNeeded < curAh - 0.5) {
        levers.push({ key:"ahPct", label:"Reduce affordable housing %", current:Math.round(curAh), required:Math.round(ahNeeded), unit:"% affordable",
          direction:"down", feasible:true, stretch:false,
          note:"Dropping affordable from "+Math.round(curAh)+"% to about "+Math.round(ahNeeded)+"% would do it — needs a viability case agreed with the council." });
      }
    }

    // 5) S106 / unit — lower the planning contribution.
    var curS106 = numOr(sfh.s106pu, 8000);
    var s106Needed = solve(function(d,v){ d.sfh.s106pu = v; }, 0, curS106, false);
    if (s106Needed != null && s106Needed < curS106 - 1) {
      levers.push({ key:"s106pu", label:"Negotiate S106 down", current:Math.round(curS106), required:Math.round(s106Needed), unit:"£/unit",
        direction:"down", feasible:true, stretch: s106Needed < curS106*0.5,
        note:"S106 would need to fall from £"+Math.round(curS106).toLocaleString()+" to about £"+Math.round(s106Needed).toLocaleString()+"/unit — test against the actual heads of terms." });
    }
  }

  // Binary lever: if roads/infra are being added separately, is the build rate
  // actually all-in? Toggling it on is a one-click, often-large swing.
  var allInOption = null;
  if (isSfh && !sfh.buildInclusive) {
    var rlvAllIn = rlvWith(function(d){ d.sfh.buildInclusive = true; });
    if (rlvAllIn > base.rlv + 1) {
      allInOption = { resultRlv: rlvAllIn, delta: rlvAllIn - base.rlv,
        note:"If your build £/sqft is all-in — already covering professional fees, contingency, roads, drainage and site infrastructure — tick 'build is all-in' — that alone adds "+(Math.round((rlvAllIn-base.rlv)/1000))+"k to the residual." };
    }
  }

  return {
    stacks: base.rlv >= targetRlv,
    currentRlv: base.rlv,
    targetRlv: targetRlv,
    asking: asking,
    levers: levers,
    allInOption: allInOption
  };
}

// ──────────────────────────────────────────────────────────────────────────
// HONEST AI WRAPPER (v9.42)
// Wraps every AI panel prompt so the model is grounded in Landform's OWN
// calculated figures, is given market benchmarks to cross-check against, is
// shown auto-flagged deviations it must address, and is forbidden from
// inventing numbers, fund/buyer/agent names, or comparable sales.
// Usage: prompt: buildHonestPrompt(data, "<the panel's task instruction>")
// ──────────────────────────────────────────────────────────────────────────
// STAGE_FOCUS — keeps each per-stage AI analysis centred on that stage's job,
// even though the full deal state is always supplied for anti-hallucination.
// Passed as the 3rd arg to buildHonestPrompt; omit it to keep the old whole-deal behaviour.
var STAGE_FOCUS = {
  land: "You are at the LAND APPRAISAL stage — the very start of the journey. Focus ONLY on the land itself: location quality, planning status and certainty, site size, tenure, contamination, and whether the ASKING PRICE is sensible versus the £/acre benchmark band for this planning tier. Do NOT analyse build cost, GDV, sale values, S106 or developer margin in detail — those inputs belong to later stages and may not even be set yet.",
  fin:  "You are at the FINANCIAL MODELLING stage. Focus on the development-appraisal economics: build cost, fees, finance, contingency, S106, GDV, profit and margin versus benchmarks.",
  sfh:  "You are at the SFH HOUSE MIX stage. Focus on the unit mix, house-type pricing, affordable-housing tenure strategy, infrastructure adequacy and phasing. Use the GDV, RLV and margin from the DEAL STATE above as the single source of truth — do NOT restate or recompute your own headline GDV/RLV/margin; they are already given and reflect the affordable-housing blend.",
  land_deal: "You are advising on the LAND DEAL STRUCTURE. Focus on the acquisition: fair land price, deal structure (unconditional/conditional/option/promotion), overage, and the landowner split — not the build programme.",
  exit: "You are at the EXIT STRATEGY stage. Focus on the exit/sale route, buyer type, yield, hold-vs-sell and refinancing — not the land acquisition price.",
  hra:  "You are at the APARTMENT (HRA) appraisal stage. Focus on apartment-scheme viability, BSA 2022 / Gateway compliance, structural form for the storey count, and mix optimisation.",
  epe:  "You are at the EXISTING PROPERTY EVALUATION stage. Focus on current value sense-check, development feasibility and the best option for THIS property."
};
// exitAllocationSummary — who each home is sold to, from the SFH mix per-row
// tenure/exit route. Returns [{tenure,label,units,retail,realisable,mvPct}].
// Used by the SFH screen card, the AI deal-state and the reports so a mixed exit
// (e.g. 10 private + 20 to a pension fund + 30 to an HA) carries through.
function exitAllocationSummary(data){
  data = data || {};
  var c = (typeof computeSFHMetrics === "function") ? computeSFHMetrics(data) : null;
  if(!c || !c.rows || !c.rows.length) return [];
  var alloc = {}, order = [];
  c.rows.forEach(function(r){
    var k = r.tenure || "private";
    if(!alloc[k]){ alloc[k] = {units:0, retail:0, real:0}; order.push(k); }
    alloc[k].units += r.count; alloc[k].retail += r.retailGdv; alloc[k].real += r.blendedGdv;
  });
  return order.map(function(k){
    var a = alloc[k], rd = ROUTE_DISCOUNT[k] || ROUTE_DISCOUNT.private;
    return {tenure:k, label:rd.label, units:a.units, retail:a.retail, realisable:a.real, mvPct:rd.pct};
  });
}
// One-line text of the mixed exit allocation for reports (empty if single-route).
function exitAllocationText(data){
  var a = exitAllocationSummary(data);
  if(a.length < 2) return "";
  return a.map(function(x){ return x.units + " → " + x.label + " (" + fmt(x.realisable) + ")"; }).join("; ");
}
function buildHonestPrompt(data, taskInstruction, focusKey){
  data = data || {};
  var m = calcDealMetrics(data);
  var l = data.land || {}, p = data.planning || {}, cap = data.capitalise || {};
  var mkt = data.market || {};
  var at = (data.assetType || "btr");
  var cityKey = (typeof dealCityKey === "function") ? dealCityKey(data) : (l.city || (data.sfh && data.sfh.city) || (data.rlv && data.rlv.city) || "").toLowerCase();
  var bm = MKT[cityKey] || null;
  var nl = "\n";
  // landOnly: at the LAND stage we deliberately WITHHOLD the development-appraisal
  // figures (GDV/cost/RLV/margin/build:sale) from the prompt entirely — not just
  // ask the model to ignore them. You cannot lead with a negative RLV that was
  // never in the prompt. Land judgements run off planning, acreage and £/acre only.
  var landOnly = (focusKey === "land");

  // ── Benchmarks ──────────────────────────────────────────────────────────
  var lrPsf = num(mkt.lrPsf);                       // Land Registry weighted avg (all stock)
  if(!lrPsf && l.postcode){ var pcD = lookupPostcode(l.postcode); if(pcD && pcD.salePsf) lrPsf = pcD.salePsf; }
  var nb = (lrPsf > 0) ? newBuildPsf(l.postcode || cityKey, lrPsf) : null;

  // ── Auto-flagged deviations ───────────────────────────────────────────────
  var flags = [];
  var sp = num(m.salePsf);
  if(sp > 0 && lrPsf > 0){
    var devLR = Math.round((sp - lrPsf) / lrPsf * 100);
    if(Math.abs(devLR) >= 10){
      flags.push("Sale price input £" + Math.round(sp) + "/sqft is " + (devLR > 0 ? "+" : "") + devLR +
        "% versus the Land Registry weighted average £" + Math.round(lrPsf) + "/sqft for this postcode" +
        (nb ? " (new-build estimate £" + nb.newBuild + "/sqft incl. " + nb.premiumPct + "% regional premium — the input is " +
        (sp > nb.newBuild ? "STILL ABOVE even the new-build estimate" : "within the new-build range") + ")" : "") +
        ". Treat the higher figure as UNVERIFIED until backed by dated new-build comparables or a written agent opinion. Do not adopt it as fact.");
    }
  } else if(sp > 0 && !lrPsf){
    flags.push("No Land Registry £/sqft is on file for this location, so the sale price input £" + Math.round(sp) + "/sqft is unverified against comparables. Say so.");
  }
  if(bm && num(m.buildPsf) > 0){
    var devB = Math.round((num(m.buildPsf) - bm.build) / bm.build * 100);
    if(Math.abs(devB) >= 15) flags.push("Build cost input £" + Math.round(num(m.buildPsf)) + "/sqft is " + (devB > 0 ? "+" : "") + devB + "% versus the regional benchmark £" + bm.build + "/sqft for " + cityName(cityKey) + ".");
  }
  if(m.gdv > 0 && m.rlv <= 0) flags.push("Residual land value is " + fmt(m.rlv) + " — the scheme supports NO land payment at these inputs. The deal does not stack as entered. Do not soften this.");
  if(m.rlv > 0 && m.landPrice > 0 && m.landPrice > m.rlv) flags.push("Asking/agreed land price " + fmt(m.landPrice) + " EXCEEDS the residual land value " + fmt(m.rlv) + " by " + fmt(m.landPrice - m.rlv) + " — overpaying at current assumptions.");
  if(m.gdv > 0 && m.marginPct < 15) flags.push("Implied developer margin is " + pct(m.marginPct) + " of GDV — below the 15% viability floor. Flag as thin or negative.");
  if(m.buildSaleVerdict === "unviable") flags.push("Build:sale ratio " + pct(m.buildSaleRatio) + " sits in the unviable band (>75%).");
  var aiTargetYield = num(cap.targetYield);
  var aiTargetYieldPct = aiTargetYield > 1 ? aiTargetYield : aiTargetYield * 100;
  if(aiTargetYieldPct > 5.0) flags.push("Target/exit yield " + pct(aiTargetYieldPct) + " is above the ~5.0% institutional ceiling. A higher yield reduces capital value and should be checked against institutional appetite.");
  cap = Object.assign({}, cap, {targetYield:""});
  var sfhMixUnitsForAudit = computeSFHMetrics(data).totalUnits;
  var landUnitsForAudit = num(l.units);
  var planningUnitsForAudit = num(p.units);
  if(sfhMixUnitsForAudit > 0 && (landUnitsForAudit > 0 || planningUnitsForAudit > 0)){
    var canonicalUnitsForAudit = landUnitsForAudit || planningUnitsForAudit;
    if(canonicalUnitsForAudit > 0 && sfhMixUnitsForAudit !== canonicalUnitsForAudit){
      flags.push("Unit count mismatch: Land/Planning scheme total is " + canonicalUnitsForAudit + " units but SFH House Mix rows total " + sfhMixUnitsForAudit + " units. Treat Land/Planning as the headline scheme quantum until the SFH mix is manually reconciled.");
    }
  }
  if(num(cap.targetYield) > 0 && num(cap.targetYield) * 100 > 5.0) flags.push("Target/exit yield " + pct(num(cap.targetYield) * 100) + " is above the ~5.0% institutional ceiling — it implies a higher GDV than an institutional buyer would underwrite.");

  // ── Assemble ──────────────────────────────────────────────────────────────
  var s = "";
  s += "=== WHO YOU ARE ===" + nl;
  s += "You are the best property developer in the UK — decades of hands-on expertise across buildings, architecture, planning, surveying and UK property law, with a clinical eye for viability and a gift for spotting development upside others miss. You read councils and their Local Plans, weigh strengths and weaknesses honestly, and know exactly which levers turn a marginal scheme into a profitable one." + nl;
  s += "You advise CASSIDY GROUP LTD — a 35-year UK new-build developer (HQ Leamington Spa) specialising in residential, Purpose-Built Student Accommodation (PBSA), Build-to-Rent (BTR/PRS) and affordable & social housing. They operate UK-wide (excluding London), source off-market land, and unlock value through intelligent planning and design. Frame advice for how Cassidy makes maximum, responsible profit." + nl + nl;
  s += "=== HOW TO WRITE (TONE) ===" + nl;
  s += "Explain everything in plain, friendly, layman's terms — assume the reader has NO property or finance background. Short sentences. When you must use a technical term (e.g. RLV, GDV, S106, yield), add a 4-6 word plain-English gloss the first time. Be warm and encouraging while staying honest about risk." + nl + nl;
  s += "=== HONESTY RULES (READ FIRST — NON-NEGOTIABLE) ===" + nl;
  s += "You are advising on a REAL property deal. Multi-million-pound decisions will be made on your answer." + nl;
  s += "1. Do NOT invent numbers, fund names, buyer/investor names, agent names, comparable sales, or planning references. If a fact is not in the deal data below, write 'not provided in the deal data' — never fabricate a placeholder that reads as real." + nl;
  s += "2. The figures under DEAL STATE below are Landform's own calculation and are the ground truth for this deal. If your own working produces a different figure, show the working and label it explicitly as YOUR estimate — never present a different headline number than Landform's without flagging the gap." + nl;
  s += "3. CHALLENGE the inputs. Do not validate an assumption just because the user entered it. If an input deviates from benchmark (see flags), lead with that. A confident wrong number is worse than 'this needs verifying'." + nl;
  s += "4. No sycophancy, no cheerleading. Open with the risks and what could kill the deal, then the upside." + nl;
  s += "5. Where you must use a UK-typical default to reason, prefix it with [ASSUMPTION] so it is never mistaken for a deal fact." + nl;
  s += "6. MAKE IT STACK: if the scheme does NOT work as entered (negative or thin residual land value, or margin below ~15-17.5% of GDV), do not just report the failure. Propose at least one concrete ALTERNATIVE scheme that WOULD work — adjust the levers Cassidy can actually pull: unit mix and sizes, density, tenure / affordable-housing split, build specification or whether build cost is all-in, exit route (open-market sale vs BTR vs PBSA vs bulk sale to an RP), phasing, or the land price offered. Show the resulting headline numbers, clearly labelled as YOUR PROPOSED SCENARIO to test in Landform — not as Landform facts. If no realistic combination makes it stack, say so plainly and explain why." + nl + nl;

  s += "=== VERIFIED LANDFORM DEAL STATE (ground truth) ===" + nl;
  s += "Asset type: " + at.toUpperCase() + nl;
  s += "Location: " + (l.address || "address not provided") + ", " + (cityKey ? cityName(cityKey) : "city not provided") + ", " + (l.postcode || "postcode not provided") + nl;
  s += "Planning: " + (p.status || "status not provided") + (p.lpa ? " — LPA " + p.lpa : "") + (num(p.units) ? " — " + num(p.units) + " units consented/proposed" : "") + nl;
  s += "Site: " + (num(m.acres) ? num(m.acres) + " acres" : "acreage not provided") + ", " + (num(m.units) ? num(m.units) + " units" : "unit count not provided") + ", avg " + (num(m.avgSqft) || "?") + " sqft/unit" + nl;
  s += "Land price asking/agreed: " + (num(m.landPrice) ? fmt(m.landPrice) : "not provided") + nl;
  if(landOnly){
    s += "(STAGE SCOPE: this is the LAND APPRAISAL. The development-appraisal inputs — sale £/sqft, build cost, GDV, total cost, finance, S106, residual land value, developer margin/ROC and build:sale ratio — are OUT OF SCOPE here and have been deliberately withheld from this prompt. They are decided at later stages. Do NOT estimate, request, reconstruct or comment on any of them. Judge the LAND only: planning status/certainty, acreage, tenure, contamination, location and the asking price against the £/acre band in the task below.)" + nl + nl;
  } else {
    s += "Sale price input: £" + Math.round(num(m.salePsf)) + "/sqft" + nl;
    s += "Build cost input: £" + Math.round(num(m.buildPsf)) + "/sqft" + nl;
    s += "GDV (Landform): " + fmt(m.gdv) + " [source: " + m.gdvSource + "]" + nl;
    s += "Development cost (Landform): " + fmt(m.devCost) + " (build " + fmt(m.buildCost) + ", fees " + fmt(m.fees) + ", contingency " + fmt(m.contingency) + ", S106 " + fmt(m.s106) + ", finance " + fmt(m.finance) + " @ " + pct(m.finRate) + (num(m.roads) ? ", roads " + fmt(m.roads) : "") + (num(m.infra) ? ", site infra " + fmt(m.infra) : "") + ")" + nl;
    s += "Target profit ASSUMPTION (used only to back-solve the maximum land bid — NOT the deal's return): " + fmt(m.profit) + " at " + pct(m.profitPctTarget) + " of GDV" + nl;
    s += "RESIDUAL LAND VALUE (Landform, gross of purchase costs): " + fmt(m.rlv) + nl;
    if(num(m.totalAcqCosts)) s += "Net land bid (after SDLT/legal/agent/land finance " + fmt(m.totalAcqCosts) + "): " + fmt(m.netLandBid) + nl;
    // v10.15 — lead with the ACTUAL profit/margin at the CURRENT land price. The AI was quoting
    // the target-profit assumption (e.g. 17.5%) instead of the deal's real return (e.g. 31.2%).
    if(num(m.sellProfit))
      s += "ACTUAL PROFIT & MARGIN at the current land price — QUOTE THIS as the deal's return: " + fmt(m.sellProfit) + " (" + pct(m.sellMarginPct) + " of GDV)" + nl;
    s += "Implied margin on GDV: " + pct(m.marginPct) + " | ROC: " + pct(m.roc) + " | build:sale " + pct(m.buildSaleRatio) + " (" + m.buildSaleVerdict + ")" + nl;
    var _alloc = (typeof exitAllocationSummary === "function") ? exitAllocationSummary(data) : [];
    if(_alloc.length > 1){
      s += "EXIT / BUYER ALLOCATION (who each home is sold to — this is the planned mixed exit; honour it):" + nl;
      _alloc.forEach(function(a){ s += "  - " + a.units + " unit(s) → " + a.label + " (" + Math.round(a.mvPct*100) + "% of MV): realisable " + fmt(a.realisable) + nl; });
    }
    s += nl;
  }

  if(!landOnly){
    s += "=== MARKET BENCHMARKS (for cross-check only — these are NOT the deal's figures) ===" + nl;
    if(lrPsf > 0) s += "Land Registry weighted avg (ALL stock, this postcode): £" + Math.round(lrPsf) + "/sqft" + (nb ? "; new-build estimate £" + nb.newBuild + "/sqft (+" + nb.premiumPct + "% regional premium)" : "") + nl;
    else s += "No Land Registry £/sqft on file for this location — treat sale-price assumptions as unverified against comparables." + nl;
    if(bm) s += "Regional benchmark (" + cityName(cityKey) + "): build £" + bm.build + "/sqft, BTR rent ~£" + bm.btr + "/unit pcm, PBSA ~£" + bm.pbsa + "/bed/wk, market yield " + pct(bm.yield * 100) + nl;
    s += "Reference defaults: institutional yield ceiling 5.0%; UK SFH build £165-200/sqft, BTR £210-260/sqft; fees ~12%, contingency ~5%, finance ~7-8%, target profit 15-17.5% on GDV." + nl + nl;
  }

  if(landOnly){
    s += "=== AUTO-FLAGGED DEVIATIONS ===" + nl + "At the land stage the development appraisal (GDV / cost / RLV / margin) is NOT assessed, so no finance deviations are raised here. If planning status or site acreage is missing, make confirming it the headline DD priority before any value work." + nl + nl;
  } else if(flags.length){
    s += "=== AUTO-FLAGGED DEVIATIONS (address each explicitly — do not skip) ===" + nl;
    flags.forEach(function(fl, i){ s += (i + 1) + ". " + fl + nl; });
    s += nl;
  } else {
    s += "=== AUTO-FLAGGED DEVIATIONS ===" + nl + "No material deviations from benchmark detected in the figures above. Still verify any figure the user has not evidenced." + nl + nl;
  }

  s += "=== YOUR TASK ===" + nl;
  var focus = STAGE_FOCUS[focusKey];
  if(focus){
    s += focus + nl;
    if(landOnly){
      s += "Stay strictly at the land level. The development-appraisal figures have been withheld on purpose — do NOT estimate, reconstruct or ask for GDV, build cost, sale £/sqft, RLV, S106 or margin. Answer only the land question below." + nl + nl;
    } else {
      s += "The DEAL STATE above is context for cross-checking only — do NOT re-run the whole appraisal. Keep your answer centred on THIS stage. If a downstream figure (e.g. GDV, build cost, margin, unit mix, yield) clearly looks wrong, raise it in ONE short 'Watch-outs for later stages' line at the very end — do not lead with it or expand it into a full appraisal." + nl + nl;
    }
  }
  s += taskInstruction;
  return s;
}

function lookupPostcode(pc){
  var clean=(pc||"").toUpperCase().replace(/\s/g,"");
  for(var len=4;len>=2;len--){
    var key=clean.substring(0,len);
    if(PC_CITY[key])return{city:PC_CITY[key],salePsf:PC_PSF[key]||null};
  }
  return null;
}

// ──────────────────────────────────────────────────────────────────────────
// NEW-BUILD PREMIUM (v9.28)
// Land Registry returns a weighted average across ALL housing stock — including
// 100-year-old terraces and mid-century semis. For NEW-BUILD development
// viability, you need the new-build comparable price, which carries a premium
// for: EPC A/B rating, NHBC warranty, modern layouts, no chain, lower running
// costs. Source: Savills/Knight Frank/JLL annual new-build premium reports.
// ──────────────────────────────────────────────────────────────────────────
var NEW_BUILD_PREMIUM = {
  // London + prime commuter belt — highest premium
  "EC":0.25,"WC":0.25,"E ":0.22,"N ":0.22,"NW":0.22,"SE":0.22,"SW":0.22,"W ":0.22,
  // South East
  "TW":0.22,"KT":0.22,"SM":0.20,"CR":0.20,"BR":0.20,"DA":0.20,"RM":0.18,"IG":0.18,
  "EN":0.20,"HA":0.20,"UB":0.20,"WD":0.22,"AL":0.22,"HP":0.22,"SL":0.22,
  // Home Counties + commuter
  "GU":0.20,"RG":0.20,"OX":0.20,"MK":0.18,"LU":0.18,"SG":0.20,"CM":0.20,"SS":0.18,
  "CO":0.18,"IP":0.16,"NR":0.16,"PE":0.16,"CB":0.20,"CT":0.18,"ME":0.18,"TN":0.20,
  "BN":0.20,"PO":0.18,"RH":0.20,"SO":0.18,"BH":0.18,"DT":0.16,"BA":0.16,"SP":0.16,
  // South West
  "EX":0.16,"PL":0.15,"TQ":0.16,"TR":0.16,"TA":0.15,"BS":0.18,"GL":0.18,"NP":0.15,
  "CF":0.15,"SA":0.13,"LL":0.12,"LD":0.12,"SY":0.13,
  // Midlands
  "B ":0.16,"CV":0.16,"WS":0.15,"WV":0.15,"DY":0.15,"NN":0.16,"LE":0.15,"DE":0.15,
  "NG":0.15,"LN":0.14,"DN":0.14,"S ":0.14,"ST":0.14,"TF":0.14,"WR":0.16,"HR":0.14,
  // Yorkshire + NE
  "LS":0.15,"BD":0.13,"WF":0.14,"HD":0.13,"HX":0.13,"HG":0.15,"YO":0.15,"HU":0.13,
  "DL":0.13,"DH":0.13,"NE":0.14,"SR":0.13,"TS":0.13,
  // North West
  "M ":0.18,"BL":0.14,"WN":0.14,"OL":0.14,"SK":0.16,"WA":0.16,"L ":0.16,"PR":0.14,
  "BB":0.13,"FY":0.13,"LA":0.13,"CA":0.13,"CW":0.15,"CH":0.16,
  // Scotland
  "EH":0.16,"G ":0.15,"KA":0.13,"PA":0.13,"ML":0.13,"FK":0.14,"KY":0.13,"DD":0.14,
  "AB":0.14,"IV":0.12,"PH":0.13,"PA1":0.13,"PA2":0.13,
  // N Ireland
  "BT":0.12
};
var NEW_BUILD_PREMIUM_DEFAULT = 0.17;  // UK average if region not matched

// Returns the expected NEW BUILD sale £/sqft based on Land Registry baseline
// + a region-specific premium. Returns {existing, newBuild, premiumPct, source}.
function newBuildPsf(pc, baseSalePsf){
  if(!baseSalePsf || baseSalePsf <= 0) return null;
  var clean = String(pc||"").toUpperCase().replace(/\s/g,"");
  var premium = NEW_BUILD_PREMIUM_DEFAULT;
  // Try longer prefixes first for accuracy
  for(var len=3;len>=1;len--){
    var key = clean.substring(0,len);
    // Also try with trailing space for single-letter areas (e.g. "B " for Birmingham)
    if(NEW_BUILD_PREMIUM[key] !== undefined){ premium = NEW_BUILD_PREMIUM[key]; break; }
    if(NEW_BUILD_PREMIUM[key+" "] !== undefined){ premium = NEW_BUILD_PREMIUM[key+" "]; break; }
  }
  return {
    existing: Math.round(baseSalePsf),
    newBuild: Math.round(baseSalePsf * (1 + premium)),
    premiumPct: Math.round(premium * 100),
    source: "Land Registry weighted average + regional new-build premium"
  };
}

// Returns true if the scheme produces NEW housing stock (vs refurb / existing asset)
function isNewBuildScheme(assetType){
  var at = (assetType||"").toLowerCase();
  return at === "sfh" || at === "btr" || at === "pbsa";
}

function logEvent(user,event,details){
  try{
    var detailStr=typeof details==="object"?JSON.stringify(details).substring(0,400):String(details).substring(0,400);
    var params=new URLSearchParams({
      action:"log",
      token:WEBHOOK_TOKEN,
      timestamp:new Date().toISOString(),
      user:(user&&user.name)||"Unknown",
      company:(user&&user.company)||"Unknown",
      role:(user&&user.role)||"demo",
      event:event,
      details:detailStr,
      userAgent:navigator.userAgent.substring(0,80),
      url:window.location.href,
      sessionId:window._sessionId||"unknown"
    });
    fetch(WEBHOOK+"?"+params.toString()).catch(function(){});
  }catch(e){}
}

// Generate session ID on load for tracking individual sessions
window._sessionId = (function(){
  var id = sessionStorage.getItem("clf_sid");
  if(!id){id=Date.now().toString(36)+Math.random().toString(36).substr(2,5);sessionStorage.setItem("clf_sid",id);}
  return id;
})();

// Track time on each page
window._pageStart = Date.now();
window._currentStage = "";

async function callAI(user,stage,systemPrompt,userPrompt){
  logEvent(user,"AI_ANALYSIS",{
    stage:stage,
    journey:(typeof journey!=="undefined"?journey:"unknown"),
    promptLength:userPrompt?userPrompt.length:0,
    time:new Date().toLocaleTimeString("en-GB")
  });
  // POST avoids URL length limits AND CORS preflight (text/plain content-type is a simple request).
  // Apps Script accepts both GET and POST for action=ai now.
  var body = {
    action:"ai", stage:stage, token:WEBHOOK_TOKEN,
    user:(user&&user.name)||"", company:(user&&user.company)||"",
    system:(systemPrompt||"You are a senior UK real estate development advisor. Be specific, commercially sharp, use UK conventions. Plain text only.").substring(0,2000),
    prompt:userPrompt.substring(0,12000)  // doubled — POST has no URL limit
  };
  try {
    var res=await fetch(WEBHOOK,{
      method:"POST",
      headers:{"Content-Type":"text/plain;charset=utf-8"},  // simple request — avoids CORS preflight
      body:JSON.stringify(body)
    });
    var data=await res.json();
    if(data && data.status==="ok" && data.result){
      return data.result;
    }
    // Backend returned an error message — surface it for debugging
    console.error("AI call returned error:", data);
    if(data && data.message){
      return "Analysis failed: "+data.message;
    }
    return "Analysis failed — please try again";
  } catch(err) {
    console.error("AI fetch failed:", err);
    return "Analysis failed — network error. Check connection.";
  }
}

// ── NON-BLOCKING TOAST ──────────────────────────────────────────────────────
// Replaces native alert(), which blocks the whole renderer until dismissed — and
// freezes any automated/embedded browser for as long as the dialog is up (it read
// as a 60-90s crash in review). Vanilla DOM so it can be called from anywhere;
// click to dismiss, auto-dismisses after a few seconds. Never throws.
function notify(msg, opts){
  opts = opts || {};
  try {
    if(typeof document === "undefined" || !document.body) return;
    var host = document.getElementById("lf-toast-host");
    if(!host){
      host = document.createElement("div");
      host.id = "lf-toast-host";
      host.style.cssText = "position:fixed;top:16px;right:16px;z-index:99999;display:flex;flex-direction:column;gap:8px;max-width:min(440px,92vw);font-family:DM Sans,sans-serif;";
      document.body.appendChild(host);
    }
    var bad = /\bfail|error|couldn|could not|invalid|too large|not signed|no deal|allow pop|corrupt|unable/i.test(String(msg));
    var t = document.createElement("div");
    t.style.cssText = "background:"+(bad?"#7A3A20":"#1E1F5C")+";color:#fff;padding:11px 14px;border-radius:8px;font-size:12.5px;line-height:1.5;box-shadow:0 4px 18px rgba(0,0,0,.22);white-space:pre-line;cursor:pointer;opacity:0;transform:translateY(-6px);transition:opacity .2s ease,transform .2s ease;";
    t.textContent = String(msg);
    t.onclick = function(){ if(t.parentNode) t.parentNode.removeChild(t); };
    host.appendChild(t);
    void t.offsetWidth;
    t.style.opacity = "1"; t.style.transform = "translateY(0)";
    var ms = opts.ms || Math.min(9000, 3500 + String(msg).length * 30);
    setTimeout(function(){
      t.style.opacity = "0"; t.style.transform = "translateY(-6px)";
      setTimeout(function(){ if(t.parentNode) t.parentNode.removeChild(t); }, 260);
    }, ms);
  } catch(err){ /* a notification must never break the caller */ }
}

// Non-blocking confirm — a toast carrying Confirm / Cancel buttons, so a destructive
// action keeps its guard WITHOUT the native confirm() that freezes the renderer (and
// any automated/embedded browser). Runs onConfirm() only if the user clicks Confirm.
// If there's no DOM (headless), it proceeds (matches the old confirm-less test path).
function confirmToast(msg, onConfirm, opts){
  opts = opts || {};
  try {
    if(typeof document === "undefined" || !document.body){ if(onConfirm) onConfirm(); return; }
    var host = document.getElementById("lf-toast-host");
    if(!host){
      host = document.createElement("div");
      host.id = "lf-toast-host";
      host.style.cssText = "position:fixed;top:16px;right:16px;z-index:99999;display:flex;flex-direction:column;gap:8px;max-width:min(440px,92vw);font-family:DM Sans,sans-serif;";
      document.body.appendChild(host);
    }
    var t = document.createElement("div");
    t.style.cssText = "background:#1E1F5C;color:#fff;padding:12px 14px;border-radius:8px;font-size:12.5px;line-height:1.5;box-shadow:0 4px 18px rgba(0,0,0,.25);white-space:pre-line;";
    var m = document.createElement("div"); m.textContent = String(msg); m.style.marginBottom = "10px"; t.appendChild(m);
    var bar = document.createElement("div"); bar.style.cssText = "display:flex;gap:8px;justify-content:flex-end;";
    var no = document.createElement("button"); no.textContent = opts.cancelLabel || "Cancel";
    no.style.cssText = "padding:5px 12px;border:1px solid rgba(255,255,255,.4);background:transparent;color:#fff;border-radius:5px;font-size:11px;font-weight:700;cursor:pointer;font-family:DM Sans,sans-serif;";
    var yes = document.createElement("button"); yes.textContent = opts.confirmLabel || "Confirm";
    yes.style.cssText = "padding:5px 12px;border:none;background:#B05A35;color:#fff;border-radius:5px;font-size:11px;font-weight:800;cursor:pointer;font-family:DM Sans,sans-serif;";
    function close(){ if(t.parentNode) t.parentNode.removeChild(t); }
    no.onclick = close;
    yes.onclick = function(){ close(); try { if(onConfirm) onConfirm(); } catch(e){} };
    bar.appendChild(no); bar.appendChild(yes); t.appendChild(bar);
    host.appendChild(t);
  } catch(err){ if(onConfirm) onConfirm(); }
}

// ── UI HELPERS ────────────────────────────────────────────────────────────────
var e=React.createElement;
var S={
  card:{background:"#fff",border:"1px solid #DDE0ED",borderRadius:10,padding:20,marginBottom:16,className:"lf-card"},
  cardTitle:{fontSize:10,color:"#4A4BAE",textTransform:"uppercase",letterSpacing:".14em",fontWeight:700,paddingBottom:12,borderBottom:"1px solid #DDE0ED",marginBottom:14},
  grid2:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14},
  label:{fontSize:10,color:"#7278A0",textTransform:"uppercase",letterSpacing:".1em",fontWeight:600,display:"block",marginBottom:4},
  input:{padding:"8px 11px",border:"1px solid #C8CDE0",borderRadius:6,fontSize:13,fontFamily:"DM Sans,sans-serif",outline:"none",background:"#fff",color:"#1A1A3E",width:"100%",boxSizing:"border-box"},
  select:{padding:"8px 11px",border:"1px solid #C8CDE0",borderRadius:6,fontSize:13,fontFamily:"DM Sans,sans-serif",background:"#fff",color:"#1A1A3E",outline:"none",width:"100%"},
  btn:{padding:"9px 18px",background:"rgba(74,75,174,0.08)",border:"1px solid #4A4BAE",color:"#4A4BAE",borderRadius:6,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif",display:"flex",alignItems:"center",gap:7},
  resultGreen:{background:"rgba(45,122,101,0.08)",border:"2px solid #2D7A65",borderRadius:8,padding:16,textAlign:"center"},
  resultAmber:{background:"rgba(154,123,62,0.08)",border:"2px solid #9A7B3E",borderRadius:8,padding:16,textAlign:"center"},
  resultRed:{background:"rgba(176,90,53,0.08)",border:"2px solid #B05A35",borderRadius:8,padding:16,textAlign:"center"},
  tag:{fontSize:9,textTransform:"uppercase",letterSpacing:".1em",fontWeight:700},
  bigNum:{fontSize:32,fontWeight:800,lineHeight:1,marginBottom:6},
};

