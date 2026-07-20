# 협업 규칙 (CLAUDE.md) — dapick-web (웹, 정적)

## 닫힌 학습 루프
에이전트 브레인은 백엔드 레포에 있다. 세션 시작 시 함께 읽는다(형제 폴더):
- `../dapick-network/.agent/loop.md`, `profile.md`, `memory.md`, `skills/`
- 이 레포는 `구조지도_web.md` 참고.
작업 종료 시 백엔드 `.agent/memory.md`의 CURATE 단계 갱신.

## 규칙 (공통)
- 흐름: 백엔드 → 어드민 → 웹. 정적 프론트 = 통짜 파일 선호, JS는 .js에만.
- 사용자 입력을 innerHTML에 넣을 땐 escapeHtml 경유. 추측 금지 — 파일 먼저 확인.
- git commit/push 자동 금지. 커밋은 사용자가 직접.
