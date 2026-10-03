/**
 * Data freshness (ARCHITECTURE "Data freshness"): a tab left open refetches
 * `/latest` when the viewer returns to it. The page clock moves 10 min past
 * the fixture time, then a `visibilitychange` must send a new `/latest` request.
 */
import { NOW, check, finish, open, start } from './lib.mjs'

const env = await start()
{
  const { ctx, page, close, rendered, problems } = await open(env, '?s=acebozem')
  await rendered({ charts: 1 })
  const isLatest = (r) => /\/api\/v2\/latest\?/.test(r.url())
  await ctx.clock.setSystemTime(new Date(Date.parse(NOW) + 10 * 60_000))
  const refetch = page.waitForRequest(isLatest, { timeout: 10000 }).then(
    () => true,
    () => false,
  )
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  check('returning to the tab after 10 min refetches /latest', await refetch)
  const p = await problems()
  check('freshness session: console + CSP clean', p.length === 0, p.slice(0, 4).join(' | '))
  await close()
}
await env.close()
finish('freshness')
