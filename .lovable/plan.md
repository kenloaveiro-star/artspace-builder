## 目標

將「樓層」由 hardcode 變成後台可管理,每層有唔同 layout 同主題,支援日後無限加層。

---

## 1. 資料庫改動 (一個 migration)

**新 table `public.floors`**
- `id uuid pk`
- `number int unique not null` — 樓層編號 (1, 2, 3...)
- `name text not null default ''` — 顯示名 (例如 "1F 童畫廊")
- `theme text not null default 'wood'` — 主題 key
- `layout text not null default 'rect4'` — layout key
- `created_at timestamptz default now()`
- RLS: 公開 SELECT (anon + authenticated),寫入只走 server function
- GRANT SELECT to anon, authenticated;GRANT ALL to service_role

**改 `public.artworks`**
- 加 `floor_id uuid references floors(id) on delete restrict`
- Seed:先 insert 一行 `floors` (number=1, name='1F', theme='wood', layout='rect4'),再將所有現有 `artworks.floor_id` 填做嗰個 id
- 之後將 `floor_id` set 做 `not null`
- `on delete restrict` 就係「有畫作嘅樓層唔畀刪」嘅 DB 層保險

---

## 2. 主題預設 (4 個)

前端一個 `themes.ts` map,每個 key 對應 Three.js 材質參數:

| Key | 名 | 地板 | 牆 | 燈氛圍 |
|---|---|---|---|---|
| `wood` | 木系畫廊 | 暖木紋 | 米白 | 暖射燈 (現時 1F) |
| `marble` | 大理石 | 灰白大理石 | 白 | 冷白射燈 |
| `dark` | 黑盒展廳 | 深啡木 | 深灰 | 聚光射燈 + 暗環境 |
| `outdoor` | 戶外庭園 | 石地 | 淺藍(天空色) | 日光 |

---

## 3. Layout 預設 (3 個)

| Key | 名 | 描述 |
|---|---|---|
| `rect4` | 四面牆 | 現時 1F 做法,4 面牆平均分配 |
| `corridor` | 長廊 | 長方形房,只用左右兩面長牆 |
| `round` | 圓形展廳 | 8 邊型,每邊掛一幅 |

每個 layout 係 `Gallery3D` 入面一個 builder function,負責起牆同計算畫作擺位。

---

## 4. Server functions (`src/lib/floors.functions.ts`)

- `listFloors()` — 公開,return `[{id, number, name, theme, layout, artworkCount}]`,按 number 排序
- `createFloor({number, name, theme, layout})` — admin 守衛,unique number 檢查
- `updateFloor({id, name, theme, layout})` — admin 守衛 (唔畀改 number 免影響 URL/state)
- `deleteFloor({id})` — admin 守衛,先數 artworks,>0 就 throw「該樓層仍有 N 幅作品,請先刪除或搬移」

改 `admin.functions.ts`:
- `uploadArtwork` 加 `floorId` 參數
- `listArtworks` return 加 `floor_id`,或者改用 `listArtworksByFloor(floorId)` 畀畫廊呼叫

---

## 5. Admin UI 改動 (`/admin`)

加多一個 section「樓層管理」:
- 列表:編號 / 名 / 主題 / Layout / 作品數 / [改] [刪]
- 「新增樓層」form:number (auto suggest 下一個)、name、theme dropdown、layout dropdown
- 上傳作品 form 加「樓層」dropdown (default 1F)
- 有作品嘅樓層,刪除掣 disabled + tooltip「請先清空作品」

---

## 6. 前台改動 (`/` + `Gallery3D`)

- `MAX_FLOOR` / `MIN_FLOOR` 移除,改由 `listFloors` 拎
- Floor switcher 按 floor list 上一個/下一個 navigate
- Floor label 顯示 `${number}F ${name}`
- `Gallery3D` props 由 `floor: number` 改為 `floorConfig: {theme, layout, artworks}`
- 內部按 `theme` 揀材質、按 `layout` 揀 builder function
- 切樓層時 dispose 邏輯不變 (已經 traverse dispose)

---

## 建置順序 (逐個 task 等你確認)

1. **Migration**: 起 `floors` table + seed 1F + 為 `artworks` 加 `floor_id` + RLS + GRANT
2. **Server functions**: `listFloors` / `createFloor` / `updateFloor` / `deleteFloor`;改 `uploadArtwork` 收 `floorId`;`listArtworks` 加 `floor_id`
3. **Admin UI**: 樓層管理 section + 上傳 form 加樓層揀
4. **前台重構**: `themes.ts` + `layouts.ts` + `Gallery3D` 接 `floorConfig` + 樓層切換用 DB 資料

先由 Task 1 (migration) 開始 — 確認 plan OK 就落。

---

## 唔會做 (out of scope)

- 每層自訂顏色 (只揀預設主題)
- 拖拉安排每幅畫嘅位置 (auto-arrange)
- 樓層 reorder (number 定咗就係定咗)
- 樓梯 3D 動畫 (仍然用按鈕切換)
