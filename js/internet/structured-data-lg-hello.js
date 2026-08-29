//
// structured-data-lg-hello.js — LG HelloVision 페이지 SEO (JSON-LD)
// @graph: Organization, WebPage, BreadcrumbList, Service
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
        url: 'https://dapick.co.kr',
        logo: 'https://dapick.co.kr/assets/logos/dapicklogo.png',
        telephone: '+82-52-1899-8478',
        address: {
          '@type': 'PostalAddress',
          streetAddress: '달삼로 76, 3층 305-6호',
          addressLocality: '울산 남구',
          addressCountry: 'KR',
        },
      },
      {
        '@type': 'WebPage',
        '@id': 'https://dapick.co.kr/internet-lg-hello.html#webpage',
        url: 'https://dapick.co.kr/internet-lg-hello.html',
        name: 'LG HelloVision 인터넷·TV 지원금 비교 | 다픽',
        description:
          'LG HelloVision 인터넷·TV 실제 정책 기준 지원금 비교. 케이블 TV 결합 사은품, 무료 상담 신청까지.',
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
            name: 'LG HelloVision',
            item: 'https://dapick.co.kr/internet-lg-hello.html',
          },
        ],
      },
      {
        '@type': 'Service',
        serviceType: 'LG HelloVision 인터넷·TV 가입 상담',
        provider: {
          '@id': 'https://dapick.co.kr/#organization',
        },
        areaServed: {
          '@type': 'Country',
          name: '대한민국',
        },
      },
    ],
  };

  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(data);
  document.head.appendChild(script);
})();
