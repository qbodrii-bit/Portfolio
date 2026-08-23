# content/ — Boram Park 포트폴리오 원본 자료

Google Drive 폴더
[`1bzA3sVvSzxspafCkMZcy8iBLtzmt4dgf`](https://drive.google.com/drive/folders/1bzA3sVvSzxspafCkMZcy8iBLtzmt4dgf)
의 자료를 사이트에서 바로 쓸 수 있는 형태로 정리한 디렉터리다.

## 출처

| Drive 파일 | 내용 | 여기서의 위치 |
|---|---|---|
| `Portfolio_Boram Park_2026.pdf` (23p, 12.4 MB) | 작품 12점 + CV | `source/Portfolio_Boram-Park_2026.pdf` |
| `Ein Hammer/1.jpg` (3456×1936) | 영상 스틸(치약 튜브) 고해상도 | `source/drive/ein-hammer_still-ajona.jpg` |
| `Ein Hammer/…Video, 7:26 loop, 2023` (5184×3456) | 영상 설치 전경 고해상도 | `source/drive/ein-hammer_installationsansicht.jpg` |

PDF 표지에는 "Portfolio 2025", 파일명에는 2026으로 적혀 있다. 본문 기준으로는 2023–2026년 작업이 실려 있다.

## 구조

```
content/
├── works/<slug>.json  작품 1점 = 파일 1개. 파일 이름이 곧 URL(werk-<slug>.html)
├── artist.json        약력, 학력, 전시 이력, 이메일, 소개 문단
├── site.json          홈 표지 이미지와 태그라인
├── images/
│   ├── cover/         PDF 표지 이미지
│   ├── <slug>/01.jpg  작품별 이미지 (총 41장, 긴 변 최대 2400px, JPEG q88, ~11 MB)
│   ├── _sizes.json    빌드가 만드는 크기 캐시 (prepare-images.py)
│   └── _manifest.json 추출 당시 출처 기록 (PDF 몇 페이지 / Drive 원본)
└── source/
    ├── Portfolio_Boram-Park_2026.pdf   원본 PDF
    ├── portfolio-text.txt              PDF 전체 텍스트 (pdftotext -layout)
    ├── pages/page-01..23.jpg           PDF 페이지 미리보기 (레이아웃 참고용)
    └── drive/                          Drive 고해상도 원본 2장
```

작품 슬러그 12개 (`order` 값 = PDF 순서):

`haeutung-reispapier` · `haeutung-leuchtkasten` · `haeutung-kleiderbuegel` ·
`beruehrung` · `huelle` · `haeutung-kosmetikmaske` · `ein-monat` ·
`lebensfluss` · `uebergabe` · `street-food` · `ein-hammer-installation` · `ein-hammer-video`

## 텍스트 처리 원칙

- **독일어 텍스트(`text_de`, 제목, 재료, 매체)는 PDF 원문 그대로**다. 스크립트로 PDF 원문과 대조해 전부 일치 확인함.
- **영어(`*_en`)는 번역본**이며 작가 확인을 받지 않았다. 사이트 EN 토글에 쓰기 전에 검수 필요.
- `lebensfluss`(Lebensfluss, Video 06:27 loop, 2024)는 PDF에 작품 설명 텍스트가 없다. 제목·매체·연도만 있음.
- PDF에 작가 스테이트먼트가 없어, biography 페이지의 소개 문단은 CV 사실만으로 구성했다(창작 없음). 작가 문장이 따로 있으면 교체할 것.

## 원문 확인이 필요한 부분

- 전시 이력 `2026 Momentaufhanme / Atelieraltesthonet, Saarbrücken` — PDF 표기 그대로 옮겼으나
  `Momentaufnahme`, `Atelier Altes Thonet` 오타로 보인다. 작가 확인 후 수정.
- 이메일은 PDF 마지막 장의 `g.bodrii@gmail.com`.
- 영상 작업 3점(Lebensfluss, Übergabe, Ein Hammer)은 **영상 파일이 없다**. 현재는 스틸 이미지만 있으므로,
  실제 영상(또는 Vimeo/YouTube 링크)이 필요하면 작가에게 요청해야 한다.

## 색 처리 (중요)

PDF 안의 이미지들은 **sRGB가 아니다.** 페이지마다 컬러스페이스가 다르다.

| 원본 컬러스페이스 | 장수 |
|---|---|
| ICCBased Display / Modified Display P3 | 22 |
| DeviceRGB | 6 |
| ICCBased Adobe RGB (1998) | 6 |
| DeviceCMYK | 6 |
| ICCBased ProPhoto RGB | 1 |

Drive 고해상도 사진 2장도 Display P3다.

프로파일을 무시하고 그대로 저장하면 브라우저가 숫자를 sRGB로 해석해 색이 틀어진다.
실제로 첫 추출본이 그랬다 — ProPhoto 원본은 밝기가 15단계 어두웠고(156 vs 172),
CMYK 원본들은 채도 폭이 3분의 1로 줄어 바래 보였다.

지금은 `extract-pdf-assets.py`가 MuPDF의 컬러 관리(`TOOLS.set_icc(True)`)로 sRGB로
변환하고 sRGB 프로파일을 심는다. 결과는 PDF 뷰어가 보여주는 색과 거의 일치한다
(p3 기준 172.3/168.0/168.7 vs 렌더 171.7/167.5/168.2).

CMS로 새로 올린 사진도 `prepare-images.py`가 같은 처리를 한다. 아이폰 사진(Display P3)을
그대로 올려도 sRGB로 변환된다. **이 두 스크립트를 고칠 때 색 변환 단계를 빼지 말 것.**

## 사이트 연결 상태

리포 루트의 페이지들이 이 디렉터리를 `content/…` 로 참조한다. 페이지는 `scripts/wire-content.py`가
통째로 생성하고, 스타일은 전부 `assets/site.css`에 있다.

- `index.html` — 표지 이미지
- `werk-<slug>.html` — 작품 상세 12장 (제목·메타·작품 텍스트·이미지 전체).
  작품 목록은 페이지가 아니라 좌측 메뉴의 서브메뉴다.
- `biography.html` — 학력 + 전시 이력
- `contact.html` — 이메일

페이지와 `content/`가 같은 루트에 있으므로 이미지 경로는 `content/images/…` 그대로다. 페이지를 하위 폴더로 옮기면 `scripts/wire-content.py`의 `REL` 값을 바꿔야 한다.

## 재생성 스크립트

```bash
python scripts/prepare-images.py      # 큰 이미지 축소 + _sizes.json 갱신 (pillow 필요)
python scripts/wire-content.py        # content/ → 모든 페이지 다시 씀 (표준 라이브러리만)
python scripts/extract-pdf-assets.py  # PDF → content/images/* 다시 추출 (pymupdf, pillow 필요)
```

앞의 두 개는 GitHub Actions가 푸시마다 자동으로 돌린다. `content/works/*.json`의 텍스트나
`order`를 고치고 `wire-content.py`만 다시 돌려도 사이트에 반영된다.
`extract-pdf-assets.py`는 `content/images/`를 덮어쓴다. Drive 고해상도 2장
(`ein-hammer-video/01.jpg`, `/10.jpg`)은 스크립트가 마지막에 알아서 다시 넣는다.

용량: `content/` 전체 36.5 MB (images 10.7 MB + source 25.8 MB). 원본까지 한곳에 두는 편이
낫다고 보고 `source/`도 리포에 포함했다. GitHub 기준 문제없는 크기다.
