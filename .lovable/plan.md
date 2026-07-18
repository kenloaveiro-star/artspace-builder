
# 3D樂園 MVP 計劃

用 Lovable stack (React + TanStack Start + Three.js + Lovable Cloud) 重做原本 Flask spec。冇 `run.bat`、冇本機 Python — 直接喺瀏覽器行，Cloud 幫手做 DB / Storage / Auth。

跟 Vibe Coding 原則：分細 task，每完成一個等你確認先行下一步。

## MVP 範圍

- **1F 3D 畫廊**：木地板、牆、黑框畫、射燈、夜景窗，Three.js CDN r128
- **樓層切換框架**：可去 2F（空房），可返 1F，切換時正確 dispose geometry/material/texture
- **Admin `/admin`**：共用密碼登入 → 上傳圖 → 列表刪除
- 上傳圖 auto-resize（長邊 ≤ 2048, JPEG q=85）後放 Cloud Storage，metadata 入 DB，1F 牆自動顯示

**# FUTURE（唔會做）**：遊戲、多樓層內容、分享、多用戶、動態光影、模型匯入、VR、第三方登入

## 技術對照（Flask spec → Lovable stack）

| 原 spec | 改成 |
|---|---|
| Flask + `run.bat` | TanStack Start (瀏覽器直接開，冇本機安裝) |
| SQLite `./data/database.db` | Lovable Cloud Postgres (`artworks` table) |
| `./data/artworks/` 檔案 | Lovable Cloud Storage bucket `artworks` (public read) |
| Pillow resize | 瀏覽器端 Canvas resize → 上傳 JPEG |
| `werkzeug` hash + env admin | 共用密碼 secret + 加密 session cookie (server-only 對比) |
| Three.js CDN r128 script tag | `three` npm 套件（更啱 React + Vite；等效 API） |

## 資料模型

- Table `public.artworks`：`id uuid`, `title text`, `storage_path text`, `width int`, `height int`, `created_at timestamptz`
- 公開 SELECT (anon)；INSERT/DELETE 只限 server function（後台密碼守衛後用 admin client）
- Storage bucket `artworks`（public read）

## 路由

- `/` — 3D 畫廊（Three.js canvas + 樓層切換 UI）
- `/admin` — 密碼登入 form → 上傳 + 列表刪除

## 建置順序（每個 task 一個 turn，等你確認）

1. Enable Lovable Cloud，起 `artworks` table + RLS + `artworks` storage bucket
2. 起空 3D 畫廊場景（木地板、牆、射燈、夜景窗、OrbitControls）— 未有畫作，顯示「目前沒有作品」提示
3. 樓層切換框架：`FloorSwitcher` 按鈕 + 正確 dispose 邏輯 + 2F 空房
4. Server functions：`listArtworks`（公開）、`unlockAdmin` / `uploadArtwork` / `deleteArtwork`（密碼守衛）
5. `/admin` UI：登入 + 上傳（瀏覽器 resize）+ 列表 + 刪除
6. 1F 畫廊讀 `listArtworks`，將圖以黑框形式排列上牆

## 驗收（對應你原 spec）

- [x] 開網址即見空畫廊 + 提示（唔使 run.bat）
- [x] `/admin` 密碼登入、上傳 JPG、自動 resize
- [x] 返 1F 見到剛上傳嘅畫作以黑框上牆
- [x] 可切 2F 空房、切返 1F 畫作仍在
- [x] 資料存喺 Cloud，reload / 重開 tab 都保留

## 需要你提供

- **Admin 共用密碼**：等去到 task 4 時我會用 secure form 問你入 `SITE_PASSWORD`
- （session 加密 key `SESSION_SECRET` 我會自動 generate）

確認後我由 **Task 1（開 Cloud + schema + bucket）** 開始。
