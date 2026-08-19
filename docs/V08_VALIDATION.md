# Tail Room v0.8.1 Direct-art Validation

更新日: 2026-08-20 JST
対象: Creator Preview 0.8.1 direct-art correction

## 1. 現在の判定

現在の判定は**v0.8.1 software gate PASSED／hardware gate OPEN**です。

ユーザー承認済みの部屋、猫、初回ビジュアルをruntimeへ直接使用する方針へ修正しました。Phaser 4.2.1 WebGL、6レイヤー、Canvas内形状判定、状態エンジン、DOM UI、保存schema v6は維持します。

検証済みsource commitは`ad4b58d92c23f57950c823a06125a193fbc3cb3c`です。local quality gate、GitHub Actions Quality Gate Run 61、3対象サイズのDPR 1と393×852のDPR 2／3によるWebGL smoke、direct-art visual parity、Vercel production、canonical URLと3正本PNGの公開SHAまで同一sourceで確認しました。旧v0.8.0のQuality Gate Run 54と旧deploymentはprocedural-art版の履歴であり、今回の合格証拠には使用しません。

物理iPhone、iOS Safari、hardware GPU性能も`NOT TESTED`です。

## 2. Direct-art source contract

| Key | Runtime path | Dimensions | SHA-256 |
|---|---|---:|---|
| room | `public/assets/game/IMG_3036.png` | 852×1846 RGBA | `ed17e8f3b5e6774720d3f6587cbee0531b26a9ec985c357a25922e128d0bfb1d` |
| cat | `public/assets/game/IMG_3037.png` | 1536×1024 RGBA | `93daf7f3f669a89a48e1709a9568adc0cef77bedbc21b2be291b9f98840ec90e` |
| brand | `public/assets/game/IMG_3038.png` | 1254×1254 RGBA | `a1566a67ad07af7f8fc17aabab83dc2b5cf99e4cd8e12b1f481db338ab33ba54` |

契約:

- 3 PNGをbyte-for-byteで`dist/assets/game/`へコピーする
- build時に寸法とSHAを検査する
- runtimeはローカルPNGだけをpreloadし、GitHub/CDNから取得しない
- roomとcatを再生成・再描画・色補正しない
- catの黒地とbrandの黒地は透明として扱う
- direct-art textureはLINEAR samplingを使用する
- day parity検査ではtintと時間帯overlayを無効にする

## 3. Runtime structure contract

| Item | v0.8.1 contract |
|---|---|
| App version | `0.8.1` |
| Engine | Phaser `4.2.1`、WebGL固定 |
| Room source-space | 852×1846 |
| Camera | centered cover、fractional zoom |
| Canvas scale | `Phaser.Scale.NONE`、CSSはviewport実寸、backing storeはDPR最大2倍 |
| World layers | room、shadow、furniture、cat、foreground、light |
| Cat art | 8 exact poses |
| Behavior interface | 21 logical states |
| Derived textures | 原本room由来の透明CanvasTexture 2件 |
| Cat base scale | 0.75 |
| Input | Canvas内形状判定 |
| Save schema | `version: 6` |
| LocalStorage key | `tail-room-state-v6` |

状態と保存の意味は変更しません。描画版を0.8.1へ上げることを理由に保存schemaを変更しません。

## 4. Responsive camera contract

| CSS viewport | Zoom | Draw size | Expected crop |
|---:|---:|---:|---|
| 320×667 | 0.3755868545 | 320×693.33 | 上下各約13.17 CSS px |
| 393×852 | 0.4615384615 | 393.23×852 | 左右各約0.12 CSS px |
| 430×932 | 0.5048754063 | 430.15×932 | 左右各約0.08 CSS px |

393×852と430×932は実質無欠損です。320×667では上下の壁・床だけが切れ、窓、棚、sofa、rug、寝床、食器、玩具は欠損しないことをPNGで確認します。

## 5. Cat pose and logical-state contract

exact pose:

| Pose | Rect `x,y,w,h` | Pivot `x,y` |
|---|---|---|
| `seated` | `75,116,267,342` | `95,333` |
| `standing` | `346,93,411,363` | `214,351` |
| `walking` | `763,93,410,365` | `217,357` |
| `loaf` | `1224,252,269,222` | `136,204` |
| `side-lie` | `13,665,471,220` | `237,190` |
| `curl` | `487,650,287,231` | `151,216` |
| `crouch` | `783,506,312,381` | `147,366` |
| `pounce` | `1111,500,397,370` | `93,356` |

logical state sequence:

- `idle`, `blink`, `ear`, `look`, `tail` → `seated`
- `stand` → `standing`
- `sit` → `standing`, `standing`, `seated`, `seated`, `seated`, `seated`
- `loaf` → `loaf`
- `lie` → `side-lie`
- `walk` → `standing`, `walking`
- `turn` → `standing`, `walking`, `walking`, `standing`, `standing`
- `sleep-curl-transition` → `loaf`, `loaf`, `side-lie`, `side-lie`, `curl`, `curl`, `curl`, `curl`
- `sleep-curl` → `curl`
- `sleep-side-transition` → `loaf`, `loaf`, `curl`, `curl`, `side-lie`, `side-lie`, `side-lie`
- `sleep-side` → `side-lie`
- `play-notice` → `loaf`, `loaf`, `crouch`, `crouch`
- `play-crouch` → `crouch`
- `play-pounce` → `pounce`
- `play-catch` → `crouch`
- `play-recover` → `pounce`, `pounce`, `crouch`, `crouch`, `standing`, `standing`
- `welcome` → `seated`, `standing`, `standing`, `seated`, `seated`

21 stateの時間・順序は維持しますが、固有作画は8姿勢です。non-loop transitionは終端poseを保持できる長さへ拡張し、action完了前に先頭へ巻き戻って見えないようにします。同じposeを複数回表示しても追加frame完成とは数えません。

### Pose-local input and prop metadata

`DIRECT_CAT_PET_ZONES`は各poseのfloor pivot相対`x,y,w,h`です。8姿勢すべてに`head`、`back`、`tail`を定義し、leftは表のx、rightはmirrorしたxで判定します。

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

`DIRECT_CAT_PROP_ANCHORS.crouch.caughtToy`はpivot相対`-104,-8`です。leftではx=-104、rightではx=+104へmirrorし、`play-catch`中の派生toyを前足へ追従させます。

## 6. Room interaction and layering contract

source-space anchor:

| Anchor | Position |
|---|---:|
| `center-idle` / `carrier` | `370,1320` |
| `rug-play` | `551,1510` |
| `bed-sleep` | `744,1170` |
| `bowl-wait` | `280,1450` |
| `window-watch` | `430,1000` |

room、shadow、furniture、cat、foreground、lightの6 layer順を維持します。猫、食器、寝床、玩具、窓はCanvas内の形状判定を使い、透明DOM hotspotへ戻しません。

原本roomには玩具が焼き込まれています。v0.8.1 runtimeは境界RMSE探索と目視で選んだ同じroom textureの床subframe`toy-floor-cover`、rect `271,1457,92,92`を登録し、destination `552,1493`へ`play-catch`中だけ表示して焼き込み玩具を隠します。同時に原本roomのtight crop `510,1444,88,94`をruntime canvasへ切り出し、18-point polygon clipした透明CanvasTexture `direct.toy-ball`を猫の近くへ表示します。新しいbinaryや再生成画像は使いません。

寝床には原本roomのcrop `620,1075,232,145`を10-point polygon clipした透明CanvasTexture `direct.bed-foreground`を実装済みです。WebGL非対応のGeometryMaskは使いません。`DIRECT_DERIVED_TEXTURES`はこのbed foregroundとcaught toyの2件です。ただし、本格的な玩具なしclean plate、玩具を咥えた最終専用cat frame、検証済みの最終寝床アートは未完成です。暫定派生が動作しても、遊び・睡眠の最終アート完成とは判定しません。

## 7. Automated evidence

| Evidence | Result | Required result |
|---|---|---|
| Validated source commit | `PASSED` — `ad4b58d92c23f57950c823a06125a193fbc3cb3c` | v0.8.1の単一SHAを記録 |
| Source PNG SHA | `PASSED` — 3 filesがsource contractと一致 | 3 filesがsource contractと一致 |
| Dist PNG SHA | `PASSED` — sourceとbyte-for-byte一致 | sourceとbyte-for-byte一致 |
| Local quality gate | `PASSED` — `npm --offline run check`、JavaScript 45件、tests 69／69 | `npm run check` exit 0 |
| GitHub Actions | `PASSED` — Run 61、ID `32287376527`、job `96180005338`、全step success | 新Quality Gate `completed / success` |
| WebGL renderer | `PASSED` — Chrome `151.0.7922.137`／ChromeDriver `151.0.7922.138`／SwiftShader | fallbackなし、context lossなし |
| Direct-art preload | `PASSED` — 3 files、寸法、8 pose frame | 3 files、寸法、pose frameを確認 |
| Layer order | `PASSED` — room、shadow、furniture、cat、foreground、light | 6 layer順一致 |
| Pose pet zones | `PASSED` — 8 poseとleft flip | 8 poseのhead／back／tailと左右mirror一致 |
| First meeting | `PASSED` — `IMG_3038.png`、ゆっくり撫でる、名前パネル表示、既定名「こむぎ」で開始、Room遷移 | `IMG_3038.png`、撫で、名前パネル、Room遷移 |
| Canvas input | `PASSED` — cat slow drag、food、bed、toyを実入力。windowはCanvas hit boundsの登録・可視範囲を検査 | cat、food、bed、toyの実入力とwindow hit geometry |
| Toy cover / caught toy | `PASSED` — cover、paw anchor mirror、二重表示防止 | catch中だけ床coverと派生ballへ切り替わり、paw anchorをmirrorし、二重表示されない |
| Sleep placement / foreground | `PASSED` — curl、bed、masked foreground | curlがbedへ収まり、masked foregroundが正しく遮蔽する |
| 320×667 | `PASSED` — CSS viewport PNG | crop・overflow・input一致 |
| 393×852 | `PASSED` — CSS viewport PNG | visual parity・input一致 |
| 430×932 | `PASSED` — CSS viewport PNG | visual parity・input一致 |
| DPR 1／2／3 | `PASSED` — 3サイズはDPR 1、393×852はDPR 2／3でもbacking storeとCanvas inputを検証 | 高DPRでもCSS座標とrender座標が一致 |
| Smoke artifact | `PASSED` — ID `9378229129`、`report.status=passed` | reportとPNGを保存 |

smoke artifactの名称は`tail-room-v0.8.1-webgl-smoke`、digestは`sha256:f480afa437bad9879106c9a82c87c7aee1466f2f50ebc732c071b9717109b15b`、sizeは18,014,821 bytes、expiryは`2026-11-17T18:26:48Z`です。玩具のpounce screenshot SHAは`55eb525e392a87ffef93fb4491d097cf8cc3ea937fc78f8924521d3725888da9`、catch screenshot SHAは`a17345a10cced4679735b61b820b55ee3300e20c38acd5b700ed298fd632cd5c`で、byte単位でも異なり、pounceとcatchの表示を目視確認済みです。

dist artifactはID `9378143969`、digest `sha256:92c13645d800062dea2ccaad76ff786650c93f18bb55f1b025798c8902f91cb7`、expiry `2026-08-26T18:27:00Z`です。

CI screenshotはSwiftShaderによるsoftware WebGLの診断証拠です。mobile UA、物理iPhone、iOS Safari、hardware GPU性能の証拠とは区別します。

## 8. Historical boundary

旧v0.8.0ではQuality Gate Run 54とVercel deploymentが成功しました。しかし対象は、承認画像をruntimeへ使わないprocedural-art実装です。そのため次の値は履歴としてのみ残し、v0.8.1の判定へ流用しません。

- old runtime/evidence SHA: `26935545f03c11df63bc6ddc4a929ec9bab53ee3`
- old Quality Gate: Run 54
- old deployment: `dpl_H2kVdQKouknE9S76azQ27vk9iKGx`
- old artifact: `9310409064`

旧版がCIに合格したことは、direct-art版のasset load、camera、visual parity、hit位置、性能を証明しません。

## 9. Vercel evidence

| Evidence | Result |
|---|---|
| Project | `cats-room` / `prj_x77pFkTy2D8nBYq0QKDZZtV59Bz3` |
| Canonical URL | `https://cat-certificate.vercel.app` |
| v0.8.1 deployment ID | `dpl_2Qjt6Eo12io6LkAMqD9uUPhxn8fH` |
| v0.8.1 deployment state | `READY`、production、`aliasError: null` |
| Served GitHub SHA | `ad4b58d92c23f57950c823a06125a193fbc3cb3c` |
| Canonical root | HTTP 200、title v0.8.1 |
| `/build-meta.json` | HTTP 200、direct-art sourceを確認 |
| Three direct PNG HTTP response | 3 filesすべてHTTP 200、source contractのSHAと一致 |

URLがHTTP 200でも、served SHAとasset SHAが一致するまでv0.8.1 production合格とは扱いません。

## 10. Physical-device boundary

### 未実施

- 物理iPhoneでのFirstMeetingSceneとRoomScene
- iOS SafariでのWebGL描画
- fractional zoomとLINEAR samplingの見え方
- ゆっくり撫でる入力とtapの区別
- 猫、食器、寝床、玩具、窓の表示位置とhit位置の一致
- 320幅相当での上下crop
- background移行と復帰後の状態・描画一致
- 実GPUの目標60fps／最低30fps

### 実機記録欄

| 項目 | Result |
|---|---|
| iPhone機種 | `NOT TESTED` |
| iOS version | `NOT TESTED` |
| Safari version | `NOT TESTED` |
| Test URL／build | `NOT TESTED` |
| Average／minimum fps | `NOT TESTED` |
| First meeting | `NOT TESTED` |
| Room input | `NOT TESTED` |
| Visual parity | `NOT TESTED` |
| Background resume | `NOT TESTED` |
| Screenshot／screen recording | `NOT TESTED` |

## 11. Acceptance rule

v0.8.1 software gateは、同一commit SHAで次をすべて満たした時だけ合格とします。

1. 3正本PNGのsource／dist SHAが上記contractと一致
2. `npm run check`がexit 0
3. 新しいQuality Gateがsuccess
4. 3サイズWebGL smokeでdirect-art、6 layer、Canvas入力、初回導線、玩具cover、睡眠配置が合格
5. 日中背景と8 exact poseのvisual parityが合格
6. 同一SHAのVercel deploymentがREADY
7. canonical URLが同じrevisionとassetを配信
8. reportとPNG artifactを保存

validated source commit `ad4b58d92c23f57950c823a06125a193fbc3cb3c`は上記8項目を満たしたため、v0.8.1 software gateは`PASSED`です。物理iPhoneは別のhardware gateであり、実機確認なしに全面合格とは書きません。
