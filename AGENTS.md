# AGENTS.md - Focus Timer Telegram Bot (Google Calendar Booking)

本專案為一個部署於 **Google Cloud Run** 的 Telegram Bot，透過 **Google Apps Script (GAS) Bridge** 與 Google 日曆同步，支援使用者查詢空檔並預約計時行程。

## 技術棧
- **後端語言**: Node.js (TypeScript)
- **框架**:
  - `Express` — 處理 Telegram Webhook HTTP 請求
  - `Telegraf` — Telegram Bot 框架
- **日曆串接**:
  - **Google Apps Script (GAS)** — 作為中間橋樑 (Bridge)，簡化 OAuth2 流程並調用 Google Calendar API
  - `fetch` (Node.js built-in) — 用於與 GAS Web App 通訊
- **基礎設施**:
  - **Google Cloud Run** — 託管後端服務
  - **Google Cloud Build** — CI/CD 自動化建構與推送映像
  - **Artifact Registry** — 儲存 Docker 映像

## 專案結構
```
├── public/
│   └── index.html      # 專注定時器 Mini App 網頁
├── src/
│   ├── index.ts          # Express Server 進入點 (Webhook / Polling 雙模式)
│   ├── bot.ts            # Telegraf Bot 邏輯 (Inline Keyboards 預約流程)
│   ├── calendar.ts       # 透過 GAS Bridge 與日曆互動 (查詢/預約)
│   └── types/
│       └── index.ts      # TypeScript 型別定義
├── gas_bridge.js         # 部署於 Google Apps Script 的橋樑程式碼
├── Dockerfile            # Multi-stage Docker 建構
├── cloudbuild.yaml       # Cloud Build 建構與推送步驟
├── deploy.ps1            # 一鍵部署腳本 (Build + Deploy + 注入環境變數)
├── setup.ps1             # GCP 資源初始化腳本 (API/Artifact Registry)
├── .env.example          # 環境變數範本
├── package.json
└── tsconfig.json
```

## 已實作功能
1. **查詢今日日曆** (✅) — 透過 GAS 獲取今日的所有行程，並列出時間、標題與描述。
2. **核心預約邏輯** (✅) — `CalendarManager` 已實作 `createEvent` 與 `getFreeSlots`，並與 GAS 對接。
3. **雙模式運行** (✅) — `NODE_ENV=development` 使用 Polling，`production` 使用 Webhook 並自動註冊。
4. **自動喚醒 (Keep-warm)** (✅) — 接收 SIGTERM 時嘗試自我請求，並在 `index.ts` 中實作健康檢查路徑。
5. **專注定時器 Mini App** (✅) — 提供 HTML5 網頁版定時器，支援每個行程獨立計時與完成回報。

## 待實作與優化功能
- [ ] **預約 UI 流程整合** — 目前 `bot.ts` 中 `📝 管理我的預約` 為佔位符，需整合 `getFreeSlots` 顯示可預約時段。
- [ ] **使用者白名單控管** — 目前任何知道 Bot 的人都能預約。
- [ ] **自訂行程時長** — 目前預設為 1 小時。
- [ ] **重複預約衝突檢查** — 雖然 GAS 有基本邏輯，但前端 UI 尚未處理。
- [ ] **Secret Manager 整合** — 提升環境變數安全性。

## 環境變數
| 變數名稱 | 說明 |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Telegram Bot Token (from @BotFather) |
| `GAS_WEBAPP_URL` | 部署後的 GAS Web App URL |
| `GAS_API_KEY` | 與 GAS Bridge 通訊的密鑰 (需與 `gas_bridge.js` 一致) |
| `SERVICE_URL` | Cloud Run 部署後的網址 (Webhook 註冊用) |
| `PORT` | 伺服器埠號 (預設 `8080`) |
| `NODE_ENV` | `development` (Polling) / `production` (Webhook) |

## 部署流程
### 1. 部署 GAS Bridge
1. 前往 [Google Apps Script](https://script.google.com/)。
2. 建立新專案並貼入 `gas_bridge.js` 內容。
3. 若需要，設定 `API_KEY` 常數（建議在 `doPost` 中檢查 `body.apiKey`）。
4. 部署為 **Web App**：
   - Execute as: **Me**
   - Who has access: **Anyone**
5. 複製產生的 Web App URL。

### 2. 部署 Telegram Bot
1. 執行 `.\setup.ps1` 初始化 GCP 資源。
2. 編輯 `.env` 填入 Token、GAS URL 與 `SERVICE_URL`。
3. 執行 `.\deploy.ps1` 一鍵建構與部署至 Cloud Run。

## 注意事項
- **時區**: 程式碼中多處硬編碼為 `Asia/Taipei` (UTC+8)。
- **GAS 限制**: Google 帳號對 Apps Script 每日調用有配額限制。
- **安全性**: 務必設定 `GAS_API_KEY`。
