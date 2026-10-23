/** vitest globalSetup: fetch the pinned kit files once per run, SRI-checked (test/kit.ts). */
import { ensureKit } from './kit'

export default async function setup(): Promise<void> {
  await ensureKit()
}
