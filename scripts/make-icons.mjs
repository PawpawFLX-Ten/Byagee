// Zero-dependency PWA icon generator: renders the "tape seal" mark
// (dark room background + angled grey tape strip, echoing the tape skill)
// and encodes RGBA PNGs via node:zlib. Run: node scripts/make-icons.mjs
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')

const CRC_TABLE = new Int32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  CRC_TABLE[n] = c
}
function crc32(buf) {
  let c = -1
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0 // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// --- Mark rendering -------------------------------------------------------

const BG = [0x1e, 0x1a, 0x16]
const TAPE = [0xd0, 0xd0, 0xd0]
const EDGE = [0xb8, 0xb8, 0xb8]

/**
 * Distance test for a rectangle centred at (cx,cy), half-size (hw,hh),
 * rotated by rad around its centre. Returns signed distance in px
 * (positive outside).
 */
function rectSDF(px, py, cx, cy, hw, hh, cosR, sinR) {
  const dx = px - cx
  const dy = py - cy
  const lx = dx * cosR + dy * sinR
  const ly = -dx * sinR + dy * cosR
  const ox = Math.abs(lx) - hw
  const oy = Math.abs(ly) - hh
  const outside = Math.hypot(Math.max(ox, 0), Math.max(oy, 0))
  const inside = Math.min(Math.max(ox, oy), 0)
  return outside + inside
}

function render(size) {
  const rgba = Buffer.alloc(size * size * 4)
  const s = size / 512 // scale factor from the 512 reference frame
  const rad = (8 * Math.PI) / 180
  const cosR = Math.cos(rad)
  const sinR = Math.sin(rad)
  const cx = size / 2
  const cy = size / 2

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = x + 0.5
      const py = y + 0.5
      let r = BG[0]
      let g = BG[1]
      let b = BG[2]

      // Main tape strip: 340x86 ref units, centred.
      const dTape = rectSDF(px, py, cx, cy, 170 * s, 43 * s, cosR, sinR)
      // Fibre edge inset band for a woven-tape read.
      if (dTape <= 0) {
        const inner = dTape > -5 * s
        const col = inner ? EDGE : TAPE
        r = col[0]
        g = col[1]
        b = col[2]
        // Subtle diagonal weave highlight every 24px.
        const wx = ((px * cosR + py * sinR) % 24 + 24) % 24
        if (!inner && wx < 12) {
          r = Math.min(255, r + 14)
          g = Math.min(255, g + 14)
          b = Math.min(255, b + 14)
        }
      }

      // Small "seal" dot: gold circle upper-left of the tape centre.
      const dDot = Math.hypot(px - (cx - 92 * s), py - (cy - 0)) - 20 * s
      if (dDot <= 0) {
        r = 0xf0
        g = 0xc1
        b = 0x4a
      }

      const i = (y * size + x) * 4
      rgba[i] = r
      rgba[i + 1] = g
      rgba[i + 2] = b
      rgba[i + 3] = 255
    }
  }
  return rgba
}

mkdirSync(outDir, { recursive: true })
for (const size of [192, 512]) {
  const file = join(outDir, `icon-${size}.png`)
  writeFileSync(file, encodePng(size, size, render(size)))
  console.log(`wrote ${file}`)
}
