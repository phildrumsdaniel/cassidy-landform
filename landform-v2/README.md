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

## Phase 2 — next steps (not done yet)

1. Smoke test this version in the real environment.
2. Extract `LiveMarketBanner`, then `S106Table`, then `FlowNode` out of `Tool`,
   one at a time, threading their state through props — testing after each.
3. Optionally split the appraisal stages inside `FlowNode` into per-stage files.
