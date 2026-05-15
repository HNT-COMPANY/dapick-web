// ════════════════════════════════════════════════════
// internet-kt.js — KT 통신사 초기화
// ────────────────────────────────────────────────────
// 백엔드 카테고리 ID로 Product 조회 후 빌더 초기화.
// 가격/옵션 데이터는 백엔드 Product.options JSONB에서 받음.
// ════════════════════════════════════════════════════

(function () {
  'use strict';

  const provider = {
    key: 'KT',
    name: 'KT',
    color: '#000000',
  };

  // KT 카테고리 UUID (public.categories)
  const KT_CATEGORY_ID = '48f5db37-32c5-4360-8a3f-b47589acf624';

  InternetProductBase.init({
    provider,
    categoryId: KT_CATEGORY_ID,
  });
})();
