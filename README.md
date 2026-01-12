# Aetheria - AI 互動小說平台

> 打造屬於你的世界，與 AI 共創獨特的互動故事體驗

**線上體驗**：[https://aetheria-charliizs-projects.vercel.app/](https://aetheria-charliizs-projects.vercel.app/)

---

## 專案簡介

**Aetheria** 是一款 AI 驅動的互動式小說遊戲平台，讓玩家能夠：

- **建立獨特世界觀** — 定義世界規則與自訂狀態系統（HP、MP、物品、技能等）
- **創造可重用角色** — 設計角色的背景故事、性格特點與說話風格
- **體驗動態故事** — 與 AI 即時互動，每個選擇都會影響故事走向與角色狀態
- **多種遊戲模式** — 扮演特定角色深入體驗，或化身導演掌控全局

---

## 主要功能

### 沉浸式遊玩體驗
- 聊天式敘事介面，流暢的即時對話
- 智慧 AI 生成豐富的故事敘述與自然對話
- 即時追蹤角色狀態、物品與數值變化

### 強大的 AI 整合
- 支援 **OpenRouter** 與 **OpenAI** 雙供應商
- 可調整 Temperature、Max Tokens 等參數

### 精心設計的介面
- 深色/淺色主題一鍵切換
- 響應式設計，支援各種螢幕尺寸
- 優雅的 Toast 通知系統

### 進階功能
- 滾動摘要系統：自動摘要過去劇情，保持上下文連貫
- 故事回溯：支援返回特定回合重新體驗
- 動態狀態 Schema：可隨時調整角色屬性定義

---

## 技術架構

| 類別 | 技術 |
|------|------|
| **前端框架** | Next.js 15 (App Router) + React 19 + TypeScript |
| **樣式系統** | Tailwind CSS + Radix UI |
| **後端資料庫** | Supabase |
| **認證系統** | Supabase Auth |
| **AI 服務** | OpenRouter / OpenAI API |
| **部署平台** | Vercel |

---

## 核心概念

| 名詞 | 定義 |
|------|------|
| **World** | 世界規則與狀態 Schema 定義 |
| **Character** | 跨世界共用的角色卡 |
| **Story** | 一次遊玩實例，綁定世界觀與角色 |
| **Turn** | 玩家輸入 → AI 敘述 → 狀態變更的最小單位 |

### 遊戲模式
- **PLAYER_CHARACTER 模式**：玩家控制一個特定角色
- **DIRECTOR 模式**：玩家是導演，可指揮所有角色和事件

---