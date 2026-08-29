//
// store-detail.js — 매장 상세 페이지(store-detail.html) 렌더
//
// 손으로 만든 store-*.html 7개를 대체한다.
// 본문은 전부 stores 테이블 + stores.detail_json 에서 온다.
// 관리자 '휴대폰 매장 관리' 6단계에서 채운 값이 그대로 여기로 나온다.
//
// 이 파일의 sdSec* 함수들은 _worker.js 의 같은 이름 함수와
//    '똑같은 HTML' 을 만들어야 한다.
//    운영에서는 worker 가 먼저 채워 넣고(네이버 Yeti 는 JS 를 안 돌린다),
//    이 파일은 worker 가 없는 자리(로컬 Live Server, 직접 열기)에서만 돈다.
//    한쪽만 고치면 봇이 보는 화면과 사람이 보는 화면이 갈린다.
//
// 관리자 미리보기(dapick-admin/js/store.js stRenderPreview)도 같은 마크업이다.
// 셋이 어긋나면 미리보기가 거짓말을 하게 된다.
//

// 관리자가 입력한 값이 그대로 innerHTML 로 들어가므로 무조건 이스케이프한다.
// (dapick-web 에는 공용 escapeHtml 이 없다. mobile.js 의 mEsc 와 같은 규칙)
function sdEsc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* 주소가 /store/{slug} 라 상대경로가 /store/assets/... 로 샌다.
   DB 에 'assets/store/...' 처럼 들어온 값은 앞에 / 를 붙여 뿌리 기준으로 만든다.
   http(s):// · // · data: 로 시작하면 그대로 둔다. */
function sdAsset(u) {
  const v = String(u == null ? '' : u).trim();
  if (!v) return '';
  if (/^(https?:)?\/\//.test(v) || /^data:/.test(v)) return v;
  return '/' + v.replace(/^\/+/, '');
}

function sdBadgeLabel(v) {
  if (v === 'NEW') return 'NEW';
  if (v === 'READY') return '오픈 예정';
  return '';
}

// ── 조각별 HTML — worker 와 1:1 로 같아야 하는 함수들 ─────────────

function sdSecTitleRow(s) {
  const badge = sdBadgeLabel(s.badge);
  return '<h1 class="store-page-title">' + sdEsc(s.name) + '</h1>' +
    (badge ? '<span class="store-page-badge">' + sdEsc(badge) + '</span>' : '');
}

function sdSecHero(s) {
  if (!s.mainImage) return '';
  return '<img src="' + sdEsc(sdAsset(s.mainImage)) + '" alt="' + sdEsc(s.name) +
    ' 외관" class="store-hero-img" />';
}

function sdInfoRow(key, val) {
  return '<li class="store-info-row">' +
    '<span class="store-info-key">' + sdEsc(key) + '</span>' +
    '<span class="store-info-val">' + sdEsc(val) + '</span></li>';
}

function sdSecInfo(s) {
  let h = '';
  if (s.address) h += sdInfoRow('주소', s.address);
  if (s.phone) {
    h += '<li class="store-info-row">' +
      '<span class="store-info-key">전화</span>' +
      '<a href="tel:' + sdEsc(s.phone) + '" class="store-info-val store-info-val--link">' +
      sdEsc(s.phone) + '</a></li>';
  }
  if (s.hours) h += sdInfoRow('영업시간', s.hours);
  if (s.closedDay) h += sdInfoRow('휴무', s.closedDay);
  return h;
}

/* 앞부분 + 굵은 글씨 + 뒷부분 붙이는 규칙.
   앞부분이 줄바꿈으로 끝나면 굵은 글씨가 다음 줄로, 아니면 한 칸 띄고 이어 붙는다.
   (관리자 미리보기 stPrevIntro 와 같은 규칙) */
function sdSecIntro(intro) {
  intro = intro || {};
  const lead = intro.lead || '';
  const strong = intro.strong || '';
  const tail = intro.tail || '';
  if (!lead && !strong && !tail) return '';
  let h = sdEsc(lead).replace(/\n/g, '<br />');
  if (strong) {
    if (h && !/<br \/>$/.test(h)) h += ' ';
    h += '<strong>' + sdEsc(strong) + '</strong>';
  }
  return h + sdEsc(tail);
}

function sdSecDesc(paragraphs) {
  const ps = paragraphs || [];
  if (!ps.length) return '';
  return ps.map(function (p) {
    return '<p>' + sdEsc(p).replace(/\n/g, '<br />') + '</p>';
  }).join('');
}

function sdSecChecklist(cl) {
  cl = cl || {};
  const items = cl.items || [];
  if (!cl.icon && !cl.title && !items.length) return '';
  return '<div class="store-checklist-head">' +
      '<span class="store-checklist-icon">' + sdEsc(cl.icon || '📱') + '</span>' +
      '<span class="store-checklist-title">' + sdEsc(cl.title || '') + '</span>' +
    '</div>' +
    (items.length
      ? '<ul class="store-checklist-items">' +
          items.map(function (t) { return '<li>' + sdEsc(t) + '</li>'; }).join('') +
        '</ul>'
      : '');
}

function sdSecFeatures(features) {
  const fs = features || [];
  if (!fs.length) return '';
  return fs.map(function (f) {
    return '<div class="store-feature">' +
        '<span class="store-feature-icon">' + sdEsc(f.icon || '📍') + '</span>' +
        '<div class="store-feature-body">' +
          '<div class="store-feature-label">' + sdEsc(f.label || '') + '</div>' +
          '<div class="store-feature-desc">' + sdEsc(f.desc || '') + '</div>' +
        '</div>' +
      '</div>';
  }).join('');
}

// 설명(alt)이 비면 지점명으로 채운다. 관리자 미리보기도 같은 규칙이다.
function sdSecGallery(gallery, name) {
  const gs = (gallery || []).filter(function (g) { return g && g.url; });
  if (!gs.length) return '';
  return gs.map(function (g) {
    const url = sdEsc(sdAsset(g.url));
    return '<a class="store-gallery-item" href="' + url + '" target="_blank" rel="noopener">' +
      '<img src="' + url + '" alt="' + sdEsc(g.alt || name) + '" loading="lazy" /></a>';
  }).join('');
}

function sdLink(cls, iconHtml, label, desc, href) {
  return '<a class="store-link ' + cls + '" href="' + sdEsc(href) +
    '" target="_blank" rel="noopener">' + iconHtml +
    '<div class="store-link-body">' +
      '<div class="store-link-label">' + sdEsc(label) + '</div>' +
      '<div class="store-link-desc">' + sdEsc(desc) + '</div>' +
    '</div>' +
    '<span class="store-link-arrow">›</span></a>';
}

function sdSecLinks(s) {
  let h = '';
  if (s.preconUrl) {
    h += sdLink('store-link--precon',
      '<img src="/assets/badges/precon.png" alt="" class="store-link-icon" />',
      '이동통신 사전승낙 판매점', '정식 등록 인증 확인', s.preconUrl);
  }
  if (s.preconAlttulUrl) {
    h += sdLink('store-link--precon',
      '<img src="/assets/badges/precon.png" alt="" class="store-link-icon" />',
      '알뜰폰 판매점 사전승낙', '정식 등록 인증 확인', s.preconAlttulUrl);
  }
  if (s.daangnUrl) {
    h += sdLink('store-link--daangn', '<span class="store-link-emoji">🥕</span>',
      '당근 채널', '동네 후기 + 당근에서 바로 문의', s.daangnUrl);
  }
  if (s.naverPlaceUrl) {
    h += sdLink('store-link--naver', '<span class="store-link-emoji">🗺️</span>',
      '네이버 플레이스', '네이버 지도에서 길찾기 + 후기', s.naverPlaceUrl);
  }
  return h;
}

function sdSecCta(s) {
  let h = '';
  if (s.address) {
    h += '<a class="store-cta-btn store-cta-btn--map" href="https://map.kakao.com/link/search/' +
      sdEsc(encodeURIComponent(s.address)) +
      '" target="_blank" rel="noopener">매장 간편 길찾기</a>';
  }
  h += '<a class="store-cta-btn store-cta-btn--kakao" href="' +
    sdEsc(s.kakaoChatUrl || 'https://pf.kakao.com/_exaRjX/chat') +
    '" target="_blank" rel="noopener">카카오 채널 상담</a>';
  return h;
}

// og:description / meta description 에 쓸 한 줄.
// worker 도 같은 규칙으로 만든다.
function sdMetaDesc(s) {
  const d = s.detail || {};
  const raw = d.tagline || s.description || (d.paragraphs && d.paragraphs[0]) || '';
  const parts = [];
  if (s.name) parts.push(s.name);
  if (s.address) parts.push(s.address);
  if (raw) parts.push(raw);
  return parts.join(' - ').replace(/\s+/g, ' ').trim().slice(0, 150);
}

// ── DOM 채우기 ──────────────────────────────────────────────────

function sdFill(sel, html) {
  const el = document.querySelector(sel);
  if (!el) return false;
  if (!html) return false;
  el.innerHTML = html;
  el.hidden = false;
  return true;
}

function sdShowSec(name, on) {
  const el = document.querySelector('[data-ssr-sec="' + name + '"]');
  if (el) el.hidden = !on;
}

function sdRender(s) {
  const d = s.detail || {};

  document.title = s.name + ' | 다픽 인증 휴대폰 매장';
  const desc = sdMetaDesc(s);
  const setMeta = function (sel, v) {
    const el = document.querySelector(sel);
    if (el) el.setAttribute('content', v);
  };
  setMeta('meta[name="description"]', desc);
  setMeta('meta[property="og:title"]', s.name + ' | 다픽 인증 휴대폰 매장');
  setMeta('meta[property="og:description"]', desc);
  if (s.mainImage) setMeta('meta[property="og:image"]', s.mainImage);

  sdFill('[data-ssr="titlerow"]', sdSecTitleRow(s));
  sdFill('[data-ssr="tagline"]', sdEsc(d.tagline || s.description || ''));
  sdFill('[data-ssr="hero"]', sdSecHero(s));
  sdFill('[data-ssr="info"]', sdSecInfo(s));

  const intro = sdSecIntro(d.intro);
  const body = sdSecDesc(d.paragraphs);
  const cl = sdSecChecklist(d.checklist);
  const feat = sdSecFeatures(d.features);
  sdFill('[data-ssr="intro"]', intro);
  sdFill('[data-ssr="desc"]', body);
  sdFill('[data-ssr="checklist"]', cl);
  sdFill('[data-ssr="features"]', feat);
  sdShowSec('about', !!(intro || body || cl || feat));

  const gal = sdSecGallery(d.gallery, s.name);
  sdFill('[data-ssr="gallery"]', gal);
  sdShowSec('gallery', !!gal);

  const links = sdSecLinks(s);
  sdFill('[data-ssr="links"]', links);
  sdShowSec('links', !!links);

  sdFill('[data-ssr="cta"]', sdSecCta(s));
  sdShowSec('cta', true);

  const map = document.getElementById('storeDetailMap');
  if (map) {
    map.setAttribute('data-address', s.address || '');
    map.setAttribute('data-name', s.name || '');
  }
}

// ── 어느 매장인가 ───────────────────────────────────────────────
//   기준은 하나뿐이다: 관리자 5단계 'URL 식별자'(stores.slug).
//   운영: /store/dapon-byeongyeong
//   로컬: store-detail.html?id=dapon-byeongyeong
//   상세페이지 주소(detailUrl)는 안 쓴다.
function sdTarget() {
  const q = new URLSearchParams(location.search).get('id');
  if (q) return { slug: q };
  const m = location.pathname.match(/^\/store\/([A-Za-z0-9_-]{1,60})\/?$/);
  if (m) return { slug: m[1] };
  return null; // 틀 자체를 연 것
}

async function sdLoad() {
  const t = sdTarget();
  if (!t) {
    sdFail('어느 매장인지 알 수 없습니다.', '주소를 확인해주세요.');
    return;
  }
  try {
    const s = await api.get('/api/stores/' + encodeURIComponent(t.slug));
    if (!s) {
      sdFail('매장을 찾을 수 없습니다.', '주소가 바뀌었거나 노출이 중지된 매장일 수 있습니다.');
      return;
    }
    sdRender(s);
    sdInitMap();
  } catch (e) {
    console.error('[store-detail] 매장 조회 실패', e);
    sdFail('매장 정보를 불러오지 못했습니다.', '잠시 후 다시 시도해주세요.');
  }
}

function sdFail(title, desc) {
  const box = document.getElementById('storeDetailFail');
  if (!box) return;
  box.innerHTML = '<div class="store-wrap"><h1 class="store-page-title">' + sdEsc(title) +
    '</h1><p class="store-page-tagline">' + sdEsc(desc) +
    '</p><p class="store-page-tagline"><a href="/mobile">매장 안내로 돌아가기</a></p></div>';
  box.hidden = false;
}

// ── 카카오맵 — 주소 → 좌표 변환 (좌표를 DB 에 두지 않는 이유) ──────
function sdInitMap() {
  const container = document.getElementById('storeDetailMap');
  if (!container) return;
  const address = container.getAttribute('data-address');
  const name = container.getAttribute('data-name') || '';
  if (!address) return;

  if (typeof kakao === 'undefined' || !kakao.maps) {
    console.warn('[store-detail] 카카오맵 SDK 로드 실패');
    return;
  }

  kakao.maps.load(function () {
    const geocoder = new kakao.maps.services.Geocoder();
    geocoder.addressSearch(address, function (result, status) {
      if (status !== kakao.maps.services.Status.OK) {
        console.warn('[store-detail] 주소 검색 실패:', address);
        container.innerHTML = '<div class="store-map-fallback">지도를 불러올 수 없습니다.</div>';
        return;
      }

      const coords = new kakao.maps.LatLng(result[0].y, result[0].x);
      const map = new kakao.maps.Map(container, { center: coords, level: 3 });

      const fb = container.querySelector('.store-map-fallback');
      if (fb) fb.remove();

      new kakao.maps.Marker({ position: coords, map: map });

      const infowindow = new kakao.maps.InfoWindow({
        content: '<div style="padding:6px 10px;font-size:12px;font-weight:700;color:#1a1a1a;">' +
          sdEsc(name) + '</div>',
        removable: false,
      });
      infowindow.open(map, new kakao.maps.Marker({ position: coords }));

      setTimeout(function () { map.relayout(); }, 100);
    });
  });
}

// ── 시작 ────────────────────────────────────────────────────────
// worker 가 이미 본문을 채워 넣었으면(<html data-ssr="1">) 다시 그리지 않는다.
// 봇이 본 화면과 사람이 본 화면이 달라지면 안 되고, API 를 두 번 부를 이유도 없다.
function sdBoot() {
  if (document.documentElement.getAttribute('data-ssr') === '1') {
    sdInitMap();
    return;
  }
  sdLoad();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', sdBoot);
} else {
  sdBoot();
}
