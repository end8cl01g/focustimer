# AGENTS.md - Focus Timer Telegram Bot (Google Calendar Booking)

本專案為一個部署於 **Google Cloud Run** 的 Telegram Bot，透過 **Google Apps Script (GAS) Bridge** 與 Google 日曆同步。

## 技術棧
- **後端**: Node.js (TypeScript), Express, Telegraf
- **日曆串接**: Google Apps Script (GAS) Bridge
- **安全性**: Google Cloud Secret Manager
- **前端 (Mini App)**: HTML5, CSS (Glassmorphism), Vanilla JS

## 已實作功能
1.  **核心日曆功能** (✅)
    -   查詢今日行程、預約行程。
    -   **重複預約衝突檢查**: GAS Bridge 會檢查時段衝突並回傳錯誤。
2.  **安全性整合** (✅)
    -   **Secret Manager**: 自動從 GCP Secret Manager 載入 `TELEGRAM_BOT_TOKEN`, `GAS_WEBAPP_URL`, `GAS_API_KEY`。
3.  **效能優化** (✅)
    -   **事件快取**: 後端快取今日行程 (5分鐘 TTL)，預約後自動失效。
    -   **代碼模組化**: 邏輯拆分為 `notifier`, `timerState`, `utils`, `secrets`。
4.  **前端優化** (✅)
    -   資源分離 (`style.css`, `app.js`)。
    -   強化錯誤提示 (包含衝突檢查提示)。
5.  **代碼質量** (✅)
    -   **ESLint**: 使用 `eslint.config.mjs` 進行靜態檢查。

## 待實作與優化功能
- [ ] **多使用者支援** (目前為單一使用者設計)。
- [ ] **更精細的權限管理**。

## 環境變數
| 變數名稱 | 說明 |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Bot Token (可存於 Secret Manager) |
| `GAS_WEBAPP_URL` | GAS Web App URL (可存於 Secret Manager) |
| `SERVICE_URL` | Cloud Run URL (Webhook 註冊用) |
| `GOOGLE_CLOUD_PROJECT` | GCP Project ID (Secret Manager 必要) |

## 部署與運行
- **編譯**: `npm run build`
- **運行**: `npm start`
- **檢查**: `npm run lint`
