# AGENTS.md - Focus Timer Telegram Bot (Google Calendar Booking)

本專案為一個部署於 **Google Cloud Run** 的 Telegram Bot，可與 Google 日曆同步，支援使用者透過 Inline Keyboards 查詢空檔並預約計時行程。

## 技術棧
- **後端語言**: Node.js (TypeScript)
- **框架**:
  - `Express` — 處理 Telegram Webhook HTTP 請求
  - `Telegraf` — Telegram Bot 框架
  - `googleapis` — Google Calendar API 串接
- **基礎設施**:
  - **Google Cloud Run** — 託管後端服務
  - **Google Cloud Build** — CI/CD 自動化建構與推送映像
  - **Artifact Registry** — 儲存 Docker 映像

## 專案結構
```
├── src/
│   ├── index.ts          # Express Server 進入點 (Webhook / Polling 雙模式)
│   ├── bot.ts            # Telegraf Bot 邏輯 (Inline Keyboards 預約流程)
│   ├── calendar.ts       # Google Calendar API 互動 (查詢空檔/建立事件)
│   └── types/
│       └── index.ts      # TypeScript 型別定義
├── Dockerfile            # Multi-stage Docker 建構
├── cloudbuild.yaml       # Cloud Build 建構與推送步驟
├── deploy.ps1            # 一鍵部署腳本 (Build + Deploy + 注入環境變數)
├── setup.ps1             # GCP 資源初始化腳本 (API/SA/Artifact Registry)
├── .env.example          # 環境變數範本
├── package.json
└── tsconfig.json
```

## 已實作功能
1. **查詢今日空檔** — 透過 Google Calendar API 檢查 09:00-18:00 之間的 1 小時空檔，以 Inline Keyboard 呈現。
2. **一鍵預約** — 點擊 Inline Button 即可將 Focus Session 寫入 Google 日曆。
3. **雙模式運行** — `NODE_ENV=development` 使用 Polling，`production` 使用 Webhook。

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
| `GOOGLE_APPLICATION_CREDENTIALS` | Service Account JSON 檔案路徑 (開發用) |
| `GOOGLE_CREDENTIALS_JSON` | Service Account JSON 內容 (Cloud Run 部署用) |
| `GOOGLE_CALENDAR_ID` | Google Calendar ID (預設 `primary`) |
| `PORT` | 伺服器埠號 (預設 `8080`) |
| `NODE_ENV` | `development` (Polling) / `production` (Webhook) |

## 部署流程
1. 執行 `.\setup.ps1` 初始化 GCP 資源
2. 編輯 `.env` 填入 Token 與相關設定
3. 將 Google 日曆分享給 Service Account Email
4. 執行 `.\deploy.ps1` 一鍵建構與部署
5. 部署後設定 Telegram Webhook:
   ```
   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=<CLOUD_RUN_URL>/webhook/<TOKEN>"
   ```

## 注意事項
- **安全性**: `.env` 與 `service-account.json` 已加入 `.gitignore`，不會被提交。
- **時區**: 預設 `Asia/Taipei`。
- **冷啟動**: Express 啟動輕量，冷啟動時間極短。
