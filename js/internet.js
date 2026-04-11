// internet.js — 인터넷/TV 지원금 계산기 (6개 통신사 완전 분리)

const PROVIDERS = {
  // ── SKT ─────────────────────────────────────────────────────
  SKT: {
    label: 'SKT',
    color: '#E51B1B',
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

  // ── KT ──────────────────────────────────────────────────────
  KT: {
    label: 'KT',
    color: '#E31837',
    plans: [
      { id: 'kt-100', speed: 100, name: '인터넷 에센스', fee: 20900 },
      { id: 'kt-500', speed: 500, name: '기가 인터넷', fee: 26400, rec: true },
      { id: 'kt-1g', speed: 1e3, name: '기가 프리미엄', fee: 33000 },
    ],
    support: {
      'kt-100': { solo: 100000, tv: 350000, tv_allp: 380000, mnp: 50000 },
      'kt-500': { solo: 160000, tv: 450000, tv_allp: 480000, mnp: 50000 },
      'kt-1g': { solo: 160000, tv: 500000, tv_allp: 530000, mnp: 50000 },
    },
  },

  // ── LG U+ ───────────────────────────────────────────────────
  LG: {
    label: 'LG U+',
    color: '#E5007D',
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

  // ── LG HelloVision ──────────────────────────────────────────
  LG_HELLO: {
    label: 'LG HelloVision',
    color: '#7B2D8B',
    plans: [
      { id: 'hello-100', speed: 100, name: '베이직', fee: 18700 },
      { id: 'hello-500', speed: 500, name: '스탠다드', fee: 22000, rec: true },
      { id: 'hello-1g', speed: 1e3, name: '기가 프리', fee: 26400 },
    ],
    support: {
      'hello-100': { solo: 70000, tv: 250000, tv_allp: 300000, mnp: 40000 },
      'hello-500': { solo: 110000, tv: 350000, tv_allp: 400000, mnp: 40000 },
      'hello-1g': { solo: 140000, tv: 400000, tv_allp: 450000, mnp: 40000 },
    },
  },

  // ── SK broadband ────────────────────────────────────────────
  SKB: {
    label: 'SK broadband',
    color: '#0078C8',
    plans: [
      { id: 'skb-100', speed: 100, name: '광랜', fee: 20350 },
      { id: 'skb-500', speed: 500, name: '기가라이트', fee: 24750, rec: true },
      { id: 'skb-1g', speed: 1e3, name: '기가인터넷', fee: 28050 },
    ],
    support: {
      'skb-100': { solo: 110000, tv: 400000, tv_allp: 400000, mnp: 55000 },
      'skb-500': { solo: 170000, tv: 480000, tv_allp: 480000, mnp: 55000 },
      'skb-1g': { solo: 170000, tv: 480000, tv_allp: 480000, mnp: 55000 },
    },
  },

  // ── KT Skylife ──────────────────────────────────────────────
  KT_SKYLIFE: {
    label: 'KT Skylife',
    color: '#003087',
    plans: [
      { id: 'sky-100', speed: 100, name: '라이트', fee: 19800 },
      { id: 'sky-500', speed: 500, name: '스탠다드', fee: 24200, rec: true },
      { id: 'sky-1g', speed: 1e3, name: '프리미엄', fee: 29700 },
    ],
    support: {
      'sky-100': { solo: 90000, tv: 320000, tv_allp: 360000, mnp: 45000 },
      'sky-500': { solo: 140000, tv: 420000, tv_allp: 460000, mnp: 45000 },
      'sky-1g': { solo: 150000, tv: 460000, tv_allp: 500000, mnp: 45000 },
    },
  },
};

const TV_PLANS = [
  { id: 'tv-eco', grade: '이코노미', ch: 193, fee: 13200 },
  { id: 'tv-std', grade: '스탠다드', ch: 214, fee: 17600 },
  { id: 'tv-all', grade: 'ALL', ch: 238, fee: 19800 },
  { id: 'tv-allp', grade: 'ALL+', ch: 263, fee: 22000 },
];

// ── 상태 ──────────────────────────────────────────────────────
let state = {
  provider: null,
  planId: null,
  optPhone: false,
  optTv: false,
  tvGrade: null,
};
let detailOpen = false;

// ── Step 표시/숨김 ────────────────────────────────────────────
function showStep(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('visible');
  setTimeout(() => {
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 200);
}

function hideStep(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('visible');
}

// ── 통신사 선택 ───────────────────────────────────────────────
function selectProviderByKey(key, cardEl) {
  document
    .querySelectorAll('.plogo-card')
    .forEach((c) => c.classList.remove('selected'));
  if (cardEl) cardEl.classList.add('selected');

  state = {
    provider: key,
    planId: null,
    optPhone: false,
    optTv: false,
    tvGrade: null,
  };
  document
    .querySelectorAll('.opt-btn')
    .forEach((c) => c.classList.remove('checked'));

  const prov = PROVIDERS[key];
  if (!prov) return;

  const titleEl = document.getElementById('calc-provider-title');
  if (titleEl) titleEl.textContent = `${prov.label} 인터넷 요금제`;

  renderPlans(key);
  showStep('step-plan');
  hideStep('step-options');
  hideStep('step-tv');

  updateBar();
  closeDetail();
}

// ── 베스트 카드 클릭 → 자동 세팅 ────────────────────────────
function applyBest(pKey, planId, tvGrade) {
  document
    .querySelectorAll('.plogo-card')
    .forEach((c) => c.classList.remove('selected'));
  const logoEl = document.getElementById('logo-' + pKey);
  if (logoEl) logoEl.classList.add('selected');

  state = {
    provider: pKey,
    planId: null,
    optPhone: false,
    optTv: !!tvGrade,
    tvGrade: tvGrade || null,
  };
  document
    .querySelectorAll('.opt-btn')
    .forEach((c) => c.classList.remove('checked'));
  if (tvGrade) {
    const tvBtn = document.getElementById('opt-tv');
    if (tvBtn) tvBtn.classList.add('checked');
  }

  const prov = PROVIDERS[pKey];
  if (!prov) return;
  const titleEl = document.getElementById('calc-provider-title');
  if (titleEl) titleEl.textContent = `${prov.label} 인터넷 요금제`;

  renderPlans(pKey);
  showStep('step-plan');
  hideStep('step-options');
  hideStep('step-tv');

  setTimeout(() => {
    const planEl = document.getElementById('plan-' + planId);
    if (planEl) {
      planEl.classList.add('selected');
      state.planId = planId;
    }
    showStep('step-options');

    if (tvGrade) {
      renderTv();
      showStep('step-tv');
      setTimeout(() => {
        const tv = TV_PLANS.find((t) => t.grade === tvGrade);
        if (tv) {
          const tvEl = document.getElementById('tv-' + tv.id);
          if (tvEl) tvEl.classList.add('selected');
          state.tvGrade = tvGrade;
        }
        updateBar();
      }, 50);
    } else {
      updateBar();
    }
    goTo('calc-section');
  }, 80);
}

// ── 요금제 렌더 ──────────────────────────────────────────────
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

// ── 요금제 선택 → Step 3 자동 표시 ──────────────────────────
function selectPlan(id) {
  document
    .querySelectorAll('.plan-card')
    .forEach((c) => c.classList.remove('selected'));
  document.getElementById('plan-' + id).classList.add('selected');
  state.planId = id;
  state.tvGrade = null;
  state.optTv = false;

  const tvBtn = document.getElementById('opt-tv');
  if (tvBtn) tvBtn.classList.remove('checked');
  hideStep('step-tv');

  showStep('step-options');
  updateBar();
}

// ── 결합 옵션 토글 ────────────────────────────────────────────
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
    } else {
      hideStep('step-tv');
      state.tvGrade = null;
    }
  }
  updateBar();
}

// ── TV 렌더 ──────────────────────────────────────────────────
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

// ── 지원금 / 요금 계산 ───────────────────────────────────────
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

// ── 플로팅 바 업데이트 ──────────────────────────────────────
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

// ── 상세 요금 패널 ──────────────────────────────────────────
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

  let fR = dr('인터넷 기본 요금', plan.fee.toLocaleString() + '원/월', '');
  if (tv)
    fR += dr(
      `TV (${tv.grade} ${tv.ch}CH)`,
      tv.fee.toLocaleString() + '원/월',
      '',
    );
  fR += `<div class="dtotal"><span class="dl">월 요금 합계</span><span class="dv gold">${getFee().toLocaleString()}원~</span></div>`;

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
      <div><div class="d-col-title">월 요금 상세</div>${fR}</div>
      <div><div class="d-col-title">지원금 상세</div>${sR}</div>
    </div>
    <div class="d-note">※ 실제 금액은 가입 조건·약정에 따라 다를 수 있습니다. 3년 약정 기준.</div>`;
}

// ── 상담 모달 ────────────────────────────────────────────────
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

// ── 초기화 ──────────────────────────────────────────────────
function resetAll() {
  state = {
    provider: null,
    planId: null,
    optPhone: false,
    optTv: false,
    tvGrade: null,
  };
  document
    .querySelectorAll('.plogo-card, .plan-card, .tv-card')
    .forEach((c) => c.classList.remove('selected'));
  document
    .querySelectorAll('.opt-btn')
    .forEach((c) => c.classList.remove('checked'));
  hideStep('step-plan');
  hideStep('step-options');
  hideStep('step-tv');
  document.getElementById('floating-bar').classList.remove('show');
  closeDetail();
}
