# Tail Room Visual Bible

更新日: 2026-08-18 JST  
対象: Creator Preview 0.8以降

## 1. 中心定義

> 温かいピクセルアートの部屋で、プレイヤーが触れていない時間にも、一匹の猫が自分の意思で暮らしている。

懐かしさはCRTフィルターや粗さではなく、限定パレット、読みやすいシルエット、丁寧なピクセル配置、静かな間で作る。写真、3D、滑らかなベクター、旧ペイント調素材を混在させない。

## 2. 基準グリッド

- 原画は1倍のアートピクセルで制作する
- 基本タイルは8×8 art px
- Phaser Canvasは端末のCSSピクセル寸法へ`RESIZE`する
- world cameraは全対象画面で2倍固定
- 共通安全域は160×328 art px
- 最大Room boundsは216×472 art px
- 猫、主要家具、全hit areaは共通安全域へ入れる
- 大画面では猫を拡大せず、壁、床、光、小物が多く見える
- 静止物と画面に現れるworld view原点は整数art pxへ配置する
- 猫の移動だけ0.5 art px刻みまで許可する

対象表示:

| CSS viewport | world view |
|---:|---:|
| 320×667 | 160×333.5 art px |
| 393×852 | 196.5×426 art px |
| 430×932 | 215×466 art px |

右端または下端に生じる半端な1 CSS pxは背景だけで吸収する。猫、家具、影、hit areaへ半端な拡大を適用しない。

## 3. パレット

| 役割 | 色 |
|---|---|
| Paper cream | `#F5E6C8` |
| Ink cocoa | `#2A211B` |
| Walnut | `#8C5E3E` |
| Terracotta | `#C87352` |
| Sage | `#789279` |
| Deep teal | `#3F625E` |
| Amber | `#E2B45C` |
| Night navy | `#26374B` |

輪郭は真っ黒へ統一しない。猫はcocoa、木は濃いwalnut、夜の外景はnight navyを使う。1素材は原則4段階の明暗ランプに収める。

## 4. 猫

- 共通frame canvasは96×96 art px
- 全姿勢で足元pivotを固定する
- 実シルエットは概ね64〜80 art pxへ収める
- クリームと生姜色の共通猫を基準とする
- 額、背、尾の柄を全frameで維持する
- 目を巨大化せず、耳、背中、尾、足で感情を読ませる
- 歩行中にscaleを変更しない
- 輪郭が変わる動作は専用frameで描く
- 全身の拡大縮小を呼吸や撫で反応に使わない

基準姿勢:

- seated attentive
- standing side
- walk left/right
- loaf
- lie side
- curl sleep
- crouch
- pounce

参考画像は`docs/art/v08-cat-pose-reference.png`。これは画風と体型の参照であり、そのままruntimeへ貼らない。

## 5. 部屋

部屋は猫の行動先であり、背景ではない。最低限以下を独立させる。

1. 外景
2. 壁と床
3. 窓
4. カーテン
5. 家具
6. 玩具、食器、寝床
7. 接地影
8. 猫
9. 前景
10. 窓光、ランプ光、夜wash

家具は8px単位のモジュールとして描く。猫の移動余白を優先し、装飾で床を埋めない。参考画像は`docs/art/v08-room-concept.png`。構図と素材感の参照であり、家具を焼き込んだ一枚絵として配信しない。

## 6. 時間帯

- 朝: 黄白色の斜光、低いコントラスト
- 昼: クリーム色の拡散光
- 夕方: terracottaとamberの長い影
- 夜: night navyの外光とamberの局所光

昼画像へbrightnessフィルターを掛けて夜にしない。世界用pixel textureはNEAREST、光とglowは別textureだけLINEARを許可する。

## 7. 禁止例

- 現在の仮素材へモザイクを掛けただけの画像
- SVG、CSS図形、楕円だけで完成扱いした猫
- 猫と家具を背景へ焼き込む
- AI生成した別個体の猫frameを切り貼りする
- 常に正面を向く猫
- 全身scale tweenによる呼吸
- CRT走査線、色収差、強いvignette
- 写実的なblur shadowとpixel artの混在
- 通貨、level、赤badgeで部屋を覆うUI

## 8. 合格条件

- 3対象サイズで完全なart pixelが2×2 CSS pxで表示される
- 猫の顔、耳、足、尾の向きが320×667の夜でも読める
- 猫、家具、影、光が同じpixel densityに見える
- 猫と主要家具の位置・大きさが画面サイズで変わらない
- 画面を静止しても、色、材質、奥行きが仮素材に見えない
