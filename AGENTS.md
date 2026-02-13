# AGENTS.md - Google Apps Script Telegram Bot (Google Calendar Booking)

本文件定義了開發「Google Calendar 同步預約計時行程 Telegram Bot」的規範與要求，旨在引導 AI 助手 (Jules) 完成後續開發。

## 專案目標
使用 Google Apps Script (GAS) 作為橋樑，開發一個與 Google 日曆同步的 Telegram 機器人，支援使用者透過 Inline Keyboards 進行計時行程的預約、查詢與管理。

## 技術棧
- **平台**: Google Apps Script (GAS)
- **API**:
  - Telegram Bot API
  - Google Calendar API (透過 GAS 內建服務)
- **文件參考**:
  - 核心規範: https://jules.google/docs/
  - API 文件: 使用 `context7` 查詢最新 Telegram 與 Google Calendar API 規範。

## 環境設定 (Environment Setup)
1. **Telegram Bot**:
   - 透過 @BotFather 建立機器人並取得 `BOT_TOKEN`。
   - 紀錄機器人的 Username 以便測試。
2. **Google Apps Script**:
   - 建立新的 GAS 專案 (script.google.com)。
   - 在「服務 (Services)」中新增 「Google Calendar API」。
   - 在專案設定中確保時區設定為 `Asia/Taipei` (或目標時區)。
3. **部署與 Webhook**:
   - 部署為「網頁應用程式 (Web App)」。
   - 執行身份：`Me` (您的 Google 帳號)。
   - 存取權限：`Anyone` (任何人，包含匿名)。
   - 使用 Telegram API 的 `setWebhook` 方法，將 Web App URL 綁定至機器人。
4. **開發工具 (選配)**:
   - 若本地開發，建議使用 `clasp` (Command Line Apps Script Projects) 進行程式碼同步。

## 功能需求
1. **查詢可用時段**:
   - 使用者點選日期後，系統檢查 Google 日曆，回傳該日空檔。
   - 使用 Inline Keyboards 呈現日期與時段選項。
2. **預約行程 (計時)**:
   - 支援使用者自訂行程時長。
   - 預約成功後需同步寫入 Google 日曆 (主日曆)。
   - 需處理重複預約衝突檢查。
3. **管理行程**:
   - 查詢已預約的行程清單。
   - 支援取消或更改現有預約。
4. **權限與設定**:
   - 機器人訊息與介面統一使用 **繁體中文**。
   - 需具備基本的權限控管 (如：白名單機制)。
   - 無需發送 Email 通知。

## 開發準則
- **效能優先**: GAS 的執行時間有限，應優化 API 呼叫次數，確保快速回應。
- **部署效率**: 代碼結構應易於在 GAS 環境部署與測試。
- **UI/UX**: 優先使用 Telegram Inline Keyboards 以提升使用者體驗，減少手動文字輸入。
- **程式碼結構**:
  - `Main.gs`: Webhook 進入點 (`doPost`)。
  - `Telegram.gs`: 處理 Telegram API 通訊邏輯。
  - `Calendar.gs`: 處理 Google 日曆讀寫邏輯。
  - `UI.gs`: 定義按鈕模板與訊息格式。
  - `Config.gs`: 存放 API Token, Whitelist 等設定。

## 開發流程
1. 使用 `context7` 取得 Telegram `setWebhook` 與 `sendMessage` (含 Inline Keyboard) 的範例。
2. 使用 `context7` 或內建文件確定 Google Calendar `listEvents` 與 `createEvent` 的最佳實踐。
3. 實作核心狀態機，處理預約流程 (日期選擇 -> 時段選擇 -> 時長確認)。
4. 進行整合測試，模擬 Telegram Webhook 回傳。

## 注意事項
- 務必處理時區問題 (預設使用專案設定時區)。
- 確保錯誤處理機制完善，避免 GAS 執行失敗導致機器人無回應。
