/**
 * ⚠ SUPERSEDED — use docs/backend-all-in-one.gs (one file wires everything). Kept for reference.
 * Portfolio — landowner outreach status in the deal list  (v10.211)
 * ──────────────────────────────────────────────────────────────────────────
 * OPTIONAL. The Deal Dashboard already shows a deal's landowner-outreach status
 * (last contacted / next follow-up) from the live deal — no backend needed.
 * To also show it on each PORTFOLIO CARD, the list_deals summary must carry three
 * fields, parsed from the deal payload. This snippet shows how to add them.
 *
 * In your existing handleListDeals(), where you build the summary object for each
 * deal from its payload JSON, add the three outreach fields. The app reads:
 *   deal.outreachLast     — timestamp (ms) of the most recent outreach log entry
 *   deal.outreachChannel  — "email" | "letter" | "call"
 *   deal.outreachFollowUp — the next follow-up date string (yyyy-mm-dd), if set
 *
 * Example — a helper you call with the parsed payload, merging its result into
 * the summary you already return per deal:
 */

function outreachSummary_(payloadObj) {
  var out = { outreachLast: 0, outreachChannel: "", outreachFollowUp: "" };
  try {
    var o = (payloadObj && payloadObj.outreach) || {};
    var log = Array.isArray(o.log) ? o.log : [];
    for (var i = 0; i < log.length; i++) {
      var ts = Number(log[i] && log[i].ts) || 0;
      if (ts > out.outreachLast) { out.outreachLast = ts; out.outreachChannel = String(log[i].channel || ""); }
    }
    if (!out.outreachLast && Number(o.emailSentAt) > 0) { out.outreachLast = Number(o.emailSentAt); out.outreachChannel = "email"; }
    out.outreachFollowUp = String(o.followUpDate || "");
  } catch (e) {}
  return out;
}

/* ── WIRING — inside handleListDeals(), for each deal, after you JSON.parse its payload ─────

     var payloadObj = JSON.parse(payload);            // you likely already parse it for dealName/gdv/etc.
     var summary = {
       dealId: id,
       dealName: payloadObj.dealName,
       // ... your existing summary fields (gdv, scheme, address, lastModified, createdBy, role) ...
     };
+    var os = outreachSummary_(payloadObj);           // ← ADD
+    summary.outreachLast     = os.outreachLast;      // ← ADD
+    summary.outreachChannel  = os.outreachChannel;   // ← ADD
+    summary.outreachFollowUp = os.outreachFollowUp;  // ← ADD
     deals.push(summary);

   Re-deploy (new version). The portfolio cards then show a "📬 Contacted … · Follow-up …" line.
   If your list_deals returns the whole payload rather than a trimmed summary, the app already
   has data.outreach and this snippet isn't needed — the card reads the same fields.
──────────────────────────────────────────────────────────────────────────── */
