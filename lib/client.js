// dsh-session-panel — client half (原生 DSH web module)
// 右侧会话详情栏：环境 / 上下文 / 会话统计 / Token 用量 / 子智能体。
// 不依赖 dsh-claude-style；只依赖原生 DSH 提供的 react 与 slots，数据来自同源路由 /__dsh-session-panel。
// Copyright (C) 2026 Swcmb
// SPDX-License-Identifier: GPL-3.0-or-later
// 文案与分项算法移植自 dsh-claude-style (MIT, (c) 2026 Nwflower)。

window.__ModuleLoader__.load({
  id: '@local/dsh-session-panel',
  factory: (require) => {
    'use strict';
    const module = { exports: {} };
    const React = require('react');
    const h = React.createElement;
    const inject = ['slots'];

    const ROUTE = '/__dsh-session-panel';
    const POLL_MS = 2500;
    const STYLE_ID = 'dsh-session-panel-style';

    const COPY = {
      environment: '环境', thisComputer: '本机', context: '上下文',
      contextUsedPct: p => `已用 ${p}%`, contextFree: '剩余空间',
      sessionStats: '会话统计', tokenUsage: 'Token 用量', subagents: '子智能体',
      systemTokens: '系统提示', capabilityTokens: '工具、技能和MCP',
      conversationTokens: '对话正文', reasoningTokens: '推理过程',
      toolCallTokens: '执行过程', toolResultTokens: '工具结果',
      attachmentTokens: '文件与图片', injectionTokens: '上下文注入',
      statsTurns: '回合', statsSteps: '步骤', statsOutputSpeed: '输出速度',
      statsFirstToken: '首 token 平均', statsModelTime: '模型用时', statsToolTime: '工具调用用时',
      statsUncachedInput: '未缓存输入', statsCacheRead: '缓存读取', statsCacheWrite: '缓存写入',
      statsOutput: '输出', statsCost: '费用', statsCacheHit: '缓存命中',
      detailsToggle: '会话详情', sectionTurns: n => `${n} 回合`,
      unavailable: '会话总览暂不可用', noContext: '还没有上下文读数',
      running: '运行中', done: '已结束',
    };

    // 样式：面板内容渲染在 DSH 原生右侧栏里，颜色全部跟随 DSH 主题变量。
    const CSS = [
      '.dsp-sidebar{box-sizing:border-box;height:100%;overflow-y:auto;',
      'padding:14px 16px 40px;font:inherit;font-size:13px;',
      'color:var(--dsw-alias-label-primary,#1f2329);',
      'background:var(--dsw-alias-bg-layer-1,#ffffff)}',
      '.dsp-tab-title{font:inherit;font-size:12px;color:var(--dsw-alias-label-primary,#1f2329)}',
      '.dsp-sec{margin-bottom:18px}',
      '.dsp-sec-h{display:flex;align-items:center;justify-content:space-between;',
      'font-weight:600;font-size:13px;margin:0 0 8px;padding-bottom:6px;',
      'border-bottom:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.12))}',
      '.dsp-sec-summary{font-weight:400;font-size:12px;color:var(--dsw-alias-label-secondary,#646a73)}',
      '.dsp-row{display:flex;align-items:baseline;gap:8px;padding:4px 0;min-height:22px}',
      '.dsp-mark{width:14px;flex:0 0 14px;color:var(--dsw-alias-label-secondary,#646a73);text-align:center}',
      '.dsp-title{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.dsp-detail{color:var(--dsw-alias-label-secondary,#646a73);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:45%}',
      '.dsp-hint{color:var(--dsw-alias-label-caption,#8f959e);font-size:11px}',
      '.dsp-ctx-head{display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px}',
      '.dsp-ctx-fig{font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary,#646a73)}',
      '.dsp-bar{display:flex;height:7px;border-radius:4px;overflow:hidden;background:var(--dsw-alias-bg-layer-3,#e8eaed)}',
      '.dsp-seg{height:100%}',
      '.dsp-legend{margin:10px 0 0;display:grid;gap:5px;font-size:12px}',
      '.dsp-legend-row{display:grid;grid-template-columns:1fr auto 44px;gap:6px;align-items:center}',
      '.dsp-legend-row dt{display:flex;align-items:center;gap:7px;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.dsp-legend-row dd{margin:0;text-align:right;font-variant-numeric:tabular-nums}',
      '.dsp-legend-row .dsp-share{color:var(--dsw-alias-label-caption,#8f959e);font-size:11px}',
      '.dsp-dot{width:8px;height:8px;border-radius:2px;display:inline-block;flex:0 0 8px}',
      '.dsp-stats{margin:0;display:grid;gap:4px;font-size:12px}',
      '.dsp-stat{display:flex;justify-content:space-between;gap:10px;padding:2px 0}',
      '.dsp-stat dd{margin:0;font-variant-numeric:tabular-nums}',
      '.dsp-note{color:var(--dsw-alias-label-secondary,#646a73);font-size:12px;margin:0}',
      '.is-free{color:var(--dsw-alias-label-caption,#8f959e)}',
    ].join('\n');

    function injectStyle() {
      if (document.getElementById(STYLE_ID)) return;
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = CSS;
      document.head.appendChild(style);
    }

    // 分项颜色：与 DSH 深色主题协调的一套稳定配色。
    const COLORS = {
      system: '#8b8b95', capability: '#6f9bd8', conversation: '#6fbf9b',
      reasoning: '#b58ad6', 'tool-call': '#d2a15e', 'tool-result': '#d47a7a',
      attachment: '#7fb7c4', injection: '#a0a0ad', free: 'rgba(127,127,127,.35)',
    };

    function compact(n) {
      const v = Number(n) || 0;
      const whole = Math.round(v);
      if (whole < 1e3) return String(whole);
      const units = ['', 'k', 'M', 'B', 'T'];
      let u = 0, x = v;
      while (x >= 1000 && u < 4) { x /= 1000; u++; }
      return (Math.round(x * 10) / 10) + units[u];
    }
    function percent(value, whole) {
      if (!(whole > 0)) return '0';
      const p = Math.max(0, Math.min(100, value / whole * 100));
      if (p >= 99.95) return '100';
      return p >= 10 ? String(Math.round(p)) : String(Math.round(p * 10) / 10);
    }
    function baseName(path) {
      const n = String(path || '').replaceAll('\\', '/').replace(/\/+$/, '');
      const i = n.lastIndexOf('/');
      return i === -1 ? n : n.slice(i + 1);
    }
    function shortPath(path, home) {
      const n = String(path || '').replaceAll('\\', '/').replace(/\/+$/, '');
      const b = String(home || '').replaceAll('\\', '/').replace(/\/+$/, '');
      if (!b) return n;
      if (n === b) return '~';
      if (n.startsWith(b + '/')) return '~' + n.slice(b.length);
      return n;
    }
    function duration(ms) {
      const s = Math.max(0, Math.round((Number(ms) || 0) / 1000));
      if (s < 60) return s + 's';
      const m = Math.floor(s / 60), r = s % 60;
      if (m < 60) return m + ':' + String(r).padStart(2, '0');
      return Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0') + ':' + String(r).padStart(2, '0');
    }

    // 上下文分项：tools/mcp/skills 合并为“工具、技能和MCP”一行，按占比分配已用 token。
    const DISPLAY_ORDER = ['system', 'capability', 'conversation', 'reasoning', 'tool-call', 'tool-result', 'attachment', 'injection'];
    const LABELS = {
      system: COPY.systemTokens, capability: COPY.capabilityTokens, conversation: COPY.conversationTokens,
      reasoning: COPY.reasoningTokens, 'tool-call': COPY.toolCallTokens, 'tool-result': COPY.toolResultTokens,
      attachment: COPY.attachmentTokens, injection: COPY.injectionTokens,
    };
    function contextRows(context) {
      const parts = Array.isArray(context?.parts) ? context.parts : [];
      const total = parts.reduce((s, p) => s + (p.tokens || 0), 0);
      const used = Math.max(0, Math.round(context.used));
      const weights = Object.fromEntries(DISPLAY_ORDER.map(k => [k, 0]));
      for (const part of parts) {
        if (part.kind === 'tools' || part.kind === 'mcp' || part.kind === 'skills') weights.capability += part.tokens || 0;
        else if (weights[part.kind] !== undefined) weights[part.kind] += part.tokens || 0;
      }
      const wTotal = DISPLAY_ORDER.reduce((s, k) => s + weights[k], 0);
      const effective = total > 0 ? wTotal : 1;
      let allocated = 0, cumulative = 0;
      const rows = [];
      for (const kind of DISPLAY_ORDER) {
        const weight = total > 0 ? weights[kind] : (kind === 'injection' ? 1 : 0);
        if (weight <= 0) continue;
        cumulative += weight;
        const next = Math.round(used * cumulative / effective);
        const tokens = next - allocated;
        allocated = next;
        rows.push({ kind, label: LABELS[kind], tokens, share: context.window > 0 ? tokens / context.window * 100 : 0 });
      }
      return rows.sort((a, b) => b.tokens - a.tokens);
    }

    function Row({ mark, title, detail, hint }) {
      return h('div', { className: 'dsp-row' },
        mark ? h('span', { className: 'dsp-mark' }, mark) : null,
        h('span', { className: 'dsp-title', title: title }, title),
        detail ? h('span', { className: 'dsp-detail', title: detail }, detail) : null,
        hint ? h('span', { className: 'dsp-hint' }, hint) : null);
    }
    function Section({ title, summary, children }) {
      return h('section', { className: 'dsp-sec' },
        h('div', { className: 'dsp-sec-h' },
          h('span', null, title),
          summary ? h('span', { className: 'dsp-sec-summary' }, summary) : null),
        children);
    }

    function EnvironmentSection({ env }) {
      if (!env) return null;
      const rows = [
        h(Row, { key: 'pc', mark: '▣', title: COPY.thisComputer }),
        h(Row, { key: 'dir', mark: '▤', title: baseName(env.directory), detail: shortPath(env.directory, env.home) }),
      ];
      const co = env.checkout;
      if (co) {
        rows.push(h(Row, { key: 'branch', mark: '⑂', title: co.branch || co.commit || '', detail: co.repository || undefined }));
      }
      return h(Section, { key: 'env', title: COPY.environment, summary: baseName(env.directory) }, rows);
    }

    function ContextSection({ context }) {
      if (!context || !(context.window > 0)) {
        return h(Section, { key: 'ctx', title: COPY.context }, h('p', { className: 'dsp-note' }, COPY.noContext));
      }
      const used = Math.max(0, Math.min(context.window, context.used));
      const pct = percent(used, context.window);
      const rows = contextRows(context);
      const free = Math.max(0, context.window - used);
      return h(Section, { key: 'ctx', title: COPY.context, summary: pct + '%' },
        h('div', null,
          h('div', { className: 'dsp-ctx-head' },
            h('span', null, COPY.contextUsedPct(pct)),
            h('span', { className: 'dsp-ctx-fig' }, `${compact(used)} / ${compact(context.window)}`)),
          h('div', { className: 'dsp-bar', role: 'img', 'aria-label': COPY.contextUsedPct(pct) },
            rows.length
              ? rows.map(r => h('span', { key: r.kind, className: 'dsp-seg', style: { width: r.share + '%', background: COLORS[r.kind] } }))
              : h('span', { className: 'dsp-seg', style: { width: (used / context.window * 100) + '%', background: COLORS.system } })),
          h('dl', { className: 'dsp-legend', title: '分项按发送给模型的内容计价，并按比例分配至已用上下文' },
            rows.map(r => h('div', { key: r.kind, className: 'dsp-legend-row' },
              h('dt', null, h('i', { className: 'dsp-dot', style: { background: COLORS[r.kind] } }), r.label),
              h('dd', null, compact(r.tokens)),
              h('dd', { className: 'dsp-share' }, r.share.toFixed(1) + '%'))),
            h('div', { className: 'dsp-legend-row is-free' },
              h('dt', null, h('i', { className: 'dsp-dot', style: { background: COLORS.free } }), COPY.contextFree),
              h('dd', null, compact(free)),
              h('dd', { className: 'dsp-share' }, (context.window > 0 ? free / context.window * 100 : 0).toFixed(1) + '%')))));
    }

    function Figures({ rows }) {
      return h('dl', { className: 'dsp-stats' },
        rows.filter(r => r.value !== undefined && r.value !== null).map(r =>
          h('div', { key: r.key, className: 'dsp-stat' }, h('dt', null, r.label), h('dd', null, r.value))));
    }

    function StatsSection({ stats }) {
      if (!stats) return null;
      const rows = [
        { key: 'turns', label: COPY.statsTurns, value: String(stats.turns ?? 0) },
        { key: 'steps', label: COPY.statsSteps, value: String(stats.steps ?? 0) },
      ];
      if (stats.decodeMs > 0) {
        const tps = stats.decodeTokens / (stats.decodeMs / 1000);
        rows.push({ key: 'speed', label: COPY.statsOutputSpeed, value: (Math.round(tps * 10) / 10) + ' tok/s' });
      }
      if (stats.ttftSteps > 0) rows.push({ key: 'ttft', label: COPY.statsFirstToken, value: duration(stats.ttftMs / stats.ttftSteps) });
      rows.push({ key: 'model', label: COPY.statsModelTime, value: duration(stats.llmMs) });
      rows.push({ key: 'tool', label: COPY.statsToolTime, value: duration(stats.toolMs) });
      const speed = rows.find(r => r.key === 'speed')?.value;
      return h(Section, { key: 'stats', title: COPY.sessionStats, summary: speed || COPY.sectionTurns(stats.turns ?? 0) }, h(Figures, { rows }));
    }

    function TokensSection({ stats }) {
      if (!stats) return null;
      const billed = (stats.uncachedInputTokens ?? 0) + (stats.cacheReadTokens ?? 0) + (stats.cacheWriteTokens ?? 0);
      const rows = [];
      if (billed > 0) rows.push({ key: 'cache', label: COPY.statsCacheHit, value: Math.round((stats.cacheReadTokens / billed) * 100) + '%' });
      rows.push({ key: 'uncached', label: COPY.statsUncachedInput, value: compact(stats.uncachedInputTokens) + ' tok' });
      rows.push({ key: 'read', label: COPY.statsCacheRead, value: compact(stats.cacheReadTokens) + ' tok' });
      rows.push({ key: 'write', label: COPY.statsCacheWrite, value: compact(stats.cacheWriteTokens) + ' tok' });
      rows.push({ key: 'out', label: COPY.statsOutput, value: compact(stats.outputTokens) + ' tok' });
      return h(Section, { key: 'tokens', title: COPY.tokenUsage, summary: compact(billed + (stats.outputTokens ?? 0)) + ' tok' }, h(Figures, { rows }));
    }

    function SubagentsSection({ background }) {
      const list = Array.isArray(background?.subagents) ? background.subagents : [];
      if (list.length === 0) return null;
      const running = list.filter(a => a.running).length;
      const rows = list.map((a, i) => h(Row, {
        key: a.id || i, mark: '◆', title: a.label || a.id,
        detail: a.running ? COPY.running : COPY.done,
      }));
      return h(Section, { key: 'sub', title: COPY.subagents, summary: running > 0 ? `${running} 运行中` : `${list.length} 项${COPY.done}` }, rows);
    }

    function Panel({ value }) {
      if (value === null) return h('div', null, h('p', { className: 'dsp-note' }, COPY.unavailable));
      return h('div', null,
        h(EnvironmentSection, { env: value.environment }),
        h(ContextSection, { context: value.context }),
        h(StatsSection, { stats: value.stats }),
        h(TokensSection, { stats: value.stats }),
        h(SubagentsSection, { background: value.background }));
    }

    // 右侧栏面板：sessionId 由原生 slot 注入（inject(sessionId) => props）。
    function SidebarPanel({ sessionId }) {
      const [value, setValue] = React.useState(null);
      const id = typeof sessionId === 'string' && sessionId !== '' ? sessionId : '';

      React.useEffect(() => {
        if (id === '') return undefined;
        let timer = null, stopped = false, inFlight = false;
        const tick = async () => {
          if (stopped || document.hidden || inFlight) return;
          inFlight = true;
          try {
            const res = await fetch(`${ROUTE}?id=${encodeURIComponent(id)}`, { credentials: 'same-origin', headers: { accept: 'application/json' } });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const answer = await res.json();
            if (!stopped && answer?.ok === true) setValue(answer.value);
          } catch { /* 宿主尚未就绪，下一轮重试 */ }
          finally { inFlight = false; }
        };
        setValue(null);
        tick();
        timer = setInterval(tick, POLL_MS);
        return () => { stopped = true; if (timer) clearInterval(timer); };
      }, [id]);

      return h('div', { className: 'dsp-sidebar' }, h(Panel, { value }));
    }

    // tab 标题：原生右侧栏的标签头。
    function SidebarTabTitle() {
      return h('span', { className: 'dsp-tab-title' }, COPY.detailsToggle);
    }

    function applyWithCtx(ctx) {
      injectStyle();
      if (!ctx.slots || typeof ctx.slots.inject !== 'function' || typeof ctx.slots.register !== 'function') return;
      const KEY = 'dsh-session-panel';
      const disposers = [];
      // 面板内容 tab：inject 回调收到当前会话 id，作为 props 传给组件。
      disposers.push(ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
        name: 'sidebar.right.pane.tab',
        key: KEY,
        inject: (sessionId) => ({ sessionId }),
      }, SidebarPanel)));
      // tab 标题。
      disposers.push(ctx.slots.inject('sidebar.right.pane.tab.title', () => ctx.slots.register({
        name: 'sidebar.right.pane.tab.title',
        key: KEY,
      }, SidebarTabTitle)));
    }

    module.exports = { apply: applyWithCtx, inject };
    return module.exports;
  },
});
