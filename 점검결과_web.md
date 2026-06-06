# 점검결과 — dapick-web (develop)

> 점검일 2026-06-05 · **수정 없이 정찰만 수행** · 추측 배제, 불확실 항목은 [확인필요]로 표기
> 분류: [심각]>[높음]>[중간]>[낮음]>[정보] / 원인추적: [확정]·[의심]·[배제]

---

## [공통-0] 상태 스냅샷
| 항목 | 결과 |
|---|---|
| 브랜치 | `develop` ✓ |
| working tree | clean |
| origin 대비 | up to date (ahead 0 / behind 0) — commit≠push 함정 없음 |
| 최신 커밋 | `14f5562` 상품 리뷰 + SEO 정리 |

---

## [WEB-1] 인증 / 토큰  ★ 작업지시서 전제와 충돌 — 확인 요망

| 심각도 | 위치 | 분류 | 설명 |
|---|---|---|---|
| **[확인필요]** | `js/common/auth.js:14` | **[배제]** | **web의 표준 토큰키는 `dapick_token`** (`TOKEN_KEY='dapick_token'`). login/signup/api/gnb-user/mypage/reviews 전부 `dapick_token` 사용. → 지시서의 "dapick_token→accessToken 이어야"는 **web 코드 기준과 반대**. web에서 `accessToken`으로 바꾸면 오히려 깨짐 |
| [정보] | `js/rental/rental.js` | **[배제]** | rental.js에 토큰 참조 **0건**(grep). 상담신청 제출은 `common/application.js`가 담당 |
| [정보] | `js/common/application.js:25-30` | **[배제]** | 제출 `getToken()`이 `dapick_token` → `accessToken` 순 폴백. 키 불일치로 인한 401 유발 코드 **미발견** |

> **질문:** "상담신청 401" 증상이 실제로 있었는지? web 토큰키는 `dapick_token`이 정상입니다. 지시서 전제가 admin 기준과 섞인 것으로 보입니다 — 확인 부탁드립니다.

---

## [WEB-2] 디자인 / 구조 함정 (표시만)

| 심각도 | 위치 | 분류 | 설명 |
|---|---|---|---|
| **[중간]** | `css/internet/internet-banner.css` ← `css/internet/internet.css:1010-1022` | **[확정 흔적]** | 페이지 전용 CSS인데 전역 `:root` + `* {margin:0;padding:0;box-sizing}` + `body {background:#f4f3fa;font-family}` **시안 잔재 통째 존재**("/* 메인 배너 css */" 주석 직후). internet.html 로드 시 페이지 전역 리셋·body 배경을 덮어씀 → **CLAUDE.md(admin) 금지사항 '시안 :root/body/* 전역 이식'에 해당.** 전역 셀렉터를 `.i-carousel` 등으로 스코프화 필요 |
| [낮음] | `common.css:5,34` / `internet-product.css:10` / `internet.css:1010` / `mypage.css:7` | **[의심]** | 페이지별 `:root` 변수 중복 선언 다수 → 변수값 충돌 가능 (로드 순서에 따라 마지막이 이김) |
| [정보] | `css/icon.css:151` | **[배제]** | `.svc-info { min-width:0 }` **존재함** — 누락 아님 |
| [낮음] | `rental-detail.html:265` | [정보] | 인라인 `<script>` 존재하나 내용은 **리뷰/탭 전환 로직**(캐러셀 타이머 아님) |
| **[확인필요]** | `store-*.html:~282-327`, `water-detail.html:258`, `application-success.html:125` | [의심] | 인라인 `<script>` 존재 — 내용 미정독(캐러셀 타이머 중복 의심 대상). web엔 CLAUDE.md가 없어 인라인 금지 규칙 적용 여부 불명 |
| **[확인필요]** | hero.css / internet-banner.css 등 | **[추측금지]** | "정사각 원본을 CSS로 늘림 / 둥근 배너 border-radius / `img height` 속성 vs `max-height` 충돌"은 **이미지 실측·렌더 없이는 정적 확인 불가.** border-radius 선언은 다수 존재하나 의도 여부 판단 불가 → 실제 화면 캡처로 확인 필요 |

---

## [공통-3] TODO / 죽은 코드 / 미정의

| 심각도 | 위치 | 설명 |
|---|---|---|
| **[중간]** | `privacy.html:82,425,454` / `terms.html:75,306,516` | "TODO: 시행일 확정" / "보호책임자 정보 확정" — **운영 법적고지 미완성** (개인정보처리방침·이용약관 시행일/책임자 공란) |
| **[낮음]** | `js/rental/rental-submit-fix.js` | **완전히 빈 파일(0 bytes)** + 어떤 HTML에서도 로드 안 됨 → 죽은 파일, 삭제 권장 |
| [낮음] | `js/mobile/mobile.js:365` | `// TODO Phase 1-3: store.html 박힌 후 아래 주석 해제` — 미완성 주석 코드 |
| [정보] | — | 명백한 미정의 전역참조/404 경로는 정적 점검 범위에서 미발견. 정밀 확인은 런타임 콘솔 필요 |

---

## 권장 착수 우선순위
1. **[확인필요/WEB-1]** "상담신청 401" 증상 실재 여부 — web 토큰키는 `dapick_token`이 정상. 지시서 전제 재확인 후 진행
2. **[중간/WEB-2]** `internet.css:1010-1022` 전역 시안 잔재 스코프화
3. **[중간/공통-3]** privacy/terms 법적고지 placeholder 확정
4. **[낮음]** 빈 파일 `rental-submit-fix.js` 정리, store-*/water-detail 인라인 스크립트 정독
