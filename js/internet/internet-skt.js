// ════════════════════════════════════════════════════
// internet-skt.js — SKT 통신사 초기화 (v3 변경 없음)
// ════════════════════════════════════════════════════

(function () {
  'use strict';

  const provider = {
    key: 'SKT',
    name: 'SKT',
    color: '#3617CE',
  };

  // SKT 카테고리 UUID (public.categories)
  const SKT_CATEGORY_ID = 'acbe6c19-c70b-453c-aa14-409069f86e9a';

  InternetProductBase.init({
    provider,
    categoryId: SKT_CATEGORY_ID,
  });
})();
