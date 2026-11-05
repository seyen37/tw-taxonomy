#!/usr/bin/env node
// 由 data/ 產生網頁用的 app/data.js。
// 網頁用一般 <script> 載入這個檔，所以雙擊 app/index.html（file://）也能開。
//
//   node scripts/build-app-data.mjs          產生
//   node scripts/build-app-data.mjs --check  只檢查是否與 data/ 同步
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT, loadData } from './_data.mjs';

export const APP_DATA = path.join(ROOT, 'app', 'data.js');

export function buildAppData() {
  const d = loadData();
  const payload = {
    topics: d.topics,
    dependencies: d.dependencies,
    clusters: d.clusters,
    // 課綱原文只留網頁需要的欄位
    standards: d.standards.map((s) => ({
      name: s.name,
      entries: s.entries.map((e) => ({ key: e.key, kind: e.kind, code: e.code, text: e.text })),
    })),
  };
  return '// 自動產生，請勿手動修改。來源：data/*.json，產生指令：node scripts/build-app-data.mjs\n'
    + 'window.TWT_DATA = ' + JSON.stringify(payload) + ';\n';
}

export function checkAppData() {
  return existsSync(APP_DATA) && readFileSync(APP_DATA, 'utf8') === buildAppData();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--check')) {
    if (!checkAppData()) { console.error('✗ app/data.js 與 data/ 不同步，請執行 node scripts/build-app-data.mjs'); process.exit(1); }
    console.log('✓ app/data.js 已同步');
  } else {
    const s = buildAppData();
    writeFileSync(APP_DATA, s, 'utf8');
    console.log(`已寫出 app/data.js（${(s.length / 1024).toFixed(0)} KB）`);
  }
}
