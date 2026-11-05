# scripts/

## 日常使用（Node.js 18 以上，零依賴）

| 指令 | 用途 |
|---|---|
| `node scripts/validate.mjs` | 驗證資料完整性，並檢查 `app/data.js`、`lesson-plans/` 是否與 `data/` 同步 |
| `node --test tests/*.test.mjs` | 核心函式庫單元測試 |
| `node scripts/gen-lesson-plan.mjs --subject 數學 --grade 3` | 產生單份逐課教學設計表（`--stage 1-3`、`--out 檔名` 可選） |
| `node scripts/build-app-data.mjs` | 由 `data/` 重新產生網頁資料 `app/data.js` |
| `node scripts/build-lesson-plans.mjs` | 由 `data/` 重新產生 `lesson-plans/` 全部檔案 |

改了 `data/` 之後，依序執行 `build-app-data.mjs`、`build-lesson-plans.mjs`，再跑 `validate.mjs`。

共用邏輯都在 `lib/taxonomy.js`，網頁（`app/`）與上面的指令共用同一份程式。`_data.mjs` 是 Node 端讀取 `data/` 的小工具。

## 建置歷程腳本（封存）

以下是 v1.0 建置資料時使用的 Python 腳本，保留作為方法紀錄：

| 資料夾 | 內容 |
|---|---|
| `extract/` | 課綱 PDF 解析器（雙模式：格線表優先＋座標感知備援） |
| `build-topics/` | 各領域微主題與先修關係的原始定義，以及組裝腳本 `build.py` |
| `differentiated/` | 三級分級任務的原始資料 |

> ⚠️ 這些腳本**目前不能直接重跑**：它們的中間檔放在當時環境的 `/tmp/`（如 `/tmp/topics/`、`/tmp/extracted/`），而且 `data/` 在建置後還有後續修訂。直接執行 `build.py` 可能覆蓋掉這些修訂。要修改資料，請直接編輯 `data/*.json`，見 `CONTRIBUTING.md`。
