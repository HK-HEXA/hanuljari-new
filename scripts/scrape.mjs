import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { load as cheerioLoad } from 'cheerio'
import iconv from 'iconv-lite'

const ROOT = 'http://www.hanuljari.com'
const FRAG_DIR = path.resolve('public/fragments')
const IMG_DIR = path.resolve('public/images/imported')

async function ensureDirs() {
  await fs.mkdir(FRAG_DIR, { recursive: true })
  await fs.mkdir(IMG_DIR, { recursive: true })
}

function absUrl(u) {
  if (!u) return null
  if (u.startsWith('http://') || u.startsWith('https://')) return u
  if (u.startsWith('//')) return 'http:' + u
  if (u.startsWith('/')) return ROOT + u
  return ROOT + '/' + u.replace(/^\.\//, '')
}

async function ensureFetch() {
  if (typeof fetch === 'undefined') {
    const { default: fetchFn } = await import('node-fetch')
    globalThis.fetch = fetchFn
  }
}

async function fetchRaw(url, opts = {}, retries = 2) {
  await ensureFetch()
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'ko,en;q=0.8'
  }
  try {
    const res = await fetch(url, { headers, redirect: 'follow', ...opts })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const buf = Buffer.from(await res.arrayBuffer())
    const ctype = res.headers.get('content-type') || ''
    return { buf, ctype }
  } catch (e) {
    if (retries > 0) return fetchRaw(url, opts, retries - 1)
    throw e
  }
}

function detectEncoding(ctype) {
  const m = /charset=([^;]+)/i.exec(ctype || '')
  if (m) return m[1].toLowerCase()
  return 'utf-8'
}

async function fetchText(url) {
  const { buf, ctype } = await fetchRaw(url)
  const enc = detectEncoding(ctype)
  if (/euc-kr|ks_c_5601|cp949/i.test(enc)) return iconv.decode(buf, 'euc-kr')
  return buf.toString('utf8')
}

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 100)
}

async function downloadAsset(url) {
  const u = absUrl(url)
  if (!u) return null
  await ensureFetch()
  const res = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!res.ok) return null
  const buf = Buffer.from(await res.arrayBuffer())
  const ext = path.extname(new URL(u).pathname) || '.bin'
  const base = path.basename(new URL(u).pathname) || 'file'
  const hash = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 8)
  const file = sanitizeFilename(`${base.replace(ext, '')}_${hash}${ext}`)
  const outPath = path.join(IMG_DIR, file)
  await fs.writeFile(outPath, buf)
  return `/images/imported/${file}`
}

function cleanDom($) {
  // Remove non-content and legacy XE scaffolding
  $('script, style, link[rel="stylesheet"], header, nav, footer, iframe, noscript').remove()
  $('#slideWrap, .layout_head, .layout_foot, .layout_topmenu, .logo_line').remove()
  $('.leftside, .lnb, .s_location, .update_news, .bottom_menu_copy, .wfsr, .xe-widget-wrapper, .xe_content, .clear, .skip, .skipToContent').remove()
  // Remove map areas/buttons and javascript: anchors
  $('map, area').remove()
  $('a[href^="javascript:"]').each((_, el) => {
    const $el = $(el)
    $el.replaceWith(`<span>${$el.text()}</span>`) 
  })
}

async function rewriteImages($, $scope) {
  const imgs = $scope.find('img[src]')
  for (const el of imgs.toArray()) {
    const $el = $(el)
    const src = $el.attr('src')
    const newSrc = await downloadAsset(src).catch(() => null)
    if (newSrc) $el.attr('src', newSrc)
    $el.attr('loading', 'lazy')
    if (!$el.attr('alt')) $el.attr('alt', '이미지')
    $el.removeAttr('width')
    $el.removeAttr('height')
    const style = ($el.attr('style') || '')
    const add = 'max-width:100%;height:auto;'
    if (!/max-width\s*:\s*100%/.test(style)) $el.attr('style', (style ? style + ';' : '') + add)
  }
}

function pickMain($) {
  // Prefer known content container from the old site
  const candidates = ['.main_content', '#content', '#xe_content', 'article', 'section', '.content', '.contents', '#wrap', '#container']
  let best = null
  let bestLen = 0
  for (const sel of candidates) {
    $(sel).each((_, el) => {
      const len = $(el).text().trim().length
      if (len > bestLen) { bestLen = len; best = $(el) }
    })
  }
  return best || $('body')
}

async function scrapeContentPage(url, fragmentName) {
  const html = await fetchText(url)
  const $ = cheerioLoad(html)
  cleanDom($)
  const $main = pickMain($)
  // Strip known breadcrumb images or home icons
  $main.find('img[alt*="홈페이지"], img[src*="btnHome"]').remove()
  await rewriteImages($, $main)
  // Remove empty containers
  $main.find('*').each((_, el) => {
    const $el = $(el)
    if (!$el.text().trim() && !$el.find('img, video, iframe').length) {
      const html = $el.html() || ''
      if (!html.trim()) $el.remove()
    }
  })
  // Drop XE footer strings
  $main.find(':contains("Skin By WebEngine")').remove()
  let out = $main.html() || ''
  // Normalize multiple blank lines
  out = out.replace(/\n{3,}/g, '\n\n')
  await fs.writeFile(path.join(FRAG_DIR, fragmentName), out, 'utf8')
  console.log('Saved fragment', fragmentName)
}

const spamKeywords = [
  '마사지','안마','성인','섹스','porn','카지노','바카라','토토','먹튀','비아그라','viagra','에로','escort','대출','텔레그램','선물거래','주식 리딩','해외직구','도박','유흥'
]
function looksSpam(text) {
  const t = (text || '').toLowerCase()
  return spamKeywords.some(k => t.includes(k.toLowerCase()))
}

async function scrapeBoard(listUrl, fragmentName, limit = 20) {
  const listHtml = await fetchText(listUrl)
  const $ = cheerioLoad(listHtml)
  cleanDom($)
  const anchors = $('a[href]')
    .toArray()
    .map(a => ({ href: absUrl($(a).attr('href') || ''), title: $(a).text().trim() }))
    .filter(a => a.href && a.href.startsWith(ROOT) && /\d{3,}$/.test(a.href)) // heuristic for post urls
  const uniq = []
  const seen = new Set()
  for (const a of anchors) { if (!seen.has(a.href)) { seen.add(a.href); uniq.push(a) } }
  const items = []
  for (const a of uniq.slice(0, limit)) {
    if (looksSpam(a.title)) continue
    try {
      const ph = await fetchText(a.href)
      const $p = cheerioLoad(ph)
      cleanDom($p)
      const $main = pickMain($p)
      $main.find('img[alt*="홈페이지"], img[src*="btnHome"]').remove()
      if (looksSpam($main.text())) continue
      await rewriteImages($p, $main)
      $main.find('*').each((_, el) => {
        const $el = $p(el)
        if (!$el.text().trim() && !$el.find('img, video, iframe').length) {
          const html = $el.html() || ''
          if (!html.trim()) $el.remove()
        }
      })
      $main.find(':contains("Skin By WebEngine")').remove()
      items.push({ title: a.title || '제목 없음', body: $main.html() || '' })
    } catch {}
  }
  const out = [
    '<div class="board-list">',
    ...items.map(it => `<article class="card"><h2>${it.title}</h2><div class="content">${it.body}</div></article>`),
    '</div>'
  ].join('\n')
  await fs.writeFile(path.join(FRAG_DIR, fragmentName), out, 'utf8')
  console.log('Saved board fragment', fragmentName, items.length)
}

async function main() {
  await ensureDirs()
  // Content pages
  const contents = [
    ['sub06', `${ROOT}/sub06`],
    ['sub07', `${ROOT}/sub07`],
    ['sub06_02', `${ROOT}/sub06_02`],
    ['sub02', `${ROOT}/sub02`],
    ['sub02_04', `${ROOT}/sub02_04`],
    ['sub02_06', `${ROOT}/sub02_06`],
    ['sub02_02', `${ROOT}/sub02_02`],
    ['sub02_05', `${ROOT}/sub02_05`],
    ['sub09_02', `${ROOT}/sub09_02`],
    ['sub09_03', `${ROOT}/sub09_03`],
  ]
  for (const [frag, url] of contents) {
    await scrapeContentPage(url, `${frag}.html`).catch(e => console.error('content fail', frag, e.message))
  }
  // External ham page (products)
  await scrapeContentPage(`${ROOT}/ham`, 'ham.html').catch(()=>{})
  // Boards
  const boards = [
    ['file', `${ROOT}/file`],
    ['data', `${ROOT}/data`],
    ['data02', `${ROOT}/data02`],
    ['data03', `${ROOT}/data03`],
    ['data04', `${ROOT}/data04`],
  ]
  for (const [frag, url] of boards) {
    await scrapeBoard(url, `${frag}.html`).catch(e => console.error('board fail', frag, e.message))
  }
}

main().catch(err => { console.error(err); process.exitCode = 1 })
