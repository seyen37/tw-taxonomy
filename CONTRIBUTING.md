# 貢獻指南

歡迎協助改進 tw-taxonomy。本專案是以 108 課綱為本的台灣國小學習知識圖譜，資料正確性與課綱對應是最高原則。

## 開始之前

- 資料在 `data/`（四個 UTF-8 JSON 檔），Schema 在 `schema/`。
- 網頁與指令共用的邏輯在 `lib/taxonomy.js`，改了要跑 `node --test tests/*.test.mjs`。
- 任何資料改動都必須通過驗證：`node scripts/validate.mjs`（檢查 DAG 無環、階段一致性、參照完整性、SHA-256 校驗和、分級任務結構，以及 `app/data.js`、`lesson-plans/` 是否同步）。推送後 GitHub Actions 會自動再跑一次。
- 描述性中文欄位（description、assessmentPrompt、differentiatedTasks）一律用**全形標點**（英語科的英文例句除外）。

## 常見貢獻類型

### 修正微主題內容
直接修改 `data/topics.json` 對應節點的 `description`／`evidence`／`assessmentPrompt`。改完務必重算 `manifest.json` 的校驗和並跑 validate。

### 新增／調整分級任務
直接修改 `data/topics.json` 對應節點的 `differentiatedTasks`（進階／基本／基礎三個欄位都要有），重算校驗和後 validate。`scripts/differentiated/` 是建置時的原始資料，已封存，見 `scripts/README.md`。

### 調整先修關係
修改 `data/dependencies.json`。注意：先修節點的學習階段必須 ≤ 後續節點（validate 會擋逆序），且不可造成環。

### 深化框架級內容
選修語文（本土語文、新住民語文、臺灣手語）目前為語系中立的框架級進程；自然／健體／藝術的微主題採整合粒度。歡迎提出更細緻的拆解，但請維持課綱代碼對應。

## 提交流程

1. Fork 並建立分支。
2. 修改後執行 `node scripts/validate.mjs`，確認 `✓ 驗證通過`。
3. 重新產生衍生產物：`node scripts/build-app-data.mjs` 與 `node scripts/build-lesson-plans.mjs`（驗證會擋下忘記重生的情況）。
4. 送出 Pull Request，說明改了什麼、為什麼，並附驗證通過的截圖或輸出。

## 授權

貢獻內容視同以 CC BY 4.0 釋出。課綱條文部分請維持 PROVENANCE.md 的出處聲明。

## 設計原則

改動前建議先讀 `docs/build-log/專案紀錄_工作日誌與決策原則.md` 的第三節（決策紀錄）與第四節（共通性原則），理解專案為何長成現在這樣。核心原則：驗證即閘門、以課綱代碼為錨、誠實分層、試點先行。
