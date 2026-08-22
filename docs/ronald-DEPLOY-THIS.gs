/**
 * RONALD — DEPLOY THIS ONE FILE to switch on his Memory + Web-search.
 * ════════════════════════════════════════════════════════════════════════
 * This is the memory-sync and web-search handlers bundled together so you
 * only paste ONCE. It relies on two helpers your backend ALREADY has
 * (respond and getOrCreateSheet — your Placona CRM sync uses the same ones)
 * and the ANTHROPIC_KEY Script Property that already powers Landform's AI.
 * No new API keys, no new permissions.
 *
 * ── 3 STEPS ──────────────────────────────────────────────────────────────
 * 1. Open the Apps Script project "Cassidy Landform Backend" and paste
 *    everything below this comment at the very BOTTOM of Code.gs.
 *
 * 2. Find the doPost(e) function near the top. Among the existing lines that
 *    look like   if (data.action === "…") return …   add these THREE:
 *
 *        if (data.action === "ronald_mem_save") return ronaldMemSave_(data);
 *        if (data.action === "ronald_mem_load") return ronaldMemLoad_(data);
 *        if (data.action === "web_search")      return respond(handleWebSearch(data));
 *
 *    (Put them just before doPost's final "unknown action" / fallback return.)
 *
 * 3. Deploy ▸ Manage deployments ▸ (pencil/edit) ▸ Version: New version ▸ Deploy.
 *    That last step is what makes the /exec URL serve the new code — editing
 *    alone is not enough.
 * ─────────────────────────────────────────────────────────────────────────
 */

/* ── Ronald's memory: cross-device sync ─────────────────────────────────── */
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

/* ── Ronald's live web-search (via your existing Anthropic key) ──────────── */
function handleWebSearch(data) {
  try {
    var query = (data && data.query ? String(data.query) : "").trim();
    if (!query) return { status: "error", message: "missing query" };

    var key = (typeof ANTHROPIC_KEY !== "undefined" && ANTHROPIC_KEY)
      || PropertiesService.getScriptProperties().getProperty("ANTHROPIC_KEY") || "";
    if (!key) return { status: "error", message: "ANTHROPIC_KEY not set in Script Properties" };

    var model = (typeof CLAUDE_MODEL !== "undefined" && CLAUDE_MODEL) || "claude-sonnet-4-6";

    var body = {
      model: model,
      max_tokens: 1024,
      system: "You are Ronald, a sharp, candid UK land & development advisor for Cassidy Group. "
        + "Use web search to answer the developer's question with the CURRENT position: what it is, "
        + "what has changed if anything, and the practical implication for UK residential appraisals, "
        + "build costs, planning or funding. Reply in 2 to 4 plain sentences, spoken-friendly (it is read "
        + "aloud). Prefer authoritative UK sources (gov.uk, ONS, BCIS, the LPA, the relevant regulator). "
        + "If results are thin or conflicting, say so plainly. Do not invent figures or sources.",
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 4 }],
      messages: [{ role: "user", content: query }]
    };

    var response = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", {
      method: "post",
      contentType: "application/json",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
      payload: JSON.stringify(body),
      muteHttpExceptions: true
    });

    var code = response.getResponseCode();
    var json = {};
    try { json = JSON.parse(response.getContentText() || "{}"); } catch (e) {}
    if (code !== 200) {
      return { status: "error", message: "anthropic " + code + (json && json.error ? (": " + (json.error.message || "")) : "") };
    }

    var out = "";
    var blocks = json.content || [];
    for (var i = 0; i < blocks.length; i++) {
      if (blocks[i] && blocks[i].type === "text" && blocks[i].text) out += (out ? " " : "") + blocks[i].text;
    }
    out = out.trim();
    if (!out) return { status: "error", message: "no answer returned" };
    return { status: "ok", result: out };
  } catch (err) {
    return { status: "error", message: String(err) };
  }
}
