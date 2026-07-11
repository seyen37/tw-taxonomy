# tw-taxonomy — 台灣國小學習知識圖譜

以十二年國民基本教育課程綱要（108 課綱）為本的**台灣國民小學學習知識圖譜**：把各領域「學習重點」拆解為細粒度「微主題（micro-topic）」，以先修關係串成有向無環圖（DAG），並對應回課綱的學習內容與學習表現代碼，供開發者建立個人化 AI 教育工具與兒童學習應用。

> **版本：** v1.0.0｜**微主題：** 569｜**先修關係：** 717｜**領域：** 15（九大領域＋生活課程＋六選修語文）｜方法論啟發自 [Marble Skill Taxonomy](https://github.com/withmarbleapp/os-taxonomy)（內容全新建置，非其衍生資料庫）

各科節點數：數學 174、國語文 105、自然科學 74、健康與體育 72、英語文 29、社會 26、生活課程 24、藝術 24、綜合活動 23、選修語文（閩南／客／原住民族／閩東／新住民／臺灣手語）各 3。九大領域＋生活課程的課綱學習內容與學習表現代碼覆蓋近 100%（自然、健體、藝術的表現碼已於 v0.5 補齊表現導向節點達 100%）；選修語文為語系中立的框架級進程。

## 資料檔

所有資料在 [`data/`](data/)，UTF-8 JSON；[`schema/`](schema/) 附 JSON Schema；`data/manifest.json` 含計數與 SHA-256 校驗和。

| 檔案 | 內容 |
|---|---|
| `data/topics.json` | 微主題（圖的**節點**） |
| `data/dependencies.json` | 先修關係（**邊**：`topicId` 依賴 `prerequisiteId`） |
| `data/curriculum-standards.json` | 108 課綱各領域學習重點原文（學習內容＋學習表現，僅國小階段） |
| `data/clusters.json` | 家長友善的領域摘要 |
| `data/manifest.json` | 計數、校驗和 |

### 微主題欄位

- `id` — 穩定識別碼（`twt_…`）
- `type` — CONCEPTUAL／PROCEDURAL／REPRESENTATIONAL／LANGUAGE／META
- `subject`／`domain` — 領域／主題群
- `stage` — 學習階段（1＝一二年級、2＝三四年級、3＝五六年級）；`gradeStart`/`gradeEnd` — 年級
- `evidence[]` — 精熟證據判準（可觀察行為）
- `assessmentPrompt` — 給家長的檢核提示，含 `{{name}}` 占位符
- `differentiatedTasks` — 差異化教學的三級任務 `{advanced, basic, foundational}`（進階／基本／基礎），支援分級教學。**全 569 節點 100% 建置完成**（15 領域）。
- `contentCodes[]`／`performanceCodes[]` — 對應課綱學習內容（如 `math:N-1-1`）與學習表現（如 `math:n-Ⅰ-1`）

### 驗證

```bash
node scripts/validate.mjs
```

## 應用工具

### 逐課教學設計表生成器

`scripts/gen_lesson_plan.py` 用先修關係自動把某領域的微主題排成教學序列，逐節產出「學習內容、對應課綱碼、建議教學法、先備概念、形成性評量、達成指標」。

```bash
python3 scripts/gen_lesson_plan.py --subject 數學 --grade 3          # 依年級
python3 scripts/gen_lesson_plan.py --subject 國語文 --stage 1 --out plan.md   # 依學習階段、輸出檔案
```

`lesson-plans/` 附各領域範例輸出。

### 三種教學模型的資料支援

本資料集可支援個人化教學的三種常見流程（借鏡韓國 AI 個人化教育指南）：

- **預習型（翻轉）**：課前用某節的先修鏈（`dependencies.json` 上游）指出「該複習哪些概念」，課中做高階活動。
- **複習型**：課後用 `assessmentPrompt` 診斷，沿先修鏈上游找弱點回補。
- **補救型**：對落後學生，優先鞏固 `centrality`（中心性）高的地基概念。

## 授權

- **資料庫與本專案自撰文字**（微主題、先修關係、摘要）：CC BY 4.0。
- **課綱條文**（`curriculum-standards.json` 的 `text`）：© 教育部／國家教育研究院，依政府資訊公開與各來源開放條款收錄，詳見 [PROVENANCE.md](PROVENANCE.md)。

## 引用

> tw-taxonomy (v1)，依 CC BY 4.0 授權。課綱條文出自教育部十二年國民基本教育課程綱要。
