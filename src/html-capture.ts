/**
 * Self-contained HTML capture: inlines all external resources (fonts, images,
 * stylesheets) as data URIs, then serializes the DOM to a JSON tree.
 *
 * The JSON tree is reconstructed in the browser using createElement/appendChild,
 * which bypasses the HTML5 parser entirely — preserving "invalid" nesting that
 * React creates via DOM APIs (e.g. <div> inside <tr>, <p> inside <p>).
 *
 * The captured HTML is viewport-independent — CSS media queries are preserved,
 * so opening at any size reproduces the correct layout.
 */

import { type Page } from 'playwright'
import { writeFileSync, mkdirSync } from 'fs'
import { join, relative } from 'path'
import { createHash } from 'crypto'

export type ResponseCache = Map<string, { body: Buffer; contentType: string }>

// Compact JSON DOM node types (short keys to reduce serialized size)
// t=nodeType, n=tagName, ns=namespace, a=attributes, c=children, v=nodeValue
export type JsonDomNode =
  | { t: 1; n: string; ns?: string; a?: Record<string, string>; c?: JsonDomNode[] }
  | { t: 3; v: string }
  | { t: 8; v: string }

export type JsonDomCapture = {
  headHtml: string
  bodyChildren: JsonDomNode[]
  htmlAttrs: Record<string, string>
  bodyAttrs: Record<string, string>
}

type CaptureStats = {
  captureTimeMs: number
  resourcesEmbedded: number
  resourcesFailed: number
  assetsExtracted: number
  assetsDeduplicated: number
  sizeBytes: number
}

const MIME_TYPES: Record<string, string> = {
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.css': 'text/css',
}

function guessMime(url: string): string {
  const path = new URL(url, 'http://x').pathname.toLowerCase()
  for (const [ext, mime] of Object.entries(MIME_TYPES)) {
    if (path.endsWith(ext)) return mime
  }
  return 'application/octet-stream'
}

function mimeToExt(mime: string): string {
  if (mime.includes('woff2')) return '.woff2'
  if (mime.includes('woff')) return '.woff'
  if (mime.includes('ttf')) return '.ttf'
  if (mime.includes('svg')) return '.svg'
  if (mime.includes('png')) return '.png'
  if (mime.includes('jpeg') || mime.includes('jpg')) return '.jpg'
  if (mime.includes('gif')) return '.gif'
  if (mime.includes('webp')) return '.webp'
  if (mime.includes('css')) return '.css'
  return '.bin'
}

/**
 * Inline all external resources into the live DOM, then serialize the DOM tree
 * to a JSON structure. Modifies the DOM in-place, then restores it.
 */
async function captureJsonDom(
  page: Page,
  responseCache: ResponseCache,
  log: (msg: string) => void,
): Promise<{ jsonDom: JsonDomCapture; resourcesEmbedded: number; resourcesFailed: number }> {
  let resourcesEmbedded = 0
  let resourcesFailed = 0

  // Fetch external stylesheets
  const stylesheetUrls = await page.evaluate(() =>
    Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .map((l) => (l as HTMLLinkElement).href)
      .filter(Boolean),
  )

  const fetchedStyles: Record<string, string> = {}
  for (const url of stylesheetUrls) {
    try {
      const resp = await page.request.get(url)
      if (resp.ok()) fetchedStyles[url] = await resp.text()
    } catch {}
  }

  // Collect all CSS and extract url() references, tracking which CSS file
  // each reference came from so relative paths resolve correctly.
  const allInlineCss = await page.evaluate(() =>
    Array.from(document.querySelectorAll('style'))
      .map((s) => s.textContent || '')
      .join('\n'),
  )

  const cssUrlsWithBase = new Map<string, string>()
  const pageUrl = page.url()

  function extractCssUrls(css: string, base: string) {
    const re = /url\(\s*['"]?([^'")]+?)['"]?\s*\)/g
    let m: RegExpExecArray | null
    while ((m = re.exec(css)) !== null) {
      const u = m[1]
      if (u && !u.startsWith('data:') && !u.startsWith('#') && !u.startsWith('about:')) {
        if (!cssUrlsWithBase.has(u)) cssUrlsWithBase.set(u, base)
      }
    }
  }

  for (const [sheetUrl, css] of Object.entries(fetchedStyles)) {
    extractCssUrls(css, sheetUrl)
  }
  extractCssUrls(allInlineCss, pageUrl)

  // Fetch CSS-referenced resources → data URI map
  const resourceMap: Record<string, string> = {}

  for (const [rawUrl, baseUrl] of cssUrlsWithBase) {
    try {
      const absoluteUrl = new URL(rawUrl, baseUrl).href
      const cached = responseCache.get(absoluteUrl) || responseCache.get(rawUrl)
      if (cached) {
        const mime = cached.contentType.split(';')[0] || guessMime(absoluteUrl)
        resourceMap[rawUrl] = `data:${mime};base64,${cached.body.toString('base64')}`
        resourcesEmbedded++
        continue
      }
      const resp = await page.request.get(absoluteUrl)
      if (resp.ok()) {
        const body = await resp.body()
        resourceMap[rawUrl] = `data:${guessMime(absoluteUrl)};base64,${body.toString('base64')}`
        resourcesEmbedded++
      } else {
        log(`[html-capture] FAILED (${resp.status()}): ${rawUrl}`)
        resourcesFailed++
      }
    } catch (err) {
      log(`[html-capture] FAILED (error): ${rawUrl}`)
      resourcesFailed++
    }
  }

  // Fetch <img> src and <source srcset> URLs
  const imgUrls = await page.evaluate(() => {
    const urls: string[] = []
    for (const img of document.querySelectorAll('img')) {
      const src = (img as HTMLImageElement).src
      if (src && !src.startsWith('data:')) urls.push(src)
    }
    for (const source of document.querySelectorAll('picture > source')) {
      const srcset = (source as HTMLSourceElement).srcset
      if (srcset && !srcset.startsWith('data:')) {
        for (const entry of srcset.split(',')) {
          const url = entry.trim().split(/\s+/)[0]
          if (url && !url.startsWith('data:')) urls.push(url)
        }
      }
    }
    return [...new Set(urls)]
  })

  const imgDataMap: Record<string, string> = {}
  const pageOrigin = new URL(page.url()).origin
  for (const imgUrl of imgUrls) {
    if (resourceMap[imgUrl]) {
      imgDataMap[imgUrl] = resourceMap[imgUrl]
      continue
    }
    try {
      const absoluteUrl = imgUrl.startsWith('/') ? `${pageOrigin}${imgUrl}` : imgUrl
      const cached = responseCache.get(absoluteUrl)
      if (cached) {
        const mime = cached.contentType.split(';')[0] || guessMime(absoluteUrl)
        imgDataMap[imgUrl] = `data:${mime};base64,${cached.body.toString('base64')}`
        resourcesEmbedded++
        continue
      }
      const resp = await page.request.get(absoluteUrl)
      if (resp.ok()) {
        const body = await resp.body()
        imgDataMap[imgUrl] = `data:${guessMime(absoluteUrl)};base64,${body.toString('base64')}`
        resourcesEmbedded++
      } else {
        log(`[html-capture] FAILED img (${resp.status()}): ${imgUrl}`)
        resourcesFailed++
      }
    } catch (err) {
      log(`[html-capture] FAILED img (error): ${imgUrl}`)
      resourcesFailed++
    }
  }

  log(`[html-capture] ${resourcesEmbedded} resources embedded, ${resourcesFailed} failed`)

  // Inline resources into the DOM, serialize to JSON tree, then restore
  const jsonDom = await page.evaluate(
    (args: { externalStyles: Record<string, string>; resourceMap: Record<string, string>; imgDataMap: Record<string, string> }) => {
      const { externalStyles, resourceMap, imgDataMap } = args

      const replaceUrls = (css: string): string =>
        css.replace(/url\(\s*['"]?([^'")]+?)['"]?\s*\)/g, (_match, rawUrl) => {
          const dataUri = resourceMap[rawUrl]
          return dataUri ? `url(${dataUri})` : _match
        })

      const removed: { el: Element; parent: Node; next: Node | null }[] = []

      // Replace <link rel="stylesheet"> with <style> (URLs replaced)
      for (const link of document.querySelectorAll('link[rel="stylesheet"]')) {
        const href = (link as HTMLLinkElement).href
        const css = externalStyles[href]
        if (css) {
          const style = document.createElement('style')
          style.setAttribute('data-vr-source', href)
          const mediaAttr = (link as HTMLLinkElement).media
          if (mediaAttr) style.setAttribute('media', mediaAttr)
          style.textContent = replaceUrls(css)
          link.parentNode!.insertBefore(style, link)
        }
        if (link.parentNode) {
          removed.push({ el: link, parent: link.parentNode, next: link.nextSibling })
          link.remove()
        }
      }

      // Replace url() in existing inline <style> tags
      const styleBackups: { el: HTMLStyleElement; original: string }[] = []
      for (const style of document.querySelectorAll('style:not([data-vr-source])') as NodeListOf<HTMLStyleElement>) {
        const original = style.textContent || ''
        if (original.includes('url(')) {
          styleBackups.push({ el: style, original })
          style.textContent = replaceUrls(original)
        }
      }

      // Remove scripts, non-visual elements, and dev tools overlays
      for (const el of document.querySelectorAll(
        'script, noscript, link[rel="preload"], link[rel="prefetch"], link[rel="icon"], link[rel="modulepreload"], body > div:has(button[title="Close dev panel"]), .ReactQueryDevtools',
      )) {
        if (el.parentNode) {
          removed.push({ el, parent: el.parentNode, next: el.nextSibling })
          el.remove()
        }
      }

      // Replace <img> src with data URIs
      const imgSaved: { img: HTMLImageElement; origSrc: string }[] = []
      for (const img of document.querySelectorAll('img') as NodeListOf<HTMLImageElement>) {
        if (!img.src || img.src.startsWith('data:')) continue
        const dataUri = imgDataMap[img.src]
        if (dataUri) {
          imgSaved.push({ img, origSrc: img.src })
          img.src = dataUri
        } else {
          try {
            const c = document.createElement('canvas')
            c.width = img.naturalWidth || img.width || 1
            c.height = img.naturalHeight || img.height || 1
            c.getContext('2d')!.drawImage(img, 0, 0)
            imgSaved.push({ img, origSrc: img.src })
            img.src = c.toDataURL('image/png')
          } catch {}
        }
      }

      // Replace <source srcset> with data URIs
      const srcSaved: { source: HTMLSourceElement; origSrcset: string }[] = []
      for (const source of document.querySelectorAll('picture > source') as NodeListOf<HTMLSourceElement>) {
        if (!source.srcset || source.srcset.startsWith('data:')) continue
        const origSrcset = source.srcset
        const newSrcset = origSrcset
          .split(',')
          .map((entry) => {
            const parts = entry.trim().split(/\s+/)
            const url = parts[0]
            const descriptor = parts.slice(1).join(' ')
            const dataUri = imgDataMap[url]
            return dataUri ? (descriptor ? `${dataUri} ${descriptor}` : dataUri) : entry.trim()
          })
          .join(', ')
        if (newSrcset !== origSrcset) {
          source.srcset = newSrcset
          srcSaved.push({ source, origSrcset })
        }
      }

      // Strip capture-only styles (animation/transition freeze) before saving
      for (const s of document.querySelectorAll('style[data-vr-capture-only]')) s.remove()

      // Form control types whose .value property is observable in rendering
      // (distinct from e.g. type=submit/reset/button/file/image, where the
      // attribute is the button label — not user-editable state).
      const VALUE_BEARING_INPUT_TYPES = new Set([
        'text', 'email', 'password', 'url', 'search', 'tel',
        'number', 'range', 'color',
        'date', 'time', 'datetime-local', 'month', 'week',
        'hidden',
      ])

      // Serialize the DOM tree to JSON — createElement reconstruction bypasses
      // the HTML5 parser, so no nesting fixes are needed.
      function toJsonNode(node: Node): any {
        if (node.nodeType === 3) return { t: 3, v: node.nodeValue }
        if (node.nodeType === 8) return { t: 8, v: node.nodeValue }
        if (node.nodeType !== 1) return null
        const el = node as Element
        const obj: any = { t: 1, n: el.tagName.toLowerCase() }
        if (el.namespaceURI && el.namespaceURI !== 'http://www.w3.org/1999/xhtml') {
          obj.ns = el.namespaceURI
        }
        if (el.attributes.length > 0) {
          const attrs: Record<string, string> = {}
          for (let i = 0; i < el.attributes.length; i++) {
            attrs[el.attributes[i].name] = el.attributes[i].value
          }
          obj.a = attrs
        }
        if (el.childNodes.length > 0) {
          const children: any[] = []
          for (let i = 0; i < el.childNodes.length; i++) {
            const child = toJsonNode(el.childNodes[i])
            if (child) children.push(child)
          }
          if (children.length) obj.c = children
        }

        // Persist form control state from DOM properties. Frameworks like
        // React/Preact set `value` and `checked` as properties, not attributes,
        // so `el.attributes` doesn't see them — the reconstruction would lose
        // initial values and checked states without this.
        const tag = obj.n
        if (tag === 'input') {
          const input = el as HTMLInputElement
          const type = (input.type || 'text').toLowerCase()
          if (type === 'checkbox' || type === 'radio') {
            obj.a = obj.a || {}
            if (input.checked) obj.a.checked = ''
            else delete obj.a.checked
          } else if (VALUE_BEARING_INPUT_TYPES.has(type)) {
            obj.a = obj.a || {}
            obj.a.value = input.value
          }
        } else if (tag === 'textarea') {
          const ta = el as HTMLTextAreaElement
          obj.c = ta.value ? [{ t: 3, v: ta.value }] : undefined
          if (!obj.c) delete obj.c
        } else if (tag === 'option') {
          const opt = el as HTMLOptionElement
          obj.a = obj.a || {}
          if (opt.selected) obj.a.selected = ''
          else delete obj.a.selected
        } else if (tag === 'details') {
          obj.a = obj.a || {}
          if ((el as HTMLDetailsElement).open) obj.a.open = ''
          else delete obj.a.open
        }
        return obj
      }

      const bodyChildren: any[] = []
      for (let i = 0; i < document.body.childNodes.length; i++) {
        const child = toJsonNode(document.body.childNodes[i])
        if (child) bodyChildren.push(child)
      }
      const headHtml = document.head.innerHTML
      const htmlAttrs: Record<string, string> = {}
      for (let i = 0; i < document.documentElement.attributes.length; i++) {
        const a = document.documentElement.attributes[i]
        htmlAttrs[a.name] = a.value
      }
      const bodyAttrs: Record<string, string> = {}
      for (let i = 0; i < document.body.attributes.length; i++) {
        const a = document.body.attributes[i]
        bodyAttrs[a.name] = a.value
      }

      // Restore DOM — in reverse order of modifications
      for (let i = removed.length - 1; i >= 0; i--) {
        const { el, parent, next } = removed[i]
        try {
          next && next.parentNode === parent ? parent.insertBefore(el, next) : parent.appendChild(el)
        } catch {
          parent.appendChild(el)
        }
      }
      for (const s of document.querySelectorAll('style[data-vr-source]')) s.remove()
      for (const { el, original } of styleBackups) el.textContent = original
      for (const { img, origSrc } of imgSaved) img.src = origSrc
      for (const { source, origSrcset } of srcSaved) source.srcset = origSrcset

      return { headHtml, bodyChildren, htmlAttrs, bodyAttrs }
    },
    { externalStyles: fetchedStyles, resourceMap, imgDataMap },
  )

  return {
    jsonDom: {
      headHtml: jsonDom.headHtml,
      bodyChildren: jsonDom.bodyChildren as JsonDomNode[],
      htmlAttrs: jsonDom.htmlAttrs,
      bodyAttrs: jsonDom.bodyAttrs,
    },
    resourcesEmbedded,
    resourcesFailed,
  }
}

/**
 * Generate an HTML file that reconstructs the DOM programmatically from a JSON
 * tree using createElement/appendChild. This bypasses the HTML5 parser entirely,
 * preserving invalid nesting (e.g. <div> inside <p>, <div> inside <tr>) that
 * React creates via DOM APIs but the parser would "correct".
 */
// Escape `</` as `<\/` so the HTML parser doesn't see closing tags inside <script>
function escapeForScript(s: string): string {
  return s.replace(/<\//g, '<\\/')
}

function generateJsonReconstructionHtml(
  jsonDom: JsonDomCapture,
  assetsDir: string,
  assetsPrefix: string,
): { html: string; assetsExtracted: number; assetsDeduplicated: number } {
  mkdirSync(assetsDir, { recursive: true })
  let assetsExtracted = 0
  let assetsDeduplicated = 0
  const assetMap = new Map<string, string>()

  function extractAssets(str: string): string {
    return str.replace(/data:([^;]+);base64,([A-Za-z0-9+/=]+)/g, (_match, mime: string, b64: string) => {
      const hash = createHash('md5').update(b64).digest('hex').slice(0, 12)
      if (assetMap.has(hash)) { assetsDeduplicated++; return assetMap.get(hash)! }
      const filename = `${hash}${mimeToExt(mime)}`
      writeFileSync(join(assetsDir, filename), Buffer.from(b64, 'base64'))
      const relativePath = `${assetsPrefix}${filename}`
      assetMap.set(hash, relativePath)
      assetsExtracted++
      return relativePath
    })
  }

  const headHtml = extractAssets(jsonDom.headHtml)
  const bodyChildrenJson = escapeForScript(extractAssets(JSON.stringify(jsonDom.bodyChildren)))

  const htmlAttrsStr = Object.entries(jsonDom.htmlAttrs).map(([k, v]) => ` ${k}="${v.replace(/"/g, '&quot;')}"`).join('')
  const bodyAttrsJson = escapeForScript(JSON.stringify(jsonDom.bodyAttrs))

  const html = `<!DOCTYPE html>
<html${htmlAttrsStr}>
<head>
${headHtml}
</head>
<body><script data-vr-builder>(function(){
var ba=${bodyAttrsJson};
for(var k in ba)document.body.setAttribute(k,ba[k]);
var bc=${bodyChildrenJson};
function b(n){
if(n.t===3)return document.createTextNode(n.v||'');
if(n.t===8)return document.createComment(n.v||'');
var el=n.ns?document.createElementNS(n.ns,n.n):document.createElement(n.n);
if(n.a)for(var k in n.a)try{el.setAttribute(k,n.a[k])}catch(e){}
if(n.c)for(var i=0;i<n.c.length;i++){var ch=b(n.c[i]);if(ch)el.appendChild(ch)}
return el;
}
for(var i=0;i<bc.length;i++){var ch=b(bc[i]);if(ch)document.body.appendChild(ch)}
document.querySelector('script[data-vr-builder]').remove();
})();</script>
</body>
</html>`

  return { html, assetsExtracted, assetsDeduplicated }
}

/**
 * Full HTML capture pipeline: inline resources, serialize DOM to JSON, write
 * reconstruction HTML to output directory.
 *
 * Output structure:
 *   {htmlDir}/
 *     index.html          — JSON DOM reconstruction HTML (opens in browser)
 *   {sharedAssetsDir}/
 *     {hash}.woff2         — content-hashed, naturally deduped across pages
 */
export async function capturePageHtml(
  page: Page,
  responseCache: ResponseCache,
  htmlDir: string,
  sharedAssetsDir: string,
  log: (msg: string) => void,
): Promise<CaptureStats> {
  const t0 = Date.now()

  // esbuild/tsx injects __name() calls into functions passed to page.evaluate()
  await page.evaluate('window.__name = (fn, name) => fn')

  const { jsonDom, resourcesEmbedded, resourcesFailed } = await captureJsonDom(page, responseCache, log)

  mkdirSync(htmlDir, { recursive: true })
  const assetsPrefix = relative(htmlDir, sharedAssetsDir) + '/'
  const result = generateJsonReconstructionHtml(jsonDom, sharedAssetsDir, assetsPrefix)
  writeFileSync(join(htmlDir, 'index.html'), result.html)

  const sizeBytes = Buffer.byteLength(result.html, 'utf8')
  const captureTimeMs = Date.now() - t0
  log(`[html-capture] ${(sizeBytes / 1024).toFixed(0)}KB in ${captureTimeMs}ms`)

  return {
    captureTimeMs,
    resourcesEmbedded,
    resourcesFailed,
    assetsExtracted: result.assetsExtracted,
    assetsDeduplicated: result.assetsDeduplicated,
    sizeBytes,
  }
}

/**
 * Build a response cache by listening to network responses during page load.
 * Call this BEFORE page.goto() — the listener captures fonts, images, and CSS
 * that Next.js serves dynamically (e.g. /__nextjs_font/).
 */
export function attachResponseCache(page: Page): ResponseCache {
  const cache: ResponseCache = new Map()
  page.on('response', async (response) => {
    const url = response.url()
    const ct = response.headers()['content-type'] || ''
    if (url.match(/\.(woff2?|ttf|otf|eot|svg|png|jpg|jpeg|gif|webp|css)(\?|$)/i) || ct.includes('font') || ct.includes('image')) {
      try {
        const body = await response.body()
        cache.set(url, { body: body as Buffer, contentType: ct })
      } catch {}
    }
  })
  return cache
}
