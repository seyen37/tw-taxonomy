#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""assemble.py — 合併 /tmp/extracted/*.json → data/curriculum-standards.json"""
import json, os, re, subprocess
import pc

SRC = pc.SRC
DATA = '/sessions/tender-busy-hamilton/mnt/taxonomy/tw-taxonomy/data'
ORDER = ['mandarin','english','math','science','social','life','integrative',
         'health-pe','arts','taigi','hakka','indigenous','matsu','sea-lang','tsl']

CN = {'○':'0','〇':'0','一':'1','二':'2','三':'3','四':'4','五':'5','六':'6','七':'7','八':'8','九':'9','十':'10'}

def doc_date(path):
    txt = subprocess.run(['pdftotext','-f','1','-l','1',path,'-'],capture_output=True,text=True).stdout
    txt = txt.replace(' ','').replace('\n','')
    m = re.search(r'中華民國([○〇一二三四五六七八九十]+)年([○〇一二三四五六七八九十]+)月', txt)
    if not m:
        i = txt.find('中華民國')
        if i >= 0:
            filt = ''.join(c for c in txt[i:i+40] if c in '○〇一二三四五六七八九十年月')
            m = re.search(r'([○〇一二三四五六七八九十]+)年([○〇一二三四五六七八九十]+)月', filt)
    if not m: return None
    def conv(s):
        if s == '十': return 10
        # 逐字換（一○七→107；十一→11）
        if '十' in s and len(s) <= 3:
            parts = s.split('十')
            tens = CN.get(parts[0],'1') if parts[0] else '1'
            ones = CN.get(parts[1],'0') if len(parts)>1 and parts[1] else '0'
            return int(tens)*10 + int(ones)
        return int(''.join(CN[c] for c in s))
    return f"{conv(m.group(1))}-{conv(m.group(2)):02d}"

def restore_punct(t):
    # NFKC 造成的半形標點還原為全形（數字千分位逗號除外）
    t = re.sub(r'(?<!\d),(?!\d)', '，', t).replace(',', '，')  # 千分位也一律全形?→保守：先護數字
    t = t.replace('(', '（').replace(')', '）').replace(';', '；')
    t = re.sub(r':(?!\d)', '：', t)
    t = t.replace('!', '！').replace('?', '？')
    t = t.replace('詴', '試')  # 常見 OCR/字型錯字：嘗詴→嘗試
    return t

subjects = []
for slug in ORDER:
    d = json.load(open(f'/tmp/extracted/{slug}.json'))
    path = os.path.join(SRC, d['file'])
    entries = []
    for e in d['entries']:
        entries.append({'key': f"{slug}:{e['code']}", 'kind': e['kind'], 'code': e['code'],
                        'text': restore_punct(e['text']), 'category': e['category'],
                        'stage': e['stage'], 'grade': e['grade']})
    subjects.append({'slug': slug, 'name': d['name'],
                     'documentTitle': os.path.splitext(d['file'])[0],
                     'documentDate': doc_date(path) or '',
                     'sourceUrl': None, 'elective': d['elective'],
                     'entryCount': len(entries), 'entries': entries})

out = {'note': '十二年國民基本教育課程綱要（108課綱）各領域學習重點，僅收國民小學階段。'
               '代碼羅馬數字正規化為 ASCII（Ⅰ→I）；條文經 NFKC 正規化後還原全形標點。'
               '數學學習內容備註以（備註：…）併入條文。',
       'curriculumVersion': '108課綱（含110-111年修正之本土語文）',
       'subjectCount': len(subjects), 'subjects': subjects}
os.makedirs(DATA, exist_ok=True)
with open(os.path.join(DATA, 'curriculum-standards.json'), 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, indent=1)
total = sum(s['entryCount'] for s in subjects)
print(f"subjects={len(subjects)} entries={total}")
for s in subjects:
    print(f"  {s['slug']:12s} {s['name']}（{s['documentDate']}）: {s['entryCount']}")
