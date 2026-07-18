
## Feature 2: AI 創意樓層

小朋友輸入一句話或上傳一張相,自動生成一個可行走、可編輯、可儲存嘅 3D 樓層。無縫接入現有 1F 畫廊嘅樓層切換框架。

---

## 整體設計

### 資料模型 (加喺 `floors` 之上,唔動舊 schema)

- `floors` 加兩個欄:
  - `source_type text default 'manual'` — `manual` / `ai_text` / `ai_photo`
  - `scene_json jsonb` — AI 生成嘅場景描述(下面 schema),`manual` 樓層留 null
- 新 table `floor_assets`:每個 AI 樓層自訂物件
  - `id`, `floor_id fk`, `kind text`(`preset` / `sprite`), `preset_id text`, `image_path text nullable`, `x/y/z float`, `rotation_y float`, `scale float`, `color text nullable`, `created_at`
- 新 bucket `floor-sprites` (private, signed URL) — 存相片變公仔嘅原圖 + 去背後嘅 PNG
- 唔改 `artworks` 表

### Scene JSON schema (LLM 嚴格輸出)

```json
{
  "scene_name": "魔法花園",
  "sky": "day",              // day | night | sunset
  "ground": "grass",         // grass | sand | stone | wood
  "assets": [
    { "preset": "castle", "color": "#4A90E2", "x": 0, "y": 0, "z": -8, "scale": 1.5, "rotation": 0 },
    { "preset": "flower", "color": "#E74C3C", "x": 3, "y": 0, "z": -3, "scale": 1, "rotation": 0 }
  ]
}
```

### 預製資產庫 (procedural,零外部 model,零成本)

第一版 8 個 preset,全部用 Three.js primitive + `MeshStandardMaterial` 上色砌成:
`castle`(方塊+圓錐頂)、`tree`(圓柱+球)、`flower`(細圓柱+扁球)、`house`(方塊+三角頂)、`cloud`(幾個球疊)、`rock`(不規則多面體)、`fence`(重複細方塊)、`pond`(扁圓柱藍色透明)。

每個 preset 係一個 `buildPreset(id, color, scale) -> THREE.Group` 函數,方便日後加。

### AI 呼叫 (Lovable AI Gateway,無需 key)

- 文字→JSON:`google/gemini-3.1-flash-lite`,`response_format: json_object`,system prompt 列明 preset 清單 + JSON schema + 座標範圍(x/z ∈ [-10,10], y=0)。單次成本遠低於 $0.02。
- 相片→2.5D:同一個 Gemini vision model(`google/gemini-3.5-flash`),輸入相片,輸出 `{ suggested_shape: "cylinder"|"box"|"plane", suggested_name: "布丁狗" }`;去背用 `google/gemini-3.1-flash-image` 生成一張透明背景 PNG。單次成本 < $0.05。

### 生成流程 (非同步 + 兒童 UX)

- 前端 form → server function → 顯示「小精靈正在搭建魔法…」loading(用 CSS animation,無需第三方 lib)
- 完成後 `queryClient.invalidateQueries(['floors'])` + 自動 navigate 去嗰層
- 生成完全部 asset 已經寫入 DB,重載都仍在

### 編輯模式

樓層右上角加「✏️ 編輯」掣(只當 admin unlocked 先出現)。撳入編輯模式後:
- 撳物件會亮框,右邊出現 panel:移動 (方向鍵)、旋轉、縮放、刪除、「重新生成呢件」
- 拖拉用 `three` 內建 `DragControls`(XZ 平面),延遲 < 200ms
- 每次改動 debounce 300ms upsert 去 `floor_assets`

---

## Task 拆分 (逐個做,每個做完你 review 至落下一個)

**Task 1 — Migration**
`floors.source_type` + `floors.scene_json` + 新 `floor_assets` table(GRANT + RLS 公開讀) + 新 `floor-sprites` bucket。

**Task 2 — 預製資產庫**
新 `src/components/presets.ts`,export `PRESETS: Record<string, (color, scale) => THREE.Group>`,實作 8 個 preset。純 procedural,無外部檔案。

**Task 3 — 場景 renderer**
`Gallery3D` 加一條分支:如果 `floor.source_type !== 'manual'`,就用 `sky` / `ground` 換背景地面,再 loop `floor_assets` 用 `PRESETS[preset_id]` 加落 scene。畫作邏輯照舊(AI 樓層可以無畫作)。

**Task 4 — 文字生成 server function**
`generateFloorFromText({ prompt })`:admin 守衛 → 呼叫 Gemini flash lite(system prompt 內嵌 preset list + JSON schema)→ 驗證 JSON → 建立 `floors` row (`source_type='ai_text'`, `scene_json`) → 批量 insert `floor_assets` → return `floorId`。錯就 throw 友好中文訊息。

**Task 5 — 文字造夢 UI**
`/admin` 加「✨ 用文字造樓層」section:一個 textarea + 生成掣 + loading 動畫(小精靈 emoji 上下浮動)。成功後 `queryClient.invalidateQueries(['floors'])` + toast「新樓層已建好!」。前台 `/` 撳「↑ 上一層」就見到。

**Task 6 — 相片→2.5D server function + UI**
`generateFloorAssetFromPhoto({ floorId, dataUrl })`:admin 守衛 → 存原圖 → Gemini vision 拎 shape/name → Gemini image 生成透明 PNG → 存 storage → insert `floor_assets` (`kind='sprite'`, `image_path`, `x/z` default 隨機)。UI:編輯模式入面「📷 加公仔」按鈕,揀相 + 預覽 + 上傳。

**Task 7 — 編輯模式**
樓層右上角「✏️ 編輯」toggle(admin only)。開啟後:raycast 選 asset、右側 panel(方向鍵移動 / 旋轉 slider / scale slider / 刪除 / 重新生成)、debounce 300ms upsert。關閉編輯即時 render 最新狀態。

**Task 8 — 「重新生成呢件」局部修改**
Panel 加輸入框「例如:把城堡變大」,呼叫 Gemini 只更新該 asset 嘅 preset/color/scale(唔動 xyz),寫返 DB,場景即時 refresh。

---

## 技術細節 (畀非技術人跳過都得)

- **LLM output 保護**:server function 用 Zod parse scene_json,parse 失敗就重試一次,再失敗畀友好錯。
- **座標約束**:寫喺 system prompt(x/z ∈ [-10, 10], y=0, scale ∈ [0.5, 3]),再 server side clamp 一次防穿模。
- **成本**:flash-lite 一次 call 大約 500 input + 300 output token ≈ $0.0003,遠低於 $0.02 budget。
- **Cache**:`listFloors` 已經有,加 `source_type` / `scene_json` return,`listFloorAssets(floorId)` 新 server function。
- **樓層編號**:AI 樓層自動攞 `max(number)+1`。
- **切換樓層 dispose**:現有 `disposeGroup` 已經 traverse dispose geometry/material/texture,直接沿用。
- **DragControls**:`three/examples/jsm/controls/DragControls.js`,已包含喺 `three` package。

---

## 唔會做 (out of scope,標記 # FUTURE)

- 真 3D 模型生成(Meshy / Luma / TripoSR)
- 物理引擎、碰撞、重力
- AI 語音輸入
- 社群分享 / 多人協作
- 進階光影(SSAO / bloom / shadow map cascades)
- 樓層 template 市集

---

先由 **Task 1 (migration)** 開始 — 確認 plan OK 就落。
