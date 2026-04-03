// api.js — 다픽 웹 백엔드 API 호출

const BASE_URL = 'https://api.dapick.co.kr'; // 배포 후 실제 주소로 변경

const api = {
  // 공통 요청 처리
  async request(method, path, body = null) {
    const token = localStorage.getItem('dapick_token');

    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      ...(body && { body: JSON.stringify(body) }),
    };

    const res = await fetch(`${BASE_URL}${path}`, options);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || '요청 실패');
    }

    return data.data ?? data;
  },

  get: (path) => api.request('GET', path),
  post: (path, body) => api.request('POST', path, body),
  put: (path, body) => api.request('PUT', path, body),
  patch: (path, body) => api.request('PATCH', path, body),
  delete: (path) => api.request('DELETE', path),
};

// ── 상담 신청 API ──
async function submitConsultApi(name, phone, summary) {
  // 추후 백엔드 Application API 연결
  // return await api.post('/api/applications', { name, phone, summary });
  console.log('[API] 상담 신청:', { name, phone, summary });
}
