/**
 * Vite plugin: inline `<!-- @include partials/x.html -->` markers in
 * index.html (recursively; paths are relative to the project root). Dev
 * reloads the page when any partial changes.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'

const MARKER = /<!--\s*@include\s+(\S+)\s*-->/g

export function expandIncludes(html: string, root: string, depth = 0): string {
  if (depth > 10) throw new Error('@include nested more than 10 deep (cycle?)')
  return html.replace(MARKER, (_, file: string) =>
    expandIncludes(readFileSync(resolve(root, file), 'utf8'), root, depth + 1),
  )
}

export function htmlInclude(): Plugin {
  let root = process.cwd()
  return {
    name: 'html-include',
    configResolved: (c) => void (root = c.root),
    transformIndexHtml: { order: 'pre', handler: (html) => expandIncludes(html, root) },
    configureServer(server) {
      server.watcher.add(resolve(root, 'partials'))
      server.watcher.on('change', (f) => {
        if (f.startsWith(resolve(root, 'partials'))) server.ws.send({ type: 'full-reload' })
      })
    },
  }
}

const CONSTANT = /__([A-Z][A-Z0-9_]*)__/g

/** Replace `__NAME__` with `values.NAME` (src/core/config.ts values); an unknown name is an error, not a silent literal. */
export function applyConstants(html: string, values: Record<string, string>): string {
  return html.replace(CONSTANT, (token, name: string) => {
    if (!(name in values)) throw new Error(`index.html: ${token} has no value (vite.config.ts htmlConstants)`)
    return values[name]
  })
}

/** Vite plugin: fill `__NAME__` tokens in index.html and its partials (after @include) from config values. */
export function htmlConstants(values: Record<string, string>): Plugin {
  return {
    name: 'html-constants',
    transformIndexHtml: { order: 'pre', handler: (html) => applyConstants(html, values) },
  }
}
