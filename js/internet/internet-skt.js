//
// internet-skt.js — SKT 통신사 초기화 (v3 변경 없음)
//

(function () {
  'use strict';

  const provider = {
    key: 'SKT',
    name: 'SKT',
    color: '#3617CE',
  };

  // SKT 카테고리 UUID (public.categories)
  const SKT_CATEGORY_ID = '054c916e-f51a-417f-86c6-d3b123350cf3';

  InternetProductBase.init({
    provider,
    categoryId: SKT_CATEGORY_ID,
  });
})();
