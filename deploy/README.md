# 배포

원격 작업 범위는 [작업 지침](../AGENTS.md)을 따른다. SSH 접속 정보는 로컬 전용 `SERVER_ACCESS.md`에 있다.

- 저장소: `https://github.com/hurxxxx/indiek.git`의 `main`
- 서버 체크아웃: `/projects/indiek` · Nginx 웹 루트: `/projects/indiek/dist`
- 설정 원본: [nginx.conf](nginx.conf) · 적용 위치: `/etc/nginx/sites-available/indiek.com`
- Matomo: `https://matomo.lumejs.com`, indiek 사이트 ID `4`. 설정은 `content/catalogue.json`의 `site.analytics`. 동의 후 운영 도메인에서만 집계하며, 이 사이트에는 IP 2바이트 마스킹·유입 URL 경로 제외를 적용한다. 다른 Matomo 사이트의 설정은 유지한다.
- 인증서: `/etc/letsencrypt/live/indiek.com/` · 갱신: `certbot.timer`, webroot `/var/www/letsencrypt`
- Google Search Console: [URL 접두어 속성 `https://indiek.com/`](https://search.google.com/search-console?resource_id=https%3A%2F%2Findiek.com%2F). 소유권 확인 태그는 `content/catalogue.json`의 `site.googleSiteVerification`에서 생성하며 확인 후에도 유지한다. 사이트맵은 `https://indiek.com/sitemap.xml`이며 빌드 시 전체 공개 페이지를 반영한다.

## 업데이트

로컬에서 빌드·검증한 `dist/`를 소스와 함께 커밋·push한 뒤, 서버 체크아웃이 깨끗한지 확인하고 진행한다. `npm run check`는 임시 디렉터리에서 실제 빌드와 이미지 준비도 검사하므로 검증 서버에도 Python 3와 Pillow(WebP 지원)가 필요하다. Ubuntu 운영 서버는 `python3-pil` 패키지를 사용한다.

```sh
cd /projects/indiek
git status --short
git rev-parse HEAD  # 복구할 이전 커밋 기록
git pull --ff-only origin main
npm run check
```

콘텐츠 변경에는 Nginx reload가 필요 없다. 설정 변경 시 기존 파일을 백업하고 `nginx -t` 통과 후 reload한다. 다른 사이트·서비스는 유지한다. 현재 설정은 공유 서버의 TLS/HTTP2 설정을 상속하므로 다른 서버로 옮길 때 확인한다.

YouTube는 모든 페이지에서 공통 영역 `#persistent-player`를 사용한다. HTML과 `app.js`, `shared.mjs`, `directory.mjs`, `player.mjs`, `navigation.mjs`, `mobile.mjs`, `analytics.mjs`, `styles.css`는 같은 빌드로 함께 배포한다. `/artists/`를 포함한 정적 페이지 주소는 그대로 제공하며, 별도 SPA fallback이나 애플리케이션 서버는 필요 없다. YouTube IFrame API를 위해 CSP의 `script-src`에 `https://www.youtube.com`이 필요하다(`iframe_api` 및 같은 호스트의 플레이어 API 스크립트). 순차 재생을 처음 배포할 때 `nginx.conf`도 함께 적용하고 `nginx -t` 후 reload한다. `connect-src`의 self·Matomo, YouTube `frame-src`, `.mjs` MIME 설정을 유지한다.

직접 재생 UI는 아티스트 페이지와 Saved에서 동의·재생 요청을 함께 처리한다. 모바일은 모달·Expand 없이 하단 플레이어로 시작하며 `#page-content`의 스크롤과 영상을 분리하므로 HTML·스타일·이동 코드를 함께 배포한다. Saved·검색 목록은 고정 조작부 아래에서 독립 스크롤되며 가로 화면에서는 영상 옆에 배치된다. Saved 재열기·삭제 시 위치 유지와 곡 선택 시 닫힘을 확인한다. 배포 후 긴 목록의 마지막 곡·검색 결과 접근, 화면 회전·키보드·오류 안내, Play all의 첫 곡 0초 재시작·이전·다음·Auto-next, 영상 전체 화면, 동의 전 연결 차단, 새로고침 시 동의 초기화, 모바일 읽던 위치·뒤로/앞으로 가기, 재생 차단 안내를 확인한다.

성장 콘텐츠를 배포할 때 페이지별 `assets/social/*.jpg`, `promotion-catalogue.json`도 같은 빌드로 올린다. 새 가이드의 실제 공개일을 카탈로그에 기록하고 재빌드해야 홈 업데이트에 표시된다. 공유 이미지는 공개 HTTPS에서 JPEG로 응답해야 SNS API가 사용할 수 있다.

새 분석 버전은 기존 cookieless 허용을 승계하지 않고 재동의를 요청한다(거절은 유지). 새 허용 후에만 35일 first-party 쿠키·페이지뷰·재생/저장/공유·`from=threads|instagram` 유입 이벤트를 수집한다. 배포 시 허용 전 차단, 기존 선택 이전, 철회·다른 탭 철회, 실제 재생 이벤트 중복 방지, URL 쿼리 제외를 확인하고 `promotion/config.json`의 `measurementChangeDate`에 실제 전환일을 기록한다. 이전 기간과 방문자·재방문 수를 같은 기준으로 비교하지 않는다.

쿠키 배너의 문구·표시만 바꾸는 배포는 측정 방식 전환이 아니다. 기존 동의 저장 키·선택·`measurementChangeDate`를 유지하고, `Allow cookies`·`Reject`·`Details`와 푸터의 `Cookie settings`, 개인정보 안내를 함께 확인한다. 자동 발행 서버에도 같은 빌드 소스를 반영해 이후 기사 발행 때 이전 UI가 복원되지 않게 하며, 서버의 홍보 기록·예약 상태는 보존한다.

## 접속 로그

2026-10-23부터 indiek의 HTTP·HTTPS·www 요청은 `/var/log/nginx/indiek/access.log`에 JSON Lines 형식으로 기록한다. 연결 IP, 시간(서버 시간대 Asia/Seoul), 호스트·스킴·메서드·원래 요청 경로, 응답 코드·본문 크기·처리 시간·User-Agent를 남긴다. 쿼리 문자열·Referer·Cookie·Authorization은 기록하지 않는다. 이는 쿠키를 사용하지 않는 서버 로그이며 선택적 Matomo와 별개다. 공개 [개인정보 안내](https://indiek.com/privacy-and-terms/)도 같은 수집 범위를 설명한다. 활성화 전의 전체 접속은 복원할 수 없다.

설정 원본은 [nginx.conf](nginx.conf)와 [logrotate-indiek.conf](logrotate-indiek.conf)다. 전용 하위 디렉터리로 기존 `/var/log/nginx/*.log` 규칙과 겹치지 않게 한다. 기존 error log와 다른 사이트의 규칙은 유지한다. 설정을 백업한 뒤 저장소 루트에서 설치한다.

```sh
install -d -o www-data -g adm -m 0750 /var/log/nginx/indiek
install -o root -g root -m 0644 deploy/nginx.conf /etc/nginx/sites-available/indiek.com
install -o root -g root -m 0644 deploy/logrotate-indiek.conf /etc/logrotate.d/indiek
nginx -t
logrotate --debug /etc/logrotate.conf
systemctl reload nginx
chown www-data:adm /var/log/nginx/indiek/access.log
chmod 0640 /var/log/nginx/indiek/access.log
systemctl is-active logrotate.timer
systemctl is-enabled logrotate.timer
```

기존 `logrotate.timer`가 매일 실행한다(현재 자정 KST 기준, 시스템 설정상 최대 1시간 지연). 비어 있는 날도 회전하며 현재 파일과 과거 29회분을 보관하고 30일 지난 회전 파일은 제거한다. `.1`은 Nginx가 파일을 다시 여는 동안의 기록 유실을 피하기 위해 하루간 비압축으로 두고 `.2.gz`부터 gzip 압축한다. `create 0640 www-data adm`과 Nginx의 로그 reopen으로 회전 뒤에도 기록을 이어 간다. 압축 보관은 같은 서버 안에서 이루어지며 별도 서버 백업은 구성하지 않았다. 원시 로그는 Git·웹 루트·공개 문서에 복사하지 않는다.

적용 후 실제 HTTPS 요청이 기록되는지, HTTP·www 리다이렉트가 유지되는지 확인한다. 전용 규칙만 `logrotate --force /etc/logrotate.d/indiek`로 회전할 수 있으며 전체 서버 설정을 강제 회전하지 않는다. 검증 시 회전 뒤 새 파일에 기록되는지와 `gzip -t`로 압축 파일 무결성을 확인한다. 검증 요청은 `indiek-log-check/` User-Agent로 구별하며 방문 집계에서 제외한다. 집계는 정상 HTML 요청과 알려진 봇·점검 요청을 분리하며 IP·User-Agent 기반 고유 방문자는 NAT·동적 IP·브라우저 변경 때문에 추정치로 표시한다. Matomo 방문자 수와 동일한 지표로 합산하지 않는다.

## SNS 자동 게시

현재 방식(2026-10-24): 정기 SNS는 새 공개 기사 다음으로 기존 가사 해설·곡 배경·듣기 가이드를 소개하고 관련 indiek 페이지로 연결한다. 외부 공연·발매 공지를 자동 대체재로 사용하지 않는다. 정기 예약과 로컬의 즉시 공유는 같은 공식 API 게시기를 사용하며, 로컬에는 토큰이나 별도 게시 큐를 복제하지 않는다. 기존 게시물은 유지하고 같은 요청을 다시 전송하지 않는다.

웹 서버와 별개인 Linux 서버의 `~/projects/indiek`에서 실행한다. SSH 별칭·접속 정보는 로컬 `SERVER_ACCESS.md`에서 확인한다. Node.js 22+, Python 3/Pillow, ChatGPT로 로그인한 Codex CLI, 사용자 systemd·linger가 필요하다. 추가 API 과금 방식으로 전환하지 않는다.

```sh
cd ~/projects/indiek
node deploy/install-promotion.mjs
systemctl --user list-timers 'indiek-promotion-*' --no-pager
npm run promotion -- status
npm run promotion -- dry-run
```

한국 시간 매일 08:00 편집 소재 선정·문안 준비, 10:00 Threads, 10:15 Instagram, 월 09:00 주간 보고. 사용할 공개 원문·자체 제작 카드와 검수가 없으면 해당 게시를 쉰다. 서버 시간대가 UTC여도 타이머에 `Asia/Seoul`을 지정한다. 놓친 예약은 몰아서 보내지 않으며 2시간 지난 전송은 만료한다. 웹과 별개로 타이머를 설치해야 동작한다.

`npm run promotion -- prepare`는 게시 없이 다음 예약을 준비한다. 미공유 공개 기사를 우선하고, 없으면 공개 목록의 아티스트 소개·가이드 중 최근 28일에 공유하지 않은 페이지를 고른다. 직전 아티스트 소개 뒤에는 가능한 경우 가이드를 고르며 가사 장면·의미의 변화·공식 배경·곡 사이의 연결 중 한 가지를 짧게 전달한다. 운영 공지나 일반적인 추천 문구로 대신하지 않는다. 하루 소재와 최대 두 초안의 검수 예산을 `promotion/state/pages/YYYY-MM-DD.json`에 보존하고 재시작으로 초기화하지 않는다. 원문·자체 제작 카드의 해시와 플랫폼별 정확한 문안 검수가 모두 통과해야 큐에 넣으며 준비 명령은 전송하지 않는다. 전송 직전에도 페이지·카드 변경과 당일 게시를 다시 확인한다. 아티스트·곡 변경 배포 때 자동 게시 서버의 소스도 함께 갱신한다. `--local`은 로컬 공개 목록을 사용하는 점검 옵션이다.

사용자가 특정 공개 기사의 비정기 SNS 발행을 요청했을 때는 자동화 서버에서 아래 명령을 실행한다. **검수 통과 시 실제로 양쪽 계정에 게시**하며, 기사 본문을 새로 집필하는 명령은 아니다.

```sh
npm run promotion -- story-now yerin-0310
```

정기 예약과 같은 문체 지침·원격 Codex 작성·플랫폼별 독립 검수·공식 API 게시기를 사용한다. 명령에 지정한 기사만 당일 횟수 제한의 예외가 되며 타이머 시간과 다른 예약은 유지한다. 실행 전 공개 카탈로그와 로컬 원고를 맞추고 기사 중복·계정·제한 상태를 확인한다. 검수에 실제 공개 페이지의 HTTPS 응답·revision·본문을 전달하되 사실은 원 출처와 별도로 대조한다. 전송 직전에도 공개 revision·이미지와 실제 계정 중복을 재확인한다.

`promotion/state/stories/on-demand/<기사 ID>.json`에 요청·초안·탈락·최종 문안·게시 결과를 보존한다. 요청당 초안 포함 최대 2개 버전이며 양쪽 검수가 통과하기 전에는 전송하지 않는다. 재실행은 같은 요청·컨테이너·게시 ID를 이어서 확인한다. 불확실한 응답을 새 게시로 재시도하거나 상태 파일을 지워 예산을 초기화하지 않는다. 기사가 바뀌거나 2시간이 지나면 보류·만료하며 운영자가 기록을 확인한다. 일반 `publish` 타이머는 이 요청을 처리하지 않는다. 명령 실행과 실제 결과는 [홍보 기록](../docs/promotion.md)에 남긴다.

### 로컬에서 공식 API로 요청

로컬은 SSH로 위의 공통 게시기를 호출한다. `~/.config/indiek-promotion/remote.json`에 SSH 별칭인 `host`와 서버 체크아웃의 절대 경로인 `directory`를 설정한다. 이 파일에는 접속 위치만 있고 토큰은 없다. 실제 값은 로컬 전용 `SERVER_ACCESS.md`에서 관리한다. 요청할 수 있는 명령을 제한하고 인자를 인용하므로 임의 셸 명령이나 자격 증명 전송에는 사용하지 않는다.

```sh
npm run promotion:remote -- check
npm run promotion:remote -- page-now artist baek-a --check
npm run promotion:remote -- page-now artist ARTIST_ID
npm run promotion:remote -- page-now guide GUIDE_ID
npm run promotion:remote -- story-now STORY_ID
```

`check`는 공식 API의 계정 일치·최근 게시물 조회와 공개 카탈로그 접근만 확인한다. `page-now ... --check`는 공개 페이지·글자 카드·중복 상태를 확인하며 문안 생성·큐 등록·전송을 하지 않는다. **`--check` 없는 `page-now`와 `story-now`는 검수 통과 시 실제 게시한다.** 서버에서는 같은 인자를 `npm run promotion -- ...`에 전달한다. 이 경로는 사용자가 즉시 공유를 요청한 경우에만 사용하며 기존 정기 슬롯은 유지한다.

아티스트·가이드 소개는 `promotion/state/pages/on-demand/<artist|guide>-<ID>.json`에 공개 HTML·자체 제작 카드의 해시, 초안 최대 2개 버전, 양쪽의 정확한 문안 검수와 작업 ID를 저장한다. 하나라도 검수에서 탈락하면 양쪽 전송을 보류한다. 승인된 두 작업을 먼저 기록해 재시작 때 같은 검수·작업을 이어가며, 전송 직전 다시 계정·페이지·카드·중복을 확인한다. 기존 브라우저 게시도 실제 계정과 공통 큐의 공개 주소로 감지한다. 제한·인증 오류나 불확실한 응답은 이력으로 남기고 브라우저 작성창으로 대체하지 않는다. 브라우저는 계정 연결·보안 확인과 결과 화면 확인에 사용한다.

비정기 발행 검증(2026-10-20): `7ae6eb9`를 두 서버에 반영하고 자동화 서버의 일회성 systemd 작업으로 백예린 기사 문안을 새로 작성·검수·게시했다. Threads 16:51, Instagram 16:52 KST 게시를 공식 API와 로그인 화면에서 확인했다. 같은 명령의 재실행으로 큐가 바뀌지 않았고 각 계정에 같은 기사 게시물이 1건씩만 있었다. 기존 작업·6개 타이머·다음 날 선우정아 예약은 유지했다. 로컬·두 서버 114개 테스트·26페이지 검사 통과. 프런트엔드 변경은 없으며 비로그인 노출·유입 성과는 이 검증에 포함하지 않는다.

문안은 가사 화자의 상황과 실제 아티스트의 경험을 구분하고 해설을 공식 의도로 단정하지 않는다. 검수에는 공개 페이지의 본문·출처 링크를 함께 전달하며 사실은 원 출처와 대조한다. 가사 전문·전체 번역·긴 인용은 SNS에 옮기지 않는다. 같은 날 한 플랫폼에 이미 게시했으면 정기 슬롯을 추가 발행하지 않는다. 명시적 즉시 요청만 기존 예외 규칙을 적용한다.

생성·검수는 [문체 지침](../promotion/voice.md)과 편집 스킬을 공통으로 읽는다. 자체 계정은 공식 API에서 계정 일치를 먼저 확인한 뒤 최근 공개 게시물의 본문·링크·게시일만 가져와 중복과 문체를 비교한다. 검수에는 링크를 붙인 최종 게시 문안 전체를 전달하며, 같은 날의 Threads·Instagram 동시 게시는 플랫폼별 한 번씩 허용한다. Codex는 임시 작업 디렉터리에서 공개 자료만 전달받으며 셸·앱·플러그인·다중 에이전트·브라우저 조작 기능을 끈다. 웹 검색은 실시간으로 사용하고 인증 파일을 프롬프트에 넣지 않는다. 작성·각 검수는 3분, 초안 최대 2개 버전으로 제한하고 사용량·시간 제한 시 유료 API로 대체하지 않는다. 준비 서비스의 전체 제한은 20분이다.

가사·곡 배경·가이드 소개는 해당 페이지의 공개된 자체 제작 타이포그래피 카드를 사용한다. 페이지의 아티스트 사진·앨범 커버를 SNS로 자동 전용하지 않는다. 예전 뉴스 작업을 복구할 때는 기존 `promotion/media.json`의 `topicKey`·출처·이용 권한·승인일·대체 텍스트 검증을 그대로 적용한다. 정기 준비는 새 뉴스 작업을 만들지 않는다.
Meta 개발자 앱에서 본인 계정 `indiekdotcom`만 연결한다. Threads는 기본 정보·게시 권한, Instagram은 프로페셔널 계정의 기본 정보·콘텐츠 게시 권한을 사용한다. 앱 심사나 계정 전환이 필요한지는 실제 대시보드에서 확인한다. 최초 승인은 브라우저에서 하고 장기 토큰을 서버의 `~/.config/indiek-promotion/credentials.json`에 0600으로 저장한다. 토큰을 Git·문안·채팅·명령 인자에 넣지 않는다.

인증 JSON의 플랫폼별 항목은 `threads` / `instagram`이며 `userId`, `token`, `issuedAt`, `expiresAt`(ISO 날짜)가 필요하다. Instagram API 기본 버전은 `v26.0`이다. 선택적인 Matomo 항목은 `matomo.token`으로, 사이트 4만 읽는 별도 토큰을 사용한다. 안전한 로컬 파일을 준비한 뒤 `npm run promotion -- credentials --stdin < /secure/path/credentials.json`으로 가져오면 기존 다른 플랫폼 설정은 유지한다. 연결하지 않은 통계는 미측정으로 보고하며 Search Console은 수동 확인이다.

실행 결과는 `promotion/state/queue.json`, 페이지 문안·검수는 `promotion/state/pages/`, 기사 문안은 `promotion/state/stories/`, 주간 보고는 `promotion/state/reports/`에 저장한다. 과거 뉴스 기록은 `promotion/state/news/`에 보존한다. 이 상태 디렉터리와 자격 증명은 배포 복사·Git 대상에서 제외하고 보존한다. **자동 게시 기록의 기준은 실행 서버**다. `docs/promotion.md`의 `automatic-promotion` 구간을 로컬로 병합하며 수동 기록이나 서버 로그를 통째로 덮어쓰지 않는다. SNS 게시기는 Git push를 실행하지 않는다. 아래 매거진 발행기만 승인 범위에서 기사와 생성 결과물을 push한다.

```sh
# 점검 및 즉시 중단
journalctl --user -u indiek-promotion-threads.service -n 50 --no-pager
systemctl --user disable --now indiek-promotion-prepare.timer indiek-promotion-threads.timer indiek-promotion-instagram.timer indiek-promotion-weekly.timer
```

사용자가 재개를 요청하면 먼저 계정·현재 큐의 제한과 미확인 전송을 대조한 뒤 위 4개 타이머를 `enable --now`한다. 지난 슬롯을 새 예약으로 바꾸거나 이미 게시된 소개를 다시 보내지 않는다.

공개 원문·계정과 필요한 경우 이미지까지 확인한 뒤 보낸다. 기존의 미전송 정적 소개 예약은 일일 소식 정책으로 전환할 때 `superseded`로 기록하며 삭제하지 않는다. 이미 생성·제출·게시된 작업은 바꾸지 않는다. `publishing`·`submitted`는 게시 ID나 정확히 일치하는 최근 문안으로 조회하며 새로 전송하지 않는다. `held`·`creating` 또는 `pausePlatform`이 있으면 실제 계정과 로그를 확인한다. 원인을 해결해도 불확실한 작업을 `ready`로 바꾸지 않는다. 인증·플랫폼 제한이 해소된 경우에만 상태 백업 후 해당 `pausePlatform`을 해제하고 타이머를 시작한다. 기존 큐를 삭제해서 재시도하지 않는다. 토큰은 만료 7일 전부터 갱신하며 갱신 실패·만료 시 재연결 전까지 전송하지 않는다.

`API access blocked`(HTTP 400, code 200)가 나오면 [Meta 개발자 앱](https://developers.facebook.com/apps/1121963200285516/dashboard/)의 계정 확인·필수 조치부터 확인한다. 2026-10-21에는 개발자 계정의 비정상 활동 감지에 따른 이메일 인증 요구가 원인이었으며, 사용자가 인증한 뒤 기존 자격 증명으로 양쪽 계정·최근 게시물 조회가 복구됐다. 이 오류를 토큰 만료로 단정하거나 새 앱·계정으로 우회하지 않는다. 복구 후 게시하지 않는 계정·최근 게시물 조회로 확인하고 실제 발행 여부는 게시 ID·고유 주소로 대조한다. 지난 2시간 슬롯은 재전송하지 않는다.

예약 게시기의 중복 확인은 해당 플랫폼의 계정에서 수행한다. 이 사전 확인을 포함한 전송 전 실패는 작업을 `held`로 기록하고 플랫폼·단계를 오류에 남긴다. 인증·제한 오류는 `pausePlatform`과 실패 종료 코드도 남기며, 불확실한 `publishing`·`submitted`는 그대로 보존한다. `status`의 준비 상태만 보지 말고 서비스 실행 결과와 작업 이력을 함께 확인한다.

최초 설치 확인(2026-10-19, 일일 소식 전환 전): 원격 테스트 68개 통과, 타이머 3개 활성화, Codex로 공개 원문 기반 문안 3개 준비. Threads와 Instagram 모두 기본 정보·게시 권한만 연결하고 서버에서 본인 계정 일치·기존 게시물 각 1건 조회를 확인했다. Instagram은 사용자 승인으로 공개 크리에이터 계정으로 전환했다. Threads 초기 갱신 기준은 발급 후 59일로 보수적으로 기록했으며, Instagram 만료 시각은 Meta 디버거로 확인한 `2026-12-18T11:07:37Z`다. 공유 이미지·공개 목록 배포 후 최종 dry-run에서 3건 모두 원문·이미지 확인을 통과했다. 공개 목록을 사용하는 `prepare`도 기존 예약을 보존하며 통과했다. 첫 전송은 10월 20일 10:00 KST Threads 예약이며, 실제 게시·외부 노출은 아직 미검증이다. 서버의 이전 미커밋 셋업은 `indiek automation setup before deployment 2026-10-19` stash에 보관했으며 기존 큐·토큰은 그대로 유지했다.

일일 소식 전환 확인(2026-10-19): 수집·Threads·Instagram·주간 보고 타이머 4개를 활성화하고 원격 홍보 테스트 31개를 통과했다. 두 API 계정 일치와 기존 공개 게시물 본문 조회를 확인했다. 첫 수집의 문안·이력 전달 문제를 수정한 뒤 같은 날 자료의 원문과 최종 문안을 다시 검수해 BOL4 공연 소식 1건을 10월 20일 10:00 KST에 준비했다. 승인 이미지가 없어 Instagram은 제외했다. 미전송 정적 예약 3건은 대체 상태로 보존했다. 실제 뉴스 전송은 아직 하지 않았다. 후속 배포 요청으로 `7112a75`를 두 서버에 반영했다. 직접 동기화했던 파일 22개와 로컬 소스의 일치를 확인하고 `daily news source before Git deployment 2026-10-19` stash로 보존한 뒤 fast-forward했다. 기존 런타임 파일 10개·자격 증명이 바뀌지 않았고 타이머 4개와 예약 1건을 유지하며 dry-run을 통과했다. 전환 전 코드·큐·로그 백업은 `promotion/state/backups/`에 있다.

## 매거진 자동 발행

`skills/indiek-editorial/`이 집필 기준의 원본이다. 로컬 스킬은 이 디렉터리를 연결하고 실행기는 매번 직접 읽으며 해시를 검수 기록에 남긴다. `content/stories/`는 승인 원고·출처·검수 결과, `content/authors.json`은 실제 작성자, `editorial/topics.json`은 향후 주제 후보다. 이미 발행한 주제는 기사 데이터로 제외한다. 새 기고자·이미지·아티스트 등록과 코드 변경은 자동 발행 범위 밖이다.

```sh
npm run editorial -- status
npm run editorial -- prepare   # 조사·집필·검수만, 공개하지 않음
npm run editorial -- run       # 승인된 예약일일 때 준비·커밋·push·배포
node deploy/install-editorial.mjs
systemctl --user list-timers 'indiek-editorial*' --no-pager
```

타이머는 매일 03:00 KST에 조건을 확인한다. 기본 화·금, 이전 실패가 있을 때 다음 날 재시도하며 하루 1편·최근 7일 최대 2편을 넘지 않는다. 하루 주제 3개 × 초고 포함 4개 버전, 전체 3시간을 상한으로 둔다. 각 시도를 모델 호출 전에 디스크에 저장해 재시작해도 예산이 초기화되지 않는다. 인증·네트워크·계정 한도는 품질 실패와 구분해 중단하고 유료 API로 전환하지 않는다. 놓친 시간에 여러 편을 몰아 내지 않는다.

사실 검수와 문체·독창성 검수는 별도 호출로 정확한 최종 원고를 확인한다. 원문에서 짧은 근거를 다시 찾아 확인하고 원고 해시가 달라지면 승인을 재사용하지 않는다. 자동 원고는 실제 취재자나 경험을 사칭하지 않으며 About과 기사에 AI 활용을 알린다. 모델 검수는 오류가 없다는 보증이 아니므로 수정 요청을 계속 받는다. 월 1일 07:00 KST에는 원작자·원문·독자 반응을 재확인해 `editorial/state/references-YYYY-MM.json`에 남긴다. 참고 목록·지침 개정은 그 결과를 읽고 별도로 수행한다.

발행은 `editorial/state/worktrees/`의 분리된 체크아웃에서 빌드·검증한 뒤 `content/stories/*.json`과 생성된 `dist/`만 커밋한다. origin/main이 바뀌면 force push하거나 자동 병합하지 않고 보류한다. SSH 별칭 `indiek-publish`는 강제 명령 `/usr/local/bin/indiek-editorial-receive`만 실행하는 전용 키다. 수신기는 origin/main·변경 경로·심볼릭 링크·깨끗한 운영 체크아웃을 확인하고 임시 worktree에서 검사한 뒤 fast-forward한다. 공개 결과물이 다르면 이전 커밋으로 복구한다. 이 키로 일반 셸·포트 포워딩을 허용하지 않는다. GitHub 쓰기 키는 이 저장소의 전용 deploy key로만 사용한다.

`editorial/state/YYYY-MM-DD.json`에 시도·탈락 이유·승인 원고·커밋·배포 단계를 보존한다. push 또는 배포 응답이 불확실하면 같은 커밋을 확인하며 새 기사를 만들지 않는다. 이전 날짜의 미확인 커밋은 운영자가 GitHub·운영 페이지의 revision을 대조해 정리한다. 상태 파일이나 로그를 삭제해 재시도하지 않는다.

새 공개 기사는 다음 일일 SNS 슬롯에 우선 준비한다. 문안 생성과 플랫폼별 최종 검수는 각각 3분, 초안 포함 하루 2개 버전으로 제한한다. 어느 플랫폼에서든 문안 문제가 나오면 공통 문안을 고쳐 양쪽을 다시 검수하며, 기존 탈락 이유와 문안을 보존한다. 최종 문안은 기사와 독립 비교하고, 전송 직전 공개 기사 revision·공유 이미지·계정·당일 기존 게시물을 다시 확인한다. 정기 게시는 플랫폼별 하루 최대 1건이며 기사 홍보에는 자체 제작 글자 이미지를 사용한다. 사용자 지정 비정기 SNS 공유는 위 `story-now` 절차를 따른다. 실제 전송·원격 확인은 기존 SNS 게시기가 담당한다. 예약·보류를 게시 성공으로 기록하지 않는다.

최초 설치 확인(2026-10-20): 발행·월간 자료 점검을 포함해 타이머 6개가 활성화됐다. 첫 기사는 수동 발행으로 기록해 당일 추가 발행을 막았다. SNS 수정본은 독립 검수와 공개 revision·이미지 확인을 통과해 10월 21일 10:00 KST Threads·10:15 KST Instagram에 준비됐다. 예약 단계이며 아직 전송하지 않았다. 실제 문안과 결과는 [홍보 기록](../docs/promotion.md)을 따른다.

```sh
# 발행만 중단 (SNS 중단은 위 별도 타이머 참조)
systemctl --user stop indiek-editorial.timer indiek-editorial.service
journalctl --user -u indiek-editorial.service -n 50 --no-pager
```

## 확인과 복구

- 최근 배포: 2026-10-22 `fbaad9b` — 백아(Baek A)의 Amor(첫사랑) 소개·사용자가 제공한 영어 번안 12연·지정 MONTBEST 라이브 영상을 추가하고 홈 첫 히어로·업데이트·Listening Room, Artists·관련 가이드·입문 가이드·검색·공개 홍보 카탈로그에 반영했다. 별도 번역 선택 해설은 추가하지 않았다. 연결 실패 후 같은 곡 선택이 재연결하지 않던 플레이어를 수정하고 실패 시 `Try again`을 제공한다. 정상 재생의 같은 곡 재선택·페이지 이동은 기존 iframe과 진행 시간을 유지한다. 로컬·운영 서버·자동화 서버에서 각각 182개 테스트와 29페이지 검사를 통과했으며 공개 변경 파일 44개의 SHA-256이 로컬 빌드와 일치한다. 공개 카탈로그는 전체 아티스트 17명을 포함하며 `/feed.xml`은 계속 404다. 운영 데스크톱 1440×1000과 모바일 390×844에서 지정 영상의 실제 재생을 확인했다. 모바일은 번안과 하단 영상 동시 표시·가로 넘침 없음, 로컬 Saved 추가·직접 재생·현재 곡 표시·삭제와 한글 검색을 확인했다. 첫 API 연결 실패를 의도적으로 만든 별도 로컬 점검에서 `Try again` 후 재생 복구·iframe 1개를 확인했다. 최초 빈 iframe은 오류 코드를 제공하지 않아 일시적 연결 실패의 근본 원인은 확정하지 않았으며 새 연결에서 재생됨을 확인했다. 전체 Saved 0·1·13·50곡 조합, 영상 전체 화면·키보드·곡 종료 전 과정을 수동 재검증하지는 않았다. 자동화 서버 소스도 갱신했고 런타임·홍보 기록·자격 증명 48개 파일과 타이머 6개 상태·일정을 그대로 보존했다. 이번 작업에서 SNS는 게시하지 않았다. 복구 기준은 `b5b6bc8`이다.
- Google 검색 등록: 2026-10-19 HTML 태그 소유권 확인 완료. 사이트맵 처리 상태 `성공`, 발견된 페이지 20개를 확인했고 홈페이지는 이후 `색인이 생성됨`으로 확인됐으며 Googlebot 스마트폰의 최근 크롤링은 2026-10-19 00:51:16이다. 실제 Google 검색에서도 홈페이지와 일부 상세 페이지가 노출된다. 현재 공개 사이트맵은 29개 URL이며 Search Console의 마지막 확인된 처리 결과는 20개다. 매거진 목록과 기사 두 주소의 색인은 아직 확인하지 않았다. 새 백예린 페이지는 당시 색인되지 않았지만 실시간 검사에서 `페이지 색인을 생성할 수 있음`으로 통과했다. 입문 가이드와 Artists 목록 페이지의 색인은 미확인이다. 실적·코어 웹 바이탈 보고서는 당시 데이터 처리 중이었다. 실제 색인 상태는 Search Console에서 별도로 확인한다.
- Matomo 최근 점검: 2026-10-19 새 버전 배포 후 운영 브라우저에서 허용 전 스크립트 미로드, 허용 후 페이지뷰·내부 이동·저장·Threads 유입 이벤트의 DB 반영, 쿼리 없는 URL 저장을 확인했다. 철회는 다른 열린 탭에도 반영됐고 두 탭의 후속 이동에서 DB 기록이 늘지 않았다. 점검으로 페이지뷰 3건·저장 1건·Threads 유입 1건이 포함되므로 자연 유입 성과로 계산하지 않는다. 실제 재생·공유 이벤트는 이번 운영 점검에서 발생시키지 않았다. 전체 방문 수가 아닌 통계를 허용한 방문만 집계하며 DNT·GPC 신호도 존중한다.
- 통계 비교 시 사이트 ID `4`, 날짜·시간대(`Asia/Seoul`), 방문 수와 페이지뷰의 구분을 먼저 확인한다. 실시간 보고서와 요약 보고서는 갱신 시점이 다르다. 현재 서버는 5분마다 아카이브를 실행하며 당일 보고서 캐시의 기본 유효기간은 15분이다. Reddit 게시글 조회수와 사이트 방문 수를 직접 비교하지 않는다.
- HTTPS 접속, HTTP·www 리다이렉트, 변경한 페이지·링크·검색·재생을 확인한다. 브라우저 모듈 오류가 나면 `.mjs` MIME 설정도 확인한다.
- 공통 플레이어는 [재생·페이지 이동 검증 항목](../AGENTS.md#콘텐츠-변경-시-함께-확인)을 데스크톱·모바일에서 확인한다. 동의 전에는 YouTube iframe·API 스크립트가 없고, 로드 후에는 하나만 있어야 한다. 가운데 감상창·최소화·Saved 목록 변경·다음 곡 재생도 같은 iframe을 유지해야 한다. 실제 곡 종료 후 다음 곡 시작, 마지막 곡 정지, Auto-next 해제와 자동 재생 차단 안내를 확인한다. 내부 이동 시 Matomo 페이지 조회가 동의한 방문에만 기록되는지도 확인한다.
- 실패하면 깨끗한 체크아웃에서 기록한 이전 커밋으로 복구한다. Nginx 설정도 바꿨다면 백업을 복원하고 검사 후 reload한다.
