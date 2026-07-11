# 貢獻指南

歡迎協助改進 tw-taxonomy。本專案是以 108 課綱為本的台灣國小學習知識圖譜，資料正確性與課綱對應是最高原則。

## 開始之前

- 資料在 `data/`（四個 UTF-8 JSON 檔），Schema 在 `schema/`。
- 任何資料改動都必須通過驗證：`node scripts/validate.mjs`（檢查 DAG 無環、階段一致性、參照完整性、SHA-256 校驗和、分級任務結構）。
- 描述性中文欄位（description、assessmentPrompt、differentiatedTasks）一律用**全形標點**（英語科的英文例句除外）。

## 常見貢獻類型

### 修正微主題內容
直接修改 `data/topics.json` 對應節點的 `description`／`evidence`／`assessmentPrompt`。改完務必重算 `manifest.json` 的校驗和並跑 validate。

### 新增／調整分級任務
分級任務資料在 `scripts/differentiated/`（依領域分檔）。修改對應資料檔後，用 `apply_diff_generic.py` **一次吃全部檔案**重新套用（否則會覆蓋），再 validate。

### 調整先修關係
修改 `data/dependencies.json`。注意：先修節點的學習階段必須 ≤ 後續節點（validate 會擋逆序），且不可造成環。

### 深化框架級內容
選修語文（本土語文、新住民語文、臺灣手語）目前為語系中立的框架級進程；自然／健體／藝術的微主題採整合粒度。歡迎提出更細緻的拆解，但請維持課綱代碼對應。

## 提交流程

1. Fork 並建立分支。
2. 修改後執行 `node scripts/validate.mjs`，確認 `✓ 驗證通過`。
3. 若改動影響衍生產物，重生逐課表（`gen_lesson_plan.py`）。
4. 送出 Pull Request，說明改了什麼、為什麼，並附驗證通過的截圖或輸出。

## 授權

貢獻內容視同以 CC BY 4.0 釋出。課綱條文部分請維持 PROVENANCE.md 的出處聲明。

## 設計原則

改動前建議先讀 `專案紀錄_工作日誌與決策原則.md` 的第三節（決策紀錄）與第四節（共通性原則），理解專案為何長成現在這樣。核心原則：驗證即閘門、以課綱代碼為錨、誠實分層、試點先行。
