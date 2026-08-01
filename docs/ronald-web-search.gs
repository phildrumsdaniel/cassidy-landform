/**
 * Ronald — live WEB SEARCH via the Claude (Anthropic) API you ALREADY have
 * ------------------------------------------------------------------------
 * Ronald can already reason from what he knows, but he has a knowledge cut-off and can't
 * browse the web by himself. This handler lets him actually LOOK THINGS UP — say
 * "look up next year's RPI forecast", "search for the new NPPF changes", "what's the latest
 * on nutrient neutrality" — and it uses the SAME Anthropic API key that already powers the
 * rest of Landform (Script Property ANTHROPIC_KEY). No new account, no second API key: Claude's
 * built-in web-search tool does the searching, then summarises for a UK developer.
 *
 * The client calls: { action:"web_search", query:"…" } and expects back
 *   { status:"ok", result:"<plain-text answer>" }
 * Anything else (or an old/невalid deployment) → Ronald falls back to answering from his own
 * knowledge with a "verify live" caveat, so this stays optional.
 *
 * ── DEPLOY ──
 *   1. Open your Landform Apps Script project (the one that already has ANTHROPIC_KEY set —
 *      the web-search tool bills to that same key/account).
 *   2. Paste the handler below into the project (e.g. next to handleAI).
 *   3. In BOTH routers add the line:
 *          if (action === "web_search") return respond(handleWebSearch(e.parameter));   // doGet
 *          if (data.action === "web_search") return respond(handleWebSearch(data));      // doPost
 *      (If you deployed docs/backend-all-in-one.gs, add the same two lines there.)
 *   4. Deploy → Manage deployments → edit → New version → Deploy.
 *
 * Notes:
 *   • Web search is billed per search on top of normal token cost — a few pence per lookup.
 *   • Uses the tool version web_search_20250305, which works on every current Claude model
 *     (including your CLAUDE_MODEL = claude-sonnet-4-6). Nothing else to configure.
 *   • Requires the UrlFetch scope you already grant for handleAI — no new permissions.
 */

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

    // Concatenate the assistant's TEXT blocks (skip server_tool_use / web_search_tool_result).
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
