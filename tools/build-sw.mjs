#!/usr/bin/env node
/**
 * Generate dist/sw.js from tools/sw-template.js after vite has written dist/.
 *
 * The precache list is everything in dist/ that is not an image and not the
 * worker itself. The version is a hash of those files' contents, so a build
 * that changes nothing produces a byte-identical worker and the visitor is
 * never prompted to update for nothing.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const DIST = join(ROOT, 'dist')

/** Cloudflare reads _headers at deploy time and never serves it. */
const SKIP = new Set(['sw.js', '_headers', '_redirects', '.DS_Store'])

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else out.push(full)
  }
  return out
}

const files = walk(DIST)
  .map((f) => relative(DIST, f))
  .filter((f) => !SKIP.has(f) && !f.startsWith('images/') && !f.endsWith('.map'))
  .sort()

if (!files.includes('index.html')) {
  console.error('build-sw: dist/index.html is missing, did vite build run?')
  process.exit(1)
}

const template = readFileSync(join(ROOT, 'tools', 'sw-template.js'), 'utf8')

// The worker's own source goes into the version too. Without it, editing the
// caching logic leaves the cache name unchanged and the new worker inherits
// entries written by the old rules.
const hash = createHash('sha256').update(template)
let bytes = 0
for (const f of files) {
  const buf = readFileSync(join(DIST, f))
  bytes += buf.length
  hash.update(f).update(createHash('sha256').update(buf).digest())
}
const version = hash.digest('hex').slice(0, 12)

// index.html is precached as "/" because that is the URL the asset server
// serves without a redirect, and only a non-redirected response may answer a
// navigation.
const shell = files.map((f) => (f === 'index.html' ? '/' : '/' + f))
const worker = template
  .replace('__VERSION__', version)
  .replace('__SHELL__', JSON.stringify(shell, null, 2))

writeFileSync(join(DIST, 'sw.js'), worker)

const kb = (bytes / 1024).toFixed(0)
console.log(`  sw.js  version ${version}  ${files.length} files precached  ${kb} KB`)
if (bytes > 1024 * 1024) {
  console.log(`  note: the shell is over the 1 MB budget by ${((bytes - 1024 * 1024) / 1024).toFixed(0)} KB`)
}
// A shell this size stops being one thing the install event can swallow whole.
if (bytes > 4 * 1024 * 1024) {
  console.error('build-sw: shell precache above 4 MB, that will half-fail on a phone')
  process.exit(1)
}
