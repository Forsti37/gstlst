// Generates the placeholder logo (spec "Logo ideas", idea 1: round entry stamp), PWA icons
// and iOS splash screens, and writes the splash <link> tags into index.html.
// Output is committed, so this only needs re-running when the brand changes: npm run brand
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import opentype from 'opentype.js'
import sharp from 'sharp'

const RED = '#FF2D3D'
const BLUE = '#2D6BFF'
const WHITE = '#F5F5F5'
const BLACK = '#000000'

const fontFile = readFileSync('node_modules/@fontsource/anton/files/anton-latin-400-normal.woff')
const font = opentype.parse(fontFile.buffer.slice(fontFile.byteOffset, fontFile.byteOffset + fontFile.byteLength))

/** Text as outlines centered on (cx, cy), so the SVG never depends on an installed font. */
function textPath(text, cx, cy, size, letterSpacing = 0) {
  const path = font.getPath(text, 0, 0, size, { letterSpacing })
  const box = path.getBoundingBox()
  const dx = cx - (box.x1 + box.x2) / 2
  const dy = cy - (box.y1 + box.y2) / 2
  return `<path transform="translate(${dx.toFixed(2)} ${dy.toFixed(2)})" d="${path.toPathData(2)}"/>`
}

/** Stamp shapes in a 512 box, painted with currentColor so each channel can reuse them. */
const stampShapes = `
  <circle cx="256" cy="256" r="228" fill="none" stroke="currentColor" stroke-width="14"/>
  <circle cx="256" cy="256" r="202" fill="none" stroke="currentColor" stroke-width="4"/>
  <rect x="136" y="174" width="240" height="8" fill="currentColor"/>
  <rect x="136" y="330" width="240" height="8" fill="currentColor"/>
  <g fill="currentColor">${textPath('GSTLST', 256, 256, 122, 0.02)}</g>
`

/** The stereo offset: red left, blue right, white on top, tilted like a hand stamp. */
function stamp(offset = 5) {
  return `<g transform="rotate(-8 256 256)">
    <g color="${RED}" transform="translate(${-offset} 0)">${stampShapes}</g>
    <g color="${BLUE}" transform="translate(${offset} 0)">${stampShapes}</g>
    <g color="${WHITE}">${stampShapes}</g>
  </g>`
}

const svg = (w, h, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}</svg>\n`
const blackBg = (w, h) => `<rect width="${w}" height="${h}" fill="${BLACK}"/>`

function iconSvg(scale) {
  const shift = (512 * (1 - scale)) / 2
  return svg(512, 512, `${blackBg(512, 512)}<g transform="translate(${shift} ${shift}) scale(${scale})">${stamp()}</g>`)
}

function splashSvg(w, h) {
  const stampWidth = Math.min(w, h) * 0.5
  const scale = stampWidth / 512
  const x = (w - stampWidth) / 2
  const y = (h - stampWidth) / 2 - h * 0.03
  const tagline = textPath('EVERY SET COUNTS.', w / 2, y + stampWidth + stampWidth * 0.14, stampWidth * 0.075, 0.08)
  return svg(
    w,
    h,
    `${blackBg(w, h)}<g transform="translate(${x} ${y}) scale(${scale})">${stamp()}</g><g fill="#9A9AA0">${tagline}</g>`,
  )
}

const png = (markup, size, file) =>
  sharp(Buffer.from(markup), { density: 300 })
    .resize(size, size)
    .flatten({ background: BLACK })
    .png({ compressionLevel: 9, palette: true })
    .toFile(file)

mkdirSync('public/icons', { recursive: true })
mkdirSync('public/splash', { recursive: true })

writeFileSync('public/favicon.svg', iconSvg(1))
writeFileSync('public/icons/logo.svg', svg(512, 512, stamp()))

await png(iconSvg(1), 192, 'public/icons/icon-192.png')
await png(iconSvg(1), 512, 'public/icons/icon-512.png')
await png(iconSvg(0.74), 512, 'public/icons/maskable-512.png') // inside the maskable safe zone
await png(iconSvg(0.88), 180, 'public/icons/apple-touch-icon.png')

// [css width, css height, pixel ratio] of current iPhones and iPads, portrait only.
const devices = [
  [440, 956, 3], [402, 874, 3], [430, 932, 3], [393, 852, 3], [428, 926, 3], [390, 844, 3],
  [375, 812, 3], [414, 896, 3], [414, 896, 2], [375, 667, 2],
  [1024, 1366, 2], [834, 1194, 2], [820, 1180, 2], [768, 1024, 2],
]

const links = []
for (const [w, h, ratio] of devices) {
  const pw = w * ratio
  const ph = h * ratio
  const name = `${pw}x${ph}.png`
  await sharp(Buffer.from(splashSvg(pw, ph))).png({ compressionLevel: 9, palette: true }).toFile(`public/splash/${name}`)
  links.push(
    `    <link rel="apple-touch-startup-image" media="(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${ratio}) and (orientation: portrait)" href="/splash/${name}" />`,
  )
}

const html = readFileSync('index.html', 'utf8')
writeFileSync(
  'index.html',
  html.replace(
    /<!-- splash:start -->[\s\S]*<!-- splash:end -->/,
    `<!-- splash:start -->\n${links.join('\n')}\n    <!-- splash:end -->`,
  ),
)
console.log(`Generated icons and ${links.length} splash screens.`)
