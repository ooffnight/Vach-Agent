/* =====================================================
   ВАШ АГЕНТ — Логика админ-раздела
   R-14: форма авторизации, защита админ-страниц через JWT.
   R-15: дашборд только в админке.
   T-04, T-05, T-08: сценарии авторизации.
   ===================================================== */

'use strict';

(function () {
  const TOKEN_KEY = 'vash_agent_token';
  const USER_KEY  = 'vash_agent_user';

  function getToken() { return localStorage.getItem(TOKEN_KEY); }
  function getUser()  {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); }
    catch (e) { return null; }
  }
  function saveAuth(user, token) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
  function clearAuth() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  function authFetch(url, opts = {}) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    const token = getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;
    return fetch(url, Object.assign({}, opts, { headers })).then(async (r) => {
      if (r.status === 401) {
        clearAuth();
        showLogin();
        throw new Error('unauthorized');
      }
      return r;
    });
  }

  function $(id) { return document.getElementById(id); }

  // ── UI: переключение Login / Admin ───────────────────
  function showLogin() {
    $('adminLogin')?.classList.remove('hidden');
    $('adminPanel')?.classList.add('hidden');
  }
  function showPanel() {
    $('adminLogin')?.classList.add('hidden');
    $('adminPanel')?.classList.remove('hidden');

    const user = getUser();
    if (user) {
      const greetEl = $('adminGreet');
      if (greetEl) greetEl.textContent = `${user.name || user.login} (${user.role})`;

      // R-19: для manager скрыть кнопку «Добавить пользователя»
      const addUserBtn = $('btnAddUser');
      if (addUserBtn) addUserBtn.style.display = user.role === 'admin' ? '' : 'none';
    }
  }

  // ── Login ────────────────────────────────────────────
  async function handleLogin(e) {
    e.preventDefault();
    const errEl = $('loginError');
    if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }

    const login    = $('loginInput')?.value?.trim()    || '';
    const password = $('passwordInput')?.value || '';

    if (!login || !password) {
      if (errEl) { errEl.textContent = 'Введите логин и пароль'; errEl.style.display = 'block'; }
      return false;
    }

    const btn = e.target.querySelector('button[type="submit"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Вход...'; }

    try {
      const r = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ login, password }),
      });
      const data = await r.json();
      if (!r.ok) {
        if (errEl) { errEl.textContent = data.error || 'Ошибка входа'; errEl.style.display = 'block'; }
        return false;
      }
      saveAuth(data.user, data.token);
      showPanel();
      switchTab('dashboard');
      // Перезапустить dashboard.js с новым токеном
      if (typeof window.reinitDashboard === 'function') {
        window.reinitDashboard();
      }
    } catch (err) {
      if (errEl) { errEl.textContent = 'Сервер недоступен'; errEl.style.display = 'block'; }
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Войти'; }
    }
    return false;
  }

  // ── Logout ───────────────────────────────────────────
  window.adminLogout = function () {
    clearAuth();
    showLogin();
  };

  // ── Переключение вкладок ─────────────────────────────
  window.switchTab = function (tab) {
    document.querySelectorAll('.admin-tab').forEach((el) => el.classList.remove('active'));
    document.querySelectorAll('.admin-tab-content').forEach((el) => el.classList.remove('active'));
    document.querySelector(`.admin-tab[data-tab="${tab}"]`)?.classList.add('active');
    document.getElementById('tab-' + tab)?.classList.add('active');

    if (tab === 'orders') loadOrders();
    if (tab === 'leads')  loadLeads();
  };

  // ── Список заявок (TC-I06) ───────────────────────────
  async function loadOrders() {
    const tbody = document.querySelector('#ordersTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;">Загрузка...</td></tr>';

    try {
      const r = await authFetch('/api/orders');
      const data = await r.json();
      const typeLabel = {
        cosmetic: 'Косметический',
        capital:  'Капитальный',
        designer: 'Дизайнерский',
      };
      const statusLabel = {
        new: 'Новая', confirmed: 'Подтв.', in_progress: 'В работе', completed: 'Завершена', cancelled: 'Отменена',
      };

      if (!data.orders || data.orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;">Нет заявок</td></tr>';
        return;
      }

      tbody.innerHTML = data.orders.map((o) => `
        <tr>
          <td>#${o.id}</td>
          <td>${escapeHtml(o.name)}</td>
          <td>${escapeHtml(o.phone)}</td>
          <td>${typeLabel[o.type] || o.type}</td>
          <td>${o.area} м²</td>
          <td>${Number(o.price || 0).toLocaleString('ru-RU')} ₽</td>
          <td>
            <select onchange="updateOrderStatus(${o.id}, this.value)">
              ${Object.keys(statusLabel).map((s) => `<option value="${s}" ${o.status === s ? 'selected' : ''}>${statusLabel[s]}</option>`).join('')}
            </select>
          </td>
          <td>${new Date(o.created_at).toLocaleString('ru-RU')}</td>
        </tr>
      `).join('');
    } catch (e) {
      console.error('loadOrders error:', e);
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;color:#c00;">Ошибка: ' + escapeHtml(e.message) + '</td></tr>';
    }
  }

  // ── Изменение статуса (TC: PATCH /api/orders/:id/status) ──
  window.updateOrderStatus = async function (id, status) {
    try {
      const r = await authFetch('/api/orders/' + id + '/status', {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      if (!r.ok) {
        const data = await r.json();
        alert('Ошибка: ' + (data.error || 'не удалось обновить'));
        loadOrders();  // откатить визуально
      }
    } catch (e) {
      if (e.message === 'unauthorized') return;
      alert('Сервер недоступен');
      loadOrders();
    }
  };

  // ── Список лидов ─────────────────────────────────────
  async function loadLeads() {
    const tbody = document.querySelector('#leadsTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;">Загрузка...</td></tr>';

    try {
      const r = await authFetch('/api/leads');
      const data = await r.json();

      if (!data.leads || data.leads.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;">Нет лидов</td></tr>';
        return;
      }

      tbody.innerHTML = data.leads.map((l) => `
        <tr>
          <td>#${l.id}</td>
          <td>${escapeHtml(l.name || '—')}</td>
          <td>${escapeHtml(l.phone || '—')}</td>
          <td>${escapeHtml(l.email || '—')}</td>
          <td>${escapeHtml(l.source)}</td>
          <td>${new Date(l.created_at).toLocaleString('ru-RU')}</td>
        </tr>
      `).join('');
    } catch (e) {
      console.error('loadLeads error:', e);
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:#c00;">Ошибка: ' + escapeHtml(e.message) + '</td></tr>';
    }
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (m) => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[m]));
  }

  // ── Init ─────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    const loginForm = $('loginForm');
    if (loginForm) loginForm.addEventListener('submit', handleLogin);

    // Проверяем сохранённую сессию
    if (getToken()) {
      // Валидируем токен через /me
      authFetch('/api/auth/me')
        .then((r) => r.json())
        .then((data) => {
          if (data.user) {
            localStorage.setItem(USER_KEY, JSON.stringify(data.user));
            showPanel();
            switchTab('dashboard');
          } else {
            showLogin();
          }
        })
        .catch(() => showLogin());
    } else {
      showLogin();
    }
  });
})();
