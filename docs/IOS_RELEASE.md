# iOS Release Plan

Web確認版の骨格が固まった後、ゲーム本体をiOSアプリへ同梱する。Vercel上のURLを表示するだけのWebViewアプリにはしない。

## iOS版で追加するもの

- ローカル通知
- ネイティブ触覚
- アプリ終了・復帰処理
- オフライン保存
- App Store用アイコンとスクリーンショット
- 必要に応じてホーム画面ウィジェット

## 公開手順

1. Web確認版をiPhone実機で検証
2. Capacitor iOSプロジェクトを生成
3. 通知と触覚をネイティブ実装
4. GitHub ActionsのmacOS環境でArchive
5. TestFlight内部テスト
6. App Store Connectの情報を確定
7. Apple審査
8. App Store版を実際にインストールして再検証

## 現行要件メモ

2026-08-13時点では、App Store ConnectへアップロードするアプリはXcode 26以降とiOS 26 SDK以降でのビルドが必要。提出直前にApple公式の最新要件を再確認する。

- https://developer.apple.com/news/upcoming-requirements/
- https://developer.apple.com/app-store/review/guidelines/
