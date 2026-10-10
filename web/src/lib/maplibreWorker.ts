/**
 * MapLibre 6 finds its web worker with `new URL(name, import.meta.url)` at runtime, which Vite cannot
 * follow, so the worker (and the shared chunk it imports) never reached the build. Bundle it as its own
 * worker entry (`?worker&url`, Vite's default classic IIFE: MapLibre loads a non-`.mjs` URL with
 * importScripts) and point MapLibre at it. Imported for its side effect by every map component, before
 * the first map is created.
 */
import { setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'

setWorkerUrl(workerUrl)
