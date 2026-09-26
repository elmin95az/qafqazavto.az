// Cloudflare Worker that forwards booking-form submissions to the
// Telegram group (see SETUP-TELEGRAM.md for how it's deployed/configured).
var BOOKING_ENDPOINT = 'https://qafqaz-avto-booking.elmin95-az.workers.dev';

document.addEventListener('DOMContentLoaded', function () {

  /* ---------- Reveal hero glass-cards only once the hero photo is ready ---------- */
  /* (backdrop-filter blurs whatever sits behind the card — if we show the card
     before the image has loaded, it "pops" once the blur suddenly has real
     content to blur. Waiting for the image avoids that visual glitch.) */
  var heroImg = document.querySelector('.hero__illustration');
  var heroCards = document.querySelectorAll('.hero__card');

  function revealHeroCards() {
    heroCards.forEach(function (card) { card.classList.add('is-loaded'); });
  }

  if (heroImg) {
    if (heroImg.complete && heroImg.naturalWidth > 0) {
      revealHeroCards();
    } else {
      heroImg.addEventListener('load', revealHeroCards);
      heroImg.addEventListener('error', revealHeroCards);
      setTimeout(revealHeroCards, 3000); // safety net so cards never stay hidden
    }
  } else {
    revealHeroCards();
  }

  /* ---------- In-page anchor links ---------- */
  /* Scroll to the target ourselves instead of letting the browser follow
     the "#" href natively: for file:// documents, a plain hash navigation
     triggers a full page reload (confirmed in Chrome), which re-runs
     i18n.js's language detection and silently resets the site back to the
     default language on every menu click. Intercepting keeps it a same-page
     scroll everywhere, file:// included. */
  document.addEventListener('click', function (e) {
    var link = e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (!link) return;
    var hash = link.getAttribute('href');
    var target = hash === '#' ? null : document.querySelector(hash);
    e.preventDefault();
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    try {
      history.pushState(null, '', hash === '#' ? location.pathname + location.search : hash);
    } catch (err) { /* pushState is blocked on file:// and some sandboxed origins */ }
  });

  /* ---------- Mobile menu (slide-in drawer) ---------- */
  var burger = document.getElementById('burger');
  var nav = document.getElementById('nav');
  var navBackdrop = document.getElementById('nav-backdrop');
  var navClose = document.getElementById('nav-close');

  function openNav() {
    if (!nav) return;
    nav.classList.add('is-open');
    if (navBackdrop) navBackdrop.classList.add('is-open');
    document.body.classList.add('nav-open');
  }
  function closeNav() {
    if (!nav) return;
    nav.classList.remove('is-open');
    if (navBackdrop) navBackdrop.classList.remove('is-open');
    document.body.classList.remove('nav-open');
  }

  if (burger && nav) {
    burger.addEventListener('click', function () {
      if (nav.classList.contains('is-open')) { closeNav(); } else { openNav(); }
    });

    nav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', closeNav);
    });
  }
  if (navClose) navClose.addEventListener('click', closeNav);
  if (navBackdrop) navBackdrop.addEventListener('click', closeNav);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeNav();
  });

  /* ---------- Active nav link on scroll ---------- */
  var sections = Array.from(document.querySelectorAll('main section[id], .hero[id]'));
  var navLinks = nav ? Array.from(nav.querySelectorAll('a')) : [];

  function setActiveLink() {
    var scrollPos = window.scrollY + 140;
    var current = sections[0];
    sections.forEach(function (section) {
      if (section.offsetTop <= scrollPos) current = section;
    });
    navLinks.forEach(function (link) {
      link.classList.toggle('active', link.getAttribute('href') === '#' + current.id);
    });
  }
  if (sections.length && navLinks.length) {
    window.addEventListener('scroll', setActiveLink);
    setActiveLink();
  }

  /* ---------- Animated stat counters ---------- */
  var statEls = document.querySelectorAll('.stat__num');
  var statsAnimated = false;

  function animateStats() {
    if (statsAnimated) return;
    var heroStats = document.querySelector('.hero__stats');
    if (!heroStats) return;
    var rect = heroStats.getBoundingClientRect();
    if (rect.top > window.innerHeight) return;

    statsAnimated = true;
    statEls.forEach(function (el) {
      var target = parseInt(el.getAttribute('data-count'), 10) || 0;
      var duration = 1200;
      var startTime = null;

      function step(timestamp) {
        if (!startTime) startTime = timestamp;
        var progress = Math.min((timestamp - startTime) / duration, 1);
        var eased = 1 - Math.pow(1 - progress, 3);
        var localeMap = { ru: 'ru-RU', az: 'az-Latn-AZ', en: 'en-US' };
        var locale = (window.QA_I18N && localeMap[window.QA_I18N.lang]) || 'ru-RU';
        el.textContent = Math.floor(eased * target).toLocaleString(locale);
        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          el.textContent = target.toLocaleString(locale);
        }
      }
      requestAnimationFrame(step);
    });
  }
  window.addEventListener('scroll', animateStats);
  animateStats();

  /* ---------- Scroll-to-top button ---------- */
  var scrollTopBtn = document.getElementById('scroll-top');
  if (scrollTopBtn) {
    window.addEventListener('scroll', function () {
      scrollTopBtn.classList.toggle('is-visible', window.scrollY > 500);
    });
  }

  /* ---------- Sticky header shadow ---------- */
  var header = document.getElementById('header');
  if (header) {
    window.addEventListener('scroll', function () {
      header.style.boxShadow = window.scrollY > 10 ? '0 8px 24px rgba(18,58,107,.08)' : 'none';
    });
  }

  /* ---------- Booking form → Telegram group (via Cloudflare Worker proxy) ---------- */
  var form = document.getElementById('booking-form');
  var note = document.getElementById('booking-note');

  if (form && note) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var i18n = window.QA_I18N;
      var name = form.querySelector('[name="name"]').value.trim();
      var submitBtn = form.querySelector('button[type="submit"]');

      var payload = {
        name: name,
        phone: form.querySelector('[name="phone"]').value.trim(),
        model: form.querySelector('[name="model"]').value.trim(),
        budget: form.querySelector('[name="budget"]').value.trim(),
        message: form.querySelector('[name="message"]').value.trim(),
      };

      function showThanks() {
        note.textContent = i18n
          ? (name ? i18n.t('booking.thanks', { name: name }) : i18n.t('booking.thanksNoName'))
          : 'Спасибо' + (name ? ', ' + name : '') + '! Заявка отправлена, мы свяжемся с вами в ближайшее время.';
        note.style.color = 'var(--primary)';
        form.reset();
      }

      function showError() {
        note.textContent = i18n
          ? i18n.t('booking.error')
          : 'Не удалось отправить заявку. Позвоните нам или напишите в WhatsApp.';
        note.style.color = '#c0392b';
      }

      if (!BOOKING_ENDPOINT || BOOKING_ENDPOINT.indexOf('YOUR-SUBDOMAIN') !== -1) {
        // Worker not deployed/configured yet — fall back to a local-only
        // confirmation so the form still feels functional during design review.
        showThanks();
        return;
      }

      if (submitBtn) submitBtn.disabled = true;

      fetch(BOOKING_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
        .then(function (result) {
          if (result.ok && result.data && result.data.ok) {
            showThanks();
          } else {
            showError();
          }
        })
        .catch(showError)
        .finally(function () {
          if (submitBtn) submitBtn.disabled = false;
        });
    });
  }

  /* ---------- Footer year ---------- */
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- Scroll-reveal animations ---------- */
  var revealEls = document.querySelectorAll('[data-reveal]');
  if (revealEls.length) {
    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

      revealEls.forEach(function (el, i) {
        el.style.transitionDelay = (i % 3) * 80 + 'ms';
        observer.observe(el);
      });
    } else {
      revealEls.forEach(function (el) { el.classList.add('is-visible'); });
    }
  }

});
