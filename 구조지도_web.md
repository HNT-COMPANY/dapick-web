# 구조지도 — dapick-web (WEB / 고객용)

> 고객 대상 웹 프론트엔드(정적 HTML/JS). 기준 브랜치: develop.
> 구조 파악용 지도. 코드 수정 없음. 불확실 항목은 [확인필요].

---

## [3-1] HTML 페이지 목록

| 파일 | 용도 |
|------|------|
| index.html | 홈/메인 랜딩, 카테고리 진입점 |
| login.html | 로그인 (카카오 소셜, 이메일, 약관동의, 카카오 PENDING_PROFILE용 SMS 인증) |
| signup.html | 회원가입 (3단계: 이메일→인증코드→정보입력, 다음주소API, 약관동의) |
| mobile.html | 휴대폰 지원금 비교 (SKT/KT/LGU+, 카드할인) |
| internet.html | 인터넷·TV 지원금 비교 |
| internet-skt / -kt / -lg.html | 통신사별 인터넷·TV 상세(지원금 계산·상담) |
| internet-kt-skylife / -lg-hello / -sk-broadband.html | 세부 브랜드 인터넷·TV 상세 |
| card.html | 신용카드 비교 (7개 카드사) |
| card-hyundai/shinhan/samsung/kb/lotte/woori/hana.html | 카드사별 상세 |
| water.html | 정수기 렌탈 비교 (코웨이/SK매직/청호/쿠쿠) |
| water-detail.html | 정수기 상세(약정/관리주기/색상 선택, 상담) |
| rental.html | 가전렌탈 비교 |
| rental-detail.html | 가전렌탈 상세(약정/관리주기 선택, 상담) |
| mypage.html | 마이페이지(로그인 필수: 내정보/신청내역/즐겨찾기/비교함) |
| application-success.html | 상담 신청 완료(접수번호·카톡 안내) |
| store-*.html (6개) | 지점 정보 페이지 |
| terms.html / privacy.html / email-policy.html / marketing.html | 약관·개인정보·이메일·마케팅 정책 |

---

## [3-2] JS 파일 목록

### 공통 (js/common/)
| 파일 | 책임 |
|------|------|
| config.js | 환경별 API_BASE_URL 자동 분기 |
| auth.js | 토큰 저장/삭제, 로그인 상태 확인, 토큰 갱신, 상태(PENDING_PROFILE/ACTIVE) 관리 |
| api.js | API 요청 통합, Authorization 자동부착, 401 Silent Refresh, 응답 파싱 |
| utils.js | 페이지 이동, 스크롤, FAQ 토글, 카카오 상담 열기, 평점 HTML |
| application.js | 상담 신청 모달(신청자 정보 입력, 다음 우편번호 API) |
| gnb-user.js | GNB 사용자 드롭다운, PENDING 가드(미완료 가입 강제 이동), 로그아웃 |
| reviews.js | 상품 리뷰 로드/렌더, 별점 폼 (rental-detail/water-detail 공유) |
| structured-data-*.js | JSON-LD SEO 구조화 데이터 |

### 페이지별
| 파일 | 책임 |
|------|------|
| login/login.js | 카카오 OAuth 콜백, 약관동의 모달, 추가정보 입력(SMS 인증), 이메일 로그인, PENDING 락 |
| signup/signup.js | 3단계 가입 플로우, 이메일 인증코드 발송/확인, 정보입력, 자동로그인 |
| mobile/mobile.js, mobile-board.js | 휴대폰 상품 로드/렌더·탭, 비교함/즐겨찾기 보드 |
| internet/internet.js | 인터넷 배너 캐러셀·네비 |
| internet/internet-product-base.js | 인터넷 상세 공통 베이스 |
| internet/internet-skt/-kt/-lg/-kt-skylife/-lg-hello/-sk-broadband.js | 통신사별 상품 로드/계산/렌더·상담 |
| products/coway.js, sk.js, chungho.js, cuckoo.js | 정수기 브랜드별 상세 로직 |
| water/water.js, water-detail.js, water-board.js | 정수기 목록·상세(요금계산·상담·리뷰)·보드 |
| rental/rental.js, rental-detail.js, rental-submit-fix.js | 렌탈 목록·상세(pricing 최저가·상담·리뷰)·제출 |
| mypage/mypage.js | 프로필 로드, 신청내역, 탭, 닉네임 수정, 로그아웃 |
| policy/policy.js | 약관/개인정보 공통 |

---

## [3-3] 토큰키·인증 구조 요지

- **토큰키 (localStorage)**: `dapick_token`(access), `dapick_refresh`(refresh), `dapick_role`, `dapick_nick`, `dapick_status`
- **인증 헤더**: `Authorization: Bearer {dapick_token}`
- **401 처리(Silent Refresh)**: 401 → `/api/auth/refresh` → 새 access 저장 → 원요청 재시도(retry 플래그로 무한루프 방지) → 실패 시 로그아웃·로그인 이동
- **Base URL**: localhost/사설IP → `http://localhost:8081`, *.pages.dev·운영도메인 → `https://api.dapick.co.kr`
- **계정 상태 가드**: PENDING_PROFILE(카카오 가입 후 추가정보 미입력) 유저는 gnb-user.js `enforcePendingGuard()`가 매 페이지 login.html로 강제, 추가정보+SMS 인증 완료 시 ACTIVE 전환

---

## [3-4] 계정 복구(아이디찾기/비밀번호찾기) 진입점 현황

**없음.**
- login.html: 카카오 로그인 + 이메일 로그인 폼 + 회원가입 링크만. 아이디찾기/비밀번호찾기 링크·버튼 없음.
- login.js: socialLogin / handleOAuthCallback / submitEmailLogin / SMS 인증 함수만. 복구 함수 없음.
- 전체 JS에서 findId/findPassword/forgotPassword/resetPassword 패턴 매칭 없음.
- 현재 분실 시 신규가입 또는 카카오 재로그인만 가능.

---

## 비번찾기/아이디찾기 기능에 영향 주는 기존 자산 (web)
1. **signup.js의 이메일 인증코드 발송/확인 UI 플로우**: 비번찾기 화면에서 거의 그대로 재사용 가능(코드 입력 UI/검증 흐름).
2. **login/login.js의 SMS 인증 로직**: 아이디(이메일)찾기를 휴대폰 인증 기반으로 만들 때 재활용 가능.
3. **common/auth.js·api.js**: 토큰키(`dapick_token`)·Silent Refresh·Base URL 분기 통신 인프라 준비됨.
4. **login.html**: 복구 진입 링크를 추가할 자리(회원가입 링크 옆)가 비어 있음 — 신규 link 1줄로 진입점 마련 가능.
5. **다음 우편번호/모달 패턴(application.js)**: 복구 페이지의 모달·폼 UI 패턴 재사용 가능.
