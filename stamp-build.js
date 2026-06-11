#!/usr/bin/env node
/*
 * stamp-build.js — cache-busting version stamper for the static site.
 *
 * Why: index.html loads ~40 local <script>/<link> files. Browsers (and the
 * GitHub Pages CDN) cache them by URL, so when a file changes but its URL does
 * not, users keep running stale code until a hard refresh. This script appends
 * a short CONTENT HASH to every local asset URL (?v=<hash>). When a file's
 * contents change, its hash changes, so the browser fetches the new version;
 * unchanged files keep their hash and stay cached. No hard refresh needed.
 *
 * Usage:  node stamp-build.js
 * It rewrites index.html in place. Safe to run repeatedly (idempotent for
 * unchanged files). Run it before committing, or let the GitHub Action
 * (.github/workflows/stamp-assets.yml) run it automatically on push.
 */
var fs = require("fs");
var path = require("path");
var crypto = require("crypto");

var ROOT = __dirname;
var HTML = path.join(ROOT, "index.html");

function shortHash(absPath){
  try {
    var buf = fs.readFileSync(absPath);
    return crypto.createHash("md5").update(buf).digest("hex").slice(0, 10);
  } catch (e) {
    return null; // file missing — leave the URL untouched
  }
}

var html = fs.readFileSync(HTML, "utf8");
var stamped = 0, skipped = 0;

// Match src="js/x.js(?v=...)" and href="css/x.css(?v=...)" for LOCAL assets only
// (anything starting with js/ or css/ — not the unpkg/fonts CDN URLs).
var assetRe = /\b(src|href)=("|')((?:js|css)\/[^"'?]+)(\?v=[^"']*)?\2/g;

html = html.replace(assetRe, function(full, attr, q, relPath){
  var hash = shortHash(path.join(ROOT, relPath));
  if (!hash) { skipped++; return full; }
  stamped++;
  return attr + "=" + q + relPath + "?v=" + hash + q;
});

fs.writeFileSync(HTML, html);
console.log("stamp-build: stamped " + stamped + " asset URL(s)" + (skipped ? ", skipped " + skipped + " (file not found)" : "") + " in index.html");
