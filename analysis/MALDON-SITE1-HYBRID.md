# Maldon — Site 1 Recommended Hybrid (Land South of Howells Farm)

**Scope:** Site 1 only, **200 / 225 units**. The extra 30-acre parcel (Sites 2 & 3 /
the ~500-unit concept) is **parked** for now.

**Structure (recommended):** the **hybrid** —
- **Market ~50% → built for PRIVATE SALE @ £450/sqft** (John Baker comp).
- **Affordable ~50% (S106 + extra) → DELTA on rent**, rent-capitalised @ 4.5%
  (Patric's method), built to the **HA low-carbon spec** (CHP D&C / NDSS), with an
  **AHP grant** sensitivity.

**Engine:** every figure comes from the real Landform engine
(`computeForwardFundMetrics` + sale on the market rows + rent-capitalisation on the
affordable rows). Reproduce with `node analysis/maldon-site1-hybrid.js`.
Because `RLV = GDV − devCost − profit` and **neither finance nor profit touches land**
(finance is on build+S106; profit is 17.5% *on cost, ex-land*), the cost stack is
GDV-independent — so the two exit routes sum on **one consistent cost basis**.

---

## Inputs (real, from the 16–19 June 2026 emails / brief)

| Lever | Value | Source |
|---|---|---|
| Sale price | £450/sqft | John Baker comps (£350–470) |
| Rents | Beresfords (Danny) Maldon table | email |
| Build | £250/sqft + 12% HA spec on affordable | Caddick / Delta CHP+NDSS |
| Affordable rents | AR 80% MV · SR 55% MV | assumption |
| Finance | 10%, 1yr planning + 3yr build | brief |
| Profit | 17.5% **on cost** (ex-land) | brief |
| S106 | £10,000/unit | Patric |
| Yield | 4.5% capitalisation | Patric |
| Land | £14.0m headline / **£12.0m realistic** | John Baker |

**MODELLED:** the per-tenure unit split (no email gives a scheme mix) — a
representative **50% market / 50% affordable** (AR + SR). Swap the mix and re-run.

---

## Headline result — RLV by AHP grant (200 units)

| Grant / affordable home | Grant total | GDV | **RLV** | £/unit | vs £12m | vs £14m |
|---|---|---|---|---|---|---|
| £0 | £0.0m | £77.2m | **£4.76m** | £23.8k | ❌ −£7.2m | ❌ −£9.2m |
| £25k | £2.5m | £79.7m | **£7.26m** | £36.3k | ❌ −£4.7m | ❌ −£6.7m |
| £50k | £5.0m | £82.2m | **£9.76m** | £48.8k | ❌ −£2.2m | ❌ −£4.2m |
| **£75k** | £7.5m | £84.7m | **£12.26m** | £61.3k | ✅ **+£0.3m** | ❌ −£1.7m |
| £100k | £10.0m | £87.2m | **£14.76m** | £73.8k | ✅ +£2.8m | ✅ +£0.8m |

225 units is the same shape, ~12% larger (RLV £5.36m → £16.66m across the same grant
range; clears £12m just under £75k/home, clears £14m by £100k/home).

---

## The honest read (this corrects my earlier "hybrid is best" shorthand)

1. **Grant is the whole game.** At **£0 grant the hybrid only supports ≈£4.8m** of land
   — the affordable half, even sold to Delta on rent, returns ~£24m against ~£29m of
   build (HA spec) + its share of S106/finance/profit, i.e. it is **value-dilutive**.
   To hit John Baker's **£12m** you need **≈£75k/affordable home** of AHP grant; to
   reach the **£14m** headline you need **≈£100k/home**.

2. **"Sell 100% private" (£8.9m) is NOT a real option.** It scores higher only because
   it ignores the **policy-required affordable** — the council's S106 will force ~50%
   affordable, so the all-private number is a theoretical ceiling, not a scheme you can
   consent. **Among permissible structures, the hybrid is the best.**

3. **Don't let Delta take the market half too.** "One HA takes all on rent" is the
   **worst** outcome (−£1.7m): market-rent BTR + HA-spec build on every home destroys
   value. Keep the market half as **private sale**.

### So the deal only works if EITHER:
- **AHP grant ≈ £75k+/affordable home** is secured (Delta bids for it as the RP), **or**
- **Land is negotiated below £12m** (at £0 grant the scheme supports only ~£5m of land), **or**
- The **affordable %** is pushed down / the **market mix** richer than 50/50.

---

## RLV by structure — 200 units, £0 grant (context)

| Structure | RLV | Note |
|---|---|---|
| **Hybrid: market SOLD + affordable→Delta** | **£4.76m** | ◀ recommended (permissible) |
| Hybrid variant: market BTR + affordable→Delta | −£1.67m | market rent dilutes |
| Whole scheme SOLD 100% private @ £450 | £8.88m | not permissible (ignores affordable) |
| Whole scheme to Delta on rent | −£1.67m | worst — avoid |

---

## Open items to firm up

- **Grant** — the single biggest unknown. Get Delta (Lawrence Hember) to indicate the
  AHP grant rate they'd bring per home; that moves RLV by £2.5m per £25k/home.
- **Affordable %** — confirm the policy requirement for Maldon (is it really ~50%, or
  lower?). Every 10pts off affordable lifts the residual materially.
- **Mix** — replace the MODELLED 50/50 with the real pre-app unit schedule.
- **Land** — anchor negotiations at/below £12m; the engine says £14m needs ~£100k/home grant.
