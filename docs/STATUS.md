# Tail Room Status

更新日: 2026-08-18 JST

## Current

Creator Preview 0.8.0のピクセルアート、猫のmotion、温かいDOM UIはリポジトリ上で再構築済みです。SHA `0358b05bd2888ef4afa7951d924e95ababda654f`に対するGitHub ActionsとVercelの証拠を取得し、現在は**実装＋CIソフトウェアWebGLゲート合格**です。物理iPhone、iOS Safari、実GPUのhardware gateは未完です。

最優先資料: [WORK_HANDOFF.md](WORK_HANDOFF.md)

設計資料: [VISUAL_BIBLE.md](VISUAL_BIBLE.md) / [MOTION_BIBLE.md](MOTION_BIBLE.md) / [UI_SYSTEM.md](UI_SYSTEM.md)

検証詳細: [V08_VALIDATION.md](V08_VALIDATION.md)

## Source and structure checkpoint

- Application: Creator Preview `0.8.0`
- Engine: Phaser `4.2.1`、`Phaser.WEBGL`固定
- World: 216×472 art px、8pxグリッド、固定2倍zoom
- Scale: Canvasは端末CSS寸法へ`Phaser.Scale.RESIZE`
- Layers: room、shadow、furniture、cat、foreground、lightの6層
- Pixel textures: 合計131個
- Cat motion: 21状態、合計113フレーム、96×96 art px共通canvas、足元pivot固定
- Behavior: 20〜65秒のseed固定自主行動、3回連続同一選択の防止
- Sequences: 丸寝、横寝、休息、窓観察、一人遊び
- UI: paper cream、walnut、sage、deep teal基調の不透明なpixel-notch panel
- Input: 猫と主要家具はCanvas内形状判定、名前・食事・思い出・設定はDOM
- Save compatibility: `src/state.js`の`version: 6`とLocalStorage key `tail-room-state-v6`を維持

131個の内訳は、部屋・家具・影・光18個と、猫21状態・113フレームです。生成時manifestは`temporary: false`を指定し、部屋・家具・影・猫はNEAREST、分離した3枚の光maskだけはLINEARとしています。ただし、これはアート制作の完了宣言ではなく、今後も同じVisual Bibleの範囲で描き込みを改善できます。

## Implemented behavior

- 微細動作: 呼吸、瞬き、耳、視線、しっぽ
- 姿勢と移動: 立つ、座る、香箱、伏せる、歩く、向き直る
- 睡眠: 寝床へ歩く → 丸寝／横寝へのtransition → 寝息loop
- 休息: 低energy時に寝床へ移り、伏せて休む
- 一人遊び: 玩具へ歩く → 気づく → 構える → 飛びつく → 捕まえる → 戻る
- 優先順位: 睡眠、空腹、低energyをプレイヤー遊びと自主行動より優先
- 復帰安全: 長いbackground pauseで未再生animationを早送りせず、1 tickを上限100msへ制限
- QA再現性: sessionと猫名を基にしたseed、明示seedを使う単体テスト

## Evidence status

| Evidence | Status | Note |
|---|---|---|
| v0.8 source／structure | 実装済み | 131 textures、21 states／113 frames、6 layers |
| `npm run check` | 合格 | exit 0、41 JavaScript構文検査、47 tests pass |
| Runtime／evidence SHA | 確定 | `0358b05bd2888ef4afa7951d924e95ababda654f` |
| GitHub Actions Quality Gate | 合格 | [Run 52](https://github.com/2hg7trp7rv-design/Cat_room/actions/runs/32096447738)、job `95588640609`、`completed / success` |
| CI WebGL 3-size PNG | 合格 | Chrome 151＋SwiftShader、320×667、393×852、430×932、全サイズ横overflowなし |
| CI interaction | 合格 | 初回撫で→既定名`こむぎ`→Room、food、bed、toy、sleep |
| Smoke artifact | 取得済み | ID `9310114629`、`tail-room-v0.8-webgl-smoke`、2026-11-16 03:42:32 UTCまで |
| Vercel deployment | 合格 | `dpl_CB63B9ksMX3YQrF2LceQLpx1QSfv`、同じSHA、`READY / production`、`aliasError: null` |
| Canonical URL HTTP 200 | 合格 | `https://cat-certificate.vercel.app`、title `Tail Room — Creator Preview 0.8` |
| 物理iPhone／iOS Safari | `NOT TESTED` | 実機確認済みと書かない |
| 実GPU 60fps目標／30fps下限 | `NOT TESTED` | CI SwiftShader値を性能判定へ使わない |

Run 52のartifactでは、131／131 texturesがnon-empty、`temporary: false`、6 layerの順序、日本語`Tail Room JP` 400／700のloadを確認した。詳細なdigest、各interaction、Vercel応答は[V08_VALIDATION.md](V08_VALIDATION.md)を参照する。

## Next gate

1. 最低1台の実iPhone Safariで初回導線、RoomScene、夜間の顔、入力位置、復帰を確認
2. 実GPUで目標60fps／最低30fpsを計測し、機種、iOS版、測定方法、画面証拠を記録
3. 実機ゲートを閉じた後、v0.9の部位別撫で反応へ進む

## Not complete

- 物理iPhone、iOS Safari、実GPUによるv0.8 hardware gate
- 最終商品アートの描き込みと毛柄展開
- 撫でている最中の部位別身体反応、拒否、音、触覚
- 食事の接近、匂い、咀嚼、食事量アニメーション
- 複数寝床と睡眠習慣
- drag猫じゃらし、箱、袋、発見記録
- 通知、TestFlight、App Store版
