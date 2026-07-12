import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { afterEach, describe, expect, it } from 'vitest'
import packageJson from '../package.json'

const temporaryDirectories: string[] = []

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

describe('npm run clean', () => {
  it('removes generated artifacts and preserves dependencies and environment files', () => {
    const clean = (packageJson.scripts as Record<string, string>).clean
    expect(clean).toBeTypeOf('string')

    const directory = mkdtempSync(join(tmpdir(), 'loan-clean-'))
    temporaryDirectories.push(directory)
    writeFileSync(join(directory, 'package.json'), JSON.stringify({ private: true, scripts: { clean } }))

    const generated = [
      'dist', 'out', 'build', 'coverage', '.nyc_output', 'playwright-report',
      'test-results', '.vite', '.cache', '.turbo',
    ]
    for (const path of generated) {
      mkdirSync(join(directory, path), { recursive: true })
      writeFileSync(join(directory, path, 'artifact.txt'), 'generated')
    }
    writeFileSync(join(directory, '.eslintcache'), 'generated')
    writeFileSync(join(directory, 'app.tsbuildinfo'), 'generated')
    mkdirSync(join(directory, 'node_modules'), { recursive: true })
    writeFileSync(join(directory, 'node_modules', 'keep.txt'), 'dependency')
    writeFileSync(join(directory, '.env.local'), 'PRIVATE=value')

    const npmCli = process.env.npm_execpath
    expect(npmCli).toBeTruthy()
    const result = spawnSync(process.execPath, [npmCli!, 'run', 'clean'], {
      cwd: directory,
      encoding: 'utf8',
    })

    expect(result.stderr).toBe('')
    expect(result.status).toBe(0)
    for (const path of generated) expect(existsSync(join(directory, path))).toBe(false)
    expect(existsSync(join(directory, '.eslintcache'))).toBe(false)
    expect(existsSync(join(directory, 'app.tsbuildinfo'))).toBe(false)
    expect(existsSync(join(directory, 'node_modules', 'keep.txt'))).toBe(true)
    expect(existsSync(join(directory, '.env.local'))).toBe(true)
  })
})
