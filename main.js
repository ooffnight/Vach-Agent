// main.js — Site-wide interactions (refactored)
// Visualizer controls (style/floor/wall/furniture) RESTORED per diploma §3.1.
// Contact form is now the simple "request a callback" form (separate from
// the 3-step order form, which lives in calculator.js + #order section).
// Mobile drawer, showcase tab switcher kept as-is.

(function () {
  'use strict';

  // ===== Scroll progress bar =====
  const progressBar = document.getElementById('scrollProgress');
  function updateProgress() {
    if (!progressBar) return;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const pct = max > 0 ? (window.scrollY / max) * 100 : 0;
    progressBar.style.transform = `scaleX(${pct / 100})`;
  }
  window.addEventListener('scroll', updateProgress, { passive: true });
  updateProgress();

  // ===== Navbar shadow on scroll =====
  const navbar = document.getElementById('navbar');
  function updateNavbar() {
    if (!navbar) return;
    if (window.scrollY > 30) navbar.classList.add('scrolled');
    else navbar.classList.remove('scrolled');
  }
  window.addEventListener('scroll', updateNavbar, { passive: true });
  updateNavbar();

  // ===== Mobile drawer menu =====
  const drawer = document.getElementById('mobileDrawer');
  window.toggleMenu = function () {
    if (!drawer) return;
    const isOpen = drawer.classList.toggle('open');
    document.body.classList.toggle('menu-open', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : '';
  };

  // ESC closes drawer
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawer && drawer.classList.contains('open')) {
      window.toggleMenu();
    }
  });

  // ===== Reveal-on-scroll =====
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el));

  // ===== Animated counters =====
  function animateCounter(el) {
    const target = parseFloat(el.dataset.count || el.textContent || '0');
    const suffix = el.dataset.suffix || '';
    const duration = 1400;
    const start = performance.now();
    function step(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const val = target * eased;
      el.textContent = (target % 1 === 0 ? Math.round(val) : val.toFixed(1)) + suffix;
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        counterObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.4 });
  document.querySelectorAll('.counter, [data-count]').forEach((el) => counterObserver.observe(el));

  // ===== Portfolio filter =====
  const filterBtns = document.querySelectorAll('.filter-btn');
  const portfolioItems = document.querySelectorAll('.portfolio-item');
  filterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const filter = btn.dataset.filter;
      filterBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      portfolioItems.forEach((item) => {
        const cat = item.dataset.category;
        const match = filter === 'all' || cat === filter;
        item.style.display = match ? '' : 'none';
        if (match) {
          item.classList.remove('hidden');
          // restart reveal animation
          item.classList.remove('visible');
          requestAnimationFrame(() => item.classList.add('visible'));
        }
      });
    });
  });

  // ===== Showcase apartment tabs =====
  const showcaseTabs = document.querySelectorAll('.showcase-tab');
  showcaseTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const apt = tab.dataset.apt;
      if (!apt) return;
      showcaseTabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      if (typeof window.setApartment === 'function') {
        window.setApartment(apt);
      }
    });
  });



  // ===== Contact form (consultation request) =====
  window.submitContactForm = function (e) {
    e.preventDefault();
    const name = (document.getElementById('contactName') || {}).value || '';
    const phone = (document.getElementById('contactPhone') || {}).value || '';
    const interest = (document.getElementById('contactInterest') || {}).value || '';
    const message = (document.getElementById('contactMessage') || {}).value || '';

    if (!name.trim() || !phone.trim()) {
      alert('Пожалуйста, укажите имя и телефон');
      return false;
    }

    const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s\./0-9]*$/;
    const phoneDigits = phone.replace(/\D/g, '');
    if (!phoneRegex.test(phone) || phoneDigits.length < 10) {
      alert('Пожалуйста, введите корректный номер телефона (минимум 10 цифр)');
      const phoneInput = document.getElementById('contactPhone');
      if (phoneInput) phoneInput.classList.add('error');
      return false;
    }
    const phoneInput = document.getElementById('contactPhone');
    if (phoneInput) phoneInput.classList.remove('error');

    const form = document.getElementById('contactForm');
    const btn = form ? form.querySelector('button[type="submit"]') : null;
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Отправляем...';
    }

    fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, interest, message, source: 'contact-form' }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('Network error');
        if (form) {
          form.innerHTML = `
            <div class="contact-success">
              <div class="success-ring"></div>
              <h3>Спасибо, ${name.split(' ')[0]}!</h3>
              <p>Ваша заявка принята. Наш менеджер перезвонит в течение 30 минут.</p>
              <p class="form-note">Если вы оставили заявку вечером — позвоним утром в 9:00.</p>
            </div>
          `;
        }
        window.spawnConfetti();
      })
      .catch(() => {
        alert('Ошибка при отправке заявки. Пожалуйста, попробуйте позже или позвоните нам.');
      })
      .finally(() => {
        if (form && btn) {
          btn.disabled = false;
          btn.textContent = 'Отправить';
        }
      });

    return false;
  };

  // ===== Confetti =====
  window.spawnConfetti = function() {
    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999;';
    document.body.appendChild(container);
    const colors = ['#5e8281', '#e8ddd0', '#b8a589', '#245358', '#d4e0de'];
    for (let i = 0; i < 36; i++) {
      const piece = document.createElement('span');
      piece.className = 'confetti-piece';
      piece.style.cssText = `
        position:absolute;left:${50 + (Math.random() - 0.5) * 40}%;top:30%;
        width:8px;height:8px;border-radius:1px;
        background:${colors[Math.floor(Math.random() * colors.length)]};
        animation:confettiFall ${1 + Math.random() * 1}s ease forwards;
        animation-delay:${Math.random() * 0.4}s;
        transform:rotate(${Math.random() * 360}deg);
      `;
      container.appendChild(piece);
    }
    setTimeout(() => container.remove(), 3000);
  }

  // ===== Smooth anchor scrolling =====
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      if (!href || href === '#') return;
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      const offset = 80;
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
      // Close drawer if open
      if (drawer && drawer.classList.contains('open')) {
        setTimeout(() => window.toggleMenu(), 100);
      }
    });
  });

  // ===== FAQ details — close others when one opens (accordion) =====
  document.querySelectorAll('.faq-item').forEach((item) => {
    item.addEventListener('toggle', () => {
      if (item.open) {
        document.querySelectorAll('.faq-item[open]').forEach((other) => {
          if (other !== item) other.removeAttribute('open');
        });
      }
    });
  });

})();
