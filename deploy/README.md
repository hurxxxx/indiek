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

성장 콘텐츠를 배포할 때 `feed.xml`, 페이지별 `assets/social/*.jpg`, `promotion-catalogue.json`도 같은 빌드로 올린다. 새 가이드의 실제 공개일을 카탈로그에 기록하고 재빌드해야 RSS·최근 추가에 표시된다. 공유 이미지는 공개 HTTPS에서 JPEG로 응답해야 SNS API가 사용할 수 있다.

새 분석 버전은 기존 cookieless 허용을 승계하지 않고 재동의를 요청한다(거절은 유지). 새 허용 후에만 35일 first-party 쿠키·페이지뷰·재생/저장/공유·`from=threads|instagram` 유입 이벤트를 수집한다. 배포 시 허용 전 차단, 기존 선택 이전, 철회·다른 탭 철회, 실제 재생 이벤트 중복 방지, URL 쿼리 제외를 확인하고 `promotion/config.json`의 `measurementChangeDate`에 실제 전환일을 기록한다. 이전 기간과 방문자·재방문 수를 같은 기준으로 비교하지 않는다.

## SNS 자동 게시

웹 서버와 별개인 Linux 서버의 `~/projects/indiek`에서 실행한다. SSH 별칭·접속 정보는 로컬 `SERVER_ACCESS.md`에서 확인한다. Node.js 22+, Python 3/Pillow, ChatGPT로 로그인한 Codex CLI, 사용자 systemd·linger가 필요하다. 추가 API 과금 방식으로 전환하지 않는다.

```sh
cd ~/projects/indiek
node deploy/install-promotion.mjs
systemctl --user list-timers 'indiek-promotion-*' --no-pager
npm run promotion -- status
npm run promotion -- dry-run
```

한국 시간 월 09:00 주간 보고·문안 준비, 화·금 10:00 Threads, 금 10:15 Instagram. 서버 시간대가 UTC여도 타이머에 `Asia/Seoul`을 지정한다. 꺼진 동안 놓친 예약은 몰아서 실행하지 않으며 2시간 지난 전송은 만료한다. `prepare --local`은 최초 검토 때만 로컬 목록을 사용하고 원문이 실제 공개되어 있는지 확인한다. 정기 작업은 운영 사이트의 공개 목록을 읽는다.

Meta 개발자 앱에서 본인 계정 `indiekdotcom`만 연결한다. Threads는 기본 정보·게시 권한, Instagram은 프로페셔널 계정의 기본 정보·콘텐츠 게시 권한을 사용한다. 앱 심사나 계정 전환이 필요한지는 실제 대시보드에서 확인한다. 최초 승인은 브라우저에서 하고 장기 토큰을 서버의 `~/.config/indiek-promotion/credentials.json`에 0600으로 저장한다. 토큰을 Git·문안·채팅·명령 인자에 넣지 않는다.

인증 JSON의 플랫폼별 항목은 `threads` / `instagram`이며 `userId`, `token`, `issuedAt`, `expiresAt`(ISO 날짜)가 필요하다. Instagram API 기본 버전은 `v26.0`이다. 선택적인 Matomo 항목은 `matomo.token`으로, 사이트 4만 읽는 별도 토큰을 사용한다. 안전한 로컬 파일을 준비한 뒤 `npm run promotion -- credentials --stdin < /secure/path/credentials.json`으로 가져오면 기존 다른 플랫폼 설정은 유지한다. 연결하지 않은 통계는 미측정으로 보고하며 Search Console은 수동 확인이다.

실행 결과는 `promotion/state/queue.json`, 주간 보고는 `promotion/state/reports/`에 저장한다. 이 상태 디렉터리와 자격 증명은 배포 복사·Git 대상에서 제외하고 보존한다. **자동 게시 기록의 기준은 실행 서버**다. `docs/promotion.md`의 `automatic-promotion` 구간을 로컬로 병합하며 수동 기록이나 서버 로그를 통째로 덮어쓰지 않는다. 서버는 Git push를 실행하지 않는다.

```sh
# 점검 및 즉시 중단
journalctl --user -u indiek-promotion-threads.service -n 50 --no-pager
systemctl --user stop indiek-promotion-threads.timer indiek-promotion-instagram.timer
```

공개 원문·이미지·계정 일치 확인 후에만 보낸다. `publishing`·`submitted`는 게시 ID나 정확히 일치하는 최근 문안으로 조회하며 새로 전송하지 않는다. `held`·`creating` 또는 `pausePlatform`이 있으면 실제 계정과 로그를 확인한다. 원인을 해결해도 불확실한 작업을 `ready`로 바꾸지 않는다. 인증·플랫폼 제한이 해소된 경우에만 상태 백업 후 해당 `pausePlatform`을 해제하고 타이머를 시작한다. 기존 큐를 삭제해서 재시도하지 않는다. 토큰은 만료 7일 전부터 갱신하며 갱신 실패·만료 시 재연결 전까지 전송하지 않는다.

최초 설치 확인(2026-10-19): 원격 테스트 68개 통과, 타이머 3개 활성화, Codex로 공개 원문 기반 문안 3개 준비. Threads와 Instagram 모두 기본 정보·게시 권한만 연결하고 서버에서 본인 계정 일치·기존 게시물 각 1건 조회를 확인했다. Instagram은 사용자 승인으로 공개 크리에이터 계정으로 전환했다. Threads 초기 갱신 기준은 발급 후 59일로 보수적으로 기록했으며, Instagram 만료 시각은 Meta 디버거로 확인한 `2026-12-18T11:07:37Z`다. 최종 dry-run에서 공유 이미지 미공개로 3건 모두 전송이 차단됐다. 실제 게시·외부 노출 검증은 웹 배포 후 진행한다.

## 확인과 복구

- 최근 배포: 2026-10-19 `174c7e9` — 카더가든 「나무」를 내부 재생 가능한 비긴어게인 공식 라이브로 교체하고 Saved의 Play all(첫 곡 0초 재시작·Auto-next 켜짐)을 반영했다. 로컬·서버 테스트 46개와 21페이지 검증 통과, 공개 HTML·공통 파일·사이트맵 등 31개가 로컬 빌드와 일치했다. HTTPS·리다이렉트·JS MIME, 운영 데스크톱·모바일 Saved 버튼과 교체 영상 정보, 동의 전 YouTube 미로드·콘솔 오류 없음을 확인했다. 대표곡 14곡의 실제 임베드 재생과 Saved 0·1·13·50곡의 모의 플레이어 검증은 배포 전에 완료했다. 운영 사이트의 실제 재생 및 실기기 키보드·전체 화면은 이번 배포 확인에서 재검증하지 않았다. Nginx 설정 변경은 없으며 배포 전 커밋은 `bf837ce`이다.
- Google 검색 등록: 2026-10-19 HTML 태그 소유권 확인 완료. 사이트맵 처리 상태 `성공`, 발견된 페이지 20개를 확인했고 홈페이지는 이후 `색인이 생성됨`으로 확인됐으며 Googlebot 스마트폰의 최근 크롤링은 2026-10-19 00:51:16이다. 실제 Google 검색에서도 홈페이지와 일부 상세 페이지가 노출된다. 현재 공개 사이트맵은 21개 URL이며 Search Console의 마지막 처리 결과는 20개다. 새 백예린 페이지는 아직 색인되지 않았지만 실시간 검사에서 `페이지 색인을 생성할 수 있음`으로 통과했다. 실적·코어 웹 바이탈 보고서는 데이터 처리 중이다. 새 페이지는 빌드·배포로 사이트맵에 반영하며, Search Console에서 실제 색인 생성 상태를 별도로 확인한다.
- Matomo 최근 점검: 2026-10-19. 운영 브라우저에서 허용 전 스크립트 미로드, 허용 후 홈·내부 이동 조회의 DB·실시간 보고서 반영, 철회 후 추가 조회 미기록을 확인했다. 해당 날짜에는 점검용 조회가 포함된다. 전체 방문 수가 아닌 통계를 허용한 방문만 집계하며 DNT·GPC 신호도 존중한다.
- 통계 비교 시 사이트 ID `4`, 날짜·시간대(`Asia/Seoul`), 방문 수와 페이지뷰의 구분을 먼저 확인한다. 실시간 보고서와 요약 보고서는 갱신 시점이 다르다. 현재 서버는 5분마다 아카이브를 실행하며 당일 보고서 캐시의 기본 유효기간은 15분이다. Reddit 게시글 조회수와 사이트 방문 수를 직접 비교하지 않는다.
- HTTPS 접속, HTTP·www 리다이렉트, 변경한 페이지·링크·검색·재생을 확인한다. 브라우저 모듈 오류가 나면 `.mjs` MIME 설정도 확인한다.
- 공통 플레이어는 [재생·페이지 이동 검증 항목](../AGENTS.md#콘텐츠-변경-시-함께-확인)을 데스크톱·모바일에서 확인한다. 동의 전에는 YouTube iframe·API 스크립트가 없고, 로드 후에는 하나만 있어야 한다. 가운데 감상창·최소화·Saved 목록 변경·다음 곡 재생도 같은 iframe을 유지해야 한다. 실제 곡 종료 후 다음 곡 시작, 마지막 곡 정지, Auto-next 해제와 자동 재생 차단 안내를 확인한다. 내부 이동 시 Matomo 페이지 조회가 동의한 방문에만 기록되는지도 확인한다.
- 실패하면 깨끗한 체크아웃에서 기록한 이전 커밋으로 복구한다. Nginx 설정도 바꿨다면 백업을 복원하고 검사 후 reload한다.
