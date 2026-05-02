// ════════════════════════════════════════════════════
// structured-data-index.js — 다픽 메인 페이지 JSON-LD
// 검색엔진 봇용 구조화 데이터 (Organization/WebSite/WebPage/FAQPage)
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
        alternateName: ['다픽 플랫폼', '주식회사 다커넥트'],
        legalName: '주식회사 다커넥트',
        url: 'https://dapick.co.kr/',
        logo: {
          '@type': 'ImageObject',
          url: 'https://dapick.co.kr/assets/logos/dapick.png',
        },
        description:
          '인터넷·TV·정수기·휴대폰·카드 지원금을 한눈에 비교하는 생활 지원금 플랫폼',
        founder: { '@type': 'Person', name: '강성현' },
        telephone: '1899-8478',
        email: 'wwh3218@gmail.com',
        address: {
          '@type': 'PostalAddress',
          streetAddress: '병영로 13',
          addressLocality: '중구',
          addressRegion: '울산광역시',
          addressCountry: 'KR',
        },
        contactPoint: {
          '@type': 'ContactPoint',
          contactType: 'customer service',
          telephone: '1899-8478',
          availableLanguage: 'Korean',
          url: 'https://pf.kakao.com/_exaRjX',
        },
        sameAs: [
          'https://blog.naver.com/daphone_kor',
          'https://www.instagram.com/daphone_official',
          'https://www.youtube.com/@daphone_kor',
          'https://pf.kakao.com/_exaRjX',
        ],
      },
      {
        '@type': 'WebSite',
        '@id': 'https://dapick.co.kr/#website',
        url: 'https://dapick.co.kr/',
        name: '다픽',
        description: '인터넷·TV·정수기·휴대폰 지원금 비교 플랫폼',
        inLanguage: 'ko-KR',
        publisher: { '@id': 'https://dapick.co.kr/#organization' },
      },
      {
        '@type': 'WebPage',
        '@id': 'https://dapick.co.kr/#webpage',
        url: 'https://dapick.co.kr/',
        name: '다픽 | 인터넷·TV·휴대폰·정수기 지원금 비교 플랫폼',
        isPartOf: { '@id': 'https://dapick.co.kr/#website' },
        about: { '@id': 'https://dapick.co.kr/#organization' },
        primaryImageOfPage: {
          '@type': 'ImageObject',
          '@id': 'https://dapick.co.kr/#primaryimage',
          url: 'https://dapick.co.kr/assets/logos/dapick.png',
          caption: '다픽 생활 지원금 비교 플랫폼',
        },
        image: { '@id': 'https://dapick.co.kr/#primaryimage' },
        thumbnailUrl: 'https://dapick.co.kr/assets/logos/dapick.png',
        inLanguage: 'ko-KR',
      },
      {
        '@type': 'FAQPage',
        '@id': 'https://dapick.co.kr/#faq',
        mainEntity: [
          {
            '@type': 'Question',
            name: '인터넷·TV 가입 시 설치비가 있나요?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: '대부분의 경우 설치비는 무료입니다. 일부 특수 환경에서는 별도 비용이 발생할 수 있으며, 상담 시 미리 확인해드립니다.',
            },
          },
          {
            '@type': 'Question',
            name: '지원금(사은품)은 어떻게 받나요?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: '가입 후 개통 완료 시점에 상품권(SK/신세계/OK캐쉬백 등)으로 지급됩니다. 채널·약정·결합 조건에 따라 금액이 달라집니다.',
            },
          },
          {
            '@type': 'Question',
            name: '상담 신청 후 얼마나 기다려야 하나요?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: '영업시간(10:00~22:00) 30분~2시간 내 연락드립니다. 야간·주말 접수 건은 다음 영업일 오전 중 연락드립니다.',
            },
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
