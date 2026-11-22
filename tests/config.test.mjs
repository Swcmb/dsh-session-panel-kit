// 纯逻辑单测：配置解析与播种判定。
// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveConfig, shouldSeed, DEFAULT_TAB, KNOWN_KINDS, INJECT_GLOBAL } from '../lib/config.mjs';

test('默认值：无配置时用会话详情', () => {
  assert.deepEqual(resolveConfig(undefined), { defaultTab: DEFAULT_TAB, enabled: true });
  assert.deepEqual(resolveConfig(null), { defaultTab: DEFAULT_TAB, enabled: true });
  assert.deepEqual(resolveConfig({}), { defaultTab: DEFAULT_TAB, enabled: true });
});

test('defaultTab 非空字符串被采纳并 trim', () => {
  assert.equal(resolveConfig({ defaultTab: 'files' }).defaultTab, 'files');
  assert.equal(resolveConfig({ defaultTab: '  browser  ' }).defaultTab, 'browser');
});

test('defaultTab 空白/非字符串回退默认值', () => {
  assert.equal(resolveConfig({ defaultTab: '   ' }).defaultTab, DEFAULT_TAB);
  assert.equal(resolveConfig({ defaultTab: 42 }).defaultTab, DEFAULT_TAB);
  assert.equal(resolveConfig({ defaultTab: null }).defaultTab, DEFAULT_TAB);
});

test('enabled:false 关闭播种', () => {
  assert.equal(resolveConfig({ enabled: false }).enabled, false);
  assert.equal(resolveConfig({ enabled: true }).enabled, true);
  assert.equal(resolveConfig({}).enabled, true);
});

test('KNOWN_KINDS 含关键原生 tab 且不重复', () => {
  for (const k of ['session-inspector-log', 'guide', 'files', 'browser', 'terminal', 'dsh-context']) {
    assert.ok(KNOWN_KINDS.includes(k), `missing ${k}`);
  }
  assert.equal(new Set(KNOWN_KINDS).size, KNOWN_KINDS.length);
});

test('INJECT_GLOBAL 命名稳定', () => {
  assert.equal(INJECT_GLOBAL, '__DSH_DEFAULT_SIDEBAR_TAB__');
});

const base = () => ({ enabled: true, seeded: new Set(), sessionId: 's-1', openTabs: [] });

test('shouldSeed：会话无 tab 时播种', () => {
  assert.equal(shouldSeed(base()), true);
});

test('shouldSeed：已有任意 tab 不播种', () => {
  assert.equal(shouldSeed({ ...base(), openTabs: [{ sessionId: 's-1', tabId: 'tab1', kind: 'guide' }] }), false);
});

test('shouldSeed：其它会话的 tab 不影响本会话', () => {
  assert.equal(shouldSeed({ ...base(), openTabs: [{ sessionId: 's-2', tabId: 'tab1', kind: 'guide' }] }), true);
});

test('shouldSeed：已播种过的会话不再播种', () => {
  assert.equal(shouldSeed({ ...base(), seeded: new Set(['s-1']) }), false);
});

test('shouldSeed：enabled=false 或无会话不播种', () => {
  assert.equal(shouldSeed({ ...base(), enabled: false }), false);
  assert.equal(shouldSeed({ ...base(), sessionId: undefined }), false);
  assert.equal(shouldSeed({ ...base(), sessionId: '' }), false);
});

test('shouldSeed：openTabs 非数组也不崩', () => {
  assert.equal(shouldSeed({ ...base(), openTabs: null }), true);
});
