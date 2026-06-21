# Maldon — Forward-Fund Appraisal (Land South of Howells Farm)

**Scheme:** forward-fund / forward-commit to a housing association (Delta and/or
Latimer-Clarion) taking the **whole scheme on its rent**.
**Cases:** Site 1 = 200 units · Sites 1+2+3 = 500 units.
**Engine:** every figure below comes from the **real Landform engine** —
`computeForwardFundMetrics` / `developmentFinanceCost` / `calcDealMetrics` in
`js/01-config.js`. Reproduce with `node analysis/maldon-forward-fund.js`.

> ⚠️ **Placeholders.** The rent mix, tenure split and sites-2&3 numbers are
> clearly-labelled Maldon stand-ins pending Patric's email. Rents are **derived
> by the engine** from the Maldon area benchmark (£1,258/mo 3-bed, ONS) × bed
> factor × tenure factor. Swap the real figures into `maldonScheme()` and re-run.

---

## Method (Patric's instruction) — run literally through the engine

| Step | Lever | Value used |
|---|---|---|
| 1 | Realistic rent mix → gross rent | area-derived, ~50% affordable |
| 2 | Less management → net rent | **25%** |
| 3 | Capitalise net rent → GDV | **4.5%** |
| 4 | Build base + HA low-carbon spec on affordable | **£250/sqft** + ~12% on affordable |
| 5 | Less S106 | **£10,000/unit** |
| 6 | Finance — true multi-year | **10%**, 1-yr planning + 3-yr build |
| 7 | Developer profit | **17.5%** of GDV |
| 8 | = Residual land value | output |

Patric's literal 8-step stack carries **no separate professional-fees or
contingency line**, so the headline reconciles with his method (fees/contingency
default to 0 in the forward-fund engine). A full Landform dev appraisal would add
~10% fees + 5% contingency — shown as a cross-check below.

---

## Results

### Site 1 — 200 units (50% affordable: 100 affordable / 100 private-PRS)

| | £ |
|---|---:|
| **1. Gross rent / yr** | £2,773,739 |
| **2. less 25% management** | −£693,435 |
| **Net rent / yr** | £2,080,304 |
| **3. GDV** (net ÷ 4.5%) | **£46.23m** |
| 4. Build @ £250/sqft (private £27.50m + affordable £23.80m, HA spec) | £51.30m |
| 5. S106 @ £10k/unit | £2.00m |
| 6. Finance @ 10% (1+3yr, multi-year roll-up) | £9.18m |
| **Total development cost** | **£62.48m** |
| 7. Developer profit @ 17.5% | £8.09m |
| **8. RESIDUAL LAND VALUE** | **−£24.34m** |
| · per unit | −£121,700 |
| · per acre (32 ac, placeholder) | −£760,626 |
| vs landowner ask (**placeholder £14.00m**) | **−£38.34m — ❌ does not stack** |

### Sites 1+2+3 — ~500 units (placeholder scales Site 1 × 2.5 → 502)

| | £ |
|---|---:|
| **1. Gross rent / yr** | £6,953,157 |
| **2. less 25% management** | −£1,738,289 |
| **Net rent / yr** | £5,214,868 |
| **3. GDV** (net ÷ 4.5%) | **£115.89m** |
| 4. Build @ £250/sqft (private £68.75m + affordable £59.99m, HA spec) | £128.74m |
| 5. S106 @ £10k/unit | £5.02m |
| 6. Finance @ 10% (1+3yr, multi-year roll-up) | £23.04m |
| **Total development cost** | **£156.80m** |
| 7. Developer profit @ 17.5% | £20.28m |
| **8. RESIDUAL LAND VALUE** | **−£61.19m** |
| · per unit | −£121,891 |
| · per acre (80 ac, placeholder) | −£764,866 |
| vs landowner ask (**placeholder £33.00m**) | **−£94.19m — ❌ does not stack** |

*`calcDealMetrics` (the deal-state every screen reads) reconciles exactly with
the engine: GDV ✓ RLV ✓ on both cases.*

---

## The headline finding — and it is not a placeholder artefact

**On a pure rent-capitalisation basis at 4.5%, the build cost per unit exceeds
the capitalised value of the rent.** This is structural, not a data quirk:

| Private 3-bed @ Maldon market rent | £ |
|---|---:|
| Gross rent/yr (£1,258/mo) | £15,096 |
| Net (less 25%) | £11,322 |
| **Capitalised @ 4.5%** | **£251,600** |
| Build (1,000 sqft × £250) | £250,000 |
| **Margin before S106 / finance / profit / land** | **£1,600** |
| _Same home SOLD new-build (~£420/sqft)_ | _£420,000_ |

So even the **private** units — at full market rent — barely cover their build
cost once capitalised. The **affordable** units rent at 60–80% of market yet cost
**more** to build (HA low-carbon spec), so each one is deeply value-negative on a
rent basis. With 50% affordable, the residual land value is sharply negative.

**Implication / recommendations:**
1. A whole-scheme forward-fund **on capitalised rent at 4.5% does not work** here
   without either (a) **grant** (Homes England AHP) underpinning the affordable,
   or (b) selling the **private half at open-market SALE values** (~£420/sqft vs
   the ~£252k rent-capitalised value — a ~£170k/unit uplift), or (c) materially
   keener yields / higher rents than the placeholders.
2. The realistic structure is a **hybrid**: HA forward-commits the **affordable**
   (with grant), developer **sells the private/PRS** at open-market values. Model
   the private element as `assetType:"sfh"` (sale-based, already in the engine)
   and the affordable as the forward-fund — I can stitch this together once Patric
   confirms the tenure split and whether grant is in.
3. If the HA genuinely bids the **whole** scheme on rent, the **landowner ask must
   fall a long way** (the residual is negative at the placeholder rents), or the
   rents/yield Patric has in mind are materially different from the area benchmark.

---

## Sensitivity — RLV by capitalisation yield × rent level

### 200 units
| Yield \ Rent | −10% | −5% | base | +5% | +10% |
|---|---:|---:|---:|---:|---:|
| 4.00% | −£23.86m | −£21.72m | −£19.57m | −£17.43m | −£15.28m |
| 4.25% | −£26.13m | −£24.12m | −£22.10m | −£20.08m | −£18.06m |
| **4.50%** | −£28.15m | −£26.25m | **−£24.34m** | −£22.43m | −£20.53m |
| 4.75% | −£29.96m | −£28.15m | −£26.35m | −£24.54m | −£22.73m |
| 5.00% | −£31.59m | −£29.87m | −£28.15m | −£26.44m | −£24.72m |

### 500 units
| Yield \ Rent | −10% | −5% | base | +5% | +10% |
|---|---:|---:|---:|---:|---:|
| 4.00% | −£59.99m | −£54.62m | −£49.24m | −£43.86m | −£38.48m |
| 4.25% | −£65.69m | −£60.63m | −£55.57m | −£50.50m | −£45.44m |
| **4.50%** | −£70.75m | −£65.97m | **−£61.19m** | −£56.41m | −£51.63m |
| 4.75% | −£75.28m | −£70.75m | −£66.22m | −£61.69m | −£57.16m |
| 5.00% | −£79.35m | −£75.05m | −£70.75m | −£66.45m | −£62.15m |

Even at 4.0% yield **and** +10% rents the residual stays deeply negative — the
gap to a positive land value is far larger than rent/yield tuning can close,
confirming the structural point above.

### Cross-check — Patric's pure method vs a full Landform appraisal
| | 200 units | 500 units |
|---|---:|---:|
| Patric (no fees/contingency) | −£24.34m | −£61.19m |
| + 10% fees + 5% contingency | −£34.65m | −£87.06m |

---

## What changed in the tool (and why) — `v9.73`

The appraisal surfaced three things the engine could not previously do, each
fixed in `js/01-config.js` and locked in with tests (`tests/run.js`, cases 32–33,
208 pass):

1. **No rent-capitalised whole-scheme route.** `computeSFHMetrics` only valued
   homes on **sale** (sqft × £/sqft × tenure discount). Added
   **`computeForwardFundMetrics`** — values the scheme as an income asset exactly
   per Patric's 8 steps (gross → net → capitalise), reusing the SFH mix row shape
   plus a per-unit rent.
2. **HA low-carbon spec uplift wasn't in the cost engine.** The v9.72 uplift only
   moved the Build Cost Library *benchmark*; it never reached a residual. The
   forward-fund engine now applies it to the **affordable build only** (Delta/CHP
   brief: ASHP, PV + battery, EPC B, NDSS sizes), so the RLV reflects what the HA
   actually requires.
3. **Finance was a flat one-year `(build+fees) × rate`** — a screening estimate
   that understates interest on a 3–4-year job. Added **`developmentFinanceCost`**:
   a true multi-year model (planning period + S-curve build drawdown, interest
   rolled up to completion), reusable across the engines.

`calcDealMetrics` adopts the forward-fund engine's GDV and cost stack for
`assetType:"ff"`, so the deal-state and every screen quote the same rent, GDV and
RLV (proven by the reconciliation ✓ above).

---

## To finalise — what I need from Patric's email
- Real **rent mix** (per type/tenure £/mo) and **tenure split** (S106 vs
  additional affordable; AR / SR / shared ownership / private / PRS shares).
- **Sites 2 & 3** unit numbers, mix and areas (currently a ×2.5 scale of Site 1).
- The **landowner's ask** (figures above are placeholders).
- Whether the HA bid assumes **grant**, and whether the **private element is sold**
  (open-market) or also forward-funded on rent — this is the single biggest driver.
- Site **acreage** per phase (placeholder 32 ac / 80 ac) for the £/acre check.
