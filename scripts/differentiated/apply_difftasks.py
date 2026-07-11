#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""apply_difftasks.py — 把分級任務併入 topics.json（依微主題名稱比對），重算 manifest。"""
import json, hashlib, re, sys
from collections import Counter
DATA='/sessions/tender-busy-hamilton/mnt/taxonomy/tw-taxonomy/data'
ns={}; exec(open('/tmp/difftasks_math_g1.py').read(), ns); DIFF=ns['DIFF']

t=json.load(open(f'{DATA}/topics.json'))
byname={x['name']:x for x in t['topics']}
errors=[]; applied=0
# 全形標點守門（描述性欄位不得含半形逗號問號等）
for name, d in DIFF.items():
    if name not in byname:
        errors.append(f'名稱不存在: {name}'); continue
    for lv in ('advanced','basic','foundational'):
        if re.search(r'[,?;!]', d[lv]): errors.append(f'{name}.{lv} 含半形標點')
    byname[name]['differentiatedTasks']={'advanced':d['advanced'],'basic':d['basic'],'foundational':d['foundational']}
    applied+=1
if errors:
    print('✗ 失敗:'); [print(' -',e) for e in errors]; sys.exit(1)

# 維持欄位順序：differentiatedTasks 放在 assessmentPrompt 之後、contentCodes 之前
def reorder(x):
    if 'differentiatedTasks' not in x: return x
    keys=['id','type','subject','domain','name','description','stage','gradeStart','gradeEnd',
          'centrality','elective','evidence','assessmentPrompt','differentiatedTasks','contentCodes','performanceCodes']
    return {k:x[k] for k in keys if k in x}
t['topics']=[reorder(x) for x in t['topics']]

json.dump(t, open(f'{DATA}/topics.json','w'), ensure_ascii=False, indent=1)

# manifest 重算
mani=json.load(open(f'{DATA}/manifest.json'))
for f in ['topics.json','dependencies.json','curriculum-standards.json','clusters.json']:
    b=open(f'{DATA}/{f}','rb').read()
    mani['files'][f]={'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
cov=sum(1 for x in t['topics'] if x.get('differentiatedTasks'))
mani['counts']['topicsWithDifferentiatedTasks']=cov
json.dump(mani, open(f'{DATA}/manifest.json','w'), ensure_ascii=False, indent=1)
print(f'✓ 套用 {applied} 筆分級任務；全圖已具分級任務節點: {cov}')
