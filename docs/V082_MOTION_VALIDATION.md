# Tail Room v0.8.2 Source-locked Motion Validation

更新日: 2026-08-20 JST

## 判定

**v0.8.2 source-locked motion scaffoldのsoftware gateはPASSED。最終猫animationはOPEN。**

v0.8.2は、承認済み3 PNGを別物へ置き換えず、承認済み猫sheetの座りposeから作った最小補助atlasとroot transformを追加した版です。これは歩行、睡眠、遊びを含む全animationの完成判定ではありません。

## 検証済みsource

| 項目 | 値 |
|---|---|
| Runtime source commit | `fc96a038950ff26303ca13653924130719f18fdc` |
| GitHub Quality Gate | Run 64 / ID `32346017409` |
| Job | `96354829054` / `completed / success` |
| Local gate | JavaScript 49件、tests 75／75 |
| Smoke artifact | `9398120243` / `tail-room-v0.8.2-webgl-smoke` |
| Smoke digest | `sha256:bcaf6655354a68fbe94f7ff10b4e2464db3d8bdee2b9b583c1ff0bb91869f05f` |
| Smoke size / expiry | 20,274,192 bytes / `2026-11-18T07:52:14Z` |
| Dist artifact | `9398047205` |
| Dist digest | `sha256:2d84e3605e6ef3c08eb769c3cda4b07e1ec4f3c8478e1d2a188fe89003dec6ff` |
| Dist size / expiry | 6,085,201 bytes / `2026-08-27T07:52:24Z` |
| Vercel deployment | `dpl_FKVNJvaNPKnzVEYRcKd8UoutXbKF` |
| Vercel state | `READY` / production / `aliasError: null` |
| Canonical URL | `https://cat-certificate.vercel.app` |

CIはChrome `151.0.7922.108`、ChromeDriver `151.0.7922.77`、SwiftShaderによるsoftware WebGL診断です。物理iPhone、iOS Safari、hardware GPU、production性能の証拠には使用しません。

## 変更していない正本

| Asset | SHA-256 |
|---|---|
| `IMG_3036.png` | `ed17e8f3b5e6774720d3f6587cbee0531b26a9ec985c357a25922e128d0bfb1d` |
| `IMG_3037.png` | `93daf7f3f669a89a48e1709a9568adc0cef77bedbc21b2be291b9f98840ec90e` |
| `IMG_3038.png` | `a1566a67ad07af7f8fc17aabab83dc2b5cf99e4cd8e12b1f481db338ab33ba54` |

source、dist、productionの3正本PNGはbyte-for-byte一致します。補助atlasは正本の代替ではなく、別manifest、別texture key、別SHAで管理します。

## 補助motion asset

| 項目 | 値 |
|---|---|
| Path | `public/assets/game/motion/v0.8.2/cat-micro.png` |
| Dimensions | 1216×896 RGBA |
| SHA-256 | `37a224e222d093a70cd4c776674223a31f434bd7462ac68d249942c949866ef4` |
| Source | `IMG_3037.png`のseated rect `75,116,267,342` |
| Runtime crop | 各frame 267×342、pivot `95,333`、再sampleなし |

補助atlasは次の4要素だけです。

- `blink-half`: 変更を目の範囲だけへ限定した半瞬き
- `blink-closed`: 同じ範囲だけを変更した閉眼
- `tail-body`: seated source pixelのbody側partition
- `tail-part`: 同じsource pixelの尾先側partition

`tail-body + tail-part`のneutral合成はsource seated poseとpixel差0です。尻尾は6枚の別作画ではなく、2 source componentと角度`[0,-2,-4,4,2,0]`による6 transform phaseです。非uniform scaleとcross-fadeは使用しません。

## Runtimeで追加した動き

- `blink`: `half → closed → closed → half`の2段階瞬き
- `tail`: 座りposeの尾先を小さく左右へ動かす6 phase
- `walk`: 承認済みstanding／walking poseへ最大2 pxのsource-locked root motionを追加
- `play-notice`／`play-crouch`: 視認できる小さな重心移動
- `play-pounce`: 既存pounce poseをroot y最大-24 px、角度最大1°で跳ばす
- `play-recover`: rootを接地位置へ戻す
- `sleep-curl`／`sleep-side`: 承認済みcurl／side-lieを寝床へ配置する既存sequenceを維持

`pixelSprite`、`tailBodySprite`、`tailPartSprite`は同一`motionRoot`配下で動かし、撫で反応用`reactionRoot`と分離しています。QA boundsは現在表示中のspriteだけを測り、透明atlas guardや非表示spriteを猫の大きさとして扱いません。

## WebGL smoke

`report.status=passed`、`motionArt.status=passed`です。320×667、393×852、430×932、393×852のDPR 2／3、direct-art parity、Canvas入力、first meeting、食事、玩具、寝床、睡眠、8 exact pose、left flipを再検証しました。

| Capture | SHA-256 |
|---|---|
| `cat-motion-blink-half.png` | `e99e68d551d29367fc41e14f46084f247e3ed5fbf1e02cabd010ea3c3f469ab4` |
| `cat-motion-blink-closed.png` | `319c9f24e577b6e1690fba9698b075d4395f548a0ac66fe6cdb5485d2302887f` |
| `cat-motion-tail-sweep-a.png` | `65bc060ec82d557999ef2f13848f49b4868d45421ae72f3e68d670b08796bdc0` |
| `cat-motion-tail-sweep-b.png` | `78c61b1f92db0a9b934676707e38466b41ec4447f08f690fdbd4a0bcda0ada71` |
| `cat-motion-play-pounce-apex.png` | `81d3c3773014b66cc2030ffee699daba11bff75e2ed4cf52db946d5461297666` |

5 captureはすべて393×852です。各対のSHAは異なり、目視でも顔・柄・輪郭の同一性、目の差、尾の差、pounce位置、接地と寝床配置を確認しました。

## 失敗履歴

最初のimplementation commit `dc8578c22dc54483863449f2a2fa33e6ead44009`に対するRun 63（ID `32345414375`）はfailureでした。描画破綻ではなく、608×448の透明guardと非表示spriteを`Container.getBounds()`が猫の可視boundsとして数えたため、room parity 1件とsleep bounds 3件が誤判定されました。

修正では、atlas内のsource実寸267×342だけをruntime frameへ無劣化crop登録し、表示中の部品だけをunionしてboundsを返すようにしました。Run 64で前記4件を含む全caseが合格しています。

AI生成した追加frame候補2件は、checkerboardが実alphaではないこと、猫の寸法・顔・柄が正本からずれたことを理由に不採用とし、repository、runtime、public assetへ入れていません。

## 未完成

- 同一猫として手描き調整した6 frame以上の歩行cycle
- 呼吸、耳、視線の固有frame
- 丸寝・横寝へ入る自然な中割りと寝息
- notice、crouch、pounce、catch、recoverの最終中割り
- 玩具なしclean plate、独立toy、咥える／押さえる最終frame
- 食事の接近、匂い、咀嚼、量減少
- 撫でている最中の部位別身体反応
- 物理iPhone、iOS Safari、hardware GPU
- 音、触覚、通知、TestFlight、App Store版

次のmotion制作は、正本と同じ顔・柄・体格・pixel densityを保つ歩行中割りを最優先にします。transform-onlyの動きを最終animation完成とは報告しません。
