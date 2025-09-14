import '../styles/main.scss'
async function include(selector, url) {
  const el = document.querySelector(selector)
  if (!el) return
  const res = await fetch(url)
  const html = await res.text()
  el.innerHTML = html
}

async function includeFragment(el) {
  try {
    const src = el.getAttribute('data-fragment')
    if (!src) return
    const res = await fetch(src)
    if (!res.ok) return
    const html = await res.text()
    el.innerHTML = `<div class="article">${html}</div>`
    // Client-side sanitize: strip legacy wrappers and javascript links
    const wrap = el.querySelector('.article')
    if (wrap) {
      wrap.querySelectorAll('#slideWrap, .layout_head, .layout_foot, .leftside, .lnb, .s_location, .update_news, .bottom_menu_copy, .wfsr').forEach(n => n.remove())
      wrap.querySelectorAll('map, area').forEach(n => n.remove())
      wrap.querySelectorAll('a[href^="javascript:"]').forEach(a => {
        const s = document.createElement('span'); s.textContent = a.textContent || ''
        a.replaceWith(s)
      })
      wrap.querySelectorAll('img[alt*="홈페이지"], img[src*="btnHome"]').forEach(img => img.remove())
    }
  } catch {}
}

function buildSubnav() {
  const map = {
    'relocation.html': [
      ['relocation.html','묘지이장&개장'],
      ['relocation_unmarked.html','유연&무연분묘처리'],
      ['relocation_goodday.html','묘지이장하기좋은날']
    ],
    'grave.html': [
      ['grave.html','납골묘조성'],
      ['grave_burial.html','분묘조성'],
      ['grave_ring.html','둘레석(원형/사각)'],
      ['grave_tombstone.html','비석설치'],
      ['grave_care.html','사초&벌초']
    ],
    'goods.html': [
      ['goods_shroud.html','수의 [壽衣]'],
      ['goods_vacuum_features.html','진공봉안함 특성'],
      ['goods_vacuum_products.html','진공봉안함 상품']
    ],
    'resources.html': [
      ['resources_law.html','장사법'],
      ['resources_funeral.html','상장례'],
      ['resources_association.html','상조'],
      ['resources_relocation.html','이개장']
    ]
  }
  const p = location.pathname.toLowerCase()
  let file = p.substring(p.lastIndexOf('/') + 1) || 'index.html'
  if (!file.includes('.')) file = 'index.html'
  const set = map[file]
  if (!set) return
  const wrap = document.createElement('nav')
  wrap.className = 'subnav'
  set.forEach(([href,label]) => {
    const a = document.createElement('a')
    a.href = href
    a.textContent = label
    if (href.toLowerCase() === file) a.setAttribute('aria-current','page')
    wrap.appendChild(a)
  })
  const main = document.querySelector('main')
  if (main) main.insertBefore(wrap, main.children[1] || null)
}

function buildTOC() {
  const container = document.querySelector('.article')
  if (!container) return
  const heads = container.querySelectorAll('h2, h3')
  if (!heads.length) return
  const toc = document.createElement('nav')
  toc.className = 'toc'
  toc.innerHTML = '<h3>목차</h3><ul></ul>'
  const ul = toc.querySelector('ul')
  heads.forEach((h, i) => {
    if (!h.id) h.id = 's-' + (i+1)
    const li = document.createElement('li')
    const a = document.createElement('a')
    a.href = '#' + h.id
    a.textContent = h.textContent?.trim() || '섹션'
    li.appendChild(a)
    ul.appendChild(li)
  })
  const main = document.querySelector('main')
  if (main) main.insertBefore(toc, main.children[2] || null)
}

function initNav() {
  const btn = document.querySelector('.nav-toggle')
  const nav = document.getElementById('site-nav')
  const backdrop = document.querySelector('.backdrop')
  if (!nav) return

  const closeAllSubs = () => {
    document.querySelectorAll('.site-nav .has-sub[aria-expanded="true"]').forEach(el => el.setAttribute('aria-expanded', 'false'))
  }

  const openDrawer = () => {
    nav.classList.add('open')
    btn?.setAttribute('aria-expanded', 'true')
    backdrop?.removeAttribute('hidden')
    document.body.style.overflow = 'hidden'
    // Avoid padding-right adjustment; header is centered independently
    document.body.style.paddingRight = ''
  }
  const closeDrawer = () => {
    nav.classList.remove('open')
    btn?.setAttribute('aria-expanded', 'false')
    backdrop?.setAttribute('hidden', '')
    document.body.style.overflow = ''
    document.body.style.paddingRight = ''
    closeAllSubs()
  }

  btn?.addEventListener('click', () => {
    if (nav.classList.contains('open')) closeDrawer(); else openDrawer()
  })
  backdrop?.addEventListener('click', closeDrawer)
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (nav.classList.contains('open')) closeDrawer()
      closeAllSubs()
    }
  })

  nav.addEventListener('click', (e) => {
    const t = e.target
    if (!(t instanceof Element)) return
    // Close drawer on link click (mobile UX)
    const link = t.closest('a')
    if (link) {
      if (getComputedStyle(document.querySelector('.nav-toggle') || document.body).display !== 'none') {
        // Use the same close routine to avoid leftover styles
        try { /* in scope */ closeDrawer() } catch { 
          nav.classList.remove('open')
          document.querySelector('.nav-toggle')?.setAttribute('aria-expanded','false')
          document.querySelector('.backdrop')?.setAttribute('hidden','')
          document.body.style.overflow = ''
          document.body.style.paddingRight = ''
          closeAllSubs()
        }
      }
      return
    }
    const subBtn = t.closest('.sub-toggle')
    if (subBtn) {
      const item = subBtn.closest('.has-sub')
      if (item) {
        const expanded = item.getAttribute('aria-expanded') === 'true'
        item.parentElement?.querySelectorAll('.has-sub[aria-expanded="true"]').forEach(sib => {
          if (sib !== item) sib.setAttribute('aria-expanded', 'false')
        })
        item.setAttribute('aria-expanded', String(!expanded))
        e.preventDefault(); e.stopPropagation()
      }
    }
  }, true)

  document.addEventListener('click', (e) => {
    const t = e.target
    if (!(t instanceof Element)) return
    if (!t.closest('#site-nav')) closeAllSubs()
  })
}

function initMode() {
  const btn = document.querySelector('.mode-toggle')
  if (!btn) return
  const key = 'hanuljari-theme'
  const apply = (mode) => {
    document.documentElement.dataset.theme = mode
    btn.textContent = mode === 'dark' ? '☀️' : '🌙'
    btn.setAttribute('aria-pressed', String(mode === 'dark'))
  }
  const saved = localStorage.getItem(key)
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  apply(saved || (prefersDark ? 'dark' : 'light'))
  btn.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'
    localStorage.setItem(key, next)
    apply(next)
  })
}

function initYear() {
  const y = document.getElementById('year')
  if (y) y.textContent = String(new Date().getFullYear())
}

function initBreadcrumb() {
  const bc = document.querySelector('.breadcrumb')
  if (!bc) return
  const map = {
    'company.html': ['회사소개'],
    'postpaid.html': ['후불제상조'],
    'columbarium.html': ['납골당'],
    'cemetery.html': ['공원묘지'],
    'forest.html': ['수목장'],
    'relocation.html': ['이장/개장'],
    'grave.html': ['묘지조성'],
    'goods.html': ['장례용품'],
    'resources.html': ['자료실'],
    'faq.html': ['FAQ'],
    'contact.html': ['문의'],
    'policy.html': ['개인정보 처리방침']
  }
  const p = location.pathname.toLowerCase()
  let file = p.substring(p.lastIndexOf('/') + 1) || 'index.html'
  if (!file.includes('.')) file = 'index.html'
  if (file === 'index.html') { bc.innerHTML = ''; return }
  const items = map[file]
  if (!items) { bc.innerHTML = ''; return }
  const homeHref = (location.pathname.includes('/src/pages/')) ? '/src/pages/index.html' : 'index.html'
  bc.innerHTML = `<nav aria-label="breadcrumb"><ol><li><a href="${homeHref}">홈</a></li>${items.map(i=>`<li aria-current="page">${i}</li>`).join('')}</ol></nav>`
}

function initCurrentNav() {
  const p = location.pathname.toLowerCase()
  let file = p.substring(p.lastIndexOf('/') + 1) || 'index.html'
  if (!file.includes('.')) file = 'index.html'
  document.querySelectorAll('#site-nav a').forEach(a => {
    const href = (a.getAttribute('href') || '').toLowerCase()
    const ahref = href.substring(href.lastIndexOf('/') + 1) || href
    if ((file === 'index.html' && (ahref === '' || ahref === '/' || ahref === 'index.html')) || ahref === file) {
      a.setAttribute('aria-current', 'page')
      const group = a.closest('.has-sub')
      if (group) group.classList.add('active')
    }
  })
}

function initScrollReveal() {
  const els = document.querySelectorAll('.reveal, .card, .section h2, .hero h1, .hero p, .hero .actions')
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.animate([
          { opacity: 0, transform: 'translateY(12px)' },
          { opacity: 1, transform: 'translateY(0)' }
        ], { duration: 450, easing: 'cubic-bezier(.2,.6,.2,1)', fill: 'forwards' })
        io.unobserve(e.target)
      }
    })
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 })
  els.forEach(el => io.observe(el))
}

async function boot() {
  await include('div[data-header]','/partials/header.html')
  await include('div[data-cta]','/partials/cta.html')
  await include('div[data-footer]','/partials/footer.html')
  await Promise.all(Array.from(document.querySelectorAll('[data-fragment]')).map(includeFragment))
  initNav()
  initMode()
  initBreadcrumb()
  initCurrentNav()
  initYear()
  buildSubnav()
  buildTOC()
  initScrollReveal()
}

document.addEventListener('DOMContentLoaded', boot)
