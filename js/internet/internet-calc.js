// ════════════════════════════════════════════════════
// internet-calc.js — 인터넷·TV 순수 계산/조회 코어 (DOM 없음)
// ────────────────────────────────────────────────────
// internet-product-base.js v9/v10의 calculate/bundleOf/normalOf/extrasBundleSum +
// 상품·옵션 조회를 추출. 통합페이지와 상세페이지가 공유.
// ★ 계산식은 원본 그대로 (위치만 이동). 동작 변경 0.
//   결합 전 = Σ normalPrice / 결합 = Σ bundlePrice(없으면 normalPrice)
//   cardPrice = max(0, combo - bundleDiscount - cardDiscount)
//   지원금 폴백: 선택 옵션값 ?? 상품 discountMeta ?? 0
//
// 입력은 selection 객체로 받는 순수 함수. DOM/전역 의존 없음.
//   selection = { internet, tv, router, phone, toggles:{tv,router,phone}, meta }
// ════════════════════════════════════════════════════
window.InternetCalc = (function () {
  'use strict';

  // 결합가 (bundlePrice 없으면 normalPrice 폴백) — 원본 :476-484
  function bundleOf(opt) {
    if (!opt) return 0;
    const normal = Number(opt.normalPrice || 0);
    const bundle =
      opt.bundlePrice != null && opt.bundlePrice !== ''
        ? Number(opt.bundlePrice)
        : null;
    return bundle != null ? bundle : normal;
  }

  // 일반가 — 원본 :485-487
  function normalOf(opt) {
    return opt ? Number(opt.normalPrice || 0) : 0;
  }

  // 토글된 TV/공유기/전화의 결합가 합 — 원본 :293-299
  function extrasBundleSum(sel) {
    const s = sel || {};
    const toggles = s.toggles || {};
    let sum = 0;
    if (toggles.tv && s.tv) sum += bundleOf(s.tv);
    if (toggles.router && s.router) sum += bundleOf(s.router);
    if (toggles.phone && s.phone) sum += bundleOf(s.phone);
    return sum;
  }

  // 가격 계산 — 원본 calculate(:490-535) 그대로, 클로저 변수만 인자화
  function calculate(sel) {
    const s = sel || {};
    const it = s.internet;
    const toggles = s.toggles || {};
    const meta = s.meta || {};
    if (!it)
      return {
        basePrice: 0,
        bundlePrice: 0,
        cardPrice: 0,
        finalPrice: 0,
        cardDiscount: 0,
        gift: 0,
        bundleDiscount: 0,
      };

    let base = normalOf(it);
    let combo = bundleOf(it);
    // 와이파이 패키지 모드 — 인터넷 단독 가산 (KT). 데이터 없으면(?? 0) 영향 없음 = 비KT 안전
    if (s.wifiMode === 'package') {
      const wifiPkgAdd = Number(it.wifiPackageAdd ?? 0); // 1G=0 가능
      base += wifiPkgAdd;
      combo += wifiPkgAdd;
      // 7D 광대역 WIFI — 패키지 모드에서만, 토글 ON 시 가산
      if (toggles.wifi7d) {
        const wifi7d = Number(it.wifi7dAdd ?? 0);
        base += wifi7d;
        combo += wifi7d;
      }
    }
    if (toggles.tv && s.tv) {
      base += normalOf(s.tv);
      combo += bundleOf(s.tv);
      // 셋탑은 TV 종속 — TV가 있을 때만 1회 합산 (중복합산 금지)
      if (s.setTop) {
        base += normalOf(s.setTop);
        combo += bundleOf(s.setTop);
      }
      // TV2는 TV1 종속 — TV1 켜진 상태에서만 합산. 가격은 이미 50% 적용된 입력값(코드 계산 X)
      if (s.tv2) {
        base += normalOf(s.tv2);
        combo += bundleOf(s.tv2);
        // 셋탑2는 TV2 종속 — TV2 선택 시에만 1회 합산
        if (s.setTop2) {
          base += normalOf(s.setTop2);
          combo += bundleOf(s.setTop2);
        }
      }
    }
    if (toggles.router && s.router) {
      base += normalOf(s.router);
      combo += bundleOf(s.router);
    }
    if (toggles.phone && s.phone) {
      base += normalOf(s.phone);
      combo += bundleOf(s.phone);
    }

    // 지원금 출처: 선택된 인터넷 옵션에 값 있으면 옵션, 없으면 상품 discountMeta(meta) 폴백
    // (?? 사용: 옵션에 0이 들어와도 0을 존중하고, null/undefined일 때만 상품값으로 폴백)
    const cardDiscount = Number(it.cardDiscount ?? meta.cardDiscount ?? 0);
    const gift = Number(it.gift ?? meta.gift ?? 0);
    const bundleDiscount = Number(
      it.bundleDiscount ?? meta.bundleDiscount ?? 0,
    );
    // 최종 혜택가 = 휴대폰 결합 요금 - 유무선 결합 할인 - 카드 할인
    const cardPrice = Math.max(0, combo - bundleDiscount - cardDiscount);

    return {
      basePrice: base, // 결합 전 요금
      bundlePrice: combo, // 휴대폰 결합 요금
      cardPrice: cardPrice, // 유무선+카드 할인 적용 (최종)
      finalPrice: cardPrice, // 신청에 넘길 최종가
      cardDiscount: cardDiscount,
      gift: gift,
      bundleDiscount: bundleDiscount,
    };
  }
  //
  // ── 조회/복원 헬퍼 (상세페이지용 — 통합페이지는 기존 인라인 유지) ──
  // carrier 키로 상품 찾기 — 원본 :173
  function findByCarrier(list, carrierKey) {
    if (!Array.isArray(list)) return null;
    return list.find((p) => p.carrier === carrierKey) || null;
  }

  // 옵션 배열에서 name으로 옵션 찾기 — 원본 :393 등
  function findOptionByName(options, name) {
    if (!Array.isArray(options)) return null;
    return options.find((o) => o.name === name) || null;
  }

  // 상품 객체 → 옵션 배열 + meta 추출 — 원본 :184-194
  function extractOptions(product) {
    const p = product || {};
    return {
      internets: Array.isArray(p.internetOptions) ? p.internetOptions : [],
      tvs: Array.isArray(p.tvOptions) ? p.tvOptions : [],
      setTops: Array.isArray(p.setTopOptions) ? p.setTopOptions : [],
      tv2s: Array.isArray(p.tv2Options) ? p.tv2Options : [],
      setTop2s: Array.isArray(p.setTop2Options) ? p.setTop2Options : [],
      routers: Array.isArray(p.routerOptions) ? p.routerOptions : [],
      phones: Array.isArray(p.phoneOptions) ? p.phoneOptions : [],
      meta: p.discountMeta || {},
    };
  }

  return {
    bundleOf: bundleOf,
    normalOf: normalOf,
    extrasBundleSum: extrasBundleSum,
    calculate: calculate,
    findByCarrier: findByCarrier,
    findOptionByName: findOptionByName,
    extractOptions: extractOptions,
  };
})();
