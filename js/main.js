/* ==========================================================================
   Glorieux Team World : comportement de la page
   1. Configuration (à personnaliser)
   2. Onglets produits
   3. Panier + commande WhatsApp
   4. Détails (menu mobile, en-tête, année)
   ========================================================================== */
(() => {
  'use strict';

  /* ------------------------------------------------------------------ 1. CONFIG */
  const CONFIG = {
    // Nom affiché dans l'en-tête et le pied de page
    brandName: 'Glorieux Team World',

    // Numéro WhatsApp de la boutique, au format international, chiffres seuls
    // (indicatif pays + numéro, sans « + » ni espaces). Exemple : '2250700000000'
    // Laissé vide, WhatsApp propose de choisir le contact : pratique pour la démo.
    whatsappNumber: '',

    // Devise affichée à côté des prix
    currency: 'FCFA',

    // Quantité maximale par produit dans le panier
    maxQty: 20
  };

  const NBSP = '\u00a0';
  const root = document.documentElement;
  root.classList.add('js');

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const fmtNumber = new Intl.NumberFormat('fr-FR');
  const money = (n) => `${fmtNumber.format(n).replace(/\u202f/g, NBSP)}${NBSP}${CONFIG.currency}`;

  /* ------------------------------------------------------------------ Produits (lus dans le HTML) */
  const products = new Map();
  $$('.panel').forEach((panel) => {
    const id = panel.dataset.id;
    const price = parseInt(panel.dataset.price, 10);
    const thumb = $(`#tab-${id} img`);
    products.set(id, {
      id,
      name: panel.dataset.name,
      unit: panel.dataset.unit,
      price: Number.isFinite(price) && price > 0 ? price : null,
      thumb: thumb ? thumb.getAttribute('src') : ''
    });
  });

  // Prix affichés sur chaque fiche
  $$('.panel').forEach((panel) => {
    const p = products.get(panel.dataset.id);
    const label = $('[data-price-label]', panel);
    if (label && p && p.price) label.textContent = money(p.price);
  });

  // Marque + année
  $$('[data-brand]').forEach((el) => { el.textContent = CONFIG.brandName; });
  $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });

  /* ------------------------------------------------------------------ WhatsApp */
  const waUrl = (text) => {
    const number = String(CONFIG.whatsappNumber || '').replace(/\D/g, '');
    return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
  };
  $$('[data-wa]').forEach((a) => { a.href = waUrl(a.dataset.wa); });

  /* ------------------------------------------------------------------ 2. ONGLETS */
  const tabs = $$('.tab');
  const panels = $$('.panel');
  const stage = $('#stage');

  function selectTab(tab, { focus = false } = {}) {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
    });
    panels.forEach((panel) => {
      const on = panel.id === tab.getAttribute('aria-controls');
      panel.hidden = !on;
      panel.classList.remove('is-entering');
      if (on) {
        // force le rejeu de l'animation d'entrée
        void panel.offsetWidth;
        panel.classList.add('is-entering');
      }
    });
    if (stage && tab.dataset.color) stage.style.setProperty('--stage', tab.dataset.color);
    if (focus) tab.focus();
    tab.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => selectTab(tab));
    tab.addEventListener('keydown', (e) => {
      const keys = { ArrowRight: 1, ArrowLeft: -1, Home: 'first', End: 'last' };
      if (!(e.key in keys)) return;
      e.preventDefault();
      let next = i;
      if (keys[e.key] === 'first') next = 0;
      else if (keys[e.key] === 'last') next = tabs.length - 1;
      else next = (i + keys[e.key] + tabs.length) % tabs.length;
      selectTab(tabs[next], { focus: true });
    });
  });

  // état initial : premier onglet, sans animation d'entrée
  if (tabs.length) {
    const first = tabs.find((t) => t.getAttribute('aria-selected') === 'true') || tabs[0];
    tabs.forEach((t) => {
      const on = t === first;
      t.tabIndex = on ? 0 : -1;
    });
    panels.forEach((panel) => { panel.hidden = panel.id !== first.getAttribute('aria-controls'); });
    if (stage && first.dataset.color) stage.style.setProperty('--stage', first.dataset.color);
  }

  /* ------------------------------------------------------------------ 3. PANIER */
  const STORAGE_KEY = 'boutique-superlife:cart:v1';
  let cart = {}; // { id: quantité }

  const readCart = () => {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      Object.keys(raw).forEach((id) => {
        const q = parseInt(raw[id], 10);
        if (products.has(id) && q > 0) cart[id] = Math.min(q, CONFIG.maxQty);
      });
    } catch (_) { cart = {}; }
  };
  const writeCart = () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cart)); } catch (_) { /* stockage indisponible : on continue sans */ }
  };

  const els = {
    drawer: $('#cart'),
    scrim: $('.scrim'),
    list: $('#cart-list'),
    empty: $('#cart-empty'),
    foot: $('#cart-foot'),
    total: $('#cart-total'),
    totalValue: $('#cart-total-value'),
    send: $('#cart-send'),
    name: $('#f-name'),
    area: $('#f-area'),
    counts: $$('[data-cart-count]'),
    toast: $('#toast')
  };

  const lines = () => Object.keys(cart).map((id) => ({ ...products.get(id), qty: cart[id] }));
  const totalQty = () => lines().reduce((n, l) => n + l.qty, 0);
  const allPriced = () => { const l = lines(); return l.length > 0 && l.every((x) => x.price); };
  const totalPrice = () => lines().reduce((n, l) => n + (l.price || 0) * l.qty, 0);

  function buildMessage() {
    const rows = lines().map((l) => `• ${l.qty}${NBSP}×${NBSP}${l.name} (${l.unit})`);
    const parts = ['Bonjour, je souhaite commander :', '', ...rows];
    if (allPriced()) parts.push('', `Total estimé :${NBSP}${money(totalPrice())}`);
    const name = els.name.value.trim();
    const area = els.area.value.trim();
    if (name || area) parts.push('');
    if (name) parts.push(`Nom :${NBSP}${name}`);
    if (area) parts.push(`Livraison :${NBSP}${area}`);
    parts.push('', 'Merci de me confirmer la disponibilité, le prix et la livraison.');
    return parts.join('\n');
  }

  function renderCart() {
    const items = lines();
    const count = totalQty();

    els.counts.forEach((c) => { c.textContent = count; });
    els.empty.hidden = items.length > 0;
    els.foot.hidden = items.length === 0;

    els.list.innerHTML = '';
    items.forEach((l) => {
      const li = document.createElement('li');
      li.className = 'cart-item';
      li.dataset.id = l.id;
      li.innerHTML = `
        <img src="${l.thumb}" alt="" width="64" height="64">
        <div>
          <p class="ci-name"></p>
          <p class="ci-unit"></p>
        </div>
        <div class="ci-row">
          <div class="qty" role="group" aria-label="Quantité">
            <button type="button" data-act="minus" aria-label="Retirer un exemplaire">−</button>
            <output aria-live="polite"></output>
            <button type="button" data-act="plus" aria-label="Ajouter un exemplaire">+</button>
          </div>
          <span class="ci-price"></span>
          <button type="button" class="ci-remove" data-act="remove"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V4h6v3"/></svg></button>
        </div>`;
      $('.ci-name', li).textContent = l.name;
      $('.ci-unit', li).textContent = l.unit;
      $('output', li).textContent = l.qty;
      $('.ci-price', li).textContent = l.price ? money(l.price * l.qty) : 'Sur demande';
      $('[data-act="minus"]', li).setAttribute('aria-label', `Retirer un exemplaire de ${l.name}`);
      $('[data-act="plus"]', li).setAttribute('aria-label', `Ajouter un exemplaire de ${l.name}`);
      $('[data-act="remove"]', li).setAttribute('aria-label', `Retirer ${l.name} de la commande`);
      els.list.appendChild(li);
    });

    if (allPriced()) {
      els.total.hidden = false;
      els.totalValue.textContent = money(totalPrice());
    } else {
      els.total.hidden = true;
    }
    updateSendLink();
  }

  function updateSendLink() {
    if (!totalQty()) { els.send.removeAttribute('href'); return; }
    els.send.href = waUrl(buildMessage());
  }

  function setQty(id, qty) {
    if (qty <= 0) delete cart[id];
    else cart[id] = Math.min(qty, CONFIG.maxQty);
    writeCart();
    renderCart();
  }

  let toastTimer;
  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove('is-on'), 2400);
  }

  /* Ouverture / fermeture du panier, avec gestion du focus */
  let lastOpener = null;
  function openCart(opener) {
    lastOpener = opener || document.activeElement;
    els.toast.classList.remove('is-on');
    els.scrim.hidden = false;
    requestAnimationFrame(() => els.scrim.classList.add('is-open'));
    els.drawer.classList.add('is-open');
    els.drawer.setAttribute('aria-hidden', 'false');
    document.body.classList.add('is-locked');
    els.drawer.focus();
  }
  function closeCart() {
    els.drawer.classList.remove('is-open');
    els.drawer.setAttribute('aria-hidden', 'true');
    els.scrim.classList.remove('is-open');
    document.body.classList.remove('is-locked');
    setTimeout(() => { els.scrim.hidden = true; }, 300);
    if (lastOpener && document.contains(lastOpener)) lastOpener.focus({ preventScroll: true });
  }
  const isOpen = () => els.drawer.classList.contains('is-open');

  $$('[data-open-cart]').forEach((b) => b.addEventListener('click', () => openCart(b)));
  $$('[data-close-cart]').forEach((b) => b.addEventListener('click', closeCart));

  document.addEventListener('keydown', (e) => {
    if (!isOpen()) return;
    if (e.key === 'Escape') { closeCart(); return; }
    if (e.key === 'Tab') {
      const focusable = $$('a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])', els.drawer)
        .filter((el) => el.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === els.drawer)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  // Actions dans la liste (+, −, retirer)
  els.list.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const id = btn.closest('.cart-item').dataset.id;
    const act = btn.dataset.act;
    if (act === 'plus') setQty(id, (cart[id] || 0) + 1);
    if (act === 'minus') setQty(id, (cart[id] || 0) - 1);
    if (act === 'remove') setQty(id, 0);
  });

  // Ajout depuis une fiche produit
  $$('[data-add]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.add;
      setQty(id, (cart[id] || 0) + 1);
      toast(`${products.get(id).name} ajouté à votre commande`);
    });
  });

  // Champs nom / quartier : met à jour le message
  [els.name, els.area].forEach((input) => input.addEventListener('input', updateSendLink));

  // Envoi : on ferme le panier après l'ouverture de WhatsApp
  els.send.addEventListener('click', (e) => {
    if (!totalQty()) { e.preventDefault(); return; }
    updateSendLink();
    setTimeout(closeCart, 200);
  });

  readCart();
  renderCart();

  /* ------------------------------------------------------------------ 4. DÉTAILS */
  const header = $('.site-header');
  const sentinel = document.createElement('div');
  sentinel.setAttribute('aria-hidden', 'true');
  sentinel.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:8px;pointer-events:none';
  document.body.prepend(sentinel);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => header.classList.toggle('is-stuck', !entry.isIntersecting)).observe(sentinel);
  }

  const menuBtn = $('#menu-btn');
  const nav = $('#nav');
  const setMenu = (open) => {
    nav.classList.toggle('is-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
  };
  menuBtn.addEventListener('click', () => setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'));
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
})();
