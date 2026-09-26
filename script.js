// Ano no rodapé
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

// Menu mobile
const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');

if (navToggle && navLinks) {
  navToggle.addEventListener('click', () => {
    navLinks.classList.toggle('open');
  });

  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => navLinks.classList.remove('open'));
  });
}

// Animação de entrada dos blocos ao rolar a página. Só liga com JS e IntersectionObserver;
// sem isso (ou com "reduzir movimento" no sistema) tudo aparece normalmente.
const blocosRevelar = document.querySelectorAll(
  '.hero-content, .hero-media, .section-head, .section-body, .gallery-grid img, .belt-block, ' +
  '.schedule-row, .schedule-note, .location-inner > *, .contact-card'
);
const reduzirMovimento = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if ('IntersectionObserver' in window && blocosRevelar.length && !reduzirMovimento) {
  document.documentElement.classList.add('js-reveal');
  const observador = new IntersectionObserver((entradas) => {
    entradas.forEach((entrada) => {
      if (!entrada.isIntersecting) return;
      entrada.target.classList.add('in');
      observador.unobserve(entrada.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  blocosRevelar.forEach((el, i) => {
    el.classList.add('rv');
    el.style.transitionDelay = (i % 4) * 70 + 'ms';
    observador.observe(el);
  });
}
