#!/usr/bin/env node
// 逐課教學設計表產生器（指令版）。網頁版與此共用 lib/taxonomy.js。
//
// 用法：
//   node scripts/gen-lesson-plan.mjs --subject 數學 --grade 3
//   node scripts/gen-lesson-plan.mjs --subject 國語文 --stage 1 --out plan.md
import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { TWT, loadIndex } from './_data.mjs';

const { values: a } = parseArgs({
  options: {
    subject: { type: 'string' },
    grade: { type: 'string' },
    stage: { type: 'string' },
    out: { type: 'string' },
    help: { type: 'boolean', short: 'h' },
  },
});

const idx = loadIndex();
if (a.help || !a.subject) {
  console.log('用法：node scripts/gen-lesson-plan.mjs --subject <領域> [--grade 1-6 | --stage 1-3] [--out 檔名]');
  console.log('可用領域：' + idx.subjects.join('、'));
  process.exit(a.help ? 0 : 1);
}

const plan = TWT.lessonPlan(idx, {
  subject: a.subject,
  grade: a.grade == null ? null : Number(a.grade),
  stage: a.stage == null ? null : Number(a.stage),
});
if (!plan) {
  console.error('查無符合的微主題，請檢查 --subject／--grade／--stage');
  console.error('可用領域：' + idx.subjects.join('、'));
  process.exit(1);
}
const md = TWT.lessonPlanMarkdown(plan);
if (a.out) {
  writeFileSync(a.out, md, 'utf8');
  console.log(`已寫出 ${a.out}（${plan.lessons.length} 節、${plan.topicCount} 個微主題）`);
} else {
  console.log(md);
}
