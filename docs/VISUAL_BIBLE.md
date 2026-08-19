# Tail Room Visual Bible

更新日: 2026-08-20 JST
対象: Creator Preview 0.8.1 direct-art correction以降

## 1. 中心定義

> 温かいピクセルアートの部屋で、プレイヤーが触れていない時間にも、一匹の猫が自分の意思で暮らしている。

画面の基準は、ユーザーが確認した3枚の完成画像そのものです。生成画像を参考に別の低解像度素材へ描き直すこと、色数を減らして簡略化すること、CSS図形へ置き換えることは行いません。

この画像は限定色の厳密な旧式pixel assetではなく、細かな色変化、陰影、ディザ、半透明edgeを含む高密度pixel illustrationです。懐かしさを守ることと、画像を粗く再構成することは同義ではありません。

## 2. Direct-art正本

| Key | Runtime path | Size | Contract | SHA-256 |
|---|---|---:|---|---|
| `room` | `public/assets/game/IMG_3036.png` | 852×1846 | 完全不透明の部屋正本 | `ed17e8f3b5e6774720d3f6587cbee0531b26a9ec985c357a25922e128d0bfb1d` |
| `cat` | `public/assets/game/IMG_3037.png` | 1536×1024 | 透明背景の猫8姿勢sheet | `93daf7f3f669a89a48e1709a9568adc0cef77bedbc21b2be291b9f98840ec90e` |
| `firstMeeting` | `public/assets/game/IMG_3038.png` | 1254×1254 | 透明背景の初回ビジュアル・favicon正本 | `a1566a67ad07af7f8fc17aabab83dc2b5cf99e4cd8e12b1f481db338ab33ba54` |

原則:

- 正本PNGはbyte-for-byteで保存・配信する
- 再圧縮、palette変換、色補正、輪郭修正、alpha一括変更を行わない
- 黒く見えるsheet背景は透明であり、黒背景として描画しない
- crop rectangle、pivot、hit shape、state mapは画像を変更しないmetadataとして管理する
- 初回画面では`IMG_3038.png`を十分な大きさで直接表示する
- faviconとtouch iconも現段階では`IMG_3038.png`を直接参照し、別キャラクターへ描き直さない。将来platform固有の不透明iconが必要になった場合だけ、同画像を正本にした派生を別途検証する
- 日中visual parity検証ではtint、night wash、CSS filterを無効にする

## 3. Room source-spaceとcamera

room source-spaceは`IMG_3036.png`と同じ852×1846。world上の位置、hit area、猫anchorはこのsource-spaceで定義します。

表示はcentered coverです。整数2倍cameraは使用せず、viewportごとにfractional zoomを計算します。direct-art textureはLINEAR samplingを使用します。

| CSS viewport | Scale | Draw size | Crop |
|---:|---:|---:|---|
| 320×667 | 0.3755868545 | 320×693.33 | 上下各約13.17 CSS px |
| 393×852 | 0.4615384615 | 393.23×852 | 左右各約0.12 CSS px |
| 430×932 | 0.5048754063 | 430.15×932 | 左右各約0.08 CSS px |

393×852と430×932は実質無欠損です。320×667では上端の壁と下端の床だけを均等に切り、家具、食器、寝床、玩具を欠損させません。

全画素表示が必要な診断モードだけcontainを許可します。その場合320×667では左右各約6.08 CSS pxの余白が生じます。画像を横へ引き伸ばしたり、確認なしにoutpaintしたりしません。

## 4. 猫のexact pose contract

`IMG_3037.png`から次の8姿勢を直接表示します。rectangleはsheet上のsource pixel、pivotはrectangle内の接地点です。

| Pose | Rectangle `x,y,w,h` | Pivot `x,y` |
|---|---|---|
| `seated` | `75,116,267,342` | `95,333` |
| `standing` | `346,93,411,363` | `214,351` |
| `walking` | `763,93,410,365` | `217,357` |
| `loaf` | `1224,252,269,222` | `136,204` |
| `side-lie` | `13,665,471,220` | `237,190` |
| `curl` | `487,650,287,231` | `151,216` |
| `crouch` | `783,506,312,381` | `147,366` |
| `pounce` | `1111,500,397,370` | `93,356` |

4 source pxの透明paddingを含めています。sheet全体には低alphaの微小speckleがあるため、実行時の自動trimや全sheet alpha boundsを使用しません。

初期表示倍率はroom source-spaceに対して0.75です。この倍率では丸寝が原本の寝床へ収まり、座る・歩く・飛びつく姿勢も部屋の家具と同じ縮尺に見えることを仮合成で確認しています。成長倍率を加える場合も、全poseへ同じ基準倍率を適用します。

推奨anchor初期値:

| Role | Source-space position |
|---|---:|
| rug idle | `370,1320` |
| window watch | `430,1000` |
| bed sleep | `744,1170` |
| bowl wait | `280,1450` |
| toy / pounce target | `551,1510` |

## 5. 21 logical state map

行動controllerのlogical stateは維持します。ただし、現時点の固有作画は8姿勢であり、21種類の異なるanimationが完成したとは扱いません。

| Logical state | Exact pose |
|---|---|
| `idle`, `blink`, `ear`, `look`, `tail` | `seated` |
| `stand` | `standing` |
| `sit` | `standing`, `standing`, `seated`, `seated`, `seated`, `seated` |
| `walk` | `standing`, `walking` |
| `turn` | `standing`, `walking`, `walking`, `standing`, `standing` |
| `loaf` | `loaf` |
| `lie` | `side-lie` |
| `sleep-side-transition` | `loaf`, `loaf`, `curl`, `curl`, `side-lie`, `side-lie`, `side-lie` |
| `sleep-side` | `side-lie` |
| `sleep-curl-transition` | `loaf`, `loaf`, `side-lie`, `side-lie`, `curl`, `curl`, `curl`, `curl` |
| `sleep-curl` | `curl` |
| `play-notice` | `loaf`, `loaf`, `crouch`, `crouch` |
| `play-crouch`, `play-catch` | `crouch` |
| `play-pounce` | `pounce` |
| `play-recover` | `pounce`, `pounce`, `crouch`, `crouch`, `standing`, `standing` |
| `welcome` | `seated`, `standing`, `standing`, `seated`, `seated` |

non-loop transitionは終端poseを複数frame保持し、action完了前にsequence先頭へ巻き戻って見えないようにします。これは追加作画ではなく、8 source drawingsの表示時間を制御するmetadataです。

### Pose別の撫で領域とprop anchor

領域は各poseのfloor pivotを原点とする`x,y,w,h`です。原画向きのleftでは表のxを使用し、rightではxをmirrorします。判定優先順位は`head`、`tail`、`back`で、いずれにも入らない猫領域は`flank`です。

| Pose | Head `x,y,w,h` | Back `x,y,w,h` | Tail `x,y,w,h` |
|---|---|---|---|
| `seated` | `-80,-333,165,190` | `-64,-205,144,110` | `55,-140,117,145` |
| `standing` | `-214,-350,150,205` | `-78,-236,180,125` | `82,-351,115,184` |
| `walking` | `-217,-354,150,205` | `-82,-238,188,128` | `92,-357,101,185` |
| `loaf` | `-136,-204,130,165` | `-30,-145,112,105` | `52,-158,81,160` |
| `side-lie` | `-237,-190,145,160` | `-98,-132,215,105` | `94,-116,140,140` |
| `curl` | `-151,-204,130,160` | `-42,-132,112,105` | `20,-174,116,175` |
| `crouch` | `-147,-214,145,180` | `-30,-175,155,125` | `66,-366,99,255` |
| `pounce` | `-93,-215,150,185` | `48,-180,185,120` | `96,-356,208,215` |

`DIRECT_CAT_PROP_ANCHORS.crouch.caughtToy`はpivot相対`-104,-8`です。leftではx=-104、rightではx=+104としてmirrorし、`play-catch`中の派生toyを前足位置へ追従させます。

`stand`と`walk`は進行方向に合わせたflipを許可します。画像の縦横比を変えるscale tween、別個体の生成frameへの差し替え、cross-fadeで動きを偽装することは禁止します。

追加制作が必要な作画:

- 呼吸
- 瞬き
- 耳
- 視線
- 尻尾
- 歩行周期
- 立つ・座る・伏せる遷移
- 丸寝・横寝への遷移と寝息
- notice、crouch、pounce、catch、recoverの中割り
- 食事と撫で反応

追加frameは8 exact poseと同じ顔、目、額・背・尾の柄、体格、pixel density、光源を維持し、目視と画像差分で検査します。

## 6. 部屋と6レイヤー

完成部屋画像を直接使用しながら、ゲーム上の責務は次の6 Phaser layerへ維持します。

1. `roomLayer`: `IMG_3036.png`のdirect background
2. `shadowLayer`: 猫の接地影と必要な動的影
3. `furnitureLayer`: 動かす必要がある食器・玩具などの派生
4. `catLayer`: `IMG_3037.png`のexact pose
5. `foregroundLayer`: 寝床の前縁など、猫を自然に隠す原本由来の前景
6. `lightLayer`: 朝・夕方・夜の光、窓光、lamp glow

背景に焼き込まれている静止家具をすべて再描画・分解しません。動く必要がある場所だけ、正本由来の最小派生へ分けます。

### 現在の暫定派生と次の専用アート

- 玩具を猫が動かす場面: 境界RMSE探索と目視で選んだ原本roomの床subframe`toy-floor-cover`、rect `271,1457,92,92`をdestination `552,1493`へ`play-catch`中だけ表示する。さらに原本roomのtight crop `510,1444,88,94`をruntime canvasへ切り出し、18-point polygon clipした透明CanvasTexture `direct.toy-ball`として猫の近くへ表示する。どちらも新binaryや再生成画像ではない。本格clean plateと猫が持つ最終専用frameは今後制作する
- 寝床: 原本roomのcrop `620,1075,232,145`を10-point polygon clipした透明CanvasTexture `direct.bed-foreground`を生成し、猫より手前の`foregroundLayer`へ暫定表示する。WebGL非対応のGeometryMaskは使用しない。3サイズ・実機で遮蔽を検証し、必要なら正本準拠の最終専用アートへ置き換える
- 食器: 原本位置へ食事量を重ねる状態差分
- 時間帯: 元画像の材質と構図を壊さない朝・夕方・夜variantまたはlight layer

`DIRECT_DERIVED_TEXTURES`は上記toyとbedの2件です。両方とも同じ原画画素を透明CanvasTextureへclipするruntime派生で、別画像の生成や追加binaryではありません。

玩具を背景と猫側へ二重表示すること、猫を寝床全面の手前へ貼ることは不合格です。

## 7. UIと入力

ゲーム世界はCanvas/WebGLへ置き、名前、食事、思い出、設定、制作者メニュー、エラー表示はDOMへ残します。

猫、食器、寝床、玩具、窓はCanvas内の形状判定を使用します。透明DOMホットスポットは使用しません。画面サイズごとに別の手入力座標を持たず、room source-spaceからcamera transformで入力座標を逆変換します。

UIは画像の空いた壁・床領域を利用し、猫、寝床、食器、玩具を常時隠しません。paper cream、walnut、sage、deep tealの現行UIを基礎にしつつ、元画像の暗い木、olive、amberとの調和を優先します。

## 8. 時間帯

- 朝: 黄白色の柔らかい斜光
- 昼: `IMG_3036.png`を基準とする
- 夕方: 低いamberとterracottaの光
- 夜: 窓外の低照度と暖色の局所光

昼画像へ単純なbrightness低下だけを掛けて夜完成とは扱いません。v0.8.1最初のvisual parity gateは昼で閉じ、その後にsource-matchedな時間帯派生を制作します。

## 9. 禁止例

- 3正本PNGを参考資料へ格下げする
- 元画像を低解像度の図形、CSS、SVGへ描き直す
- procedural textureを正本画像の代わりに表示する
- 正本を再生成して似た別画像へ置き換える
- 画像全体のpaletteを減らす
- 非等方scaleで画面へ合わせる
- direct-artへNEAREST固定と整数zoomを強制し、細部を欠損させる
- AI生成した別個体の猫frameを混在させる
- 背景と猫で異なる光源・pixel densityを使用する
- 玩具を二重表示する
- 寝床の遮蔽を無視する
- 通貨、level、赤badgeで部屋を覆うUI

## 10. 合格条件

- 日中の部屋が`IMG_3036.png`と同じ構図、色、材質、密度に見える
- 8姿勢の見える画素が`IMG_3037.png`由来である
- 393×852と430×932で主要構図を欠損しない
- 320×667のcropが上下各約13.17 CSS px以内で、主要objectを欠損しない
- 猫の縮尺が全poseと全viewportで一貫する
- Canvas上の表示位置とhit位置が一致する
- room、shadow、furniture、cat、foreground、lightの順序が維持される
- day parity、玩具、寝床、state、保存を個別に検証する
- CIのsoftware WebGLと物理iPhoneの結果を区別する

8姿勢だけの段階では、瞬きや歩行animationを含む「猫の動き完成」には合格させません。暫定`toy-floor-cover`、caught toy派生、masked bed foregroundが動作しても最終完成とはせず、本格clean plate、猫が持つ最終専用frame、検証済みの寝床遮蔽がなければ遊び・睡眠の完成にも合格させません。
