// dsh-cs-panel-hider — host half (原生 DSH Cordis 插件)
// 本补丁是纯 UI 隐藏，不需要任何 host 能力；保留空入口以符合 DSH bundle 契约。
// Copyright (C) 2026 Swcmb
// SPDX-License-Identifier: GPL-3.0-or-later

export const name = 'dsh-cs-panel-hider';
export function apply() { /* 全部工作在 client 半，用 CSS 完成 */ }
