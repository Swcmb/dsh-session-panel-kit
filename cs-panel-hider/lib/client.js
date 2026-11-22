// dsh-cs-panel-hider — client half (原生 DSH web module)
// 补丁插件：隐藏 dsh-claude-style 的会话详情栏与其顶部开关图标。
// 不修改 dsh-claude-style 的任何代码；只用 CSS + 轻量 DOM 观察隐藏它的节点。
// 只依赖原生 DSH（window.__ModuleLoader__），不依赖任何其它插件。
// Copyright (C) 2026 Swcmb
// SPDX-License-Identifier: GPL-3.0-or-later

window.__ModuleLoader__.load({
  id: '@local/dsh-cs-panel-hider',
  factory: (require) => {
    'use strict';
    const module = { exports: {} };
    const inject = [];

    const STYLE_ID = 'dsh-cs-panel-hider-style';
    const PANEL_ROOT = '.dsh-claude-details-root';
    const TOGGLE_BUTTON = '.dsh-claude-session-panel-button';
    const PANEL_FLAG = 'data-dsh-claude-session-panel';

    // dsh-claude-style 把详情栏挂成 body 下的 .dsh-claude-details-root，
    // 开关按钮落在会话头部 utilities 槽、class 为 .dsh-claude-session-panel-button。
    // 两者都是它自己 React 树里的节点，本插件不删节点、不碰它的状态，
    // 只用 CSS 永久隐藏 —— 这样原插件重渲染 / 重建节点时也依然生效。
    const CSS = [
      `${PANEL_ROOT}{display:none!important;visibility:hidden!important;`,
      'width:0!important;min-width:0!important;max-width:0!important;',
      'overflow:hidden!important;pointer-events:none!important}',
      `${TOGGLE_BUTTON}{display:none!important;visibility:hidden!important;`,
      'width:0!important;min-width:0!important;height:0!important;',
      'padding:0!important;margin:0!important;overflow:hidden!important;',
      'pointer-events:none!important}',
      // 面板是 fixed 定位、不占文档流，隐藏后对话区不会留空白。
      // dsh-claude-style 还用 body[panel-flag] 改写头部布局，属性清理见下方 observer。
    ].join('\n');

    function installStyle() {
      if (document.getElementById(STYLE_ID)) return;
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.setAttribute('data-dsh-cs-panel-hider', '');
      style.textContent = CSS;
      (document.head || document.documentElement).appendChild(style);
    }

    function apply() {
      installStyle();

      // CSS 已足够隐藏两个目标。观察器只处理 body 上的 data-dsh-claude-session-panel：
      // dsh-claude-style 用它把头部让位给面板（见它的 CSS），面板没了就该清掉，
      // 让头部回到正常布局。用 rAF 合并同一帧内的多次写入，避免"清属性→触发
      // mutation→再清"的忙循环。
      let scheduled = false;
      const cleanFlag = () => {
        if (scheduled) return;
        scheduled = true;
        const run = () => {
          scheduled = false;
          try { if (document.body?.hasAttribute(PANEL_FLAG)) document.body.removeAttribute(PANEL_FLAG); }
          catch { /* body 尚未就绪 */ }
        };
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run);
        else setTimeout(run, 0);
      };
      cleanFlag();

      let observer = null;
      try {
        observer = new MutationObserver(cleanFlag);
        observer.observe(document.documentElement || document.body, {
          attributes: true,
          attributeFilter: [PANEL_FLAG],
          subtree: true,
        });
      } catch { /* 环境不支持则只靠 CSS + 初始清理 */ }

      // 供宿主卸载时清理；原生 DSH 会在插件停用时调用返回的 disposer。
      return () => {
        if (observer) observer.disconnect();
        const style = document.getElementById(STYLE_ID);
        if (style) style.remove();
      };
    }

    module.exports = { apply, inject };
    return module.exports;
  },
});
