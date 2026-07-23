# Grant-treatment decision note

**Decision owners:** Phil Daniel + Patric
**Settled:** July 2026 (Landform v10.144)
**Setting in the tool:** Grants page → "How the grant is treated across every stage" (`grants.grantTreatment`)

## The question

A Homes England affordable-housing grant (AHP / SAHP) is cash for the affordable
homes. The only real modelling question is **who captures it** — the landowner,
Cassidy, or the affordable units themselves. All three are legitimate; they point
the money at different pockets and produce different land values and margins.

Before v10.144 the tool was inconsistent: the engine (RLV / Quick Appraisal /
Dashboard / one-pager) silently capitalised the grant into the **land value**,
while the SFH House Mix and Detailed Appraisal showed **no grant at all** — so the
same scheme could read two different land values. This note settles it and every
stage now reads one setting.

## The three treatments

Illustrative scheme: 200 homes, 30% affordable, £80m GDV, £60m dev cost (excl.
land), 17.5% profit → **£6.0m** residual land value with no grant. Grant = 40
grant-eligible (additional) homes × £40k = **£1.6m**.

| Treatment | Where the £1.6m goes | Land value (RLV) | Cassidy margin | Landowner |
|---|---|---|---|---|
| **A — `land` (competitive land bid)** | To the landowner | **£7.6m** (+£1.6m) | 17.5% (target) | +£1.6m |
| **B — `margin` (DEFAULT)** | To Cassidy | £6.0m (unchanged) | **19.5%** (+2.0pts) | unchanged |
| **C — `rp` (passed to RP)** | To the affordable units | £6.0m (unchanged) | 17.5% (unchanged) | unchanged |

## What each means

- **A — `land` — competitive-bid tool.** Capitalise the grant into the land price
  so you can outbid on a contested site. *Risk:* the grant isn't secured until you
  have an RP partner and Homes England approval — if it slips or additionality is
  challenged, you've already paid it to the landowner and the deal is underwater at
  that land price.
- **B — `margin` — the prudent default (chosen).** Price the land on the *un-granted*
  residual; treat the grant as margin upside if and when it lands. The deal stacks at
  the land price whether or not the grant comes through. Standing default across the
  whole tool.
- **C — `rp` — how Homes England intends it.** The grant is passported to a Registered
  Provider to make the affordable homes deliverable — subsidy for *affordable delivery*,
  not for land value or developer profit. Neutral to both. The most defensible line if
  a grant application is ever scrutinised.

## The decision

**Default = B (`margin`)** everywhere — never bid up land on subsidy that isn't secured.

**A (`land`) is available as an explicit, clearly-labelled "competitive land bid"** on
the Grants page, so the aggressive number is always a deliberate choice, never a silent
default.

**C (`rp`) is the correct basis whenever the grant is genuinely passed to an RP** — it
shows on the appraisal as neutral to land and margin.

## How it's wired (v10.144)

One resolver, `grantTreatmentMode(data)` in `js/01-config.js`, returns the mode
(default `margin`). Both engines and the exit function split the grant into:

- `grantToRlv` — the £ that reaches the **residual land value**. Non-zero only under `land`.
- `grantToProfit` — the £ that reaches **developer profit** at a given land price. Non-zero
  under `land` and `margin`; zero under `rp`.

Every consumer reads these, so all stages agree:

- `computeSFHMetrics` — SFH RLV adds `grantToRlv`.
- `calcDealMetrics` — Dashboard / Financial Modelling / Scorecard RLV adds `grantToRlv`;
  actual profit adds `grantToProfit`.
- `dealExit` — exit land values add `grantToRlv`.
- SFH House Mix, Land Valuation, Quick Appraisal, one-pager, Financial Modelling appraisal —
  show the grant as a **land credit** under `land`, or a **margin uplift** / **RP pass-through**
  note under `margin` / `rp`.

Verified by the engine test suite (`tests/run.js`): under `land`, RLV lifts by exactly the
grant; under `margin` and `rp` the RLV is unchanged; `grantToProfit` is received under
`land` + `margin` and zero under `rp`.
