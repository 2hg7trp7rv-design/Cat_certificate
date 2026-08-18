# Tail Room

家で猫や犬を飼えない人が、スマートフォンの中で1匹のペットと本当に暮らしていると感じられるゲームを作り、App Storeで公開するプロジェクトです。

## Work開始時に最初に読む資料

**[docs/WORK_HANDOFF.md](docs/WORK_HANDOFF.md)**

この文書が、商品方針、技術方針、現行コード、禁止事項、次の作業順序をまとめた最優先資料です。v0.8の確定証拠と実機未検証の境界は[docs/V08_VALIDATION.md](docs/V08_VALIDATION.md)に分離しています。

## 現在の状態

- 現在版: Creator Preview 0.8.0
- GitHub: `2hg7trp7rv-design/Cat_room`
- 正式ブランチ: `main`
- 制作者確認URL: `https://cat-certificate.vercel.app`
- Phaser 4.2.1を固定し、WebGL世界を温かいレトロ・ピクセルアートへ再構築
- 216×472 art px、8pxグリッド、固定2倍world camera、端末寸法へ`RESIZE`
- 部屋、影、家具、猫、前景、光の6レイヤーと131個の独立テクスチャ
- 猫は21状態・113フレーム。20〜65秒間隔の自主行動、丸寝・横寝、休息、窓観察、一人遊びを実装
- DOM UIはpaper cream、walnut、sage、deep tealを基調とする温かい不透明パネルへ刷新
- 日本語UIは同梱した`Tail Room JP` 400／700を使用し、CIで両weightのloadを確認
- 保存データは`version: 6`と`tail-room-state-v6`を維持
- runtime／evidence SHA: `0358b05bd2888ef4afa7951d924e95ababda654f`
- Quality Gate: [Run 52](https://github.com/2hg7trp7rv-design/Cat_room/actions/runs/32096447738) `completed / success`
- Vercel: deployment `dpl_CB63B9ksMX3YQrF2LceQLpx1QSfv`、`READY / production`

## v0.8で作り直したこと

- 旧仮ラスターパーツを、同一パレット・同一密度のピクセルテクスチャ群へ置換
- 猫の96×96 art px共通フレームと足元pivotを固定
- 呼吸、瞬き、耳、視線、しっぽ、立つ、座る、香箱、伏せる、歩く、向き直るを実装
- `bed-sleep`で丸寝または横寝へ移る睡眠sequenceを実装
- `rug-play`で気づく、構える、飛びつく、捕まえる、戻る一人遊びsequenceを実装
- 状態エンジンの睡眠、空腹、低energyを自主行動やプレイヤー操作より優先
- seed固定で再現できる行動controllerを追加し、同じ自主行動を3回連続で選ばないようにした
- Canvas内の猫・家具入力と、名前、食事、思い出、設定のDOM UIを役割分離
- 320×667、393×852、430×932を対象とするCI WebGL smokeをv0.8仕様へ更新

設計根拠は[Visual Bible](docs/VISUAL_BIBLE.md)、[Motion Bible](docs/MOTION_BIBLE.md)、[UI System](docs/UI_SYSTEM.md)、[Implementation Contract](docs/V08_IMPLEMENTATION.md)を参照してください。

## 検証上の線引き

v0.8は**実装＋CIソフトウェアWebGLゲート合格**です。SHA `0358b05bd2888ef4afa7951d924e95ababda654f`に対し、`npm run check`（41 JavaScript構文検査・47 tests）、GitHub Actions Quality Gate Run 52、320×667／393×852／430×932のWebGL smokeとPNGが合格しました。131 texturesはすべてnon-empty、6 layerの順序、横overflowなし、初回導線、食事、寝床、玩具、睡眠sequenceも確認済みです。

同じSHAのVercel deployment `dpl_CB63B9ksMX3YQrF2LceQLpx1QSfv`は`READY / production`で、正本URLはHTTP 200を返しました。詳細、artifact ID／digest、失敗履歴は[docs/V08_VALIDATION.md](docs/V08_VALIDATION.md)を参照してください。

CIはChrome 151＋ANGLE SwiftShaderによるソフトウェアWebGLです。合格しても、実iPhone、iOS Safari、実GPUの性能を証明したことにはなりません。物理iPhoneでの初回導線、タッチ、夜間視認性、バックグラウンド復帰、目標60fps／最低30fpsは`NOT TESTED`です。

## 次工程

最低1台の実iPhoneで実機ゲートを先に閉じます。iOS Safari、入力位置、夜間視認性、バックグラウンド復帰、実GPU fpsを記録した後、v0.9の部位別撫で反応へ進みます。
