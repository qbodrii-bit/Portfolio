---
schema_version: 3.2
slug: boram-portfolio
service_name: Boram — Kunst Portfolio
site_url: N/A (synthesized — no single source URL)
fetched_at: 2026-08-01
default_theme: light
brand_color: "#0F0F0F"
primary_font: "Outfit"
font_weight_normal: 400
token_prefix: bp

bold_direction: "Vertical Manifest"
aesthetic_category: "Editorial Magazine"
signature_element: typo_contrast
code_complexity: medium

medium: web
medium_confidence: high

archetype: portfolio-personal
archetype_confidence: high
design_system_level: lv2
design_system_level_evidence: "5개 실제 아티스트 포트폴리오(ericlanz.net, romansigner.ch, hausig.eu, lenareckord.de, tamakiyoshida.com)의 공통 관습을 종합해 새로 합성한 시스템 — 단일 사이트 복제 아님."

colors:
  bg: "#FFFFFF"
  fg: "#0F0F0F"
  fg-muted: "#6B6B6B"
  hairline: "#E5E5E5"

typography:
  display: "Outfit"
  body: "Outfit"
  weights_used: [400, 900]
  weights_absent: [500, 600, 700]

components:
  nav-link: { weight: 900, size: "26px" }
  work-thumb: { border: "none", shadow: "none" }
  exhibition-row: { border-bottom: "1px solid #E5E5E5" }
---

# DESIGN.md — Boram Kunst Portfolio (합성 브리프)

---

## 00. Direction & Metaphor

### Narrative

이 사이트는 좌측 내비게이션을 "작은 유틸리티 링크 목록"이 아니라 **마스트헤드(masthead) 그 자체**로 다룬다. Work / Biography / Contact 세 단어가 페이지 왼쪽에 굵고 크게(weight 900) 세로로 쌓여, 브랜드 로고와 내비게이션의 역할을 동시에 수행한다 — 이것이 5개 레퍼런스(ericlanz.net, romansigner.ch, hausig.eu, lenareckord.de, tamakiyoshida.com) 중 어느 하나도 정확히 하지 않는 조합이다. Roman Signer와 Hausig는 왼쪽 세로 내비게이션을 쓰지만 작은 유틸리티 텍스트로 취급하고, Tamaki Yoshida는 이름을 볼드하게 다루지만 상단 중앙에 배치한다. 이 사이트는 두 관습을 하나로 합친다: **위치는 왼쪽, 취급은 마스트헤드.**

색은 존재하지 않는다. 배경은 순수 백색(`#FFFFFF`), 텍스트는 소프트 블랙(`#0F0F0F`) — 두 번째 브랜드 컬러는 의도적으로 없다. 작품 이미지가 유일한 색채 공급원이 되도록, 사이트 자체는 철저히 무채색을 유지한다. 대비는 색이 아니라 **굵기**에서 나온다: 900(마스트헤드/섹션 타이틀)과 400(본문/메타데이터) 단 두 웨이트만 쓰고, 그 사이의 500·600·700은 의도적으로 비운다.

여백은 넉넉하되 리듬이 있다: 섹션 사이 수직 여백은 96px로 크게 벌리지만, Work 그리드의 썸네일 사이 간격은 16px로 좁혀 — "숨 쉬는 섹션, 촘촘한 그리드"라는 Airbnb식 비대칭 리듬을 따른다. Work 썸네일에는 그림자도 테두리도 라운드도 없다 — 이미지가 페이지에 놓인 게 아니라 페이지의 일부처럼 보이도록.

Biography 페이지는 Roman Signer의 전시 리스트 관습을 그대로 계승한다: 날짜(DD.MM.YYYY) — 제목 — 장소가 헤어라인으로 구분된 행으로 역순 나열된다. 장식 없이 정보 자체가 리듬을 만든다.

### Key Characteristics

- 좌측 고정 마스트헤드형 내비게이션 (Work / Biography / Contact, weight 900, 26px)
- 무채색 전용 팔레트 — 브랜드 컬러 없음, 대비는 굵기(900 vs 400)로만 표현
- 순수 백색 배경 — 작품 이미지가 유일한 색채
- Work 그리드: 그림자·테두리·라운드 없는 flat 썸네일, 촘촘한 16px 갭
- Biography: 날짜-제목-장소 헤어라인 리스트, 역순 정렬
- 섹션 간 96px 수직 여백 vs 그리드 내부 16px — 의도적 비대칭 리듬
- 언어 토글(DE/EN)은 마스트헤드와 분리해 우측 상단에 독립 배치
- 장식 요소 전무 — 아이콘, 그라디언트, 그림자, 이모지 없음

---

### 🤖 Direction Summary (Machine Interface — DO NOT EDIT)

> **BOLD Direction**: Vertical Manifest
> **Aesthetic Category**: Editorial Magazine
> **Signature Element**: 이 사이트는 **좌측 마스트헤드 내비게이션과 900/400 두 웨이트만의 극단적 타이포 대비**로 기억된다.
> **Code Complexity**: medium — 그리드 + 리스트 두 레이아웃 패턴, 바닐라 HTML/CSS, 스크롤 reveal 모션 1종

---

## 01. Quick Start

> 5분 안에 이 사이트처럼 만들기 — 3가지만 하면 80%

```css
/* 1. 폰트 + weight — 900과 400만 사용, 그 사이 웨이트는 절대 쓰지 않는다 */
body {
  font-family: "Outfit", -apple-system, sans-serif;
  font-weight: 400;
}

/* 2. 배경 + 텍스트 — 순백 + 소프트 블랙, 브랜드 컬러 없음 */
:root { --bg: #FFFFFF; --fg: #0F0F0F; --fg-muted: #6B6B6B; }
body { background: var(--bg); color: var(--fg); }

/* 3. 좌측 nav를 마스트헤드로 */
.nav-link { font-weight: 900; font-size: 26px; letter-spacing: -0.01em; }
```

**절대 하지 말아야 할 것 하나**: 좌측 nav를 작은 유틸리티 텍스트(14px 이하, weight 400)로 만들지 말 것 — 이 사이트의 정체성이 곧 "굵은 좌측 마스트헤드"이므로, 여기서 타협하면 다른 미니멀 아트 포트폴리오와 구별되지 않는다.

---

## 06. Colors

### 06-5. Semantic

| Token | Hex | Usage |
|---|---|---|
| `--bp-bg` | `#FFFFFF` | 페이지 배경, 유일한 대형 표면 |
| `--bp-fg` | `#0F0F0F` | 본문/타이틀 텍스트 (순흑 아님 — 소프트 블랙) |
| `--bp-fg-muted` | `#6B6B6B` | 메타데이터 (연도, 장소, 캡션) |
| `--bp-hairline` | `#E5E5E5` | Biography 리스트 구분선, 얇은 border 전용 |

### Color Stories

**`--bp-bg` (`#FFFFFF`)** — 순수 백색을 그대로 쓴다. 아트 포트폴리오는 작품 사진의 색이 유일한 색채 공급원이어야 하므로, 배경에 톤을 섞지 않는다. 이건 예외적으로 "순백 금지" AI-슬롭 규칙을 의도적으로 뒤집는 지점 — 사용자가 명시적으로 요청한 흰 배경이다.

**`--bp-fg` (`#0F0F0F`)** — 순수 `#000000`은 화면에서 과도하게 날카로워 보이므로 아주 살짝 누그러뜨린 소프트 블랙을 쓴다. 900 weight 마스트헤드와 400 weight 본문 모두 이 색 하나로 통일 — 색으로 위계를 만들지 않는다.

**두 번째 브랜드 컬러는 없다.** 링크·호버·액티브 상태 모두 굵기 변화(400→900) 또는 밑줄로만 표현한다.

---

## 07. Spacing

| Token | Value | Use case |
|---|---|---|
| `--bp-space-xs` | 8px | 캡션과 이미지 사이 |
| `--bp-space-sm` | 16px | Work 그리드 갭, nav 링크 사이 간격 |
| `--bp-space-md` | 32px | 컴포넌트 내부 padding |
| `--bp-space-lg` | 64px | 컨텐츠 블록 사이 |
| `--bp-space-xl` | 96px | 섹션 사이 수직 여백 |

### Whitespace Philosophy

Work 그리드는 촘촘하다 — 썸네일 사이 16px 갭으로 "카탈로그"처럼 밀도 있게 나열된다. 반면 각 섹션(Work 헤더, Biography 블록, Contact 블록) 사이에는 96px의 숨 쉬는 여백을 둔다. 즉 "섹션은 열려있고, 그리드는 조밀하다" — Airbnb의 에디토리얼 밴드 vs 마켓플레이스 카드 대비를 그대로 차용한 의도적 비대칭.

---

## 11. Layout Patterns

### Grid System
- **Content max-width**: 1400px
- **Grid type**: 좌측 고정 컬럼(240px) + 우측 fluid 메인
- **Column count (Work grid)**: 데스크톱 2열, 태블릿 이하 1열
- **Gutter**: 16px

### Navigation Structure
- **Type**: 좌측 세로 고정(sticky) 마스트헤드 — 상단 로고 없이 nav 자체가 로고 역할
- **Position**: `position: sticky; top: 0; height: 100vh;` 왼쪽 240px 컬럼
- **Background**: 투명 (페이지와 동일한 `--bp-bg`)
- **Border**: 없음 — 컬럼 간 여백만으로 분리
- **언어 토글**: nav와 분리, 페이지 우측 상단에 `DE / EN` (현재 언어는 weight 900, 나머지는 400)

### Work Grid (홈)
- 2열 그리드, 썸네일 하단에 연도 + 제목 캡션 (weight 400, `--bp-fg-muted`)
- 썸네일: 그림자 없음, border 없음, radius 없음 — 이미지 자체가 카드

### Biography Exhibition List
- 표 대신 grid row: `날짜(120px) | 제목(1fr) | 장소(240px)`
- 각 행 하단 `1px solid var(--bp-hairline)`
- 날짜 포맷 `DD.MM.YYYY`, 역순(최신이 위)

### Content Width
- **Prose max-width**: 640px (Biography 스테이트먼트 텍스트)
- **Sidebar width**: 240px (좌측 마스트헤드 nav)

---

## 13. Components

### Navigation
```html
<nav class="masthead">
  <a class="nav-link" data-active="true" href="/work">Work</a>
  <a class="nav-link" href="/biography">Biography</a>
  <a class="nav-link" href="/contact">Contact</a>
</nav>
```
- `.nav-link`: `font-weight: 900; font-size: 26px; letter-spacing: -0.01em; line-height: 1.3; color: var(--bp-fg);`
- active 상태: 밑줄 4px, `text-underline-offset: 6px` — 색 변화 없음
- hover: `opacity: 0.55` 전환만 (`transition: opacity 0.15s ease`)

### Cards & Containers (Work Thumbnail)
- **Card background**: 없음 (투명)
- **Card border**: 없음
- **Card radius**: 0
- **Card padding**: 0 (이미지가 곧 카드)
- **Card shadow**: 없음
- hover 시: 캡션 텍스트만 `opacity 0.6 → 1` 전환

### Exhibition Row
```html
<div class="exhibition-row">
  <span class="ex-date">14.03.2025</span>
  <span class="ex-title">Zwischen den Linien</span>
  <span class="ex-location">Galerie Nord, Berlin</span>
</div>
```
- `border-bottom: 1px solid var(--bp-hairline); padding: 16px 0;`
- `.ex-date`, `.ex-location`은 `--bp-fg-muted`, `.ex-title`은 `--bp-fg`

### Hero Section (Work 인덱스 상단)
- 히어로 없음 — 페이지 진입 즉시 "Work" 타이틀(weight 900, 48px) + 그리드
- 배경: `var(--bp-bg)` 단색, 어떤 그라디언트/이미지 오버레이도 없음

---

## 15. Drop-in CSS

```css
:root {
  --bp-font-family: "Outfit", -apple-system, sans-serif;
  --bp-font-weight-normal: 400;
  --bp-font-weight-bold: 900;

  --bp-bg: #FFFFFF;
  --bp-fg: #0F0F0F;
  --bp-fg-muted: #6B6B6B;
  --bp-hairline: #E5E5E5;

  --bp-space-xs: 8px;
  --bp-space-sm: 16px;
  --bp-space-md: 32px;
  --bp-space-lg: 64px;
  --bp-space-xl: 96px;

  --bp-radius: 0px;
}
```

---

## 18. DO / DON'T

### ✅ DO
1. 배경은 순수 백색 `#FFFFFF` 그대로 사용한다 — 예술 작품이 유일한 색채가 되도록 (사용자 명시 요구사항, AI-슬롭 "순백 금지" 규칙의 의도적 예외).
2. 좌측 nav는 weight 900, 최소 24px로 — 실제 마스트헤드처럼 크고 굵게.
3. 본문/메타 텍스트는 weight 400 하나로 통일 — 900과 400 사이 웨이트를 쓰지 않는다.
4. Work 썸네일은 장식 없이 flat하게 — 그림자·테두리·라운드 전부 0.

### ❌ DON'T
- 텍스트를 순흑 `#000000`으로 두지 말 것 — 대신 소프트 블랙 `#0F0F0F` 사용.
- 좌측 nav를 14px 이하 작은 유틸리티 텍스트로 만들지 말 것 — 이 사이트의 정체성이 사라진다.
- 브랜드 강조색(파랑/보라 등 chromatic accent)을 추가하지 말 것 — 두 번째 브랜드 컬러는 존재하지 않는다.
- `linear-gradient(135deg, #667eea, #764ba2)` 류 보라 그라디언트 배경 금지.
- Work 썸네일에 `border-radius: 8px` 이상의 둥근 모서리나 카드 그림자를 넣지 말 것 — flat 원칙 위반.
- body에 `font-weight: 500` 또는 `600` 사용 금지 — 이 시스템은 400/900 두 웨이트만 존재한다.

### 🚫 What This Site Doesn't Use (Negative-Space Identity)
- 두 번째 브랜드 컬러: 없음 — 무채색 전용.
- 그림자: 전혀 없음 — 어떤 요소에도 box-shadow를 쓰지 않는다.
- 아이콘/이모지: 전혀 없음 — 텍스트와 이미지만으로 구성.
- Border-radius: 0 — 모든 모서리는 직각.
- Weight 500/600/700: 의도적으로 비움 — 900과 400 두 계단만 존재.
- 히어로 배너/풀블리드 이미지: 없음 — Work 인덱스는 타이틀+그리드로 즉시 시작.

---

## 19. Known Gaps & Assumptions

- **단일 소스 URL 없음** — 이 design.md는 5개 실제 사이트(ericlanz.net, romansigner.ch, hausig.eu, lenareckord.de, tamakiyoshida.com)에 대한 서술적 관찰(자동 CSS 추출이 아닌 WebFetch 요약 기반)을 종합해 새로 합성한 것이다. 특정 사이트의 hex/폰트를 그대로 추출한 것이 아니라, 공통 관습에서 새 방향을 도출했다.
- **정확한 hex 미측정** — 5개 레퍼런스의 실제 CSS를 파싱하지 않았으므로 `#FFFFFF`/`#0F0F0F` 등은 관찰된 방향성(흰 배경, 소프트 블랙 텍스트)에 기반한 합리적 선택이지, 실측값이 아니다.
- **폰트 라이선스** — "Outfit"은 Google Fonts 무료 오픈소스(SIL OFL)로 즉시 사용 가능하지만, 실제 레퍼런스 사이트들이 쓰는 정확한 서체는 확인하지 않았다.
- **반응형 상세 미정의** — 모바일에서 좌측 고정 nav가 상단 바/햄버거로 전환되는 구체적 브레이크포인트 값은 목업 단계에서 근사치로만 처리했다.
- **모션/애니메이션 세부 미검증** — 스크롤 reveal 등 모션은 Step 1.7 사용자 선택에 따라 결정되며, 이 문서 자체는 정적 스펙만 담는다.
- **다크모드 없음** — light 단일 테마만 정의.
- **콘텐츠 시드 없음** — 실제 작품/전시 데이터가 아직 없어 placeholder 콘텐츠로 목업한다.
