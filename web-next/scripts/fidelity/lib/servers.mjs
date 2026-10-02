// Start the two Vite dev servers (web/ and web-next) when their URLs are not answering, so a run is
// one command; servers this process started are stopped at exit. Both proxy /_api to mesonet2.
import { spawn } from 'node:child_process'
import { sleep } from './util.mjs'

const up = async (url) => {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(3000) })
    return r.ok
  } catch {
    return false
  }
}

const started = []

/** Make sure `target.base` answers; spawn `npx vite --port <port> --strictPort` in `target.dir` if not. */
export async function ensureServer(target) {
  if (await up(target.base)) return
  console.log(`starting ${target.label} dev server on :${target.port} (${target.dir})`)
  const child = spawn('npx', ['vite', '--port', String(target.port), '--strictPort'], { cwd: target.dir, stdio: 'ignore', detached: false })
  started.push(child)
  for (let i = 0; i < 60; i++) {
    if (await up(target.base)) return
    await sleep(1000)
  }
  throw new Error(`${target.label} dev server did not start at ${target.base}`)
}

export function stopServers() {
  for (const c of started) c.kill('SIGTERM')
}
