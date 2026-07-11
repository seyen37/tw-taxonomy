#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""pos.py — 座標感知備援解析：無格線多欄版面。
支援同列多代碼（綜合活動雙欄式）、說明欄動態界線（生活課程式）。"""
import json, os, re, subprocess, sys, unicodedata
import pc

def nfkc(s): return unicodedata.normalize('NFKC', s)

def code_pages(path, perf_re, cont_re):
    txt = subprocess.run(['pdftotext', path, '-'], capture_output=True, text=True).stdout
    out = []
    for i, p in enumerate(txt.split('\f')):
        p = nfkc(p)
        if any(perf_re.match(w) or cont_re.match(w) for w in re.findall(r'\S+', p)):
            out.append(i)
    return out

HEADERS = ('學習內容', '學習表現', '主題軸', '主題項目', '編碼', '附錄', '學習階段')
MARK = re.compile(r'^\d{1,2}\.(?![0-9])')

def parse_positional(cfg, path, perf_re, cont_re):
    import pdfplumber
    entries, seen = [], set()
    open_cols = []            # [(entry, x_lo, x_hi)]
    has_note, note_x = False, float('inf')
    pdf = pdfplumber.open(path)

    perf_loose = re.compile(cfg['perf_code'].rstrip('$') + r'(?![0-9])')
    cont_loose = re.compile(cfg['cont_code'].rstrip('$') + r'(?![0-9])')

    perf_any = re.compile(cfg['perf_code'].strip('^$') + r'(?![0-9])')
    cont_any = re.compile(cfg['cont_code'].strip('^$') + r'(?![0-9])')

    def match_code(t):
        t2 = t.rstrip('*')
        pm = perf_any.search(t2)
        cm = None if pm else cont_any.search(t2)
        if not (pm or cm):
            return None
        m = pm or cm
        prefix = t2[:m.start()].rstrip('◎*')
        return (m.group(0), pm, cm, t2[m.end():].lstrip('*'), prefix)

    for pi in code_pages(path, perf_re, cont_re):
        words = sorted(pdf.pages[pi].extract_words(x_tolerance=5), key=lambda w: w['top'])
        lines = []
        for w in words:
            if lines and w['top'] - lines[-1][0] <= 4.5:
                lines[-1][1].append(w)
            else:
                lines.append([w['top'], [w]])
        for _, lws in lines:
            ws = sorted(lws, key=lambda w: w['x0'])
            texts = [nfkc(w['text']) for w in ws]
            joined = ''.join(texts)
            if re.fullmatch(r'\d+', joined):
                continue
            for t in texts:
                if t.startswith(('學習表現說明', '學習內容說明', '補充說明')):
                    has_note = True
            hits = [(i,) + m for i, t in enumerate(texts) if (m := match_code(t))]
            if any(t.startswith(h) for t in texts for h in HEADERS) and not hits:
                open_cols = []
                continue
            if hits:
                hit_xs = [ws[h[0]]['x0'] for h in hits]
                # 舊欄位：若本行沒有落在其範圍內的新代碼，收續行並保持開啟
                kept = []
                for e, cx, hi in open_cols:
                    same = [h for h, x in zip(hits, hit_xs) if abs(x - cx) < 10]
                    if same:
                        e['text'] += same[0][5]  # 黏在新代碼前的殘字補回前一條
                        continue  # 同欄出現新代碼 → 關閉
                    cap_hi = min([hi, note_x] + [x - 2 for x in hit_xs if x > cx + 10])
                    seg = ''.join(t for w, t in zip(ws, texts) if cx - 4 <= w['x0'] < cap_hi)
                    e['text'] += seg
                    kept.append((e, cx, hi))
                open_cols = kept
                # 說明欄動態界線（只影響最後一欄右界）
                if has_note:
                    last_i = hits[-1][0]
                    for w, t in zip(ws[last_i+1:], texts[last_i+1:]):
                        if MARK.match(t) and w['x0'] > ws[last_i]['x1'] + 15:
                            note_x = min(note_x, w['x0'] - 2)
                            break
                for h, nxt in zip(hits, hits[1:] + [None]):
                    idx, code, pm, cm, inline, _prefix = h
                    kind = 'performance' if pm else 'content'
                    m = pm or cm
                    sg = pc._classify(cfg, kind, m)
                    x_lo = ws[idx]['x1']
                    x_hi = ws[nxt[0]]['x0'] - 2 if nxt else note_x
                    if sg is None or code in seen:
                        continue
                    seen.add(code)
                    seg = [(w, t) for w, t in zip(ws[idx+1:], texts[idx+1:])
                           if x_lo < w['x0'] < x_hi]
                    e = {'kind': kind, 'code': code, 'text': inline + ''.join(t for _, t in seg),
                         'category': cfg['cat'].get(m.group(1), m.group(1)),
                         'stage': sg[0], 'grade': sg[1]}
                    entries.append(e)
                    open_cols.append((e, ws[idx]['x0'], x_hi))
            elif open_cols:
                if has_note:
                    for w, t in zip(ws, texts):
                        if MARK.match(t) and w['x0'] > open_cols[0][1] + 40:
                            note_x = min(note_x, w['x0'] - 2)
                            break
                for e, cx, hi in open_cols:
                    hi = min(hi, note_x)
                    seg = ''.join(t for w, t in zip(ws, texts) if cx - 4 <= w['x0'] < hi)
                    e['text'] += seg
    return entries

def parse(slug):
    cfg = pc.SUBJECTS[slug]
    path = os.path.join(pc.SRC, cfg['file'])
    perf_re, cont_re = re.compile(cfg['perf_code']), re.compile(cfg['cont_code'])
    entries = pc.parse_tables(cfg, path, perf_re, cont_re)
    mode = 'tables'
    if not entries:
        entries = parse_positional(cfg, path, perf_re, cont_re)
        mode = 'positional'
    from collections import defaultdict
    warns = []
    seq = defaultdict(list)
    for e in entries:
        m = re.match(r'^(.+)-(\d+)$', e['code'])
        seq[m.group(1)].append(int(m.group(2)))
    for k, v in sorted(seq.items()):
        if sorted(v) != list(range(1, len(v) + 1)):
            warns.append(f'流水號不連續 {k}: {sorted(v)}')
    short = [e['code'] for e in entries if len(e['text']) < 4]
    if short: warns.append(f'條文過短: {short}')
    os.makedirs(pc.OUT, exist_ok=True)
    result = {'slug': slug, 'name': cfg['name'], 'elective': cfg.get('elective', False),
              'file': cfg['file'], 'mode': mode, 'entries': entries, 'warnings': warns,
              'counts': {'total': len(entries),
                         'performance': sum(1 for e in entries if e['kind'] == 'performance'),
                         'content': sum(1 for e in entries if e['kind'] == 'content')}}
    with open(os.path.join(pc.OUT, f'{slug}.json'), 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=1)
    print(f"{slug}[{mode}]: perf={result['counts']['performance']} cont={result['counts']['content']} warns={len(warns)}", flush=True)
    for w in warns[:8]:
        print('  !', w, flush=True)

if __name__ == '__main__':
    for s in sys.argv[1:]:
        parse(s)
