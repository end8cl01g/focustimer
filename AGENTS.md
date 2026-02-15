# AGENTS.md - Focus Timer Telegram Bot (Google Calendar Booking)

本專案為一個部署於 **Google Cloud Run** 的 Telegram Bot，透過 **Google Apps Script (GAS) Bridge** 與 Google 日曆同步，支援使用者查詢空檔並預約計時行程。

## 技術棧
- **後端語言**: Node.js (TypeScript)
- **框架**:
  - `Express` — 處理 Telegram Webhook HTTP 請求 & Mini App API
  - `Telegraf` — Telegram Bot 框架
- **日曆串接**:
  - **Google Apps Script (GAS)** — 作為中間橋樑 (Bridge)，簡化 OAuth2 流程並調用 Google Calendar API
  - `fetch` (Node.js built-in) — 用於與 GAS Web App 通訊
- **前端 (Mini App)**:
  - HTML5 / Vanilla CSS / JavaScript
  - Tailwind-like Utility Classes (自定義)
  - Glassmorphism UI Design
- **基礎設施**:
  - **Google Cloud Run** — 託管後端服務
  - **Google Cloud Build** — CI/CD 自動化建構與推送映像
  - **Artifact Registry** — 儲存 Docker 映像
  - **File Persistence** — 使用 `data/chat_id.json` 儲存 Chat ID 以支援主動推播

## 專案結構
```
├── public/
│   └── index.html      # 專注定時器 Mini App 網頁 (含 Action Sheet, Modal, Subtasks)
├── src/
│   ├── index.ts          # Express Server 進入點 (Webhook / Polling / Notification Loop)
│   ├── bot.ts            # Telegraf Bot 邏輯 & Chat ID Persistence
│   ├── calendar.ts       # 透過 GAS Bridge 與日曆互動 (查詢/預約)
│   └── types/
│       └── index.ts      # TypeScript 型別定義
├── gas_bridge.js         # 部署於 Google Apps Script 的橋樑程式碼
├── Dockerfile            # Multi-stage Docker 建構
├── cloudbuild.yaml       # Cloud Build 建構與推送步驟
├── setup.ps1             # GCP 資源初始化腳本 (API/Artifact Registry)
├── .env.example          # 環境變數範本
├── package.json
└── tsconfig.json
```

## 已實作功能
1.  **核心日曆功能** (✅)
    -   **查詢今日日曆** — 透過 GAS 獲取今日的所有行程。
    -   **預約行程** — 透過 Mini App 介面直接預約 Google Calendar。
2.  **專注定時器 Mini App** (✅)
    -   **倒數/正計時** — 支援每個行程獨立計時。
    -   **子任務 (Subtasks)** — 每個專注時段可建立獨立的待辦清單。
    -   **隱藏已完成** — 自動過濾當日已完成的任務。
    -   **視覺優化** — Mobile-first 設計，支援深色模式與毛玻璃特效。
3.  **進階會話管理** (✅)
    -   **續約 (Renew Session)** — 針對過期任務，支援「立即開始」或「自訂時間」續約。
    -   **預約修復** — 強化「Book」按鈕的穩定性與錯誤提示。
4.  **伺服器端通知** (✅)
    -   **主動推播** — 後端每分鐘檢查行程，於任務開始時發送 Telegram 通知。
    -   **持久化** — 自動儲存 Chat ID，確保重啟後仍能發送通知。
5.  **不間斷運行** (✅)
    -   **Keep-warm** — 接收 SIGTERM 時嘗試自我請求，防止冷啟動延遲。
    -   **Webhook 自動註冊** — 部署時自動設定 Webhook URL。

## 待實作與優化功能
- [ ] **多使用者支援** — 目前 Chat ID 儲存為單一檔案，需改為資料庫或多檔案結構以支援多人使用。
- [ ] **重複預約衝突檢查** — 前端 UI 尚未處理時段衝突。
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
1.  **GAS Bridge**: 部署 `gas_bridge.js` 為 Web App (Anyone acts as Me)。
2.  **GCP Resources**: 執行 `.\setup.ps1` 初始化。
3.  **Deploy**: 執行 `gcloud builds submit --config cloudbuild.yaml .`。
4.  **Start Bot**: 對 Bot 發送 `/start` 以啟用通知功能。

---

<skills>

You have additional SKILLs documented in directories containing a "SKILL.md" file.

These skills are:
 - hugging-face-cli -> ".agent/skills/hugging-face-cli/SKILL.md"
 - hugging-face-datasets -> ".agent/skills/hugging-face-datasets/SKILL.md"
 - hugging-face-evaluation -> ".agent/skills/hugging-face-evaluation/SKILL.md"
 - hugging-face-jobs -> ".agent/skills/hugging-face-jobs/SKILL.md"
 - hugging-face-model-trainer -> ".agent/skills/hugging-face-model-trainer/SKILL.md"
 - hugging-face-paper-publisher -> ".agent/skills/hugging-face-paper-publisher/SKILL.md"
 - hugging-face-tool-builder -> ".agent/skills/hugging-face-tool-builder/SKILL.md"
 - hugging-face-trackio -> ".agent/skills/hugging-face-trackio/SKILL.md"

IMPORTANT: You MUST read the SKILL.md file whenever the description of the skills matches the user intent, or may help accomplish their task. 

<available_skills>

hugging-face-cli: `Execute Hugging Face Hub operations using the hf CLI. Use when the user needs to download models/datasets/spaces, upload files to Hub repositories, create repos, manage local cache, or run compute jobs on HF infrastructure. Covers authentication, file transfers, repository creation, cache operations, and cloud compute.`
hugging-face-datasets: `Create and manage datasets on Hugging Face Hub. Supports initializing repos, defining configs/system prompts, streaming row updates, and SQL-based dataset querying/transformation. Designed to work alongside HF MCP server for comprehensive dataset workflows.`
hugging-face-evaluation: `Add and manage evaluation results in Hugging Face model cards. Supports extracting eval tables from README content, importing scores from Artificial Analysis API, and running custom model evaluations with vLLM/lighteval. Works with the model-index metadata format.`
hugging-face-jobs: `This skill should be used when users want to run any workload on Hugging Face Jobs infrastructure. Covers UV scripts, Docker-based jobs, hardware selection, cost estimation, authentication with tokens, secrets management, timeout configuration, and result persistence.`
hugging-face-model-trainer: `Train or fine-tune language models using TRL on Hugging Face Jobs infrastructure. Covers SFT, DPO, GRPO and reward modeling training methods, plus GGUF conversion for local deployment.`
hugging-face-paper-publisher: `Publish and manage research papers on Hugging Face Hub. Supports creating paper pages, linking papers to models/datasets, claiming authorship, and generating professional markdown-based research articles.`
hugging-face-tool-builder: `Build tools/scripts using data from the Hugging Face API. Useful when chaining or combining API calls or the task will be repeated/automated.`
hugging-face-trackio: `Track and visualize ML training experiments with Trackio. Use when logging metrics during training (Python API) or retrieving/analyzing logged metrics (CLI). Supports real-time dashboard visualization, HF Space syncing, and JSON output for automation.`
</available_skills>

Paths referenced within SKILL folders are relative to that SKILL. For example the hugging-face-datasets `scripts/example.py` would be referenced as `.agent/skills/hugging-face-datasets/scripts/example.py`.

</skills>
