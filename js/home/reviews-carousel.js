// ════════════════════════════════════════════════════
// reviews-carousel.js — 메인(index) "먼저 써본 분들의 후기"
// 우→좌 연속 흐름(마퀴). 좌우 버튼 없음. 카드는 관리자 메인 리뷰(GET /api/main-reviews).
// 데이터 없으면 아래 폴백 사용.
// ════════════════════════════════════════════════════
(function () {
  'use strict';

  // 폴백(관리자 메인 리뷰가 하나도 없을 때만 사용). nickname 은 마스킹된 표시명.
  const HREV_FALLBACK = [
    { cat: '정수기', rating: 5, content: '상담사분이 정말 친절하셨어요. 다른 곳보다 혜택도 훨씬 좋고 설치도 바로 다음날 와주셨네요!', nickname: '산**박', tags: ['만족', '친절한상담'] },
    { cat: '인터넷TV', rating: 5, content: '여기저기 비교해봤는데 여기가 제일 많이 챙겨주시는 것 같아요. 왜 1등인지 알겠습니다.', nickname: '김**수', tags: ['박리다매', '후기'] },
    { cat: '인터넷TV', rating: 5, content: '3년 약정 끝날 때마다 여기서 바꿀 생각입니다. 설치 당일 입금 바로 확인했어요. 신뢰가 갑니다.', nickname: '이**희', tags: ['다픽', '만족'] },
    { cat: '렌탈', rating: 5, content: '렌탈 조건 꼼꼼히 비교해주셔서 제일 저렴하게 가입했어요. 사은품까지 챙겨주셔서 만족합니다.', nickname: '박**진', tags: ['박리다매', '친절한요금'] },
    { cat: '정수기', rating: 5, content: '방문관리 오시는 분도 친절하시고 물맛도 좋아요. 상담부터 설치까지 하루 만에 끝났습니다.', nickname: '최**연', tags: ['만족', '친절한상담'] },
  ];

  function esc(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]),
    );
  }

  const PERSON_SVG =
    '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true">' +
    '<path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5zm0 2c-4 0-8 2-8 5v1h16v-1c0-3-4-5-8-5z"/></svg>';

  function cardHtml(r) {
    const rating = Math.max(0, Math.min(5, Math.round(Number(r.rating) || 0)));
    const stars =
      '<span class="hrev-on">' + '★'.repeat(rating) + '</span>' +
      '<span class="hrev-off">' + '★'.repeat(5 - rating) + '</span>';
    const tags = Array.isArray(r.tags) && r.tags.length
      ? '<div class="hrev-tags">' + r.tags.map((t) => '#' + esc(t)).join(' ') + '</div>'
      : '';
    return (
      '<div class="hrev-card">' +
      '<span class="hrev-cat">' + esc(r.cat || '후기') + '</span>' +
      '<div class="hrev-stars">' + stars + '</div>' +
      '<p class="hrev-content">' + esc(r.content || '') + '</p>' +
      tags +
      '<div class="hrev-author">' + PERSON_SVG + '<span>' + esc(r.nickname || '') + '님 첫 후기!</span></div>' +
      '</div>'
    );
  }

  function render(items) {
    const track = document.getElementById('hrevTrack');
    if (!track || !items.length) return;
    // 카드가 적으면 화면을 못 채우므로 여러 벌 복제(끊김 없는 무한 흐름 + 폭 확보)
    let base = items.slice();
    while (base.length < 8) base = base.concat(items); // 최소 8장 확보
    const html = base.map(cardHtml).join('');
    track.innerHTML = html + html; // 2배 복제 → -50% 이동으로 매끄러운 루프
    // 천천히 흐르도록: 카드 수에 비례한 시간(느리게)
    const dur = Math.max(24, base.length * 4);
    track.style.animationDuration = dur + 's';
  }

  async function load() {
    let items = [];
    try {
      const data = await api.get('/api/main-reviews');
      items = (Array.isArray(data) ? data : []).map((m) => ({
        cat: m.categoryLabel,
        rating: m.rating,
        content: m.content,
        nickname: m.nickname,
        tags: m.hashtags || [],
      }));
    } catch (e) {
      /* 실패 시 폴백 */
    }
    if (!items.length) items = HREV_FALLBACK;
    render(items);
  }

  function init() {
    if (!document.getElementById('hrevTrack')) return;
    load();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
