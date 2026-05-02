// ════════════════════════════════════════════════════
// internet-skt.js — SKT 인터넷·TV 데이터
// ────────────────────────────────────────────────────
// 데이터 구조:
//   provider      : 통신사 메타
//   product
//     ├ productId  : 백엔드 상품 UUID (회원이 신청 시 백엔드 검증)
//     ├ speeds      : 인터넷 속도 3개 (100M/500M/1G)
//     ├ tvOptions   : TV 채널 3개 (라이트/스탠다드/프리미엄)
//     ├ routerPrice : 공유기 추가 요금
//     ├ phonePrice  : 전화 추가 요금
//     ├ phoneComboDiscount : 휴대폰 결합 할인
//     ├ cardDiscount       : 카드할인
//     └ contracts   : 약정 (12/24/36개월) + 사은품
//
// TODO: productId = 백엔드에서 실제 UUID 받아서 박기
// ════════════════════════════════════════════════════

(function () {
  'use strict';

  const PROVIDER = {
    key: 'SKT',
    name: 'SKT',
    code: 'IT-SKT',
    logo: 'assets/logos/SKTLOGO.png',
    color: '#3617CE',
  };

  const PRODUCT = {
    // TODO: 백엔드 productId 받으면 정정
    productId: 'skt-internet-tv-default',

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

    // TV 채널 옵션 3개
    tvOptions: [
      {
        code: 'TV_LITE',
        channels: 238,
        tier: '라이트',
        desc: '경제적인 채널',
        addPrice: 0,
      },
      {
        code: 'TV_STD',
        channels: 240,
        tier: '스탠다드',
        desc: '합리적인 가격',
        addPrice: 0,
        isRecommend: true,
      },
      {
        code: 'TV_PRM',
        channels: 263,
        tier: '프리미엄',
        desc: '최다 채널',
        addPrice: 0,
      },
    ],

    // 부가 옵션 가격
    routerPrice: 5500, // 공유기와 함께
    phonePrice: 3300, // 전화와 함께

    // 결합 할인
    phoneComboDiscount: 0, // 휴대폰 결합
    cardDiscount: 0, // 카드할인

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
