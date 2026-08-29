//
// internet-skb.js — SK broadband 통신사 초기화
// ────────────────────────────────────────────────────
// carrier 매칭: provider.key === internet_tv_products.carrier
//

(function () {
  'use strict';

  const provider = {
    key: 'SK broadband',
    name: 'SK broadband',
    color: '#3617CE', // SKT 계열 통일
  };

  // SK broadband 카테고리 UUID (public.categories)
  const SKB_CATEGORY_ID = 'd5111dc9-92b6-494b-8820-327c072926fa';

  InternetProductBase.init({
    provider,
    categoryId: SKB_CATEGORY_ID,
  });
})();
