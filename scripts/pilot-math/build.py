#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""build.py — 全領域微主題批次 → topics.json + dependencies.json ＋守門檢查＋自動連邊。"""
import json, os, hashlib, re, sys
from collections import defaultdict, Counter

DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'data')
# (變數, 檔, subject, slug, elective, autolink)
GROUPS = [
 ('G1','g1','數學','math',False,False),('G2N','g2n','數學','math',False,False),('G2SRD','g2srd','數學','math',False,False),
 ('G3','g3','數學','math',False,False),('G4','g4','數學','math',False,False),('G5','g5','數學','math',False,False),('G6','g6','數學','math',False,False),
 ('MAN1','man1','國語文','mandarin',False,False),('MAN2','man2','國語文','mandarin',False,False),('MAN3','man3','國語文','mandarin',False,False),
 ('LIFEC','lifec','生活課程','life',False,False),
 ('ENG','eng','英語文','english',False,True),
 ('SCI','sci','自然科學','science',False,True),
 ('SOC','soc','社會','social',False,True),
 ('INTG','intg','綜合活動','integrative',False,True),
 ('HPE','hpe','健康與體育','health-pe',False,True),
 ('ART','art','藝術','arts',False,True),
 ('SCIP','perfnodes','自然科學','science',False,True),
 ('HPEP','perfnodes','健康與體育','health-pe',False,True),
 ('ARTP','perfnodes','藝術','arts',False,True),
 ('ELECT_NODES','elect','','',True,False),
]
EDGE_FILES = ['edges','edges2','edges3']

ns = {}
for var,f,*_ in GROUPS:
    exec(open(f'/tmp/topics/{f}.py').read(), ns)
for f in EDGE_FILES:
    exec(open(f'/tmp/topics/{f}.py').read(), ns)
EDGES = sum((ns[f.upper()] for f in EDGE_FILES), []) + ns.get('ELECT_EDGES', [])

std = json.load(open(f'{DATA}/curriculum-standards.json'))
keys = {}
slug_of_name = {s['name']: s['slug'] for s in std['subjects']}
for s in std['subjects']:
    for e in s['entries']:
        keys[f"{s['slug']}:{e['code']}"] = e['kind']

def tid(slug, name):
    return 'twt_' + hashlib.sha1(f'{slug}:{name}'.encode()).hexdigest()[:10]

errors, topics, byname = [], [], {}
autolink_subj = set()
for var,f,subject,slug,elective,auto in GROUPS:
    if auto: autolink_subj.add(subject)
    for x in ns[var]:
        sg = slug or slug_of_name.get(x.get('subject',''), '')
        subj = subject or x.get('subject','')
        # elect 節點的 subject 來自節點資料的 dom? 用 slug 反查
        if not slug:  # 選修：由節點名稱前綴對到 slug
            nm = x['n'].split('·')[0]
            sg = next((s['slug'] for s in std['subjects'] if s['name']==nm), '')
            subj = nm
        if x['n'] in byname: errors.append(f"名稱重複: {x['n']}"); continue
        for c in x['cc']:
            if keys.get(f'{sg}:{c}') != 'content': errors.append(f"{x['n']}: 內容碼不存在 {sg}:{c}")
        for c in x['pc']:
            if keys.get(f'{sg}:{c}') != 'performance': errors.append(f"{x['n']}: 表現碼不存在 {sg}:{c}")
        if subj != '英語文':  # 英語科例句本應使用半形標點
            for fld in ('d','ap'):
                if re.search(r'[,?;!]', x[fld]): errors.append(f"{x['n']}: {fld} 含半形標點")
        t = {'id': tid(sg,x['n']),'type':x['t'],'subject':subj,'domain':x['dom'],'name':x['n'],
             'description':x['d'],'stage':(x['g'][0]+1)//2,'gradeStart':x['g'][0],'gradeEnd':x['g'][1],
             'centrality':None,'elective':elective,'evidence':x['ev'],'assessmentPrompt':x['ap'],
             'contentCodes':[f'{sg}:{c}' for c in x['cc']],'performanceCodes':[f'{sg}:{c}' for c in x['pc']]}
        topics.append(t); byname[x['n']] = t

# --- 手寫邊 ---
deps, seen_e = [], set()
adj_now = defaultdict(set)  # prereq -> {topic}
def _reaches(src, dst):
    # dst 是否可從 src 沿現有邊到達（用於環檢查）
    stack=[src]; seen={src}
    while stack:
        u=stack.pop()
        if u==dst: return True
        for v in adj_now[u]:
            if v not in seen: seen.add(v); stack.append(v)
    return False
def add_edge(tn, pn, s, r, guard=False):
    if tn not in byname: errors.append(f'邊：節點不存在 {tn}'); return
    if pn not in byname: errors.append(f'邊：先修不存在 {pn}'); return
    a, b = byname[pn], byname[tn]
    if a['id']==b['id']: return
    k = (a['id'], b['id'])
    if k in seen_e: return
    if a['stage'] is not None and b['stage'] is not None and a['stage'] > b['stage']:
        if not guard: errors.append(f'邊階段逆序: {pn}({a["stage"]})->{tn}({b["stage"]})')
        return
    if guard and _reaches(b['id'], a['id']):  # 加此邊會成環
        return
    seen_e.add(k); adj_now[a['id']].add(b['id'])
    deps.append({'topicId':b['id'],'prerequisiteId':a['id'],'strength':s,'reason':r})
for tn,pn,s,r in EDGES: add_edge(tn,pn,s,r)

# --- 自動連邊：主題式領域的階段進程 ---
for subj in autolink_subj:
    nodes = [t for t in topics if t['subject']==subj]
    dom_stage = defaultdict(dict)  # domain -> stage -> [nodes]
    for t in nodes:
        dom_stage[t['domain']].setdefault(t['stage'], []).append(t)
    for dom, sts in dom_stage.items():
        ordered = sorted(sts)
        for i in range(1, len(ordered)):
            cur = sts[ordered[i]]; prevbucket = sts[ordered[i-1]]
            anchor = prevbucket[0]
            for t in cur:
                add_edge(t['name'], anchor['name'], 'hard', f'{subj}·{dom} 的階段進程', guard=True)
# 孤島修補：連到同領域同階段（或最近階段）的錨點
indeg = defaultdict(int); outdeg = defaultdict(int)
for e in deps: indeg[e['topicId']]+=1; outdeg[e['prerequisiteId']]+=1
for subj in autolink_subj:
    nodes = [t for t in topics if t['subject']==subj]
    for t in nodes:
        if indeg[t['id']]==0 and outdeg[t['id']]==0:
            cand = [o for o in nodes if o['id']!=t['id'] and o['stage'] < t['stage']]
            if not cand:
                cand = [o for o in nodes if o['id']!=t['id'] and o['stage']==t['stage']]
            cand.sort(key=lambda o:(o['stage'], o['name']))
            linked=False
            for c in cand:
                before=len(deps)
                add_edge(t['name'], c['name'], 'soft', f'{subj} 領域內關聯', guard=True)
                if len(deps)>before: linked=True; indeg[t['id']]+=1; break
            if not linked:  # 反向：讓較高階段節點依賴此孤島
                for c in [o for o in nodes if o['stage']>t['stage']]:
                    before=len(deps)
                    add_edge(c['name'], t['name'], 'soft', f'{subj} 領域內關聯', guard=True)
                    if len(deps)>before: break

in_edge = {e['topicId'] for e in deps} | {e['prerequisiteId'] for e in deps}
orphans = [t['name'] for t in topics if t['id'] not in in_edge]
if orphans: errors.append(f'孤島節點（{len(orphans)}）: {orphans[:12]}')

if errors:
    print(f'✗ 建置失敗（{len(errors)}）：'); [print(' -',e) for e in errors[:30]]; sys.exit(1)

# centrality：可達後代數（迭代式，避免遞迴爆棧）
adj = defaultdict(set)
indeg2 = defaultdict(int)
ids = [t['id'] for t in topics]
for e in deps:
    adj[e['prerequisiteId']].add(e['topicId']); indeg2[e['topicId']]+=1
# 拓撲排序
from collections import deque
topo=[]; deg=dict((i,indeg2[i]) for i in ids)
q=deque([i for i in ids if deg[i]==0])
while q:
    u=q.popleft(); topo.append(u)
    for v in adj[u]:
        deg[v]-=1
        if deg[v]==0: q.append(v)
# 反向拓撲累積後代集合（用 set 合併）
reach={i:set() for i in ids}
for u in reversed(topo):
    for v in adj[u]:
        reach[u].add(v); reach[u]|=reach[v]
cnt={i:len(reach[i]) for i in ids}; mx=max(cnt.values()) or 1
for t in topics: t['centrality']=round(cnt[t['id']]/mx,4)

json.dump({'version':'v0.5-perf-deepened','topicCount':len(topics),'topics':topics},
          open(f'{DATA}/topics.json','w'),ensure_ascii=False,indent=1)
json.dump({'version':'v0.5-perf-deepened','note':'topicId 依賴 prerequisiteId。國小十領域＋選修語文（框架級）。',
           'edgeCount':len(deps),'dependencies':deps},
          open(f'{DATA}/dependencies.json','w'),ensure_ascii=False,indent=1)
byid={t['id']:t for t in topics}
cross=sum(1 for e in deps if byid[e['topicId']]['subject']!=byid[e['prerequisiteId']]['subject'])
print(f"✓ topics={len(topics)} edges={len(deps)} hard={sum(1 for d in deps if d['strength']=='hard')} soft={sum(1 for d in deps if d['strength']=='soft')} 跨領域={cross}")
print('  科目:', dict(Counter(t['subject'] for t in topics)))
