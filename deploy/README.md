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

한국 시간 매일 08:00 소식 수집·문안 준비, 10:00 Threads, 10:15 조건부 Instagram, 월 09:00 주간 보고. 서버 시간대가 UTC여도 타이머에 `Asia/Seoul`을 지정한다. 놓친 예약은 몰아서 보내지 않으며 2시간 지난 전송은 만료한다. 웹과 별개로 타이머를 설치해야 동작한다.

`npm run promotion -- prepare`는 게시 없이 다음 예약의 소식을 준비한다. 운영 사이트의 공개 목록에 있는 모든 아티스트를 로컬 `content/catalogue.json`과 대조하므로 **아티스트 추가 배포 때 자동 게시 서버의 카탈로그도 함께 갱신**한다. 새 아티스트가 로컬에 없으면 누락시키지 않고 중단한다. `--local`은 로컬 공개 목록을 사용하는 점검 옵션이다.

공식 아티스트·레이블·공연장·주최자·티켓 판매처·원 인터뷰의 소식을 조사한다. 발표일 14일 이내의 뉴스 또는 30일 안의 공연이 명시된 현재 공식 일정만 후보로 삼는다. 공식 일정에 발표일이 없으면 새로 발표됐다고 쓰지 않는다. 출처 원문의 근거를 직접 확인하고 별도 실시간 사실·문체 검수를 통과한 주제 하나만 준비한다. 같은 소식은 URL·언어를 바꿔 재게시하지 않으며, 새 소식에는 예전 아티스트 소개용 28일 제한을 적용하지 않는다. 새 소식이 없거나 출처를 읽을 수 없으면 이유를 기록하고 쉰다.

생성·검수는 [문체 지침](../promotion/voice.md)을 공통으로 읽는다. 자체 계정은 공식 API에서 계정 일치를 먼저 확인한 뒤 최근 공개 게시물의 본문·링크·게시일만 가져와 중복과 문체를 비교한다. 검수에는 출처 링크를 붙인 최종 게시 문안 전체를 전달하며, 같은 날의 Threads·Instagram 동시 게시는 플랫폼별 한 번씩 허용한다. Codex는 임시 작업 디렉터리에서 공개 자료만 전달받으며 셸·앱·플러그인·다중 에이전트·브라우저 조작 기능을 끈다. 웹 검색은 실시간으로 사용하고, 인증 파일을 프롬프트에 넣지 않는다. 수집 7분, 후보별 검수 3분·최대 3건으로 제한하고 사용량·시간 제한 시 유료 API로 대체하지 않는다. 준비 서비스의 전체 제한은 20분이다. 게시 직전에도 원문과 일정·취소 여부를 다시 검수한다.

Threads는 원문 링크가 있는 텍스트로 게시할 수 있다. Instagram은 `promotion/media.json`에 같은 `topicKey`의 사용 가능한 이미지가 등록된 경우에만 게시한다. 항목에는 `url`(공개 JPEG), `provenanceURL`, `rights`(`owned`/`permission`/`licensed`), `rightsNote`, `approvedBy`, `approvedAt`(YYYY-MM-DD), `altText`, 선택적 `expiresAt`가 필요하다. 공개 포스터나 기존 앨범 이미지를 자동으로 전용하지 않는다. 등록 이미지가 없으면 Threads만 진행하고 Instagram 제외 이유를 남긴다.
Meta 개발자 앱에서 본인 계정 `indiekdotcom`만 연결한다. Threads는 기본 정보·게시 권한, Instagram은 프로페셔널 계정의 기본 정보·콘텐츠 게시 권한을 사용한다. 앱 심사나 계정 전환이 필요한지는 실제 대시보드에서 확인한다. 최초 승인은 브라우저에서 하고 장기 토큰을 서버의 `~/.config/indiek-promotion/credentials.json`에 0600으로 저장한다. 토큰을 Git·문안·채팅·명령 인자에 넣지 않는다.

인증 JSON의 플랫폼별 항목은 `threads` / `instagram`이며 `userId`, `token`, `issuedAt`, `expiresAt`(ISO 날짜)가 필요하다. Instagram API 기본 버전은 `v26.0`이다. 선택적인 Matomo 항목은 `matomo.token`으로, 사이트 4만 읽는 별도 토큰을 사용한다. 안전한 로컬 파일을 준비한 뒤 `npm run promotion -- credentials --stdin < /secure/path/credentials.json`으로 가져오면 기존 다른 플랫폼 설정은 유지한다. 연결하지 않은 통계는 미측정으로 보고하며 Search Console은 수동 확인이다.

실행 결과는 `promotion/state/queue.json`, 날짜별 수집·탈락 사유·검수는 `promotion/state/news/`, 주간 보고는 `promotion/state/reports/`에 저장한다. 이 상태 디렉터리와 자격 증명은 배포 복사·Git 대상에서 제외하고 보존한다. **자동 게시 기록의 기준은 실행 서버**다. `docs/promotion.md`의 `automatic-promotion` 구간을 로컬로 병합하며 수동 기록이나 서버 로그를 통째로 덮어쓰지 않는다. 서버는 Git push를 실행하지 않는다.

```sh
# 점검 및 즉시 중단
journalctl --user -u indiek-promotion-threads.service -n 50 --no-pager
systemctl --user stop indiek-promotion-prepare.timer indiek-promotion-threads.timer indiek-promotion-instagram.timer
```

공개 원문·계정과 필요한 경우 이미지까지 확인한 뒤 보낸다. 기존의 미전송 정적 소개 예약은 일일 소식 정책으로 전환할 때 `superseded`로 기록하며 삭제하지 않는다. 이미 생성·제출·게시된 작업은 바꾸지 않는다. `publishing`·`submitted`는 게시 ID나 정확히 일치하는 최근 문안으로 조회하며 새로 전송하지 않는다. `held`·`creating` 또는 `pausePlatform`이 있으면 실제 계정과 로그를 확인한다. 원인을 해결해도 불확실한 작업을 `ready`로 바꾸지 않는다. 인증·플랫폼 제한이 해소된 경우에만 상태 백업 후 해당 `pausePlatform`을 해제하고 타이머를 시작한다. 기존 큐를 삭제해서 재시도하지 않는다. 토큰은 만료 7일 전부터 갱신하며 갱신 실패·만료 시 재연결 전까지 전송하지 않는다.

최초 설치 확인(2026-10-19, 일일 소식 전환 전): 원격 테스트 68개 통과, 타이머 3개 활성화, Codex로 공개 원문 기반 문안 3개 준비. Threads와 Instagram 모두 기본 정보·게시 권한만 연결하고 서버에서 본인 계정 일치·기존 게시물 각 1건 조회를 확인했다. Instagram은 사용자 승인으로 공개 크리에이터 계정으로 전환했다. Threads 초기 갱신 기준은 발급 후 59일로 보수적으로 기록했으며, Instagram 만료 시각은 Meta 디버거로 확인한 `2026-12-18T11:07:37Z`다. 공유 이미지·공개 목록 배포 후 최종 dry-run에서 3건 모두 원문·이미지 확인을 통과했다. 공개 목록을 사용하는 `prepare`도 기존 예약을 보존하며 통과했다. 첫 전송은 10월 20일 10:00 KST Threads 예약이며, 실제 게시·외부 노출은 아직 미검증이다. 서버의 이전 미커밋 셋업은 `indiek automation setup before deployment 2026-10-19` stash에 보관했으며 기존 큐·토큰은 그대로 유지했다.

일일 소식 전환 확인(2026-10-19): 수집·Threads·Instagram·주간 보고 타이머 4개를 활성화하고 원격 홍보 테스트 31개를 통과했다. 두 API 계정 일치와 기존 공개 게시물 본문 조회를 확인했다. 첫 수집의 문안·이력 전달 문제를 수정한 뒤 같은 날 자료의 원문과 최종 문안을 다시 검수해 BOL4 공연 소식 1건을 10월 20일 10:00 KST에 준비했다. 승인 이미지가 없어 Instagram은 제외했다. 미전송 정적 예약 3건은 대체 상태로 보존했다. 실제 뉴스 전송은 아직 하지 않았다. 소스는 자동 게시 서버에 직접 동기화한 미커밋 상태이므로 다음 Git 업데이트 전 변경 내용과 서버 관리 로그를 대조한다. 전환 전 코드·큐·로그 백업은 `promotion/state/backups/`에 있다.

## 확인과 복구

- 최근 배포: 2026-10-19 `a9b8e0a` — 첫 입문 가이드·RSS·관련 추천·공유 이미지 22장·자동 게시용 공개 목록·새 통계 동의를 반영했다. 가이드 공개일과 통계 전환일은 2026-10-19다. 로컬·웹 서버·자동 게시 서버에서 테스트 68개 및 22페이지 검증 통과, 공개 HTML·공통 파일·공유 이미지·피드 등 55개가 로컬 빌드와 일치했다. HTTPS·리다이렉트·JS/JPEG MIME, 운영 데스크톱·모바일 가이드·Saved 저장/삭제·내부 이동/뒤로 가기, 동의 전 YouTube 미로드·콘솔 오류 없음을 확인했다. Saved 0·1·13·50곡·긴 목록·가로 전환·오류 안내는 배포 전 모의 플레이어로 검증했으며, 이번 배포에서 실제 YouTube 재생·실기기 키보드·전체 화면은 재검증하지 않았다. Nginx 변경은 없고 복구 기준은 `200c474`다. 증빙은 로컬 `qa/growth-deployment-manifest.json`과 `qa/growth-deployed-*.png`.
- Google 검색 등록: 2026-10-19 HTML 태그 소유권 확인 완료. 사이트맵 처리 상태 `성공`, 발견된 페이지 20개를 확인했고 홈페이지는 이후 `색인이 생성됨`으로 확인됐으며 Googlebot 스마트폰의 최근 크롤링은 2026-10-19 00:51:16이다. 실제 Google 검색에서도 홈페이지와 일부 상세 페이지가 노출된다. 현재 공개 사이트맵은 22개 URL이며 Search Console의 마지막 처리 결과는 20개다. 새 백예린 페이지는 당시 색인되지 않았지만 실시간 검사에서 `페이지 색인을 생성할 수 있음`으로 통과했다. 새 입문 가이드는 이번 배포에서 사이트맵에 추가했으며 색인은 미확인이다. 실적·코어 웹 바이탈 보고서는 당시 데이터 처리 중이었다. 실제 색인 상태는 Search Console에서 별도로 확인한다.
- Matomo 최근 점검: 2026-10-19 새 버전 배포 후 운영 브라우저에서 허용 전 스크립트 미로드, 허용 후 페이지뷰·내부 이동·저장·Threads 유입 이벤트의 DB 반영, 쿼리 없는 URL 저장을 확인했다. 철회는 다른 열린 탭에도 반영됐고 두 탭의 후속 이동에서 DB 기록이 늘지 않았다. 점검으로 페이지뷰 3건·저장 1건·Threads 유입 1건이 포함되므로 자연 유입 성과로 계산하지 않는다. 실제 재생·공유 이벤트는 이번 운영 점검에서 발생시키지 않았다. 전체 방문 수가 아닌 통계를 허용한 방문만 집계하며 DNT·GPC 신호도 존중한다.
- 통계 비교 시 사이트 ID `4`, 날짜·시간대(`Asia/Seoul`), 방문 수와 페이지뷰의 구분을 먼저 확인한다. 실시간 보고서와 요약 보고서는 갱신 시점이 다르다. 현재 서버는 5분마다 아카이브를 실행하며 당일 보고서 캐시의 기본 유효기간은 15분이다. Reddit 게시글 조회수와 사이트 방문 수를 직접 비교하지 않는다.
- HTTPS 접속, HTTP·www 리다이렉트, 변경한 페이지·링크·검색·재생을 확인한다. 브라우저 모듈 오류가 나면 `.mjs` MIME 설정도 확인한다.
- 공통 플레이어는 [재생·페이지 이동 검증 항목](../AGENTS.md#콘텐츠-변경-시-함께-확인)을 데스크톱·모바일에서 확인한다. 동의 전에는 YouTube iframe·API 스크립트가 없고, 로드 후에는 하나만 있어야 한다. 가운데 감상창·최소화·Saved 목록 변경·다음 곡 재생도 같은 iframe을 유지해야 한다. 실제 곡 종료 후 다음 곡 시작, 마지막 곡 정지, Auto-next 해제와 자동 재생 차단 안내를 확인한다. 내부 이동 시 Matomo 페이지 조회가 동의한 방문에만 기록되는지도 확인한다.
- 실패하면 깨끗한 체크아웃에서 기록한 이전 커밋으로 복구한다. Nginx 설정도 바꿨다면 백업을 복원하고 검사 후 reload한다.
