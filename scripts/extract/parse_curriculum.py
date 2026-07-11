#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""parse_curriculum.py — 從 108 課綱領綱 PDF 抽取國小階段「學習重點」條目。
用法：python3 parse_curriculum.py <subject-slug> [...]
輸出：/tmp/extracted/<slug>.json。表格模式優先，無格線版面自動用逐行備援。
代碼羅馬數字正規化為 ASCII（Ⅰ→I）。"""
import json, os, re, subprocess, sys, unicodedata

SRC = '/sessions/tender-busy-hamilton/mnt/taxonomy/sources/curriculum-pdf'
OUT = '/tmp/extracted'
ROMAN = {'Ⅰ':1,'Ⅱ':2,'Ⅲ':3,'Ⅳ':4,'Ⅴ':5,'I':1,'II':2,'III':3,'IV':4,'V':5}
ST = r'(?:Ⅰ|Ⅱ|Ⅲ|Ⅳ|Ⅴ|IV|V|I{1,3})'

SUBJECTS = {
 'math': {'name':'數學','file':'十二年國民基本教育課程綱要國民中小學暨普通型高級中等學校-數學領域.pdf',
  'perf_code':rf'^([nsgrafd])-({ST})-(\d+)$','cont_code':r'^([NSGRAFD])-(\d{1,2})-(\d+)\*?$','cont_grade':True,
  'cat':{'n':'數與量','s':'空間與形狀','g':'坐標幾何','r':'關係','a':'代數','f':'函數','d':'資料與不確定性',
         'N':'數與量','S':'空間與形狀','G':'坐標幾何','R':'關係','A':'代數','F':'函數','D':'資料與不確定性'}},
 'mandarin': {'name':'國語文','file':'十二年國民基本教育課程綱要國民中小學暨普通型高級中等學校(語文領域─國語文).pdf',
  'perf_code':rf'^([1-6])-({ST})-(\d+)$','cont_code':rf'^([A-C][a-e])-({ST})-(\d+)$',
  'cat':{'1':'聆聽','2':'口語表達','3':'標音符號與運用','4':'識字與寫字','5':'閱讀','6':'寫作',
         'Aa':'文字篇章-標音符號','Ab':'文字篇章-字詞','Ac':'文字篇章-句段','Ad':'文字篇章-篇章',
         'Ba':'文本表述-記敘','Bb':'文本表述-抒情','Bc':'文本表述-說明','Bd':'文本表述-議論','Be':'文本表述-應用',
         'Ca':'文化內涵-物質文化','Cb':'文化內涵-社群文化','Cc':'文化內涵-精神文化'}},
 'english': {'name':'英語文','file':'(發布版)國民中小學暨普通型高級中等學校-語文領域-英語文課程綱要.pdf',
  'perf_code':rf'^([1-9])-({ST})-(\d+)$','cont_code':rf'^([A-D][a-f]?)-({ST})-(\d+)$',
  'cat':{'1':'語言能力-聽','2':'語言能力-說','3':'語言能力-讀','4':'語言能力-寫','5':'語言能力-聽說讀寫綜合',
         '6':'學習興趣與態度','7':'學習方法與策略','8':'文化理解','9':'邏輯思考判斷與創造力',
         'Aa':'語言知識-字母','Ab':'語言知識-語音','Ac':'語言知識-字詞','Ad':'語言知識-句構','Ae':'語言知識-篇章','Af':'語言知識-語用',
         'B':'溝通功能','C':'文化與習俗','D':'思考能力'}},
 'science': {'name':'自然科學','file':'十二年國民基本教育課程綱要國民中小學暨普通型高級中等校-自然科學領域.pdf',
  'perf_code':rf'^([a-z]{{2}})-({ST})-(\d+)$','cont_code':rf'^(IN[a-g])-({ST})-(\d+)$',
  'cat':{'po':'探究能力-觀察與定題','pe':'探究能力-計劃與執行','pa':'探究能力-分析與發現','pc':'探究能力-討論與傳達',
         'ai':'態度-培養科學探究的興趣','ah':'態度-養成應用科學思考與探究的習慣','an':'態度-認識科學本質',
         'ti':'思考智能-想像創造','tr':'思考智能-推理論證','tc':'思考智能-批判思辨','tm':'思考智能-建立模型',
         'INa':'物質與能量','INb':'構造與功能','INc':'系統與尺度','INd':'改變與穩定','INe':'交互作用','INf':'科學與生活','INg':'資源與永續性'}},
 'social': {'name':'社會','file':'十二年國民基本教育課程綱要國民中小學暨普通型高級中等校-社會領域.pdf',
  'perf_code':rf'^([1-3][a-d])-({ST})-(\d+)$','cont_code':rf'^([A-F][a-f])-({ST})-(\d+)$',
  'cat':{'1a':'理解及思辨-覺察說明','1b':'理解及思辨-分析詮釋','1c':'理解及思辨-判斷創新',
         '2a':'態度及價值-敏覺關懷','2b':'態度及價值-同理尊重','2c':'態度及價值-自省珍視',
         '3a':'實作及參與-問題發現','3b':'實作及參與-資料蒐整與應用','3c':'實作及參與-溝通合作','3d':'實作及參與-規劃執行',
         'Aa':'互動與關聯-個人與群體','Ab':'互動與關聯-人與環境','Ac':'互動與關聯-權力規則與人權','Ad':'互動與關聯-生產與消費','Ae':'互動與關聯-科技與社會','Af':'互動與關聯-全球關連',
         'Ba':'差異與多元-個體差異','Bb':'差異與多元-環境差異','Bc':'差異與多元-社會與文化的差異',
         'Ca':'變遷與因果-環境的變遷','Cb':'變遷與因果-歷史的變遷','Cc':'變遷與因果-社會的變遷',
         'Da':'選擇與責任-價值的選擇','Db':'選擇與責任-經濟的選擇','Dc':'選擇與責任-參與公共事務的選擇'}},
 'integrative': {'name':'綜合活動','file':'十二年國民基本教育課程綱要國民中小學暨普通型高級中等校-綜合活動領域.pdf',
  'perf_code':rf'^([1-3][a-d])-({ST})-(\d+)$','cont_code':rf'^([A-C][a-d])-({ST})-(\d+)$',
  'cat':{'1a':'自我與生涯發展-自我探索與成長','1b':'自我與生涯發展-自主學習與管理','1c':'自我與生涯發展-生涯規劃與發展','1d':'自我與生涯發展-尊重與珍惜生命',
         '2a':'生活經營與創新-人際互動與經營','2b':'生活經營與創新-團體合作與領導','2c':'生活經營與創新-資源運用與開發','2d':'生活經營與創新-生活美感與創新',
         '3a':'社會與環境關懷-危機辨識與處理','3b':'社會與環境關懷-社會關懷與服務','3c':'社會與環境關懷-文化理解與尊重','3d':'社會與環境關懷-環境保育與永續',
         'Aa':'自我與生涯發展','Ab':'自我與生涯發展','Ac':'自我與生涯發展','Ad':'自我與生涯發展',
         'Ba':'生活經營與創新','Bb':'生活經營與創新','Bc':'生活經營與創新','Bd':'生活經營與創新',
         'Ca':'社會與環境關懷','Cb':'社會與環境關懷','Cc':'社會與環境關懷','Cd':'社會與環境關懷'}},
 'health-pe': {'name':'健康與體育','file':'十二年國民基本教育課程綱要國民中小學暨普通型高級中等學校-健康與體育領域.pdf',
  'perf_code':rf'^([1-4][a-d])-({ST})-(\d+)$','cont_code':rf'^([A-I][a-d])-({ST})-(\d+)$',
  'cat':{'1a':'認知-健康知識','1b':'認知-技能概念','1c':'認知-運動知識','1d':'認知-策略概念',
         '2a':'情意-健康態度','2b':'情意-體育態度','2c':'情意-自我價值','2d':'情意-運動欣賞',
         '3a':'技能-健康技能','3b':'技能-生活技能','3c':'技能-技術操作','3d':'技能-策略運用',
         '4a':'行為-自我管理','4b':'4b','4c':'4c','4d':'4d'}},
 'arts': {'name':'藝術','file':'十二年國民基本教育課程綱要國民中小學暨普通型高級中等校-藝術領域.pdf',
  'perf_code':rf'^([1-3])-({ST})-(\d+)$','cont_code':rf'^([音視表][EAP])-({ST})-(\d+)$',
  'cat':{'1':'表現','2':'鑑賞','3':'實踐','音E':'音樂-表現','音A':'音樂-鑑賞','音P':'音樂-實踐',
         '視E':'視覺藝術-表現','視A':'視覺藝術-鑑賞','視P':'視覺藝術-實踐',
         '表E':'表演藝術-表現','表A':'表演藝術-鑑賞','表P':'表演藝術-實踐'}},
 'life': {'name':'生活課程','file':'(發布版)生活課程課程綱要.pdf',
  'perf_code':rf'^([1-7])-({ST})-(\d+)$','cont_code':rf'^([A-F])-({ST})-(\d+)$',
  'cat':{'1':'悅納自己','2':'探究事理','3':'樂於學習','4':'表達想法與創新實踐','5':'美的感知與欣賞','6':'表現合宜的行為與態度','7':'與人合作',
         'A':'事物變化及生命成長現象的觀察與省思','B':'環境之美的探索與愛護','C':'生活事物特性的探究與創新應用',
         'D':'人際關係的建立與溝通合作','E':'生活規範的實踐與省思','F':'自主學習策略的練習與覺察'}},
 'taigi': {'name':'本土語文（閩南語文）','file':'十二年國民基本教育課程綱要語文領域-本土語文(閩南語文)-發布版.pdf','elective':True,
  'perf_code':rf'^([1-6])-({ST})-(\d+)$','cont_code':rf'^([A-C][a-e]?)-({ST})-(\d+)$',
  'cat':{'1':'聆聽','2':'說話','3':'標音符號與運用','4':'閱讀','5':'寫作','6':'綜合應用'}},
 'hakka': {'name':'本土語文（客語文）','file':'十二年國民基本教育課程綱要語文領域-本土語文(客語文)-發布版.pdf','elective':True,
  'perf_code':rf'^([1-6])-({ST})-(\d+)$','cont_code':rf'^([A-C][a-e]?)-({ST})-(\d+)$',
  'cat':{'1':'聆聽','2':'說話','3':'標音符號與運用','4':'閱讀','5':'寫作','6':'綜合應用'}},
 'indigenous': {'name':'本土語文（原住民族語文）','file':'十二年國民基本教育課程綱要語文領域-本土語文(原住民族語文)-發布版.pdf','elective':True,
  'perf_code':rf'^([1-6])-({ST})-(\d+)$','cont_code':rf'^([A-F][a-e]?)-({ST})-(\d+)$',
  'cat':{'1':'聆聽','2':'說話','3':'音標系統與應用','4':'閱讀','5':'書寫','6':'綜合應用'}},
 'matsu': {'name':'本土語文（閩東語文）','file':'(111學年度實施)十二年國民基本教育課程綱要語文領域-本土語文(閩東語文)-發布版.pdf','elective':True,
  'perf_code':rf'^([1-6])-({ST})-(\d+)$','cont_code':rf'^([A-C][a-e]?)-({ST})-(\d+)$',
  'cat':{'1':'聆聽','2':'說話','3':'標音符號與運用','4':'閱讀','5':'寫作','6':'綜合應用'}},
 'sea-lang': {'name':'新住民語文','file':'十二年國民基本教育課程綱要國民中小學語文領域-新住民語文.pdf','elective':True,
  'perf_code':rf'^([1-6])-({ST})-(\d+)$','cont_code':rf'^([A-C][a-e]?)-({ST})-(\d+)$',
  'cat':{'1':'聆聽','2':'說話','3':'閱讀','4':'書寫','5':'5','6':'6'}},
 'tsl': {'name':'臺灣手語','file':'十二年國民基本教育課程綱要語文領域-臺灣手語-發布版.pdf','elective':True,
  'perf_code':rf'^([1-6])-({ST})-(\d+)$','cont_code':rf'^([A-C][a-e]?)-({ST})-(\d+)$',
  'cat':{'1':'接收理解','2':'表達溝通','3':'合宜使用','4':'4','5':'5','6':'6'}},
}

def norm(s):
    if not s: return ''
    s = unicodedata.normalize('NFKC', s)
    return s.replace('\n','').replace(' ','').strip()

def candidate_pages(pdf_path):
    txt = subprocess.run(['pdftotext', pdf_path, '-'], capture_output=True, text=True).stdout
    return [i for i,p in enumerate(txt.split('\f')) if '編碼' in p]

def stage_of(tok):
    return ROMAN.get(tok.strip())

def _classify(cfg, kind, m):
    """回傳 (stage, grade) 或 None（超出國小）。"""
    cat, stg = m.group(1), m.group(2)
    if cfg.get('cont_grade') and kind == 'content':
        g = int(stg)
        if g > 6: return None
        return ((g+1)//2, g)
    st = stage_of(stg)
    if st is None or st > 3: return None
    return (st, None)

def parse_tables(cfg, path, perf_re, cont_re):
    import pdfplumber
    entries, seen = [], set()
    pdf = pdfplumber.open(path)
    for pi in candidate_pages(path):
        for tbl in pdf.pages[pi].extract_tables():
            if not tbl or not tbl[0]: continue
            header = ''.join(norm(c) for c in tbl[0])
            is_perf = '學習表現' in header and '對應' not in header
            is_cont = '學習內容' in header
            rows = tbl[1:]
            if not (is_perf or is_cont):
                first = norm(tbl[0][0]) if tbl[0][0] else ''
                if perf_re.match(first): is_perf, rows = True, tbl
                elif cont_re.match(first): is_cont, rows = True, tbl
                else: continue
            kind = 'performance' if is_perf else 'content'
            code_re = perf_re if is_perf else cont_re
            for row in rows:
                cells = [norm(c) for c in row]
                if not any(cells): continue
                code = cells[0].rstrip('*')
                m = code_re.match(code)
                if m:
                    sg = _classify(cfg, kind, m)
                    if sg is None: continue
                    if code in seen: continue
                    seen.add(code)
                    text = cells[1] if len(cells) > 1 else ''
                    note = cells[2] if kind=='content' and len(cells)>4 and cells[2] else None
                    if note: text = f'{text}（備註：{note}）'
                    entries.append({'kind':kind,'code':code,'text':text,
                                    'category':cfg['cat'].get(m.group(1), m.group(1)),
                                    'stage':sg[0],'grade':sg[1]})
                elif entries and cells[0]=='' and len(cells)>1 and cells[1]:
                    prev = entries[-1]
                    if prev['text'].endswith('）') and '備註' in prev['text']:
                        prev['text'] = prev['text'][:-1] + cells[1] + '）'
                    else:
                        prev['text'] += cells[1]
    return entries

def parse_lines(cfg, path, perf_re, cont_re):
    txt = subprocess.run(['pdftotext','-layout',path,'-'], capture_output=True, text=True).stdout
    entries, seen = [], set()
    stage_prefix = re.compile(r'^第[一二三四五]學習階段')
    for raw in txt.split('\n'):
        if not raw.strip(): continue
        indent = len(raw) - len(raw.lstrip())
        line = unicodedata.normalize('NFKC', raw.strip())
        line = stage_prefix.sub('', line).strip()
        if not line or line in ('◎','*','◎*','*◎'): continue
        if re.fullmatch(r'\d+', line): continue
        line = line.lstrip('◎* ')
        m = re.match(r'^(\S+)\s+(.+)$', line)
        code, rest = (m.group(1), m.group(2)) if m else (line, '')
        pm, cm = perf_re.match(code), cont_re.match(code)
        mm = pm or cm
        if mm and rest:
            kind = 'performance' if pm else 'content'
            sg = _classify(cfg, kind, mm)
            if sg is None: continue
            if code in seen: continue
            seen.add(code)
            entries.append({'kind':kind,'code':code,'text':rest.replace(' ',''),
                            'category':cfg['cat'].get(mm.group(1), mm.group(1)),
                            'stage':sg[0],'grade':sg[1]})
        elif entries and indent >= 6 and re.search(r'[一-鿿]', line) \
                and '學習表現' not in line and '學習內容' not in line and '學習階段' not in line:
            entries[-1]['text'] += line.replace(' ','')
    return entries

def parse(slug):
    cfg = SUBJECTS[slug]
    path = os.path.join(SRC, cfg['file'])
    perf_re, cont_re = re.compile(cfg['perf_code']), re.compile(cfg['cont_code'])
    entries = parse_tables(cfg, path, perf_re, cont_re)
    mode = 'tables'
    if not entries:
        entries = parse_lines(cfg, path, perf_re, cont_re)
        mode = 'lines'
    from collections import defaultdict
    warns = []
    seq = defaultdict(list)
    for e in entries:
        m = re.match(r'^(.+)-(\d+)$', e['code'])
        seq[m.group(1)].append(int(m.group(2)))
    for k,v in sorted(seq.items()):
        if sorted(v) != list(range(1, len(v)+1)):
            warns.append(f'流水號不連續 {k}: {sorted(v)}')
    short = [e['code'] for e in entries if len(e['text']) < 4]
    if short: warns.append(f'條文過短: {short}')
    os.makedirs(OUT, exist_ok=True)
    result = {'slug':slug,'name':cfg['name'],'elective':cfg.get('elective',False),
              'file':cfg['file'],'mode':mode,'entries':entries,'warnings':warns,
              'counts':{'total':len(entries),
                        'performance':sum(1 for e in entries if e['kind']=='performance'),
                        'content':sum(1 for e in entries if e['kind']=='content')}}
    with open(os.path.join(OUT, f'{slug}.json'), 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=1)
    print(f"{slug}[{mode}]: perf={result['counts']['performance']} cont={result['counts']['content']} warns={len(warns)}", flush=True)
    for w in warns[:8]:
        print('  !', w, flush=True)

if __name__ == '__main__':
    for s in sys.argv[1:]:
        parse(s)
