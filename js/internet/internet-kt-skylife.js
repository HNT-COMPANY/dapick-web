//
// internet-kt-skylife.js — KT Skylife 통신사 초기화
// ────────────────────────────────────────────────────
// carrier 매칭: provider.key === internet_tv_products.carrier
//

(function () {
  'use strict';

  const provider = {
    key: 'KT Skylife',
    name: 'KT Skylife',
    color: '#000000', // KT 계열 통일
  };

  // KT Skylife 카테고리 UUID (public.categories)
  const KT_SKYLIFE_CATEGORY_ID = '4ac6ab13-9c4a-441e-97ac-3198f1d2cf79';

  InternetProductBase.init({
    provider,
    categoryId: KT_SKYLIFE_CATEGORY_ID,
  });
})();
