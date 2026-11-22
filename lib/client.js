// dsh-default-sidebar-tab — client half (原生 DSH web module)
// 打开右边栏时，若该会话还没有任何 tab，则按配置播种默认展示内容。
// 只依赖原生 DSH：window.__ModuleLoader__ + ctx.sidebarRight（原生导航控制器）+ 全局配置注入。
// 不依赖任何第三方插件、不改任何包、不直接改写 sidebar 的持久化状态。
// Copyright (C) 2026 Swcmb
// SPDX-License-Identifier: GPL-3.0-or-later

window.__ModuleLoader__.load({
  id: '@local/dsh-default-sidebar-tab',
  factory: (require) => {
    'use strict';
    const module = { exports: {} };
    // sidebarRight 是原生 dsh-client-ui-sidebar-right 通过 ctx.reflect.provide 发布的服务。
    // 声明 inject 后 apply 收到的 ctx 直接带 sidebarRight 控制器（mounted / openTabs / openTab）。
    const inject = ['sidebarRight'];

    const INJECT_GLOBAL = '__DSH_DEFAULT_SIDEBAR_TAB__';
    const DEFAULT_TAB = 'session-inspector-log';
    const FALLBACK_TAB = 'guide';
    const MAX_RETRIES = 12;      // 会话 seat 建 store 有异步窗口，重试覆盖约 3.6s
    const RETRY_MS = 300;

    function readConfig() {
      try {
        const value = window[INJECT_GLOBAL];
        if (value && typeof value === 'object') {
          const tab = typeof value.defaultTab === 'string' && value.defaultTab.trim() !== ''
            ? value.defaultTab.trim() : DEFAULT_TAB;
          return { defaultTab: tab, enabled: value.enabled !== false };
        }
      } catch { /* 全局未注入时用默认值 */ }
      return { defaultTab: DEFAULT_TAB, enabled: true };
    }

    function apply(ctx) {
      const sidebar = ctx.sidebarRight;
      if (!sidebar || typeof sidebar.openTab !== 'function') return; // 原生 sidebar 未就绪，静默降级

      const { defaultTab, enabled } = readConfig();
      if (!enabled) return;

      const seeded = new Set();      // 已成功播种的会话
      const attempts = new Map();    // sessionId -> 已重试次数
      const timers = new Set();
      let disposed = false;

      const currentSession = () => {
        try { return sidebar.mounted?.getSnapshot?.(); } catch { return undefined; }
      };
      const openTabsOf = (sessionId) => {
        let tabs = [];
        try { tabs = sidebar.openTabs?.getSnapshot?.() ?? []; } catch { tabs = []; }
        return Array.isArray(tabs) ? tabs : [];
      };

      const scheduleRetry = (sessionId) => {
        const count = attempts.get(sessionId) ?? 0;
        if (count >= MAX_RETRIES) return;
        attempts.set(sessionId, count + 1);
        const timer = setTimeout(() => trySeed(sessionId), RETRY_MS);
        timers.add(timer);
      };

      function trySeed(sessionId) {
        if (disposed) return;
        if (typeof sessionId !== 'string' || sessionId === '') return;
        if (seeded.has(sessionId)) return;

        // 该会话已有任何 tab（原生播种的 guide 或用户手动开的）→ 不覆盖。
        const hasAny = openTabsOf(sessionId).some((t) => t && t.sessionId === sessionId);
        if (hasAny) return;

        // 先试着开配置的 kind；未注册（对应插件没装）时回退原生开始页。
        let kind = defaultTab;
        try {
          sidebar.openTab(kind, { revealIfOpened: false });
        } catch (_err) {
          if (kind === FALLBACK_TAB) { scheduleRetry(sessionId); return; }
          try {
            sidebar.openTab(FALLBACK_TAB, { revealIfOpened: false });
            kind = FALLBACK_TAB;
          } catch (_err2) {
            // store 尚未建好，稍后重试；若是 kind 未注册且 fallback 也失败，重试也只是等 store。
            scheduleRetry(sessionId);
            return;
          }
        }
        seeded.add(sessionId); // 成功播种，之后不再插手
        attempts.delete(sessionId);
      }

      const unsubMounted = sidebar.mounted?.subscribe?.(() => trySeed(currentSession()));
      const unsubTabs = sidebar.openTabs?.subscribe?.(() => {
        const s = currentSession();
        if (s) trySeed(s);
      });

      // 首帧：会话可能在插件加载前就已选中；重试用 rAF 让出 seat 建 store 的时间。
      trySeed(currentSession());
      const kickTimer = setTimeout(() => trySeed(currentSession()), RETRY_MS);
      timers.add(kickTimer);

      return () => {
        disposed = true;
        for (const t of timers) { try { clearTimeout(t); } catch { /* 忽略 */ } }
        timers.clear();
        try { unsubMounted?.(); } catch { /* 忽略 */ }
        try { unsubTabs?.(); } catch { /* 忽略 */ }
      };
    }

    module.exports = { apply, inject };
    return module.exports;
  },
});
