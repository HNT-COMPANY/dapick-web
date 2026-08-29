//
// mobile-board.js — 휴대폰 브랜드 선택 메인보드
//

const MOBILE_BRANDS = [
  {
    key: 'samsung',
    name: '삼성',
    emoji: '',
    tagline: 'Galaxy S25 · Z Fold · Z Flip',
    desc: '갤럭시 라인업 전체 비교',
    bg: 'linear-gradient(135deg, #1428A0 0%, #0a1f7a 100%)',
  },
  {
    key: 'apple',
    name: 'Apple',
    emoji: '',
    tagline: 'iPhone 16 Pro · Pro Max · Plus',
    desc: '아이폰 전 모델 지원금 비교',
    bg: 'linear-gradient(135deg, #1a1a1a 0%, #2c2c2e 100%)',
  },
];

function renderBoard() {
  const grid = document.getElementById('boardGrid');
  if (!grid) return;

  grid.innerHTML = MOBILE_BRANDS.map(
    (b) => `
    <div class="board-card" onclick="selectBrand('${b.key}')" style="background:${b.bg};">
      <div class="board-card-emoji">${b.emoji}</div>
      <div class="board-card-name">${b.name}</div>
      <div class="board-card-tagline">${b.tagline}</div>
      <div class="board-card-desc">${b.desc}</div>
      <div class="board-card-arrow">지원금 비교 ›</div>
    </div>
  `,
  ).join('');
}

async function selectBrand(brandKey) {
  document.getElementById('boardView').style.display = 'none';
  document.getElementById('productView').style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'instant' });
  await switchBrand(brandKey);
}

function backToBoard() {
  document.getElementById('productView').style.display = 'none';
  document.getElementById('boardView').style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'instant' });
}

document.addEventListener('DOMContentLoaded', renderBoard);
