# Boram Park — Portfolio

박보람 작가 포트폴리오 사이트. 빌드 도구 없는 정적 HTML이라 그대로 열면 바로 보인다.
작가용 사용 설명서는 [`사용설명서.md`](사용설명서.md).

사이트에 나가는 글은 독일어·영어(독일 관객용), 편집 도구는 한국어(작가가 한국 사람)다.

```
index.html            홈 (표지 사진 한 장)
werk-<slug>.html      작품 상세 (작품 수만큼 자동 생성)
biography.html        학력 + 전시 이력
contact.html          이메일
admin.html            작가용 관리 화면 (메뉴에 없음, noindex, 주소로만 접근)
assets/site.css       사이트 전체 스타일 (한 파일)
assets/site.js        DE/EN 전환
content/              모든 내용의 원본 (아래 참조)
scripts/              content → HTML 생성 스크립트
.pages.yml            Pages CMS 편집 화면 정의 (한국어 라벨, 값은 독일어/영어)
.github/workflows/    푸시되면 이미지 정리 + 페이지 재생성
design.md             디자인 시스템 기준 (색·서체·여백 규칙)
```

## 편집 흐름

**작가** — [pagescms.org](https://pagescms.org)에 GitHub 계정으로 로그인해서 폼으로 편집.
저장하면 커밋 → GitHub Actions가 페이지를 다시 만들어 커밋 → 배포. 1~2분 걸린다.

**개발자** — `content/` 파일을 직접 고치고 스크립트를 돌린다.

```bash
python scripts/prepare-images.py   # 색 프로파일 sRGB 변환 + 2400px 축소 + _sizes.json (pillow 필요)
python scripts/wire-content.py     # content/ → 모든 페이지 재생성 (표준 라이브러리만)
```

두 스크립트 모두 여러 번 돌려도 결과가 같다. HTML은 **직접 고치지 않는다** — 매번 통째로 다시 쓰기 때문에 손으로 고친 내용은 사라진다.
디자인을 바꾸려면 `assets/site.css`를, 페이지 구조를 바꾸려면 `scripts/wire-content.py`의 템플릿을 고친다.

## 내용 구조

```
content/works/<slug>.json   작품 1점 = 파일 1개. 파일 이름이 곧 URL(werk-<slug>.html)
content/artist.json         약력, 학력, 전시, 이메일, 소개 문단
content/site.json           홈 표지 이미지와 태그라인
content/images/<slug>/      작품 이미지 (_sizes.json은 빌드가 만드는 크기 캐시)
content/source/             원본 PDF·고해상도 사진 (사이트에 쓰이지 않는 아카이브)
```

작품 목록은 별도 페이지가 아니라 **좌측 메뉴의 서브메뉴**다. "Work"를 누르면 펼쳐지고,
항목을 누르면 작품 상세로 간다. 정렬은 **연도 내림차순**, 같은 해 안에서만 `order` 값을 본다.
제목이 겹치는 작품(Häutung 4점 등)은 목록에서 재료·매체로 자동 구분된다.

작품을 추가하려면 `content/works/`에 JSON 파일 하나를 더 넣고 스크립트를 돌리면 된다.
파일을 지우면 해당 상세 페이지도 함께 지워진다. 자세한 내용은 [`content/README.md`](content/README.md).

## 로컬에서 보기

```bash
python -m http.server 8000
# http://127.0.0.1:8000
```

## 아직 정리되지 않은 것

- **영어 번역 미검수** — 독일어는 PDF 원문 그대로지만, 영어(`*_en`)는 기계 번역 수준이다. 작가 확인 필요.
- **전시 이력 오타 의심** — `2026 Momentaufhanme / Atelieraltesthonet`. `Momentaufnahme`, `Atelier Altes Thonet`으로 보인다.
- **영상 3점**(Lebensfluss, Übergabe, Ein Hammer)은 스틸 이미지만 있다. 영상 파일이나 Vimeo 링크가 없다.
- **작가 스테이트먼트 없음** — `artist.json`의 `statement_de`는 CV 사실만으로 쓴 것이라, 작가 본인 문장이 있으면 교체해야 한다.
- **배포 미연결** — Vercel(또는 Netlify)에 이 리포를 연결해야 실제 주소가 생긴다. 빌드 설정 없이 루트를 그대로 서빙하면 된다.
