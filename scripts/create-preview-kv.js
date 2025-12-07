#!/usr/bin/env node
/*
 * Helper: create-preview-kv.js
 *
 * Creates a Cloudflare KV namespace in preview mode using Wrangler and
 * injects the returned preview_id into `wrangler.toml` for the `KV_CACHE`
 * namespace. This automates the manual steps required by `wrangler dev --remote`.
 *
 * Usage:
 *   npm run kv:create:preview
 *
 * Notes:
 * - This script shells out to `npx wrangler` and requires you to be logged in
 *   (`npx wrangler login`).
 * - If your Wrangler supports JSON output, the script will use it. Otherwise
 *   it will attempt to extract the id from human-readable output.
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const NAMESPACE_NAME = process.argv[2] || 'bible-image-kv-dev-preview';
const WRANGLER_CMD = `npx wrangler kv:namespace create ${NAMESPACE_NAME} --preview --json`;
const TOML_PATH = path.resolve(__dirname, '..', 'wrangler.toml');

function run(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { maxBuffer: 1024 * 1024 * 10 }, (err, stdout, stderr) => {
      if (err) return reject({ err, stdout, stderr });
      resolve({ stdout, stderr });
    });
  });
}

function updateWranglerToml(previewId) {
  let toml = fs.readFileSync(TOML_PATH, 'utf8');

  // Find the first occurrence of the KV_CACHE kv_namespace block and inject preview_id
  const kvBlockRegex = /(\[\[kv_namespaces\]\][\s\S]*?binding\s*=\s*"KV_CACHE"[\s\S]*?)(^\s*\n|$)/m;
  const match = toml.match(kvBlockRegex);

  if (!match) {
    console.error('Could not locate a KV_CACHE kv_namespaces block in wrangler.toml');
    process.exit(2);
  }

  const block = match[1];

  // If preview_id already exists in block, replace it; otherwise insert after binding/id lines
  if (/preview_id\s*=/.test(block)) {
    const newBlock = block.replace(/preview_id\s*=\s*"[^"]*"/, `preview_id = "${previewId}"`);
    toml = toml.replace(block, newBlock);
  } else {
    // Try to find an id line to insert after
    const idLineMatch = block.match(/(^\s*id\s*=\s*"[^"]*"\s*$)/m);
    if (idLineMatch) {
      const idLine = idLineMatch[1];
      const newBlock = block.replace(idLine, `${idLine}\npreview_id = "${previewId}"`);
      toml = toml.replace(block, newBlock);
    } else {
      // Fallback: append preview_id to block
      const newBlock = block + `\npreview_id = "${previewId}"`;
      toml = toml.replace(block, newBlock);
    }
  }

  fs.writeFileSync(TOML_PATH, toml, 'utf8');
  console.log(`Updated ${TOML_PATH} with preview_id = "${previewId}"`);
}

(async () => {
  console.log(`Creating preview KV namespace: ${NAMESPACE_NAME}`);

  try {
    let result;
    try {
      result = await run(WRANGLER_CMD);
    } catch (e) {
      // Retry without --json for older wrangler versions
      console.warn('Failed to run wrangler with --json, retrying without JSON...');
      const fallbackCmd = `npx wrangler kv:namespace create ${NAMESPACE_NAME} --preview`;
      result = await run(fallbackCmd);
    }

    const out = result.stdout || '';

    // Try to parse JSON first
    let parsed;
    try {
      parsed = JSON.parse(out);
      if (parsed && parsed.id) {
        updateWranglerToml(parsed.id);
        console.log('Done. You can now re-run `npm run dev:remote`.');
        process.exit(0);
      }
    } catch (jsonErr) {
      // Attempt to extract id from stdout using regex
      const idMatch = out.match(/id\s*:\s*"([0-9a-f-]+)"|"id"\s*:\s*"([0-9a-f-]+)"|([0-9a-f]{32,64})/i);
      const id = idMatch && (idMatch[1] || idMatch[2] || idMatch[3]);
      if (id) {
        updateWranglerToml(id);
        console.log('Done. You can now re-run `npm run dev:remote`.');
        process.exit(0);
      }
      console.error('Could not parse a preview id from Wrangler output.');
      console.error('Wrangler output:\n', out);
      process.exit(3);
    }
  } catch (err) {
    console.error('Error creating preview KV namespace:', err.err ? err.err.message : err);
    if (err.stdout) console.error(err.stdout);
    if (err.stderr) console.error(err.stderr);
    process.exit(4);
  }
})();
