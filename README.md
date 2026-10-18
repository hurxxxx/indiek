# indiek — Music from Korea, worth sharing

해외에 더 알려졌으면 하는 한국 뮤지션과 곡을 개인의 취향으로 소개하는 비영리 영문 팬사이트.

브랜드명은 **indiek**으로 유지한다. 소개 대상은 장르, 소속사, 인디 여부, 인지도로 제한하지 않는다. 윤미래와 볼빨간사춘기도 같은 선곡 기준으로 다룬다.

## 실행

```sh
npm run dev
```

브라우저에서 http://127.0.0.1:4173 을 연다. 의존성 설치나 빌드가 필요 없다.

## 파일

- `dist/index.html`: 홈페이지의 편집 구조와 영문 카피
- `dist/styles.css`: 색상 토큰, 타이포그래피, 반응형 레이아웃
- `dist/app.js`: 음반 데이터, 필터·검색·저장·소개·Bandcamp 및 YouTube 플레이어
- `dist/assets/`: 로컬 사진·앨범 커버·서체·서체 라이선스
- `.openai/hosting.json`: 비공개 Sites 배포 설정

`npm run check`로 JavaScript 구문, 로컬 에셋, 링크, 앵커, 이미지 대체 텍스트 및 배포 구성을 확인한다.

## 다음 에디션 만들기

1. `app.js`의 `records`에 검증된 아티스트/곡 정보와 출처를 추가한다. YouTube 음원은 `provider: "youtube"`, 공식 `videoId`, 업로드 채널, 원본 URL을 사용한다. 기존 Bandcamp 플레이어 분기는 추후 Bandcamp 음반을 소개할 때 사용할 수 있다.
2. `stories`의 소개글 및 출처와 `index.html`의 메인 피처를 교체한다.
3. 실제 이미지 파일과 크레딧을 함께 갱신한다.
4. 필터별 개수와 편집 번호, 메타데이터를 새 에디션에 맞춘다.

저장 목록은 브라우저 localStorage만 사용한다. 공식 플레이어는 사용자가 명시적으로 로드하며 자동재생하지 않는다. 검색은 청취 목록의 11개 선정곡과 윤미래의 〈숨 / Breath〉 Editor’s pick을 대상으로 하며 영문·한국어 아티스트명과 곡명을 지원한다. 밴드/솔로 아티스트 필터를 제공한다. 청취 목록의 각 음반 아래와 곡 상세 화면에서 짧은 영문 아티스트 소개를 읽을 수 있으며, `Meet the artist`로 출처를 포함한 아티스트 노트를 연다. 뉴스레터, 결제, 회원 기능은 포함하지 않는다.

Editor’s pick은 한 곡에 집중하는 편집 섹션이며 모든 소개 아티스트에게 열려 있다. 현재는 윤미래의 〈숨 / Breath〉을 소개한다. 영상은 1theK의 공식 YouTube 업로드(`knmrNkQMybA`)를 개인정보 보호 강화 모드로 불러온다. 원본 링크는 JavaScript나 임베드 재생이 불가능해도 사용할 수 있다. 영상·음원·가사는 별도로 복제하지 않는다. 기존 네 선정곡의 커버 이미지는 각 Topic 영상의 공식 썸네일에서 가져왔으며, 유다빈밴드 사진은 MPMG MUSIC의 아티스트 페이지가 출처다. 윤미래의 활동 이력과 한국대중음악상 수상 정보, 대표곡 세 곡의 공식 YouTube 링크를 함께 제공한다. 출처는 소개문과 아래 문서에 기록한다.

사진·음반 아트워크는 권리자 소유이며 비공개 디자인 검토용이다. 공개 운영 전 이미지 사용 허가를 확보해야 한다. 음원 파일은 복제하지 않는다. 샘플 글은 인터뷰가 아닌 입문용 리스닝 노트이며, 2017–2025년 선정곡을 신보로 표시하지 않는다.

## 발매 정보 링크

해외 독자를 위한 발매 정보 링크는 영문 Apple Music 앨범 페이지로 통일한다. 곡 상세와 아티스트 노트가 `records.source`를 함께 참조한다. YouTube 청취 링크와 플레이어는 그대로 사용한다. 제작 비화·작사/작곡 크레딧의 원래 근거는 아래 출처와 아티스트 노트의 `Story source`에 남긴다.

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
- 기존 네 선정곡 커버: `app.js`에 연결된 공식 Topic 영상의 YouTube 썸네일.
- 서체: Barlow Condensed, DM Sans, IBM Plex Mono. SIL Open Font License는 `dist/assets/`에 포함.

- WhiteUsedSocks 아티스트 소개: [POCLANOS 공식 프로필](https://poclanos.com/artist/whiteusedsocks/). 2017년부터 발표한 음악, 보컬과 감성적 가사에 대한 설명을 짧게 정리했다.
- Motte 아티스트 소개: [Genie 루키 프로젝트 소개](https://www.genie.co.kr/magazine/subMain?ctid=1&mgz_seq=6926), [본인 발매 인터뷰](https://www.genie.co.kr/magazine/subMain?ctid=1&mgz_seq=4525). 2017년 〈Tickin’〉 데뷔, 싱어송라이터 활동, A-TEEN 참여를 확인했다.
- HANRORO 아티스트 소개: [한국대중음악상 프로필](https://koreanmusicawards.com/project/%ED%95%9C%EB%A1%9C%EB%A1%9C/), [〈입춘〉 공식 발매 정보](https://www.genie.co.kr/detail/albumInfo?axnm=82578300), [authentic 아티스트 소개](https://label-authentic.com/19). 2022년 데뷔, 록을 바탕으로 청춘의 불안과 연대를 다루는 음악을 소개한다.

## 히어로 아티스트 캐러셀

- 유다빈밴드, WhiteUsedSocks, Motte, HANRORO의 대표 사진·제목·소개 링크를 함께 전환한다. 오른쪽 곡 목록은 항상 유지한다.
- 화면에 보이는 동안 9초 간격으로 페이드 전환한다. 이름 선택, 이전·다음, 좌우 방향키, 모바일 가로 스와이프를 지원한다.
- 마우스를 올리면 잠시 멈춘다. 키보드 포커스 진입과 직접 선택 이후에는 Play를 눌러야 재개한다. 화면 밖, 비활성 탭, 대화창이 열린 동안에는 타이머를 멈춘다.
- 동작 줄이기 설정에서는 자동 전환을 기본으로 끄고 페이드 효과를 없앤다. 숨겨진 슬라이드는 키보드와 보조기술 탐색에서 제외한다.
- 히어로 사진은 실제 아티스트 프로필·홍보 사진을 사용한다. 사진을 현재 멤버 구성이나 해당 선정곡의 발매 당시 이미지로 표시하지 않는다.
- 유다빈밴드: 기존 [MPMG MUSIC 사진](https://mpmgmusic.com/yudabinband), 2500×1667.
- WhiteUsedSocks: [Apple Music 아티스트 프로필](https://music.apple.com/us/artist/whiteusedsocks/1447936817). 등록 원본 4000×4000에서 제공되는 2400×2400 JPEG를 사용한다. [이미지 파일](https://is1-ssl.mzstatic.com/image/thumb/Features211/v4/c7/b3/82/c7b38204-69da-b715-e919-231cd7117343/mzl.gsaobrts.jpg/2400x2400bb.jpg). 기존 636×636 사진을 교체했다. 원본의 필름 질감은 유지한다.
- Motte: [스포츠경향의 ELEVATOR 발매 기사](https://sports.khan.co.kr/article/202002241810003)에 실린 루비레코드 제공 홍보 사진, 1500×1000. [리사이즈 경로를 제외한 이미지 파일](https://images.khan.co.kr/article/2020/02/24/2020022402001134200235751.jpg). 기존 840×560 사진을 교체했다.
- HANRORO: [Apple Music 아티스트 프로필](https://music.apple.com/us/artist/hanroro/1613668993). 등록 원본 6000×6000에서 제공되는 2400×2400 JPEG를 사용한다. [이미지 파일](https://is1-ssl.mzstatic.com/image/thumb/Features211/v4/b3/3c/b3/b33cb3ec-270b-5940-c753-62e6ec21a2b8/mzl.xvsucubr.jpg/2400x2400bb.jpg). 기존 사진의 거친 질감 대신 더 선명한 스튜디오 프로필을 선택했다.
- 사진을 인위적으로 확대하거나 AI 보정하지 않았다. 원본 파일을 로컬에 저장하고 각 사진에 맞게 CSS 크롭 위치를 조정한다. 이미지 갱신용 버전 쿼리로 이전 저해상도 파일의 브라우저 캐시를 피한다.

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
