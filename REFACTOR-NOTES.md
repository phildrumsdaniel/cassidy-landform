# Landform v2 — modular version

This folder is a **reorganised copy** of the original `../index.html`. It is the
exact same application, byte-for-byte, just split out of one 1.3 MB / 19,000-line
file into smaller files you can actually read and edit.

**The original `../index.html` is untouched and remains the fallback.** If
anything here misbehaves, keep deploying the original until it's sorted.

## How it's laid out

```
landform-v2/
  index.html            page shell — loads the CSS + the JS files in order
  css/app.css           all the styling (was the inline <style> block)
  js/01-config.js       constants, logo, logEvent, callAI, shared helpers (e, S)
  js/02-primitives.js   Inp / Sel / CitySelect form controls
  js/03-ai-panel.js     AIPanel
  js/04-access-gate.js  AccessGate (login / register)
  js/05-tool.js         Tool — the main app (still large)
  js/06-root.js         Root / PublicShareViewer + the ReactDOM.render bootstrap
```

The JS files are plain `<script>`s (no build step). They share one global scope
and **must load in the numbered order** — that's the same order they appeared in
the original file, so behaviour is identical.

## Why `05-tool.js` is still huge (1.1 MB)

In the original, `Tool` is one ~16,400-line function, and the big appraisal
engine `FlowNode` (~12,400 lines), plus `LiveMarketBanner` and `S106Table`, are
**nested inside it** and read `Tool`'s local variables directly. They can't be
moved to separate files by copy-paste — they'd lose access to those variables.
Pulling them out properly is a careful refactor (passing the needed state
through props), done one piece at a time with testing in between. That's Phase 2.

## How this version was produced (and why it's safe)

The original `<script>` body was sliced into the six files above at top-level
function boundaries — no code was rewritten. Verification done:

- concatenating `js/01..06` reproduces the original script **byte-for-byte**
- `css/app.css` matches the original inline CSS **byte-for-byte**
- every JS file passes `node --check` (syntax OK)

## Deploying

Upload the whole `landform-v2/` folder (it uses relative paths). Open
`landform-v2/index.html`. To roll back, just serve the original `index.html`.

> Not yet exercised against the live backend + login in a browser — please smoke
> test (log in, open a deal, run an AI panel, export) before switching over.

## Phase 2 — in progress

`Tool` turned out to be a ~16,000-line component holding **~40 `render…()`
functions** (one per screen) plus helpers. They're entangled: each reads `Tool`'s
shared variables (`data`, `up()`, `stage`, ~30 state setters) through closure, and
they call each other. A scope analysis (acorn AST) of all 64 nested functions found:

- **none of them write back** to a `Tool` variable (they only read or call setters), and
- only **3 functions reference *zero* of `Tool`'s variables**, making them
  provably safe to lift out without changing behaviour.

Those 3 are now in their own files (bodies unchanged):

```
js/lib-isStageComplete.js     pure predicate (19 lines)
js/lib-migrateLoadedDeal.js   deal version-migration (308 lines)
js/components-S106Table.js    pure table component (48 lines)
```

Verification for this step:
- the full v2 program parses, and contains the **same 212 function declarations**
  as the original — none lost, none duplicated
- no global name is declared twice
- every free variable in the 3 lifted functions resolves to a real global

### Still to do (the harder, riskier part)

The remaining ~37 render functions can't be lifted by copy-paste — they'd need
their closure dependencies passed in as a context object, **and** every cross-call
between them rewired to pass that context. That's a large change that must be
**smoke-tested in the real app after each batch** (it can't be fully verified
statically). Recommended order: smallest/most self-contained screens first
(`renderDD`, `renderRisks`, `renderConstraintCheck`), leaving the big
interdependent ones (`renderRLV`, `renderCapitalise`, `renderDashboard`) for last.
