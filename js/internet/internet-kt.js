// ════════════════════════════════════════════════════
// internet-kt.js — KT 인터넷·TV 데이터
// ────────────────────────────────────────────────────
// SKT 패턴 그대로, KT 데이터 박음
// 가격은 모두 0 (자료 박힌 후 매핑)
// TV 채널수: 220 / 230 / 250 추측 박음 (정확한 자료 박힌 후 수정)
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

  const PRODUCT = {
    // TODO: 백엔드 productId 받으면 정정
    productId: 'kt-internet-tv-default',

    // 인터넷 속도 옵션 3개
    speeds: [
      {
        code: 'SPEED_100M',
        label: '100',
        unit: 'Mbps',
        tier: '슬림',
        desc: '1-2인 가구',
        basePrice: 0,
      },
      {
        code: 'SPEED_500M',
        label: '500',
        unit: 'Mbps',
        tier: '베이직',
        desc: '3-4인 가구',
        basePrice: 0,
        isRecommend: true,
      },
      {
        code: 'SPEED_1G',
        label: '1',
        unit: 'Gbps',
        tier: '에센스',
        desc: '라이브 방송 / 게이밍',
        basePrice: 0,
      },
    ],

    // TV 채널 옵션 3개 (KT 지니TV)
    // TODO: 정확한 KT 지니TV 채널수/티어명 자료 박힌 후 수정
    tvOptions: [
      {
        code: 'TV_LITE',
        channels: 220,
        tier: '라이트',
        desc: '경제적인 채널',
        addPrice: 0,
      },
      {
        code: 'TV_STD',
        channels: 230,
        tier: '스탠다드',
        desc: '합리적인 가격',
        addPrice: 0,
        isRecommend: true,
      },
      {
        code: 'TV_PRM',
        channels: 250,
        tier: '프리미엄',
        desc: '최다 채널',
        addPrice: 0,
      },
    ],

    // 부가 옵션 가격
    routerPrice: 5500,
    phonePrice: 3300,

    // 결합 할인
    phoneComboDiscount: 0,
    cardDiscount: 0,

    // 약정 + 사은품
    contracts: [
      { months: 12, gift: 0 },
      { months: 24, gift: 0 },
      { months: 36, gift: 0, isRecommend: true },
    ],
  };

  InternetProductBase.init({
    provider: PROVIDER,
    product: PRODUCT,
  });
})();
