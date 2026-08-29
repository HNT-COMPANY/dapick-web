//
// internet-lg-hello.js — LG HelloVision 통신사 초기화
// ────────────────────────────────────────────────────
// carrier 매칭: provider.key === internet_tv_products.carrier
//

(function () {
  'use strict';

  const provider = {
    key: 'LG HelloVision',
    name: 'LG HelloVision',
    color: '#E6007E', // LG U+ 계열 통일
  };

  // LG HelloVision 카테고리 UUID (public.categories)
  const LG_HELLO_CATEGORY_ID = 'e36f7605-6d99-4dce-b3a8-942bd8a62c8b';

  InternetProductBase.init({
    provider,
    categoryId: LG_HELLO_CATEGORY_ID,
  });
})();
