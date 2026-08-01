/**
 * Cassidy Landform Backend — ALL SESSION ADDITIONS, in one place  (v10.214)
 * ══════════════════════════════════════════════════════════════════════════
 * Deploy this ONCE to finish wiring everything built this session. It's verified
 * against your live "Cassidy Landform Backend" script: no function-name clashes,
 * and it reuses your existing helpers (respond, getOrCreateSheet). It SUPERSEDES the
 * individual snippets (placona-crm-sync / landowner-email-send / landowner-identify /
 * portfolio-outreach-summary) — you only need this file.
 *
 * ┌─ WHAT IT ADDS ──────────────────────────────────────────────────────────┐
 * │ request_reset / reset_password       → the "Forgot password?" login flow  │
 * │                                        (NOT currently in your router!)     │
 * │ placona_crm_save / placona_crm_load  → Placona pipeline cross-device sync │
 * │ send_email                           → send the landowner email (Gmail)   │
 * │ companies_house_lookup               → free company owner lookup          │
 * │ land_registry_lookup                 → LandInsight (LandTech) title lookup │
 * │ (optional) outreach fields in list_deals → outreach status on portfolio   │
 * └─────────────────────────────────────────────────────────────────────────┘
 * ⚠ Your live script routes login/register but NOT request_reset/reset_password, so the app's
 *   "Forgot password?" flow currently fails. This file fixes that too. It supersedes the individual
 *   snippets AND docs/apps-script-password-reset.js — this one file is everything.
 *
 * ════════ STEP 1 — SETTINGS (Project Settings ▸ Script properties) ═════════
 *   CH_API_KEY         = <Companies House API key>   (free: developer.company-information.service.gov.uk)
 *   LANDTECH_API_KEY   = <LandInsight/LandTech API key>            (from your LandTech account manager)
 *   LANDTECH_API_BASE  = <base URL from the LandTech API reference, e.g. https://api.land.tech>
 *   (Company email) In the Gmail account this script runs on: Settings ▸ Accounts and Import ▸
 *   "Send mail as" ▸ add & verify  phil.daniel@cassidygroupltd.com  so send_email can send from it.
 *
 * ════════ STEP 2 — PASTE the handlers below into Code.gs ════════
 *
 * ════════ STEP 3 — ADD these router lines ════════
 *   In doGet(e), beside your other routes (login/register live here; the app calls these by GET):
 *     if (action === "request_reset")    return respond(handleRequestReset(e.parameter));
 *     if (action === "reset_password")   return respond(handleResetPassword(e.parameter));
 *     if (action === "placona_crm_load") return respond(handlePlaconaCrmLoad(e.parameter));
 *   In doPost(e), beside your other POST routes:
 *     if (data.action === "placona_crm_save")       return respond(handlePlaconaCrmSave(data));
 *     if (data.action === "send_email")             return respond(handleSendEmail(data));
 *     if (data.action === "companies_house_lookup") return respond(handleCompaniesHouse(data));
 *     if (data.action === "land_registry_lookup")   return respond(handleLandRegistry(data));
 *
 * ════════ STEP 4 — DEPLOY ════════
 *   Deploy ▸ Manage deployments ▸ (your Web App) ▸ Edit ▸ Version: New version ▸ Deploy.
 *   The first send_email / lookup will ask you to AUTHORISE the Gmail + external-fetch scopes — accept.
 *   The Web App URL does NOT change.
 */

// ════════════════════════════════════════════════════════════════════════════
// 0) PASSWORD RESET — the "Forgot password?" flow (request_reset / reset_password)
//    Uses your existing hashPassword(password, email) and getUsersSheet(); codes live in a separate
//    "Resets" sheet so the Users schema is untouched. Emails the code via MailApp (from the script
//    account). Always replies the same way to request_reset so it never reveals which emails exist.
// ════════════════════════════════════════════════════════════════════════════
function handleRequestReset(params) {
  var email = String((params && params.email) || "").trim().toLowerCase();
  if (email) {
    try {
      var uv = getUsersSheet().getDataRange().getValues(), exists = false;
      for (var i = 1; i < uv.length; i++) { if (String(uv[i][1] || "").toLowerCase() === email) { exists = true; break; } }
      if (exists) {
        var code = "" + Math.floor(100000 + Math.random() * 900000);
        var sh = getOrCreateSheet("Resets", ["email", "code", "expires", "used"]);
        sh.appendRow([email, code, new Date(Date.now() + 15 * 60 * 1000).toISOString(), ""]);
        MailApp.sendEmail(email, "Your Landform password reset code",
          "Your Landform password reset code is: " + code + "\n\nIt expires in 15 minutes and can be used once. If you didn't request this, you can ignore this email.");
      }
    } catch (e) {}
  }
  return { status: "ok" };   // identical response whether or not the account exists
}
function handleResetPassword(params) {
  var email = String((params && params.email) || "").trim().toLowerCase();
  var code = String((params && params.code) || "").trim();
  var password = String((params && params.password) || "");
  if (!email || !code || !password) return { status: "error", message: "email, code and new password required" };
  var sh = getOrCreateSheet("Resets", ["email", "code", "expires", "used"]);
  var rows = sh.getDataRange().getValues(), rowIdx = -1;
  for (var i = rows.length - 1; i >= 1; i--) {   // newest first
    if (String(rows[i][0] || "").toLowerCase() === email && String(rows[i][1] || "") === code && !String(rows[i][3] || "")) {
      var exp = new Date(rows[i][2]);
      if (!isNaN(exp.getTime()) && exp > new Date()) { rowIdx = i + 1; break; }
    }
  }
  if (rowIdx < 0) return { status: "error", message: "That code is invalid or has expired." };
  var ush = getUsersSheet(), uv = ush.getDataRange().getValues(), done = false;
  for (var j = 1; j < uv.length; j++) {
    if (String(uv[j][1] || "").toLowerCase() === email) { ush.getRange(j + 1, 3).setValue(hashPassword(password, email)); done = true; break; }
  }
  if (!done) return { status: "error", message: "No account found." };
  sh.getRange(rowIdx, 4).setValue(new Date().toISOString());   // mark the code used
  return { status: "ok" };
}

// ════════════════════════════════════════════════════════════════════════════
// 1) PLACONA CRM — cross-device sync of the land pipeline
// ════════════════════════════════════════════════════════════════════════════
function handlePlaconaCrmSave(data) {
  var userId = String((data && data.userId) || "").trim();
  if (!userId) return { status: "error", message: "missing userId" };
  var payload = String((data && data.payload) || "");
  var sh = getOrCreateSheet("PlaconaCRM", ["userId", "payload", "updated"]);
  var values = sh.getDataRange().getValues(), row = -1;
  for (var i = 1; i < values.length; i++) { if (String(values[i][0]) === userId) { row = i + 1; break; } }
  var now = new Date();
  if (row === -1) sh.appendRow([userId, payload, now]);
  else { sh.getRange(row, 2).setValue(payload); sh.getRange(row, 3).setValue(now); }
  return { status: "ok" };
}
function handlePlaconaCrmLoad(data) {
  var userId = String((data && data.userId) || "").trim();
  if (!userId) return { status: "error", message: "missing userId" };
  var sh = getOrCreateSheet("PlaconaCRM", ["userId", "payload", "updated"]);
  var values = sh.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) { if (String(values[i][0]) === userId) return { status: "ok", payload: String(values[i][1] || "") }; }
  return { status: "ok", payload: "" };
}

// ════════════════════════════════════════════════════════════════════════════
// 2) SEND EMAIL — landowner approach, from your company address (Send-mail-as alias)
// ════════════════════════════════════════════════════════════════════════════
function handleSendEmail(data) {
  var to = String((data && data.to) || "").trim();
  var subject = String((data && data.subject) || "").trim();
  var body = String((data && data.body) || "");
  if (!to || to.indexOf("@") < 0) return { status: "error", message: "missing or invalid recipient email" };
  if (!subject && !body) return { status: "error", message: "empty email" };
  var options = {};
  var replyTo = String((data && data.replyTo) || "").trim();
  if (replyTo && replyTo.indexOf("@") >= 0) options.replyTo = replyTo;
  var fromName = String((data && data.fromName) || "").trim();
  if (fromName) options.name = fromName;
  var sentFrom = "";
  try {
    var primary = ""; try { primary = Session.getActiveUser().getEmail(); } catch (e) {}
    var aliases = []; try { aliases = GmailApp.getAliases(); } catch (e) {}
    var fromReq = String((data && data.from) || "").trim();
    if (fromReq && (fromReq === primary || aliases.indexOf(fromReq) >= 0)) { options.from = fromReq; sentFrom = fromReq; }
    else { sentFrom = primary || "(the backend account)"; }
    GmailApp.sendEmail(to, subject || "(no subject)", body, options);
  } catch (err) { return { status: "error", message: String(err) }; }
  try { var sh = getOrCreateSheet("SentEmails", ["timestamp", "userId", "to", "subject", "from", "replyTo"]);
    sh.appendRow([new Date(), String((data && data.userId) || ""), to, subject, sentFrom, replyTo]); } catch (e) {}
  return { status: "ok", sentTo: to, sentFrom: sentFrom };
}

// ════════════════════════════════════════════════════════════════════════════
// 3) COMPANIES HOUSE — free company owner lookup (needs CH_API_KEY)
// ════════════════════════════════════════════════════════════════════════════
function handleCompaniesHouse(data) {
  var q = String((data && data.query) || "").trim();
  if (!q) return { status: "error", message: "no company name to search" };
  var key = PropertiesService.getScriptProperties().getProperty("CH_API_KEY");
  if (!key) return { status: "error", message: "CH_API_KEY not set in Script properties" };
  try {
    var url = "https://api.company-information.service.gov.uk/search/companies?q=" + encodeURIComponent(q) + "&items_per_page=1";
    var res = UrlFetchApp.fetch(url, { method: "get", headers: { Authorization: "Basic " + Utilities.base64Encode(key + ":") }, muteHttpExceptions: true });
    var body = JSON.parse(res.getContentText() || "{}");
    var it = (body.items && body.items[0]) || null;
    if (!it) return { status: "ok", companyName: "", message: "no match" };
    var a = it.address || {};
    var regOffice = [a.premises, a.address_line_1, a.locality, a.postal_code].filter(function (x) { return x; }).join(", ");
    return { status: "ok", type: "company", companyName: it.title, companyNumber: it.company_number, companyStatus: it.company_status, registeredOffice: regOffice, address: regOffice };
  } catch (err) { return { status: "error", message: String(err) }; }
}

// ════════════════════════════════════════════════════════════════════════════
// 4) LAND REGISTRY via LANDINSIGHT (LandTech) — title / proprietor lookup
//    Needs LANDTECH_API_KEY (+ LANDTECH_API_BASE). CONFIRM the endpoint path (SPOT 1) and the
//    response field names (SPOT 2) against your LandTech API reference and tweak if they differ.
// ════════════════════════════════════════════════════════════════════════════
function handleLandRegistry(data) {
  var props = PropertiesService.getScriptProperties();
  var key = props.getProperty("LANDTECH_API_KEY");
  var base = props.getProperty("LANDTECH_API_BASE") || "https://api.land.tech";
  if (!key) return { status: "error", message: "LANDTECH_API_KEY not set — add it in Script properties." };
  var address = String((data && data.address) || "").trim();
  var postcode = String((data && data.postcode) || "").trim();
  var title = String((data && data.titleNumber) || "").trim();
  if (!address && !postcode && !title) return { status: "error", message: "need an address, postcode or title number" };
  try {
    // ── SPOT 1: ownership endpoint (confirm path + params in your LandTech API reference)
    var qs = title ? ("titleNumber=" + encodeURIComponent(title))
                   : ("address=" + encodeURIComponent(address) + "&postcode=" + encodeURIComponent(postcode));
    var url = base.replace(/\/+$/, "") + "/v1/ownership?" + qs;
    var res = UrlFetchApp.fetch(url, { method: "get", headers: { Authorization: "Bearer " + key, Accept: "application/json" }, muteHttpExceptions: true });
    var code = res.getResponseCode();
    if (code >= 400) return { status: "error", message: "LandTech API " + code + ": " + String(res.getContentText()).slice(0, 300) };
    return mapLandTechOwnership_(JSON.parse(res.getContentText() || "{}"));
  } catch (err) { return { status: "error", message: String(err) }; }
}
function mapLandTechOwnership_(j) {
  // ── SPOT 2: map LandTech's response to Landform's shape (adjust field names to their reference)
  var rec = (j && (j.ownership || (j.ownerships && j.ownerships[0]) || (j.results && j.results[0]) || (j.data && (j.data.ownership || j.data)))) || j || {};
  function first(v) { return Array.isArray(v) ? (v[0] || "") : (v || ""); }
  var p = first(rec.proprietors) || rec.proprietor || rec.owner || rec.ownerName || rec.registeredProprietor || "";
  var proprietor = (p && typeof p === "object") ? (p.name || p.proprietorName || "") : String(p || "");
  var address = rec.proprietorAddress || rec.ownerAddress || rec.correspondenceAddress || ((p && typeof p === "object") ? (p.address || "") : "") || rec.address || "";
  var titleNo = rec.titleNumber || rec.title_no || rec.title || "";
  if (!proprietor && !titleNo) return { status: "ok", proprietor: "", message: "no ownership match returned" };
  return { status: "ok", type: rec.ownerType || rec.tenure || "", proprietor: proprietor, name: proprietor, address: address, titleNumber: titleNo };
}

/* ════════════════════════════════════════════════════════════════════════════
 * 5) OPTIONAL — outreach status on the PORTFOLIO cards
 * ────────────────────────────────────────────────────────────────────────────
 * The Deal Dashboard already shows landowner outreach status with NO backend. To show it on the
 * portfolio cards too, list_deals must return three extra fields per deal. Your handleListDeals builds
 * each summary from SHEET COLUMNS (not the payload), so this reassembles + parses each deal's payload
 * to read data.outreach — a small extra cost per list call. OPTIONAL; skip it if you don't want it.
 *
 * In handleListDeals(), inside the `for` loop, AFTER you build each `deal` object and BEFORE
 * `deals.push(...)`, add:
 *
 *     var os = outreachSummary_(reassembleOutreach_(values[i]));   // ← ADD
 *     deal.outreachLast     = os.outreachLast;                     // ← ADD  (rename `deal` to your var)
 *     deal.outreachChannel  = os.outreachChannel;                  // ← ADD
 *     deal.outreachFollowUp = os.outreachFollowUp;                 // ← ADD
 *
 * and paste these two helpers:
 */
function reassembleOutreach_(row) {
  try {
    var chunkCount = Number(row[9]) || 1;
    var payload = String(row[6] || "");
    for (var k = 1; k < chunkCount; k++) payload += String(row[9 + k] || "");
    return JSON.parse(payload || "{}");
  } catch (e) { return {}; }
}
function outreachSummary_(payloadObj) {
  var out = { outreachLast: 0, outreachChannel: "", outreachFollowUp: "" };
  try {
    var o = (payloadObj && payloadObj.outreach) || {};
    var log = Array.isArray(o.log) ? o.log : [];
    for (var i = 0; i < log.length; i++) { var ts = Number(log[i] && log[i].ts) || 0; if (ts > out.outreachLast) { out.outreachLast = ts; out.outreachChannel = String(log[i].channel || ""); } }
    if (!out.outreachLast && Number(o.emailSentAt) > 0) { out.outreachLast = Number(o.emailSentAt); out.outreachChannel = "email"; }
    out.outreachFollowUp = String(o.followUpDate || "");
  } catch (e) {}
  return out;
}
