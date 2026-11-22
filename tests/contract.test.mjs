// 契约单测：client/host 源码仍使用原生 DSH 的正确 API 面。
// 防止后续改动误把补丁写成依赖第三方插件或错误的注入点。
// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const client = readFileSync(join(root, 'lib', 'client.js'), 'utf8');
const host = readFileSync(join(root, 'lib', 'index.mjs'), 'utf8');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

test('client 走原生 ModuleLoader，注入 sidebarRight', () => {
  assert.ok(client.includes('window.__ModuleLoader__.load'));
  assert.ok(client.includes("const inject = ['sidebarRight']"));
  assert.ok(client.includes('ctx.sidebarRight'));
});

test('client 只用原生 API：mounted / openTabs / openTab', () => {
  assert.ok(client.includes('sidebar.mounted'));
  assert.ok(client.includes('sidebar.openTabs'));
  assert.ok(client.includes('sidebar.openTab('));
});

test('client 不碰 localStorage 布局、不依赖第三方插件', () => {
  assert.ok(!client.includes('localStorage'));
  for (const name of ['dsh-claude-style', 'dsh-context', 'better-sidebar', 'dsh-fish', 'session-panel']) {
    assert.ok(!client.includes(name), `client must not reference ${name}`);
  }
});

test('client 有未注册 kind 的回退与 disposer', () => {
  assert.ok(client.includes("FALLBACK_TAB = 'guide'"));
  assert.ok(/return\s*\(\)\s*=>\s*\{/.test(client));
});

test('host 用 webserver/index-inject 注入配置，不碰 index 文件', () => {
  assert.ok(host.includes("'webserver/index-inject'"));
  assert.ok(host.includes('INJECT_GLOBAL'));
  assert.ok(!host.includes('writeFileSync'));
});

test('package.json：私有独立包，client inject 声明 sidebarRight', () => {
  assert.equal(pkg.private, true);
  assert.equal(pkg.license, 'GPL-3.0-or-later');
  assert.deepEqual(pkg.dsh.client.inject, ['sidebarRight']);
  assert.equal(pkg.dsh.bundle.patch, './cordis.patch.yml');
});
