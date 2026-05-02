// ════════════════════════════════════════════════════
// internet-lg.js — LG U+ 인터넷·TV 페이지
// ────────────────────────────────────────────────────
// 통신사 메타 + 상품 데이터 정의 후 InternetProductBase.init 호출
// ════════════════════════════════════════════════════

(function () {
  'use strict';

  const PROVIDER = {
    key: 'LG',
    name: 'LG U+',
    code: 'IT-LG',
    logo: 'assets/logos/LG.png',
    color: '#E6007E',
  };

  const PRODUCTS = [
    {
      id: 'lg-giga-500',
      name: '500MB 기가 인터넷 + U+tv 베이직',
      channels: 240,
      isBest: true,
      tag: '합리적 | 3~4인 가구',
      contracts: [
        { months: 12, price: 48400, gift: 250000 },
        { months: 24, price: 44000, gift: 350000 },
        { months: 36, price: 36300, gift: 450000 },
      ],
      tvOptions: [
        { code: 'UTV-BASIC', name: 'U+tv 베이직', addPrice: 5500 },
        { code: 'UTV-STD', name: 'U+tv 스탠다드', addPrice: 11000 },
      ],
      phoneCombo: { discount: 19250 },
    },
    {
      id: 'lg-giga-1g',
      name: '1Gbps 기가 인터넷 + U+tv 프리미엄',
      channels: 275,
      isBest: true,
      tag: '인기 | 영상 시청 많은 가구',
      contracts: [
        { months: 12, price: 53900, gift: 300000 },
        { months: 24, price: 49500, gift: 400000 },
        { months: 36, price: 41800, gift: 500000 },
      ],
      tvOptions: [
        { code: 'UTV-STD', name: 'U+tv 스탠다드', addPrice: 11000 },
        { code: 'UTV-PRM', name: 'U+tv 프리미엄', addPrice: 16500 },
      ],
      phoneCombo: { discount: 22000 },
    },
    {
      id: 'lg-giga-2g',
      name: '2Gbps 기가 인터넷 + U+tv 프리미엄 (4K UHD)',
      channels: 300,
      isBest: true,
      tag: 'VIP | 4K UHD 시청',
      contracts: [
        { months: 12, price: 63800, gift: 350000 },
        { months: 24, price: 58300, gift: 450000 },
        { months: 36, price: 50600, gift: 550000 },
      ],
      tvOptions: [{ code: 'UTV-PRM', name: 'U+tv 프리미엄', addPrice: 16500 }],
      phoneCombo: { discount: 25300 },
    },
    {
      id: 'lg-light-100',
      name: '100MB 라이트 (단독 인터넷)',
      channels: null,
      isBest: false,
      tag: '실속형 | 1인 가구',
      contracts: [
        { months: 12, price: 31900, gift: 150000 },
        { months: 24, price: 29700, gift: 200000 },
        { months: 36, price: 26400, gift: 250000 },
      ],
      tvOptions: null,
      phoneCombo: { discount: 11000 },
    },
    {
      id: 'lg-only-1g',
      name: '1Gbps 기가 인터넷 단독',
      channels: null,
      isBest: false,
      tag: '인터넷만 | TV 미사용',
      contracts: [
        { months: 12, price: 40700, gift: 200000 },
        { months: 24, price: 37400, gift: 300000 },
        { months: 36, price: 31900, gift: 400000 },
      ],
      tvOptions: null,
      phoneCombo: { discount: 16500 },
    },
  ];

  InternetProductBase.init({
    provider: PROVIDER,
    products: PRODUCTS,
  });
})();
