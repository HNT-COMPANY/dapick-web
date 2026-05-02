// ════════════════════════════════════════════════════
// internet-kt.js — KT 인터넷·TV 페이지
// ────────────────────────────────────────────────────
// 통신사 메타 + 상품 데이터 정의 후 InternetProductBase.init 호출
// ════════════════════════════════════════════════════

(function () {
  'use strict';

  const PROVIDER = {
    key: 'KT',
    name: 'KT',
    code: 'IT-KT',
    logo: 'assets/logos/KT.png',
    color: '#000000',
  };

  const PRODUCTS = [
    {
      id: 'kt-giga-500',
      name: '500MB 기가 인터넷 + 지니TV 베이직',
      channels: 245,
      isBest: true,
      tag: '합리적 | 3~4인 가구',
      contracts: [
        { months: 12, price: 49500, gift: 250000 },
        { months: 24, price: 45100, gift: 350000 },
        { months: 36, price: 37400, gift: 450000 },
      ],
      tvOptions: [
        { code: 'GENIE-BASIC', name: '지니TV 베이직', addPrice: 5500 },
        { code: 'GENIE-STD', name: '지니TV 스탠다드', addPrice: 11000 },
      ],
      phoneCombo: { discount: 19250 },
    },
    {
      id: 'kt-giga-1g',
      name: '1Gbps 기가 인터넷 + 지니TV 프리미엄',
      channels: 280,
      isBest: true,
      tag: '인기 | 영상 시청 많은 가구',
      contracts: [
        { months: 12, price: 55000, gift: 300000 },
        { months: 24, price: 50600, gift: 400000 },
        { months: 36, price: 42900, gift: 500000 },
      ],
      tvOptions: [
        { code: 'GENIE-STD', name: '지니TV 스탠다드', addPrice: 11000 },
        { code: 'GENIE-PRM', name: '지니TV 프리미엄', addPrice: 16500 },
      ],
      phoneCombo: { discount: 22000 },
    },
    {
      id: 'kt-giga-2g',
      name: '2Gbps 기가 인터넷 + 지니TV 프리미엄',
      channels: 305,
      isBest: true,
      tag: 'VIP | 게이밍 + 4K 시청',
      contracts: [
        { months: 12, price: 64900, gift: 350000 },
        { months: 24, price: 59400, gift: 450000 },
        { months: 36, price: 51700, gift: 550000 },
      ],
      tvOptions: [
        { code: 'GENIE-PRM', name: '지니TV 프리미엄', addPrice: 16500 },
      ],
      phoneCombo: { discount: 25300 },
    },
    {
      id: 'kt-light-100',
      name: '100MB 라이트 (단독 인터넷)',
      channels: null,
      isBest: false,
      tag: '실속형 | 1인 가구',
      contracts: [
        { months: 12, price: 32450, gift: 150000 },
        { months: 24, price: 30250, gift: 200000 },
        { months: 36, price: 26950, gift: 250000 },
      ],
      tvOptions: null,
      phoneCombo: { discount: 11000 },
    },
    {
      id: 'kt-only-1g',
      name: '1Gbps 기가 인터넷 단독',
      channels: null,
      isBest: false,
      tag: '인터넷만 | TV 미사용',
      contracts: [
        { months: 12, price: 41250, gift: 200000 },
        { months: 24, price: 37950, gift: 300000 },
        { months: 36, price: 32450, gift: 400000 },
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
