import { readdir } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { join, resolve } from 'node:path'

const root = resolve(process.cwd())
const sourceRoots = ['src', 'scripts', 'tests']

async function collectJavaScript(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await collectJavaScript(path))
    if (entry.isFile() && /\.(?:js|mjs)$/.test(entry.name)) files.push(path)
  }

  return files
}

function run(label, command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', stdio: 'inherit' })
  if (result.status !== 0) throw new Error(`${label} failed with exit code ${result.status}`)
}

const files = (await Promise.all(sourceRoots.map(path => collectJavaScript(join(root, path))))).flat()
const testFiles = files.filter(file => file.includes(`${join(root, 'tests')}/`) || file.startsWith(join(root, 'tests')))
for (const file of files) run(`Syntax check: ${file}`, process.execPath, ['--check', file])
run('Build', process.execPath, ['scripts/build.mjs'])
run('Tests', process.execPath, ['--test', ...testFiles])
console.log(`Quality gate passed: ${files.length} JavaScript files checked`)
