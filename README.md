# 하늘자리 리모델링 (정적 MPA)

- 스택: Vite + Vanilla JS + SCSS (Tailwind 미사용)
- 형태: 정적 멀티페이지(헤더/푸터 파셜, 반응형, 다크모드)
- SEO: robots.txt, sitemap.xml, 메타/OG, JSON-LD(Organization/FAQ)

## 실행(Windows PowerShell)

```powershell
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 빌드 산출물 생성(dist)
npm run build

# 빌드 미리보기
npm run preview
```

## 구조
- `src/pages`: 각 페이지(홈, 회사소개, 후불제상조, 납골당, 공원묘지, 수목장, 이장/개장, 묘지조성, 장례용품, 자료실, FAQ, 문의, 정책)
- `src/partials`: 공통 `head`, `header`, `footer`
- `src/styles`: `main.scss` (CSS 변수·그리드·반응형)
- `src/scripts`: `main.js` (파셜 include, 네비/다크모드/브레드크럼)
- `public`: 정적 리소스(robots, sitemap, assets)

## 주의
- 현재 문의 폼은 데모용 alert 처리입니다. 운영 시 서버(또는 폼 서비스) 연동 필요.
- 정책/연락처/전화번호/로고 이미지는 실제 정보로 교체하세요.

## 다음 단계 제안
- 도메인에 HTTPS 적용 및 강제 리다이렉션
- 콘텐츠 이관(구 사이트 → 신규 구조) 및 이미지 최적화(WebP)
- 접근성 감사(헤딩/대체텍스트/키보드 포커스)
