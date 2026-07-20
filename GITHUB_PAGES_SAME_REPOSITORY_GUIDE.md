# 스쿨레이드 GitHub Pages 배포 안내 — 기존 저장소 하나만 사용

이 패치는 현재 스쿨레이드 GitHub 저장소 하나에서 Vercel, Netlify, GitHub Pages를 함께 운영하도록 구성되어 있습니다.

## 배포 주소

현재 저장소가 `GitHub아이디/저장소명`이라면 Pages 주소는 다음 형식입니다.

`https://GitHub아이디.github.io/저장소명/`

## 기존 기능 보호 방식

- Vercel·Netlify 빌드에는 `GITHUB_PAGES_BUILD`가 없으므로 기존 Next.js 설정이 그대로 유지됩니다.
- 정적 export, `basePath`, `assetPrefix`는 GitHub Actions 빌드에서만 적용됩니다.
- `app/api` 제거도 GitHub Actions의 임시 작업 공간에서만 실행되며 GitHub 원본 코드에서는 삭제되지 않습니다.
- 이미지·음원 등 `public` 경로는 Pages 빌드 결과에서만 저장소 경로가 자동으로 보정됩니다.
- Supabase 프로젝트와 실시간 협동 전투 데이터는 기존과 동일합니다.

## 1. GitHub Actions Secrets 등록

현재 스쿨레이드 저장소에서 다음으로 이동합니다.

Settings → Secrets and variables → Actions → Secrets → New repository secret

다음 두 개를 등록합니다.

1. `NEXT_PUBLIC_SUPABASE_URL`
2. `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Vercel·Netlify에 사용한 것과 같은 값을 넣습니다. `SUPABASE_SERVICE_ROLE_KEY`는 넣지 않습니다.

## 2. GitHub Pages 활성화

현재 스쿨레이드 저장소에서 다음으로 이동합니다.

Settings → Pages

Build and deployment의 Source를 `GitHub Actions`로 선택합니다.

별도의 브랜치나 새 저장소를 만들 필요가 없습니다.

## 3. 배포 실행

패치 파일을 main 브랜치에 올리면 자동으로 실행됩니다.

수동으로 실행하려면:

Actions → Deploy GitHub Pages → Run workflow

## 4. 확인할 기능

- 첫 화면 로고·배경·버튼
- 교사 방 생성
- 학생 입장 및 실시간 표시
- 문제·보스 HP·학생 HP 동기화
- 이미지·스프라이트·음원·효과음
- Vercel 교사 ↔ GitHub Pages 학생 교차 접속
- Netlify 교사 ↔ GitHub Pages 학생 교차 접속

## GitHub Pages에서만 제한되는 기능

GitHub Pages에는 서버가 없으므로 `/api/shared-quizzes/admin`처럼 Next.js API Route가 필요한 기능은 Pages 주소에서 사용할 수 없습니다. Vercel과 Netlify에서는 기존대로 사용할 수 있습니다. 보스전 핵심 기능은 Supabase 클라이언트 통신을 사용하므로 Pages에서도 유지됩니다.
