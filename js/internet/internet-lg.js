// ════════════════════════════════════════════════════
// internet-lg.js — LG U+ 통신사 초기화
// ────────────────────────────────────────────────────
// 백엔드 카테고리 ID로 Product 조회 후 빌더 초기화.
// 가격/옵션 데이터는 백엔드 Product.options JSONB에서 받음.
// ════════════════════════════════════════════════════

(function () {
  'use strict';

  const provider = {
    key: 'LG U+',
    name: 'LG U+',
    color: '#E6007E',
  };

  // LG U+ 카테고리 UUID (public.categories)
  const LG_CATEGORY_ID = 'fe32cf71-54ef-48ad-9cf8-68c193163dd6';

  InternetProductBase.init({
    provider,
    categoryId: LG_CATEGORY_ID,
  });
})();
