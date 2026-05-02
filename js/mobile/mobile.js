// mobile.js — 다픽 휴대폰 페이지
// ── 매장 데이터 (placeholder, 지혁님이 데이터 받으면 채움) ──
// 예시 구조:
// {
//   id: 'sindorim',
//   region: 'seoul',           // 'seoul' | 'busan' | 'ulsan'
//   name: '서울 신도림직영점',
//   address: '서울 구로구 새말로 97',
//   phone: '02-852-3504',
//   hours: '11:00~20:00 (일 휴무, 공휴일 영업)',
//   thumbnail: 'assets/stores/sindorim.png',
//   badge: 'NEW',              // 'NEW' | 'READY' | null
//   lat: 37.5089, lng: 126.8916,
//   kakaoChatUrl: 'https://pf.kakao.com/_exaRjX/chat',
//   naverReserveUrl: '',
// }
const STORES = [
  // 매장 데이터를 여기에 박으세요. 비어있으면 placeholder 카드가 그대로 표시됩니다.
];

// ════════════════════════════════════════════════════
// 1. 지역 필터 — 탭 active 토글 + 카드 필터링
// ════════════════════════════════════════════════════
let currentRegion = 'seoul';

function selectRegion(region, btnEl) {
  currentRegion = region;

  document.querySelectorAll('.m-region-tab').forEach((t) => {
    t.classList.toggle('active', t === btnEl);
  });

  if (STORES.length > 0) {
    renderStores(region);
  }
}

// ════════════════════════════════════════════════════
// 2. 매장 카드 동적 렌더 (STORES 데이터 박힌 후 호출됨)
// ════════════════════════════════════════════════════
function renderStores(region) {
  const grid = document.getElementById('mStoreGrid');
  if (!grid) return;

  const filtered = STORES.filter((s) => s.region === region);

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="m-store-empty">
        해당 지역에 등록된 매장이 없습니다.<br>
        곧 오픈 예정이니 카카오톡으로 문의해주세요.
      </div>`;
    return;
  }

  grid.innerHTML = filtered
    .map(
      (s) => `
    <div class="m-store-card" onclick="openStoreModal('${s.id}')">
      <div class="m-store-thumb">
        ${
          s.thumbnail
            ? `<img src="${s.thumbnail}" alt="${s.name}">`
            : `<div class="m-store-thumb-fallback">🏪</div>`
        }
      </div>
      <div class="m-store-info">
        <div class="m-store-name">${s.name}</div>
        <div class="m-store-addr">${s.address}</div>
      </div>
      ${s.badge === 'NEW' ? '<span class="m-store-badge m-store-badge--new">NEW</span>' : ''}
      ${s.badge === 'READY' ? '<span class="m-store-badge m-store-badge--ready">오픈 예정</span>' : ''}
      <span class="m-store-arrow">›</span>
    </div>
  `,
    )
    .join('');
}

// ════════════════════════════════════════════════════
// 3. 매장 카드 클릭 — 지점안내 모달 (현재 placeholder)
// ════════════════════════════════════════════════════
function openStoreModal(storeId) {
  const store = STORES.find((s) => s.id === storeId);

  if (!store) {
    alert(
      '매장 상세 정보 페이지는 곧 오픈 예정입니다.\n\n' +
        '카카오톡으로 문의해주시면\n전국 다폰 매장 정보 안내드립니다.',
    );
    return;
  }

  // TODO: 매장 데이터 박힌 후 카카오 지도 + 모달 박기
  alert(
    `${store.name}\n\n` +
      `📍 ${store.address}\n` +
      `📞 ${store.phone}\n` +
      `🕐 ${store.hours}`,
  );
}

// ════════════════════════════════════════════════════
// 4. 페이지 이동 — water.js의 goPage 패턴 통일
// ════════════════════════════════════════════════════
function goPage(page) {
  const map = {
    mobile: 'mobile.html',
    internet: 'internet.html',
    card: 'card.html',
    water: 'water.html',
    rental: 'rental.html',
  };
  window.location.href = map[page] || 'index.html';
}

// ════════════════════════════════════════════════════
// 5. scroll-top 버튼 토글
// ════════════════════════════════════════════════════
window.addEventListener(
  'scroll',
  () => {
    const btn = document.getElementById('scroll-top');
    if (btn) btn.classList.toggle('show', window.scrollY > 300);
  },
  { passive: true },
);

// ════════════════════════════════════════════════════
// 6. 초기 렌더 (STORES 데이터 박힌 경우만)
// ════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  if (STORES.length > 0) {
    renderStores(currentRegion);
  }
});
