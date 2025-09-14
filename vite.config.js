import { resolve } from 'node:path'

export default {
  root: '.',
  publicDir: 'public',
  server: {
    middlewareMode: false,
    fs: { strict: true },
    // Rewrite /xxx.html to src/pages/xxx.html during dev
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (!req.url) return next()
        if (req.url === '/' || req.url.startsWith('/?')) {
          req.url = '/src/pages/index.html'
          return next()
        }
        const m = req.url.match(/^\/(?:([\w-]+)\.html)\/?(\?.*)?$/)
        if (m) {
          const [, name, qs] = m
          req.url = `/src/pages/${name}${qs || ''}`
        }
        next()
      })
    }
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'src/pages/index.html'),
        company: resolve(__dirname, 'src/pages/company.html'),
        postpaid: resolve(__dirname, 'src/pages/postpaid.html'),
        columbarium: resolve(__dirname, 'src/pages/columbarium.html'),
        cemetery: resolve(__dirname, 'src/pages/cemetery.html'),
        forest: resolve(__dirname, 'src/pages/forest.html'),
        relocation: resolve(__dirname, 'src/pages/relocation.html'),
  relocation_unmarked: resolve(__dirname, 'src/pages/relocation_unmarked.html'),
  relocation_goodday: resolve(__dirname, 'src/pages/relocation_goodday.html'),
        grave: resolve(__dirname, 'src/pages/grave.html'),
  grave_burial: resolve(__dirname, 'src/pages/grave_burial.html'),
  grave_ring: resolve(__dirname, 'src/pages/grave_ring.html'),
  grave_tombstone: resolve(__dirname, 'src/pages/grave_tombstone.html'),
  grave_care: resolve(__dirname, 'src/pages/grave_care.html'),
        goods: resolve(__dirname, 'src/pages/goods.html'),
  goods_shroud: resolve(__dirname, 'src/pages/goods_shroud.html'),
  goods_vacuum_features: resolve(__dirname, 'src/pages/goods_vacuum_features.html'),
  goods_vacuum_products: resolve(__dirname, 'src/pages/goods_vacuum_products.html'),
        resources: resolve(__dirname, 'src/pages/resources.html'),
  resources_law: resolve(__dirname, 'src/pages/resources_law.html'),
  resources_funeral: resolve(__dirname, 'src/pages/resources_funeral.html'),
  resources_association: resolve(__dirname, 'src/pages/resources_association.html'),
  resources_relocation: resolve(__dirname, 'src/pages/resources_relocation.html'),
        faq: resolve(__dirname, 'src/pages/faq.html'),
        contact: resolve(__dirname, 'src/pages/contact.html'),
        policy: resolve(__dirname, 'src/pages/policy.html')
      }
    }
  }
}
