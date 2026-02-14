# AGENTS.md - Focus Timer Telegram Bot (Google Calendar Booking)

本專案為一個部署於 **Google Cloud Run** 的 Telegram Bot，透過 **Google Apps Script (GAS) Bridge** 與 Google 日曆同步，支援使用者透過 Inline Keyboards 查詢空檔並預約計時行程。

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
1. **查詢今日日曆** — 透過 GAS 獲取今日的所有行程，並列出時間與標題。
2. **一鍵預約** — 點擊 Inline Button 即可將 Focus Session 寫入 Google 日曆。
3. **雙模式運行** — `NODE_ENV=development` 使用 Polling，`production` 使用 Webhook 並自動註冊。
4. **自動喚醒 (Keep-warm)** — 在 SIGTERM 接收時嘗試自我請求以維持啟動狀態（實驗性）。

## 待實作功能
- [ ] 使用者白名單控管
- [ ] 自訂行程時長 (目前固定 1 小時)
- [ ] 管理行程 (查詢/取消/更改)
- [ ] 重複預約衝突檢查
- [ ] Secret Manager 整合 (目前使用環境變數)

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
3. 若需要，設定 `API_KEY` 常數。
4. 部署為 **Web App**：
   - Execute as: **Me**
   - Who has access: **Anyone**
5. 複製產生的 Web App URL。

### 2. 部署 Telegram Bot
1. 執行 `.\setup.ps1` 初始化 GCP 資源。
2. 編輯 `.env` 填入 Token、GAS URL 與 `SERVICE_URL`。
3. 執行 `.\deploy.ps1` 一鍵建構與部署至 Cloud Run。

## 注意事項
- **時區**: 預設 `Asia/Taipei`。
- **GAS 限制**: Google 帳號對 Apps Script 每日調用有配額限制，一般個人帳號足夠使用。
- **安全性**: 務必設定 `GAS_API_KEY` 以防止他人直接調用您的日曆橋樑。
