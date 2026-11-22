// dsh-default-sidebar-tab — shared pure logic (host + client).
// 配置解析、默认 tab 校验、播种判定。无平台依赖，便于 node --test 直接跑。
// Copyright (C) 2026 Swcmb
// SPDX-License-Identifier: GPL-3.0-or-later

/** 缺省默认页：会话详情（原生 dsh-experimental-session-inspector 注册，kind 稳定）。 */
export const DEFAULT_TAB = 'session-inspector-log';

/**
 * 已知的原生存活 kind。仅用于「宽容校验」——不在表里的 kind 也允许配置
 * （第三方插件可注册自己的 kind），只是不保证一定注册成功；openTab 对未
 * 注册的 kind 会 throw，client 半会 try/catch 并回退到 guide。
 */
export const KNOWN_KINDS = Object.freeze([
  'session-inspector-log', // 会话详情（原生 inspector bundle）
  'guide',                 // 开始页（原生默认）
  'files',                 // 文件树
  'browser',               // 浏览器
  'terminal',              // 终端
  'plan',                  // 计划
  'changes-review',        // 变更审查
  'schedule',              // 定时任务
  'dsh-context',           // 上下文（若 dsh-context 已装）
]);

/** 注入到页面的全局变量名。 */
export const INJECT_GLOBAL = '__DSH_DEFAULT_SIDEBAR_TAB__';

/**
 * 归一化 cordis 配置。只认非空字符串 defaultTab，其余回退默认值。
 * @param {unknown} raw
 * @returns {{ defaultTab: string, enabled: boolean }}
 */
export function resolveConfig(raw) {
  const source = (raw && typeof raw === 'object') ? raw : {};
  const requested = typeof source.defaultTab === 'string' ? source.defaultTab.trim() : '';
  const defaultTab = requested !== '' ? requested : DEFAULT_TAB;
  const enabled = source.enabled !== false;
  return { defaultTab, enabled };
}

/**
 * 判断当前会话是否应当播种默认 tab。
 * 规则：开关开启 + 该会话此前未播种过 + inventory 中该会话没有任何已开 tab。
 * @param {object} args
 * @param {boolean} args.enabled
 * @param {Set<string>} args.seeded 已播种过的 session id 集合
 * @param {string | undefined} args.sessionId 屏幕上的会话
 * @param {Array<{sessionId: string}>} args.openTabs sidebarRight.openTabs 快照
 * @returns {boolean}
 */
export function shouldSeed({ enabled, seeded, sessionId, openTabs }) {
  if (!enabled) return false;
  if (typeof sessionId !== 'string' || sessionId === '') return false;
  if (seeded.has(sessionId)) return false;
  const list = Array.isArray(openTabs) ? openTabs : [];
  // 只要该会话已有任何 tab（含用户此前手动开的 guide），就不播种。
  if (list.some((tab) => tab && tab.sessionId === sessionId)) return false;
  return true;
}
