# Maldon — Forward-Fund Appraisal (Land South of Howells Farm)

**Scheme:** forward-fund / forward-commit to a housing association (**Delta** — the
ex-CHP/Estuary merger, 17,000 homes in Essex — and/or **Latimer / Clarion**) who may
take the **Section 106 + extra affordable (~50%)** or **all 500 units** on rent.
**Cases:** Site 1 = 200 units · Sites 1+2+3 ≈ 500 units (200 + ~300 on the extra
30-acre parcel).
**Engine:** every figure comes from the **real Landform engine** —
`computeForwardFundMetrics` / `developmentFinanceCost` / `calcDealMetrics` in
`js/01-config.js`. Reproduce with `node analysis/maldon-forward-fund.js`.

Inputs are now the **real figures from the 16–19 June 2026 emails / brief**. The one
thing still **MODELLED** is the *number of units per type/tenure* (no email gives a
scheme mix) — a representative 50% market-PRS / 50% affordable split is used.

---

## Inputs (from the brief)

| Lever | Value | Source |
|---|---|---|
| Rents | Beresfords (Danny) market table — 2-bed £1,650 → 4-bed £2,750/mo | 18 Jun email |
| Management (gross→net) | 25% | Patric |
| Capitalisation yield | 4.5% (also test 4.0–5.0%) | Patric |
| Build | £250/sqft base; **HA low-carbon spec on affordable** (CHP D&C brief, NDSS — Delta requirement) | Caddick / Delta |
| Sale value | £450/sqft (new-build comps £350–470) | John Baker |
| Bulk-sale | £212/sqft | Landform |
| S106 | £10,000/unit | Patric |
| Finance | 10%, 4-yr (1-yr planning + 3-yr build) | Patric |
| Profit | 17.5% **on cost** | brief |
| Landowner ask | £14.0m incl. hope value (**John Baker thinks ~£12.0m realistic**) | John Baker |
| Acreage | ~20 ac (Site 1) / ~50 ac (1+2+3) — **estimate** at ~10 units/acre | — |

> Affordable rents modelled at **Affordable Rent ≈ 80%** and **Social Rent ≈ 55%** of
> the comparable Beresfords market rent (no affordable rents were given).

---

## Results — forward-fund, whole scheme on rent, 50% affordable

### Site 1 — 200 units (100 affordable / 100 market-PRS)

| Step | | £ |
|---|---|---:|
| 1 | Gross rent / yr | £4,246,920 |
| 2 | less 25% management | −£1,061,730 |
|   | **Net rent / yr** | **£3,185,190** |
| 3 | **GDV** (net ÷ 4.5%) | **£70.78m** |
| 4 | Build @ £250/sqft (market £29.59m + affordable £21.00m w/ HA spec) | £50.60m |
| 5 | S106 @ £10k/unit | £2.00m |
| 6 | Finance @ 10% (1+3yr, multi-year roll-up) | £9.06m |
|   | **Total development cost** | **£61.66m** |
| 7 | Profit @ 17.5% on cost | £10.79m |
| **8** | **RESIDUAL LAND VALUE** | **−£1.67m** (−£8.3k/unit) |

### Sites 1+2+3 — ~500 units (251 affordable / 251 market-PRS)

| Step | | £ |
|---|---|---:|
| 1 | Gross rent / yr | £10,659,528 |
| 2 | less 25% management | −£2,664,882 |
|   | **Net rent / yr** | **£7,994,646** |
| 3 | **GDV** (net ÷ 4.5%) | **£177.66m** |
| 4 | Build @ £250/sqft (market £74.29m + affordable £52.72m w/ HA spec) | £127.01m |
| 5 | S106 @ £10k/unit | £5.02m |
| 6 | Finance @ 10% (1+3yr) | £22.74m |
|   | **Total development cost** | **£154.77m** |
| 7 | Profit @ 17.5% on cost | £27.08m |
| **8** | **RESIDUAL LAND VALUE** | **−£4.19m** (−£8.4k/unit) |

*`calcDealMetrics` reconciles exactly with the engine on both cases: GDV ✓ RLV ✓.*

---

## Cross-checks — different ways to value the same scheme

| Route | 200 units RLV | 500 units RLV |
|---|---:|---:|
| **A. Forward-fund 50% aff / 50% PRS on rent @4.5%** (headline) | **−£1.67m** | **−£4.19m** |
| **B. 100% market-rent BTR forward-fund @4.5%** (upper bound) | **£12.30m** | **£30.87m** |
| **C. 100% private SALE @ £450/sqft** (SFH engine) | **£8.88m** | **£22.29m** |
| _brief's prior Landform viability (all-sale)_ | _~£9–10m_ ✅ | — |

**Route C lands on £8.88m — bang on the brief's prior "£9–10m" all-sale figure**,
which validates the engine against the existing Landform work.

Patric's own note ("net rent ~£3m capitalised at 5% ≈ £60m bid") was an
**affordable-led** cross-check. This scheme's *whole-scheme* net rent is £7.99m (500u)
→ at 5% that's GDV £159.9m, i.e. far above £60m because it includes the market-rent
half; the £60m figure is consistent with valuing only the **affordable** element.

---

## What this means

1. **Forward-funding the WHOLE scheme on rent at 50% affordable does not quite stack**
   at 4.5% / 17.5%-on-cost: −£1.67m (200u), −£4.19m (500u). The affordable half
   (discounted rent **and** a richer HA low-carbon build) is value-dilutive — it
   consumes the land value the market-PRS half generates.
2. **As a market-rent BTR forward-fund it clears the realistic ask**: £12.3m (200u),
   above John Baker's £12m. So the rent route works *if the tenure is mostly market
   rent*, not 50% affordable-at-discount.
3. **The sale route (£450/sqft) gives ~£8.9m (200u)** — healthy, but **below the
   £12–14m ask**, exactly the gap the brief already identified.
4. **No route reaches the £14m headline ask** at base assumptions. £12m realistic is
   reachable on the BTR-market-rent route, or on sale if the private mix/values push
   higher (premium gated >£450/sqft).

**Recommendations (consistent with the brief's own conclusion):**
- Anchor land-price negotiation around **£9–12m**, not £14m.
- Push the **market-rent / BTR proportion up** and the discounted-affordable down,
  or secure **Homes England AHP grant** to underpin the affordable (un-modelled here —
  grant would lift Route A materially).
- Argue a **keener yield (4.0%)** with the HA/funder — at 4.0% the forward-fund is
  near break-even and goes positive with any rent upside (see sensitivity).
- Keep **Tier-1 contractor** and **abnormals/infrastructure** in view (the build here
  is the £250 base; abnormals would reduce RLV further — get Caddick's priced figure).

---

## Sensitivity — RLV by capitalisation yield × rent level

### 200 units
| Yield \ Rent | −10% | −5% | base | +5% | +10% |
|---|---:|---:|---:|---:|---:|
| 4.00% | −£0.78m | £3.20m | £7.18m | £11.16m | £15.15m |
| 4.25% | −£5.00m | −£1.25m | £2.50m | £6.25m | £9.99m |
| **4.50%** | −£8.74m | −£5.20m | **−£1.67m** | £1.87m | £5.41m |
| 4.75% | −£12.10m | −£8.74m | −£5.39m | −£2.04m | £1.31m |
| 5.00% | −£15.11m | −£11.93m | −£8.74m | −£5.56m | −£2.37m |

### 500 units
| Yield \ Rent | −10% | −5% | base | +5% | +10% |
|---|---:|---:|---:|---:|---:|
| 4.00% | −£1.97m | £8.02m | £18.02m | £28.01m | £38.00m |
| 4.25% | −£12.55m | −£3.15m | £6.26m | £15.66m | £25.07m |
| **4.50%** | −£21.96m | −£13.07m | −£4.19m | £4.69m | £13.57m |
| 4.75% | −£30.37m | −£21.96m | −£13.54m | −£5.13m | £3.29m |
| 5.00% | −£37.95m | −£29.95m | −£21.96m | −£13.96m | −£5.97m |

The forward-fund is **highly geared to yield and rent**: a 0.5% yield move or a 10%
rent move swings the 200-unit residual by ~£7m. Base-case rents are already the
Beresfords market figures, so the upside columns require either higher rents than
Beresfords project or a keener yield.

---

## Tool changes made (and why) — `v9.73`

Three genuine gaps surfaced while reconstructing Patric's method; each fixed in
`js/01-config.js` and locked in by tests (`tests/run.js` cases 32–33, **211 pass**):

1. **No rent-capitalised whole-scheme route.** Added **`computeForwardFundMetrics`** —
   values the scheme as an income asset per Patric's 8 steps (gross → net → capitalise).
2. **HA low-carbon spec uplift wasn't in the cost engine.** The v9.72 toggle only moved
   the Build Cost Library *benchmark*; it now reaches the affordable build in a residual.
3. **Finance was a flat one-year `(build+fees) × rate`.** Added **`developmentFinanceCost`**
   — a true multi-year model (planning + S-curve build drawdown, interest rolled up).

Plus **`ff.profitBasis`** so profit can be taken **on cost** (the Howells brief's
"17.5% on cost") as well as on GDV. `calcDealMetrics` adopts the forward-fund GDV/cost
stack for `assetType:"ff"`, so the deal-state and every screen agree (reconciliation ✓).

---

## Still outstanding (to firm up before presenting)
- **Per-tenure unit mix** for each site (the one MODELLED input). Delta indicated S106 +
  extra affordable (~50%) or all 500 — confirm the actual split and any **grant**.
- **Sites 2 & 3** precise unit numbers/areas (currently Site 1 × 2.5).
- **Latimer/Clarion** terms (none in the emails) and which HA actually bids.
- **Caddick's priced build** incl. abnormals/infrastructure and Tier-1 prelims.
- **Acreage per phase** (estimated at ~10 units/acre) for the £/acre check.
