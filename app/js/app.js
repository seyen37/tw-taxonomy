/* tw-taxonomy 教師工作台：路由與各分頁 */
(function () {
  'use strict';
  const TWT = window.TWT;
  const idx = TWT.createIndex(window.TWT_DATA);
  const view = document.getElementById('view');

  // ---------- 小工具 ----------
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (sel, el) => (el || view).querySelector(sel);
  const $$ = (sel, el) => [...(el || view).querySelectorAll(sel)];
  const enc = encodeURIComponent;

  const ELECTIVE = new Set(idx.topics.filter((t) => t.elective).map((t) => t.subject));
  const SUBJ_COLOR = {
    '數學': '#4e79ff', '國語文': '#ff6b6b', '英語文': '#ffa94d', '自然科學': '#2fbf8a', '社會': '#b07cf0',
    '生活課程': '#e8b400', '綜合活動': '#f06ea0', '健康與體育': '#2fb4e0', '藝術': '#ff8fab',
  };
  const subjColor = (s) => SUBJ_COLOR[s] || '#7d8aa0';
  const isFoundation = (t) => (t.centrality || 0) >= 0.2;
  const gradeText = (t) => (t.gradeStart === t.gradeEnd ? `${t.gradeStart}年級` : `${t.gradeStart}-${t.gradeEnd}年級`);

  function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => el.classList.remove('show'), 1800);
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); }
    catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } finally { ta.remove(); }
    }
    toast('已複製');
  }

  function download(name, text) {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // 每位使用者的小設定（只存在自己的瀏覽器，失敗也不影響功能）
  const pref = {
    get(k, d) { try { const v = localStorage.getItem('twt-' + k); return v == null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('twt-' + k, v); } catch (e) { /* 忽略 */ } },
  };

  const topicLink = (t, cls) => `<a class="${cls || ''}" href="#/topic/${t.id}">${esc(t.name)}</a>`;
  const subjectChip = (s) => `<span class="chip"><span class="dot" style="background:${subjColor(s)}"></span> ${esc(s)}</span>`;
  const topicChips = (t) => [
    subjectChip(t.subject),
    `<span class="chip">${esc(t.domain)}</span>`,
    `<span class="chip">${gradeText(t)}</span>`,
    `<span class="chip">${esc(TWT.TYPE_LABEL[t.type] || t.type)}</span>`,
    isFoundation(t) ? '<span class="chip warn" title="中心性高，解鎖很多後續概念">地基概念</span>' : '',
  ].join('');

  const subjectOptions = (sel, includeAll) => (includeAll ? '<option value="">全部領域</option>' : '')
    + idx.subjects.map((s) => `<option ${s === sel ? 'selected' : ''}>${esc(s)}</option>`).join('');

  // ---------- 選擇微主題（自動完成） ----------
  function picker(el, opts) {
    el.innerHTML = `<div class="picker">
      <input type="search" placeholder="${esc(opts.placeholder || '輸入概念名稱或課綱代碼，例如「分數的除法」「N-3-4」')}" autocomplete="off">
      <div class="picker-list" role="listbox"></div></div>`;
    const input = $('input', el), list = $('.picker-list', el);
    let items = [], act = -1;
    const render = () => {
      items = input.value.trim() ? TWT.searchTopics(idx, { q: input.value }).slice(0, 12) : [];
      act = items.length ? 0 : -1;
      list.innerHTML = items.map((t, i) => `<button type="button" data-i="${i}" class="${i === act ? 'act' : ''}">${esc(t.name)}<span class="m">${esc(t.subject)} · ${gradeText(t)}</span></button>`).join('')
        || (input.value.trim() ? '<div class="muted small" style="padding:10px 12px">找不到符合的概念</div>' : '');
      list.classList.toggle('open', !!input.value.trim());
    };
    const choose = (t) => { list.classList.remove('open'); input.value = t.name; opts.onPick(t); };
    input.addEventListener('input', render);
    input.addEventListener('focus', () => input.value.trim() && render());
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!items.length) return;
        act = (act + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length;
        $$('button', list).forEach((b, i) => b.classList.toggle('act', i === act));
      } else if (e.key === 'Enter' && items[act]) { e.preventDefault(); choose(items[act]); }
      else if (e.key === 'Escape') list.classList.remove('open');
    });
    list.addEventListener('mousedown', (e) => {
      const b = e.target.closest('button');
      if (b) { e.preventDefault(); choose(items[+b.dataset.i]); }
    });
    input.addEventListener('blur', () => setTimeout(() => list.classList.remove('open'), 150));
    if (opts.value) input.value = opts.value.name;
    if (opts.autofocus && !opts.value) setTimeout(() => input.focus(), 0);
    return input;
  }

  // ---------- 首頁 ----------
  function home() {
    const core = idx.subjects.filter((s) => !ELECTIVE.has(s));
    const electiveN = idx.topics.filter((t) => t.elective).length;
    view.innerHTML = `
      <section class="hero">
        <h1>台灣國小學習知識圖譜</h1>
        <p class="lead">以 108 課綱為本，把各領域學習重點拆成可獨立教、獨立驗收的「微主題」，並標出學習順序。</p>
        <div class="stats">
          <span><b>${idx.topics.length}</b> 個微主題</span>
          <span><b>${idx.edges.length}</b> 條先修關係</span>
          <span><b>${idx.subjects.length}</b> 個領域</span>
          <span><b>${idx.standards.size}</b> 條課綱學習重點</span>
        </div>
      </section>
      <h3>我想要…</h3>
      <div class="quick">
        <a class="card" href="#/search"><div class="ico">🔍</div><b>查一個概念</b><p>看精熟證據、檢核提示、三級分級任務與對應課綱，備課直接抄。</p></a>
        <a class="card" href="#/diagnose"><div class="ico">🩺</div><b>找出孩子卡在哪</b><p>從卡關的概念往回逐題檢核，找到真正的補救起點。</p></a>
        <a class="card" href="#/plan"><div class="ico">📋</div><b>產生教學設計表</b><p>選領域與年級，依先修順序排好每一節課，可列印或下載。</p></a>
        <a class="card" href="#/path"><div class="ico">🧭</div><b>看學習路徑</b><p>列出學會某個概念前，從一年級起要鋪好的整條路。</p></a>
        <a class="card" href="#/graph"><div class="ico">🕸</div><b>看整體地圖</b><p>互動知識圖：各領域、各年段的概念與先修關係一覽。</p></a>
      </div>
      <h3>依領域瀏覽</h3>
      <div class="subjects">
        ${core.map((s) => `<a href="#/search?subject=${enc(s)}"><span class="dot" style="background:${subjColor(s)}"></span>${esc(s)}<span class="n">${idx.counts[s]}</span></a>`).join('')}
        <a href="#/search?elective=1"><span class="dot" style="background:#7d8aa0"></span>選修語文<span class="n">${electiveN}</span></a>
      </div>
      <p class="muted small" style="margin-top:28px">本工具為教學輔助，不是官方教材；課綱條文以教育部發布版為準。資料授權 CC BY 4.0。
        網頁不會蒐集或上傳任何學生資料。</p>`;
  }

  // ---------- 查詢 ----------
  function search(q) {
    const f = { q: q.q || '', subject: q.subject || '', grade: q.grade ? +q.grade : 0, type: q.type || '' };
    view.innerHTML = `
      <h2>查詢微主題</h2>
      <p class="lead">輸入關鍵字或課綱代碼，或用領域、年級篩選。點一個概念看完整內容。</p>
      <div class="filters">
        <label class="field"><span>關鍵字／課綱代碼</span><input type="search" id="q" value="${esc(f.q)}" placeholder="例如：分數、注音、N-3-4"></label>
        <label class="field"><span>領域</span><select id="subject">${subjectOptions(f.subject, true)}</select></label>
        <label class="field"><span>年級</span><select id="grade"><option value="">全部年級</option>${[1, 2, 3, 4, 5, 6].map((g) => `<option value="${g}" ${g === f.grade ? 'selected' : ''}>${g} 年級</option>`).join('')}</select></label>
        <label class="field"><span>型別</span><select id="type"><option value="">全部型別</option>${Object.entries(TWT.TYPE_LABEL).map(([k, v]) => `<option value="${k}" ${k === f.type ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      </div>
      <p class="count" id="count"></p>
      <div class="results" id="results"></div>`;
    const draw = () => {
      const cur = { q: $('#q').value, subject: $('#subject').value, grade: +$('#grade').value || 0, type: $('#type').value };
      let res = TWT.searchTopics(idx, cur);
      if (q.elective && !cur.subject) res = res.filter((t) => t.elective);
      const shown = res.slice(0, 200);
      $('#count').textContent = `共 ${res.length} 個微主題${res.length > shown.length ? `，顯示前 ${shown.length} 個` : ''}`;
      $('#results').innerHTML = shown.map((t) => `
        <a class="result" href="#/topic/${t.id}">
          <div class="nm">${esc(t.name)} ${topicChips(t)}</div>
          <div class="ds">${esc(t.description)}</div>
        </a>`).join('') || '<p class="empty">找不到符合的微主題，換個關鍵字試試。</p>';
      // 把條件寫回網址，方便分享與返回
      const params = new URLSearchParams();
      if (cur.q) params.set('q', cur.q);
      if (cur.subject) params.set('subject', cur.subject);
      if (cur.grade) params.set('grade', cur.grade);
      if (cur.type) params.set('type', cur.type);
      if (q.elective && !cur.subject) params.set('elective', '1');
      const h = '#/search' + (params.toString() ? '?' + params : '');
      if (location.hash !== h) history.replaceState(null, '', h);
    };
    let timer;
    $('#q').addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(draw, 120); });
    ['#subject', '#grade', '#type'].forEach((s) => $(s).addEventListener('change', draw));
    draw();
    if (!f.q && !f.subject) $('#q').focus();
  }

  // ---------- 微主題詳情 ----------
  function topic(id) {
    const t = idx.byId.get(id);
    if (!t) { view.innerHTML = '<p class="empty">找不到這個微主題。<a href="#/search">回到查詢</a></p>'; return; }
    const ups = idx.up.get(id), downs = idx.down.get(id);
    const allUp = TWT.ancestors(idx, id), allDown = TWT.descendants(idx, id);
    const dt = t.differentiatedTasks;
    const parent = idx.clusters.get(`${t.subject}|${t.domain}|${t.stage}`);
    const codes = [...t.contentCodes.map((c) => ['學習內容', c]), ...t.performanceCodes.map((c) => ['學習表現', c])];
    const name = pref.get('student', '');
    const relList = (arr, empty) => arr.length ? `<ul class="rel">${arr.map((e) => `<li>
        ${topicLink(e.topic)} <span class="chip ${e.strength === 'hard' ? 'accent' : ''}">${e.strength === 'hard' ? '必備' : '有助'}</span>
        <span class="muted small">${esc(e.topic.subject !== t.subject ? e.topic.subject + ' · ' : '')}${gradeText(e.topic)}</span>
        ${e.reason ? `<div class="why">${esc(e.reason)}</div>` : ''}</li>`).join('')}</ul>` : `<p class="muted">${empty}</p>`;

    view.innerHTML = `
      <div class="row no-print" style="margin-bottom:12px"><a href="#/search" id="back">← 返回</a></div>
      <div class="card">
        <div class="detail-head">
          <div style="flex:1;min-width:240px">
            <h2>${esc(t.name)}</h2>
            <div class="chips" style="margin-top:8px">${topicChips(t)}</div>
          </div>
          <div class="row no-print">
            <a class="btn" href="#/path/${t.id}">🧭 學習路徑</a>
            <a class="btn" href="#/diagnose/${t.id}">🩺 從這裡診斷</a>
            <a class="btn" href="#/graph/${t.id}">🕸 在圖上看</a>
            <button class="btn" id="copy" type="button">📋 複製教案欄位</button>
          </div>
        </div>
        <p style="margin:14px 0 0;font-size:16px">${esc(t.description)}</p>
      </div>

      <div class="detail-grid">
        <div>
          <div class="card">
            <h3 style="margin-top:0">精熟證據（達成標準）</h3>
            <ul class="evidence">${t.evidence.map((e) => `<li><label><input type="checkbox"> <span>${esc(e)}</span></label></li>`).join('')}</ul>
            <h3>檢核提示（課堂抽問）</h3>
            <div class="row no-print"><label class="field" style="max-width:320px;width:100%"><span>學生姓名（只存在這台電腦，不會上傳）</span>
              <input type="text" id="sname" value="${esc(name)}" placeholder="例如：小明"></label></div>
            <div class="prompt" id="prompt">${esc(TWT.fillName(t.assessmentPrompt, name))}</div>
          </div>
          ${dt ? `<div class="card">
            <h3 style="margin-top:0">分級任務（差異化教學）</h3>
            <div class="tasks">
              <div class="task advanced"><b>進階</b>${esc(dt.advanced)}</div>
              <div class="task basic"><b>基本</b>${esc(dt.basic)}</div>
              <div class="task foundational"><b>基礎</b>${esc(dt.foundational)}</div>
            </div></div>` : ''}
          <div class="card">
            <h3 style="margin-top:0">對應課綱</h3>
            ${codes.length ? codes.map(([kind, key]) => {
              const s = idx.standards.get(key);
              return `<div class="code"><span class="chip ${kind === '學習內容' ? 'accent' : 'ok'}">${kind}</span> <span class="k">${esc(key.split(':')[1])}</span>${esc(s ? s.text : '')}</div>`;
            }).join('') : '<p class="muted">無</p>'}
          </div>
        </div>
        <div>
          <div class="card">
            <h3 style="margin-top:0">先修：學這個之前要會（${ups.length}）</h3>
            ${relList(ups, '這是起點概念，沒有先修。')}
            ${allUp.length > ups.length ? `<p class="small muted">往上游共 ${allUp.length} 個概念，<a href="#/path/${t.id}">看完整學習路徑</a></p>` : ''}
          </div>
          <div class="card">
            <h3 style="margin-top:0">後續：學會後可以接著學（${downs.length}）</h3>
            ${relList(downs, '目前沒有依賴它的後續概念。')}
            ${allDown.length ? `<p class="small muted">總共會解鎖 ${allDown.length} 個後續概念。</p>` : ''}
          </div>
          ${parent ? `<div class="card"><h3 style="margin-top:0">跟家長這樣說</h3><div class="parent">${esc(parent)}</div></div>` : ''}
        </div>
      </div>`;

    // 有上一頁就返回，直接開啟的話回到查詢
    $('#back').addEventListener('click', (e) => { if (history.length > 1) { e.preventDefault(); history.back(); } });
    $('#sname').addEventListener('input', (e) => {
      pref.set('student', e.target.value);
      $('#prompt').textContent = TWT.fillName(t.assessmentPrompt, e.target.value);
    });
    $('#copy').addEventListener('click', () => copyText([
      `【學習內容】${t.name}：${t.description}`,
      `【對應課綱】${t.contentCodes.length ? '學習內容 ' + t.contentCodes.map((c) => c.split(':')[1]).join('、') : ''}${t.performanceCodes.length ? '　學習表現 ' + t.performanceCodes.map((c) => c.split(':')[1]).join('、') : ''}`,
      `【先備經驗】${ups.map((e) => e.topic.name).join('、') || '無'}`,
      `【學習目標／評量規準】\n${t.evidence.map((e) => '・' + e).join('\n')}`,
      `【形成性評量】${TWT.fillName(t.assessmentPrompt, $('#sname').value)}`,
      dt ? `【分級任務】\n進階：${dt.advanced}\n基本：${dt.basic}\n基礎：${dt.foundational}` : '',
    ].filter(Boolean).join('\n')));
  }

  // ---------- 學習路徑 ----------
  function path(id) {
    const t = id && idx.byId.get(id);
    const hardOnly = pref.get('pathHard', '0') === '1';
    view.innerHTML = `
      <h2>學習路徑</h2>
      <p class="lead">選一個概念，列出學會它之前要先鋪好的所有概念，依年級排好。適合排課程計畫、做開學診斷。</p>
      <div class="card no-print">
        <div class="row" style="align-items:flex-end">
          <div class="field" style="flex:1;min-width:240px"><span>目標概念</span><div id="pk"></div></div>
          <label class="check"><input type="checkbox" id="hard" ${hardOnly ? 'checked' : ''}> 只看「必備」先修</label>
          ${t ? '<button class="btn" id="print" type="button">🖨 列印</button>' : ''}
        </div>
      </div>
      <div id="out"></div>`;
    picker($('#pk'), { value: t, autofocus: true, onPick: (p) => { location.hash = '#/path/' + p.id; } });
    $('#hard').addEventListener('change', (e) => { pref.set('pathHard', e.target.checked ? '1' : '0'); path(id); });
    if (!t) { $('#out').innerHTML = '<p class="empty">先在上面選一個目標概念。</p>'; return; }
    $('#print').addEventListener('click', () => window.print());

    const list = TWT.ancestors(idx, t.id, { hardOnly }).concat([t]);
    const byGrade = new Map();
    for (const x of list) {
      if (!byGrade.has(x.gradeStart)) byGrade.set(x.gradeStart, []);
      byGrade.get(x.gradeStart).push(x);
    }
    const grades = [...byGrade.keys()].sort((a, b) => a - b);
    const subjects = new Set(list.map((x) => x.subject));
    $('#out').innerHTML = `
      <div class="card">
        <h2 style="font-size:19px">學會「${esc(t.name)}」的路徑</h2>
        <p class="muted small" style="margin:4px 0 12px">共 ${list.length - 1} 個先修概念，跨 ${grades.length} 個年級${subjects.size > 1 ? `、${subjects.size} 個領域` : ''}。由上而下依序學習；點任一概念看詳細內容。</p>
        <div class="timeline">
          ${grades.map((g) => `<div class="tl-grade"><div class="tl-label">${g} 年級</div><div class="tl-items">
            ${byGrade.get(g).map((x) => `<a class="tl-item ${x.id === t.id ? 'target' : ''}" href="#/topic/${x.id}">${x.subject !== t.subject ? `<span class="dot" style="background:${subjColor(x.subject)}" title="${esc(x.subject)}"></span>` : ''}${esc(x.name)}</a>`).join('')}
          </div></div>`).join('')}
        </div>
      </div>`;
  }

  // ---------- 診斷補救 ----------
  const diag = { target: null, answers: [], includeSoft: false };

  function diagnose(id) {
    if (id && (!diag.target || diag.target.id !== id)) {
      diag.target = idx.byId.get(id) || null;
      diag.answers = [];
    }
    if (!id) diag.target = null;
    const t = diag.target;
    const name = pref.get('student', '');

    if (!t) {
      view.innerHTML = `
        <h2>診斷補救</h2>
        <p class="lead">孩子在某個概念卡關時，從那個概念開始逐題檢核：答「不會」就往前一層追，答「會」就不再追它的先修。最後告訴你從哪裡開始補、依什麼順序補。</p>
        <div class="steps"><span class="on">1 選概念</span><span>2 逐題檢核</span><span>3 補救建議</span></div>
        <div class="card">
          <div class="field"><span>孩子卡住的概念</span><div id="pk"></div></div>
          <div class="row" style="margin-top:12px">
            <label class="field" style="max-width:320px;width:100%"><span>學生姓名（選填，只代入題目，不會上傳）</span><input type="text" id="sname" value="${esc(name)}" placeholder="例如：小明"></label>
            <label class="check" style="margin-top:18px"><input type="checkbox" id="soft" ${diag.includeSoft ? 'checked' : ''}> 也檢核「有助」的先修（題目較多）</label>
          </div>
        </div>
        <p class="muted small" style="margin-top:14px">小提醒：檢核時請讓孩子實際回答或操作，依「精熟證據」判斷是否通過。</p>`;
      $('#sname').addEventListener('input', (e) => pref.set('student', e.target.value));
      $('#soft').addEventListener('change', (e) => { diag.includeSoft = e.target.checked; });
      picker($('#pk'), { autofocus: true, onPick: (p) => { location.hash = '#/diagnose/' + p.id; } });
      return;
    }

    const answers = new Map(diag.answers);
    const r = TWT.diagnose(idx, t.id, answers, { includeSoft: diag.includeSoft });
    const head = `
      <div class="row no-print" style="margin-bottom:10px">
        <h2 style="flex:1">診斷：${esc(t.name)}</h2>
        <a class="btn small" href="#/diagnose">換一個概念</a>
      </div>
      <div class="steps"><span>1 選概念</span><span class="${r.done ? '' : 'on'}">2 逐題檢核</span><span class="${r.done ? 'on' : ''}">3 補救建議</span></div>`;
    const history = diag.answers.length ? `<div class="history">${diag.answers.map(([qid, ok]) => `<span class="chip ${ok ? 'ok' : 'bad'}">${ok ? '✓' : '✗'} ${esc(idx.byId.get(qid).name)}</span>`).join('')}</div>` : '';

    if (!r.done) {
      const q = r.next;
      view.innerHTML = head + `
        <div class="card question">
          <div class="row"><span class="muted small">第 ${diag.answers.length + 1} 題</span><span class="spacer"></span>${topicChips(q)}</div>
          <h2>${esc(q.name)}</h2>
          <div class="prompt">${esc(TWT.fillName(q.assessmentPrompt, name))}</div>
          <h3>判斷標準：做到這些就算「會」</h3>
          <ul>${q.evidence.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>
          <div class="answer">
            <button class="btn ok" id="yes" type="button">✓ 會</button>
            <button class="btn bad" id="no" type="button">✗ 不會</button>
          </div>
          <div class="row" style="margin-top:12px">
            <button class="btn small" id="undo" type="button" ${diag.answers.length ? '' : 'disabled'}>↶ 上一題</button>
            <span class="muted small">已檢核 ${diag.answers.length} 題${r.inferred.length ? `，${r.inferred.length} 個先修因答「會」而免檢核` : ''}</span>
          </div>
          ${history}
        </div>`;
      const ans = (ok) => { diag.answers.push([q.id, ok]); diagnose(t.id); };
      $('#yes').addEventListener('click', () => ans(true));
      $('#no').addEventListener('click', () => ans(false));
      $('#undo').addEventListener('click', () => { diag.answers.pop(); diagnose(t.id); });
      return;
    }

    const starts = new Set(r.startPoints.map((x) => x.id));
    view.innerHTML = head + (r.failed.length === 0 ? `
      <div class="card"><h2 style="font-size:19px">🎉 ${esc(name || '孩子')}已掌握「${esc(t.name)}」</h2>
        <p class="muted">目標概念檢核通過，不需要補救。可以前往後續概念，或改用分級任務的「進階」挑戰。</p>
        <div class="row"><a class="btn" href="#/topic/${t.id}">看進階任務</a></div></div>` : `
      <div class="card">
        <h2 style="font-size:19px">補救建議${name ? `：${esc(name)}` : ''}</h2>
        <p class="muted">檢核 ${diag.answers.length} 題，${r.failed.length} 個概念需要補強。
          <b style="color:var(--bad)">從紅色標記的起點開始</b>，依序往下補，最後回到「${esc(t.name)}」。</p>
        <ol class="remed">${r.remediation.map((x) => {
          const d = x.differentiatedTasks;
          return `<li class="${starts.has(x.id) ? 'is-start' : ''}">
            <div class="row">${topicLink(x)} ${starts.has(x.id) ? '<span class="chip bad">補救起點</span>' : ''}<span class="muted small">${esc(x.subject)} · ${gradeText(x)}</span></div>
            ${d ? `<div class="small" style="margin-top:4px"><b style="color:var(--warn)">基礎任務：</b>${esc(d.foundational)}</div>
                   <div class="small"><b style="color:var(--ok)">做到後試試：</b>${esc(d.basic)}</div>` : ''}
          </li>`;
        }).join('')}</ol>
      </div>`) + `
      <div class="card no-print">
        <div class="row">
          <button class="btn" id="undo" type="button">↶ 修改上一題</button>
          <button class="btn" id="again" type="button">重新診斷</button>
          <button class="btn" id="print" type="button">🖨 列印</button>
          <button class="btn" id="copy" type="button">📋 複製結果</button>
        </div>
        ${history}
      </div>`;
    $('#undo').addEventListener('click', () => { diag.answers.pop(); diagnose(t.id); });
    $('#again').addEventListener('click', () => { diag.answers = []; diagnose(t.id); });
    $('#print').addEventListener('click', () => window.print());
    $('#copy').addEventListener('click', () => copyText(r.failed.length
      ? `【${name || '學生'}】「${t.name}」診斷結果\n補救順序：\n` + r.remediation.map((x, i) => `${i + 1}. ${x.name}${starts.has(x.id) ? '（起點）' : ''}`).join('\n')
      : `【${name || '學生'}】已掌握「${t.name}」`));
  }

  // ---------- 教學設計表 ----------
  function plan(q) {
    const subject = idx.subjects.includes(q.subject) ? q.subject : '數學';
    // 預設範圍：數學依年級，其他依學習階段；選這個領域最早有內容的那一段
    const firstRange = (s) => {
      const minGrade = Math.min(...idx.topics.filter((t) => t.subject === s).map((t) => t.gradeStart));
      return s === '數學' ? `g${minGrade}` : `s${Math.ceil(minGrade / 2)}`;
    };
    const range = q.range || firstRange(subject);
    const rangeOpts = [
      ...[1, 2, 3, 4, 5, 6].map((g) => [`g${g}`, `${g} 年級`]),
      ...[1, 2, 3].map((s) => [`s${s}`, TWT.STAGE_NAME[s]]),
      ['all', '全部年段'],
    ];
    view.innerHTML = `
      <h2>逐課教學設計表</h2>
      <p class="lead">依先修關係自動排序，每節附學習內容、對應課綱、教學法、先備概念、形成性評量、分級任務與達成指標。這是草稿，請依班級與教科書調整。</p>
      <div class="card no-print">
        <div class="plan-controls">
          <label class="field"><span>領域</span><select id="subject">${subjectOptions(subject)}</select></label>
          <label class="field"><span>範圍</span><select id="range">${rangeOpts.map(([v, l]) => `<option value="${v}" ${v === range ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
          <div class="row"><button class="btn" id="dl" type="button">⬇ 下載 Markdown</button><button class="btn" id="print" type="button">🖨 列印</button></div>
        </div>
      </div>
      <div id="out" style="margin-top:14px"></div>`;
    const go = () => { location.hash = `#/plan?subject=${enc($('#subject').value)}&range=${$('#range').value}`; };
    $('#subject').addEventListener('change', () => { $('#range').value = firstRange($('#subject').value); go(); });
    $('#range').addEventListener('change', go);

    const spec = { subject };
    if (range[0] === 'g') spec.grade = +range.slice(1);
    if (range[0] === 's') spec.stage = +range.slice(1);
    const p = TWT.lessonPlan(idx, spec);
    $('#dl').disabled = !p;
    $('#print').addEventListener('click', () => window.print());
    if (!p) { $('#out').innerHTML = `<p class="empty">「${esc(subject)}」在這個範圍沒有微主題，換個年級或學習階段試試。</p>`; return; }
    $('#dl').addEventListener('click', () => download(TWT.lessonPlanFileName(p), TWT.lessonPlanMarkdown(p)));

    const codeStr = (l) => [l.contentCodes.length ? '學習內容 ' + l.contentCodes.join('、') : '', l.performanceCodes.length ? '學習表現 ' + l.performanceCodes.join('、') : ''].filter(Boolean).join('　') || '（能力向度，見學習表現）';
    $('#out').innerHTML = `
      <div class="card"><h2 style="font-size:19px">${esc(p.scope)}　逐課教學設計表</h2>
        <p class="muted small" style="margin:4px 0 0">共 ${p.lessons.length} 節、涵蓋 ${p.topicCount} 個微主題。每節先用形成性評量確認前一節精熟；先備概念未達標的學生先補該先修。</p></div>
      ${p.lessons.map((l) => `<div class="card lesson">
        <h3><span class="lesson-no">第 ${l.number} 節</span>${l.topics.map((x) => topicLink(x)).join('、')}</h3>
        <dl>
          <dt>學習內容</dt><dd>${esc(l.content)}</dd>
          <dt>對應課綱</dt><dd>${esc(codeStr(l))}</dd>
          <dt>建議教學法</dt><dd>${esc(l.method)}</dd>
          <dt>先備概念</dt><dd>${l.prereqs.length ? l.prereqs.map((x) => `${topicLink(x.topic)}<span class="chip ${x.tag === '必備' ? 'accent' : ''}" style="margin:0 6px 0 4px">${x.tag}</span>${x.crossSubject ? `<span class="muted small">（${esc(x.crossSubject)}）</span>` : ''}`).join(' ') : '（起點，無先備）'}</dd>
          <dt>形成性評量</dt><dd>${l.assessments.map((a) => esc(TWT.fillName(a, ''))).join('<br>')}</dd>
          ${l.tasks ? `<dt>分級任務</dt><dd><b style="color:var(--accent)">進階</b> ${esc(l.tasks.advanced)}<br><b style="color:var(--ok)">基本</b> ${esc(l.tasks.basic)}<br><b style="color:var(--warn)">基礎</b> ${esc(l.tasks.foundational)}</dd>` : ''}
          <dt>達成指標</dt><dd>${l.evidence.map(esc).join('；')}</dd>
        </dl></div>`).join('')}`;
  }

  // ---------- 知識圖 ----------
  function graph(id) {
    view.innerHTML = `
      <div class="graph-wrap">
        <aside class="graph-side card">
          <div class="field"><span>找概念並高亮它的先修</span><div id="pk"></div></div>
          <h3>領域（點一下顯示／隱藏）</h3>
          <div class="legend" id="legend"></div>
          <button class="btn small" id="reset" type="button" style="margin-top:10px">重設</button>
          <div id="gdetail" style="margin-top:12px"></div>
          <p class="muted small" style="margin-top:12px;line-height:1.6">點節點：高亮所有先修<br>滾輪或雙指：縮放；拖曳：平移<br>節點越大＝解鎖越多後續<br>由上而下＝低年級到高年級</p>
        </aside>
        <div class="graph-stage" id="stage"><div class="tip" id="tip"></div><p class="empty" id="gload">知識圖載入中…（需要連網）</p></div>
      </div>`;
    const showDetail = (t) => {
      const el = $('#gdetail');
      if (!t) { el.innerHTML = ''; return; }
      const n = TWT.ancestors(idx, t.id).length;
      el.innerHTML = `<div class="card" style="padding:12px;box-shadow:none">
        <b>${esc(t.name)}</b><div class="muted small">${esc(t.subject)} · ${gradeText(t)}</div>
        <p class="small" style="margin:6px 0">${esc(t.description)}</p>
        <div class="small muted">直接先修 ${idx.up.get(t.id).length} 個，往上游共 ${n} 個</div>
        <div class="row" style="margin-top:8px"><a class="btn small" href="#/topic/${t.id}">詳細內容</a><a class="btn small" href="#/path/${t.id}">學習路徑</a></div></div>`;
    };
    window.TWTGraph.mount({
      stage: $('#stage'), legend: $('#legend'), tip: $('#tip'), loading: $('#gload'),
      idx, TWT, subjColor, ELECTIVE,
      onSelect: (t) => { showDetail(t); history.replaceState(null, '', t ? '#/graph/' + t.id : '#/graph'); },
      initial: id && idx.byId.get(id),
    }).then((api) => {
      if (!api) return;
      picker($('#pk'), { value: id && idx.byId.get(id), placeholder: '輸入概念名稱', onPick: (t) => api.select(t) });
      $('#reset').addEventListener('click', () => api.select(null));
      if (id && idx.byId.get(id)) showDetail(idx.byId.get(id));
    });
    if (!$('#pk').children.length) picker($('#pk'), { placeholder: '輸入概念名稱', onPick: () => {} });
  }

  // ---------- 路由 ----------
  function route() {
    const h = location.hash.replace(/^#\/?/, '');
    const [p, qs] = h.split('?');
    const [name, arg] = p.split('/');
    const q = Object.fromEntries(new URLSearchParams(qs || ''));
    const tab = { '': 'home', topic: 'search' }[name] ?? name;
    $$('a', document.getElementById('tabs')).forEach((a) => a.classList.toggle('on', a.dataset.tab === tab));
    window.TWTGraph.unmount();
    window.scrollTo(0, 0);
    switch (name) {
      case 'search': return search(q);
      case 'topic': return topic(arg);
      case 'path': return path(arg);
      case 'diagnose': return diagnose(arg);
      case 'plan': return plan(q);
      case 'graph': return graph(arg);
      default: return home();
    }
  }

  // ---------- 主題切換 ----------
  document.getElementById('theme').addEventListener('click', () => {
    const root = document.documentElement;
    const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
    pref.set('theme', root.dataset.theme);
    if (location.hash.startsWith('#/graph')) route();
  });

  window.addEventListener('hashchange', route);
  route();
})();
