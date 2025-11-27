# CLAUDE.md

このファイルは、Claude Code (claude.ai/code) がこのリポジトリで作業する際のガイダンスを提供します。

## プロジェクト概要

案件AIマネージャーは、ReactとViteで構築された建設プロジェクトスケジューリングアプリケーションです。Google Gemini AI（`@google/genai`経由）を使用して、施設の制約、スタッフの資格、作業負荷のバランスに基づいてインテリジェントに工事をスケジューリングします。

## 開発コマンド

```bash
# 依存関係のインストール
npm install

# 開発サーバー起動（ポート3000）
npm run dev

# 本番用ビルド
npm run build

# 本番ビルドのプレビュー
npm run preview
```

## 環境設定

Vercelダッシュボードで`GEMINI_API_KEY`環境変数を設定してください（サーバーサイドでのみ使用）。

## アーキテクチャ

### 技術スタック
- React 19 + TypeScript
- Vite 6（バンドラー）
- Vercel Serverless Functions（APIルート）
- Google Gemini AI（`gemini-2.5-flash`モデル）
- Tailwind CSS（index.htmlでCDN経由）
- lucide-react（アイコン）

### ファイル構成

```
App.tsx              # メインアプリ（状態管理とビジネスロジック）
types.ts             # TypeScript型定義（Project, Facility, Staff, ScheduleEvent）
constants.ts         # モックデータ（施設、スタッフ、初期プロジェクト）
api/
  schedule.ts        # サーバーレス関数: AIスケジュール自動割当
  validate.ts        # サーバーレス関数: スケジュール移動バリデーション
services/
  geminiService.ts   # クライアント側APIラッパー（/api/*を呼び出し）
components/
  DashboardView.tsx  # プロジェクト一覧/テーブル表示
  CalendarView.tsx   # スタッフ/タイムラインスケジュール（ドラッグ&ドロップ対応）
  FacilityModal.tsx  # 施設詳細モーダル
```

### 主要データ型

- **Project**: 案件（施設、契約区分、ステータス、必要資格）
- **Facility**: 施設（AI制約：作業可能日、制限事項）
- **Staff**: スタッフ（資格、種別：社内/外注、同時作業上限）
- **ScheduleEvent**: プロジェクトと日付・担当スタッフの紐付け

### AI連携（サーバーサイド）

APIキーを安全に保護するため、Gemini APIはVercel Serverless Functionsで実行:

| エンドポイント | 機能 |
|--------------|------|
| `POST /api/schedule` | 下書き案件を受け取り、施設制約に基づいて最適な日付を割り当て |
| `POST /api/validate` | ドラッグ&ドロップ操作が施設ルールに違反していないか検証 |

クライアント側の`services/geminiService.ts`はこれらのAPIを呼び出すラッパー関数を提供

### ビジネスロジック（`App.tsx`）

- **チーム編成**: スタッフの作業負荷を分散、有資格者を優先
- **多層バリデーション**:
  - 資格チェック（必要資格がないスタッフはブロック）
  - 外注先の同時作業上限
  - 同一施設内の重複は許可
  - 異施設間の競合は防止
- **ドラッグ&ドロップ**: 通常ドラッグ = 再割り当て、Ctrl+ドラッグ = メンバー追加

### パスエイリアス

`@/*`はプロジェクトルートにマッピング（`tsconfig.json`と`vite.config.ts`で設定）
