import fs from 'node:fs/promises'
import path from 'node:path'
import sass from 'sass'

const SRC_PAGES_DIR = path.resolve('src/pages')
const PUBLIC_DIR = path.resolve('public')
const PARTIALS_DIR = path.resolve('public/partials')
const FRAG_DIR = path.resolve('public/fragments')
const SRC_SCSS = path.resolve('src/styles/main.scss')
const OUT_CSS = path.resolve('public/styles/main.css')
const SRC_JS = path.resolve('src/scripts/main.js')
const OUT_JS = path.resolve('public/scripts/main.js')

async function readSafe(p) {
  try { return await fs.readFile(p, 'utf8') } catch { return '' }
}

async function writePublic(name, html) {
  const out = path.join(PUBLIC_DIR, name)
  await fs.writeFile(out, html, 'utf8')
  return out
}

function replaceHeaderFooter(html, header, footer) {
  // Replace data-header and data-footer placeholders
  html = html.replace(/<div\s+data-header\s*><\/div>/i, header.trim())
  html = html.replace(/<div\s+data-footer\s*><\/div>/i, footer.trim())
  return html
}

function injectHeadAssets(html) {
  // Ensure main.css is linked and script points to public version
  const hasLink = /<link[^>]+href=["'][^"']*\/styles\/main\.css["'][^>]*>/i.test(html)
  if (!hasLink) {
    html = html.replace(/<head[^>]*>/i, (m) => `${m}\n    <link rel="stylesheet" href="/styles/main.css">`)
  }
  html = html.replace(/<script[^>]+type=["']module["'][^>]+src=["']\/src\/scripts\/main\.js["'][^>]*><\/script>/gi,
    '<script defer src="/scripts/main.js"></script>')
  return html
}

async function injectFragmentsAsync(html, fragmentsBase) {
  const matches = [...html.matchAll(/<div\s+data-fragment\s*=\s*"([^"]+)"\s*><\/div>/gi)]
  const cache = new Map()
  for (const m of matches) {
    const fragPath = m[1]
    const abs = path.join(fragmentsBase, path.basename(fragPath))
    if (!cache.has(abs)) {
      try { cache.set(abs, await fs.readFile(abs, 'utf8')) } catch { cache.set(abs, '') }
    }
  }
  let out = html
  for (const m of matches) {
    const fragPath = m[1]
    const abs = path.join(fragmentsBase, path.basename(fragPath))
    const content = cache.get(abs) || ''
    out = out.replace(m[0], content ? `<div class="article">${content}</div>` : '<!-- fragment missing -->')
  }
  return out
}

async function assembleOne(file, header, footer) {
  const html = await fs.readFile(file, 'utf8')
  let out = html
  out = replaceHeaderFooter(out, header, footer)
  out = await injectFragmentsAsync(out, FRAG_DIR)
  out = injectHeadAssets(out)
  // Remove data-include marker on head if present
  out = out.replace(/<head[^>]*data-include[^>]*>/i, (m) => m.replace(/\sdata-include\b/,' '))
  const name = path.basename(file)
  const written = await writePublic(name, out)
  console.log('Assembled', name, '->', path.relative(process.cwd(), written))
}

async function main() {
  // 1) Build static assets (CSS + JS)
  try {
    const res = sass.compile(SRC_SCSS, { style: 'compressed' })
    await fs.mkdir(path.dirname(OUT_CSS), { recursive: true })
    await fs.writeFile(OUT_CSS, res.css, 'utf8')
    console.log('Built CSS ->', path.relative(process.cwd(), OUT_CSS))
  } catch (e) {
    console.warn('CSS build failed:', e.message)
  }
  try {
    let js = await fs.readFile(SRC_JS, 'utf8')
    // Strip SCSS import for browser static delivery
    js = js.replace(/^\s*import\s+['"][.]{2}\/styles\/main\.scss['"];?\s*/m, '')
    await fs.mkdir(path.dirname(OUT_JS), { recursive: true })
    await fs.writeFile(OUT_JS, js, 'utf8')
    console.log('Copied JS ->', path.relative(process.cwd(), OUT_JS))
  } catch (e) {
    console.warn('JS copy failed:', e.message)
  }

  const header = await readSafe(path.join(PARTIALS_DIR, 'header.html'))
  const footer = await readSafe(path.join(PARTIALS_DIR, 'footer.html'))
  if (!header || !footer) {
    console.error('Missing partials in public/partials')
  }
  const entries = await fs.readdir(SRC_PAGES_DIR)
  const pages = entries.filter(f => f.endsWith('.html'))
  for (const p of pages) {
    await assembleOne(path.join(SRC_PAGES_DIR, p), header, footer)
  }
}

main().catch(err => { console.error(err); process.exitCode = 1 })
