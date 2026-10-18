# indiek — Music from Korea, worth sharing

해외에 더 알려졌으면 하는 한국 뮤지션과 곡을 개인의 취향으로 소개하는 비영리 영문 팬사이트.

브랜드명은 **indiek**으로 유지한다. 소개 대상은 장르, 소속사, 인디 여부, 인지도로 제한하지 않는다. 윤미래와 볼빨간사춘기도 같은 선곡 기준으로 다룬다.

## 실행과 수정

```sh
npm run dev
```

http://127.0.0.1:4173 에서 확인한다. `dev`는 정적 페이지를 생성한 뒤 Python HTTP 서버를 실행한다. 기존 서버가 실행 중이면 `npm run build` 후 브라우저를 새로고침한다. 런타임 프레임워크나 별도 백엔드는 없다.

- `content/catalogue.json`: 아티스트 12명, 청취 목록 11곡, 윤미래 Editor’s pick, 가이드 분류, 소개·출처·사이트 설정의 원본.
- `content/media.json`: 반응형 이미지 파일과 크기. `content/image-rights.json`: 이미지별 출처와 권리 확인 상태.
- `site/`: 브라우저 동작, 공통 검색·저장 함수, 스타일과 홈페이지 템플릿.
- `scripts/build.mjs`: 홈페이지·아티스트 12페이지·가이드 안내와 테마 3페이지·About·Privacy의 정적 HTML과 공유 메타데이터 생성.
- `dist/`: 실제 서비스 파일. 생성된 HTML·JS·CSS를 직접 수정하지 않고 원본 수정 후 빌드한다.
- `dist/assets/`: 원본 사진·앨범 커버, `optimized/`의 WebP 변형, 공유 이미지, 서체와 라이선스.

```sh
npm run build
npm run check
```

검사는 검색 표기 회귀 사례, 기존 저장 목록 호환성, 모든 정적 페이지의 링크·앵커·에셋·메타데이터·사이트맵과 생성 결과 일치를 확인한다. 외부 영상의 전 세계 재생 가능 여부나 이미지 사용 권한을 보장하는 검사는 아니다.

사진을 변경할 때만 `npm run images`를 실행한다. 이 명령에는 WebP를 지원하는 Python Pillow가 필요하다. 원본은 변경하지 않으며 히어로 사진은 480/960/1600px, 커버는 320/640/1000px 범위에서 원본보다 확대하지 않고 변환한다. 생성된 이미지와 매니페스트를 저장하므로 평소 빌드에는 Pillow가 필요 없다.

## 공개 주소와 운영 안내

- 공개 주소 설정: `https://indiek.com`
- 문의·정정·이미지 삭제 요청: `gw@lumejs.com`
- 아티스트별 주소: `/artists/<id>/`. 곡 위치는 `#listen`으로 바로 연결한다.
- 소개·연락처·이미지 출처: `/about/`
- 개인정보·이용 안내: `/privacy-and-terms/`
- 전체 가이드 안내: `/notes/first-listens/` (기존 주소 유지)
- 테마별 가이드: `/notes/on-stage/`, `/notes/guitars-and-bands/`, `/notes/distinct-voices/`

기존 `indiek-saved-v1` 저장 키와 곡 ID를 유지한다. 저장 목록은 브라우저 localStorage만 사용하고 검색도 브라우저 안에서 처리한다. JavaScript 없이도 정적 소개·곡 정보·출처·공식 청취 링크를 사용할 수 있다. 검색·저장·필터·캐러셀 조작·삽입 재생은 JavaScript가 있을 때 활성화한다.

YouTube 플레이어는 안내를 읽고 `Agree & load YouTube`를 선택한 후에만 생성한다. `youtube-nocookie.com`을 사용하고 자동재생하지 않으며, `Disconnect YouTube`로 제거할 수 있다. 카더가든의 KBS 영상은 기존 확인 결과에 따라 YouTube 원본으로 연결한다. 음원 파일·영상·가사는 자체 호스팅하지 않는다. Bandcamp 플레이어 분기는 제거했다.

## Listening guides 관리

- 홈의 `Follow the sound.`와 가이드 페이지는 `getListeningGuides()`의 동일한 결과로 생성한다. 곡 수와 목록은 별도로 입력하지 않는다. 윤미래의 `editorPick`도 분류 대상이다.
- `listeningGuides`에는 `id`, `title`, `description`(홈 소개와 메타 설명), `intro`(가이드 도입문), `selection`, `featuredArtistId`를 지정한다. `selection`은 `live` 또는 `tag`다.
- `On stage`는 `videoType: "live"`인 곡을 자동 포함한다. 태그 방식인 다른 가이드는 곡의 `guideTags`에 가이드 ID를 넣는다. 예: `["guitars-and-bands", "distinct-voices"]`. 한 곡이 여러 가이드에 포함되어도 각 가이드 안에서는 한 번만 표시한다.
- `featuredArtistId`의 곡을 첫 번째로 배치하고 홈 대표 커버로 사용한다. 나머지는 원본 카탈로그 순서를 유지한다. 대표곡도 해당 가이드의 분류 조건을 충족해야 한다.
- 아티스트가 어느 가이드에도 속하지 않거나 잘못된 태그·중복 ID를 사용하면 빌드를 중단한다. 새 곡을 등록할 때 실제 라이브 영상인지 확인하고, 필요한 테마 태그를 함께 지정한다.
- 오른쪽 Listening Room은 `records` 전체와 윤미래 `editorPick`을 카탈로그 순서대로 표시한다. 별도 선곡 목록 없이 총 곡 수·링크가 함께 갱신된다. 긴 목록은 높이를 제한한 영역에서 스크롤하며, 모바일·키보드·JavaScript를 끈 상태에서도 모든 곡에 접근할 수 있다. 재생 시간이 없는 곡은 시간을 표시하지 않는다.
- 가이드에서는 짧은 곡 정보와 아티스트 페이지의 `#listen` 링크를 제공한다. 플레이어를 추가로 로드하지 않으며 JavaScript 없이도 탐색할 수 있다.

## 운영 구성과 이미지 확인 상태

2026-10-18 사용자의 서버 배포 요청에 따라 `/projects/indiek`의 Git 체크아웃과 Nginx 정적 호스팅을 사용한다. 운영 주소는 `https://indiek.com`이며 `www`는 기본 주소로 이동한다. 설정과 갱신 절차는 [deploy/README.md](deploy/README.md)에 기록한다. 일반 개발과 확인은 로컬에서 진행하고, 원격 변경은 명시적인 배포 요청 범위에서 수행한다.

**이미지 이용 조건은 아직 확인되지 않았다.** 사용자의 선택에 따라 현재 사진과 커버를 유지했다. `content/image-rights.json`의 16개 이미지가 모두 `unconfirmed` 상태다. 원본과 WebP 변형 모두 같은 권리 검토 대상이며, 출처 표시·파일 다운로드 가능 여부·비영리 운영을 사용 허가로 간주하지 않는다. 이미지별 허가 또는 적용 가능한 이용 근거는 계속 확인하고 기록해야 한다. 공개 요청과 배포가 이미지 재사용 권한 확인을 대신하지 않는다.

서체는 SIL Open Font License에 따라 사용하며 관련 라이선스를 보관한다. 공유용 `indiek-share.png`는 아티스트 사진을 사용하지 않은 자체 타이포그래피 이미지다. 소개는 독립적인 팬의 리스닝 노트이고, 2016–2025년 곡을 신보로 표시하지 않는다.

## 다음 곡 추가

1. `content/catalogue.json`에 검증된 아티스트·곡·공식 YouTube 링크·Apple Music 발매 링크·출처를 기록한다. 기존 ID는 저장 목록과 URL의 식별자이므로 바꾸지 않는다.
2. 이미지 원본과 출처·이용 근거를 함께 기록하고 `npm run images`로 표시용 변형을 생성한다.
3. `npm run build`와 `npm run check`를 실행하고 로컬에서 페이지·검색·공식 플레이어를 확인한다.

## 발매 정보 링크

해외 독자를 위한 발매 정보 링크는 영문 Apple Music 앨범 페이지로 통일한다. 곡 상세와 아티스트 노트가 공통 콘텐츠의 `source`를 함께 참조한다. YouTube 청취 링크와 플레이어는 그대로 사용한다. 제작 비화·작사/작곡 크레딧의 원래 근거는 아래 출처와 아티스트 노트의 `Story source`에 남긴다.

- [YdBB — ONCE](https://music.apple.com/us/album/once-single/1713690764)
- [WhiteUsedSocks — Don’t feel sad](https://music.apple.com/us/album/dont-feel-sad-single/1732022836)
- [Motte — A-Teen (Original Soundtrack), Pt. 4](https://music.apple.com/us/album/a-teen-original-soundtrack-pt-4-single/1436476166)
- [HANRORO — Even if you leave,](https://music.apple.com/us/album/even-if-you-leave-single/1683092568)
- [Yoon Mirae — Breath](https://music.apple.com/us/album/breath-single/1862425862)

2026-10-18 기준 다섯 페이지의 응답과 아티스트·앨범 정보를 확인했다. 영문 `/us/` 페이지를 기본 링크로 사용하며 지역별 카탈로그가 항상 같다고 가정하지 않는다.

## 콘텐츠 출처와 에셋

- 윤미래 활동 이력: [Melon 아티스트 소개](https://www.melon.com/artist/detail.htm?artistId=1654), [Shazam 아티스트 소개](https://www.shazam.com/ko-kr/artist/yoon-mirae/326451219).
- 윤미래 수상: 한국대중음악상 공식 기록 — [2008 최우수 알앤비&소울 음반](https://koreanmusicawards.com/project/%EC%9C%A4%EB%AF%B8%EB%9E%98-yoonmirae/), [2008 최우수 알앤비&소울 노래](https://koreanmusicawards.com/project/%EC%9C%A4%EB%AF%B8%EB%9E%98-whats-up-mr-good-stuff/).
- 윤미래 〈숨〉: [Bugs 발매 정보 및 크레딧](https://music.bugs.co.kr/album/4136526). 2025-12-23 발매, 작사 Tiger JK, 작곡 Tiger JK·윤미래. 보도 요약보다 발매 크레딧을 우선한다.
- 윤미래 〈숨〉 커버: 사용자가 제공한 1000×1000 PNG를 `dist/assets/yoon-mirae-breath.png`에 원본 그대로 보관한다. 위 Bugs 발매 페이지의 앨범 커버와 대조했다. 영상 로드 전 대기 화면에 정사각형 전체 구도로 표시한다.
- 윤미래 대표곡 및 청취 링크: [As Time Goes By (2001) — yoonmirae - Topic](https://www.youtube.com/watch?v=zGgIzbahCZ0), [Black Happiness (2007) — 1theK 공식 MV](https://www.youtube.com/watch?v=1DK-MPh7vKk), [Always (2016, 태양의 후예 OST) — MUSIC&NEW 공식 MV](https://www.youtube.com/watch?v=aE0eV2YR51k). 표기 연도는 곡의 발매 연도이며 YouTube 업로드 연도가 아니다.
- 유다빈밴드 사진: [MPMG MUSIC 공식 아티스트 페이지](https://mpmgmusic.com/yudabinband). 사진가 표기는 확인되지 않았다.
- YdBB 〈ONCE〉 소개 및 유다빈의 커버 작업: [Genie 발매 인터뷰](https://www.genie.co.kr/magazine/subMain?ctid=1&mgz_seq=13700).
- WhiteUsedSocks 〈Don’t feel sad〉: [밴드 공식 발매 페이지](https://whiteusedsocks.com/don%27t-feel-sad).
- Motte 〈Don’t run away〉: [A-TEEN Part.4 공식 발매 정보](https://music.apple.com/us/album/a-teen-original-soundtrack-pt-4-single/1436476166).
- HANRORO 〈Even if you leave〉: [POCLANOS 공식 발매 정보](https://poclanos.com/album/52690/). 커버 사진 김태윤.
- 기존 네 선정곡 커버: 공통 콘텐츠에 연결된 공식 Topic 영상의 YouTube 썸네일.
- 서체: Barlow Condensed, DM Sans, IBM Plex Mono. SIL Open Font License는 `dist/assets/`에 포함.

- WhiteUsedSocks 아티스트 소개: [POCLANOS 공식 프로필](https://poclanos.com/artist/whiteusedsocks/). 2017년부터 발표한 음악, 보컬과 감성적 가사에 대한 설명을 짧게 정리했다.
- Motte 아티스트 소개: [Genie 루키 프로젝트 소개](https://www.genie.co.kr/magazine/subMain?ctid=1&mgz_seq=6926), [본인 발매 인터뷰](https://www.genie.co.kr/magazine/subMain?ctid=1&mgz_seq=4525). 2017년 〈Tickin’〉 데뷔, 싱어송라이터 활동, A-TEEN 참여를 확인했다.
- HANRORO 아티스트 소개: [한국대중음악상 프로필](https://koreanmusicawards.com/project/%ED%95%9C%EB%A1%9C%EB%A1%9C/), [〈입춘〉 공식 발매 정보](https://www.genie.co.kr/detail/albumInfo?axnm=82578300), [authentic 아티스트 소개](https://label-authentic.com/19). 2022년 데뷔, 록을 바탕으로 청춘의 불안과 연대를 다루는 음악을 소개한다.

## 히어로 아티스트 캐러셀

- 카탈로그의 전체 12팀(윤미래 포함)의 이미지·제목·소개 링크를 함께 전환한다. 오른쪽 곡 목록은 항상 유지한다.
- `featuredArtists`는 소개 문구와 순서, 대표 사진을 지정하는 선택 항목이다. 이 목록에 없는 새 아티스트도 `records` 또는 `editorPick`에 등록하면 커버 이미지와 기본 소개로 자동 포함된다.
- 모든 이름을 데스크톱 3열, 모바일 2열로 표시해 순환을 기다리지 않고 선택할 수 있다. 첫 슬라이드 외의 히어로 이미지는 활성화될 때 불러온다.
- 화면에 보이는 동안 9초 간격으로 페이드 전환한다. 이름 선택, 이전·다음, 좌우 방향키, 모바일 가로 스와이프를 지원한다.
- 마우스를 올리면 잠시 멈춘다. 키보드 포커스 진입과 직접 선택 이후에는 Play를 눌러야 재개한다. 화면 밖, 비활성 탭, 대화창이 열린 동안에는 타이머를 멈춘다.
- 동작 줄이기 설정에서는 자동 전환을 기본으로 끄고 페이드 효과를 없앤다. 숨겨진 슬라이드는 키보드와 보조기술 탐색에서 제외한다.
- 유다빈밴드, WhiteUsedSocks, Motte, HANRORO는 기존 실제 프로필·홍보 사진을 사용한다. 그 외 아티스트는 기존 고화질 발매 커버와 이름을 나란히 배치하고 `RELEASE ARTWORK`로 표시한다. 커버는 자르지 않으며, 사진을 현재 멤버 구성이나 해당 선정곡의 발매 당시 이미지로 표시하지 않는다.
- 유다빈밴드: 기존 [MPMG MUSIC 사진](https://mpmgmusic.com/yudabinband), 2500×1667.
- WhiteUsedSocks: [Apple Music 아티스트 프로필](https://music.apple.com/us/artist/whiteusedsocks/1447936817). 등록 원본 4000×4000에서 제공되는 2400×2400 JPEG를 사용한다. [이미지 파일](https://is1-ssl.mzstatic.com/image/thumb/Features211/v4/c7/b3/82/c7b38204-69da-b715-e919-231cd7117343/mzl.gsaobrts.jpg/2400x2400bb.jpg). 기존 636×636 사진을 교체했다. 원본의 필름 질감은 유지한다.
- Motte: [스포츠경향의 ELEVATOR 발매 기사](https://sports.khan.co.kr/article/202002241810003)에 실린 루비레코드 제공 홍보 사진, 1500×1000. [리사이즈 경로를 제외한 이미지 파일](https://images.khan.co.kr/article/2020/02/24/2020022402001134200235751.jpg). 기존 840×560 사진을 교체했다.
- HANRORO: [Apple Music 아티스트 프로필](https://music.apple.com/us/artist/hanroro/1613668993). 등록 원본 6000×6000에서 제공되는 2400×2400 JPEG를 사용한다. [이미지 파일](https://is1-ssl.mzstatic.com/image/thumb/Features211/v4/b3/3c/b3/b33cb3ec-270b-5940-c753-62e6ec21a2b8/mzl.xvsucubr.jpg/2400x2400bb.jpg). 기존 사진의 거친 질감 대신 더 선명한 스튜디오 프로필을 선택했다.
- 사진을 인위적으로 확대하거나 AI 보정하지 않았다. 원본 파일을 로컬에 저장하고 각 사진에 맞게 CSS 크롭 위치를 조정한다. 현재 공개 준비본에서는 별도 WebP 변형 경로와 반응형 이미지 크기를 사용한다.

## 추가 선정곡 — 공식 라이브 중심

2026-10-18에 아래 7곡을 청취 목록 앞쪽에 추가했다. 기존 4곡과 윤미래 Editor’s pick은 유지한다. 캐러셀과 옆의 네 곡은 입문용 선택으로 유지하며 전체 청취 목록·검색·저장은 11곡을 처리한다.

공식 라이브 6개와 검정치마의 정식 MV 1개를 사용한다. 검정치마 〈EVERYTHING〉의 공식 라이브는 확인하지 못했다. 영상 길이는 스튜디오 음원 길이가 아닌 연결한 YouTube 영상의 길이다. 각 영상의 제목·채널은 oEmbed, 길이와 임베드 상태는 공개 YouTube 메타데이터로 확인했다.

| 아티스트 / 곡 | 선택한 영상 | 길이 | 발매 정보 |
|---|---|---|---|
| The Black Skirts — EVERYTHING | [Official music video · SEOUL MUSIC](https://www.youtube.com/watch?v=Aq_gsctWHtQ) | 05:04 | [TEAM BABY](https://music.apple.com/us/album/team-baby/1242154383) |
| sunwoojunga — Run with Me | [SERENADE concert · Sogang University Mary Hall · 2019](https://www.youtube.com/watch?v=fNrhdZwhj-c) | 04:54 | [Serenade](https://music.apple.com/us/album/serenade/1491118222) |
| Car, the garden — Tree | [The Seasons — Choi Jung-hoon’s Night Park · KBS, 2023](https://www.youtube.com/watch?v=6e_H3ngjD7A) | 03:43 | [Tree - Single](https://music.apple.com/us/album/tree-single/1459990039) |
| Choi Yu Ree — Forest | [Bugs-ker live session](https://www.youtube.com/watch?v=AOGhUcAdTKk) | 03:52 | [Stroll - Single](https://music.apple.com/us/album/stroll-single/1641252974) |
| BOL4 — Eternal love | [2024 BOL4 Concert “Bloom”](https://www.youtube.com/watch?v=Gw00jZ0RA-E) | 03:50 | [Merry Go Round - EP](https://music.apple.com/us/album/merry-go-round-ep/1720724415) |
| ESEGYE — RomanceYouthLove | [BLIND concert · Veloso Hongdae](https://www.youtube.com/watch?v=rly_h23jX3M) | 04:50 | [Cry For Me / RomanceYouthLove - Single](https://music.apple.com/us/album/cry-for-me-romanceyouthlove-single/1518190054) |
| SE SO NEON — The Wave | [2020/NEON · YES24 Live Hall, 2019](https://www.youtube.com/watch?v=SPGuXMzKpvQ) | 04:50 | [Summer Plumage - EP](https://music.apple.com/us/album/summer-plumage-ep/1450484183) |

〈EVERYTHING〉은 2016년 선행 싱글이며 연결 앨범 TEAM BABY는 2017년 발매다. 〈The Wave〉는 2017년 9월 싱글·10월 EP 수록, 선택한 라이브는 2019년 12월 7일 공연이며 공연명은 2020/NEON이다. 한국어 제목 〈사랑할 수밖에〉의 영문 카탈로그명은 Eternal love, 이세계의 공식 표기는 ESEGYE, 〈낭만젊음사랑〉은 RomanceYouthLove다.

### 소개와 커버 출처

- The Black Skirts: [The Orchard Japan](https://prtimes.jp/main/html/rd/p/000000433.000055377.html). 커버 `dist/assets/black-skirts.jpg`: [Apple Music 앨범 아트워크](https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/be/ce/5c/bece5cff-2caf-6d8a-9c21-3035537d2a4d/Album_cover_1400X1400.jpg/1200x1200bb.jpg).
- sunwoojunga: [Korean Music Awards](https://koreanmusicawards.com/project/%EC%84%A0%EC%9A%B0%EC%A0%95%EC%95%84/). 커버 `dist/assets/sunwoojunga.jpg`: [Apple Music 앨범 아트워크](https://is1-ssl.mzstatic.com/image/thumb/Music114/v4/1d/49/8f/1d498f55-ea5c-2a0f-6c5a-77364494d5e2/swja_serenade_3000.jpg/1200x1200bb.jpg).
- Car, the garden: [CJ Cultural Foundation — Car, the garden](https://www.cjazit.org/support/tune-up/selection/1561). 커버 `dist/assets/car-the-garden.jpg`: [Apple Music 앨범 아트워크](https://is1-ssl.mzstatic.com/image/thumb/Music113/v4/b8/72/09/b87209dc-363e-ae11-90c2-14199b2e47b5/cover-_Car_the_garden_DS.jpg/1000x1000bb.jpg).
- Choi Yu Ree: [CJ Cultural Foundation — Choi Yu Ree](https://www.cjazit.org/support/tune-up/entry/50/24481). 커버 `dist/assets/choi-yu-ree.jpg`: [Apple Music 앨범 아트워크](https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/93/a7/4b/93a74b7c-69be-a9b1-1499-2d2eb0f9c3ed/191953194141.jpg/1000x1000bb.jpg).
- BOL4: [BOL4 — official profile](https://bol4.jp/profiles). 커버 `dist/assets/bol4.jpg`: [Apple Music 앨범 아트워크](https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/d5/89/5d/d5895d26-d6ef-4908-83fb-26b71e8a90d8/191953322636.jpg/1000x1000bb.jpg).
- ESEGYE: [POCLANOS — introducing ESEGYE](https://poclanos.com/featured/newbies-1/). 커버 `dist/assets/esegye.jpg`: [Apple Music 앨범 아트워크](https://is1-ssl.mzstatic.com/image/thumb/Music123/v4/e3/55/f4/e355f4cc-ae48-92a0-59a1-a486973991a4/cover.jpg/1000x1000bb.jpg).
- SE SO NEON: [Korean Music Awards — SE SO NEON](https://koreanmusicawards.com/project/%EC%83%88%EC%86%8C%EB%85%84/). 커버 `dist/assets/se-so-neon.jpg`: [Apple Music 앨범 아트워크](https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/f1/a9/41/f1a941bb-130d-9f75-be43-5f73389feb6a/8809380636494.jpg/1000x1000bb.jpg).

추가 커버는 Apple Music 카탈로그의 실제 앨범 아트워크(1000–1200px)를 로컬에 저장했다. 최유리의 곡 해설·크레딧은 [Bugs 발매 소개](https://music.bugs.co.kr/album/4079006), 새소년 〈파도〉 수상은 [한국대중음악상 기록](https://koreanmusicawards.com/project/%EC%83%88%EC%86%8C%EB%85%84-%ED%8C%8C%EB%8F%84/)를 확인했다. 라이브는 클릭했을 때만 로드되며 자동재생하지 않는다.

실제 브라우저에서 추가 영상 6개의 삽입 플레이어 로드를 확인했다. 카더가든의 1theK·KBS 영상은 로컬 삽입에서 사용 불가로 표시되어, YouTube 원본에서 재생을 확인한 KBS 영상으로 직접 이동하도록 구성했다(`externalOnly`). 이 곡의 표시 길이 03:43은 원본 플레이어 기준이다. 삽입 제한의 원인을 메타데이터만으로 추정하지 않는다.
