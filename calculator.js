// =====================================================
// calculator.js — Трёхэтапная форма заявки на ремонт
// FR-04 диплома: расчёт стоимости → ввод контактов → подтверждение
// T-01: успешное сохранение → запись в БД через POST /api/orders
// T-02: пустой телефон → ошибка валидации (на сервере)
// T-03: расчёт по формуле (5) через POST /api/orders/calculate
// =====================================================

(function () {
  'use strict';

  const orderData = {
    type:    null,
    area:    null,
    price:   null,
    name:    '',
    phone:   '',
    email:   '',
    address: '',
  };

  let currentStep = 1;

  // ── Helpers ─────────────────────────────────────────
  function $(id) { return document.getElementById(id); }

  function showStep(n) {
    currentStep = n;
    document.querySelectorAll('.form-step').forEach((el) => el.classList.remove('active'));
    const target = $('orderStep' + n);
    if (target) target.classList.add('active');
    // Обновить индикатор
    document.querySelectorAll('.step-indicator').forEach((el, idx) => {
      el.classList.toggle('active',    idx + 1 === n);
      el.classList.toggle('completed', idx + 1 <  n);
    });
  }

  function showError(elementId, message) {
    const el = $(elementId);
    if (el) { el.textContent = message; el.style.display = message ? 'block' : 'none'; }
  }

  // ── Шаг 1: Калькулятор → POST /api/orders/calculate ──
  async function handleCalculate(e) {
    e.preventDefault();
    showError('calcError', '');

    const typeSel = $('calcType');
    const areaInp = $('calcArea');
    const type    = typeSel?.value;
    const area    = parseFloat(areaInp?.value);

    if (!type) {
      showError('calcError', 'Выберите тип ремонта');
      return false;
    }
    if (!Number.isFinite(area) || area <= 0) {
      showError('calcError', 'Введите корректную площадь (положительное число)');
      return false;
    }

    const btn = e.target.querySelector('button[type="submit"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Считаем...'; }

    try {
      const response = await fetch('/api/orders/calculate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ type, area }),
      });
      const data = await response.json();
      if (!response.ok) {
        showError('calcError', data.error || 'Ошибка расчёта');
        return false;
      }

      orderData.type  = type;
      orderData.area  = area;
      orderData.price = data.price;

      // Показать результат и перейти к шагу 2
      const resultEl = $('calcResult');
      if (resultEl) {
        resultEl.innerHTML = `
          <div class="calc-result__title">Предварительная стоимость</div>
          <div class="calc-result__value">${data.price.toLocaleString('ru-RU')} ₽</div>
          <div class="calc-result__breakdown">
            ${data.breakdown.S} м² × коэффициент ${data.breakdown.k} × ${data.breakdown.C.toLocaleString('ru-RU')} ₽/м²
          </div>
        `;
        resultEl.style.display = 'block';
      }

      showStep(2);
    } catch (err) {
      showError('calcError', 'Сервер недоступен. Попробуйте позже.');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Рассчитать стоимость'; }
    }
    return false;
  }

  // ── Шаг 2: контактные данные → переход к подтверждению ──
  function handleContacts(e) {
    e.preventDefault();
    showError('contactsError', '');

    const name    = $('orderName')?.value?.trim()    || '';
    const phone   = $('orderPhone')?.value?.trim()   || '';
    const email   = $('orderEmail')?.value?.trim()   || '';
    const address = $('orderAddress')?.value?.trim() || '';

    if (name.length < 2) {
      showError('contactsError', 'Введите имя (минимум 2 символа)');
      return false;
    }

    // Базовая проверка телефона на стороне клиента (детальная — на сервере)
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      showError('contactsError', 'Введите корректный телефон (минимум 10 цифр)');
      return false;
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showError('contactsError', 'Введите корректный email или оставьте поле пустым');
      return false;
    }

    orderData.name    = name;
    orderData.phone   = phone;
    orderData.email   = email;
    orderData.address = address;

    // Заполнить превью на шаге 3
    const reviewEl = $('orderReview');
    if (reviewEl) {
      const typeLabel = {
        cosmetic: 'Косметический',
        capital:  'Капитальный',
        designer: 'Дизайнерский',
      }[orderData.type] || orderData.type;

      reviewEl.innerHTML = `
        <div class="review-row"><span>Тип ремонта:</span><strong>${typeLabel}</strong></div>
        <div class="review-row"><span>Площадь:</span><strong>${orderData.area} м²</strong></div>
        <div class="review-row"><span>Предв. стоимость:</span><strong>${orderData.price.toLocaleString('ru-RU')} ₽</strong></div>
        <div class="review-row"><span>Имя:</span><strong>${escapeHtml(orderData.name)}</strong></div>
        <div class="review-row"><span>Телефон:</span><strong>${escapeHtml(orderData.phone)}</strong></div>
        ${orderData.email   ? `<div class="review-row"><span>Email:</span><strong>${escapeHtml(orderData.email)}</strong></div>` : ''}
        ${orderData.address ? `<div class="review-row"><span>Адрес:</span><strong>${escapeHtml(orderData.address)}</strong></div>` : ''}
      `;
    }

    showStep(3);
    return false;
  }

  // ── Шаг 3: финальная отправка → POST /api/orders ─────
  async function handleSubmitOrder(e) {
    e.preventDefault();
    showError('submitError', '');

    const btn = e.target.querySelector('button[type="submit"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Отправляем...'; }

    try {
      const response = await fetch('/api/orders', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          name:    orderData.name,
          phone:   orderData.phone,
          email:   orderData.email || null,
          type:    orderData.type,
          area:    orderData.area,
          address: orderData.address || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        showError('submitError', data.error || 'Не удалось отправить заявку');
        return false;
      }

      // Успех: показать сообщение, очистить форму
      const successEl = $('orderSuccess');
      const formEl    = $('orderFormContainer');
      if (successEl && formEl) {
        formEl.style.display = 'none';
        successEl.innerHTML = `
          <div class="order-success">
            <div class="success-ring"></div>
            <div class="success-check">✓</div>
            <h3>Спасибо, ${escapeHtml(orderData.name.split(' ')[0])}!</h3>
            <p>Ваша заявка №<strong>${data.order.id}</strong> успешно создана.</p>
            <p>Менеджер свяжется с вами в течение 30 минут.</p>
            <button class="btn-primary" onclick="location.reload()">Создать ещё заявку</button>
          </div>
        `;
        successEl.style.display = 'block';
        spawnConfetti();
      }
    } catch (err) {
      showError('submitError', 'Сервер недоступен. Попробуйте позже.');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Отправить заявку'; }
    }
    return false;
  }

  // ── Утилиты ─────────────────────────────────────────
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (m) => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[m]));
  }



  // ── Навигация назад/вперёд ──────────────────────────
  window.orderStepBack = function () {
    if (currentStep > 1) showStep(currentStep - 1);
  };

  // ── Регистрация обработчиков на DOMContentLoaded ────
  document.addEventListener('DOMContentLoaded', () => {
    const calcForm     = $('orderCalcForm');
    const contactsForm = $('orderContactsForm');
    const submitForm   = $('orderSubmitForm');

    if (calcForm)     calcForm.addEventListener('submit', handleCalculate);
    if (contactsForm) contactsForm.addEventListener('submit', handleContacts);
    if (submitForm)   submitForm.addEventListener('submit', handleSubmitOrder);

    showStep(1);
  });
})();
