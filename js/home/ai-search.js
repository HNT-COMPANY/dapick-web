//
// ai-search.js — 메인 화면 검색창 (2026-08-10 신설, 기획서 조각 3)
//
// 무엇을 하나
//   고객이 적은 말을 카테고리 한 곳으로 떨어뜨리고, 그 카테고리 화면으로 보낸다.
//   도착하면 파인더가 질문을 건너뛰고 결과부터 연다(finder.js 의 ?finder=result).
//
// 왜 여기서 결과를 안 그리나
//   결과 화면·지원금 문구·배지·신청 세 버튼이 전부 어드민에 있고 finder.js 가 그린다.
//   검색용으로 한 벌 더 만들면, 관리자가 어드민에서 문구를 고쳐도 검색 결과만 옛말을 한다.
//   그리고 상품을 가져오는 방법이 카테고리마다 다르다(정수기는 water.js, 인터넷은 펼치기).
//   메인에 그 연결층을 다시 심으면 카테고리가 늘 때마다 메인도 같이 고쳐야 한다.
//
// 지금은 진짜 AI 가 아니다 (기획서 4장 '나' 방식)
//   말을 알아듣는 게 아니라 아래 낱말표에 걸리는지만 본다.
//   고객이 실제로 뭐라고 검색하는지 아직 아무도 모르기 때문이다. 먼저 쌓고 나서 붙인다.
//
// 이 낱말표는 임시다. 조각 4에서 어드민 '검색어 표' 로 옮긴다.
//   그때까지 낱말을 늘리려면 개발자와 배포가 필요하다 — 오래 두면 안 된다.
//
// 의존: 없음 (track.js 가 있으면 GA4 로 검색어를 함께 보낸다)
// 붙는 자리: index.html 의 <div id="aiSearch">
//
(function () {
  'use strict';

  // ── 검색어를 어느 카테고리로 보낼 것인가 ──────────────────────────
  //
  // page   그 카테고리의 웹 주소. site-banner.js 의 FINDER_PAGES 와 같은 사실이다.
  //        (전용 페이지가 없는 카테고리는 /c/{slug} 다)
  // words  그 카테고리를 부르는 말들. 고객 말 기준으로 적는다 — '인터넷TV' 가 아니라 '와이파이'.
  //
  // 짧은 낱말을 넣지 말 것.
  //   '물' 을 넣으면 "무엇이든 물어보세요" 를 따라 적은 사람이 정수기로 끌려간다.
  //   'sk' 도 넣지 않는다 — SK브로드밴드(인터넷)와 SK매직(정수기)이 갈린다.
  var ROUTES = [
    {
      slug: 'internet', page: '/internet',
      words: ['인터넷', '와이파이', '와이화이', 'wifi', '공유기', '티비', '아이피티비', 'iptv',
              '인터넷tv', '브로드밴드', '스카이라이프', '헬로비전', '기가', '광랜', '결합'],
    },
    {
      slug: 'water', page: '/water',
      words: ['정수기', '냉온수기', '얼음정수기', '직수', '코웨이', '청호', '쿠쿠', '웰스',
              '아이콘정수기', '얼음', '연수기'],
    },
    {
      slug: 'mobile', page: '/mobile',
      words: ['휴대폰', '핸드폰', '스마트폰', '아이폰', '갤럭시', '요금제', '공시지원금',
              '번호이동', '기기변경', '자급제', '알뜰폰'],
    },
    {
      slug: 'card', page: '/card',
      words: ['신용카드', '체크카드', '카드', '캐시백', '연회비', '카드발급'],
    },
  ];

  // 못 알아들었을 때 보여줄 고르기. ROUTES 와 같은 순서다.
  var CHIPS = [
    { slug: 'internet', label: '인터넷·TV' },
    { slug: 'water', label: '정수기' },
    { slug: 'mobile', label: '휴대폰' },
    { slug: 'card', label: '카드' },
  ];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // 띄어쓰기와 대소문자를 지운 뒤 본다.
  // "인터넷 티비" 와 "인터넷티비" 가 같은 말인데 다르게 걸리면 안 된다.
  function norm(s) {
    return String(s == null ? '' : s).toLowerCase().replace(/\s+/g, '');
  }

  /**
   * 검색어를 카테고리 하나로 떨어뜨린다. 못 찾으면 null.
   *
   * 가장 긴 낱말이 이긴다
   *   "인터넷tv" 는 '인터넷' 에도 걸리고 '인터넷tv' 에도 걸린다. 먼저 걸린 것을 쓰면
   *   ROUTES 에 적은 순서가 결과를 정하게 된다 — 표를 늘릴 때마다 조용히 뒤집힌다.
   *   더 구체적인 말이 고객의 뜻에 가깝다.
   */
  function route(q) {
    var n = norm(q);
    if (!n) return null;
    var best = null;
    ROUTES.forEach(function (r) {
      r.words.forEach(function (w) {
        var k = norm(w);
        if (!k || n.indexOf(k) < 0) return;
        if (!best || k.length > best.len) best = { route: r, len: k.length, word: w };
      });
    });
    return best ? best.route : null;
  }

  function pageOf(slug) {
    var hit = ROUTES.filter(function (r) { return r.slug === slug; })[0];
    return hit ? hit.page : '/c/' + encodeURIComponent(slug);
  }

  /**
   * 그 카테고리 화면으로 보낸다. 도착하면 finder.js 가 결과부터 연다.
   *
   * 그 카테고리에 파인더가 아직 없으면 ?finder=result 는 아무 일도 안 한다.
   *   고객은 그냥 그 카테고리 화면을 보게 된다 — 빈 화면보다는 낫다.
   *   어드민에서 파인더를 만드는 순간 이 주소가 저절로 살아난다.
   */
  function go(slug, q) {
    var url = pageOf(slug) + '?finder=result';
    if (q) url += '&q=' + encodeURIComponent(q);
    window.location.href = url;
  }

  function render(slot) {
    slot.innerHTML =
      '<form class="ais" role="search" autocomplete="off">' +
      '<div class="ais-box">' +
      '<span class="ais-ico" aria-hidden="true">🔎</span>' +
      '<input class="ais-in" type="search" name="q" maxlength="60"' +
      ' placeholder="다픽 AI에게 무엇이든 물어보세요"' +
      ' aria-label="찾으시는 상품을 적어주세요" />' +
      '<button class="ais-go" type="submit" data-track="ai_search_submit">찾기</button>' +
      '</div>' +
      '<p class="ais-hint" role="status"></p>' +
      '<div class="ais-chips" hidden>' +
      CHIPS.map(function (c) {
        return '<button type="button" class="ais-chip" data-slug="' + esc(c.slug) + '"' +
          ' data-track="ai_search_chip">' + esc(c.label) + '</button>';
      }).join('') +
      '</div>' +
      '</form>';
  }

  function init() {
    var slot = document.getElementById('aiSearch');
    if (!slot) return;
    render(slot);

    var form = slot.querySelector('.ais');
    var input = slot.querySelector('.ais-in');
    var hint = slot.querySelector('.ais-hint');
    var chips = slot.querySelector('.ais-chips');

    function say(msg, showChips) {
      hint.textContent = msg || '';
      chips.hidden = !showChips;
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var q = String(input.value || '').trim();

      if (!q) {
        say('무엇을 찾으시는지 적어주세요.', true);
        input.focus();
        return;
      }

      var r = route(q);

      // 검색어를 GA4 로 함께 보낸다 (2026-08-10).
      // 조각 5 에서 서버에 쌓기 전까지, 고객이 실제로 뭐라고 묻는지 볼 수 있는 유일한 창이다.
      // 못 알아들은 말(matched 없음)이 특히 값지다 — 낱말표에 무엇이 빠졌는지 알려준다.
      if (typeof window.dpTrack === 'function') {
        window.dpTrack('ai_search', { search_term: q.slice(0, 100), matched: r ? r.slug : 'none' });
      }

      if (!r) {
        // 아무 데나 보내지 않는다. 엉뚱한 카테고리에서 신청하게 만드는 것보다
        //   "이 중에 있나요" 하고 되묻는 편이 낫다. (site-banner 의 #apply 판단과 같다)
        say('“' + q + '” 은 아직 못 알아들었습니다. 이 중에서 찾으시나요?', true);
        return;
      }

      say('찾고 있습니다…', false);
      go(r.slug, q);
    });

    chips.addEventListener('click', function (e) {
      var b = e.target && e.target.closest && e.target.closest('[data-slug]');
      if (!b) return;
      go(b.getAttribute('data-slug'), String(input.value || '').trim());
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // 검사에서 쓴다. 화면 코드는 이 이름을 부르지 않는다.
  window.dpAiSearch = { route: route, pageOf: pageOf, norm: norm };
})();
