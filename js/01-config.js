var useState = React.useState;
var useEffect = React.useEffect;

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
var CURRENT_VERSION = "9.79";
var VERSION_HISTORY = [
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


// HOUSE_TYPES — each: beds, typical sqft (GIA), adj (sale £/sqft multiplier vs the
// 3-bed-semi baseline), and build (BCIS-style 2026 UK new-build CONSTRUCTION cost
// £/sqft GIA, standard spec, before regional index and Tier-1 main-contractor
// uplift, and excluding land/fees/externals/contingency). Used to auto-cost each
// house type at appraisal stage — a benchmark to validate with a QS/contractor.
var HOUSE_TYPES = {
  // ── Apartments / flats (new-build) ──
  "Studio apartment":{beds:0,sqft:330,adj:0.58,build:215},
  "1-bed apartment":{beds:1,sqft:520,adj:0.72,build:210},
  "2-bed apartment":{beds:2,sqft:680,adj:0.85,build:210},
  "3-bed apartment":{beds:3,sqft:900,adj:1.02,build:215},
  "2-bed penthouse":{beds:2,sqft:950,adj:1.20,build:245},
  "3-bed penthouse":{beds:3,sqft:1300,adj:1.35,build:255},
  // ── Conversion flats (stately home / office / pub converted to flats) ──
  "Conversion studio":{beds:0,sqft:380,adj:0.60,build:150},
  "Conversion 1-bed flat":{beds:1,sqft:560,adj:0.78,build:150},
  "Conversion 2-bed flat":{beds:2,sqft:800,adj:0.92,build:150},
  "Conversion 3-bed flat":{beds:3,sqft:1100,adj:1.08,build:155},
  "Conversion duplex":{beds:3,sqft:1300,adj:1.18,build:165},
  // ── Maisonettes / coach houses ──
  "1-bed maisonette":{beds:1,sqft:600,adj:0.80,build:180},
  "2-bed maisonette":{beds:2,sqft:820,adj:0.92,build:180},
  "Coach house 2-bed":{beds:2,sqft:700,adj:0.88,build:185},
  // ── Terraces ──
  "1-bed terrace":{beds:1,sqft:550,adj:0.75,build:165},
  "2-bed terrace":{beds:2,sqft:720,adj:0.88,build:165},
  "3-bed terrace":{beds:3,sqft:920,adj:0.95,build:170},
  "4-bed terrace":{beds:4,sqft:1180,adj:1.10,build:175},
  // ── Mews / townhouses ──
  "2-bed mews":{beds:2,sqft:900,adj:0.98,build:180},
  "3-bed mews":{beds:3,sqft:1050,adj:1.05,build:185},
  "3-bed townhouse":{beds:3,sqft:1300,adj:1.15,build:190},
  "4-bed townhouse":{beds:4,sqft:1650,adj:1.26,build:200},
  // ── Semi-detached ──
  "2-bed semi":{beds:2,sqft:820,adj:0.90,build:165},
  "3-bed semi":{beds:3,sqft:1020,adj:1.00,build:170},
  "4-bed semi":{beds:4,sqft:1300,adj:1.14,build:180},
  // ── Link-detached ──
  "3-bed link-detached":{beds:3,sqft:1100,adj:1.05,build:180},
  "4-bed link-detached":{beds:4,sqft:1350,adj:1.16,build:188},
  // ── Detached ──
  "3-bed detached":{beds:3,sqft:1150,adj:1.08,build:185},
  "4-bed detached":{beds:4,sqft:1500,adj:1.18,build:195},
  "4-bed executive":{beds:4,sqft:1900,adj:1.28,build:230},
  "5-bed detached":{beds:5,sqft:2400,adj:1.40,build:215},
  "5-bed executive":{beds:5,sqft:2900,adj:1.52,build:260},
  "6-bed detached":{beds:6,sqft:3400,adj:1.65,build:245},
  // ── Bungalows ──
  "Bungalow 2-bed":{beds:2,sqft:800,adj:1.05,build:190},
  "Bungalow 3-bed":{beds:3,sqft:1050,adj:1.12,build:198},
  // ── Prime / large country houses ──
  "Manor house":{beds:6,sqft:4500,adj:1.90,build:320},
  "Mansion":{beds:8,sqft:6500,adj:2.20,build:380},
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
  return (pcd && pcd.city) ? pcd.city : c;
}
// areaRentPcm — correct monthly rent for a given bedroom count in the DEAL's area
// (city or postcode). Anchored on the local typical (3-bed) rent; returns 0 if the
// area has no rent benchmark so callers can fall back. Always editable downstream.
function areaRentPcm(data, beds){
  var mk = MKT[dealCityKey(data)];
  if(!mk || !mk.btr) return 0;
  var b = Math.max(0, Math.min(6, Math.round(num(beds) || 3)));
  return Math.round(mk.btr * (RENT_BED_FACTOR[b] != null ? RENT_BED_FACTOR[b] : 1));
}
// UK region for the deal's area — used to label regional build-cost benchmarks correctly
// (e.g. Maldon → "East of England", not a hard-coded "Worcestershire / South West").
var UK_REGION_BY_CITY = {
  london:"London",
  manchester:"North West", liverpool:"North West", chester:"North West",
  newcastle:"North East",
  leeds:"Yorkshire & Humber", sheffield:"Yorkshire & Humber", york:"Yorkshire & Humber", harrogate:"Yorkshire & Humber", hull:"Yorkshire & Humber", wakefield:"Yorkshire & Humber", doncaster:"Yorkshire & Humber",
  birmingham:"West Midlands", coventry:"West Midlands", worcester:"West Midlands",
  nottingham:"East Midlands", leicester:"East Midlands", derby:"East Midlands", northampton:"East Midlands",
  bristol:"South West", bath:"South West", exeter:"South West", plymouth:"South West", truro:"South West", torquay:"South West", taunton:"South West", bridgwater:"South West", yeovil:"South West", tewkesbury:"South West", bournemouth:"South West",
  oxford:"South East", reading:"South East", brighton:"South East", guildford:"South East", woking:"South East", canterbury:"South East", maidstone:"South East", tunbridge_wells:"South East", southampton:"South East", portsmouth:"South East", milton_keynes:"South East",
  cambridge:"East of England", chelmsford:"East of England", maldon:"East of England", colchester:"East of England", basildon:"East of England", chigwell:"East of England", brentwood:"East of England", southend:"East of England", peterborough:"East of England", stevenage:"East of England", st_albans:"East of England", watford:"East of England",
  edinburgh:"Scotland", glasgow:"Scotland", aberdeen:"Scotland", dundee:"Scotland", inverness:"Scotland",
  cardiff:"Wales", swansea:"Wales"
};
function ukRegionFor(data){
  var c = (typeof dealCityKey === "function") ? dealCityKey(data) : "";
  return UK_REGION_BY_CITY[c] || "UK (national average)";
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
  var cityKey = (sfh.city || l.city || "").toLowerCase();
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
  var effectiveBlended = hasNonPrivate ? blendedGdv : (ahFactor < 1 ? retailGdv * ahFactor : retailGdv);

  // v9.47 — Canonical GROSS cost stack + residual, mirroring the SFH House Mix
  // screen exactly so every screen and the AI quote the same RLV. Acquisition
  // costs (SDLT/legals/agent) are NOT included here — they are layered on later
  // as the "net land bid". 'buildInclusive' = the user's build £/sqft already
  // covers roads/drainage/site infrastructure, so those lines are zeroed to
  // avoid double-counting (the optional-cost behaviour the user asked for).
  var sfhAcres = num(sfh.acres) || num(l.acres);   // inherit site area from Land Appraisal when not set on SFH
  var buildInclusive = !!sfh.buildInclusive;
  var sfhFees = buildCost * 0.10;
  var sfhContingency = buildCost * (numOr(sfh.contingency, 5) / 100);
  var sfhFinance = (buildCost + sfhFees) * (numOr(sfh.finRate, 7.5) / 100);
  var sfhS106 = totalUnits * numOr(sfh.s106pu, 8000);
  var sfhRoads = buildInclusive ? 0 : totalUnits * numOr(sfh.roads, 12000);
  var sfhInfra = buildInclusive ? 0 : sfhAcres * 53000;
  var sfhProfit = effectiveBlended * (numOr(sfh.profitPct, 17.5) / 100);
  var sfhDevCost = buildCost + sfhFees + sfhContingency + sfhFinance + sfhS106 + sfhRoads + sfhInfra;
  var sfhGrossRlv = effectiveBlended - sfhDevCost - sfhProfit;

  return {rows:rows,totalUnits:totalUnits,avgSqft:totalUnits>0?totalSqft/totalUnits:0,retailGdv:retailGdv,blendedGdv:effectiveBlended,gdv:effectiveBlended,ahFactor:ahFactor,buildCost:buildCost,hasNonPrivate:hasNonPrivate,basePsf:basePsf,buildPsf:buildPsf,
    acres:sfhAcres,buildInclusive:buildInclusive,fees:sfhFees,contingency:sfhContingency,finance:sfhFinance,s106:sfhS106,roads:sfhRoads,infra:sfhInfra,profit:sfhProfit,devCost:sfhDevCost,rlv:sfhGrossRlv};
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
  [["planning","units"],["land","units"],["rlv","units"],["fin","units"]],
  // ── Affordable housing % ──
  [["planning","ahPct"],["sfh","ahPct"],["tenure","ahPct"]],
  // ── Sale £/sqft (houses path; different key name per stage) ──
  [["sfh","basePsf"],["rlv","salePsf"]],
  // ── Development cost assumptions (houses / finance cluster only) ──
  [["sfh","buildPsf"],["fin","buildPsf"],["rlv","buildPsf"]],
  [["sfh","profitPct"],["fin","profitPct"],["rlv","profitPct"]],
  [["sfh","finRate"],["fin","finRate"],["rlv","finRate"]],
  [["sfh","contingency"],["fin","contingency"],["rlv","contingency"]],
  [["sfh","s106pu"],["fin","s106pu"],["planning","s106pu"],["rlv","s106pu"]],
  [["sfh","buildInclusive"],["fin","buildInclusive"],["rlv","buildInclusive"]],
  // ── Exit / capitalisation yield (stored as a % on each stage) — two-way ──
  [["capitalise","targetYield"],["fin","exitYield"]]
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
function normalizeSharedFields(data){
  if(!data || typeof data !== "object") return data;
  var next = Object.assign({}, data);
  function getv(sec, k){ var o = next[sec]; if(!o) return undefined; var v = o[k]; return (v === undefined || v === null || v === "") ? undefined : v; }
  SHARED_FIELD_GROUPS.forEach(function(group){
    var canon;
    for(var i = 0; i < group.length; i++){ var v = getv(group[i][0], group[i][1]); if(v !== undefined){ canon = v; break; } }
    if(canon === undefined) return;
    group.forEach(function(t){
      if(getv(t[0], t[1]) === undefined){ var o = Object.assign({}, next[t[0]] || {}); o[t[1]] = canon; next[t[0]] = o; }
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
  var omsUnitPrice = numOr(t.omsUnitPrice, basePsf * avgSqft);
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
  var cityKey = (l.city || sfh.city || rlvD.city || "").toLowerCase();
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
  var roads = 0, infra = 0;
  if (at === "sfh" && sfhMetrics.totalUnits > 0) {
    buildCost   = sfhMetrics.buildCost;
    fees        = sfhMetrics.fees;
    contingency = sfhMetrics.contingency;
    finance     = sfhMetrics.finance;
    s106        = sfhMetrics.s106;
    roads       = sfhMetrics.roads;
    infra       = sfhMetrics.infra;
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
  var devCost = buildCost + fees + contingency + s106 + finance + roads + infra;
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
    roads: roads, infra: infra,
    devCost: devCost,
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
  var cityKey = ((sfh.city) || (data.land && data.land.city) || "").toLowerCase();
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
        note:"If your build £/sqft already includes roads, drainage and site infrastructure, tick 'build is all-in' — that alone adds "+(Math.round((rlvAllIn-base.rlv)/1000))+"k to the residual." };
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
  var cityKey = (l.city || (data.sfh && data.sfh.city) || (data.rlv && data.rlv.city) || "").toLowerCase();
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
    s += "Target developer profit: " + fmt(m.profit) + " (" + pct(m.profitPctTarget) + " of GDV)" + nl;
    s += "RESIDUAL LAND VALUE (Landform, gross of purchase costs): " + fmt(m.rlv) + nl;
    if(num(m.totalAcqCosts)) s += "Net land bid (after SDLT/legal/agent/land finance " + fmt(m.totalAcqCosts) + "): " + fmt(m.netLandBid) + nl;
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

