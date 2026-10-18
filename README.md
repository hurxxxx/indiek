# indiek — Independent sounds from Korea

한국 인디 음악을 해외 청취자에게 소개하는 영문 에디토리얼 웹사이트 템플릿.

## 실행

```sh
npm run dev
```

브라우저에서 http://127.0.0.1:4173 을 연다. 의존성 설치나 빌드가 필요 없다.

## 파일

- `dist/index.html`: 홈페이지의 편집 구조와 영문 카피
- `dist/styles.css`: 색상 토큰, 타이포그래피, 반응형 레이아웃
- `dist/app.js`: 음반 데이터, 필터·검색·저장·소개·Bandcamp 및 YouTube 플레이어
- `dist/design-notes.html`: 2026-10-18 기준 디자인 조사, 판단 근거, 출처, 에셋 크레딧
- `dist/assets/`: 로컬 사진·앨범 커버·서체·서체 라이선스
- `.openai/hosting.json`: 비공개 Sites 배포 설정

`npm run check`로 JavaScript 구문, 로컬 에셋, 링크, 앵커, 이미지 대체 텍스트 및 배포 구성을 확인한다.

## 다음 에디션 만들기

1. `app.js`의 `records`에 검증된 아티스트/곡 정보와 출처를 추가한다. YouTube 음원은 `provider: "youtube"`, 공식 `videoId`, 업로드 채널, 원본 URL을 사용한다. 기존 Bandcamp 플레이어 분기는 추후 Bandcamp 음반을 소개할 때 사용할 수 있다.
2. `stories`의 소개글 및 출처와 `index.html`의 메인 피처를 교체한다.
3. 실제 이미지 파일과 크레딧을 함께 갱신한다.
4. 필터별 개수와 편집 번호, 메타데이터를 새 에디션에 맞춘다.

저장 목록은 브라우저 localStorage만 사용한다. 공식 플레이어는 사용자가 명시적으로 로드하며 자동재생하지 않는다. 검색은 유다빈밴드(YdBB), WhiteUsedSocks, 모트(Motte), 한로로(HANRORO)의 4개 선정곡과 윤미래의 〈숨 / Breath〉 Editor’s pick을 대상으로 한다. 밴드/솔로 아티스트 필터를 제공한다. 뉴스레터, 결제, 회원 기능은 포함하지 않는다.

Editor’s pick은 인디 음반 목록과 구분되는 R&B 소개다. 영상은 1theK의 공식 YouTube 업로드(`knmrNkQMybA`)를 개인정보 보호 강화 모드로 불러온다. 원본 링크는 JavaScript나 임베드 재생이 불가능해도 사용할 수 있다. 영상·음원·가사는 별도로 복제하지 않는다. 네 선정곡의 커버 이미지는 각 Topic 영상의 공식 썸네일에서 가져왔으며, 유다빈밴드 사진은 MPMG MUSIC의 아티스트 페이지가 출처다. 소개 문안 출처는 `design-notes.html`에 기록한다.

사진·음반 아트워크는 권리자 소유이며 비공개 디자인 검토용이다. 공개 운영 전 이미지 사용 허가를 확보해야 한다. 음원 파일은 복제하지 않는다. 샘플 글은 인터뷰가 아닌 입문용 리스닝 노트이며, 2017–2025년 선정곡을 신보로 표시하지 않는다.

디자인 연구의 원문 링크와 전체 판단 근거는 `dist/design-notes.html`에 포함되어 있다.
