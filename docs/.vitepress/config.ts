import { defineConfig } from 'vitepress'

export default defineConfig({
  lang: 'nl-NL',
  title: 'BTransfer Docs',
  description: 'End-to-end versleuteld versturen via de BTransfer-API',
  cleanUrls: true,
  head: [['link', { rel: 'icon', href: '/logo.svg' }]],
  themeConfig: {
    logo: '/logo.svg',
    nav: [
      { text: 'Gids', link: '/gids/starten' },
      { text: 'API (Swagger)', link: 'https://playground.btransfer.nl/api/docs' },
      { text: 'btransfer.nl', link: 'https://btransfer.nl' },
    ],
    sidebar: [
      {
        text: 'Gids',
        items: [
          { text: 'Snel starten', link: '/gids/starten' },
          { text: 'Hoe de versleuteling werkt', link: '/gids/versleuteling' },
          { text: 'Cellen', link: '/gids/cellen' },
          { text: 'API-sleutels', link: '/gids/api-sleutels' },
          { text: 'Sandbox', link: '/gids/sandbox' },
        ],
      },
    ],
    socialLinks: [{ icon: 'github', link: 'https://github.com/btech-stack/btransfer-client' }],
    footer: { message: 'Client-bibliotheek onder Apache-2.0', copyright: 'BTech IT' },
    outline: { label: 'Op deze pagina' },
    docFooter: { prev: 'Vorige', next: 'Volgende' },
  },
})
