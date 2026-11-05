// Writes src/lib/database.types.ts from the linked project. The CLI prints status lines on
// stdout too, so only the output from the first type declaration onwards is kept.
import { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const run = spawnSync('npx --no-install supabase gen types typescript --linked --schema public', {
  shell: true,
  encoding: 'utf8',
  maxBuffer: 1 << 26,
})
const start = run.stdout.indexOf('export type Json')
if (run.status !== 0 || start === -1) {
  console.error(run.stdout, run.stderr)
  process.exit(1)
}
writeFileSync('src/lib/database.types.ts', run.stdout.slice(start))
console.log('Wrote src/lib/database.types.ts')
