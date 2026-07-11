#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""gen_lesson_plan.py — 由 tw-taxonomy 資料自動生成「逐課教學設計表」。

用法：
  python3 gen_lesson_plan.py --subject 數學 --grade 3
  python3 gen_lesson_plan.py --subject 國語文 --stage 2 --out plan.md

作法：取指定領域（可再限年級／學習階段）的微主題，依先修關係做拓撲排序，
每 1~2 個微主題編成一節課，輸出含：節次、學習內容、對應課綱碼、
建議教學法（依型別）、先備概念（先修）、形成性評量（assessmentPrompt）。
"""
import argparse, json, os
from collections import defaultdict, deque

DATA = '/sessions/tender-busy-hamilton/mnt/taxonomy/tw-taxonomy/data'

# 型別 → 建議教學法（與《教師使用手冊》一致）
TYPE_METHOD = {
    'CONCEPTUAL':      '概念建立：分類卡牌／配對／情境判斷、實例與非實例對照',
    'PROCEDURAL':      '程序熟練：示範後計時挑戰／闖關／反覆操作練習',
    'REPRESENTATIONAL':'表徵轉換：圖卡↔算式配對、畫圖說明、操作教具記錄',
    'LANGUAGE':        '符號語言：賓果／聽寫接力／符號辨識搶答',
    'META':            '後設態度：角色扮演／任務型活動／反思分享圈',
}
STAGE_NAME = {1: '第一學習階段（1-2年級）', 2: '第二學習階段（3-4年級）', 3: '第三學習階段（5-6年級）'}


def load():
    t = json.load(open(f'{DATA}/topics.json'))['topics']
    d = json.load(open(f'{DATA}/dependencies.json'))['dependencies']
    return t, d


def topo_order(nodes, edges):
    """對 nodes 子集做拓撲排序；只考慮子集內部的邊。穩定排序：同層依年級、中心性。"""
    ids = {n['id'] for n in nodes}
    byid = {n['id']: n for n in nodes}
    adj = defaultdict(list)   # prereq -> [topic]
    indeg = {i: 0 for i in ids}
    for e in edges:
        if e['topicId'] in ids and e['prerequisiteId'] in ids:
            adj[e['prerequisiteId']].append(e['topicId'])
            indeg[e['topicId']] += 1
    # Kahn，佇列以（年級, -中心性, 名稱）排序讓輸出穩定且由淺入深
    def key(i):
        n = byid[i]
        return (n['gradeStart'] or 0, -(n['centrality'] or 0), n['name'])
    ready = sorted([i for i in ids if indeg[i] == 0], key=key)
    order = []
    while ready:
        u = ready.pop(0)
        order.append(byid[u])
        for v in adj[u]:
            indeg[v] -= 1
            if indeg[v] == 0:
                ready.append(v)
        ready.sort(key=key)
    # 若有殘留（子集內含環，理論上不會）補在後面
    for i in ids:
        if byid[i] not in order:
            order.append(byid[i])
    return order


def group_lessons(order):
    """把排序後的微主題編成節次：每節 1 個主概念；相鄰同領域的小型 LANGUAGE/META 可併。"""
    lessons = []
    i = 0
    while i < len(order):
        cur = order[i]
        bundle = [cur]
        # 若下一個是同 domain 的語言/後設型且本身非核心（中心性低），併入同一節
        if i + 1 < len(order):
            nxt = order[i + 1]
            if (nxt['domain'] == cur['domain'] and nxt['type'] in ('LANGUAGE', 'META')
                    and (nxt['centrality'] or 0) < 0.05 and cur['type'] not in ('LANGUAGE', 'META')):
                bundle.append(nxt)
                i += 1
        lessons.append(bundle)
        i += 1
    return lessons


def gen(subject, grade=None, stage=None):
    topics, edges = load()
    byid = {n['id']: n for n in topics}
    up = defaultdict(list)  # topic -> [prereq nodes]
    for e in edges:
        up[e['topicId']].append((byid[e['prerequisiteId']], e['strength']))

    sel = [n for n in topics if n['subject'] == subject]
    if grade is not None:
        sel = [n for n in sel if (n['gradeStart'] or 0) <= grade <= (n['gradeEnd'] or 0)]
    if stage is not None:
        sel = [n for n in sel if n['stage'] == stage]
    if not sel:
        return None
    order = topo_order(sel, edges)
    lessons = group_lessons(order)
    placed = {n['id'] for n in order}

    scope = subject
    if grade is not None: scope += f'（{grade}年級）'
    elif stage is not None: scope += f'（{STAGE_NAME.get(stage, stage)}）'

    out = [f'# {scope}　逐課教學設計表（自動生成草稿）', '',
           f'由 tw-taxonomy 依先修關係自動排序生成，共 {len(lessons)} 節、涵蓋 {len(order)} 個學習微主題。',
           '此為草稿，實際教學節數與順序請依班級狀況與教科書版本調整。', '',
           '> 使用方式：每節先用「形成性評量」快速確認前一節精熟；先備概念未達標的學生先補該先修節次。', '']

    for idx, bundle in enumerate(lessons, 1):
        main = bundle[0]
        names = '、'.join(b['name'] for b in bundle)
        out.append(f'## 第 {idx} 節　{names}')
        out.append('')
        # 學習內容
        descs = '；'.join(b['description'] for b in bundle)
        out.append(f'- **學習內容**：{descs}')
        # 課綱對應
        cc = sorted({c.split(":")[1] for b in bundle for c in b['contentCodes']})
        pc = sorted({c.split(":")[1] for b in bundle for c in b['performanceCodes']})
        code_str = ('學習內容 ' + '、'.join(cc) if cc else '') + ('　學習表現 ' + '、'.join(pc) if pc else '')
        out.append(f'- **對應課綱**：{code_str or "（能力向度，見學習表現）"}')
        # 教學法（取主概念型別）
        out.append(f'- **建議教學法**：{TYPE_METHOD.get(main["type"], "")}')
        # 先備概念（本節微主題的直接先修中，排在更前面節次或跨領域者）
        prereqs = []
        seen = set()
        for b in bundle:
            for p, strength in up[b['id']]:
                if p['id'] in {x['id'] for x in bundle}:
                    continue
                tag = '必備' if strength == 'hard' else '有助'
                cross = '（跨領域：%s）' % p['subject'] if p['subject'] != subject else ''
                key = p['name']
                if key not in seen:
                    seen.add(key)
                    prereqs.append(f'{p["name"]}[{tag}]{cross}')
        out.append(f'- **先備概念**：{"；".join(prereqs) if prereqs else "（起點，無先備）"}')
        # 形成性評量
        assess = [f'「{b["assessmentPrompt"]}」' for b in bundle if b.get('assessmentPrompt')]
        out.append(f'- **形成性評量**：{" ".join(assess)}')
        # 分級任務（若有）
        dt = main.get('differentiatedTasks')
        if dt:
            out.append(f'- **分級任務**：進階〔{dt["advanced"]}〕／基本〔{dt["basic"]}〕／基礎〔{dt["foundational"]}〕')
        # 精熟證據（當達成指標）
        ev = '；'.join(e for b in bundle for e in b['evidence'])
        out.append(f'- **達成指標**：{ev}')
        out.append('')

    return '\n'.join(out)


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--subject', required=True)
    ap.add_argument('--grade', type=int)
    ap.add_argument('--stage', type=int)
    ap.add_argument('--out')
    a = ap.parse_args()
    md = gen(a.subject, a.grade, a.stage)
    if md is None:
        print('查無符合的微主題，請檢查 --subject／--grade／--stage')
        raise SystemExit(1)
    if a.out:
        open(a.out, 'w').write(md)
        print(f'已寫出 {a.out}（{md.count(chr(10).join(["## "]))} …）')
    else:
        print(md)
