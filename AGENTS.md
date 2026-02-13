# AGENTS.md - Cloud Run Telegram Bot (Google Calendar Booking)

本文件定義了開發「Google Calendar 同步預約計時行程 Telegram Bot」的規範與要求，專為部署於 **Google Cloud Run** 並透過 **Cloud Build** 自動化環境設計。

## 專案目標
使用 Google Cloud Run 作為後端服務，開發一個與 Google 日曆同步的 Telegram 機器人，支援使用者透過 Inline Keyboards 進行計時行程的預約、查詢與管理。

## 技術棧 (最優解推薦)
- **後端語言**: **Node.js (TypeScript)**
  - 理由：擁有最成熟的 Telegram Bot 框架 (`Telegraf`) 與 Google API 客戶端程式庫，異步處理效能優異，適合 I/O 密集型任務。
- **框架**:
  - `Express`: 用於處理 Telegram Webhook 的 HTTP 請求。
  - `Telegraf`: 強大的 Telegram Bot 框架。
  - `googleapis`: 官方 Google Calendar API 串接。
- **基礎設施**:
  - **Google Cloud Run**: 託管後端服務，具備自動縮放與按量計費特性。
  - **Google Cloud Build**: 實作 CI/CD 自動化部署。
  - **Google Secret Manager**: 安全儲存 BOT_TOKEN 與 Google API 憑證。
  - **Artifact Registry**: 儲存 Docker 鏡像。

## 環境設定 (Environment Setup)
1. **GCP 專案準備**:
   - 啟用 Cloud Run, Cloud Build, Artifact Registry, 與 Google Calendar API。
   - 建立一個 **Service Account** 並授予存取 Google 日曆的權限 (Domain-wide Delegation 或直接分享日曆)。
2. **密鑰管理**:
   - 將 `TELEGRAM_BOT_TOKEN` 與 `GOOGLE_CREDENTIALS_JSON` 存入 Secret Manager。
3. **自動化部署 (CI/CD)**:
   - 建立 `cloudbuild.yaml` 定義構建步驟：
     - Docker 構建 (Build image)
     - 推送到 Artifact Registry (Push image)
     - 部署到 Cloud Run (Deploy to Cloud Run)
   - 建立 Cloud Build Trigger 連結至 GitHub/GitLab 倉庫。
4. **Telegram Webhook**:
   - 部署完成後，獲取 Cloud Run URL，使用 Telegram API 的 `setWebhook` 進行綁定。

## 功能需求
1. **查詢可用時段**:
   - 使用者點選日期後，系統透過 Google API 檢查日曆空檔。
   - 使用 Inline Keyboards 呈現日期與時段選項。
2. **預約行程 (計時)**:
   - 支援使用者自訂行程時長。
   - 預約成功後同步寫入 Google 日曆。
   - 處理重複預約衝突檢查。
3. **管理行程**: 查詢、取消或更改現有預約。
4. **語言與權限**: 統一使用 **繁體中文**，具備白名單控管機制。

## 專案結構
- `src/`: 原始碼
  - `index.ts`: 進入點與 Express Server。
  - `bot.ts`: Telegram 邏輯處理 (Telegraf 實體)。
  - `calendar.ts`: Google Calendar API 互動邏輯。
  - `types/`: TypeScript 型別定義。
- `Dockerfile`: 定義容器構建過程。
- `cloudbuild.yaml`: 定義自動化部署流程。
- `package.json`: 依賴管理。

## 注意事項
- **冷啟動 (Cold Start)**: 確保服務在冷啟動時能快速初始化。
- **安全性**: 絕對不要將 Token 寫入程式碼或 Dockerfile，務必使用 Secret Manager。
- **時區**: 預設使用 `Asia/Taipei`。
