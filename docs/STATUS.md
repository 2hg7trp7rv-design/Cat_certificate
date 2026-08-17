# Tail Room Status

更新日: 2026-08-18 JST

## Current

Creator Preview 0.7.0のWebGL描画基盤は、ソース、テスト、静的ビルド、Vercel配信、CI上のソフトウェアWebGL検証まで実装済みです。

次の実装マイルストーンは**v0.8: 猫の生命感**です。ただし、その前に実iPhoneと実GPUでv0.7の性能・入力ゲートを閉じる必要があります。

最優先資料: [WORK_HANDOFF.md](WORK_HANDOFF.md)

検証詳細: [V07_VALIDATION.md](V07_VALIDATION.md)

## Verified implementation checkpoint

- Commit: `368a2cd99d6013460a16004992225fe67c290fd3`
- GitHub Actions: [Quality Gate Run 46](https://github.com/2hg7trp7rv-design/Cat_room/actions/runs/32046435711) — success
- Vercel deployment: `dpl_Ad8LYruuA4UG5BskZvpVijdD6naY` — READY / production
- Creator preview: `https://cat-certificate.vercel.app` — HTTP 200
- Engine: Phaser `4.2.1`, `Phaser.WEBGL`固定

この後の文書更新で`main`のHEADは進むため、Work開始時には最新HEAD、最新Actions、最新Vercel deploymentを再取得する。

## Verified in repository

- BootScene、FirstMeetingScene、RoomScene、DebugScene
- 部屋、影、家具、猫、前景、光の6レイヤー
- 猫と家具のCanvas内形状判定
- 23個の独立した仮ラスターテクスチャ
- 状態エンジンと8個のsystem facade
- Phaser本体のローカル固定とSHA-256検証
- 静的な`dist/`生成。`dist/`はGit管理せず、直接編集しない
- Base64素材、透明DOMホットスポット、旧`src/app.js`、rootの不要ファイルを削除
- 短い更新の繰り返しで時間経過が失われていた状態処理を修正
- 保存互換性のため、`src/state.js`のスキーマとLocalStorage keyはv6を維持

## CI WebGL validation

GitHub ActionsのChrome 151＋ANGLE SwiftShaderで以下が合格しています。

- WebGL 1.0 contextがactive、Canvasは1個、Canvas rendererへのフォールバックなし
- 320×667、393×852、430×932でアプリ外形が指定寸法と一致
- 横スクロールなし、透明DOMホットスポットなし、6レイヤー、23テクスチャ
- 393×852の夜間画面で猫の顔を目視可能
- ゆっくり撫でる → 名前パネル表示 → 既定名「こむぎ」で開始 → RoomScene → 食器 → 食事シートのタッチ導線
- JavaScript 35ファイルの構文検査、31テスト、静的ビルド

## Validation boundary

- CIはソフトウェアWebGLであり、実GPU、iOS Safari、実iPhoneではない
- SwiftShaderの診断平均は320×667で18.42fps、393×852で14.18fps、430×932で18.43fps。性能合格判定には使用しない
- 目標60fps／最低30fpsの実機基準は未合格ではなく**未検証**。実機測定が必要
- クラウド閲覧用Chromeは独立したWebGL確認サイトでもcontextを取得できず、公開URLではエラー経路だけを確認した
- 実iPhone確認、iOS Safari、バックグラウンド復帰は未実施

## Next gate

1. 最新`main`、Quality Gate、Vercel deploymentを再確認
2. 最低1台の実iPhone Safariで初回導線とRoomSceneを確認
3. 320×667、393×852、430×932相当のレイアウト証拠を揃える
4. 夜間の猫の顔、形状判定、食器・寝床・玩具への入力を確認
5. 実GPUで目標60fps、最低30fpsを確認
6. 実機情報、計測方法、スクリーンショットを記録してからv0.8へ進む

## Not complete

- Visual Bible
- 最終猫・部屋アート
- 本番リグ
- 呼吸、瞬き、耳、視線、しっぽ、姿勢遷移、歩行
- 撫でている最中の身体反応
- 食事・睡眠アニメーション
- 音、ネイティブ触覚、通知
- TestFlight、App Store版
