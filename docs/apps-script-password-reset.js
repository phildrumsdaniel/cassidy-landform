/**
 * PASSWORD RESET — Apps Script backend add-on for Landform
 * =========================================================
 *
 * Landform's login runs on your Google Apps Script web app (not in this repo).
 * This file is the code to PASTE INTO that script to enable the new
 * "Forgot password?" flow that the app (v9.80+) now calls.
 *
 * HOW THE FLOW WORKS
 *   1. User taps "Forgot password?" and enters their email.
 *      → app calls  action=request_reset&email=...
 *      → we generate a 6-digit code, store it (15-min expiry) and EMAIL it
 *        to that address using Google's built-in MailApp (sent from you,
 *        the script owner). We always reply the same way so we never reveal
 *        which emails have accounts.
 *   2. User enters the code + a new password.
 *      → app calls  action=reset_password&email=...&code=...&password=...
 *      → we check the code is valid + unexpired, then overwrite the stored
 *        password hash. ANY password is accepted — including one used before
 *        (there is deliberately NO password-reuse restriction).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * STEP 1 — Wire the two new actions into your existing doGet(e) router.
 *          Find where you dispatch on the action (e.g. the big
 *          if(action==="login")... block) and add these two lines:
 *
 *            if (action === "request_reset")
 *              return _lfRequestReset(e.parameter.email);
 *            if (action === "reset_password")
 *              return _lfResetPassword(e.parameter.email, e.parameter.code, e.parameter.password);
 *
 * STEP 2 — Paste EVERYTHING below into the same script file.
 *
 * STEP 3 — Re-deploy: Deploy ▸ Manage deployments ▸ (edit the active one) ▸
 *          Version = "New version" ▸ Deploy. The very first time it emails,
 *          Google will ask you to authorise the MailApp (send email) scope —
 *          approve it once with your own Google account.
 *
 * NOTE ON assumptions (adjust only if your script differs):
 *   • Your users live on a sheet tab named "Users" with a header row whose
 *     columns include "email" and "passwordHash". _lfUsers_() finds them by
 *     header name, so column ORDER doesn't matter.
 *   • Your login already defines hashPassword(password, salt) with
 *     salt = the lowercased email. We reuse that exact function so hashes
 *     stay compatible. (If yours is named differently, change the one call
 *     in _lfResetPassword marked "<-- hash".)
 *   • The script is container-bound to the spreadsheet
 *     (SpreadsheetApp.getActiveSpreadsheet()). If instead you open by ID,
 *     replace _lfBook_() below with: return SpreadsheetApp.openById("YOUR_ID");
 * ───────────────────────────────────────────────────────────────────────── */

function _lfBook_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function _lfJson_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// The Users sheet + a header-name → column-index (1-based) map.
function _lfUsers_() {
  var sh = _lfBook_().getSheetByName("Users");
  if (!sh) return null;
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var col = {};
  for (var i = 0; i < headers.length; i++) {
    col[String(headers[i]).trim().toLowerCase()] = i + 1;
  }
  return { sheet: sh, col: col };
}

// Find a user's 1-based row number by email (case-insensitive). 0 if not found.
function _lfFindUserRow_(users, email) {
  var emailCol = users.col["email"];
  if (!emailCol) return 0;
  var last = users.sheet.getLastRow();
  if (last < 2) return 0;
  var vals = users.sheet.getRange(2, emailCol, last - 1, 1).getValues();
  for (var i = 0; i < vals.length; i++) {
    if (String(vals[i][0]).trim().toLowerCase() === email) return i + 2;
  }
  return 0;
}

// A dedicated "Resets" sheet holds pending codes so we never touch the Users schema.
function _lfResetSheet_() {
  var ss = _lfBook_();
  var sh = ss.getSheetByName("Resets");
  if (!sh) {
    sh = ss.insertSheet("Resets");
    sh.appendRow(["email", "code", "expires", "createdAt"]);
  }
  return sh;
}

// ── STEP 1 handler ── email a 6-digit code (only if the account exists) ──────
function _lfRequestReset(email) {
  email = String(email || "").trim().toLowerCase();
  if (!email || email.indexOf("@") < 0)
    return _lfJson_({ status: "error", message: "Valid email required" });

  var users = _lfUsers_();
  var generic = { status: "ok",
    message: "If that email has an account, a reset code is on its way — check your inbox (and spam)." };
  if (!users) return generic;

  var row = _lfFindUserRow_(users, email);
  if (row) {
    // 6-digit code, 15-minute expiry
    var code = String(Math.floor(100000 + Math.random() * 900000));
    var expires = Date.now() + 15 * 60 * 1000;
    _lfResetSheet_().appendRow([email, code, expires, new Date()]);
    try {
      MailApp.sendEmail({
        to: email,
        subject: "Your Landform password reset code",
        body: "Your Landform password reset code is: " + code + "\n\n"
            + "Enter it in the app within 15 minutes to set a new password.\n\n"
            + "If you didn't request this, ignore this email — your password will not change.\n\n"
            + "— Cassidy Group Landform"
      });
    } catch (err) {
      // Never leak mail/send failures to the client; the generic reply stands.
    }
  }
  return generic;
}

// ── STEP 2 handler ── verify the code, set the new password ──────────────────
function _lfResetPassword(email, code, newPassword) {
  email = String(email || "").trim().toLowerCase();
  code = String(code || "").trim();
  newPassword = String(newPassword || "");

  if (!email || email.indexOf("@") < 0)
    return _lfJson_({ status: "error", message: "Valid email required" });
  if (!code)
    return _lfJson_({ status: "error", message: "Enter the code from your email" });
  if (newPassword.length < 6)
    return _lfJson_({ status: "error", message: "New password must be 6+ characters" });

  var rs = _lfResetSheet_();
  var data = rs.getDataRange().getValues();  // row 0 = header
  var now = Date.now();
  var hitRow = -1;   // 0-based index into `data`
  // Scan newest-first so the latest code for this email wins.
  for (var i = data.length - 1; i >= 1; i--) {
    var rEmail = String(data[i][0]).trim().toLowerCase();
    var rCode  = String(data[i][1]).trim();
    if (rEmail === email && rCode === code) {
      var rExp = Number(data[i][2]);
      if (rExp && now > rExp)
        return _lfJson_({ status: "error", message: "That code has expired — request a new one" });
      hitRow = i;
      break;
    }
  }
  if (hitRow < 0)
    return _lfJson_({ status: "error", message: "Invalid or expired code" });

  var users = _lfUsers_();
  if (!users) return _lfJson_({ status: "error", message: "User store unavailable" });
  var urow = _lfFindUserRow_(users, email);
  if (!urow) return _lfJson_({ status: "error", message: "No account found" });
  var hashCol = users.col["passwordhash"];
  if (!hashCol) return _lfJson_({ status: "error", message: "Password column not found" });

  // Overwrite the hash. No reuse check — the same password as before is fine.
  var newHash = hashPassword(newPassword, email);   // <-- hash (salt = email)
  users.sheet.getRange(urow, hashCol).setValue(newHash);

  // Consume the code so it can't be replayed.
  rs.deleteRow(hitRow + 1);

  return _lfJson_({ status: "ok", message: "Password updated — sign in with your new password." });
}
