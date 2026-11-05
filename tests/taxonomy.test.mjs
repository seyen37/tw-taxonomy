// 執行：node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { TWT, loadIndex } from '../scripts/_data.mjs';

// 小型測試圖：a → b → d，a → c → d（d 依賴 b、c；b、c 依賴 a），e 為 soft 先修
const T = (id, grade = 1, extra = {}) => ({
  id, name: id, subject: '數學', domain: 'x', type: 'CONCEPTUAL', stage: 1,
  gradeStart: grade, gradeEnd: grade, centrality: 0, evidence: [], contentCodes: [], performanceCodes: [],
  description: id, assessmentPrompt: `問{{name}}：${id}`, ...extra,
});
const E = (topicId, prerequisiteId, strength = 'hard') => ({ topicId, prerequisiteId, strength, reason: '' });
const mini = TWT.createIndex({
  topics: [T('a'), T('b'), T('c'), T('d', 2), T('e')],
  dependencies: [E('b', 'a'), E('c', 'a'), E('d', 'b'), E('d', 'c'), E('d', 'e', 'soft')],
});

test('ancestors：含所有上游，依學習順序', () => {
  assert.deepEqual(TWT.ancestors(mini, 'd').map((t) => t.id), ['a', 'b', 'c', 'e']);
  assert.deepEqual(TWT.ancestors(mini, 'd', { hardOnly: true }).map((t) => t.id), ['a', 'b', 'c']);
  assert.deepEqual(TWT.ancestors(mini, 'a'), []);
});

test('descendants：含所有下游', () => {
  assert.deepEqual(TWT.descendants(mini, 'a').map((t) => t.id).sort(), ['b', 'c', 'd']);
});

test('diagnose：目標會 → 立即結束', () => {
  const r = TWT.diagnose(mini, 'd', { d: true });
  assert.equal(r.done, true);
  assert.equal(r.failed.length, 0);
  assert.deepEqual(r.inferred.map((t) => t.id).sort(), ['a', 'b', 'c']);
});

test('diagnose：逐層往上游追，找到補救起點', () => {
  let r = TWT.diagnose(mini, 'd', {});
  assert.equal(r.next.id, 'd');
  r = TWT.diagnose(mini, 'd', { d: false });
  assert.equal(r.next.id, 'b');
  // b 不會、c 會 → c 的先修 a 推論為會，不用再問
  r = TWT.diagnose(mini, 'd', { d: false, b: false, c: true });
  assert.equal(r.done, true);
  assert.deepEqual(r.startPoints.map((t) => t.id), ['b']);
  assert.deepEqual(r.remediation.map((t) => t.id), ['b', 'd']);
});

test('diagnose：一路不會到最上游', () => {
  const r = TWT.diagnose(mini, 'd', { d: false, b: false, c: false, a: false });
  assert.equal(r.done, true);
  assert.deepEqual(r.startPoints.map((t) => t.id), ['a']);
  assert.deepEqual(r.remediation.map((t) => t.id), ['a', 'b', 'c', 'd']);
});

test('diagnose：includeSoft 也會追 soft 先修', () => {
  const r = TWT.diagnose(mini, 'd', { d: false, b: true, c: true }, { includeSoft: true });
  assert.equal(r.next.id, 'e');
});

test('fillName：替換姓名占位符', () => {
  assert.equal(TWT.fillName('請{{name}}說說看', '小明'), '請小明說說看');
  assert.equal(TWT.fillName('請{{name}}說說看', ''), '請孩子說說看');
});

// ---------- 真實資料 ----------
const idx = loadIndex();

test('真實資料：每個微主題的上游都在較早或同年級', () => {
  for (const t of idx.topics) {
    for (const a of TWT.ancestors(idx, t.id)) assert.ok(a.stage <= t.stage, `${a.name} → ${t.name}`);
  }
});

test('真實資料：分數的除法的上游包含唱數到一百', () => {
  const t = idx.topics.find((x) => x.name === '分數的除法');
  const names = TWT.ancestors(idx, t.id).map((x) => x.name);
  assert.ok(names.includes('唱數到一百'));
  assert.ok(names.includes('分數的乘法'));
});

test('真實資料：全部答會／全部答不會都能結束', () => {
  for (const t of idx.topics) {
    const yes = TWT.diagnose(idx, t.id, { [t.id]: true });
    assert.equal(yes.done, true);
    const no = {};
    let r = TWT.diagnose(idx, t.id, no);
    let guard = 0;
    while (!r.done) { no[r.next.id] = false; r = TWT.diagnose(idx, t.id, no); assert.ok(guard++ < 600); }
    assert.ok(r.startPoints.length >= 1, t.name);
    assert.equal(r.remediation.at(-1).id, t.id);
  }
});

test('真實資料：搜尋名稱與課綱代碼', () => {
  assert.equal(TWT.searchTopics(idx, { q: '分數的除法' })[0].name, '分數的除法');
  assert.ok(TWT.searchTopics(idx, { q: 'N-6-3' }).some((t) => t.name === '分數的除法'));
  const g3 = TWT.searchTopics(idx, { subject: '數學', grade: 3 });
  assert.ok(g3.length > 0 && g3.every((t) => t.gradeStart <= 3 && 3 <= t.gradeEnd));
});

test('真實資料：課綱代碼都查得到原文', () => {
  for (const t of idx.topics) for (const c of [...t.contentCodes, ...t.performanceCodes]) assert.ok(idx.standards.has(c), c);
});
