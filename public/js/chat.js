/* =====================================================
   ВАШ АГЕНТ — Онлайн-консультант
   Быстрые ответы ВСЕГДА видны и обновляются по контексту
   ===================================================== */

'use strict';

(function () {
  const chatBox   = document.getElementById('consultantChat');
  const messages  = document.getElementById('chatMessages');
  const input     = document.getElementById('chatInput');
  const badge     = document.getElementById('chatBadge');
  const quickRow  = document.getElementById('quickReplies');

  let chatOpen = false;

  // ── Pools of quick replies (context-aware) ────
  const QUICK_REPLY_SETS = {
    default: [
      { icon: '💰', text: 'Узнать стоимость',     msg: 'Хочу узнать стоимость ремонта' },
      { icon: '📏', text: 'Вызвать замерщика',    msg: 'Хочу вызвать замерщика' },
      { icon: '🖼', text: 'Примеры работ',         msg: 'Покажите примеры работ' },
    ],
    afterPrice: [
      { icon: '📐', text: 'Назвать площадь',      msg: 'У меня квартира 45 м²' },
      { icon: '📏', text: 'Вызвать замерщика',    msg: 'Хочу бесплатный замер' },
      { icon: '💳', text: 'Способы оплаты',       msg: 'Какие способы оплаты?' },
    ],
    afterArea: [
      { icon: '🏠', text: 'Капитальный ремонт',   msg: 'Расскажите про капитальный ремонт' },
      { icon: '✨', text: 'Дизайнерский ремонт',  msg: 'Хочу дизайнерский ремонт' },
      { icon: '📏', text: 'Вызвать замерщика',    msg: 'Запишите меня на замер' },
    ],
    afterMeasure: [
      { icon: '📅', text: 'Когда удобно',          msg: 'Удобно на этой неделе' },
      { icon: '📞', text: 'Оставить телефон',     msg: 'Запишите мой номер: +7 ___ ___ __ __' },
      { icon: '💰', text: 'Сначала цена',          msg: 'Сначала хочу узнать стоимость' },
    ],
    afterPortfolio: [
      { icon: '📧', text: 'Прислать каталог',      msg: 'Пришлите каталог на почту' },
      { icon: '⏱', text: 'Сроки ремонта',          msg: 'Какие сроки на ремонт?' },
      { icon: '🛡', text: 'Гарантии',              msg: 'Какие у вас гарантии?' },
    ],
    afterTerms: [
      { icon: '💰', text: 'Стоимость',             msg: 'Сколько стоит?' },
      { icon: '💳', text: 'Способы оплаты',       msg: 'Расскажите про оплату' },
      { icon: '📏', text: 'Замер',                 msg: 'Хочу заказать замер' },
    ],
    afterPayment: [
      { icon: '✅', text: 'Оформить заявку',       msg: 'Хочу оформить заявку' },
      { icon: '📐', text: 'Сначала расчёт',        msg: 'Сначала рассчитайте стоимость' },
      { icon: '🛡', text: 'Гарантии',              msg: 'А что с гарантиями?' },
    ],
    afterContact: [
      { icon: '💰', text: 'Сколько стоит',         msg: 'Сколько будет стоить ремонт?' },
      { icon: '⏱', text: 'Сроки',                  msg: 'Какие сроки на ремонт?' },
      { icon: '🖼', text: 'Примеры',                msg: 'Покажите примеры работ' },
    ],
  };

  let currentSet = 'default';

  // ── Render quick replies ──────────────────────
  function renderQuickReplies(setKey = currentSet) {
    if (!quickRow) return;
    currentSet = setKey;
    const set = QUICK_REPLY_SETS[setKey] || QUICK_REPLY_SETS.default;
    quickRow.innerHTML = set.map(r =>
      `<button onclick="sendQuickReply('${r.msg.replace(/'/g, "\\'")}')">${r.icon} ${r.text}</button>`
    ).join('');
  }
  renderQuickReplies();

  // ── Open / Close ──────────────────────────────
  window.toggleConsultant = function () {
    chatOpen = !chatOpen;
    if (chatOpen) {
      chatBox.classList.add('open');
      if (badge) badge.style.display = 'none';
      input?.focus();
      scrollChatToBottom();
    } else {
      chatBox.classList.remove('open');
    }
  };
  window.openConsultant  = function () { if (!chatOpen) toggleConsultant(); };
  window.closeConsultant = function () { if (chatOpen) toggleConsultant(); };

  // ── Send User Message ─────────────────────────
  window.sendMessage = function () {
    const text = input.value.trim();
    if (!text) return;
    appendMessage('user', text);
    input.value = '';
    setTimeout(() => respondToMessage(text), 500);
  };

  window.sendQuickReply = function (text) {
    appendMessage('user', text);
    setTimeout(() => respondToMessage(text), 500);
  };

  window.handleChatKey = function (e) {
    if (e.key === 'Enter') sendMessage();
  };

  // ── Helpers ───────────────────────────────────
  function appendMessage(role, text) {
    const div = document.createElement('div');
    div.className = 'chat-msg chat-msg--' + role;
    const time = new Date().toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' });
    const avatar = role === 'bot' ? 'М' : 'В';
    div.innerHTML = `
      <div class="msg-avatar">${avatar}</div>
      <div class="msg-content">
        <p>${escapeHtml(text).replace(/\n/g, '<br>')}</p>
        <span class="msg-time">${time}</span>
      </div>
    `;
    messages.appendChild(div);
    scrollChatToBottom();
  }

  function appendTyping() {
    const div = document.createElement('div');
    div.id = 'typingIndicator';
    div.className = 'chat-msg chat-msg--bot';
    div.innerHTML = `
      <div class="msg-avatar">М</div>
      <div class="msg-content">
        <p style="padding:14px 18px">
          <span class="typing-dots">
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
          </span>
        </p>
      </div>
    `;
    messages.appendChild(div);
    scrollChatToBottom();
  }
  function removeTyping() { document.getElementById('typingIndicator')?.remove(); }
  function scrollChatToBottom() { if (messages) messages.scrollTop = messages.scrollHeight; }
  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, m => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[m]));
  }

  // ── Rule-Based Bot ────────────────────────────
  const RESPONSES = [
    {
      patterns: ['стоимост', 'цен', 'сколько', 'price'],
      reply: 'Стоимость рассчитывается по формуле P = S × k × C, где C = 5 000 ₽/м²:\n• Косметический (k=1.0) — 5 000 ₽/м²\n• Капитальный (k=1.8) — 9 000 ₽/м²\n• Дизайнерский (k=2.5) — 12 500 ₽/м²\n\nХотите точный расчёт? Назовите площадь квартиры 🏠',
      next: 'afterPrice'
    },
    {
      patterns: ['замер', 'замерщик', 'выезд'],
      reply: 'Отлично! Замерщик выезжает БЕСПЛАТНО в любой район Москвы.\n\nКогда вам удобно? Назовите дату и адрес — и я запишу вас прямо сейчас. 📏',
      next: 'afterMeasure'
    },
    {
      patterns: ['пример', 'портфолио', 'работ', 'фото', 'каталог'],
      reply: 'У нас более 450 завершённых проектов! Прокрутите страницу вверх — раздел "Наши работы" — там полная галерея. Также могу прислать pdf-каталог на почту, скажите свой email. 📸',
      next: 'afterPortfolio'
    },
    {
      patterns: ['срок', 'долго', 'когда', 'время'],
      reply: 'Стандартные сроки:\n• Студия (до 35 м²) — 14–21 день\n• 1-комн — 21–30 дней\n• 2-комн — 30–45 дней\n• 3+ комн — 45–70 дней\n\nГарантируем сдачу в срок — иначе скидка 1% за каждый день ⏰',
      next: 'afterTerms'
    },
    {
      patterns: ['гаранти', 'качество'],
      reply: 'На все наши работы — гарантия 3 года! 🛡\nЕсли что-то случится с ремонтом — устраним бесплатно. Все договоры официальные, оплата по этапам.',
      next: 'afterTerms'
    },
    {
      patterns: ['оплат', 'рассрочк', 'кредит'],
      reply: 'У нас 3 удобных способа оплаты:\n1. Стандарт 50/50 (50% предоплата, 50% по завершении)\n2. Рассрочка 0% на 6–12 месяцев без участия банков\n3. Постэтапная (оплата выполненных работ по факту завершения каждого этапа) 💳',
      next: 'afterPayment'
    },
    {
      patterns: ['материал', 'смет'],
      reply: 'Материалы можем закупать мы (со скидкой до 30% у партнёров) или сами. Смета прозрачная — вы видите каждую позицию.\n\nПример сметы вышлю на email — скажите адрес 📋',
      next: 'afterPortfolio'
    },
    {
      patterns: ['привет', 'здрав', 'добр', 'hello', 'hi'],
      reply: 'И вам здравствуйте! 😊 Чем могу помочь? Могу рассчитать стоимость, организовать замер или показать примеры работ.',
      next: 'default'
    },
    {
      patterns: ['спасиб', 'благодар'],
      reply: 'Всегда пожалуйста! Если будут вопросы — пишите. Удачного дня! ☀',
      next: 'default'
    },
    {
      patterns: ['менеджер', 'оператор', 'человек'],
      reply: 'Сейчас передам ваш чат менеджеру Алексею. Он свяжется с вами в течение 3–5 минут. Пока — оставьте, пожалуйста, ваш телефон 📞',
      next: 'afterContact'
    },
    {
      patterns: ['3d', '3д', 'визуализ', 'дизайн'],
      reply: 'Прямо на сайте есть бесплатный 3D-визуализатор! Прокрутите вверх — раздел "3D Визуализатор". Можно подобрать стиль, цвет стен и мебель.\n\nДля полноценного дизайн-проекта — от 1 500 ₽/м². ✨',
      next: 'afterPrice'
    },
    {
      patterns: ['капиталь'],
      reply: 'Капитальный ремонт включает:\n• Замена коммуникаций (электрика, сантехника)\n• Стяжка пола, выравнивание стен/потолков\n• Полное обновление отделки\n• Возможна перепланировка\n\nЦена — 9 000 ₽/м² (k=1.8 от базовой ставки). Срок — 30–45 дней. 🔧',
      next: 'afterPrice'
    },
    {
      patterns: ['косметич'],
      reply: 'Косметический ремонт — быстро освежить интерьер:\n• Покраска или поклейка обоев\n• Замена напольного покрытия\n• Обновление потолка\n• Без замены коммуникаций\n\nЦена — 5 000 ₽/м² (k=1.0 от базовой ставки). Срок — 7–14 дней. 🏠',
      next: 'afterPrice'
    },
  ];

  const PHONE_REGEX = /(\+?7|8)?[\s\-]?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}/;
  const EMAIL_REGEX = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
  const AREA_REGEX  = /(\d{2,3})\s*(м|кв|m)/i;

  function respondToMessage(text) {
    appendTyping();
    setTimeout(() => {
      removeTyping();
      const lower = text.toLowerCase();

      // Phone detection
      if (PHONE_REGEX.test(text)) {
        const phone = text.match(PHONE_REGEX)[0];
        saveLeadToServer({ phone });
        appendMessage('bot', `Записал ваш телефон: ${phone} ✓\nМенеджер перезвонит в течение 30 минут. Пока могу ответить на ваши вопросы — спрашивайте!`);
        renderQuickReplies('afterContact');
        return;
      }

      // Email detection
      if (EMAIL_REGEX.test(text)) {
        const email = text.match(EMAIL_REGEX)[0];
        saveLeadToServer({ email });
        appendMessage('bot', `Спасибо! Записал email: ${email}\nОтправлю на него каталог, прайс и примеры наших работ. 📧`);
        renderQuickReplies('afterContact');
        return;
      }

      // Area detection
      if (AREA_REGEX.test(text)) {
        const area = parseInt(text.match(AREA_REGEX)[1], 10);
        const minPrice = (area * 3500).toLocaleString('ru-RU');
        const avgPrice = (area * 7500).toLocaleString('ru-RU');
        const maxPrice = (area * 12000).toLocaleString('ru-RU');
        appendMessage('bot',
          `Для ${area} м² предварительная стоимость:\n` +
          `• Косметический: от ${minPrice} ₽\n` +
          `• Капитальный: от ${avgPrice} ₽\n` +
          `• Дизайнерский: от ${maxPrice} ₽\n\n` +
          `Хотите вызвать замерщика для точного расчёта? Бесплатно! 📐`
        );
        renderQuickReplies('afterArea');
        return;
      }

      // Pattern matching
      for (const r of RESPONSES) {
        if (r.patterns.some(p => lower.includes(p))) {
          appendMessage('bot', r.reply);
          renderQuickReplies(r.next || 'default');
          return;
        }
      }

      // Fallback
      appendMessage('bot',
        'Хороший вопрос! Сейчас передам менеджеру, он ответит подробнее.\n\n' +
        'А пока могу помочь с такими темами:\n' +
        '• Расчёт стоимости (назовите площадь)\n' +
        '• Вызов замерщика\n' +
        '• Примеры работ\n' +
        '• Сроки и гарантии\n' +
        '• Способы оплаты'
      );
      renderQuickReplies('default');
    }, 800);
  }

  function saveLeadToServer(data) {
    fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        source: 'chat',
        timestamp: new Date().toISOString()
      })
    }).catch(() => {});
  }

  // Show badge after delay
  setTimeout(() => {
    if (!chatOpen && badge) badge.style.display = 'flex';
  }, 10000);
})();
