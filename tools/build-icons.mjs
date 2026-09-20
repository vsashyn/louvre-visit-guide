#!/usr/bin/env node
/**
 * Home-screen icons, rendered from tools/icon.svg.
 *
 * Generated rather than committed so the mark has one source. The maskable
 * variant keeps the drawing inside the middle 80%, because Android crops the
 * rest to whatever shape the launcher uses.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const OUT = join(ROOT, 'public', 'icons')
const svg = readFileSync(join(ROOT, 'tools', 'icon.svg'))

mkdirSync(OUT, { recursive: true })

const flat = async (size, name) => {
  const buf = await sharp(svg, { density: 384 }).resize(size, size).png().toBuffer()
  writeFileSync(join(OUT, name), buf)
  return buf.length
}

const maskable = async (size, name) => {
  const inner = Math.round(size * 0.8)
  const pad = Math.round((size - inner) / 2)
  const art = await sharp(svg, { density: 384 }).resize(inner, inner).png().toBuffer()
  const buf = await sharp({
    create: { width: size, height: size, channels: 4, background: '#0b0b0c' },
  })
    .composite([{ input: art, top: pad, left: pad }])
    .png()
    .toBuffer()
  writeFileSync(join(OUT, name), buf)
  return buf.length
}

let bytes = 0
bytes += await flat(192, 'icon-192.png')
bytes += await flat(512, 'icon-512.png')
bytes += await flat(180, 'apple-touch-icon.png')
bytes += await maskable(512, 'icon-maskable-512.png')
console.log(`  icons  4 files  ${(bytes / 1024).toFixed(0)} KB`)
