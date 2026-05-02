// ════════════════════════════════════════════════════
// structured-data-skt.js — SKT 페이지 SEO (JSON-LD)
// ────────────────────────────────────────────────────
// @graph: Organization, WebPage, BreadcrumbList, Service
// 네이버/구글 색인 강화
// ════════════════════════════════════════════════════

(function () {
  'use strict';

  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': 'https://dapick.co.kr/#organization',
        name: '다픽',
        legalName: '주식회사 다커넥트',
        url: 'https://dapick.co.kr',
        logo: 'https://dapick.co.kr/assets/logos/dapicklogo.png',
        telephone: '+82-1899-8478',
        address: {
          '@type': 'PostalAddress',
          streetAddress: '병영로 13',
          addressLocality: '울산 중구',
          addressCountry: 'KR',
        },
      },
      {
        '@type': 'WebPage',
        '@id': 'https://dapick.co.kr/internet-skt.html#webpage',
        url: 'https://dapick.co.kr/internet-skt.html',
        name: 'SKT 인터넷·TV 지원금 비교 | 다픽',
        description:
          'SKT 인터넷·TV 실제 정책 기준 지원금 비교. 500MB 기가라이트, 1Gbps 기가, BTv 결합 사은품 최대 50만원. 무료 상담 신청까지.',
        inLanguage: 'ko-KR',
        isPartOf: {
          '@id': 'https://dapick.co.kr/#organization',
        },
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
            name: '인터넷·TV',
            item: 'https://dapick.co.kr/internet.html',
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: 'SKT',
            item: 'https://dapick.co.kr/internet-skt.html',
          },
        ],
      },
      {
        '@type': 'Service',
        serviceType: 'SKT 인터넷·TV 가입 상담',
        provider: {
          '@id': 'https://dapick.co.kr/#organization',
        },
        areaServed: {
          '@type': 'Country',
          name: '대한민국',
        },
        offers: {
          '@type': 'AggregateOffer',
          priceCurrency: 'KRW',
          lowPrice: '27500',
          highPrice: '66000',
          offerCount: '5',
          description: 'SKT 인터넷·TV 요금제 (3년 약정 기준)',
        },
      },
    ],
  };

  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(data);
  document.head.appendChild(script);
})();
