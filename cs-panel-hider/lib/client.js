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
    const DIAG_ENDPOINT = '/__dsh-cs-panel-hider/diag';

    // ---- 自证通道 ----------------------------------------------------------
    // 把运行时状态 POST 给宿主落盘，外部即可程序化核对"隐藏规则是否生效"。
    // 这是样式契约断言（读 computed style 的 display），不是看屏幕。
    let lastSignature = '';
    function mark(stage, extra) {
      const event = extra ? { t: Date.now(), stage, ...extra } : { t: Date.now(), stage };
      try {
        fetch(DIAG_ENDPOINT, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ events: [event] }),
        }).catch(() => {});
      } catch { /* 宿主未就绪时静默 */ }
    }

    // 断言：目标节点若存在，其 computed display 必须是 none。
    function assertHidden(selector, label) {
      let present = false;
      let display = null;
      let visibility = null;
      try {
        const el = document.querySelector(selector);
        present = el !== null;
        if (present) {
          const cs = getComputedStyle(el);
          display = cs.display;
          visibility = cs.visibility;
        }
      } catch { /* 环境不可用 */ }
      return { label, present, display, visibility, hidden: present ? (display === 'none' || visibility === 'hidden') : null };
    }

    function probe() {
      try {
        const style = document.getElementById(STYLE_ID);
        const panel = assertHidden(PANEL_ROOT, 'panel');
        const toggle = assertHidden(TOGGLE_BUTTON, 'toggle');
        const bodyFlag = !!(document.body?.hasAttribute?.(PANEL_FLAG));
        const found = {
          styleInstalled: !!style,
          styleHasRule: !!style && style.textContent.includes(PANEL_ROOT),
          panel,
          toggle,
          bodyPanelFlag: bodyFlag,
        };
        const signature = JSON.stringify(found);
        if (signature !== lastSignature) {
          lastSignature = signature;
          mark('hide-probe', found);
        }
      } catch (err) {
        mark('hide-probe-failed', { message: String(err?.message ?? err) });
      }
    }

    // 诊断用：把会话头部工具栏（header-actions）里每个按钮的身份与可见性 dump 出来。
    // 只在需要排查"某个按钮不见了"时启用；默认关闭。
    function auditHeaderActions() {
      try {
        const roots = [
          '[data-dsh-claude-part~="header-actions"]',
          '[data-dsh-claude-part~="title-row"]',
          '[data-slot="conversation.header"]',
        ];
        const out = [];
        for (const sel of roots) {
          const host = document.querySelector(sel);
          if (!host) { out.push({ sel, present: false }); continue; }
          const buttons = host.querySelectorAll('button');
          const items = [];
          for (const b of buttons) {
            const cs = getComputedStyle(b);
            const r = b.getBoundingClientRect();
            items.push({
              aria: b.getAttribute('aria-label'),
              title: b.getAttribute('title'),
              cls: (b.getAttribute('class') || '').slice(0, 80),
              display: cs.display,
              visibility: cs.visibility,
              opacity: cs.opacity,
              w: Math.round(r.width),
              h: Math.round(r.height),
              x: Math.round(r.left),
              y: Math.round(r.top),
              hiddenByOurStyle: !!(styleEl && styleEl.textContent.includes(
                (b.getAttribute('class') || '').split(/\s+/).filter(Boolean)[0] || '\u0000')),
            });
          }
          out.push({ sel, present: true, count: buttons.length, buttons: items });
        }
        mark('header-audit', { roots: out });
      } catch (err) {
        mark('header-audit-failed', { message: String(err?.message ?? err) });
      }
    }
    // 诊断用：找出把某个元素隐藏掉的具体 CSS 规则（归因）。
    // 遍历所有可访问的样式表，收集同时满足"选择器命中该元素"且"声明里含 display:none /
    // visibility:hidden"的规则，并标明规则来自哪个样式表。
    function attributeHiders(el) {
      const out = [];
      if (!el) return out;
      let sheets = [];
      try { sheets = Array.from(document.styleSheets || []); } catch { sheets = []; }
      for (const sheet of sheets) {
        let rules = null;
        try { rules = sheet.cssRules; } catch { continue; }
        if (!rules) continue;
        const walk = (list, prefix) => {
          for (const rule of Array.from(list || [])) {
            if (rule.cssRules) { walk(rule.cssRules, prefix + (rule.conditionText || rule.name || '') + ' >> '); continue; }
            if (!rule.selectorText) continue;
            let matched = false;
            try { matched = el.matches(rule.selectorText); } catch { matched = false; }
            if (!matched) continue;
            const text = rule.style?.cssText || '';
            if (!/display\s*:\s*none|visibility\s*:\s*hidden/i.test(text)) continue;
            out.push({
              selector: rule.selectorText.slice(0, 200),
              css: text.slice(0, 200),
              origin: (prefix + (sheet.ownerNode?.id || sheet.ownerNode?.getAttribute?.('data-dsh-cs-panel-hider') !== null
                ? 'dsh-cs-panel-hider-style' : (sheet.href || 'inline'))).slice(0, 120),
              isOurs: !!sheet.ownerNode?.getAttribute?.('data-dsh-cs-panel-hider'),
            });
          }
        };
        walk(rules, '');
      }
      return out;
    }

    // 诊断用：全量 dump 视口右上角的每个按钮，并归因"谁把它隐藏了"。
    function auditTopRight() {
      try {
        const vw = document.documentElement.clientWidth;
        const vh = document.documentElement.clientHeight;
        const all = [];
        for (const b of document.querySelectorAll('button')) {
          const r = b.getBoundingClientRect();
          if (r.top > 70) continue;            // 只看顶部条带
          if (r.left < vw * 0.5) continue;      // 只看右半屏
          const cs = getComputedStyle(b);
          const hidden = cs.display === 'none' || cs.visibility === 'hidden' || r.width === 0;
          all.push({
            aria: b.getAttribute('aria-label'),
            title: b.getAttribute('title'),
            cls: (b.getAttribute('class') || '').slice(0, 90),
            dsr: b.getAttribute('data-sidebar-right-toggle') !== null ? 'toggle'
              : b.getAttribute('data-sidebar-right-mode') !== null ? 'mode' : null,
            display: cs.display,
            visibility: cs.visibility,
            opacity: cs.opacity,
            x: Math.round(r.left), y: Math.round(r.top),
            w: Math.round(r.width), h: Math.round(r.height),
            hidden,
            hiders: hidden ? attributeHiders(b) : [],
            parentCls: (b.parentElement?.getAttribute('class') || '').slice(0, 70),
          });
        }
        all.sort((p, q) => p.x - q.x);
        const rightNodes = [];
        for (const sel of ['[data-sidebar-right-open]', '[data-sidebar-right-toggle]',
          '[data-sidebar-right-panel]', '[data-side="rightbar"]', '[data-rightbar-col]']) {
          const el = document.querySelector(sel);
          rightNodes.push({
            sel, present: el !== null,
            display: el ? getComputedStyle(el).display : null,
            rect: el ? (() => { const r = el.getBoundingClientRect(); return { x: Math.round(r.left), w: Math.round(r.width) }; })() : null,
          });
        }
        mark('top-right-audit', { vw, vh, buttons: all, rightNodes });
      } catch (err) {
        mark('top-right-audit-failed', { message: String(err?.message ?? err) });
      }
    }
    // 诊断用：按坐标网格 dump 视口右上角矩形内的所有元素（不只 button），
    // 用于回答"那个位置本来该有个按钮，现在去哪儿了"。
    function auditRegion() {
      try {
        const vw = document.documentElement.clientWidth;
        const vh = document.documentElement.clientHeight;
        const x0 = Math.floor(vw * 0.55);
        const y0 = 0;
        const x1 = vw;
        const y1 = 60;
        const seen = new Map();
        for (let x = x0; x <= x1; x += 6) {
          for (let y = y0; y <= y1; y += 6) {
            let el = null;
            try { el = document.elementFromPoint(x, y); } catch { el = null; }
            if (!el) continue;
            // 上溯到最近的按钮/可交互祖先，方便识别
            let t = el;
            let guard = 0;
            while (t && guard < 8 && t.tagName !== 'BUTTON' && t.getAttribute('role') !== 'button') {
              t = t.parentElement; guard += 1;
            }
            const node = t || el;
            const key = (node.tagName || '?') + '|' + (node.getAttribute('class') || '') + '|' +
              (node.getAttribute('aria-label') || '') + '|' + (node.getAttribute('data-sidebar-right-toggle') !== null ? 'dsrt' : '');
            if (seen.has(key)) continue;
            const r = node.getBoundingClientRect();
            const cs = getComputedStyle(node);
            seen.set(key, {
              tag: node.tagName,
              aria: node.getAttribute('aria-label'),
              cls: (node.getAttribute('class') || '').slice(0, 90),
              dsrt: node.getAttribute('data-sidebar-right-toggle') !== null,
              dsrmode: node.getAttribute('data-sidebar-right-mode'),
              dsrpanel: node.getAttribute('data-sidebar-right-panel'),
              display: cs.display,
              visibility: cs.visibility,
              rect: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) },
              hiders: attributeHiders(node),
              html: (node.outerHTML || '').slice(0, 200),
            });
          }
        }
        mark('region-audit', { vw, vh, x0, x1, items: [...seen.values()] });
      } catch (err) {
        mark('region-audit-failed', { message: String(err?.message ?? err) });
      }
    }
    // 诊断用：全量记录文档里所有 button 的身份与可见性（含隐藏的）。
    function snapshotButtons(tag) {
      const list = [];
      for (const b of document.querySelectorAll('button')) {
        const cs = getComputedStyle(b);
        const r = b.getBoundingClientRect();
        list.push({
          aria: b.getAttribute('aria-label'),
          title: (b.getAttribute('title') || '').slice(0, 40),
          cls: (b.getAttribute('class') || '').slice(0, 80),
          dsrt: b.getAttribute('data-sidebar-right-toggle') !== null,
          display: cs.display,
          visibility: cs.visibility,
          opacity: cs.opacity,
          x: Math.round(r.left), y: Math.round(r.top),
          w: Math.round(r.width), h: Math.round(r.height),
          visible: cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0,
        });
      }
      list.sort((p, q) => (p.y - q.y) || (p.x - q.x));
      mark(tag, { count: list.length, buttons: list });
      return list;
    }

    // A/B 对照：在同一进程内，先审计"我们的样式生效时"，再临时移除我们的样式，
    // 审计一次，从而程序化地回答"是哪个按钮、是不是我们弄丢的"。
    function abCompare() {
      try {
        const ours = document.getElementById(STYLE_ID);
        const before = snapshotButtons('ab-before');
        let after = [];
        if (ours) {
          ours.remove();
          // 强制重算样式
          try { void document.body.offsetHeight; } catch {}
          after = snapshotButtons('ab-after');
          ours.textContent = CSS;   // 恢复
          document.head.appendChild(ours);
          try { void document.body.offsetHeight; } catch {}
        }
        const key = b => `${b.aria || ''}|${b.title}|${b.cls}|${b.dsrt}`;
        const beforeMap = new Map(before.map(b => [key(b), b]));
        const afterMap = new Map(after.map(b => [key(b), b]));
        const onlyBefore = before.filter(b => !afterMap.has(key(b)));
        const onlyAfter = after.filter(b => !beforeMap.has(key(b)));
        const changed = before.filter(b => {
          const a = afterMap.get(key(b));
          return a && a.visible !== b.visible;
        }).map(b => {
          const a = afterMap.get(key(b));
          return { ...b, visibleAfter: a.visible, displayAfter: a.display, visibilityAfter: a.visibility };
        });
        mark('ab-result', {
          removedByUs: onlyBefore.map(b => ({ ...b, visibleAfter: false })),
          appearedAfterRemoval: onlyAfter.map(b => ({ ...b, visibleBefore: false })),
          visibilityChanged: changed,
          styleRestored: !!document.getElementById(STYLE_ID),
        });
      } catch (err) {
        mark('ab-failed', { message: String(err?.message ?? err) });
      }
    }
    // 诊断用：右侧栏"展开按钮"与面板节点的现状。
    // 原生 DSH 的这个按钮在 slot conversation.session.header.corner，
    // 只在面板收起时渲染；展开后就消失（设计如此）。
    function auditExpandButton() {
      try {
        const out = [];
        for (const sel of ['[data-sidebar-right-expand]', '[data-sidebar-right-toggle]',
          '[data-sidebar-right-panel]', '[data-sidebar-right-open]', '[data-side="rightbar"]',
          '[data-rightbar-col]', '[data-slot="conversation.session.header.corner"]']) {
          const el = document.querySelector(sel);
          out.push({
            sel, present: el !== null,
            display: el ? getComputedStyle(el).display : null,
            rect: el ? (() => { const r = el.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; })() : null,
            aria: el ? el.getAttribute('aria-label') : null,
            hiders: el ? attributeHiders(el) : [],
          });
        }
        // 框架的三列布局：第三列是右栏
        const frame = document.querySelector('[data-dsh-claude-part="layout-frame"]');
        const cols = frame ? getComputedStyle(frame).gridTemplateColumns : null;
        mark('expand-audit', { nodes: out, frameCols: cols, vw: document.documentElement.clientWidth });
      } catch (err) {
        mark('expand-audit-failed', { message: String(err?.message ?? err) });
      }
    }
    // 诊断用：定位「会话详情」面板本体在文档中的位置与可见性，
    // 以及原生右侧栏展开按钮为何不在场。
    function auditPanelPlacement() {
      try {
        const panel = document.querySelector('.dsp-sidebar');
        let chain = null;
        if (panel) {
          chain = [];
          let n = panel;
          let g = 0;
          while (n && g < 12) {
            const r = n.getBoundingClientRect();
            const cs = getComputedStyle(n);
            chain.push({
              tag: n.tagName,
              cls: (n.getAttribute('class') || '').slice(0, 70),
              ds: Array.from(n.attributes || [])
                .filter(a => a.name.startsWith('data-'))
                .map(a => a.name + '=' + a.value).slice(0, 6),
              display: cs.display, visibility: cs.visibility, opacity: cs.opacity,
              position: cs.position, transform: cs.transform.slice(0, 40),
              rect: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) },
            });
            n = n.parentElement; g += 1;
          }
        }
        mark('panel-placement', {
          vw: document.documentElement.clientWidth,
          vh: document.documentElement.clientHeight,
          found: !!panel,
          chain,
        });
      } catch (err) {
        mark('panel-placement-failed', { message: String(err?.message ?? err) });
      }
    }
    let styleEl = null;

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
      styleEl = document.getElementById(STYLE_ID);
      mark('style-installed', { styleId: STYLE_ID });
      probe();
      const timer = setInterval(probe, 2000);

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

      // 诊断：启动后稍等一会儿 dump 一次头部工具栏按钮清单（排查按钮消失用）。
      setTimeout(() => { try { auditHeaderActions(); } catch { /* 忽略 */ } }, 3000);
      setTimeout(() => { try { auditTopRight(); } catch { /* 忽略 */ } }, 4000);
      setTimeout(() => { try { auditRegion(); } catch { /* 忽略 */ } }, 5000);
      setTimeout(() => { try { abCompare(); } catch { /* 忽略 */ } }, 7000);
      setTimeout(() => { try { auditExpandButton(); } catch { /* 忽略 */ } }, 9000);
      setTimeout(() => { try { auditPanelPlacement(); } catch { /* 忽略 */ } }, 11000);

      // 供宿主卸载时清理；原生 DSH 会在插件停用时调用返回的 disposer。
      return () => {
        try { clearInterval(timer); } catch { /* 忽略 */ }
        if (observer) observer.disconnect();
        const style = document.getElementById(STYLE_ID);
        if (style) style.remove();
      };
    }

    module.exports = { apply, inject };
    return module.exports;
  },
});
