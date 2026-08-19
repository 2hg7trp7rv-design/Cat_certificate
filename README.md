# Tail Room

家で猫や犬を飼えない人が、スマートフォンの中で1匹のペットと本当に暮らしていると感じられるゲームを作り、App Storeで公開するプロジェクトです。

## Work開始時に最初に読む資料

**[docs/WORK_HANDOFF.md](docs/WORK_HANDOFF.md)**

この文書が、商品方針、技術方針、現行コード、禁止事項、次の作業順序をまとめた最優先資料です。v0.8.1 direct-art correctionの検証値と未検証境界は[docs/V08_VALIDATION.md](docs/V08_VALIDATION.md)に分離しています。

## 現在の状態

- 現在版: Creator Preview 0.8.1 direct-art correction
- GitHub: `2hg7trp7rv-design/Cat_room`
- 正式ブランチ: `main`
- 制作者確認URL: `https://cat-certificate.vercel.app`
- Phaser 4.2.1、WebGL、状態エンジン、Canvas内入力、DOM UI、保存schema v6を維持
- 画面の正本は、添付された部屋・猫・初回ビジュアルの3 PNG
- 部屋は852×1846 source-spaceで、完成画像をruntimeへ直接読み込む
- 猫は1536×1024の透明sheetから8姿勢を直接使用し、既存の21 logical stateへ割り当てる
- non-loop transitionは終端poseを保持できる長さへ拡張し、最後のframeから先頭へ巻き戻って見えないようにする
- room、shadow、furniture、cat、foreground、lightの6レイヤーを維持
- 320×667、393×852、430×932を対象にcentered coverで表示する
- fractional zoomとLINEAR samplingを使用し、元画像を低解像度の図形へ描き直さない
- 保存データは`version: 6`と`tail-room-state-v6`を維持
- v0.8.1のGitHub commit、Quality Gate、Vercel deployment、production SHA: `PENDING`

## Direct-art正本

| 用途 | Runtime path | 寸法 | SHA-256 |
|---|---|---:|---|
| 部屋 | `public/assets/game/IMG_3036.png` | 852×1846 | `ed17e8f3b5e6774720d3f6587cbee0531b26a9ec985c357a25922e128d0bfb1d` |
| 猫8姿勢 | `public/assets/game/IMG_3037.png` | 1536×1024 | `93daf7f3f669a89a48e1709a9568adc0cef77bedbc21b2be291b9f98840ec90e` |
| 初回ビジュアル・favicon正本 | `public/assets/game/IMG_3038.png` | 1254×1254 | `a1566a67ad07af7f8fc17aabab83dc2b5cf99e4cd8e12b1f481db338ab33ba54` |

3 PNGは参考資料ではなくruntimeの表示正本です。再描画、再生成、色補正、alphaの一括変更を行わず、ビルド成果物までbyte-for-byteで維持します。

## v0.8.1で修正すること

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

## 検証上の線引き

v0.8.1 direct-art correctionのCI、GitHub Actions、Vercel production、公開SHA、3サイズPNGはまだ`PENDING`です。v0.8.0のQuality Gate Run 54と旧deploymentは、旧procedural-art版の履歴であり、v0.8.1の合格証拠には使用しません。

また、猫原本に存在するのは8姿勢だけです。瞬き、耳、尻尾、呼吸、歩行周期、睡眠・遊びの中割りは未完成です。`DIRECT_DERIVED_TEXTURES`には原本roomから生成する透明CanvasTextureが2件あり、18-point polygonのcaught toyと10-point polygonのbed foregroundをWebGLで表示します。焼き込み玩具を隠す床subframeも暫定実装済みですが、本格clean plateと最終専用アートは未完成です。

物理iPhone、iOS Safari、実GPUの性能は未検証です。CI合格後も、実機確認なしに「iPhone検証済み」「実GPUで60fps」とは扱いません。

## 次工程

最初にdirect-art表示を3対象サイズで成立させ、元画像とのvisual parity、Canvas入力、状態・保存互換、暫定toy／bed派生を検証します。その後、玩具clean plate、最終専用アート、追加アニメーション中割りを制作し、CI、Vercel、物理iPhoneの順にゲートを閉じます。
