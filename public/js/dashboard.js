/* =====================================================
   ВАШ АГЕНТ — BI-аналитика дашборда
   R-16: данные загружаются из реальных API через JWT (никаких моков).
   R-17: добавлена таблица активных проектов.
   R-18: экспорт CSV — реальных данных, привязан к кнопке UI.
   ===================================================== */

'use strict';

(function () {
  // Токен будет получаться динамически перед каждым запросом
  function getToken() { return localStorage.getItem('vash_agent_token'); }

  // Глобальное хранилище данных для CSV-экспорта
  const dataStore = {
    kpi:           null,
    ordersByMonth: null,
    types:         null,
    activeProjs:   null,
  };

  function authFetch(url) {
    const token = getToken();
    if (!token) throw new Error('unauthorized');
    return fetch(url, {
      headers: { 'Authorization': 'Bearer ' + token },
    }).then(async (r) => {
      if (r.status === 401) {
        // Токен истёк — выкидываем на login
        localStorage.removeItem('vash_agent_token');
        location.reload();
        throw new Error('unauthorized');
      }
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  // ── Анимированный счётчик KPI ────────────────────────
  function animateValue(el, target, decimals = 0, suffix = '') {
    if (!el) return;
    const start = Date.now();
    const duration = 1200;
    function tick() {
      const p = Math.min((Date.now() - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 4);
      const val = eased * target;
      el.textContent = (decimals > 0 ? val.toFixed(decimals) : Math.round(val).toString()) + suffix;
      if (p < 1) requestAnimationFrame(tick);
      else el.textContent = (decimals > 0 ? Number(target).toFixed(decimals) : Math.round(target).toString()) + suffix;
    }
    tick();
  }

  // ── KPI ──────────────────────────────────────────────
  async function loadKpi() {
    try {
      const data = await authFetch('/api/analytics/kpi');
      dataStore.kpi = data;
      animateValue(document.getElementById('kpiOrders'),    Number(data.active_orders)   || 0);
      animateValue(document.getElementById('kpiCompleted'), Number(data.completed_month) || 0);
      animateValue(document.getElementById('kpiRating'),    Number(data.avg_rating)      || 0, 1);
      animateValue(document.getElementById('kpiRevenue'),   Number(data.revenue_mln)     || 0, 2);
    } catch (e) { console.error('[dashboard] kpi:', e.message); }
  }

  // ── Bar Chart: заявки по месяцам ─────────────────────
  async function loadOrdersChart() {
    try {
      const rows = await authFetch('/api/analytics/orders-by-month');
      dataStore.ordersByMonth = rows;

      // Группируем по году
      const byYear = {};
      rows.forEach((r) => {
        if (!byYear[r.year]) byYear[r.year] = Array(12).fill(0);
        byYear[r.year][r.month - 1] = r.orders;
      });

      const canvas = document.getElementById('ordersChart');
      if (!canvas || typeof Chart === 'undefined') return;

      const months = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];
      const datasets = Object.keys(byYear).sort().map((y, i) => ({
        label: y,
        data: byYear[y],
        backgroundColor: i === Object.keys(byYear).length - 1
          ? 'rgba(94,130,129,0.85)'
          : 'rgba(212,224,222,0.7)',
        borderRadius: 6,
      }));

      new Chart(canvas, {
        type: 'bar',
        data: { labels: months, datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: true } },
          scales: { y: { beginAtZero: true } },
          animation: { duration: 1000 },
        },
      });
    } catch (e) { console.error('[dashboard] orders-by-month:', e.message); }
  }

  // ── Donut: распределение типов ───────────────────────
  async function loadTypesChart() {
    try {
      const rows = await authFetch('/api/analytics/types-distribution');
      dataStore.types = rows;

      const labels = rows.map((r) => ({
        cosmetic: 'Косметический',
        capital:  'Капитальный',
        designer: 'Дизайнерский',
      }[r.type] || r.type));
      const values = rows.map((r) => r.count);

      const canvas = document.getElementById('typesChart');
      if (!canvas || typeof Chart === 'undefined') return;

      const colors = ['#d4e0de', '#5e8281', '#245358', '#b8a589'];

      // Легенда
      const legendEl = document.getElementById('donutLegend');
      if (legendEl) {
        const total = values.reduce((s, v) => s + v, 0) || 1;
        legendEl.innerHTML = labels.map((label, i) => `
          <div class="donut-legend-item">
            <span class="donut-dot" style="background:${colors[i % colors.length]}"></span>
            <span style="flex:1;color:var(--c-sub)">${label}</span>
            <span style="font-weight:600;color:var(--c-dark)">${Math.round(values[i] / total * 100)}%</span>
          </div>
        `).join('');
      }

      new Chart(canvas, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{
            data: values,
            backgroundColor: colors,
            borderWidth: 3,
            borderColor: '#fff',
            hoverOffset: 8,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '68%',
          plugins: { legend: { display: false } },
          animation: { animateRotate: true, duration: 1200 },
        },
      });
    } catch (e) { console.error('[dashboard] types-distribution:', e.message); }
  }

  // ── R-17: Таблица активных проектов ──────────────────
  async function loadActiveProjects() {
    try {
      const rows = await authFetch('/api/analytics/active-projects');
      dataStore.activeProjs = rows;

      const tbody = document.querySelector('#activeProjects tbody');
      if (!tbody) return;

      if (rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px;">Нет активных проектов</td></tr>';
        return;
      }

      const typeLabel = {
        cosmetic: 'Косметический',
        capital:  'Капитальный',
        designer: 'Дизайнерский',
      };

      tbody.innerHTML = rows.map((p) => `
        <tr>
          <td>#${p.id}</td>
          <td>${escapeHtml(p.address || '—')}</td>
          <td>${typeLabel[p.repair_type] || p.repair_type || '—'}</td>
          <td>
            <div class="progress-cell">
              <div class="progress-bar"><div class="progress-fill" style="width:${p.progress}%"></div></div>
              <span>${p.progress}%</span>
            </div>
          </td>
          <td>${p.started_at ? new Date(p.started_at).toLocaleDateString('ru-RU') : '—'}</td>
        </tr>
      `).join('');
    } catch (e) { console.error('[dashboard] active-projects:', e.message); }
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (m) => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[m]));
  }

  // ── R-18: Экспорт CSV реальных данных ────────────────
  window.exportDashboardCSV = function () {
    if (!dataStore.kpi) { alert('Данные ещё загружаются, повторите через секунду.'); return; }

    const rows = [
      ['Отчёт по аналитике', new Date().toLocaleString('ru-RU')],
      [],
      ['KPI'],
      ['Активных заказов',          dataStore.kpi.active_orders],
      ['Завершено в этом месяце',   dataStore.kpi.completed_month],
      ['Средний рейтинг',           dataStore.kpi.avg_rating],
      ['Выручка за месяц, млн ₽',   dataStore.kpi.revenue_mln],
      [],
    ];

    if (dataStore.ordersByMonth && dataStore.ordersByMonth.length > 0) {
      rows.push(['Заявки по месяцам']);
      rows.push(['Год', 'Месяц', 'Заявок']);
      dataStore.ordersByMonth.forEach((r) => rows.push([r.year, r.month, r.orders]));
      rows.push([]);
    }

    if (dataStore.types && dataStore.types.length > 0) {
      rows.push(['Распределение типов ремонта (за 6 мес.)']);
      rows.push(['Тип', 'Заявок']);
      const typeLabel = { cosmetic: 'Косметический', capital: 'Капитальный', designer: 'Дизайнерский' };
      dataStore.types.forEach((r) => rows.push([typeLabel[r.type] || r.type, r.count]));
      rows.push([]);
    }

    if (dataStore.activeProjs && dataStore.activeProjs.length > 0) {
      rows.push(['Активные проекты']);
      rows.push(['ID', 'Адрес', 'Тип', 'Прогресс %', 'Начало']);
      dataStore.activeProjs.forEach((p) => rows.push([
        p.id,
        p.address || '',
        p.repair_type || '',
        p.progress,
        p.started_at ? new Date(p.started_at).toLocaleDateString('ru-RU') : '',
      ]));
    }

    const escapeCsv = (v) => {
      if (v == null) return '';
      const s = String(v);
      if (/[",\n;]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    };
    const csv = rows.map((r) => r.map(escapeCsv).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vashagent_analytics_' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Init ─────────────────────────────────────────────
  async function initDashboard() {
    await Promise.all([
      loadKpi(),
      loadOrdersChart(),
      loadTypesChart(),
      loadActiveProjects(),
    ]);
  }

  // Запускаем только если токен есть, иначе ждем авторизации
  if (getToken()) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initDashboard);
    } else {
      initDashboard();
    }
  }

  // Экспортируем для admin.js — нужен ре-инициализатор после login
  window.reinitDashboard = initDashboard;
})();
