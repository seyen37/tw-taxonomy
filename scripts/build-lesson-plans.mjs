#!/usr/bin/env node
// 重新產生 lesson-plans/ 全部教學設計表與索引。
// 數學依年級（1-6），其他領域依學習階段（1-3）；選修語文為框架級，不產生。
//
//   node scripts/build-lesson-plans.mjs          產生
//   node scripts/build-lesson-plans.mjs --check  只檢查是否與 data/ 同步
import { readFileSync, writeFileSync, readdirSync, rmSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT, TWT, loadIndex } from './_data.mjs';

export const DIR = path.join(ROOT, 'lesson-plans');

export function buildLessonPlans() {
  const idx = loadIndex();
  const files = new Map();
  const rows = [];
  const core = idx.subjects.filter((s) => !idx.topics.find((t) => t.subject === s).elective);
  for (const subject of core) {
    const specs = subject === '數學'
      ? [1, 2, 3, 4, 5, 6].map((grade) => ({ subject, grade }))
      : [1, 2, 3].map((stage) => ({ subject, stage }));
    for (const spec of specs) {
      const plan = TWT.lessonPlan(idx, spec);
      if (!plan) continue;
      const name = TWT.lessonPlanFileName(plan);
      files.set(name, TWT.lessonPlanMarkdown(plan));
      const range = spec.grade ? `${spec.grade} 年級` : TWT.STAGE_NAME[spec.stage];
      rows.push(`| ${subject} | ${range} | ${plan.lessons.length} | [${name}](${encodeURI(name)}) |`);
    }
  }
  files.set('README.md', [
    '# 逐課教學設計表',
    '',
    '由 `node scripts/build-lesson-plans.mjs` 依先修關係自動產生，請勿手動修改；要調整請改 `data/` 後重新產生。',
    '也可以在教師工作台（`app/index.html`）的「教學設計表」分頁即時產生、列印或下載。',
    '',
    '| 領域 | 範圍 | 節數 | 檔案 |',
    '|---|---|---|---|',
    ...rows,
    '',
  ].join('\n'));
  return files;
}

export function checkLessonPlans() {
  const files = buildLessonPlans();
  const problems = [];
  const existing = existsSync(DIR) ? readdirSync(DIR) : [];
  for (const [name, content] of files) {
    const p = path.join(DIR, name);
    if (!existsSync(p)) problems.push(`缺少 ${name}`);
    else if (readFileSync(p, 'utf8') !== content) problems.push(`內容過期 ${name}`);
  }
  for (const f of existing) if (!files.has(f)) problems.push(`多餘檔案 ${f}`);
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--check')) {
    const p = checkLessonPlans();
    if (p.length) { console.error('✗ lesson-plans/ 與 data/ 不同步：\n  - ' + p.join('\n  - ')); process.exit(1); }
    console.log('✓ lesson-plans/ 已同步');
  } else {
    const files = buildLessonPlans();
    mkdirSync(DIR, { recursive: true });
    for (const f of readdirSync(DIR)) if (!files.has(f)) { rmSync(path.join(DIR, f)); console.log('移除舊檔', f); }
    for (const [name, content] of files) writeFileSync(path.join(DIR, name), content, 'utf8');
    console.log(`已寫出 ${files.size} 個檔案到 lesson-plans/`);
  }
}
