/** @type {import('next').NextConfig} */
const isGitHubPagesBuild = process.env.GITHUB_PAGES_BUILD === 'true'
const repositoryName = (process.env.GITHUB_REPOSITORY || '').split('/')[1] || ''
const pagesBasePath = isGitHubPagesBuild && repositoryName ? `/${repositoryName}` : ''

const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // GitHub Pages 빌드에만 정적 export와 저장소 하위 경로를 적용합니다.
  // Vercel/Netlify 빌드에는 아래 설정이 적용되지 않아 기존 동작을 유지합니다.
  ...(isGitHubPagesBuild
    ? {
        output: 'export',
        trailingSlash: true,
        basePath: pagesBasePath,
        assetPrefix: pagesBasePath,
      }
    : {}),
  allowedDevOrigins: [
    '3000-ih1uhjcbhhq26ocqvmkfw-ff309969.sg1.manus.computer',
    '*.sg1.manus.computer',
  ],
}

export default nextConfig
