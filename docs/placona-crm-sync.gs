/**
 * Placona CRM — cross-device sync  (v10.193 client; backend snippet tailored to the
 * "Cassidy Landform Backend" Apps Script, v10.198)
 * ──────────────────────────────────────────────────────────────────────────
 * This gives each signed-in user ONE cloud copy of their Placona land pipeline
 * (stage, contacts, notes, follow-ups, inbox) so it follows them across devices,
 * exactly like Save Deal already does. localStorage stays the instant working
 * copy + offline fallback; this is the cross-device backup.
 *
 * It is written to match your existing backend's conventions — `respond()`,
 * `getOrCreateSheet(name, headers)` and the `handleX(params)` pattern — so it drops
 * straight in. THREE steps, ~2 minutes:
 *
 *   STEP 1 — paste the two handler functions below anywhere in Code.gs
 *            (e.g. just under handleDeleteDeal).
 *
 *   STEP 2 — add ONE line to doGet(e), next to the other placona_* routes
 *            (your doGet has: placona_run / placona_read / placona_delete / placona_import):
 *
 *              if (action === "placona_crm_load") return respond(handlePlaconaCrmLoad(e.parameter));
 *
 *   STEP 3 — add ONE line to doPost(e), next to the placona_* routes there
 *            (your doPost has: placona_run / placona_import):
 *
 *              if (data.action === "placona_crm_save") return respond(handlePlaconaCrmSave(data));
 *
 *   Then RE-DEPLOY: Deploy ▸ Manage deployments ▸ (your Web App) ▸ Edit ▸
 *   Version: New version ▸ Deploy. (The Web App URL does not change.)
 *
 * The client sends:
 *   • load  — GET  ?action=placona_crm_load&userId=<id>      → { status:"ok", payload:"<json>" }
 *   • save  — POST { action:"placona_crm_save", userId, payload:"<json>" }  → { status:"ok" }
 * where payload = JSON.stringify({ inbox:[...], notes:{...} }).
 *
 * Storage: a sheet tab "PlaconaCRM" with columns  userId | payload | updated
 * (one row per user, upserted) — created automatically on first save.
 */

// STEP 1 — paste these two functions ─────────────────────────────────────────
function handlePlaconaCrmSave(data) {
  var userId = String((data && data.userId) || "").trim();
  if (!userId) return { status: "error", message: "Missing userId" };
  var payload = String((data && data.payload) || "");
  var sh = getOrCreateSheet("PlaconaCRM", ["userId", "payload", "updated"]);
  var values = sh.getDataRange().getValues();
  var row = -1;
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === userId) { row = i + 1; break; }
  }
  var now = new Date();
  // A single cell holds ~50,000 chars — ample for a text pipeline. If you ever
  // hit that, chunk the payload across extra columns like handleSaveDeal does.
  if (row === -1) sh.appendRow([userId, payload, now]);
  else { sh.getRange(row, 2).setValue(payload); sh.getRange(row, 3).setValue(now); }
  return { status: "ok" };
}

function handlePlaconaCrmLoad(data) {
  var userId = String((data && data.userId) || "").trim();
  if (!userId) return { status: "error", message: "Missing userId" };
  var sh = getOrCreateSheet("PlaconaCRM", ["userId", "payload", "updated"]);
  var values = sh.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === userId) {
      return { status: "ok", payload: String(values[i][1] || "") };
    }
  }
  return { status: "ok", payload: "" };   // no record yet — the app seeds it from this device
}

/* ── STEP 2 — in doGet(e), beside the other placona_* routes ──────────────────

     if (action === "placona_run")    return respond(handlePlaconaRun(e.parameter));
     if (action === "placona_read")   return respond(handlePlaconaRead(e.parameter));
     if (action === "placona_delete") return respond(handlePlaconaDelete(e.parameter));
     if (action === "placona_import") return respond(handlePlaconaImport(e.parameter));
+    if (action === "placona_crm_load") return respond(handlePlaconaCrmLoad(e.parameter));   // ← ADD

   ── STEP 3 — in doPost(e), beside the placona_* routes there ─────────────────

     if (data.action === "placona_run")    return respond(handlePlaconaRun(data));
     if (data.action === "placona_import") return respond(handlePlaconaImport(data));
+    if (data.action === "placona_crm_save") return respond(handlePlaconaCrmSave(data));     // ← ADD

   (The app only POSTs the save and only GETs the load, so one line in each is enough.
    Adding both actions to both handlers is harmless if you prefer symmetry.)
────────────────────────────────────────────────────────────────────────────── */
