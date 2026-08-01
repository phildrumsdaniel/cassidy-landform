/**
 * ⚠ SUPERSEDED — use docs/backend-all-in-one.gs (one file wires everything). Kept for reference.
 * Landowner Outreach — send email  (v10.210)
 * ──────────────────────────────────────────────────────────────────────────
 * Adds a `send_email` action to the "Cassidy Landform Backend" Apps Script so the
 * "📬 Approach Landowner" stage can send a REVIEWED email straight from Landform —
 * and send it FROM YOUR COMPANY ADDRESS (e.g. phil.daniel@cassidygroupltd.com).
 *
 * HOW "FROM YOUR COMPANY ADDRESS" WORKS
 * Apps Script sends as the Google account that owns/deploys this script. To make the
 * email come FROM phil.daniel@cassidygroupltd.com instead, that address must be a
 * verified "Send mail as" alias on THAT Google account. One-time Gmail setup:
 *   Gmail ▸ ⚙ Settings ▸ "Accounts and Import" ▸ "Send mail as" ▸ "Add another email
 *   address" ▸ enter phil.daniel@cassidygroupltd.com ▸ verify via the confirmation
 *   email. (If cassidygroupltd.com is itself the Google Workspace account that owns
 *   the script, it's already the primary sender — nothing to set up.)
 * The app passes the chosen "from" address; the handler uses it ONLY if it's the
 * account's primary address or a verified alias, otherwise it falls back to the
 * account's own address and tells you which it used (returned as sentFrom).
 *
 * SETUP — TWO steps, ~2 minutes:
 *   STEP 1 — paste handleSendEmail() below into Code.gs (e.g. under handleSaveDeal).
 *   STEP 2 — add ONE line to doPost(e), next to the other POST actions:
 *
 *              if (data.action === "send_email") return respond(handleSendEmail(data));
 *
 *   Then RE-DEPLOY (Deploy ▸ Manage deployments ▸ Edit ▸ New version). The FIRST send
 *   asks you to authorise the Gmail scope — accept it. (GmailApp needs Gmail access;
 *   the plain MailApp used elsewhere does not, which is why this uses GmailApp — only
 *   GmailApp can send from an alias.)
 *
 * The app POSTs: { action:"send_email", token, to, subject, body, from, replyTo, fromName }.
 * QUOTA: ~100 emails/day on a consumer Gmail account, ~1,500/day on Google Workspace.
 */

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

  // Send FROM the requested company address if it's this account's primary or a verified alias.
  var sentFrom = "";
  try {
    var primary = "";
    try { primary = Session.getActiveUser().getEmail(); } catch (e) {}
    var aliases = [];
    try { aliases = GmailApp.getAliases(); } catch (e) {}
    var fromReq = String((data && data.from) || "").trim();
    if (fromReq && (fromReq === primary || aliases.indexOf(fromReq) >= 0)) {
      options.from = fromReq; sentFrom = fromReq;
    } else {
      sentFrom = primary || "(the backend account)";   // requested alias not set up → send from primary
    }
    GmailApp.sendEmail(to, subject || "(no subject)", body, options);
  } catch (err) {
    return { status: "error", message: String(err) };
  }

  // Optional audit log — one row per send. Delete this block if you don't want it.
  try {
    var sh = getOrCreateSheet("SentEmails", ["timestamp", "userId", "to", "subject", "from", "replyTo"]);
    sh.appendRow([new Date(), String((data && data.userId) || ""), to, subject, sentFrom, replyTo]);
  } catch (e) { /* logging is best-effort */ }

  return { status: "ok", sentTo: to, sentFrom: sentFrom };
}

/* ── WIRING (add to your existing doPost router) ─────────────────────────────

     if (data.action === "save_deal")   return respond(handleSaveDeal(data));
     if (data.action === "list_deals")  return respond(handleListDeals(data));
+    if (data.action === "send_email")  return respond(handleSendEmail(data));   // ← ADD

──────────────────────────────────────────────────────────────────────────── */
