# Tail Room

家で猫や犬を飼えない人が、スマートフォンの中で1匹のペットと本当に暮らしていると感じられるゲームを作り、App Storeで公開するプロジェクトです。

## Work開始時に最初に読む資料

**[docs/WORK_HANDOFF.md](docs/WORK_HANDOFF.md)**

この文書が、商品方針、技術方針、現行コード、禁止事項、次の作業順序をまとめた最優先資料です。v0.7の検証根拠は[docs/V07_VALIDATION.md](docs/V07_VALIDATION.md)に分離しています。

## 現在の状態

- 現在版: Creator Preview 0.7.0
- GitHub: `2hg7trp7rv-design/Cat_room`
- ブランチ: `main`
- 制作者確認URL: `https://cat-certificate.vercel.app`
- Phaser 4.2.1を正確に固定し、ゲーム世界をWebGLキャンバスへ移行済み
- v0.7のソース、静的ビルド、CI上のソフトウェアWebGL検証は合格
- 実iPhone、iOS Safari、実GPUでの30fps下限は未確認
- 次の実装工程はv0.8「猫の生命感」。ただし最初にv0.7実機ゲートを閉じる

## v0.7で実施したこと

- BootScene、FirstMeetingScene、RoomScene、DebugSceneを実装
- 部屋、影、家具、猫、前景、光を独立レイヤー化
- 猫と家具の入力をCanvas内の形状判定へ移行
- 23個の仮ラスターパーツを個別テクスチャとして生成
- 状態エンジンとv6セーブ互換性を維持し、時刻、睡眠、成長、空腹を新描画層へ接続
- 食事、撫で、遊びの記録と思い出UIを維持
- Phaserをローカルへ固定し、ビルド時にSHA-256を検証
- Base64分割画像、透明DOMホットスポット、旧`src/app.js`、古い追跡対象`dist/`を廃止
- GitHub Actionsで3サイズ、夜間、初回導線、タッチ操作、静的成果物をWebGL検証

## 検証上の線引き

GitHub ActionsではChrome＋ANGLE SwiftShaderによるWebGL 1.0描画を確認しています。これはレイヤー、入力、画面サイズ、静的配信を検証する証拠であり、実iPhoneのGPU性能を示すものではありません。実機確認が終わるまで、v0.7を全面合格または製品完成とは扱いません。

## 次工程

最低1台の実iPhoneで描画、夜間の顔、タッチ、復帰、30fps下限を確認してv0.7実機ゲートを閉じる。その後、Visual Bibleを先に作成し、v0.8で呼吸、瞬き、耳、視線、しっぽ、姿勢遷移、歩行を実装します。
