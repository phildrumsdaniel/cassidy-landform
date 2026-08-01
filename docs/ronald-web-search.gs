/**
 * Ronald — live WEB SEARCH (so he can look up new regulations)
 * ------------------------------------------------------------------------
 * Ronald can already reason from what he knows, but he has a knowledge cut-off and can't
 * browse the web by himself. Deploy this handler and he can actually LOOK THINGS UP — say
 * "look up the latest BNG rules" or "search for the new NPPF changes" and he fetches current
 * results, summarises them for a UK developer, and remembers the finding.
 *
 * The client calls: { action:"web_search", query:"…" } and expects back
 *   { status:"ok", results:[ { title, snippet, url }, … ] }
 * (or { status:"ok", result:"<plain text>" }). Anything else → Ronald falls back to
 * answering from his own knowledge with a "verify live" caveat, so this is optional.
 *
 * ── OPTION A (recommended): Google Programmable Search (free tier ~100 queries/day) ──
 *   1. Create a Programmable Search Engine at https://programmablesearchengine.google.com
 *      (set it to "Search the entire web"). Copy its Search engine ID (cx).
 *   2. Get an API key at https://developers.google.com/custom-search/v1/overview (enable
 *      "Custom Search API" in Google Cloud).
 *   3. In Apps Script: Project Settings → Script properties → add
 *         GOOGLE_CSE_KEY = <your api key>
 *         GOOGLE_CSE_CX  = <your search engine id>
 *   4. Paste the handler below into your project, and add to doPost's router:
 *         if (action === "web_search") return ronaldWebSearch_(data);
 *   5. Deploy → New version.
 *
 * ── OPTION B: Bing Web Search / SerpAPI / Brave ── swap the fetch URL + auth in the marked
 *   spot for your provider and map its JSON into the same {title,snippet,url} shape.
 *
 * Nothing here needs extra OAuth scopes beyond UrlFetch (external requests).
 */

function ronaldWebSearch_(data) {
  try {
    var query = (data && data.query ? String(data.query) : "").trim();
    if (!query) return respond({ status: "error", message: "missing query" });

    var props = PropertiesService.getScriptProperties();
    var key = props.getProperty("GOOGLE_CSE_KEY");
    var cx  = props.getProperty("GOOGLE_CSE_CX");
    if (!key || !cx) {
      return respond({ status: "error", message: "web_search not configured (set GOOGLE_CSE_KEY and GOOGLE_CSE_CX)" });
    }

    // Bias towards recent, authoritative UK sources for planning/development questions.
    var q = query + " UK planning development 2026";
    // ── PROVIDER CALL (Option A: Google Programmable Search). Swap this block for Option B. ──
    var url = "https://www.googleapis.com/customsearch/v1"
            + "?key=" + encodeURIComponent(key)
            + "&cx="  + encodeURIComponent(cx)
            + "&num=6&safe=off&gl=uk&hl=en"
            + "&q="   + encodeURIComponent(q);
    var resp = UrlFetchApp.fetch(url, { method: "get", muteHttpExceptions: true });
    if (resp.getResponseCode() !== 200) {
      return respond({ status: "error", message: "search provider " + resp.getResponseCode() });
    }
    var body = JSON.parse(resp.getContentText() || "{}");
    var items = body.items || [];
    var results = items.map(function (it) {
      return { title: it.title || "", snippet: it.snippet || "", url: it.link || "" };
    });
    return respond({ status: "ok", results: results });
  } catch (err) {
    return respond({ status: "error", message: String(err) });
  }
}
