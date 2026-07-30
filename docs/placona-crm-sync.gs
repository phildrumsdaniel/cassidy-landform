/**
 * Placona CRM — cross-device sync (v10.193)
 * ──────────────────────────────────────────────────────────────────────────
 * Add this to your existing Landform Apps Script Web App (the same one that
 * powers Save Deal / list_deals / placona_run). It gives each signed-in user a
 * single cloud copy of their Placona pipeline so it follows them across devices.
 *
 * Two actions (matching what the app already calls in v10.193):
 *   • placona_crm_load  — GET  ?action=placona_crm_load&userId=<id>
 *                         → { status:"ok", payload:"<json string>" }   (payload may be "")
 *   • placona_crm_save  — POST body JSON { action:"placona_crm_save", userId:<id>, payload:"<json>" }
 *                         → { status:"ok" }
 *
 * The app sends/receives `payload` = JSON.stringify({ inbox:[...], notes:{...} }).
 * Storage: a sheet tab called "PlaconaCRM" with columns  userId | payload | updated
 * (one row per user, upserted). Deploy the Web App as usual after adding this.
 *
 * WIRING: route the two actions in your existing doGet(e) / doPost(e) — see the
 * examples at the bottom. No other change to the app is needed.
 */

function placonaCrm_sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName("PlaconaCRM");
  if (!sh) { sh = ss.insertSheet("PlaconaCRM"); sh.appendRow(["userId", "payload", "updated"]); }
  return sh;
}

function placonaCrm_save_(userId, payload) {
  if (!userId) return { status: "error", message: "missing userId" };
  var sh = placonaCrm_sheet_();
  var last = Math.max(sh.getLastRow(), 1);
  var ids = sh.getRange(1, 1, last, 1).getValues();
  var row = -1;
  for (var i = 1; i < ids.length; i++) { if (String(ids[i][0]) === String(userId)) { row = i + 1; break; } }
  var now = new Date();
  // A cell holds up to ~50,000 chars — ample for a text pipeline. If you ever hit that, chunk the
  // payload across extra columns exactly like the deal save does.
  if (row === -1) sh.appendRow([userId, payload || "", now]);
  else { sh.getRange(row, 2).setValue(payload || ""); sh.getRange(row, 3).setValue(now); }
  return { status: "ok" };
}

function placonaCrm_load_(userId) {
  if (!userId) return { status: "error", message: "missing userId" };
  var sh = placonaCrm_sheet_();
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(userId)) return { status: "ok", payload: String(data[i][1] || "") };
  }
  return { status: "ok", payload: "" };   // no record yet — the app then seeds it from this device
}

/* ── WIRING (add these two branches to your existing router) ────────────────

  // In doGet(e):
  //   if (e.parameter.action === "placona_crm_load")
  //     return json_(placonaCrm_load_(e.parameter.userId));

  // In doPost(e):
  //   var body = JSON.parse((e.postData && e.postData.contents) || "{}");
  //   if (body.action === "placona_crm_save")
  //     return json_(placonaCrm_save_(body.userId, body.payload));

  // json_ is your existing JSON responder; if you don't have one:
  //   function json_(obj){
  //     return ContentService.createTextOutput(JSON.stringify(obj))
  //       .setMimeType(ContentService.MimeType.JSON);
  //   }

────────────────────────────────────────────────────────────────────────── */
