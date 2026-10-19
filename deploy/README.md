# 배포

원격 작업 범위는 [작업 지침](../AGENTS.md)을 따른다. SSH 접속 정보는 로컬 전용 `SERVER_ACCESS.md`에 있다.

- 저장소: `https://github.com/hurxxxx/indiek.git`의 `main`
- 서버 체크아웃: `/projects/indiek` · Nginx 웹 루트: `/projects/indiek/dist`
- 설정 원본: [nginx.conf](nginx.conf) · 적용 위치: `/etc/nginx/sites-available/indiek.com`
- Matomo: `https://matomo.lumejs.com`, indiek 사이트 ID `4`. 설정은 `content/catalogue.json`의 `site.analytics`. 동의 후 운영 도메인에서만 집계하며, 이 사이트에는 IP 2바이트 마스킹·유입 URL 경로 제외를 적용한다. 다른 Matomo 사이트의 설정은 유지한다.
- 인증서: `/etc/letsencrypt/live/indiek.com/` · 갱신: `certbot.timer`, webroot `/var/www/letsencrypt`
- Google Search Console: [URL 접두어 속성 `https://indiek.com/`](https://search.google.com/search-console?resource_id=https%3A%2F%2Findiek.com%2F). 소유권 확인 태그는 `content/catalogue.json`의 `site.googleSiteVerification`에서 생성하며 확인 후에도 유지한다. 사이트맵은 `https://indiek.com/sitemap.xml`이며 빌드 시 전체 공개 페이지를 반영한다.

## 업데이트

로컬에서 빌드·검증한 `dist/`를 소스와 함께 커밋·push한 뒤, 서버 체크아웃이 깨끗한지 확인하고 진행한다.

```sh
cd /projects/indiek
git status --short
git rev-parse HEAD  # 복구할 이전 커밋 기록
git pull --ff-only origin main
npm run check
```

콘텐츠 변경에는 Nginx reload가 필요 없다. 설정 변경 시 기존 파일을 백업하고 `nginx -t` 통과 후 reload한다. 다른 사이트·서비스는 유지한다. 현재 설정은 공유 서버의 TLS/HTTP2 설정을 상속하므로 다른 서버로 옮길 때 확인한다.

YouTube는 모든 페이지에서 공통 영역 `#persistent-player`를 사용한다. HTML과 `app.js`, `player.mjs`, `navigation.mjs`, `mobile.mjs`, `analytics.mjs`, `styles.css`는 같은 빌드로 함께 배포한다. 정적 페이지 주소는 그대로 제공하며, 별도 SPA fallback이나 애플리케이션 서버는 필요 없다. YouTube IFrame API를 위해 CSP의 `script-src`에 `https://www.youtube.com`이 필요하다(`iframe_api` 및 같은 호스트의 플레이어 API 스크립트). 순차 재생을 처음 배포할 때 `nginx.conf`도 함께 적용하고 `nginx -t` 후 reload한다. `connect-src`의 self·Matomo, YouTube `frame-src`, `.mjs` MIME 설정을 유지한다.

직접 재생 UI는 아티스트 페이지와 Saved에서 동의·재생 요청을 함께 처리한다. 모바일은 모달·Expand 없이 하단 플레이어로 시작하며 `#page-content`의 스크롤과 영상을 분리하므로 HTML·스타일·이동 코드를 함께 배포한다. Saved·검색 목록은 고정 조작부 아래에서 독립 스크롤되며 가로 화면에서는 영상 옆에 배치된다. Saved 재열기·삭제 시 위치 유지와 곡 선택 시 닫힘을 확인한다. 배포 후 긴 목록의 마지막 곡·검색 결과 접근, 화면 회전·키보드·오류 안내, Play all의 첫 곡 0초 재시작·이전·다음·Auto-next, 영상 전체 화면, 동의 전 연결 차단, 새로고침 시 동의 초기화, 모바일 읽던 위치·뒤로/앞으로 가기, 재생 차단 안내를 확인한다.

## 확인과 복구

- 최근 배포: 2026-10-19 `ca10be5` — Saved·검색의 독립 스크롤과 고정 조작부, 간결한 곡 목록·현재 곡 표시·목록 위치 복원, 짧은 가로 화면의 영상/본문 좌우 배치를 반영했다. 로컬·서버 테스트 43개와 21페이지 검증 통과, 공개 HTML·공통 파일 29개가 로컬 빌드와 일치했다. HTTPS·리다이렉트·JS MIME, 운영 모바일 Saved 조작부·검색 마지막 항목 접근·가로 화면 판정, 데스크톱 검색·내부 이동, 동의 전 YouTube 미로드·콘솔 오류 없음을 확인했다. 재생 중 Saved 0·1·13·50곡과 오류 상태는 배포 전 로컬 모의 플레이어로 확인했다. 실제 YouTube 재생·전체 화면과 실기기 키보드는 이번 검증에서 수행하지 않았다. 배포 전 커밋은 `0ac70cf`이다.
- Google 검색 등록: 2026-10-19 HTML 태그 소유권 확인 완료. 사이트맵 처리 상태 `성공`, 발견된 페이지 20개를 확인했고 홈페이지는 이후 `색인이 생성됨`으로 확인됐으며 Googlebot 스마트폰의 최근 크롤링은 2026-10-19 00:51:16이다. 실제 Google 검색에서도 홈페이지와 일부 상세 페이지가 노출된다. 현재 공개 사이트맵은 21개 URL이며 Search Console의 마지막 처리 결과는 20개다. 새 백예린 페이지는 아직 색인되지 않았지만 실시간 검사에서 `페이지 색인을 생성할 수 있음`으로 통과했다. 실적·코어 웹 바이탈 보고서는 데이터 처리 중이다. 새 페이지는 빌드·배포로 사이트맵에 반영하며, Search Console에서 실제 색인 생성 상태를 별도로 확인한다.
- Matomo 최근 점검: 2026-10-19. 운영 브라우저에서 허용 전 스크립트 미로드, 허용 후 홈·내부 이동 조회의 DB·실시간 보고서 반영, 철회 후 추가 조회 미기록을 확인했다. 해당 날짜에는 점검용 조회가 포함된다. 전체 방문 수가 아닌 통계를 허용한 방문만 집계하며 DNT·GPC 신호도 존중한다.
- 통계 비교 시 사이트 ID `4`, 날짜·시간대(`Asia/Seoul`), 방문 수와 페이지뷰의 구분을 먼저 확인한다. 실시간 보고서와 요약 보고서는 갱신 시점이 다르다. 현재 서버는 5분마다 아카이브를 실행하며 당일 보고서 캐시의 기본 유효기간은 15분이다. Reddit 게시글 조회수와 사이트 방문 수를 직접 비교하지 않는다.
- HTTPS 접속, HTTP·www 리다이렉트, 변경한 페이지·링크·검색·재생을 확인한다. 브라우저 모듈 오류가 나면 `.mjs` MIME 설정도 확인한다.
- 공통 플레이어는 [재생·페이지 이동 검증 항목](../AGENTS.md#콘텐츠-변경-시-함께-확인)을 데스크톱·모바일에서 확인한다. 동의 전에는 YouTube iframe·API 스크립트가 없고, 로드 후에는 하나만 있어야 한다. 가운데 감상창·최소화·Saved 목록 변경·다음 곡 재생도 같은 iframe을 유지해야 한다. 실제 곡 종료 후 다음 곡 시작, 마지막 곡 정지, Auto-next 해제와 자동 재생 차단 안내를 확인한다. 내부 이동 시 Matomo 페이지 조회가 동의한 방문에만 기록되는지도 확인한다.
- 실패하면 깨끗한 체크아웃에서 기록한 이전 커밋으로 복구한다. Nginx 설정도 바꿨다면 백업을 복원하고 검사 후 reload한다.
