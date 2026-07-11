# tw-taxonomy 建置計畫書（v0.1 草案，待 sign-off）

台灣國小學習知識圖譜——以 108 課綱為本、全新重建（路線 B），開源資料集＋自家產品雙軌使用。

## 1. 目標與非目標

**目標**：把 108 課綱國小階段各領域「學習重點」拆解為微主題 DAG，交付與 os-taxonomy 同級的四檔 JSON 資料集（topics / dependencies / curriculum-standards / clusters）＋ Schema ＋ 驗證器，全部繁體中文（台灣用語）。

**非目標（v1 不做）**：國中以上、教材教案內容、題庫、embeddings、任何學生個資。

## 2. 授權決策（建議，待確認）

全新資料庫，不構成 os-taxonomy 衍生著作，授權自主。建議比照原專案精神但更簡化：

- 資料庫＋自撰文字：**CC BY 4.0**（比 ODbL/BY-SA 更利於社群採用；產品層不受限）。若你想強制回饋改良，再改 ODbL + CC BY-SA。
- 課綱原文：教育部／國教院文本，收錄時標注來源；動工前查證 CIRN 資料開放宣告條款（預期可用，政府資訊）。
- 對 Marble 不負授權義務，但 README 註明「方法論啟發自 Marble Skill Taxonomy」以示風度。

## 3. 資料模型（相對 os-taxonomy 的調整）

| 項目 | os-taxonomy | tw-taxonomy |
|---|---|---|
| 節點 ID | `mt_xxx` | `twt_xxx`（nanoid，穩定不變） |
| 年段 | `ageRangeStart/End`（歲） | `stage`（1/2/3 學習階段）＋`gradeStart/End`（1-6 年級） |
| 課綱對應 | `standards[]` 單一陣列 | 拆成 `contentCodes[]`（學習內容，如 `N-1-1`）＋`performanceCodes[]`（學習表現，如 `n-I-1`） |
| 課綱原文 | 部分 codes-only | 全文收錄（政府文本，無上游封鎖） |
| type | 5 類 | 沿用 5 類（CONCEPTUAL/PROCEDURAL/REPRESENTATIONAL/LANGUAGE/META） |
| 邊 | hard/soft + reason | 沿用 |
| clusters | 學科×領域×年齡帶 | 領域×主題軸×學習階段，家長語境繁中摘要 |

`name/description/evidence/assessmentPrompt` 全數沿用概念，以台灣教學語彙撰寫；`assessmentPrompt` 保留 `{{name}}` 占位符。

## 4. 領域範圍與節點數預估

| 領域 | 素材（領綱） | 預估節點 | 備註 |
|---|---|---|---|
| 數學 | 數學領綱 N/S/R/A/D | ~450 | 可參考原圖拆解粒度（僅方法論，不搬內容） |
| 國語文 | 國語文領綱 | ~350 | 注音、識字寫字、閱讀、寫作、聆聽口說——全新設計 |
| 英語文 | 英語文領綱（國小 3 年級起） | ~150 | 外語路徑，非母語 phonics |
| 自然科學 | 自然領綱（3 年級起） | ~250 | |
| 社會 | 社會領綱（3 年級起） | ~180 | 歷史／地理／公民，台灣本位 |
| 綜合活動 | 綜合領綱 | ~80 | |
| 健康與體育 | 健體領綱 | ~100 | |
| 藝術 | 藝術領綱 | ~80 | |
| 科技＋資訊素養 | 科技議題／資訊教育 | ~50 | 國小為融入式課程 |
| 生活課程 | 生活領綱（1-2 年級） | ~60 | 台灣特有，整合社會／自然／藝術低年段 |
| **合計** | | **~1,750** | 邊預估 ~3,500 |

## 5. 建置流水線（每領域皆同）

1. **素材取得**：從 CIRN／國教院下載領綱 PDF，解析出學習內容＋學習表現條目（代碼、條文、階段）→ 結構化存入 `curriculum-standards.json`。
2. **AI 拆解**：以領綱條目為輸入，拆出微主題草稿（name/description/type/stage/evidence/assessmentPrompt/課綱對應）。
3. **AI 連線**：對草稿節點生成先修邊（hard/soft + reason），含跨領域邊。
4. **機器驗證**：validate 腳本——Schema、參照完整性、DAG 無環、階段一致性（先修節點階段 ≤ 後續節點）、全形標點檢查。
5. **人工審校**：每領域抽樣＋高中心性節點全審（你或領域教師）。此為品質閘門，AI 產出未經審校不標 stable。

## 6. 執行階段（可勾稽檢查點）

- [ ] **Phase 0 — 骨架**：repo 結構、4 個 JSON Schema、validate.mjs、README/LICENSE/PROVENANCE 草稿。（半天級）
- [ ] **Phase 1 — 課綱資料層**：取得並結構化全部領綱的學習內容／學習表現 → `curriculum-standards.json` 完成。**檢查點：條目數與領綱原文抽核一致。**
- [ ] **Phase 2 — 試點（數學）**:全流水線跑通數學一個領域 → 驗證拆解粒度與品質標準。**檢查點：你審核 50 個抽樣節點滿意才繼續。**
- [ ] **Phase 3 — 第一波**：國語文、自然、英語文。
- [ ] **Phase 4 — 第二波**:社會、綜合、健體、藝術、科技、生活課程。
- [ ] **Phase 5 — 整合**：跨領域邊、clusters 摘要、centrality 計算、manifest、全量驗證。
- [ ] **Phase 6 — 發布**：GitHub repo 整備（CITATION、貢獻指南、視覺化 demo 可後補）。

每個 Phase 結束回報進度＋驗證證據，出問題即停下重新規劃。

## 7. 決議紀錄

- 2026-07-11：路線 B（全新重建）、全領域、開源＋產品雙軌。（用戶 sign-off）
- 2026-07-11：本土語文／新住民語文採**框架級納入**——每語文建一套語系中立的能力進程微主題，不逐族／逐國拆；v2 再深化。（用戶 sign-off）
- 2026-07-11：素材除領綱外，另納入**各領域課程手冊**（國教院）作為微主題拆解的輔助素材（更細的學習內容說明與示例），存 `sources/handbooks/`。收齊後才啟動 Phase 1 解析。

## 8. 風險

課綱 PDF 解析品質（表格複雜，需人工抽核）；AI 拆解的教學正確性（靠 Phase 2 試點校準＋審校閘門）；CIRN 文本開放條款需在 Phase 1 確認；全領域一次做的量大，故設計成波次交付，任何一波都可先發布為 partial release。
