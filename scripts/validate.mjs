#!/usr/bin/env node
/**
 * validate.mjs — tw-taxonomy 資料集完整性檢查（零依賴）。
 *
 * 檢查項目：宣告計數、ID 唯一性與格式、參照完整性（邊端點、
 * 微主題→課綱代碼）、DAG 無環、階段一致性（先修階段 ≤ 後續階段）、
 * manifest SHA-256 校驗和。任一失敗以非零碼結束。
 *
 *   node scripts/validate.mjs
 */

import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const load = (name) => JSON.parse(readFileSync(resolve(DATA, name), 'utf8'));
const bytesOf = (name) => readFileSync(resolve(DATA, name));

const errors = [];
const check = (cond, msg) => { if (!cond) errors.push(msg); };
const optional = (name) => existsSync(resolve(DATA, name));

// --- curriculum-standards ---------------------------------------------------
const standards = load('curriculum-standards.json');
check(standards.subjectCount === standards.subjects.length, `standards: subjectCount 不符`);
const standardKeys = new Set();
for (const s of standards.subjects) {
  check(s.entryCount === s.entries.length, `standards ${s.slug}: entryCount ${s.entryCount} != ${s.entries.length}`);
  for (const e of s.entries) {
    check(e.key === `${s.slug}:${e.code}`, `standard key 不符: ${e.key}`);
    check(['content', 'performance'].includes(e.kind), `standard ${e.key}: kind 錯誤`);
    check(typeof e.text === 'string' && e.text.length > 0, `standard ${e.key}: text 為空`);
    if (standardKeys.has(e.key)) errors.push(`standard key 重複: ${e.key}`);
    standardKeys.add(e.key);
  }
}

// --- topics（若已產出）-------------------------------------------------------
const TYPES = new Set(['CONCEPTUAL', 'PROCEDURAL', 'REPRESENTATIONAL', 'LANGUAGE', 'META']);
let topics = null;
const topicIds = new Set();
if (optional('topics.json')) {
  topics = load('topics.json');
  check(topics.topicCount === topics.topics.length, `topics: topicCount 不符`);
  for (const t of topics.topics) {
    check(typeof t.id === 'string' && t.id.startsWith('twt_'), `topic id 格式錯誤: ${t.id}`);
    check(TYPES.has(t.type), `topic ${t.id}: type 錯誤 ${t.type}`);
    check(typeof t.description === 'string' && t.description.length > 0, `topic ${t.id}: description 為空`);
    check(Array.isArray(t.evidence) && t.evidence.length > 0, `topic ${t.id}: evidence 為空`);
    if (t.differentiatedTasks != null) {
      for (const lv of ['advanced', 'basic', 'foundational']) {
        check(typeof t.differentiatedTasks[lv] === 'string' && t.differentiatedTasks[lv].length > 0,
          `topic ${t.id}: differentiatedTasks.${lv} 缺漏`);
      }
    }
    if (t.stage != null) check(t.stage >= 1 && t.stage <= 3, `topic ${t.id}: stage 超界`);
    for (const k of [...(t.contentCodes ?? []), ...(t.performanceCodes ?? [])]) {
      check(standardKeys.has(k), `topic ${t.id}: 課綱代碼未定義 ${k}`);
    }
    if (topicIds.has(t.id)) errors.push(`topic id 重複: ${t.id}`);
    topicIds.add(t.id);
  }
}

// --- dependencies（若已產出）--------------------------------------------------
if (optional('dependencies.json') && topics) {
  const deps = load('dependencies.json');
  check(deps.edgeCount === deps.dependencies.length, `dependencies: edgeCount 不符`);
  const byId = new Map(topics.topics.map((t) => [t.id, t]));
  const adj = new Map();
  const indeg = new Map();
  const seenEdge = new Set();
  for (const d of deps.dependencies) {
    check(topicIds.has(d.topicId), `edge: topicId 未定義 ${d.topicId}`);
    check(topicIds.has(d.prerequisiteId), `edge: prerequisiteId 未定義 ${d.prerequisiteId}`);
    check(d.topicId !== d.prerequisiteId, `edge: 自我依賴 ${d.topicId}`);
    check(['hard', 'soft'].includes(d.strength), `edge ${d.topicId}: strength 錯誤`);
    const ek = `${d.prerequisiteId}->${d.topicId}`;
    if (seenEdge.has(ek)) errors.push(`edge 重複: ${ek}`);
    seenEdge.add(ek);
    const a = byId.get(d.prerequisiteId), b = byId.get(d.topicId);
    if (a?.stage != null && b?.stage != null) {
      check(a.stage <= b.stage, `edge ${ek}: 先修階段 ${a.stage} > 後續階段 ${b.stage}`);
    }
    if (!adj.has(d.prerequisiteId)) adj.set(d.prerequisiteId, []);
    adj.get(d.prerequisiteId).push(d.topicId);
    indeg.set(d.topicId, (indeg.get(d.topicId) ?? 0) + 1);
  }
  // Kahn 拓撲排序驗證無環
  const deg = new Map([...topicIds].map((id) => [id, indeg.get(id) ?? 0]));
  const queue = [...deg.entries()].filter(([, v]) => v === 0).map(([k]) => k);
  let seen = 0;
  while (queue.length) {
    const n = queue.pop();
    seen++;
    for (const m of adj.get(n) ?? []) {
      deg.set(m, deg.get(m) - 1);
      if (deg.get(m) === 0) queue.push(m);
    }
  }
  check(seen === topicIds.size, `圖有環：拓撲排序僅處理 ${seen}/${topicIds.size}`);
}

// --- clusters（若已產出）------------------------------------------------------
if (optional('clusters.json')) {
  const clusters = load('clusters.json');
  check(clusters.clusterCount === clusters.clusters.length, `clusters: clusterCount 不符`);
}

// --- manifest ----------------------------------------------------------------
if (optional('manifest.json')) {
  const manifest = load('manifest.json');
  for (const [file, meta] of Object.entries(manifest.files ?? {})) {
    if (!optional(file)) { errors.push(`manifest: 檔案不存在 ${file}`); continue; }
    const buf = bytesOf(file);
    check(buf.length === meta.bytes, `manifest ${file}: bytes 不符`);
    const sha = createHash('sha256').update(buf).digest('hex');
    check(sha === meta.sha256, `manifest ${file}: sha256 不符`);
  }
}

if (errors.length) {
  console.error(`✗ 驗證失敗（${errors.length} 項）：`);
  for (const e of errors.slice(0, 50)) console.error('  -', e);
  if (errors.length > 50) console.error(`  …另有 ${errors.length - 50} 項`);
  process.exit(1);
}
console.log('✓ 驗證通過');
