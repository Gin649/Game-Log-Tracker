#!/usr/bin/env node
// Builds ra-patches-index.json: a flat list of every patch file path in the
// RetroAchievements/RAPatches repo. Run on a schedule by
// .github/workflows/build-ra-index.yml and committed into the repo, so the
// app fetches one small same-origin file on GitHub Pages instead of asking
// GitHub for the list from every visitor's browser.
//
// It used to ask GitHub's tree API for the whole repo in one call, but
// RAPatches is big enough that the call often timed out with a 500. Now it
// does a shallow clone that only downloads the file list (no file contents)
// and reads the paths with git ls-tree, the same way the guides index works.
//
// This intentionally does not build a RetroAchievements game-ID-to-title
// map. The app already knows each game's title and RA ID when someone opens
// that game's page, so a second database of every title isn't needed, and
// building one would mean keeping an RA Web API key in an Actions secret.
//
// Usage: node tools/build-ra-index.mjs [output-path]

import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const OWNER = 'RetroAchievements';
const REPO = 'RAPatches';
const PATCH_EXT = /\.(bps|ips|ups|ppf|aps|xdelta3?|vcdiff|vcd|zip|7z)$/i;
const outPath = process.argv[2] || 'ra-patches-index.json';

const REPO_URL = `https://github.com/${OWNER}/${REPO}.git`;

function git(args, opts = {}) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts });
}

async function main() {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'rapatches-'));
  try {
    // --filter=blob:none skips the patch files themselves and --no-checkout
    // leaves the working folder empty, so this only pulls down the file list.
    git(['clone', '--depth', '1', '--filter=blob:none', '--no-checkout', '--quiet', REPO_URL, tmp], { stdio: 'inherit' });
    const branch = git(['-C', tmp, 'rev-parse', '--abbrev-ref', 'HEAD']).trim() || 'main';
    const paths = git(['-C', tmp, '-c', 'core.quotePath=false', 'ls-tree', '-r', '--name-only', 'HEAD'])
      .split('\n')
      .filter(Boolean);

    const files = paths.filter((p) => PATCH_EXT.test(p)).sort();

    if (files.length < 100) {
      // A near-empty result almost always means something upstream broke,
      // not that the repo actually emptied out.
      throw new Error(`Only found ${files.length} patch files, that looks wrong for RAPatches, refusing to overwrite the index with a bad one.`);
    }

    const out = {
      generatedAt: new Date().toISOString(),
      owner: OWNER,
      repo: REPO,
      branch,
      count: files.length,
      files,
    };

    await fs.writeFile(outPath, JSON.stringify(out));
    console.log(`Wrote ${outPath}: ${files.length} patch files from ${OWNER}/${REPO}@${branch}`);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
