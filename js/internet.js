// internet.js — 인터넷/TV 지원금 계산기 로직

// ── 데이터 ──────────────────────────────────────────────────────
const PROVIDERS = {
  SKT: {
    label: 'KT(SKT)',
    plans: [
      { id: 'skt-100', speed: 100, name: '광랜 인터넷', fee: 20350 },
      { id: 'skt-500', speed: 500, name: '기가슬림', fee: 24750, rec: true },
      { id: 'skt-1g', speed: 1e3, name: '기가 인터넷', fee: 28050 },
    ],
    support: {
      'skt-100': { solo: 110000, tv: 400000, tv_allp: 400000, mnp: 55000 },
      'skt-500': { solo: 170000, tv: 480000, tv_allp: 480000, mnp: 55000 },
      'skt-1g': { solo: 170000, tv: 480000, tv_allp: 480000, mnp: 55000 },
    },
  },
  SKB_RA: {
    label: 'SK브로드밴드',
    plans: [
      { id: 'ra-100', speed: 100, name: '광랜', fee: 20350 },
      { id: 'ra-500', speed: 500, name: '기가라이트', fee: 24750, rec: true },
      { id: 'ra-1g', speed: 1e3, name: '기가인터넷', fee: 28050 },
    ],
    support: {
      'ra-100': { solo: 110000, tv: 400000, tv_allp: 400000, mnp: 55000 },
      'ra-500': { solo: 170000, tv: 480000, tv_allp: 480000, mnp: 55000 },
      'ra-1g': { solo: 170000, tv: 480000, tv_allp: 480000, mnp: 55000 },
    },
  },
  SKB_HAN: {
    label: 'SK도매(한빛)',
    plans: [
      { id: 'han-100', speed: 100, name: '광랜', fee: 20350 },
      { id: 'han-500', speed: 500, name: '기가라이트', fee: 24750, rec: true },
      { id: 'han-1g', speed: 1e3, name: '기가인터넷', fee: 28050 },
    ],
    support: {
      'han-100': {
        solo: 0,
        tv: 247500,
        tv_allp: 247500,
        mnp: 55000,
        gift: 150000,
      },
      'han-500': {
        solo: 0,
        tv: 584500,
        tv_allp: 584500,
        mnp: 55000,
        gift: 200000,
      },
      'han-1g': {
        solo: 0,
        tv: 689500,
        tv_allp: 689500,
        mnp: 55000,
        gift: 200000,
      },
    },
  },
  SKB_YE: {
    label: 'SK도매(예스)',
    plans: [
      { id: 'ye-100', speed: 100, name: '광랜', fee: 20350 },
      { id: 'ye-500', speed: 500, name: '기가라이트', fee: 24750, rec: true },
      { id: 'ye-1g', speed: 1e3, name: '기가인터넷', fee: 28050 },
    ],
    support: {
      'ye-100': { solo: 264000, tv: 150000, tv_allp: 200000, mnp: 55000 },
      'ye-500': { solo: 433000, tv: 200000, tv_allp: 200000, mnp: 55000 },
      'ye-1g': { solo: 488000, tv: 200000, tv_allp: 200000, mnp: 55000 },
    },
  },
  SKB_LAX: {
    label: 'SK도매(LAX)',
    plans: [
      { id: 'lax-100', speed: 100, name: '광랜', fee: 20350 },
      { id: 'lax-500', speed: 500, name: '기가라이트', fee: 24750, rec: true },
      { id: 'lax-1g', speed: 1e3, name: '기가인터넷', fee: 28050 },
    ],
    support: {
      'lax-100': {
        solo: 0,
        tv: 150000,
        tv_allp: 200000,
        mnp: 55000,
        gi: 80000,
        gt: 120000,
      },
      'lax-500': {
        solo: 0,
        tv: 200000,
        tv_allp: 200000,
        mnp: 55000,
        gi: 80000,
        gt: 120000,
      },
      'lax-1g': {
        solo: 0,
        tv: 200000,
        tv_allp: 200000,
        mnp: 55000,
        gi: 80000,
        gt: 120000,
      },
    },
  },
  SKB_HH: {
    label: 'SK번들(HH)',
    plans: [
      { id: 'hh-500', speed: 500, name: '기가라이트', fee: 24750, rec: true },
      { id: 'hh-1g', speed: 1e3, name: '기가인터넷', fee: 28050 },
    ],
    support: {
      'hh-500': { solo: 0, tv: 730000, tv_allp: 780000, mnp: 0 },
      'hh-1g': { solo: 0, tv: 780000, tv_allp: 830000, mnp: 0 },
    },
  },
  LG: {
    label: 'LG U+',
    plans: [
      { id: 'lg-100', speed: 100, name: '광랜 인터넷', fee: 19800 },
      { id: 'lg-500', speed: 500, name: '기가 라이트', fee: 24200, rec: true },
      { id: 'lg-1g', speed: 1e3, name: '기가 인터넷', fee: 28600 },
    ],
    support: {
      'lg-100': { solo: 80000, tv: 300000, tv_allp: 350000, mnp: 50000 },
      'lg-500': { solo: 120000, tv: 400000, tv_allp: 450000, mnp: 50000 },
      'lg-1g': { solo: 150000, tv: 450000, tv_allp: 500000, mnp: 50000 },
    },
  },
  HCN: {
    label: 'HCN',
    plans: [
      { id: 'hcn-100', speed: 100, name: '베이직', fee: 19800 },
      { id: 'hcn-500', speed: 500, name: '스탠다드', fee: 24200, rec: true },
      { id: 'hcn-1g', speed: 1e3, name: '기가', fee: 28600 },
    ],
    support: {
      'hcn-100': { solo: 60000, tv: 200000, tv_allp: 250000, mnp: 30000 },
      'hcn-500': { solo: 100000, tv: 300000, tv_allp: 350000, mnp: 30000 },
      'hcn-1g': { solo: 130000, tv: 350000, tv_allp: 400000, mnp: 30000 },
    },
  },
};

const TV_PLANS = [
  { id: 'tv-eco', grade: '이코노미', ch: 193, fee: 13200 },
  { id: 'tv-std', grade: '스탠다드', ch: 214, fee: 17600 },
  { id: 'tv-all', grade: 'ALL', ch: 238, fee: 19800 },
  { id: 'tv-allp', grade: 'ALL+', ch: 263, fee: 22000 },
];

// ── 상태 ──
let state = {
  provider: null,
  planId: null,
  optPhone: false,
  optTv: false,
  tvGrade: null,
};
let detailOpen = false;

// ── 통신사 카드 초기 렌더 ──
(function initProviders() {
  const row = document.getElementById('prov-row');
  row.innerHTML = Object.keys(PROVIDERS)
    .map(
      (k) => `
    <div class="prov-card" id="pc-${k}" onclick="selectProvider('${k}', this)">
      <div class="prov-logo">
        <!-- 로고 교체: <img src="assets/logos/${k.toLowerCase()}.png" alt="${PROVIDERS[k].label}" class="plogo-img"> -->
        <div class="logo-placeholder">${PROVIDERS[k].label}</div>
      </div>
      <div class="prov-name">${PROVIDERS[k].label}</div>
    </div>`,
    )
    .join('');
})();

// ── 베스트 카드 클릭 → 계산기 자동 세팅 ──
function applyBest(pKey, planId, tvGrade) {
  document
    .querySelectorAll('.prov-card')
    .forEach((c) => c.classList.remove('selected'));
  const pc = document.getElementById('pc-' + pKey);
  if (pc) pc.classList.add('selected');

  state = {
    provider: pKey,
    planId: null,
    optPhone: false,
    optTv: !!tvGrade,
    tvGrade: tvGrade || null,
  };
  document
    .querySelectorAll('.opt-chip')
    .forEach((c) => c.classList.remove('checked'));
  if (tvGrade) document.getElementById('opt-tv').classList.add('checked');

  renderPlans(pKey);
  showStep('step-plan');

  setTimeout(() => {
    const el = document.getElementById('plan-' + planId);
    if (el) {
      el.classList.add('selected');
      state.planId = planId;
    }
    if (tvGrade) {
      renderTv();
      showStep('step-tv');
      setTimeout(() => {
        const tv = TV_PLANS.find((t) => t.grade === tvGrade);
        if (tv) {
          const e = document.getElementById('tv-' + tv.id);
          if (e) e.classList.add('selected');
        }
        updateBar();
      }, 50);
    } else {
      hideStep('step-tv');
      updateBar();
    }
    goTo('calc-section');
  }, 60);
}

// ── 통신사 선택 ──
function selectProvider(key, el) {
  document
    .querySelectorAll('.prov-card')
    .forEach((c) => c.classList.remove('selected'));
  el.classList.add('selected');
  state = {
    provider: key,
    planId: null,
    optPhone: false,
    optTv: false,
    tvGrade: null,
  };
  document
    .querySelectorAll('.opt-chip')
    .forEach((c) => c.classList.remove('checked'));
  renderPlans(key);
  showStep('step-plan');
  hideStep('step-tv');
  updateBar();
  closeDetail();
  goTo('step-plan');
}

// 로고 그리드에서 통신사 선택
function selectProviderByKey(key) {
  const el = document.getElementById('pc-' + key);
  if (el) selectProvider(key, el);
  goTo('calc-section');
}

// ── 요금제 렌더 ──
function renderPlans(key) {
  const prov = PROVIDERS[key];
  document.getElementById('plan-grid').innerHTML = prov.plans
    .map((p) => {
      const sup = prov.support[p.id];
      const maxS = Math.max(
        sup.solo || 0,
        (sup.tv_allp || 0) +
          (sup.gift || 0) +
          (sup.gi || 0) +
          (sup.gt || 0) +
          (sup.mnp || 0),
      );
      return `
    <div class="plan-card" id="plan-${p.id}" onclick="selectPlan('${p.id}')">
      ${p.rec ? '<div class="badge-rec">인기</div>' : ''}
      <div class="plan-spd">${p.speed < 1000 ? p.speed : '1'}<span> ${p.speed < 1000 ? 'Mbps' : 'Gbps'}</span></div>
      <div class="plan-nm">${p.name}</div>
      <div class="plan-fee">${p.fee.toLocaleString()}<span>원/월~</span></div>
      <div class="plan-gift">
        <div class="plan-gift-l">최대 지원금</div>
        <div class="plan-gift-v">최대 ${maxS.toLocaleString()}원</div>
      </div>
    </div>`;
    })
    .join('');
}

function selectPlan(id) {
  document
    .querySelectorAll('.plan-card')
    .forEach((c) => c.classList.remove('selected'));
  document.getElementById('plan-' + id).classList.add('selected');
  state.planId = id;
  state.tvGrade = null;
  state.optTv = false;
  document.getElementById('opt-tv').classList.remove('checked');
  hideStep('step-tv');
  updateBar();
}

// ── 옵션 토글 ──
function toggleOpt(elId, type) {
  if (!state.planId) return;
  const el = document.getElementById(elId);
  const on = el.classList.toggle('checked');
  if (type === 'phone') {
    state.optPhone = on;
  } else {
    state.optTv = on;
    if (on) {
      renderTv();
      showStep('step-tv');
      goTo('step-tv');
    } else {
      hideStep('step-tv');
      state.tvGrade = null;
    }
  }
  updateBar();
}

// ── TV 렌더 ──
function renderTv() {
  document.getElementById('tv-grid').innerHTML = TV_PLANS.map(
    (t) => `
    <div class="tv-card" id="tv-${t.id}" onclick="selectTv('${t.id}', '${t.grade}')">
      <div class="tv-ch">${t.ch}<span>CH</span></div>
      <div class="tv-gd">${t.grade}</div>
      <div class="tv-fee">${t.fee.toLocaleString()}원/월</div>
    </div>`,
  ).join('');
}

function selectTv(id, grade) {
  document
    .querySelectorAll('.tv-card')
    .forEach((c) => c.classList.remove('selected'));
  document.getElementById('tv-' + id).classList.add('selected');
  state.tvGrade = grade;
  updateBar();
}

// ── 지원금 / 요금 계산 ──
function getSupport() {
  if (!state.planId) return 0;
  const sup = PROVIDERS[state.provider].support[state.planId];
  let base = !state.optTv
    ? sup.solo || 0
    : state.tvGrade === 'ALL+'
      ? sup.tv_allp || sup.tv || 0
      : sup.tv || 0;
  if (state.optTv) {
    if (sup.gift) base += sup.gift;
    if (sup.gi) base += sup.gi;
    if (sup.gt) base += sup.gt;
  }
  if (state.optPhone) base += sup.mnp || 0;
  return base;
}

function getFee() {
  if (!state.planId) return 0;
  const plan = PROVIDERS[state.provider].plans.find(
    (p) => p.id === state.planId,
  );
  let fee = plan.fee;
  if (state.optTv && state.tvGrade) {
    const tv = TV_PLANS.find((t) => t.grade === state.tvGrade);
    if (tv) fee += tv.fee;
  }
  return fee;
}

// ── 플로팅 바 업데이트 ──
function updateBar() {
  if (!state.planId) {
    document.getElementById('floating-bar').classList.remove('show');
    closeDetail();
    return;
  }
  const prov = PROVIDERS[state.provider];
  const plan = prov.plans.find((p) => p.id === state.planId);

  const chips = [
    `<span class="bar-chip"><strong>${prov.label}</strong></span>`,
    `<span class="bar-chip">${plan.speed < 1000 ? plan.speed + 'M' : '1G'} ${plan.name}</span>`,
  ];
  if (state.optPhone) chips.push('<span class="bar-chip">휴대폰 결합</span>');
  if (state.optTv && state.tvGrade)
    chips.push(`<span class="bar-chip">TV ${state.tvGrade}</span>`);

  document.getElementById('bar-chips').innerHTML = chips.join('');
  document.getElementById('bar-fee').textContent = getFee().toLocaleString();
  document.getElementById('bar-gift').textContent =
    getSupport().toLocaleString();
  document.getElementById('floating-bar').classList.add('show');

  if (detailOpen) renderDetail();
}

// ── 상세 요금 패널 ──
function toggleDetail() {
  detailOpen = !detailOpen;
  const p = document.getElementById('detail-panel');
  const b = document.getElementById('btn-detail');
  if (detailOpen) {
    renderDetail();
    p.classList.add('open');
    b.classList.add('open');
  } else {
    p.classList.remove('open');
    b.classList.remove('open');
  }
}
function closeDetail() {
  detailOpen = false;
  document.getElementById('detail-panel').classList.remove('open');
  document.getElementById('btn-detail').classList.remove('open');
}

function renderDetail() {
  if (!state.planId) return;
  const prov = PROVIDERS[state.provider];
  const plan = prov.plans.find((p) => p.id === state.planId);
  const sup = prov.support[state.planId];
  const tv =
    state.optTv && state.tvGrade
      ? TV_PLANS.find((t) => t.grade === state.tvGrade)
      : null;

  const dr = (l, v, c) =>
    `<div class="drow"><span class="dl">${l}</span><span class="dv ${c}">${v}</span></div>`;

  // 월 요금 상세
  let fR = dr('인터넷 기본 요금', plan.fee.toLocaleString() + '원/월', '');
  if (tv)
    fR += dr(
      `TV (${tv.grade} ${tv.ch}CH)`,
      tv.fee.toLocaleString() + '원/월',
      '',
    );
  fR += `<div class="dtotal"><span class="dl">월 요금 합계</span><span class="dv gold">${getFee().toLocaleString()}원~</span></div>`;

  // 지원금 상세
  let sR = '';
  if (!state.optTv) {
    sR += dr(
      '인터넷 단독 지원금',
      (sup.solo || 0).toLocaleString() + '원',
      'green',
    );
  } else {
    const base =
      state.tvGrade === 'ALL+' ? sup.tv_allp || sup.tv || 0 : sup.tv || 0;
    sR += dr('인터넷+TV 기본 지원금', base.toLocaleString() + '원', 'green');
    if (sup.gift)
      sR += dr('본사 사은품', sup.gift.toLocaleString() + '원', 'green');
    if (sup.gi)
      sR += dr('인터넷 본사 사은품', sup.gi.toLocaleString() + '원', 'green');
    if (sup.gt)
      sR += dr('TV 본사 사은품', sup.gt.toLocaleString() + '원', 'green');
  }
  if (state.optPhone && sup.mnp)
    sR += dr(
      'MNP 번호이동 추가',
      '+' + sup.mnp.toLocaleString() + '원',
      'green',
    );
  sR += `<div class="dtotal"><span class="dl">최대 지원금 합계</span><span class="dv gold">${getSupport().toLocaleString()}원</span></div>`;

  document.getElementById('detail-inner').innerHTML = `
    <div class="detail-cols">
      <div><div class="d-col-title">💰 월 요금 상세</div>${fR}</div>
      <div><div class="d-col-title">🎁 지원금 상세</div>${sR}</div>
    </div>
    <div class="d-note">※ 실제 금액은 가입 조건·약정에 따라 다를 수 있습니다. 3년 약정 기준.</div>`;
}

// ── 상담 모달 열기 ──
function openConsultModal() {
  if (!state.planId) {
    openModal('선택하신 상품으로 최적의 혜택을 안내드립니다.');
    return;
  }
  const prov = PROVIDERS[state.provider];
  const plan = prov.plans.find((p) => p.id === state.planId);
  const tv =
    state.optTv && state.tvGrade
      ? TV_PLANS.find((t) => t.grade === state.tvGrade)
      : null;

  let s = `<strong>통신사</strong> ${prov.label}<br>`;
  s += `<strong>인터넷</strong> ${plan.speed < 1000 ? plan.speed + 'Mbps' : '1Gbps'} ${plan.name} — 월 ${plan.fee.toLocaleString()}원~<br>`;
  if (state.optPhone) s += `<strong>옵션</strong> 휴대폰 MNP 동시 개통<br>`;
  if (tv)
    s += `<strong>TV</strong> ${tv.grade} (${tv.ch}CH) — 월 ${tv.fee.toLocaleString()}원<br>`;
  s += `<strong style="color:var(--gold)">🎁 예상 최대 지원금 ${getSupport().toLocaleString()}원</strong>`;

  openModal(s);
}

// ── 초기화 ──
function resetAll() {
  state = {
    provider: null,
    planId: null,
    optPhone: false,
    optTv: false,
    tvGrade: null,
  };
  document
    .querySelectorAll('.prov-card, .plan-card, .tv-card')
    .forEach((c) => c.classList.remove('selected'));
  document
    .querySelectorAll('.opt-chip')
    .forEach((c) => c.classList.remove('checked'));
  hideStep('step-plan');
  hideStep('step-tv');
  document.getElementById('floating-bar').classList.remove('show');
  closeDetail();
}

// ── 유틸 ──
function showStep(id) {
  document.getElementById(id).classList.add('visible');
}
function hideStep(id) {
  document.getElementById(id).classList.remove('visible');
}
