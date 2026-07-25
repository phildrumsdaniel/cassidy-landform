/**
 * Landform — "Fetch live rents (my endpoint)" backend
 * ====================================================
 * A ready-to-deploy Google Apps Script web app that the Capitalisation stage's
 * "🔗 Fetch live rents (my endpoint)" button (v10.162) calls. It receives the site
 * and returns per-bed monthly rents as JSON. Because it runs on Google's servers,
 * it can hold API keys and fetch licensed/gov data that the static app cannot.
 *
 * CONTRACT (must match the Landform client)
 *   Request  (POST, body is JSON as text/plain):
 *     { postcode, localAuthority, town, beds:[1,2,3,4], scheme:"houses"|"flats" }
 *   Response (JSON):
 *     { rent1, rent2, rent3, rent4, source, asOf }        // £/month; "source" is shown in-app
 *
 * DEPLOY
 *   1. script.google.com → New project → paste this in → Save.
 *   2. Deploy → New deployment → type "Web app".
 *   3. Execute as: Me.  Who has access: Anyone.  → Deploy → copy the /exec URL.
 *   4. In Landform → Capitalisation → "⚙ Live-rents data endpoint" → paste the URL.
 *   5. Click "🔗 Fetch live rents (my endpoint)".
 *
 * Pick ONE source below (A recommended). B and C are wired the same way — swap the
 * body of computeRents() and redeploy; no change to Landform.
 */

function doPost(e) {
  var req = {};
  try { req = JSON.parse((e && e.postData && e.postData.contents) || "{}"); } catch (err) {}
  var out;
  try { out = computeRents(req); }
  catch (err) { out = { source: "endpoint error: " + (err && err.message || err) }; }
  return ContentService.createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}

// A quick health check in the browser: open the /exec URL directly.
function doGet() {
  return ContentService.createTextOutput(JSON.stringify({
    ok: true,
    usage: "POST {postcode, localAuthority, town, beds, scheme} -> {rent1, rent2, rent3, rent4, source}"
  })).setMimeType(ContentService.MimeType.JSON);
}

function computeRents(req) {
  var la = String(req.localAuthority || "").toLowerCase().trim();

  // ─────────────────────────────────────────────────────────────────────────
  // OPTION A (recommended): VOA / ONS OFFICIAL MEDIAN RENTS, by local authority.
  // Free, licensed, citable — the same evidence class as your Land Registry prices.
  // Populate VOA from the VOA "Private Rental Market Statistics" download
  // (median monthly rent by bedroom category × local authority, England; ONS /
  // StatsWales / Scotland for the rest). It's median-of-ALL-stock, so a new-build
  // premium is applied on top. Refresh the table when a new release is published.
  //
  // ⚠ The three rows below are ILLUSTRATIVE PLACEHOLDERS — replace with the real
  //   VOA figures for the local authorities in your pipeline (add as many as you like).
  var VOA = {
    // "localauthority": { 1:oneBed, 2:twoBed, 3:threeBed, 4:fourBedPlus }  (£/month median)
    "maldon":     { 1: 750, 2: 975,  3: 1200, 4: 1500 },
    "chelmsford": { 1: 900, 2: 1150, 3: 1400, 4: 1750 },
    "maidstone":  { 1: 775, 2: 975,  3: 1200, 4: 1550 }
  };
  var NEWBUILD_PREMIUM = 1.10;   // VOA median is all-stock; new-build lets ~5–15% above — tune this.

  var row = VOA[la];
  if (row) {
    return {
      rent1: Math.round(row[1] * NEWBUILD_PREMIUM),
      rent2: Math.round(row[2] * NEWBUILD_PREMIUM),
      rent3: Math.round(row[3] * NEWBUILD_PREMIUM),
      rent4: Math.round(row[4] * NEWBUILD_PREMIUM),
      source: "VOA median, " + (req.localAuthority || la) + " LA, +" +
              Math.round((NEWBUILD_PREMIUM - 1) * 100) + "% new-build",
      asOf: "VOA latest release"
    };
  }
  return { source: "No VOA row for '" + (req.localAuthority || "?") +
                   "'. Add it to the VOA table (or wire Option B/C below)." };

  // ─────────────────────────────────────────────────────────────────────────
  // OPTION B: a LICENSED rent API (postcode-level comparables, best accuracy, paid).
  // Keep the key HERE (server-side). Example shape:
  //   var KEY = "your_api_key";
  //   var r = UrlFetchApp.fetch("https://api.propertydata.co.uk/rents?postcode=" +
  //             encodeURIComponent(req.postcode) + "&key=" + KEY, { muteHttpExceptions: true });
  //   var d = JSON.parse(r.getContentText());
  //   return { rent1: d..., rent2: d..., rent3: d..., rent4: d..., source: "PropertyData API" };

  // ─────────────────────────────────────────────────────────────────────────
  // OPTION C: an LLM WITH WEB SEARCH (live estimate + sources; cheaper than a data feed).
  // Keep the key HERE. Example shape (Anthropic):
  //   var KEY = "your_api_key";
  //   var body = { model: "claude-sonnet-5", max_tokens: 300,
  //     tools: [{ type: "web_search_20250305", name: "web_search" }],
  //     messages: [{ role: "user", content:
  //       "Current monthly ASKING rents for a new-build " + req.scheme + " in " + req.town +
  //       " (" + req.postcode + "), median of live Rightmove/Zoopla listings. " +
  //       "Reply ONLY JSON {rent1,rent2,rent3,rent4}." }] };
  //   var r = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", {
  //     method: "post", contentType: "application/json",
  //     headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01" },
  //     payload: JSON.stringify(body), muteHttpExceptions: true });
  //   // parse the JSON the model returns, then:
  //   return { rent1:..., rent2:..., rent3:..., rent4:..., source: "Claude web-search (verify)" };
}
