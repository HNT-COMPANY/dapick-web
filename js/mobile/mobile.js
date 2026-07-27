// mobile.js — 다픽 휴대폰 페이지

// ══════════════════════════════════════════════════════
// 매장 데이터
// ──────────────────────────────────────────────────────
// 2026-07-25: 하드코딩 STORES 배열 → 백엔드 API(/api/stores) 조회로 전환.
// 매장 추가/수정/노출은 관리자 페이지 '휴대폰 매장 관리'에서 한다.
// 여기를 다시 고칠 일은 없다 — 고쳐야 하면 그건 API 스펙이 바뀐 것이다.
//
// 응답 필드명은 옛 배열과 일부러 맞춰뒀다:
//   id = slug(문자열 식별자) / mainImage = 간판 / detailUrl = 상세페이지 파일명
// 옛 필드 중 사라진 것: secretBenefit, images — 어디서도 렌더되지 않던 값이다.
// ══════════════════════════════════════════════════════
let STORES = [];
let storesLoaded = false; // 조회가 끝났는지 (실패해도 true)
let storesLoadError = null; // 실패 사유. 있으면 '매장 없음'이 아니라 '불러오기 실패'를 띄운다

async function loadStores() {
  // 응답이 오기 전에도 그리드를 한 번 그린다.
  // 안 그리면 조회가 느릴 때 빈 화면이 그대로 남는다.
  renderStores(currentRegion);
  try {
    const data = await api.get('/api/stores');
    STORES = Array.isArray(data) ? data : (data && data.content) || [];
    storesLoadError = null;
  } catch (e) {
    console.error('[mobile] 매장 목록 조회 실패', e);
    STORES = [];
    storesLoadError = e;
  } finally {
    storesLoaded = true;
    renderStores(currentRegion);
  }
}

// 관리자가 입력한 값이 그대로 innerHTML 로 들어가므로 무조건 이스케이프한다.
function mEsc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 모달 상태
let currentModalStoreId = null;
let kakaoMapSdkReady = false;

// ════════════════════════════════════════════════════
// 1. 지역 필터 — 탭 active 토글 + 카드 필터링
// ════════════════════════════════════════════════════
let currentRegion = 'ulsan';

function selectRegion(region, btnEl) {
  currentRegion = region;

  document.querySelectorAll('.m-region-tab').forEach((t) => {
    t.classList.toggle('active', t === btnEl);
  });

  renderStores(region);
}

// ════════════════════════════════════════════════════
// 2. 매장 카드 동적 렌더 (STORES 데이터 박힌 후 호출됨)
// ════════════════════════════════════════════════════
function renderStores(region) {
  const grid = document.getElementById('mStoreGrid');
  if (!grid) return;

  if (!storesLoaded) {
    grid.innerHTML = `<div class="m-store-empty">매장 정보를 불러오는 중입니다...</div>`;
    return;
  }

  if (storesLoadError) {
    grid.innerHTML = `
      <div class="m-store-empty">
        매장 정보를 불러오지 못했습니다.<br>
        잠시 후 새로고침해주세요.
      </div>`;
    return;
  }

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
    <div class="m-store-card" onclick="openStoreModal('${mEsc(s.id)}')">
      <div class="m-store-thumb">
        ${
          s.mainImage
            ? `<img src="${mEsc(s.mainImage)}" alt="${mEsc(s.name)}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
               <div class="m-store-thumb-fallback" style="display:none;">🏪</div>`
            : `<div class="m-store-thumb-fallback">🏪</div>`
        }
      </div>
      <div class="m-store-info">
        <div class="m-store-name">${mEsc(s.name)}</div>
        <div class="m-store-addr">${mEsc(s.address)}</div>
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
// 3. 지점안내 모달 — 열기 / 닫기 / 채우기
// ════════════════════════════════════════════════════
function openStoreModal(storeId) {
  const modal = document.getElementById('storeModal');
  if (!modal) return;

  currentModalStoreId = storeId;
  const store = STORES.find((s) => s.id === storeId);

  fillStoreModal(store);
  resetStoreMap();
  renderStoreMap(store);

  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('m-modal-open');
}

function closeStoreModal() {
  const modal = document.getElementById('storeModal');
  if (!modal) return;

  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('m-modal-open');
  currentModalStoreId = null;
}

function fillStoreModal(store) {
  const imgEl = document.getElementById('storeModalImage');
  const fallbackEl = document.getElementById('storeModalImageFallback');
  const nameEl = document.getElementById('storeModalName');
  const addrEl = document.getElementById('storeModalAddr');
  const hoursEl = document.getElementById('storeModalHours');
  const preconEl = document.getElementById('storeModalPrecon');
  const kakaoBtn = document.getElementById('storeModalKakao');
  const daangnEl = document.getElementById('storeModalDaangn');

  if (!store) {
    if (imgEl) imgEl.style.display = 'none';
    if (fallbackEl) {
      fallbackEl.style.display = 'flex';
      fallbackEl.textContent = '매장 정보 준비 중';
    }
    if (nameEl) nameEl.textContent = '매장 정보 준비 중';
    if (addrEl) addrEl.textContent = '-';
    if (hoursEl) hoursEl.textContent = '-';
    if (preconEl) preconEl.style.display = 'none';
    if (daangnEl) daangnEl.style.display = 'none';
    if (kakaoBtn) kakaoBtn.href = 'https://pf.kakao.com/_exaRjX/chat';
    return;
  }

  // 메인 이미지
  if (imgEl && fallbackEl) {
    if (store.mainImage) {
      imgEl.src = store.mainImage;
      imgEl.alt = store.name + ' 매장 사진';
      imgEl.style.display = 'block';
      fallbackEl.style.display = 'none';
      imgEl.onerror = () => {
        imgEl.style.display = 'none';
        fallbackEl.style.display = 'flex';
        fallbackEl.textContent = '매장 사진 준비 중';
      };
    } else {
      imgEl.style.display = 'none';
      fallbackEl.style.display = 'flex';
      fallbackEl.textContent = '매장 사진 준비 중';
    }
  }

  if (nameEl) nameEl.textContent = store.name || '-';
  if (addrEl) addrEl.textContent = store.address || '-';

  if (hoursEl) {
    const hours = store.hours || '-';
    const closed = store.closedDay ? ` · ${store.closedDay}` : '';
    hoursEl.textContent = `${hours}${closed}`;
  }

  if (preconEl) {
    if (store.preconUrl) {
      preconEl.href = store.preconUrl;
      preconEl.style.display = 'inline-flex';
    } else {
      preconEl.style.display = 'none';
    }
  }

  if (kakaoBtn) {
    kakaoBtn.href = store.kakaoChatUrl || 'https://pf.kakao.com/_exaRjX/chat';
  }

  // 당근 아이콘 (헤더 X 버튼 왼쪽) — daangnUrl 있으면 표시, 없으면 숨김
  if (daangnEl) {
    if (store.daangnUrl) {
      daangnEl.href = store.daangnUrl;
      daangnEl.style.display = 'flex';
    } else {
      daangnEl.style.display = 'none';
    }
  }
}

// 자세히 보기 → /store/{URL 식별자}
function goStoreDetail() {
  if (!currentModalStoreId) {
    alert('매장 정보가 준비되지 않았습니다.');
    return;
  }

  // 주소는 관리자 5단계 'URL 식별자'(slug) 하나로 정해진다.
  // 목록 API 의 id 가 곧 그 slug 다. 상세페이지 주소 칸은 안 쓴다.
  const store = STORES.find((s) => s.id === currentModalStoreId);
  const slug = store && store.id;
  if (slug) {
    window.location.href = '/store/' + encodeURIComponent(slug);
  } else {
    alert(
      '상세 페이지는 곧 오픈 예정입니다.\n\n' +
        '현재는 카카오톡으로 문의해주시면\n자세한 안내를 드립니다.',
    );
  }
}

// ESC 키로 모달 닫기
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const modal = document.getElementById('storeModal');
    if (modal && modal.classList.contains('is-open')) {
      closeStoreModal();
    }
  }
});

// ════════════════════════════════════════════════════
// 4. 카카오맵 — Lazy Load + 매장 위치 표시
// ════════════════════════════════════════════════════
function loadKakaoMapSdk() {
  return new Promise((resolve, reject) => {
    if (kakaoMapSdkReady) {
      resolve();
      return;
    }
    if (typeof kakao === 'undefined' || !kakao.maps) {
      reject(new Error('카카오 SDK 스크립트 로드 실패 (도메인/키 확인 필요)'));
      return;
    }
    kakao.maps.load(() => {
      kakaoMapSdkReady = true;
      resolve();
    });
  });
}

function resetStoreMap() {
  const mapEl = document.getElementById('storeModalMap');
  if (!mapEl) return;
  mapEl.innerHTML =
    '<div class="m-modal-map-fallback" id="storeModalMapFallback">지도 로딩 중...</div>';
}

async function renderStoreMap(store) {
  const mapEl = document.getElementById('storeModalMap');
  if (!mapEl || !store) return;

  try {
    await loadKakaoMapSdk();

    if (typeof store.lat === 'number' && typeof store.lng === 'number') {
      drawStoreMap(mapEl, store.lat, store.lng, store.name);
      return;
    }

    if (store.address) {
      const geocoder = new kakao.maps.services.Geocoder();
      geocoder.addressSearch(store.address, (result, status) => {
        if (
          status === kakao.maps.services.Status.OK &&
          result &&
          result.length > 0
        ) {
          const lat = parseFloat(result[0].y);
          const lng = parseFloat(result[0].x);
          drawStoreMap(mapEl, lat, lng, store.name);
        } else {
          showMapError('주소를 찾을 수 없습니다.');
        }
      });
      return;
    }

    showMapError('지도를 표시할 수 없습니다.');
  } catch (err) {
    console.error('카카오맵 로드 실패:', err);
    showMapError('지도를 불러올 수 없습니다.');
  }
}

function drawStoreMap(container, lat, lng, name) {
  const fallback = container.querySelector('.m-modal-map-fallback');
  if (fallback) fallback.remove();

  const center = new kakao.maps.LatLng(lat, lng);
  const map = new kakao.maps.Map(container, {
    center: center,
    level: 3,
  });

  const marker = new kakao.maps.Marker({
    position: center,
    map: map,
  });

  if (name) {
    const infowindow = new kakao.maps.InfoWindow({
      content: `<div style="padding:6px 10px; font-size:12px; font-weight:700; color:#1a1a1a;">${name}</div>`,
    });
    infowindow.open(map, marker);
  }

  setTimeout(() => map.relayout(), 100);
}

function showMapError(msg) {
  const fallbackEl = document.getElementById('storeModalMapFallback');
  if (fallbackEl) {
    fallbackEl.style.display = 'flex';
    fallbackEl.textContent = msg;
  }
}

// ════════════════════════════════════════════════════
// 5. 페이지 이동 — water.js의 goPage 패턴 통일
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
// 7. 초기 렌더 — 첫 탭 자동 active + 매장 API 조회 + 페이드업 초기화
// ════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  const activeTab = document.querySelector(
    `.m-region-tab[data-region="${currentRegion}"]`,
  );
  if (activeTab) activeTab.classList.add('active');

  loadStores();
  initFadeUp();
  initHeroTextRepeat();
});

// ════════════════════════════════════════════════════
// 8. 스크롤 페이드 업 애니메이션 (반복 재생, unobserve 금지)
// ════════════════════════════════════════════════════
function initFadeUp() {
  const targets = document.querySelectorAll('.m-fade-up');
  if (!targets.length || !('IntersectionObserver' in window)) return;

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
        } else {
          entry.target.classList.remove('is-visible');
        }
      });
    },
    {
      threshold: 0.15,
      rootMargin: '0px 0px -60px 0px',
    },
  );

  targets.forEach((t) => io.observe(t));
}

// ════════════════════════════════════════════════════
// 9. HERO 텍스트 순차 등장 (반복 재생, unobserve 금지 — 협업룰 §9)
// ════════════════════════════════════════════════════
function initHeroTextRepeat() {
  const targets = document.querySelectorAll(
    '.m-hero-title, .m-hero-sub, .m-hero-visual',
  );
  if (!targets.length || !('IntersectionObserver' in window)) return;

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-animating');
        } else {
          entry.target.classList.remove('is-animating');
        }
      });
    },
    {
      threshold: 0.3,
      rootMargin: '0px 0px -50px 0px',
    },
  );

  targets.forEach((t) => io.observe(t));
}
