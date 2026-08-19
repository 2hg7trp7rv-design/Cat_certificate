# Tail Room Status

更新日: 2026-08-20 JST

## Current

現行正本は**Creator Preview 0.8.1 direct-art correction**です。

旧v0.8.0は、生成した完成画像を参考資料として扱い、低解像度のprocedural pixel textureへ描き直したため、ユーザーが確認したイメージ画像とかけ離れました。v0.8.1ではその前提を撤回し、添付された3 PNGをruntimeの表示正本として直接使用します。

Phaser 4.2.1、WebGL、6レイヤー、Canvas内形状判定、状態エンジン、DOM UI、保存schema v6は維持します。描画資産とcamera contractだけをdirect-art仕様へ置き換えます。

最優先資料: [WORK_HANDOFF.md](WORK_HANDOFF.md)

設計資料: [VISUAL_BIBLE.md](VISUAL_BIBLE.md) / [MOTION_BIBLE.md](MOTION_BIBLE.md) / [UI_SYSTEM.md](UI_SYSTEM.md)

検証詳細: [V08_VALIDATION.md](V08_VALIDATION.md)

## Direct-art source contract

| Key | Runtime path | Size | Alpha | SHA-256 |
|---|---|---:|---|---|
| room | `public/assets/game/IMG_3036.png` | 852×1846 | 全画素不透明 | `ed17e8f3b5e6774720d3f6587cbee0531b26a9ec985c357a25922e128d0bfb1d` |
| cat | `public/assets/game/IMG_3037.png` | 1536×1024 | 黒地は透明 | `93daf7f3f669a89a48e1709a9568adc0cef77bedbc21b2be291b9f98840ec90e` |
| first meeting / favicon source | `public/assets/game/IMG_3038.png` | 1254×1254 | 黒地は透明 | `a1566a67ad07af7f8fc17aabab83dc2b5cf99e4cd8e12b1f481db338ab33ba54` |

正本PNGは再圧縮、再生成、色補正、輪郭修正、alpha一括変更を行いません。pose frame、pivot、state mapは画像を変えないmetadataとして管理します。

## Source and structure checkpoint

- Application: Creator Preview `0.8.1`
- Engine: Phaser `4.2.1`、`Phaser.WEBGL`固定
- Room source-space: 852×1846
- Camera: centered cover、fractional zoom
- Texture sampling: direct-artはLINEAR
- Scale: `Phaser.Scale.NONE`。CanvasのCSS寸法はviewportへ一致させ、backing storeは端末DPRを最大2倍まで反映
- Target sizes: 320×667、393×852、430×932
- Layers: room、shadow、furniture、cat、foreground、lightの6層
- Cat source: 8 exact poses、21 logical states
- Petting metadata: 8姿勢ごとに`head`、`back`、`tail`のpivot相対領域を持ち、facingに合わせてxをmirror
- Prop metadata: crouchのcaught toy paw anchorはpivot相対`-104,-8`、facingに合わせてxをmirror
- Derived textures: 原本room由来の透明CanvasTexture 2件。`direct.toy-ball`は18-point polygon clip、`direct.bed-foreground`は10-point polygon clip
- Toy floor cover: source rect `271,1457,92,92`をdestination `552,1493`へ表示
- Input: 猫と主要家具はCanvas内形状判定、名前・食事・思い出・設定はDOM
- Behavior: 状態優先、自主行動、睡眠・遊びsequenceの論理を維持
- Save compatibility: `src/state.js`の`version: 6`とLocalStorage key `tail-room-state-v6`を維持

### Responsive result

| CSS viewport | centered cover result |
|---:|---|
| 320×667 | draw 320×693.33、上下各約13.17 CSS px crop |
| 393×852 | draw 393.23×852、左右各約0.12 CSS px crop |
| 430×932 | draw 430.15×932、左右各約0.08 CSS px crop |

393×852と430×932は実質無欠損です。320×667で切れるのは画像上端・下端の壁と床で、主要家具、食器、寝床、玩具は保持されます。

## Cat pose checkpoint

原本sheetの8姿勢は以下です。

1. seated
2. standing
3. walking
4. loaf
5. side-lie
6. curl
7. crouch
8. pounce

logical state map:

- `idle`, `blink`, `ear`, `look`, `tail` → `seated`
- `stand` → `standing`
- `sit` → `standing`, `standing`, `seated`, `seated`, `seated`, `seated`
- `walk` → `standing`, `walking`
- `turn` → `standing`, `walking`, `walking`, `standing`, `standing`
- `loaf` → `loaf`
- `lie` → `side-lie`
- `sleep-side-transition` → `loaf`, `loaf`, `curl`, `curl`, `side-lie`, `side-lie`, `side-lie`
- `sleep-side` → `side-lie`
- `sleep-curl-transition` → `loaf`, `loaf`, `side-lie`, `side-lie`, `curl`, `curl`, `curl`, `curl`
- `sleep-curl` → `curl`
- `play-notice` → `loaf`, `loaf`, `crouch`, `crouch`
- `play-crouch`, `play-catch` → `crouch`
- `play-pounce` → `pounce`
- `play-recover` → `pounce`, `pounce`, `crouch`, `crouch`, `standing`, `standing`
- `welcome` → `seated`, `standing`, `standing`, `seated`, `seated`

これは21種類の異なる作画が完成したという意味ではありません。現時点の固有作画は8姿勢です。non-loop transitionは終端poseを複数frame保持し、sequence末尾から先頭へ巻き戻って見える前にactionを完了させます。

## Evidence status

| Evidence | Status | Note |
|---|---|---|
| v0.8.1 direct-art source | `PASSED` | `ad4b58d92c23f57950c823a06125a193fbc3cb3c` |
| PNG byte parity | `PASSED` | public、dist、productionの3 PNGが正本SHAと一致 |
| `npm --offline run check` | `PASSED` | JavaScript 45件、tests 69／69 |
| GitHub Actions Quality Gate | `PASSED` | Run 61、ID `32287376527`、job `96180005338`、全step success |
| CI WebGL 3-size PNG | `PASSED` | 3サイズはDPR 1、393×852は追加でDPR 2／3のbacking／inputを検査 |
| Visual parity | `PASSED` | 日中背景、8 exact pose、left flipを原本と照合 |
| Canvas interaction | `PASSED` | cat slow drag、food、bed、toyを実入力。windowはCanvas hit boundsの登録・可視範囲を検査。pose別pet zoneとcaught toy anchorも検査 |
| Save schema v6 | `PASSED` | schemaと`tail-room-state-v6`を維持 |
| Vercel deployment | `PASSED` | `dpl_2Qjt6Eo12io6LkAMqD9uUPhxn8fH`、`READY`、`aliasError: null`、source SHA一致 |
| Canonical URL | `PASSED` | `https://cat-certificate.vercel.app`、title v0.8.1、`/build-meta.json`、3 PNGがHTTP 200 |
| 物理iPhone／iOS Safari | `NOT TESTED` | 実機確認済みと書かない |
| 実GPU 60fps目標／30fps下限 | `NOT TESTED` | CI software rendererを性能判定へ使わない |

smoke artifactはID `9378229129`、名称`tail-room-v0.8.1-webgl-smoke`、digest `sha256:f480afa437bad9879106c9a82c87c7aee1466f2f50ebc732c071b9717109b15b`、size 18,014,821 bytes、expiry `2026-11-17T18:26:48Z`です。`report.status=passed`で、玩具のpounce画像SHA `55eb525e392a87ffef93fb4491d097cf8cc3ea937fc78f8924521d3725888da9`とcatch画像SHA `a17345a10cced4679735b61b820b55ee3300e20c38acd5b700ed298fd632cd5c`は異なり、それぞれの状態を目視確認済みです。

dist artifactはID `9378143969`、digest `sha256:92c13645d800062dea2ccaad76ff786650c93f18bb55f1b025798c8902f91cb7`、expiry `2026-08-26T18:27:00Z`です。CI環境はChrome `151.0.7922.137`、ChromeDriver `151.0.7922.138`、SwiftShaderであり、software WebGLの診断証拠に限定します。

旧Quality Gate Run 54と旧Vercel deploymentはv0.8.0 procedural-art版の履歴です。v0.8.1 direct-art correctionの合格証拠には使用しません。

## Next gate

1. 物理iPhone／iOS Safariで表示、入力、background復帰、実GPU fpsを検証
2. 暫定`toy-floor-cover`、caught toy派生、masked bed foregroundを本格clean plateと最終専用アートへ置換
3. 猫の追加中割りを制作し、8姿勢を21 logical stateへ仮割当している箇所を段階的に解消
4. 朝、夕方、夜のsource-matched artと、食事・撫で反応を制作

## Not complete

- 8姿勢以外の瞬き、耳、尻尾、呼吸、歩行周期、姿勢遷移
- 同じroom textureの隣接床subframeによる暫定`toy-floor-cover`と、crop `510,1444,88,94`を18-point polygon clipした透明CanvasTexture `direct.toy-ball`は実装済みだが、本格clean plateと猫が持つ最終専用frameは未完成
- crop `620,1075,232,145`を10-point polygon clipした透明CanvasTexture `direct.bed-foreground`は3サイズのCIで検証済みだが、物理実機での遮蔽検証と最終専用アートは未完成。WebGL非対応のGeometryMaskは使用しない
- 朝、夕方、夜のdirect-art派生
- 食事の接近、匂い、咀嚼、量減少
- 撫でている最中の部位別身体反応、拒否、音、触覚
- 物理iPhone、iOS Safari、実GPUによるhardware gate
- 通知、TestFlight、App Store版
