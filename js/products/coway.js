//
// 코웨이 상품 데이터
// 수정 시 이 파일만 열면 됩니다
// pricing 구조:
//   '약정키': {
//     '관리주기': {
//       기본:    { monthly, cardDiscount, maxSupport },
//       타사보상: { monthly, cardDiscount, maxSupport },
//     }
//   }
// monthly/cardDiscount/maxSupport 가 0이면 → "상담 시 안내" 자동 표시
//

const COWAY = {
  name: '코웨이',
  emoji: '💧',
  products: [
    {
      id: 'cw1',
      name: '코웨이 아이콘 얼음 냉온정수기',
      image: '/assets/coway/products/icon/cw1.gif',
      best: true,
      new: false,
      pricing: {
        '의무36/계약60': {
          '2개월': {
            기본: { monthly: 54900, cardDiscount: 31900, maxSupport: 292000 },
            타사보상: {
              monthly: 49410,
              cardDiscount: 31900,
              maxSupport: 339200,
            },
          },
          '4개월': {
            기본: { monthly: 51900, cardDiscount: 28900, maxSupport: 284800 },
            타사보상: {
              monthly: 46710,
              cardDiscount: 23710,
              maxSupport: 330400,
            },
          },
        },
        '의무60/계약60': {
          '2개월': {
            기본: { monthly: 51400, cardDiscount: 28400, maxSupport: 292000 },
            타사보상: {
              monthly: 46260,
              cardDiscount: 23260,
              maxSupport: 339200,
            },
          },
          '4개월': {
            기본: { monthly: 48400, cardDiscount: 25400, maxSupport: 284800 },
            타사보상: {
              monthly: 43560,
              cardDiscount: 20560,
              maxSupport: 330400,
            },
          },
        },
        '의무72/계약72': {
          '2개월': {
            기본: { monthly: 44990, cardDiscount: 26900, maxSupport: 339200 },
            타사보상: {
              monthly: 44910,
              cardDiscount: 21910,
              maxSupport: 398400,
            },
          },
          '4개월': {
            기본: { monthly: 46900, cardDiscount: 23900, maxSupport: 330400 },
            타사보상: {
              monthly: 42210,
              cardDiscount: 19210,
              maxSupport: 387200,
            },
          },
        },
        '의무84/계약84': {
          '2개월': {
            기본: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
            타사보상: {
              monthly: 43560,
              cardDiscount: 20560,
              maxSupport: 398400,
            },
          },
          '4개월': {
            기본: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
            타사보상: {
              monthly: 40860,
              cardDiscount: 17860,
              maxSupport: 387200,
            },
          },
        },
      },
      colors: ['아이스 화이트', '아이스 핑크', '아이스 블루', '아이스 그레이'],
      desc: 'CHPI-7400N_2 가장 콤팩트한 얼음정수기의 탄생, 빠른 제빙 속도로 얼음을 늘 신선하게! 가로 24cm 콤팩트 사이즈와 4가지 컬러로 내 공간에 맞게!',
    },
    {
      id: 'cw2',
      name: '노블 직수 정수기',
      image: '',
      best: true,
      new: false,
      pricing: {
        '의무36/계약60': {
          '4개월': {
            기본: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
            타사보상: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
          },
          '6개월': {
            기본: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
            타사보상: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
          },
        },
        '의무60/계약60': {
          '4개월': {
            기본: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
            타사보상: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
          },
          '6개월': {
            기본: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
            타사보상: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
          },
        },
        '의무72/계약72': {
          '4개월': {
            기본: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
            타사보상: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
          },
          '6개월': {
            기본: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
            타사보상: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
          },
        },
        '의무84/계약84': {
          '4개월': {
            기본: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
            타사보상: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
          },
          '6개월': {
            기본: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
            타사보상: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
          },
        },
      },
      colors: ['화이트', '실버'],
      desc: '직수형 슬림 바디, 설치 간편, 합리적인 가격의 베스트셀러',
    },
    {
      id: 'cw3',
      name: '아이콘 냉온정수기',
      image: '',
      best: true,
      new: false,
      pricing: {
        '의무36/계약60': {
          '2개월': {
            기본: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
            타사보상: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
          },
          '4개월': {
            기본: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
            타사보상: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
          },
        },
        '의무60/계약60': {
          '2개월': {
            기본: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
            타사보상: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
          },
          '4개월': {
            기본: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
            타사보상: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
          },
        },
        '의무72/계약72': {
          '2개월': {
            기본: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
            타사보상: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
          },
          '4개월': {
            기본: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
            타사보상: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
          },
        },
        '의무84/계약84': {
          '2개월': {
            기본: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
            타사보상: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
          },
          '4개월': {
            기본: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
            타사보상: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
          },
        },
      },
      colors: ['화이트', '블랙', '그레이'],
      desc: '1초 냉·온수 출수, IoT 연동, 스스로 관리 가능한 코웨이 대표 모델',
    },
    {
      id: 'cw4',
      name: '마이한뼘 정수기',
      image: '',
      best: false,
      new: false,
      pricing: {
        '의무36/계약60': {
          '4개월': {
            기본: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
            타사보상: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
          },
          '6개월': {
            기본: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
            타사보상: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
          },
        },
        '의무60/계약60': {
          '4개월': {
            기본: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
            타사보상: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
          },
          '6개월': {
            기본: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
            타사보상: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
          },
        },
        '의무72/계약72': {
          '4개월': {
            기본: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
            타사보상: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
          },
          '6개월': {
            기본: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
            타사보상: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
          },
        },
        '의무84/계약84': {
          '4개월': {
            기본: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
            타사보상: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
          },
          '6개월': {
            기본: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
            타사보상: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
          },
        },
      },
      colors: ['화이트'],
      desc: '초슬림, 원룸·사무실 최적, 공간 효율 최고',
    },
    {
      id: 'cw5',
      name: '한뼘 플러스',
      image: '',
      best: false,
      new: false,
      pricing: {
        '의무36/계약60': {
          '4개월': {
            기본: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
            타사보상: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
          },
        },
        '의무60/계약60': {
          '4개월': {
            기본: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
            타사보상: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
          },
        },
        '의무72/계약72': {
          '4개월': {
            기본: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
            타사보상: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
          },
        },
        '의무84/계약84': {
          '4개월': {
            기본: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
            타사보상: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
          },
        },
      },
      colors: ['화이트', '베이지'],
      desc: '세련된 디자인, 직수형 필터, 한뼘 시리즈 업그레이드 버전',
    },
    {
      id: 'cw6',
      name: '아이콘2 냉온정수기',
      image: '',
      best: false,
      new: true,
      pricing: {
        '의무36/계약60': {
          '2개월': {
            기본: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
            타사보상: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
          },
          '4개월': {
            기본: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
            타사보상: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
          },
        },
        '의무60/계약60': {
          '2개월': {
            기본: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
            타사보상: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
          },
          '4개월': {
            기본: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
            타사보상: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
          },
        },
        '의무72/계약72': {
          '2개월': {
            기본: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
            타사보상: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
          },
          '4개월': {
            기본: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
            타사보상: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
          },
        },
        '의무84/계약84': {
          '2개월': {
            기본: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
            타사보상: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
          },
          '4개월': {
            기본: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
            타사보상: { monthly: 0, cardDiscount: 0, maxSupport: 0 },
          },
        },
      },
      colors: ['화이트', '블랙'],
      desc: '2세대 아이콘, 더 빠른 출수속도, 향상된 필터 성능',
    },
  ],
};
