// dsh-default-sidebar-tab — client half (原生 DSH web module)
// 用户打开右侧栏、原生播种「开始」页(guide)时，用配置的 tab 原位替换它。
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
    const GUIDE_KIND = 'guide';
    const MAX_RETRIES = 10;      // kind 可能稍后才注册；覆盖约 5s
    const RETRY_MS = 500;

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
      if (!enabled || defaultTab === GUIDE_KIND) return; // 关闭，或目标就是开始页

      const handled = new Set();     // 已成功替换的会话
      const attempts = new Map();    // sessionId -> 已重试次数
      const timers = new Set();
      let disposed = false;

      const currentSession = () => {
        try { return sidebar.mounted?.getSnapshot?.(); } catch { return undefined; }
      };
      const openTabsOf = () => {
        let tabs = [];
        try { tabs = sidebar.openTabs?.getSnapshot?.() ?? []; } catch { tabs = []; }
        return Array.isArray(tabs) ? tabs : [];
      };
      const guideTabOf = (sessionId) => openTabsOf().find(
        (t) => t && t.sessionId === sessionId && t.kind === GUIDE_KIND && typeof t.tabId === 'string'
      );

      const scheduleRetry = (sessionId) => {
        const count = attempts.get(sessionId) ?? 0;
        if (count >= MAX_RETRIES) return;
        attempts.set(sessionId, count + 1);
        const timer = setTimeout(() => tryReplace(sessionId), RETRY_MS);
        timers.add(timer);
      };

      function tryReplace(sessionId) {
        if (disposed) return;
        if (typeof sessionId !== 'string' || sessionId === '') return;
        if (handled.has(sessionId)) return;

        // 只有一个会话正在屏幕上，guide 属于它才算。
        const guide = guideTabOf(sessionId);
        if (!guide) return; // 当前没有开始页 tab → 不作任何动作（不主动展开侧栏）

        try {
          // 原生 replaceTab：新 tab 取代 guide 的位置并关掉 guide；
          // 若该 kind 已打开则直接聚焦它，不会开重复。
          sidebar.openTab(defaultTab, { replaceTab: guide.tabId });
          handled.add(sessionId);
          attempts.delete(sessionId);
        } catch (_err) {
          // 配置的 kind 未注册（对应插件没装/没启用）→ 有限重试后放弃，保留原生开始页。
          scheduleRetry(sessionId);
        }
      }

      const runForMounted = () => tryReplace(currentSession());
      const unsubMounted = sidebar.mounted?.subscribe?.(runForMounted);
      const unsubTabs = sidebar.openTabs?.subscribe?.(runForMounted);

      // 首帧：会话与布局可能在插件加载前就就绪。
      runForMounted();

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
