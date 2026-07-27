# legacy-static — 안 쓰는 옛 매장 페이지 (자료 보관용)

**이 폴더의 파일은 사이트에서 안 씁니다. 여기 있는 걸 고쳐도 웹은 안 바뀝니다.**

## 뭐가 들어 있나

지점마다 손으로 만들던 시절의 정적 HTML 7개입니다.

```
store-beomil.html      store-byeongyeong.html   store-cheongok.html
store-guyeong.html     store-mandeok.html       store-mugeo.html
store-onsan.html
```

지점 소개문·체크리스트·이미지 경로가 이 안에 하드코딩되어 있습니다. 지우지 않고 남겨 둔 이유는
그것뿐입니다 — 관리자에 옮겨 적을 때 보려고.

## 지금은 어떻게 돌아가나

매장 상세 페이지는 **파일이 아니라 데이터**입니다.

```
관리자 (휴대폰 매장 관리)
  5단계  URL 식별자(slug)  →  그게 곧 주소다.  dapick.co.kr/store/{slug}
  6단계  본문              →  stores.detail_json (jsonb)
        ↓
백엔드  GET /api/stores/{slug}
        ↓
_worker.js  store-detail.html 틀에 본문까지 주입해서 내보냄
```

지점을 하나 추가하려면 관리자에서 등록하면 끝입니다. 파일을 만들지 않습니다.
`sitemap.xml` 의 매장 줄도 워커가 API 로 채웁니다 — 가맹점이 100곳이 돼도 손댈 파일이 없습니다.

## 웹에서 못 보게 막아 둔 곳

`_worker.js` 두 군데입니다. 둘 중 하나라도 풀면 옛 더미 내용이 그대로 노출됩니다.

- `LEGACY_DIR_RE` — `/legacy-static/…` 로 직접 들어오면 `/mobile` 로 돌린다.
- `redirectLegacyStore()` — 옛 주소 `/store-byeongyeong` 은 새 주소로 301, 못 찾으면 `/mobile` 로 302.
  **여기서 `env.ASSETS.fetch(request)` 로 떨어뜨리면 안 된다.** 그러면 더미가 뜬다.
  이 규칙은 `test-worker-parity.js` 가 검사한다.

## 이 폴더를 지워도 되는 때

7개 지점을 전부 관리자에 등록하고, `dapick.co.kr/store/{식별자}` 가 실제로 뜨는 걸 확인한 뒤.
그때는 이 폴더째 지우면 됩니다. 다른 곳에서 참조하지 않습니다.
