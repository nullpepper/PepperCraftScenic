/* PepperCraft · Scenic
   页面在没有脚本时也完整可读；这里只做五件事：
   开服天数、数字滚动、实时在线、复制地址、滚动增强。 */

(() => {
  'use strict';

  const SITE = {
    ip: 'pepper.ltd',
    start: '2023-02-20',
    maxPlayers: 2333,
    pollMs: 60_000,
    resetMs: 2_000,
    countMs: 1_400,
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  /* -------------------------------------------------------
     开服天数（按 Asia/Shanghai 自然日，开服当天为第 1 天）
     ------------------------------------------------------- */

  const dayFormat = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  function daysSince(start, now) {
    const [sy, sm, sd] = start.split('-').map(Number);
    const [y, m, d] = dayFormat.format(now).split('-').map(Number);
    const diff = Math.round(
      (Date.UTC(y, m - 1, d) - Date.UTC(sy, sm - 1, sd)) / 86_400_000,
    );
    return Math.max(0, diff + 1);
  }

  // 千分位格式化：可见数字与 aria-label 必须用同一种写法
  const countFormat = new Intl.NumberFormat('en-US');

  function renderDays() {
    const days = daysSince(SITE.start, new Date());
    for (const el of $$('[data-days]')) {
      // 静态兜底是「1,300 天+」这种长期成立的近似值，不覆盖它，
      // 只把精确天数交给计数动画（它读 data-count）与 aria-label。
      el.setAttribute('aria-label', `已开服 ${countFormat.format(days)} 天`);
      el.dataset.count = String(days);
    }
  }

  /* -------------------------------------------------------
     数字滚动（进入视口时从 0 累加到目标值）
     ------------------------------------------------------- */

  const prefersLessMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  );

  function readCount(el) {
    const value = $('.stat-value', el) ?? el;
    // 精确值优先取 data-count：静态兜底可能是「1,300 天+」这类近似写法，
    // 而 parseInt('1,300') 会得到 1。
    const raw =
      el.dataset.count ?? value.textContent.replace(/[^\d]/g, '').trim();
    const target = Number.parseInt(raw, 10);
    if (!Number.isFinite(target) || target <= 0) return null;
    return { value, target, label: el.getAttribute('aria-label') };
  }

  function countUp(el, target, value, label) {
    // 保留静态兜底里的角标（「天+」「+」），只滚动数字
    const suffix = $('.stat-suffix', el)?.textContent ?? '';

    const settle = (shown) => {
      value.textContent = shown;
      el.setAttribute('aria-label', label ?? `${shown}${suffix}`);
    };

    // 尊重系统的“减少动态效果”：直接给出终值，不做逐帧滚动
    if (prefersLessMotion.matches) {
      settle(countFormat.format(target));
      return;
    }

    const started = performance.now();

    const step = (now) => {
      const progress = Math.min(1, (now - started) / SITE.countMs);
      const eased = 1 - (1 - progress) ** 3;
      if (progress < 1) {
        value.textContent = countFormat.format(Math.round(target * eased));
        window.requestAnimationFrame(step);
        return;
      }
      settle(countFormat.format(target));
    };

    window.requestAnimationFrame(step);
  }

  function startCount() {
    const stats = $$('.stat-number');
    if (!stats.length) return;

    const entries = [];
    for (const el of stats) {
      const found = readCount(el);
      if (found) entries.push([el, found]);
    }
    if (!entries.length) return;

    const run = (el, found) => countUp(el, found.target, found.value, found.label);

    if (prefersLessMotion.matches || !('IntersectionObserver' in window)) {
      for (const [el, found] of entries) run(el, found);
      return;
    }

    const observer = new IntersectionObserver(
      (records) => {
        for (const record of records) {
          if (!record.isIntersecting) continue;
          const found = entries.find(([el]) => el === record.target)?.[1];
          if (found) run(record.target, found);
          observer.unobserve(record.target);
        }
      },
      { rootMargin: '0px 0px -6% 0px', threshold: 0.35 },
    );

    for (const [el] of entries) observer.observe(el);
  }

  /* -------------------------------------------------------
     实时状态：uapis.cn → mcstatus.io → 保留上次结果
     ------------------------------------------------------- */

  const sources = [
    {
      url: (host) =>
        `https://uapis.cn/api/v1/game/minecraft/serverstatus?server=${host}`,
      players: (data) => data.players,
      max: (data) => data.max_players,
    },
    {
      url: (host) => `https://api.mcstatus.io/v2/status/java/${host}`,
      players: (data) => data.players?.online,
      max: (data) => data.players?.max,
    },
  ];

  function toCount(raw, fallback) {
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      return Math.max(0, Math.floor(raw));
    }
    if (typeof raw === 'string') {
      const n = Number.parseInt(raw, 10);
      if (!Number.isNaN(n)) return Math.max(0, n);
    }
    return fallback ?? 0;
  }

  async function query(url, timeoutMs = 8000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!data || typeof data !== 'object' || typeof data.online !== 'boolean') {
        throw new Error('unexpected payload');
      }
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  let status = {
    state: 'loading',
    players: null,
    max: SITE.maxPlayers,
  };

  async function fetchStatus() {
    for (const source of sources) {
      let data;
      try {
        data = await query(source.url(SITE.ip));
      } catch {
        continue;
      }

      if (data.online === false) {
        status = { state: 'offline', players: 0, max: status.max };
        return status;
      }

      status = {
        state: 'online',
        players: toCount(source.players(data), status.players),
        max: toCount(source.max(data), status.max) || status.max,
      };
      return status;
    }

    status = { ...status, state: 'error' };
    return status;
  }

  function renderStatus() {
    let line = '正在查询…';
    let tone = 'muted';

    if (status.state === 'online') {
      const players = status.players ?? 0;
      tone = 'on';
      line = players === 0 ? '在线 0 人 · 此刻安静' : `在线 ${players} 人`;
    } else if (status.state === 'offline') {
      line = '暂时离线';
      tone = 'off';
    } else if (status.state === 'error') {
      line = '状态暂不可用';
    }

    for (const el of $$('[data-status-line]')) {
      el.dataset.tone = tone;
      const text = $('span', el);
      if (text) text.textContent = line;
      else el.textContent = line;
    }
  }

  let pollTimer = 0;

  function schedulePoll() {
    window.clearTimeout(pollTimer);
    if (!document.hidden) {
      pollTimer = window.setTimeout(tickStatus, SITE.pollMs);
    }
  }

  async function tickStatus() {
    await fetchStatus();
    renderStatus();
    schedulePoll();
  }

  function startStatus() {
    if (!$('[data-status-line]')) return;
    renderStatus();
    tickStatus();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        window.clearTimeout(pollTimer);
      } else {
        tickStatus();
      }
    });
  }

  /* -------------------------------------------------------
     复制
     ------------------------------------------------------- */

  async function copyText(text) {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        /* 落到 textarea 方案 */
      }
    }

    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.cssText = 'position:fixed;top:-9999px;opacity:0';
    document.body.appendChild(area);
    try {
      area.select();
      return document.execCommand('copy') === true;
    } catch {
      return false;
    } finally {
      area.remove();
    }
  }

  function selectAddress(button) {
    const scope = button.closest('.hero, .join-panel');
    const target = scope?.querySelector('[data-copy-target]');
    if (!target) return;
    const range = document.createRange();
    range.selectNodeContents(target);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  const resetTimers = new WeakMap();
  const labels = new WeakMap();

  function buttonLabel(button) {
    if (!labels.has(button)) {
      labels.set(button, button.textContent);
    }
    return labels.get(button);
  }

  function setButtonLabel(button, text, state) {
    button.textContent = text;
    if (state) button.dataset.state = state;
    else delete button.dataset.state;
  }

  async function onCopy(button) {
    const value = button.dataset.copy ?? '';
    const original = buttonLabel(button).trim();
    const ok = await copyText(value);

    setButtonLabel(button, ok ? '已复制 ✓' : '请手动复制', ok ? 'done' : 'fail');

    const live = $('#copy-live');
    if (live) {
      live.textContent = ok
        ? `已复制 ${value}`
        : `复制失败，请手动复制 ${value}`;
    }

    if (!ok) selectAddress(button);

    window.clearTimeout(resetTimers.get(button));
    resetTimers.set(
      button,
      window.setTimeout(() => {
        setButtonLabel(button, original);
      }, SITE.resetMs),
    );
  }

  function startCopy() {
    document.addEventListener('click', (event) => {
      const button = event.target instanceof Element
        ? event.target.closest('[data-copy]')
        : null;
      if (button) onCopy(button);
    });
  }

  /* -------------------------------------------------------
     顶部栏与滚动入场
     ------------------------------------------------------- */

  function startNav() {
    const head = $('[data-head]');
    const toggle = $('[data-nav-toggle]');
    const nav = $('#site-nav');
    if (!head || !toggle || !nav) return;

    const setOpen = (open, returnFocus = false) => {
      head.classList.toggle('is-menu-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? '关闭导航' : '打开导航');

      if (open) {
        $('a', nav)?.focus();
      } else if (returnFocus) {
        toggle.focus();
      }
    };

    toggle.addEventListener('click', () => {
      setOpen(!head.classList.contains('is-menu-open'));
    });

    nav.addEventListener('click', (event) => {
      if (event.target instanceof Element && event.target.closest('a')) {
        setOpen(false, true);
      }
    });

    document.addEventListener('click', (event) => {
      if (
        !head.contains(event.target) &&
        head.classList.contains('is-menu-open')
      ) {
        setOpen(false);
      }
    });

    document.addEventListener('keydown', (event) => {
      if (
        event.key === 'Escape' &&
        head.classList.contains('is-menu-open')
      ) {
        setOpen(false, true);
      }
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 820) setOpen(false);
    });
  }

  function startHeader() {
    const head = $('[data-head]');
    if (!head) return;
    const faq = $('#faq');
    let ticking = false;

    const update = () => {
      head.classList.toggle('is-scrolled', window.scrollY > 18);
      if (faq) {
        const rect = faq.getBoundingClientRect();
        const headHeight = head.offsetHeight;
        head.classList.toggle(
          'is-paper',
          rect.top <= headHeight && rect.bottom > headHeight,
        );
      }
      ticking = false;
    };

    const requestUpdate = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate, { passive: true });
  }

  function startReveal() {
    if (!('IntersectionObserver' in window)) return;

    const targets = $$(
      '.chapter-head, .tile, .world-stats, .promise-inner, .steps li, .join-panel, .faq-head, .faq-list',
    );
    if (!targets.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('is-revealed');
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -6% 0px', threshold: 0.08 },
    );

    targets.forEach((el, index) => {
      el.classList.add('will-reveal');
      el.style.transitionDelay = `${Math.min(index % 4, 3) * 55}ms`;
      observer.observe(el);
    });
  }

  renderDays();
  startCount();
  startStatus();
  startCopy();
  startNav();
  startHeader();
  startReveal();
})();
