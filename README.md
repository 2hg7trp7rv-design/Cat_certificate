# Tail Room

家で猫や犬を飼えない人が、スマートフォンの中で1匹のペットと本当に暮らしていると感じられるゲームを作り、App Storeで公開するプロジェクトです。

## Work開始時に最初に読む資料

**[docs/WORK_HANDOFF.md](docs/WORK_HANDOFF.md)**

この文書が、商品方針、技術方針、現行コード、禁止事項、次の作業順序をまとめた最優先資料です。v0.8.2 motionの検証値と未完成境界は[docs/V082_MOTION_VALIDATION.md](docs/V082_MOTION_VALIDATION.md)、v0.8.1 direct-art correctionの履歴は[docs/V08_VALIDATION.md](docs/V08_VALIDATION.md)に分離しています。

## 現在の状態

- 現在版: Creator Preview 0.8.2 source-locked motion scaffold
- GitHub: `2hg7trp7rv-design/Cat_room`
- 正式ブランチ: `main`
- 制作者確認URL: `https://cat-certificate.vercel.app`
- Phaser 4.2.1、WebGL、状態エンジン、Canvas内入力、DOM UI、保存schema v6を維持
- 画面の正本は、添付された部屋・猫・初回ビジュアルの3 PNG
- 部屋は852×1846 source-spaceで、完成画像をruntimeへ直接読み込む
- 猫は1536×1024の透明sheetから8姿勢を直接使用し、既存の21 logical stateへ割り当てる
- 座りpose由来の別atlasで半瞬き・閉眼・尻尾body／partを追加し、承認済みsheet自体は変更しない
- root motionで歩行の接地感、遊びの溜め、pounceの跳躍を加える
- non-loop transitionは終端poseを保持できる長さへ拡張し、最後のframeから先頭へ巻き戻って見えないようにする
- room、shadow、furniture、cat、foreground、lightの6レイヤーを維持
- 320×667、393×852、430×932を対象にcentered coverで表示する
- fractional zoomとLINEAR samplingを使用し、元画像を低解像度の図形へ描き直さない
- 保存データは`version: 6`と`tail-room-state-v6`を維持
- 検証済みruntime source commit: `fc96a038950ff26303ca13653924130719f18fdc`
- GitHub Quality Gate: Run 64（ID `32346017409`、job `96354829054`）`completed / success`
- Vercel production: `dpl_FKVNJvaNPKnzVEYRcKd8UoutXbKF`、`READY`、`aliasError: null`、source SHA一致

## Direct-art正本

| 用途 | Runtime path | 寸法 | SHA-256 |
|---|---|---:|---|
| 部屋 | `public/assets/game/IMG_3036.png` | 852×1846 | `ed17e8f3b5e6774720d3f6587cbee0531b26a9ec985c357a25922e128d0bfb1d` |
| 猫8姿勢 | `public/assets/game/IMG_3037.png` | 1536×1024 | `93daf7f3f669a89a48e1709a9568adc0cef77bedbc21b2be291b9f98840ec90e` |
| 初回ビジュアル・favicon正本 | `public/assets/game/IMG_3038.png` | 1254×1254 | `a1566a67ad07af7f8fc17aabab83dc2b5cf99e4cd8e12b1f481db338ab33ba54` |

3 PNGは参考資料ではなくruntimeの表示正本です。再描画、再生成、色補正、alphaの一括変更を行わず、ビルド成果物までbyte-for-byteで維持します。

## v0.8.2補助motion

| 用途 | Runtime path | 寸法 | SHA-256 |
|---|---|---:|---|
| 半瞬き・閉眼・尻尾body／part | `public/assets/game/motion/v0.8.2/cat-micro.png` | 1216×896 | `37a224e222d093a70cd4c776674223a31f434bd7462ac68d249942c949866ef4` |

補助atlasは`IMG_3037.png`のseated rectから作るsource-locked supplementです。元の3 PNGを上書きせず、別manifestと別texture keyで管理します。AI生成した追加frame候補2件は、実alphaでないcheckerboardと猫の同一性崩れを理由に不採用とし、runtimeへ入れていません。

## v0.8.1で修正したこと（維持）

- 生成した部屋画像を、簡略化した図形へ描き直さずそのまま背景へ使用
- 生成した猫sheetを8個のexact poseとして使用
- 8姿勢を`idle`から`welcome`までの21 logical stateへ割り当て
- 部屋source-space上の接地点とposeごとのpivotを固定
- 393×852と430×932では実質無欠損、320×667では上下各約13.17 CSS pxだけをcenter crop
- 初回画面、favicon、touch iconへ`IMG_3038.png`を直接使用
- 猫、寝床、食器、玩具、窓はCanvas内の形状判定を維持
- 撫で判定は8姿勢ごとの`head`／`back`／`tail`領域を使い、向きに合わせて左右反転する
- `play-catch`のtoyはcrouch poseのpaw anchor `-104,-8`へ追従し、猫の向きに合わせて左右反転する
- 名前、食事、思い出、設定はDOM UIを維持

## v0.8.2で追加したこと

- `half → closed → closed → half`の2段階瞬き
- seated sourceをpixel差0でbody／tailへpartitionし、尾先を`[0,-2,-4,4,2,0]`度で小さく動かす
- walking rootは最大2 px、play-pounceは最大24 px上へ動かし、非uniform scaleとcross-fadeを使わない
- 撫で反応の`reactionRoot`と生活動作の`motionRoot`を分離
- 透明atlas guardと非表示spriteを可視boundsへ含めない
- QA bridgeから個別frameをseekし、瞬き2枚、尻尾2枚、pounce頂点を独立capture

## 検証上の線引き

v0.8.2 source-locked motion scaffoldのsoftware gateは合格です。local gateは49件のJavaScript構文検査と75／75 tests、Quality Gate Run 64は全step successです。3対象サイズ、DPR 1／2／3、日中背景、8 exact pose、left flip、Canvas入力、初回導線、食事、寝床、玩具、睡眠に加え、瞬き2段階、尻尾両方向、pounce頂点を検証しました。smoke artifactはID `9398120243`、`report.status=passed`、`motionArt.status=passed`です。Vercel deployment `dpl_FKVNJvaNPKnzVEYRcKd8UoutXbKF`は同一source SHAで`READY`、canonical URL、`/build-meta.json`、3正本PNGと補助atlasがHTTP 200・SHA一致です。

ただし、固有の全身作画は現在も原本8姿勢です。瞬き2 frameと尻尾2 componentは追加済みですが、耳、視線、呼吸、6 frame以上の歩行周期、睡眠・遊びの最終中割りは未完成です。transform-onlyの動きを最終animation完成とは扱いません。`DIRECT_DERIVED_TEXTURES`には原本roomから生成する透明CanvasTextureが2件あり、18-point polygonのcaught toyと10-point polygonのbed foregroundをWebGLで表示します。焼き込み玩具を隠す床subframeも暫定実装済みですが、本格clean plateと最終専用アートは未完成です。

物理iPhone、iOS Safari、実GPUの性能は未検証です。CIはChrome 151／ChromeDriver 151とSwiftShaderによるsoftware WebGL診断であり、実機確認なしに「iPhone検証済み」「実GPUで60fps」とは扱いません。

## 次工程

次は正本と同じ顔・柄・体格・pixel densityを保つ歩行中割りを最優先で制作します。その後に睡眠、遊び、食事、撫で反応を増やし、並行して物理iPhone／iOS Safari／実GPUのhardware gateを実施します。
