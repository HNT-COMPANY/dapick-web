//
// structured-data-mobile.js — 다픽 휴대폰 페이지 JSON-LD
// Organization은 #organization @id로 참조 (전 페이지 공통)
//

(function () {
  'use strict';

  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': 'https://dapick.co.kr/#organization',
        name: '다픽',
        legalName: '다픽',
        url: 'https://dapick.co.kr/',
        logo: {
          '@type': 'ImageObject',
          url: 'https://dapick.co.kr/assets/logos/dapick.png',
        },
        telephone: '+82-52-1899-8478',
        email: 'daconnect33@gmail.com',
      },
      {
        '@type': 'WebPage',
        '@id': 'https://dapick.co.kr/mobile.html#webpage',
        url: 'https://dapick.co.kr/mobile.html',
        name: '다픽 | 휴대폰 지원금 비교 · 삼성 갤럭시 / Apple 아이폰',
        description:
          '삼성 갤럭시·Apple 아이폰 지원금을 한눈에 비교하세요. SKT·KT·LG U+ 통신사별 최저가, 공시지원금, 카드할인까지.',
        about: { '@id': 'https://dapick.co.kr/#organization' },
        primaryImageOfPage: {
          '@type': 'ImageObject',
          url: 'https://dapick.co.kr/assets/logos/dapick.png',
          caption: '다픽 휴대폰 지원금 비교',
        },
        inLanguage: 'ko-KR',
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: '다픽',
            item: 'https://dapick.co.kr/',
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: '휴대폰',
            item: 'https://dapick.co.kr/mobile.html',
          },
        ],
      },
    ],
  };

  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.text = JSON.stringify(data);
  document.head.appendChild(script);
})();
