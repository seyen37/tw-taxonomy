# tw-taxonomy — 台灣國小學習知識圖譜

以十二年國民基本教育課程綱要（108 課綱）為本的**台灣國民小學學習知識圖譜**：把各領域「學習重點」拆解為細粒度「微主題（micro-topic）」，以先修關係串成有向無環圖（DAG），並對應回課綱的學習內容與學習表現代碼。老師可以直接用「教師工作台」備課、診斷、排課；開發者可以拿資料建立個人化 AI 教育工具。

> **微主題：** 569｜**先修關係：** 717｜**領域：** 15（九大領域＋生活課程＋六選修語文）｜方法論啟發自 [Marble Skill Taxonomy](https://github.com/withmarbleapp/os-taxonomy)（內容全新建置，非其衍生資料庫）

📘 **第一次使用？** 請看 [使用手冊.md](使用手冊.md)。

## 教師工作台（不用安裝）

下載專案後，用瀏覽器雙擊打開 **`app/index.html`** 即可，離線也能用。啟用 GitHub Pages 後也能直接用網址開啟。

| 分頁 | 做什麼 |
|---|---|
| 🔍 查詢 | 依關鍵字、課綱代碼、領域、年級找微主題；看精熟證據、檢核提示、三級分級任務、課綱原文、先修與後續 |
| 🧭 學習路徑 | 選一個概念，依年級列出學會它之前要鋪好的整條路 |
| 🩺 診斷補救 | 從孩子卡關的概念逐題往回檢核，找出補救起點與補救順序 |
| 📋 教學設計表 | 選領域與年級，依先修順序產生逐課教學設計表，可列印或下載 |
| 🕸 知識圖 | 互動式全貌圖，點概念高亮整條先修鏈 |

網頁不蒐集、不上傳任何資料；學生姓名只用來代入檢核題目，存在自己的瀏覽器。

## 專案結構

```
app/            教師工作台（靜態網頁；data.js 由 data/ 自動產生）
lib/            核心函式庫 taxonomy.js（網頁與指令共用：查詢、路徑、診斷、排課）
data/           資料本體（JSON）＋ manifest 校驗和
schema/         JSON Schema
lesson-plans/   各領域逐課教學設計表（自動產生）
scripts/        驗證、產生器、打包工具；建置歷程腳本（封存）
tests/          單元測試
docs/
  guides/       教師使用手冊、家長摘要導覽
  research/     參考分析（os-taxonomy、韓國 AI 個人化教育指南、表現碼深化）
  build-log/    建置計畫、各階段驗收、專案紀錄與決策原則
```

## 資料檔

所有資料在 [`data/`](data/)，UTF-8 JSON；[`schema/`](schema/) 附 JSON Schema；`data/manifest.json` 含計數與 SHA-256 校驗和。

| 檔案 | 內容 |
|---|---|
| `data/topics.json` | 微主題（圖的**節點**） |
| `data/dependencies.json` | 先修關係（**邊**：`topicId` 依賴 `prerequisiteId`） |
| `data/curriculum-standards.json` | 108 課綱各領域學習重點原文（學習內容＋學習表現，僅國小階段） |
| `data/clusters.json` | 家長友善的領域摘要 |
| `data/manifest.json` | 計數、校驗和 |

各科節點數：數學 174、國語文 105、自然科學 74、健康與體育 72、英語文 29、社會 26、生活課程 24、藝術 24、綜合活動 23、選修語文（閩南／客／原住民族／閩東／新住民／臺灣手語）各 3。九大領域＋生活課程的課綱學習內容與學習表現代碼覆蓋近 100%；選修語文為語系中立的框架級進程。

### 微主題欄位

- `id`：穩定識別碼（`twt_…`）
- `type`：CONCEPTUAL／PROCEDURAL／REPRESENTATIONAL／LANGUAGE／META
- `subject`／`domain`：領域／主題群
- `stage`：學習階段（1＝一二年級、2＝三四年級、3＝五六年級）；`gradeStart`/`gradeEnd`：年級
- `centrality`：中心性，越高代表解鎖越多後續概念
- `evidence[]`：精熟證據判準（可觀察行為）
- `assessmentPrompt`：檢核提示，含 `{{name}}` 占位符
- `differentiatedTasks`：三級分級任務 `{advanced, basic, foundational}`，全 569 節點皆有
- `contentCodes[]`／`performanceCodes[]`：對應課綱學習內容（如 `math:N-1-1`）與學習表現（如 `math:n-I-1`）

## 指令工具（Node.js 18 以上，零依賴）

```bash
node scripts/validate.mjs                                     # 驗證資料＋衍生產物同步
node --test tests/*.test.mjs                                  # 單元測試
node scripts/gen-lesson-plan.mjs --subject 數學 --grade 3      # 產生教學設計表
node scripts/gen-lesson-plan.mjs --subject 國語文 --stage 1 --out plan.md
```

修改 `data/` 後執行 `node scripts/build-app-data.mjs` 與 `node scripts/build-lesson-plans.mjs` 重新產生衍生產物。詳見 [`scripts/README.md`](scripts/README.md)。

### 在程式裡使用

`lib/taxonomy.js` 可在 Node 與瀏覽器使用：

```js
const TWT = require('./lib/taxonomy.js');
const idx = TWT.createIndex({ topics, dependencies });   // 讀入 data/ 的 JSON
TWT.ancestors(idx, topicId);                             // 全部上游先修（依學習順序）
TWT.diagnose(idx, topicId, { [topicId]: false });        // 診斷流程：下一題、補救起點、補救順序
TWT.lessonPlan(idx, { subject: '數學', grade: 3 });      // 逐課教學設計表（結構化）
```

## 三種教學模型的資料支援

借鏡韓國 AI 個人化教育指南：

- **預習型（翻轉）**：課前用先修鏈指出該複習的概念，課中做高階活動。
- **複習型**：課後用 `assessmentPrompt` 診斷，沿先修鏈往上游找弱點回補（教師工作台的「診斷補救」）。
- **補救型**：對落後學生，優先鞏固 `centrality` 高的地基概念。

## 授權

- **資料庫與本專案自撰文字**（微主題、先修關係、摘要）：CC BY 4.0。
- **課綱條文**（`curriculum-standards.json` 的 `text`）：© 教育部／國家教育研究院，依政府資訊公開與各來源開放條款收錄，詳見 [PROVENANCE.md](PROVENANCE.md)。
- **D3.js**（`app/vendor/d3.min.js`）：ISC 授權，見 `app/vendor/d3.LICENSE.txt`。

## 引用

> tw-taxonomy (v1)，依 CC BY 4.0 授權。課綱條文出自教育部十二年國民基本教育課程綱要。
