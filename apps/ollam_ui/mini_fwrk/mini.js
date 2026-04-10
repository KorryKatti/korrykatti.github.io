/* mini.js  v2  —  minimal JS utilities for side projects */
/* Usage: <script src="mini.js"></script>                  */

const Mini = (() => {

  /* ─── DOM helpers ─────────────────────────────────── */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
  const el = (tag, attrs = {}, ...children) => {
    const e = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'class') e.className = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v);
    });
    children.flat().forEach(c =>
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c)
    );
    return e;
  };
  const on = (target, event, selector, fn) => {
    if (fn === undefined) { target.addEventListener(event, selector); return; }
    target.addEventListener(event, e => {
      const match = e.target.closest(selector);
      if (match) fn.call(match, e, match);
    });
  };

  /* ─── Toast ───────────────────────────────────────── */
  let _toastBox;
  const _getToastBox = () => {
    if (!_toastBox) {
      _toastBox = el('div', { class: 'toast-container' });
      document.body.appendChild(_toastBox);
    }
    return _toastBox;
  };
  const toast = (msg, { type = '', duration = 3500, icon = '' } = {}) => {
    const icons = { success: '✓', danger: '✕', warning: '⚠', info: 'ℹ' };
    const ic = icon || icons[type] || '';
    const t = el('div', { class: `toast ${type ? 'toast-' + type : ''}` });
    if (ic) t.appendChild(el('span', { style: 'font-size:.95rem;flex-shrink:0' }, ic));
    t.appendChild(document.createTextNode(msg));
    _getToastBox().appendChild(t);
    setTimeout(() => {
      t.style.transition = 'opacity .3s, transform .3s';
      t.style.opacity = '0';
      t.style.transform = 'translateX(110%)';
      setTimeout(() => t.remove(), 300);
    }, duration);
    return t;
  };

  /* ─── Modal ───────────────────────────────────────── */
  const modal = ({ title = '', content = '', footer = '', onClose } = {}) => {
    const backdrop = el('div', { class: 'modal-backdrop' });
    const closeBtn = el('button', { class: 'modal-close' }, '✕');
    const m = el('div', { class: 'modal' });
    if (title) {
      const hdr = el('div', { class: 'modal-header' });
      hdr.appendChild(el('div', { class: 'modal-title' }, title));
      hdr.appendChild(closeBtn);
      m.appendChild(hdr);
    }
    const body = el('div', { class: 'modal-body' });
    if (typeof content === 'string') body.innerHTML = content;
    else body.appendChild(content);
    m.appendChild(body);
    if (footer) {
      const ftr = el('div', { class: 'modal-footer' });
      if (typeof footer === 'string') ftr.innerHTML = footer;
      else ftr.appendChild(footer);
      m.appendChild(ftr);
    }
    backdrop.appendChild(m);
    document.body.appendChild(backdrop);
    const close = () => { backdrop.remove(); onClose?.(); };
    closeBtn.addEventListener('click', close);
    backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
    });
    return { el: backdrop, close };
  };

  /* ─── Confirm dialog ──────────────────────────────── */
  const confirm = (msg, opts = {}) => new Promise(resolve => {
    const ftr = document.createDocumentFragment();
    const cancel = el('button', { class: 'btn btn-ghost btn-sm' }, opts.cancelText || 'Cancel');
    const ok = el('button', { class: 'btn btn-primary btn-sm' }, opts.okText || 'Confirm');
    ftr.appendChild(cancel);
    ftr.appendChild(ok);
    const m = modal({ title: opts.title || 'Confirm', content: msg, footer: ftr });
    ok.addEventListener('click',     () => { m.close(); resolve(true); });
    cancel.addEventListener('click', () => { m.close(); resolve(false); });
  });

  /* ─── Tabs ────────────────────────────────────────── */
  const tabs = (container) => {
    const tabEls = $$('.tab', container);
    const panels = $$('.tab-panel', container);
    const activate = idx => {
      tabEls.forEach((t, i) => t.classList.toggle('active', i === idx));
      panels.forEach((p, i) => p.classList.toggle('active', i === idx));
    };
    tabEls.forEach((t, i) => t.addEventListener('click', () => activate(i)));
    activate(0);
  };
  document.addEventListener('DOMContentLoaded', () => {
    $$('[data-tabs]').forEach(tabs);
  });

  /* ─── Fetch wrapper ───────────────────────────────── */
  const api = async (url, { method = 'GET', body, headers = {}, json = true } = {}) => {
    const opts = {
      method,
      headers: { ...(json && body ? { 'Content-Type': 'application/json' } : {}), ...headers },
    };
    if (body) opts.body = json ? JSON.stringify(body) : body;
    const res = await fetch(url, opts);
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}`);
      err.status = res.status;
      try { err.data = await res.json(); } catch {}
      throw err;
    }
    const ct = res.headers.get('content-type') || '';
    return ct.includes('application/json') ? res.json() : res.text();
  };
  api.get  = (url, opts)       => api(url, { ...opts, method: 'GET' });
  api.post = (url, body, opts) => api(url, { ...opts, method: 'POST', body });
  api.put  = (url, body, opts) => api(url, { ...opts, method: 'PUT', body });
  api.del  = (url, opts)       => api(url, { ...opts, method: 'DELETE' });

  /* ─── Local storage helpers ───────────────────────── */
  const store = {
    get:   (key, fallback = null) => { try { const v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : fallback; } catch { return fallback; } },
    set:   (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} },
    del:   (key) => localStorage.removeItem(key),
    clear: ()    => localStorage.clear(),
  };

  /* ─── Simple reactive state ───────────────────────── */
  const reactive = (initial = {}) => {
    const listeners = [];
    const state = { ...initial };
    const proxy = new Proxy(state, {
      set(t, k, v) { t[k] = v; listeners.forEach(fn => fn({ ...t })); return true; }
    });
    proxy.subscribe = fn => { listeners.push(fn); fn({ ...state }); };
    return proxy;
  };

  /* ─── Simple router ───────────────────────────────── */
  const router = routes => {
    const match = () => {
      const hash = location.hash.slice(1) || '/';
      (routes[hash] || routes['*'])?.(hash);
    };
    window.addEventListener('hashchange', match);
    match();
  };

  /* ─── Utilities ───────────────────────────────────── */
  const debounce  = (fn, ms = 250) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const throttle  = (fn, ms = 200) => { let last = 0; return (...a) => { const now = Date.now(); if (now - last >= ms) { last = now; fn(...a); } }; };
  const clamp     = (v, min, max)  => Math.min(Math.max(v, min), max);
  const rand      = (min, max)     => Math.floor(Math.random() * (max - min + 1)) + min;
  const uuid      = ()             => crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
  const slugify   = str            => str.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
  const formatDate = (d, locale = 'en-IN') =>
    new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(d));
  const formatNum      = (n, opts = {}) => new Intl.NumberFormat('en-IN', opts).format(n);
  const formatCurrency = (n, currency = 'INR') => formatNum(n, { style: 'currency', currency });
  const copyText = async text => { await navigator.clipboard.writeText(text); toast('Copied!', { type: 'success', duration: 1500 }); };
  const sleep    = ms => new Promise(r => setTimeout(r, ms));

  /* ─── Form helpers ────────────────────────────────── */
  const formData = form => Object.fromEntries(new FormData(form));
  const formValidate = (form, rules = {}) => {
    let valid = true;
    Object.entries(rules).forEach(([name, checks]) => {
      const input = form.elements[name];
      if (!input) return;
      const val = input.value.trim();
      let err = '';
      if (checks.required && !val)                           err = checks.required === true ? 'Required' : checks.required;
      else if (checks.minLength && val.length < checks.minLength) err = `Min ${checks.minLength} chars`;
      else if (checks.pattern && !checks.pattern.test(val))  err = checks.patternMsg || 'Invalid format';
      else if (checks.custom)                                 err = checks.custom(val) || '';
      const grp = input.closest('.form-group');
      const existing = grp?.querySelector('.form-error');
      if (err) {
        valid = false;
        input.classList.add('is-error');
        if (grp && !existing) grp.appendChild(el('div', { class: 'form-error' }, err));
        else if (existing) existing.textContent = err;
      } else {
        input.classList.remove('is-error');
        existing?.remove();
      }
    });
    return valid;
  };

  /* ─── Progress bar helper ─────────────────────────── */
  const progress = (el, value) => {
    const bar = el.querySelector('.progress-bar') || el;
    bar.style.width = `${clamp(value, 0, 100)}%`;
    bar.setAttribute('aria-valuenow', value);
  };

  return {
    $, $$, el, on,
    toast, modal, confirm,
    tabs,
    api, store,
    reactive, router,
    debounce, throttle,
    clamp, rand, uuid, slugify, sleep,
    formatDate, formatNum, formatCurrency,
    copyText, formData, formValidate, progress,
  };
})();

const { $, $$, el, on, toast, modal, confirm, api, store, reactive, router,
        debounce, throttle, clamp, rand, uuid, slugify, sleep,
        formatDate, formatNum, formatCurrency,
        copyText, formData, formValidate, progress } = Mini;
