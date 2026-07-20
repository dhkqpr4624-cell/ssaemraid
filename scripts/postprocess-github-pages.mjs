import { promises as fs } from 'node:fs'
import path from 'node:path'

const repository = process.env.GITHUB_REPOSITORY || ''
const repositoryName = repository.split('/')[1] || ''
const basePath = repositoryName ? `/${repositoryName}` : ''
const outDir = path.resolve('out')
const publicDir = path.resolve('public')

if (!basePath) {
  throw new Error('GITHUB_REPOSITORY가 없어 GitHub Pages basePath를 계산할 수 없습니다.')
}

const topLevelEntries = await fs.readdir(publicDir, { withFileTypes: true })
const publicPrefixes = topLevelEntries.map((entry) => `/${entry.name}`)
const textExtensions = new Set([
  '.html', '.css', '.js', '.mjs', '.json', '.txt', '.xml', '.svg', '.map', '.webmanifest',
])

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await walk(fullPath))
    else files.push(fullPath)
  }
  return files
}

function prefixPublicAssets(content) {
  let result = content
  for (const publicPath of publicPrefixes) {
    // 정적 빌드 결과의 루트 기준 public 경로만 저장소 basePath 아래로 이동합니다.
    // 이미 basePath가 붙은 문자열은 건드리지 않습니다.
    result = result.split(`${basePath}${publicPath}`).join(`__PAGES_ALREADY_PREFIXED__${publicPath}`)
    result = result.split(publicPath).join(`${basePath}${publicPath}`)
    result = result.split(`__PAGES_ALREADY_PREFIXED__${publicPath}`).join(`${basePath}${publicPath}`)
  }
  return result
}

const files = await walk(outDir)
let changedFiles = 0

for (const file of files) {
  if (!textExtensions.has(path.extname(file).toLowerCase())) continue
  const original = await fs.readFile(file, 'utf8')
  const updated = prefixPublicAssets(original)
  if (updated !== original) {
    await fs.writeFile(file, updated)
    changedFiles += 1
  }
}

await fs.writeFile(path.join(outDir, '.nojekyll'), '')
console.log(`GitHub Pages public 경로 보정 완료: ${changedFiles}개 파일, basePath=${basePath}`)
