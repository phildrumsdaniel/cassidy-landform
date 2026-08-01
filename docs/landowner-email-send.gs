/**
 * Landowner Outreach — send email  (v10.209)
 * ──────────────────────────────────────────────────────────────────────────
 * Adds a `send_email` action to the "Cassidy Landform Backend" Apps Script so the
 * "📬 Approach Landowner" stage can send a REVIEWED email straight from Landform.
 *
 * The email is sent by Google's MailApp FROM the account that owns/deploys this
 * script (i.e. your Cassidy Google account), with the Reply-To set to the sender's
 * address so replies come back to them. The user reviews and confirms every send in
 * the app first — this only ever sends ONE email, to one address, on an explicit click.
 *
 * Written to match your backend's conventions (respond / getOrCreateSheet / handleX).
 * TWO steps, ~2 minutes:
 *
 *   STEP 1 — paste handleSendEmail() below into Code.gs (e.g. under handleSaveDeal).
 *
 *   STEP 2 — add ONE line to doPost(e), next to the other POST actions:
 *
 *              if (data.action === "send_email") return respond(handleSendEmail(data));
 *
 *   Then RE-DEPLOY: Deploy ▸ Manage deployments ▸ (your Web App) ▸ Edit ▸
 *   Version: New version ▸ Deploy. The first send will ask you to authorise the
 *   Gmail/MailApp scope — accept it.
 *
 * The app POSTs: { action:"send_email", token, to, subject, body, replyTo, fromName }.
 * QUOTA: MailApp sends ~100 emails/day on a consumer Gmail account, ~1,500/day on a
 * Google Workspace account. That's ample for one-to-one landowner approaches.
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

  try {
    MailApp.sendEmail(to, subject || "(no subject)", body, options);
  } catch (err) {
    return { status: "error", message: String(err) };
  }

  // Optional audit log — one row per send. Delete this block if you don't want it.
  try {
    var sh = getOrCreateSheet("SentEmails", ["timestamp", "userId", "to", "subject", "replyTo"]);
    sh.appendRow([new Date(), String((data && data.userId) || ""), to, subject, replyTo]);
  } catch (e) { /* logging is best-effort */ }

  return { status: "ok", sentTo: to };
}

/* ── WIRING (add to your existing doPost router) ─────────────────────────────

     if (data.action === "save_deal")   return respond(handleSaveDeal(data));
     if (data.action === "list_deals")  return respond(handleListDeals(data));
+    if (data.action === "send_email")  return respond(handleSendEmail(data));   // ← ADD

──────────────────────────────────────────────────────────────────────────── */
