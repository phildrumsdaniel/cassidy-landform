/**
 * Ronald's Memory — cross-device sync (OPTIONAL)
 * ------------------------------------------------------------------------
 * Ronald (the Landform voice assistant) remembers standing facts, regulations and
 * preferences you tell him and feeds them into every conversation. It works per-device
 * out of the box (stored in the browser). Deploy this to sync that memory across all
 * your devices, exactly like the Placona pipeline sync.
 *
 * HOW TO DEPLOY
 *   1. Open your Landform Apps Script project (the same Web App the tool already calls).
 *   2. Paste the two handlers below into the project (e.g. at the end of Code.gs).
 *   3. In doPost's action router, add:
 *          if (action === "ronald_mem_save") return ronaldMemSave_(data);
 *          if (action === "ronald_mem_load") return ronaldMemLoad_(data);
 *      (If you deployed docs/backend-all-in-one.gs, add those two lines to its router too.)
 *   4. Deploy → Manage deployments → edit → New version → Deploy.
 *
 * Storage: one row per user in a "RonaldMemory" sheet — [userId, payload(JSON), updatedAt].
 * The client sends the full memory list as a JSON string; last write wins (same as the CRM sync).
 * No new scopes required.
 */

function ronaldMemSave_(data) {
  try {
    if (!data || !data.userId) return respond({ status: "error", message: "missing userId" });
    var sheet = getOrCreateSheet("RonaldMemory", ["userId", "payload", "updatedAt"]);
    var values = sheet.getDataRange().getValues();
    var rowIndex = -1;
    for (var i = 1; i < values.length; i++) {
      if (String(values[i][0]) === String(data.userId)) { rowIndex = i + 1; break; }
    }
    var payload = data.payload || "[]";
    var now = new Date().toISOString();
    if (rowIndex > 0) {
      sheet.getRange(rowIndex, 2).setValue(payload);
      sheet.getRange(rowIndex, 3).setValue(now);
    } else {
      sheet.appendRow([data.userId, payload, now]);
    }
    return respond({ status: "ok" });
  } catch (err) {
    return respond({ status: "error", message: String(err) });
  }
}

function ronaldMemLoad_(data) {
  try {
    if (!data || !data.userId) return respond({ status: "error", message: "missing userId" });
    var sheet = getOrCreateSheet("RonaldMemory", ["userId", "payload", "updatedAt"]);
    var values = sheet.getDataRange().getValues();
    for (var i = 1; i < values.length; i++) {
      if (String(values[i][0]) === String(data.userId)) {
        return respond({ status: "ok", payload: values[i][1] || "[]", updatedAt: values[i][2] || "" });
      }
    }
    return respond({ status: "ok", payload: "[]" });
  } catch (err) {
    return respond({ status: "error", message: String(err) });
  }
}
