# Boram Park — Portfolio

박보람 작가 포트폴리오 사이트. 빌드 도구 없는 정적 HTML이라 그대로 열면 바로 보인다.

```
index.html        홈 (표지 사진 + 이름)
work.html         작품 12점 그리드
werk-<slug>.html  작품 상세 12장
biography.html    학력 + 전시 이력
contact.html      이메일
content/          모든 내용의 원본 (아래 참조)
scripts/          content → HTML 재생성 스크립트
design.md         디자인 시스템 기준 (색·서체·여백 규칙)
```

## 내용은 전부 `content/` 에 있다

HTML을 직접 고치지 않는다. 내용은 `content/works.json`(작품 12점)과
`content/artist.json`(약력·전시·이메일)에 있고, 이미지는 `content/images/<작품>/`에 있다.
원본(포트폴리오 PDF, 고해상도 사진)은 `content/source/`에 보관돼 있다.
자세한 구조와 주의사항은 [`content/README.md`](content/README.md).

내용을 고친 뒤:

```bash
python scripts/wire-content.py    # works.json/artist.json → 16개 페이지 다시 생성
```

여러 번 돌려도 결과가 같다(idempotent). 파이썬 3와 표준 라이브러리만 있으면 된다.

## 로컬에서 보기

```bash
python -m http.server 8000
# http://127.0.0.1:8000
```

`index.html`을 브라우저로 그냥 열어도 되지만, 로컬 서버로 봐야 이미지 경로가 실제 배포와 같다.

## 아직 정리되지 않은 것

- **영어 번역 미검수** — 독일어는 PDF 원문 그대로지만, 영어(`*_en`)는 기계 번역 수준이다. 작가 확인 필요.
- **전시 이력 오타 의심** — `2026 Momentaufhanme / Atelieraltesthonet`. `Momentaufnahme`, `Atelier Altes Thonet`으로 보인다.
- **영상 3점**(Lebensfluss, Übergabe, Ein Hammer)은 스틸 이미지만 있다. 영상 파일이나 Vimeo 링크가 없다.
- **작가 스테이트먼트 없음** — biography 소개 문단은 CV 사실만으로 쓴 것이라, 작가 본인 문장이 있으면 교체해야 한다.
