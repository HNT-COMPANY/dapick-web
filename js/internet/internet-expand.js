// ════════════════════════════════════════════════════════════════════
// internet-expand.js — 인터넷·TV 상품 1행을 '속도 옵션' 여러 줄로 펼친다 (2026-08-07)
//
// 왜 필요한가
//   internet_tv_products 는 통신사 1개 = 1행이다. 고객이 실제로 고르는
//   100M·500M·1G 는 internetOptions jsonb 배열 '안' 에 들어 있다.
//   그대로 두면 파인더 후보가 통신사 3개뿐이고, 무슨 질문을 해도
//   추천 결과가 "KT 입니다" 수준이 된다.
//
// 저장은 안 바꾼다
//   DB 는 지금처럼 통신사 1행이다. 읽을 때만 나눠 본다.
//   저장까지 쪼개면 인터넷 상세(빌더)·비교함·상담접수가 전부 근거를 잃는다.
//   2026-08-07 결정.
//
// 07-27 비교함과 같은 규칙 — TV·공유기 없는 '단독가' 로 편다.
//   조합까지 넣으면 수백 줄이 된다.
//
// ⚠ 이 파일은 어드민에도 복사본이 있다 (dapick-admin/js/internet-expand.js).
//   어드민 4단계가 '조건에 쓸 칸' 을 뽑을 때 같은 모양을 봐야 하기 때문이다.
//   여기를 고치면 같은 커밋에서 복사본도 갱신할 것.
//
// 의존: 없다. InternetCalc 가 있으면 쓰고 없으면 같은 식으로 직접 계산한다.
//   TV·공유기를 안 켠 단독가에서는 InternetCalc.calculate 와 아래 폴백의 수식이 같다
//   (base = normalPrice, 최종 = 결합가 - 결합할인 - 카드할인).
//   그래서 어드민에는 internet-calc.js 를 옮기지 않았다 — 복사본은 적을수록 좋다.
// ════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  // 옵션 이름에서 속도를 숫자(Mbps)로 뽑는다.
  //   "100Mbps" → 100 / "500M" → 500 / "1G" → 1000 / "기가 1G" → 1000
  // 못 읽으면 undefined 를 준다. 0 을 넣으면 "이하" 조건에 전부 걸려서
  // 관리자가 오타를 못 알아챈다.
  function speedOf(name) {
    var m = String(name || '').match(/(\d+(?:\.\d+)?)\s*(G|M)/i);
    if (!m) return undefined;
    var n = Number(m[1]);
    if (!(n > 0)) return undefined;
    return m[2].toUpperCase() === 'G' ? n * 1000 : n;
  }

  // 이 옵션 하나만 켠 '단독가'.
  // InternetCalc 가 있으면 그 계산식을 쓴다 — 상세 화면과 숫자가 달라지면 안 된다.
  function priceOf(opt, meta) {
    if (typeof InternetCalc !== 'undefined' && InternetCalc && InternetCalc.calculate) {
      var r = InternetCalc.calculate({ internet: opt, toggles: {}, meta: meta || {} });
      return { base: Number(r.basePrice || 0), fee: Number(r.finalPrice || 0),
               gift: Number(r.gift || 0), cardDiscount: Number(r.cardDiscount || 0),
               bundleDiscount: Number(r.bundleDiscount || 0) };
    }
    // 폴백 — 계산기가 없을 때. 결합가만 본다.
    var m2 = meta || {};
    var normal = Number((opt && opt.normalPrice) || 0);
    var bundle = (opt && opt.bundlePrice != null && opt.bundlePrice !== '')
      ? Number(opt.bundlePrice) : normal;
    var cd = Number((opt && opt.cardDiscount != null ? opt.cardDiscount : m2.cardDiscount) || 0);
    var bd = Number((opt && opt.bundleDiscount != null ? opt.bundleDiscount : m2.bundleDiscount) || 0);
    return { base: normal, fee: Math.max(0, bundle - bd - cd),
             gift: Number((opt && opt.gift != null ? opt.gift : m2.gift) || 0),
             cardDiscount: cd, bundleDiscount: bd };
  }

  // 값이 없는 칸은 아예 넣지 않는다.
  // null 을 넣으면 어드민 칸 목록에 이름만 뜨고 값이 없어서 조건을 못 만든다.
  function put(row, key, v) {
    if (v == null || v === '') return;
    row[key] = v;
  }

  // products(통신사 배열) → 펼친 줄 배열
  //
  // 펼친 줄의 id 는 "{상품id}::{옵션이름}" 이다.
  //   화면에서 상세로 보낼 때는 '::' 앞부분만 쓴다(연결층이 잘라 쓴다).
  //   productId 를 따로 담지 않은 이유 — 어드민 4단계가 id 만 칸 목록에서 빼기 때문에
  //   productId 를 넣으면 UUID 가 조건 칸으로 올라와 목록이 지저분해진다.
  function expand(products) {
    var out = [];
    (Array.isArray(products) ? products : []).forEach(function (p) {
      if (!p || typeof p !== 'object') return;
      var opts = Array.isArray(p.internetOptions) ? p.internetOptions : [];
      if (!opts.length) return;          // 옵션이 없는 통신사는 고를 것이 없다

      var meta = p.discountMeta || {};
      opts.forEach(function (o) {
        if (!o || !o.name) return;
        var money = priceOf(o, meta);
        var row = {
          id: String(p.id) + '::' + o.name,
          carrier: p.carrier,
          optionName: o.name,
          name: (p.carrier || '') + ' ' + o.name,   // 카드에 보일 이름
          monthlyFee: money.fee,
        };
        put(row, 'speedMbps', speedOf(o.name));
        put(row, 'categoryId', p.categoryId);
        put(row, 'tag', p.tag);
        put(row, 'imageUrl', p.imageUrl);
        put(row, 'description', p.description);
        // 정가는 0 이면 넣지 않는다 — 지금 대부분의 옵션이 결합가만 채워져 있다.
        // 0 을 넣으면 "원가 취소선" 이 0원으로 그려진다.
        if (money.base > 0) row.basePrice = money.base;
        if (money.gift > 0) row.gift = money.gift;
        if (money.cardDiscount > 0) row.cardDiscount = money.cardDiscount;
        if (money.bundleDiscount > 0) row.bundleDiscount = money.bundleDiscount;
        // 이 통신사가 TV·공유기를 함께 파는가. 질문 "TV도 같이 볼까요?" 에 쓸 수 있다.
        row.hasTvOption = !!(Array.isArray(p.tvOptions) && p.tvOptions.length);
        row.hasRouterOption = !!(Array.isArray(p.routerOptions) && p.routerOptions.length);
        row.isBest = !!o.isBest;
        out.push(row);
      });
    });
    return out;
  }

  // 펼친 id 에서 원래 상품 id 를 되찾는다. 상세 이동·접수에 쓴다.
  function productIdOf(rowId) {
    return String(rowId || '').split('::')[0];
  }

  window.dpExpandInternet = expand;
  window.dpInternetProductId = productIdOf;
})();
