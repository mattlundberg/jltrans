#!/usr/bin/env node
/**
 * scan-spam.mjs — permanent clean-room guard for the jltrans.com rebuild.
 *
 * WHY THIS EXISTS
 * ---------------
 * The previous jltrans.com WordPress install was compromised: it served cloaked
 * Japanese counterfeit-goods spam to search-engine user agents via injected
 * `buy.php` / `item.php` gateways and a rewritten robots.txt, while showing the
 * real site to browsers. The rebuild deliberately carries over prose only.
 *
 * This script makes that boundary mechanical instead of relying on memory. It
 * runs as `prebuild` (against src/ + public/), as `postbuild` (against dist/),
 * and as a required CI check. It also catches reinfection or a careless paste
 * months from now.
 *
 * USAGE
 *   node scripts/scan-spam.mjs [--strict] [--todos-only] <dir> [dir...]
 *
 *   --strict      Promote TODO_CLIENT placeholders from warning to error.
 *                 Used only by `npm run build:launch` for the production build,
 *                 so the site cannot ship with an unresolved blank in it.
 *   --todos-only  Report outstanding TODO_CLIENT placeholders and exit 0.
 *                 This output is the client punch-list.
 *
 * Exit code 0 = clean, 1 = violation found.
 */

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, extname, relative, sep, basename } from 'node:path';

const args = process.argv.slice(2);
const STRICT = args.includes('--strict');
const TODOS_ONLY = args.includes('--todos-only');
const targets = args.filter((a) => !a.startsWith('--'));

if (targets.length === 0) {
  console.error('usage: node scripts/scan-spam.mjs [--strict] [--todos-only] <dir> [dir...]');
  process.exit(1);
}

const ROOT = process.cwd();

// Directories never worth walking.
const SKIP_DIRS = new Set(['node_modules', '.git', '.astro', '.netlify', '.output']);

// Files we read as text. Anything else is treated as binary and byte-scanned
// for CJK, because "it's only an image" is exactly how a payload gets through.
const TEXT_EXT = new Set([
  '.astro', '.ts', '.tsx', '.js', '.mjs', '.cjs', '.jsx', '.json', '.jsonc', '.md', '.mdx',
  '.css', '.html', '.htm', '.txt', '.xml', '.svg', '.yml', '.yaml', '.csv',
]);

// Extensionless text files that would otherwise be misread as binary.
const TEXT_NAMES = new Set(['_redirects', '_headers', '.assetsignore', '.env.example']);

// This scanner necessarily contains the patterns it hunts for. Without this
// marker it would flag itself and fail every build.
const SELF = 'scan-spam.mjs';

/* -------------------------------------------------------------------------- */
/* Rules                                                                      */
/* -------------------------------------------------------------------------- */

// CJK ranges: punctuation, hiragana, katakana, unified ideographs, halfwidth/
// fullwidth forms. The site is English-only, so ANY hit is spam or a mistake.
const CJK = /[　-〿぀-ゟ゠-ヿ一-鿿＀-￯]/u;
const CJK_G = new RegExp(CJK.source, 'gu');

const SIGNATURES = [
  { name: 'spam gateway (buy.php/item.php)', re: /\b(?:buy|item)\.php\b/i },
  { name: 'injected sitemap pattern', re: /sitemap\d{2,}\.xml/i },
  { name: 'spam-vertical keyword', re: /\b(?:viagra|cialis|casino|replica watch|rolex replica)\b/i },
  { name: 'wp-content path', re: /wp-content\//i },
  { name: 'wp-login reference', re: /wp-login\.php/i },
  { name: 'obfuscation primitive', re: /\b(?:eval|atob|unescape)\s*\(\s*(?:atob|unescape|["'])/i },
];

// Every external host the built site is allowed to reference. Anything else is
// a build failure, which is what makes an injected link impossible to miss.
const ALLOWED_HOSTS = new Set([
  'jltrans.com',
  'www.jltrans.com',
  // Association memberships cited in J&L's own copy.
  'trucking.org',
  'www.trucking.org',
  'arizonatrucking.com',
  'www.arizonatrucking.com',
  'intermodal.org',
  'www.intermodal.org',
  'uiia.org',
  'www.uiia.org',
  // Schema.org vocabulary URLs in JSON-LD (never fetched by the browser).
  'schema.org',
  // NOTE: the hosted form platform gets added here once selected.
]);

/**
 * Placeholder detection.
 *
 * Deliberately narrow. Both patterns are bounded to a single line and to a sane
 * label length: an unbounded `[^'"`]+` happily ran across newlines and captured
 * half of site.ts as one "label".
 *
 * `TODO_CLIENT(...)` is matched in sources only, and `[NEEDS: ...]` in rendered
 * HTML only — where it represents a hole a visitor would actually see. Applying
 * either rule to the other domain produced false positives from bundled source
 * and from doc comments that describe the syntax.
 */
const TODO_RE = /TODO_CLIENT\(\s*(['"`])([^'"`\n]{3,160})\1/g;
const NEEDS_RE = /\[NEEDS:\s*([^\]\n]{3,160})\]/g;

/** Filters out doc-comment illustrations rather than real call sites. */
function isIllustration(label) {
  return label.includes('${') || label.includes('…') || label === 'label';
}

/* -------------------------------------------------------------------------- */
/* Walk                                                                       */
/* -------------------------------------------------------------------------- */

function* walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      yield* walk(join(dir, e.name));
    } else if (e.isFile()) {
      yield join(dir, e.name);
    }
  }
}

const errors = [];
const warnings = [];
const todos = new Map();
let filesScanned = 0;
let bytesScanned = 0;

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

function checkText(file, text) {
  const rel = relative(ROOT, file);
  const isSelf = rel.includes(SELF);

  // 1. CJK codepoints.
  const cjk = text.match(CJK_G);
  if (cjk && !isSelf) {
    const first = text.search(CJK);
    errors.push(
      `${rel}:${lineOf(text, first)}  ${cjk.length} CJK character(s) — first: ${JSON.stringify(cjk.slice(0, 8).join(''))}`
    );
  }

  // 2. Spam signatures.
  if (!isSelf) {
    for (const { name, re } of SIGNATURES) {
      const m = re.exec(text);
      if (m) errors.push(`${rel}:${lineOf(text, m.index)}  ${name} — ${JSON.stringify(m[0])}`);
    }
  }

  // 3. Insecure subresources. Ignore XML namespaces and doctype URLs, which are
  //    identifiers rather than things the browser fetches.
  for (const m of text.matchAll(/(?:href|src)\s*=\s*["'](http:\/\/[^"']+)/gi)) {
    if (/(?:w3\.org|schema\.org|purl\.org)/i.test(m[1])) continue;
    errors.push(`${rel}:${lineOf(text, m.index)}  insecure http:// subresource — ${m[1]}`);
  }

  // 4. Outbound-domain allowlist (built output only — src/ has no final URLs).
  if (rel.startsWith(`dist${sep}`) && /\.html?$/.test(file)) {
    for (const m of text.matchAll(/(?:href|src)\s*=\s*["'](?:https?:)?\/\/([^/"'?#]+)/gi)) {
      const host = m[1].toLowerCase();
      if (!ALLOWED_HOSTS.has(host)) {
        errors.push(
          `${rel}:${lineOf(text, m.index)}  outbound host not on allowlist — ${host}` +
            `\n      If this is intentional, add it to ALLOWED_HOSTS in scripts/scan-spam.mjs.`
        );
      }
    }
  }

  // 5. Oversized inline <style>. Avada shipped ~1.2 MB of inline CSS per page;
  //    this asserts we never regress into that.
  for (const m of text.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    const size = m[1].length;
    if (size > 12_000) {
      errors.push(`${rel}:${lineOf(text, m.index)}  inline <style> is ${(size / 1024).toFixed(1)} KB (limit 12 KB)`);
    }
  }

  // 6. Unresolved client placeholders.
  if (!isSelf) {
    const record = (label, index) => {
      const clean = label.trim();
      if (isIllustration(clean)) return;
      if (!todos.has(clean)) todos.set(clean, []);
      todos.get(clean).push(`${rel}:${lineOf(text, index)}`);
    };

    const inDist = rel.startsWith(`dist${sep}`);

    if (!inDist) {
      // Source call sites: TODO_CLIENT('label').
      for (const m of text.matchAll(TODO_RE)) record(m[2], m.index);
    } else if (/\.html?$/.test(file)) {
      // Rendered output: a visible [NEEDS: …] a visitor would read.
      for (const m of text.matchAll(NEEDS_RE)) record(m[1], m.index);
    }
  }
}

function checkBinary(file, buf) {
  const rel = relative(ROOT, file);

  if (extname(file).toLowerCase() !== '.pdf') {
    // Images and fonts are NOT CJK-scanned.
    //
    // Compressed and encoded binary data produces byte sequences that decode to
    // CJK codepoints purely by chance — scanning it generates noise, not signal.
    // (Every one of our five clean PDFs "contained" dozens of CJK characters
    // under a naive byte scan.) The real control for images is re-encoding
    // through Sharp, which discards any appended payload wholesale.
    return;
  }

  const raw = buf.toString('latin1');

  // Active content is the genuine risk in a PDF. Word boundaries matter: a bare
  // `includes('/JS')` also matches `/JSName` and similar.
  const tokens = [
    /\/JavaScript\b/,
    /\/JS\b/,
    /\/Launch\b/,
    /\/EmbeddedFile\b/,
    /\/SubmitForm\b/,
    /\/ImportData\b/,
    /\/RichMedia\b/,
  ];
  for (const re of tokens) {
    const m = re.exec(raw);
    if (m) {
      errors.push(`${rel}  PDF contains active-content token ${m[0]} — re-export this file without it`);
    }
  }

  // CJK check on the uncompressed portions only: strip every stream object,
  // leaving document structure and metadata (/Title, /Author, /Keywords). That
  // is where injected spam text in a PDF would actually be readable.
  const structure = raw.replace(/stream[\s\S]*?endstream/g, ' ');
  const cjk = Buffer.from(structure, 'latin1').toString('utf8').match(CJK_G);
  if (cjk) {
    errors.push(
      `${rel}  PDF metadata contains ${cjk.length} CJK character(s) — ${JSON.stringify(cjk.slice(0, 8).join(''))}`
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Run                                                                        */
/* -------------------------------------------------------------------------- */

for (const target of targets) {
  if (!existsSync(target)) {
    // dist/ legitimately does not exist before the first build.
    console.log(`  (skipping ${target} — not present)`);
    continue;
  }
  const st = statSync(target);
  const files = st.isDirectory() ? [...walk(target)] : [target];
  for (const file of files) {
    const buf = readFileSync(file);
    filesScanned++;
    bytesScanned += buf.length;
    if (TEXT_EXT.has(extname(file).toLowerCase()) || TEXT_NAMES.has(basename(file))) {
      checkText(file, buf.toString('utf8'));
    } else {
      checkBinary(file, buf);
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Report                                                                     */
/* -------------------------------------------------------------------------- */

const todoList = [...todos.entries()].sort(([a], [b]) => a.localeCompare(b));

if (TODOS_ONLY) {
  if (todoList.length === 0) {
    console.log('No outstanding TODO_CLIENT items. Everything is filled in.');
  } else {
    console.log(`\nClient punch-list — ${todoList.length} outstanding item(s):\n`);
    for (const [label, locs] of todoList) {
      console.log(`  • ${label}`);
      for (const l of locs) console.log(`      ${l}`);
    }
    console.log('');
  }
  process.exit(0);
}

const scope = targets.join(', ');
console.log(
  `scan-spam: ${filesScanned} file(s), ${(bytesScanned / 1024).toFixed(0)} KB scanned in ${scope}${STRICT ? ' [strict]' : ''}`
);

if (todoList.length > 0) {
  const msg = `${todoList.length} unresolved TODO_CLIENT placeholder(s): ${todoList.map(([l]) => l).join(', ')}`;
  if (STRICT) {
    errors.push(`--strict: ${msg}\n      Run \`npm run todos\` for locations. These must be resolved before launch.`);
  } else {
    warnings.push(`${msg}\n      Expected during scaffold. Run \`npm run todos\` for the punch-list.`);
  }
}

for (const w of warnings) console.log(`\n  WARN  ${w}`);

if (errors.length > 0) {
  console.error(`\n  ${errors.length} violation(s) found:\n`);
  for (const e of errors) console.error(`  FAIL  ${e}`);
  console.error('\nSee the "Clean-room migration" section of the project plan for why this gate exists.\n');
  process.exit(1);
}

console.log(warnings.length ? '\nscan-spam: clean (with warnings).\n' : 'scan-spam: clean.\n');
