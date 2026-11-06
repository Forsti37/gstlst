// Runs supabase/tests/database/*.test.sql against the linked project without Docker, which
// `supabase test db` needs even with --remote. Top-level pgTAP calls are rewritten to collect
// their output, and the script ends by raising that output as an error. The error aborts the
// transaction, so test data can never stay behind, and it is the way the output gets back.
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// The linked project, or another one: npm run db:test -- --remote=<project ref>
const target = process.argv.find((arg) => arg.startsWith('--remote=')) ?? '--remote'
const MARKER = 'GSTLST_TAP_OUTPUT'
const dir = 'supabase/tests/database'
const files = readdirSync(dir).filter((f) => f.endsWith('.test.sql'))
const tmp = mkdtempSync(join(tmpdir(), 'gstlst-db-tests-'))

function toCollectingSql(sql) {
  const body = sql
    .replace(/^select plan\(\d+\);\s*$/m, '')
    .replace(/^select \* from finish\(\);\s*$/m, '')
    .replace(/^rollback;\s*$/m, '')
    // Collect from each top-level pgTAP assertion. Assertions start at the beginning of a line.
    .replace(/^select (is|isnt|ok|lives_ok|throws_ok)\(/gm,'insert into pg_temp.tap (line) select $1(')
    .replace(
      /^set local search_path = public, extensions;$/m,
      `set local search_path = public, extensions;
create temp table tap (n serial, line text) on commit drop;
grant all on pg_temp.tap to public;
grant all on sequence pg_temp.tap_n_seq to public;
select plan(1000);`,
    )
  return `${body}
do $tap_end$
begin
  -- Only the count and the failures: the CLI truncates long error messages.
  raise exception '${MARKER}count=%|%',
    (select count(*) from pg_temp.tap),
    (select coalesce(string_agg(line, chr(10) order by n), '') from pg_temp.tap where line like 'not ok%');
end;
$tap_end$;
`
}

let failed = 0
let total = 0
for (const file of files) {
  const sqlPath = join(tmp, file)
  writeFileSync(sqlPath, toCollectingSql(readFileSync(join(dir, file), 'utf8')))
  const run = spawnSync(`npx --no-install supabase db query ${target} --yes -f "${sqlPath}"`, {
    shell: true,
    encoding: 'utf8',
    maxBuffer: 1 << 26,
  })
  const output = `${run.stdout}\n${run.stderr}`
  const start = output.indexOf(MARKER)
  if (start === -1) {
    console.error(`${file}: the script stopped early\n${output}`)
    failed += 1
    continue
  }
  // The CLI reports the error as JSON, so real newlines arrive escaped.
  const text = output
    .slice(start + MARKER.length)
    .replace(/\\n/g, '\n')
    .replace(/\\"/g, '"')
  const count = Number(/^count=(\d+)\|/.exec(text)?.[1] ?? -1)
  const planned = Number(/^select plan\((\d+)\);/m.exec(readFileSync(join(dir, file), 'utf8'))?.[1] ?? -2)
  const notOk = text.split('\n').filter((l) => /^(count=\d+\|)?not ok/.test(l.trim()))
  total += count
  failed += notOk.length
  console.log(`${file}: ${count - notOk.length} passed, ${notOk.length} failed, ${planned} planned`)
  for (const l of notOk) console.log(l)
  if (count !== planned) {
    console.error(`${file}: ran ${count} assertions, but the plan says ${planned}`)
    failed += 1
  }
}
rmSync(tmp, { recursive: true, force: true })
console.log(`${total} assertions, ${failed} failed`)
process.exit(failed === 0 && total > 0 ? 0 : 1)
