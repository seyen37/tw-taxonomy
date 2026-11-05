/* 知識圖：D3 力導向圖，年段由上而下分層、依領域上色。
 * D3 只在打開這個分頁時才載入：先用專案內附的 vendor/d3.min.js（離線可用），失敗才改用 CDN。 */
(function () {
  'use strict';
  const D3_URLS = ['vendor/d3.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js'];
  let d3Promise = null;
  let current = null;

  const loadScript = (src) => new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => { s.remove(); reject(new Error(src)); };
    document.head.appendChild(s);
  });

  function loadD3() {
    if (window.d3) return Promise.resolve(window.d3);
    if (!d3Promise) {
      d3Promise = D3_URLS.reduce((p, url) => p.catch(() => loadScript(url)), Promise.reject())
        .then(() => window.d3)
        .catch((e) => { d3Promise = null; throw e; });
    }
    return d3Promise;
  }

  function unmount() {
    if (current) { current.sim.stop(); window.removeEventListener('resize', current.onResize); current = null; }
  }

  async function mount(o) {
    unmount();
    let d3;
    try { d3 = await loadD3(); } catch (e) {
      o.loading.textContent = '繪圖元件載入失敗（找不到 app/vendor/d3.min.js，也無法連網）。其他分頁不受影響。';
      return null;
    }
    if (!o.stage.isConnected) return null; // 載入期間已切換分頁
    o.loading.remove();

    const css = getComputedStyle(document.documentElement);
    const C = { link: css.getPropertyValue('--graph-link').trim(), hi: css.getPropertyValue('--graph-hi').trim(), bg: css.getPropertyValue('--graph-bg').trim() };
    const { idx, subjColor, ELECTIVE } = o;
    let W = o.stage.clientWidth, H = o.stage.clientHeight;

    const svg = d3.select(o.stage).append('svg');
    const g = svg.append('g');
    const gBands = g.append('g').attr('class', 'bands');
    const gLink = g.append('g');
    const gNode = g.append('g');
    const bandY = (st) => H * 0.16 + (st - 1) * (H * 0.30);
    ['一・二年級', '三・四年級', '五・六年級'].forEach((label, i) => {
      const y = bandY(i + 1);
      gBands.append('line').attr('x1', 20).attr('x2', W - 20).attr('y1', y).attr('y2', y);
      gBands.append('text').attr('x', 26).attr('y', y - 8).text(label);
    });

    const nodes = idx.topics.map((t) => ({ id: t.id, t }));
    const links = idx.edges.map((e) => ({ source: e.prerequisiteId, target: e.topicId, hard: e.strength === 'hard' }));
    const subjects = idx.subjects.filter((s) => !ELECTIVE.has(s)).concat(idx.subjects.filter((s) => ELECTIVE.has(s)));
    const sx = new Map(subjects.map((s, i) => [s, W * 0.12 + W * 0.76 * (i / Math.max(1, subjects.length - 1))]));
    const r = (d) => 3.2 + (d.t.centrality || 0) * 13;
    const isPerf = (t) => !t.contentCodes.length && t.performanceCodes.length;

    const link = gLink.selectAll('line').data(links).join('line');
    const node = gNode.selectAll('circle').data(nodes).join('circle')
      .attr('r', r).attr('fill', (d) => subjColor(d.t.subject))
      .attr('stroke', C.bg).attr('stroke-width', 0.8);
    node.append('title').text((d) => d.t.name);

    const tip = o.tip;
    node.on('mouseover', (e, d) => { tip.style.display = 'block'; tip.innerHTML = ''; const b = document.createElement('b'); b.textContent = d.t.name; tip.append(b, document.createElement('br'), `${d.t.subject} · ${d.t.gradeStart}年級`); })
      .on('mousemove', (e) => { const rc = o.stage.getBoundingClientRect(); tip.style.left = (e.clientX - rc.left + 14) + 'px'; tip.style.top = (e.clientY - rc.top + 12) + 'px'; })
      .on('mouseout', () => { tip.style.display = 'none'; })
      .on('click', (e, d) => { e.stopPropagation(); select(d.t); });

    const sim = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id((d) => d.id).distance(34).strength((d) => (d.hard ? 0.5 : 0.18)))
      .force('charge', d3.forceManyBody().strength(-42))
      .force('x', d3.forceX((d) => sx.get(d.t.subject)).strength(0.09))
      .force('y', d3.forceY((d) => bandY(d.t.stage)).strength(0.5))
      .force('collide', d3.forceCollide().radius((d) => r(d) + 1.3))
      .velocityDecay(0.32);
    sim.on('tick', () => {
      link.attr('x1', (d) => d.source.x).attr('y1', (d) => d.source.y).attr('x2', (d) => d.target.x).attr('y2', (d) => d.target.y);
      node.attr('cx', (d) => d.x).attr('cy', (d) => d.y);
    });
    for (let i = 0; i < 220; i++) sim.tick();
    sim.alpha(0.3).restart();

    node.call(d3.drag()
      .on('start', (e, d) => { if (!e.active) sim.alphaTarget(0.2).restart(); d.fx = d.x; d.fy = d.y; })
      .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y; })
      .on('end', (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; }));
    const zoom = d3.zoom().scaleExtent([0.3, 6]).on('zoom', (e) => g.attr('transform', e.transform));
    svg.call(zoom).on('click', () => select(null));

    // 高亮先修鏈
    let selected = null;
    function paint() {
      const anc = selected ? new Set(o.TWT.ancestors(idx, selected.id).map((t) => t.id).concat(selected.id)) : null;
      const on = (l) => anc && anc.has(l.source.id) && anc.has(l.target.id);
      node.attr('opacity', (d) => (anc ? (anc.has(d.id) ? 1 : 0.08) : isPerf(d.t) ? 0.72 : 1))
        .attr('stroke', (d) => (selected && d.id === selected.id ? C.hi : C.bg))
        .attr('stroke-width', (d) => (selected && d.id === selected.id ? 3 : 0.8));
      link.attr('stroke', (l) => (on(l) ? C.hi : C.link))
        .attr('stroke-opacity', (l) => (anc ? (on(l) ? 0.9 : 0.04) : 0.4))
        .attr('stroke-width', (l) => (on(l) ? 1.6 : l.hard ? 1.1 : 0.6));
    }
    function select(t) {
      selected = t;
      paint();
      o.onSelect(t);
      if (t) {
        // 縮放到剛好容納整條先修鏈
        const ids = new Set(o.TWT.ancestors(idx, t.id).map((x) => x.id).concat(t.id));
        const pts = nodes.filter((n) => ids.has(n.id));
        const pad = 40;
        const x0 = Math.min(...pts.map((n) => n.x)) - pad, x1 = Math.max(...pts.map((n) => n.x)) + pad;
        const y0 = Math.min(...pts.map((n) => n.y)) - pad, y1 = Math.max(...pts.map((n) => n.y)) + pad;
        const k = Math.max(0.3, Math.min(2.5, W / (x1 - x0), H / (y1 - y0)));
        svg.transition().duration(500).call(zoom.transform,
          d3.zoomIdentity.translate(W / 2 - ((x0 + x1) / 2) * k, H / 2 - ((y0 + y1) / 2) * k).scale(k));
      }
    }

    // 圖例篩選
    const hidden = new Set();
    o.legend.innerHTML = '';
    const rows = subjects.filter((s) => !ELECTIVE.has(s)).map((s) => [s, s, subjColor(s), idx.counts[s]]);
    const electN = [...ELECTIVE].reduce((a, s) => a + idx.counts[s], 0);
    if (electN) rows.push(['__elect__', '選修語文（6 種）', '#7d8aa0', electN]);
    for (const [key, label, color, n] of rows) {
      const row = document.createElement('div');
      row.innerHTML = `<span class="dot" style="background:${color}"></span><span></span><span class="n">${n}</span>`;
      row.children[1].textContent = label;
      row.addEventListener('click', () => {
        if (hidden.has(key)) hidden.delete(key); else hidden.add(key);
        row.classList.toggle('off', hidden.has(key));
        const off = (t) => hidden.has(t.subject) || (hidden.has('__elect__') && ELECTIVE.has(t.subject));
        node.style('display', (d) => (off(d.t) ? 'none' : null));
        link.style('display', (l) => (off(l.source.t) || off(l.target.t) ? 'none' : null));
      });
      o.legend.appendChild(row);
    }

    const onResize = () => { W = o.stage.clientWidth; H = o.stage.clientHeight; };
    window.addEventListener('resize', onResize);
    current = { sim, onResize };
    paint();
    if (o.initial) setTimeout(() => select(o.initial), 50);
    return { select };
  }

  window.TWTGraph = { mount, unmount };
})();
