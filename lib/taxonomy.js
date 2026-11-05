/*
 * tw-taxonomy 共用核心函式庫
 *
 * 網頁（app/）與指令（scripts/）共用同一份邏輯，避免兩套實作結果不一致。
 * 採 UMD 寫法：瀏覽器以一般 <script> 載入（file:// 雙擊開啟也能用），
 * Node 以 require() 載入。零依賴。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TWT = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // 型別 → 建議教學法（與《教師使用手冊》一致）
  const TYPE_METHOD = {
    CONCEPTUAL: '概念建立：分類卡牌／配對／情境判斷、實例與非實例對照',
    PROCEDURAL: '程序熟練：示範後計時挑戰／闖關／反覆操作練習',
    REPRESENTATIONAL: '表徵轉換：圖卡↔算式配對、畫圖說明、操作教具記錄',
    LANGUAGE: '符號語言：賓果／聽寫接力／符號辨識搶答',
    META: '後設態度：角色扮演／任務型活動／反思分享圈',
  };
  const TYPE_LABEL = {
    CONCEPTUAL: '概念',
    PROCEDURAL: '程序',
    REPRESENTATIONAL: '表徵',
    LANGUAGE: '語言符號',
    META: '後設態度',
  };
  const STAGE_NAME = { 1: '第一學習階段（1-2年級）', 2: '第二學習階段（3-4年級）', 3: '第三學習階段（5-6年級）' };
  const STAGE_SHORT = { 1: '1-2年級', 2: '3-4年級', 3: '5-6年級' };

  // ---------- 索引 ----------

  /**
   * 建立查詢索引。data = { topics, dependencies, clusters?, standards? }
   * topics / dependencies 為陣列；clusters 為 clusters.json 的 clusters 陣列；
   * standards 為 curriculum-standards.json 的 subjects 陣列。
   */
  function createIndex(data) {
    const topics = data.topics;
    const edges = data.dependencies;
    const byId = new Map(topics.map((t) => [t.id, t]));
    const up = new Map(topics.map((t) => [t.id, []]));   // 主題 → 它的先修
    const down = new Map(topics.map((t) => [t.id, []])); // 主題 → 依賴它的後續
    for (const e of edges) {
      const t = byId.get(e.topicId), p = byId.get(e.prerequisiteId);
      if (!t || !p) continue;
      up.get(t.id).push({ topic: p, strength: e.strength, reason: e.reason || '' });
      down.get(p.id).push({ topic: t, strength: e.strength, reason: e.reason || '' });
    }
    // 學科依節點數由多到少排列
    const counts = {};
    for (const t of topics) counts[t.subject] = (counts[t.subject] || 0) + 1;
    const subjects = Object.keys(counts).sort((a, b) => counts[b] - counts[a] || cmp(a, b));

    const clusters = new Map();
    for (const c of data.clusters || []) clusters.set(`${c.subject}|${c.domain}|${c.stage}`, c.summary);

    const standards = new Map();
    for (const s of data.standards || []) {
      for (const en of s.entries || []) standards.set(en.key, { ...en, subject: s.name });
    }
    return { topics, edges, byId, up, down, subjects, counts, clusters, standards };
  }

  // 依 Unicode 碼位比較字串（與 Python 的字串排序一致）
  function cmp(a, b) {
    if (a === b) return 0;
    const A = Array.from(a), B = Array.from(b);
    const n = Math.min(A.length, B.length);
    for (let i = 0; i < n; i++) {
      if (A[i] !== B[i]) return A[i].codePointAt(0) - B[i].codePointAt(0);
    }
    return A.length - B.length;
  }

  const grade0 = (t) => t.gradeStart || 0;
  const cen = (t) => t.centrality || 0;

  // ---------- 圖運算 ----------

  /** 所有上游先修（不含自己）。hardOnly 只走「非會不可」的邊。回傳依學習順序排好的陣列。 */
  function ancestors(idx, id, opts) {
    const hardOnly = !!(opts && opts.hardOnly);
    const seen = new Set();
    const stack = [id];
    while (stack.length) {
      const cur = stack.pop();
      for (const e of idx.up.get(cur) || []) {
        if (hardOnly && e.strength !== 'hard') continue;
        if (!seen.has(e.topic.id)) { seen.add(e.topic.id); stack.push(e.topic.id); }
      }
    }
    return topoOrder([...seen].map((i) => idx.byId.get(i)), idx.edges);
  }

  /** 所有下游後續（不含自己）。 */
  function descendants(idx, id) {
    const seen = new Set();
    const stack = [id];
    while (stack.length) {
      const cur = stack.pop();
      for (const e of idx.down.get(cur) || []) {
        if (!seen.has(e.topic.id)) { seen.add(e.topic.id); stack.push(e.topic.id); }
      }
    }
    return [...seen].map((i) => idx.byId.get(i));
  }

  /**
   * 對 nodes 子集做拓撲排序，只考慮子集內部的邊。
   * 同層依（年級, -中心性, 名稱）排序，讓輸出穩定且由淺入深。
   */
  function topoOrder(nodes, edges) {
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const adj = new Map(nodes.map((n) => [n.id, []]));
    const indeg = new Map(nodes.map((n) => [n.id, 0]));
    for (const e of edges) {
      if (byId.has(e.topicId) && byId.has(e.prerequisiteId)) {
        adj.get(e.prerequisiteId).push(e.topicId);
        indeg.set(e.topicId, indeg.get(e.topicId) + 1);
      }
    }
    const key = (a, b) => {
      const A = byId.get(a), B = byId.get(b);
      return grade0(A) - grade0(B) || cen(B) - cen(A) || cmp(A.name, B.name);
    };
    let ready = nodes.map((n) => n.id).filter((i) => indeg.get(i) === 0).sort(key);
    const order = [];
    const placed = new Set();
    while (ready.length) {
      const u = ready.shift();
      order.push(byId.get(u));
      placed.add(u);
      for (const v of adj.get(u)) {
        indeg.set(v, indeg.get(v) - 1);
        if (indeg.get(v) === 0) ready.push(v);
      }
      ready.sort(key);
    }
    // 子集內含環時（驗證器保證不會發生）把殘留補在後面
    for (const n of nodes) if (!placed.has(n.id)) order.push(n);
    return order;
  }

  // ---------- 查詢 ----------

  /** 篩選與搜尋微主題。filters = { q, subject, grade, stage, type } */
  function searchTopics(idx, filters) {
    const f = filters || {};
    const q = (f.q || '').trim().toLowerCase();
    const terms = q ? q.split(/\s+/) : [];
    const res = [];
    for (const t of idx.topics) {
      if (f.subject && t.subject !== f.subject) continue;
      if (f.grade && !(grade0(t) <= f.grade && f.grade <= (t.gradeEnd || 0))) continue;
      if (f.stage && t.stage !== f.stage) continue;
      if (f.type && t.type !== f.type) continue;
      let score = 0;
      if (terms.length) {
        const name = t.name.toLowerCase();
        const codes = t.contentCodes.concat(t.performanceCodes).join(' ').toLowerCase();
        const body = [t.domain, t.description, t.evidence.join(' ')].join(' ').toLowerCase();
        let ok = true;
        for (const term of terms) {
          if (name.includes(term)) score += 10;
          else if (codes.includes(term)) score += 6;
          else if (body.includes(term)) score += 1;
          else { ok = false; break; }
        }
        if (!ok) continue;
      }
      res.push({ t, score });
    }
    res.sort((a, b) => b.score - a.score || grade0(a.t) - grade0(b.t) || cen(b.t) - cen(a.t) || cmp(a.t.name, b.t.name));
    return res.map((r) => r.t);
  }

  // ---------- 教學設計表 ----------

  /** 把排序後的微主題編成節次：每節 1 個主概念；相鄰同主題群的小型語言／後設型可併入。 */
  function groupLessons(order) {
    const lessons = [];
    for (let i = 0; i < order.length; i++) {
      const cur = order[i];
      const bundle = [cur];
      const nxt = order[i + 1];
      if (nxt && nxt.domain === cur.domain && (nxt.type === 'LANGUAGE' || nxt.type === 'META')
          && cen(nxt) < 0.05 && cur.type !== 'LANGUAGE' && cur.type !== 'META') {
        bundle.push(nxt);
        i++;
      }
      lessons.push(bundle);
    }
    return lessons;
  }

  const codeOf = (c) => c.split(':')[1];
  const uniqSorted = (arr) => [...new Set(arr)].sort(cmp);

  /**
   * 產生結構化的教學設計表。opts = { subject, grade?, stage? }
   * 查無微主題時回傳 null。
   */
  function lessonPlan(idx, opts) {
    const { subject } = opts;
    const grade = opts.grade == null ? null : Number(opts.grade);
    const stage = opts.stage == null ? null : Number(opts.stage);
    let sel = idx.topics.filter((n) => n.subject === subject);
    if (grade !== null) sel = sel.filter((n) => grade0(n) <= grade && grade <= (n.gradeEnd || 0));
    if (stage !== null) sel = sel.filter((n) => n.stage === stage);
    if (!sel.length) return null;

    const order = topoOrder(sel, idx.edges);
    const groups = groupLessons(order);
    let scope = subject;
    if (grade !== null) scope += `（${grade}年級）`;
    else if (stage !== null) scope += `（${STAGE_NAME[stage] || stage}）`;

    const lessons = groups.map((bundle, i) => {
      const main = bundle[0];
      const inBundle = new Set(bundle.map((b) => b.id));
      const prereqs = [];
      const seen = new Set();
      for (const b of bundle) {
        for (const e of idx.up.get(b.id)) {
          if (inBundle.has(e.topic.id) || seen.has(e.topic.name)) continue;
          seen.add(e.topic.name);
          prereqs.push({
            topic: e.topic,
            tag: e.strength === 'hard' ? '必備' : '有助',
            crossSubject: e.topic.subject !== subject ? e.topic.subject : null,
          });
        }
      }
      return {
        number: i + 1,
        topics: bundle,
        title: bundle.map((b) => b.name).join('、'),
        content: bundle.map((b) => b.description).join('；'),
        contentCodes: uniqSorted(bundle.flatMap((b) => b.contentCodes.map(codeOf))),
        performanceCodes: uniqSorted(bundle.flatMap((b) => b.performanceCodes.map(codeOf))),
        method: TYPE_METHOD[main.type] || '',
        prereqs,
        assessments: bundle.filter((b) => b.assessmentPrompt).map((b) => b.assessmentPrompt),
        tasks: main.differentiatedTasks || null,
        evidence: bundle.flatMap((b) => b.evidence),
      };
    });
    return { subject, grade, stage, scope, topicCount: order.length, lessons };
  }

  function codeString(l) {
    const a = l.contentCodes.length ? '學習內容 ' + l.contentCodes.join('、') : '';
    const b = l.performanceCodes.length ? '　學習表現 ' + l.performanceCodes.join('、') : '';
    return a + b || '（能力向度，見學習表現）';
  }

  function prereqString(l) {
    if (!l.prereqs.length) return '（起點，無先備）';
    return l.prereqs.map((p) => `${p.topic.name}[${p.tag}]${p.crossSubject ? `（跨領域：${p.crossSubject}）` : ''}`).join('；');
  }

  /** 教學設計表輸出為 Markdown。 */
  function lessonPlanMarkdown(plan) {
    const out = [
      `# ${plan.scope}　逐課教學設計表（自動生成草稿）`, '',
      `由 tw-taxonomy 依先修關係自動排序生成，共 ${plan.lessons.length} 節、涵蓋 ${plan.topicCount} 個學習微主題。`,
      '此為草稿，實際教學節數與順序請依班級狀況與教科書版本調整。', '',
      '> 使用方式：每節先用「形成性評量」快速確認前一節精熟；先備概念未達標的學生先補該先修節次。', '',
    ];
    for (const l of plan.lessons) {
      out.push(`## 第 ${l.number} 節　${l.title}`, '');
      out.push(`- **學習內容**：${l.content}`);
      out.push(`- **對應課綱**：${codeString(l)}`);
      out.push(`- **建議教學法**：${l.method}`);
      out.push(`- **先備概念**：${prereqString(l)}`);
      out.push(`- **形成性評量**：${l.assessments.map((a) => `「${a}」`).join(' ')}`);
      if (l.tasks) out.push(`- **分級任務**：進階〔${l.tasks.advanced}〕／基本〔${l.tasks.basic}〕／基礎〔${l.tasks.foundational}〕`);
      out.push(`- **達成指標**：${l.evidence.join('；')}`);
      out.push('');
    }
    return out.join('\n');
  }

  /** 教學設計表的標準檔名（lesson-plans/ 內使用）。 */
  function lessonPlanFileName(plan) {
    if (plan.grade !== null) return `${plan.subject}_${plan.grade}年級_逐課設計.md`;
    if (plan.stage !== null) return `${plan.subject}_第${plan.stage}學習階段_逐課設計.md`;
    return `${plan.subject}_全年段_逐課設計.md`;
  }

  // ---------- 診斷補救 ----------

  /**
   * 診斷流程（純函式，方便重播與復原）。
   * 從目標概念開始問；答「不會」就往下追它的先修；答「會」就視為它的先修也都會（不再問）。
   * answers：Map 或物件 { topicId: true/false }，依作答順序記錄。
   * 回傳 { next, asked, failed, passed, inferred, startPoints, remediation, done }
   */
  function diagnose(idx, targetId, answers, opts) {
    const hardOnly = !(opts && opts.includeSoft);
    const ans = answers instanceof Map ? answers : new Map(Object.entries(answers || {}));
    const prereqsOf = (id) => idx.up.get(id).filter((e) => !hardOnly || e.strength === 'hard').map((e) => e.topic);

    const inferred = new Set();
    const markInferred = (id) => {
      const stack = [id];
      while (stack.length) {
        for (const p of prereqsOf(stack.pop())) {
          if (!inferred.has(p.id) && ans.get(p.id) !== false) { inferred.add(p.id); stack.push(p.id); }
        }
      }
    };

    // 依作答紀錄重播：佇列採廣度優先，由目標往上游
    const queue = [targetId];
    const queued = new Set([targetId]);
    const asked = [];
    let next = null;
    while (queue.length) {
      const id = queue.shift();
      if (inferred.has(id) && !ans.has(id)) continue;
      if (!ans.has(id)) { next = idx.byId.get(id); break; }
      asked.push(idx.byId.get(id));
      if (ans.get(id)) markInferred(id);
      else {
        for (const p of prereqsOf(id)) {
          if (!queued.has(p.id)) { queued.add(p.id); queue.push(p.id); }
        }
      }
    }

    const failed = asked.filter((t) => ans.get(t.id) === false);
    const passed = asked.filter((t) => ans.get(t.id) === true);
    const failedIds = new Set(failed.map((t) => t.id));
    // 補救起點：不會、而且它的先修都已確認會（或沒有先修）的概念
    const startPoints = next ? [] : failed.filter((t) => prereqsOf(t.id).every((p) => !failedIds.has(p.id)));
    const remediation = next ? [] : topoOrder(failed, idx.edges);
    return {
      next, asked, failed, passed,
      inferred: [...inferred].filter((i) => !ans.has(i)).map((i) => idx.byId.get(i)),
      startPoints, remediation, done: !next,
    };
  }

  /** 把檢核提示裡的 {{name}} 換成學生姓名。 */
  function fillName(prompt, name) {
    return (prompt || '').replace(/\{\{name\}\}/g, name && name.trim() ? name.trim() : '孩子');
  }

  return {
    TYPE_METHOD, TYPE_LABEL, STAGE_NAME, STAGE_SHORT,
    createIndex, ancestors, descendants, topoOrder, searchTopics,
    groupLessons, lessonPlan, lessonPlanMarkdown, lessonPlanFileName,
    diagnose, fillName, cmp,
  };
});
