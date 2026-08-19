# Tail Room Work 引き継ぎ書

更新日: 2026-08-20 JST
状態: **このプロジェクトの現行方針を示す最優先資料**
現行正本: **Creator Preview 0.8.1 direct-art correction**

次にこのリポジトリを扱うWorkは、コード変更前に必ず本書を最後まで確認すること。READMEや現在公開されている画面より、本書の方針を優先する。

v0.8.1の検証値と未検証境界は[`V08_VALIDATION.md`](V08_VALIDATION.md)、画面の正本は[`VISUAL_BIBLE.md`](VISUAL_BIBLE.md)を参照する。旧v0.8.0のprocedural-art仕様と検証記録は履歴であり、現行仕様・現行合格証拠ではない。

---

## 1. プロジェクトの最終目的

家で猫や犬を飼えない人が、スマートフォンの中で1匹のペットと本当に暮らしていると感じられるゲームを作り、App Storeで公開する。

### 商品の中心定義

> 現実時間で暮らす1匹の猫と、プレイヤーの接し方・生活習慣・部屋の環境によって関係を育てるアンビエント生活ゲーム。

食事や睡眠を処理するだけの管理ゲームにはしない。主な報酬はコインやlevelではなく、名前へ反応する、近くで眠る、箱へ入るなどの「自分の猫だけが見せる行動」と思い出である。

### 対象者

- 住宅事情などで猫や犬を飼えない人
- 動物からの癒やしが不足している人
- 短時間だけ開いて存在を感じたい人
- 長く暮らし、自分固有のペットへ育てたい人

### 製品形態

- Web版: 制作者がスマートフォンで確認するための内部preview
- 正式製品: App StoreからインストールするiOSアプリ
- 一般公開Webゲームにはしない
- VercelサイトをWebViewで包んだだけのiOSアプリにはしない

---

## 2. 現在の正本と接続先

### GitHub

- 正式repository: `2hg7trp7rv-design/Cat_room`
- 旧名: `2hg7trp7rv-design/Cat_certificate`
- 使用branch: `main`
- ユーザーの明示許可なしに別repositoryや別の公開branchへ移さない
- Work開始時に最新mainとCIを取得する
- v0.8.1 final commit SHA: `PENDING`
- v0.8.1 Quality Gate: `PENDING`

### Vercel

- Project name: `cats-room`
- Project ID: `prj_x77pFkTy2D8nBYq0QKDZZtV59Bz3`
- 制作者確認URL: `https://cat-certificate.vercel.app`
- v0.8.1 deployment ID: `PENDING`
- v0.8.1 deployment state: `PENDING`
- v0.8.1 served GitHub SHA: `PENDING`

URLが開けても、v0.8.1のcommit SHA、asset SHA、build metadataが一致するまでproduction合格とは扱わない。

### 旧v0.8.0証拠の扱い

次は旧procedural-art版の履歴であり、v0.8.1の合格証拠へ流用しない。

- old runtime/evidence SHA: `26935545f03c11df63bc6ddc4a929ec9bab53ee3`
- old Quality Gate: Run 54
- old Vercel deployment: `dpl_H2kVdQKouknE9S76azQ27vk9iKGx`
- old smoke artifact: `9310409064`

旧版のCI成功は、direct-artの読み込み、camera、visual parity、Canvas hit位置、性能を証明しない。

---

## 3. v0.8.1 correctionの理由

旧v0.8.0では、ユーザーが承認した部屋と猫の画像を「visual direction資料」と誤って扱い、別の低解像度procedural textureへ描き直した。

その結果、コード、CI、WebGL smokeは成立しても、画面は承認画像と別物になった。これは色調整で直る差ではなく、asset pipelineの前提ミスである。

v0.8.1では次の判断へ修正した。

- 承認画像そのものをruntimeの表示正本にする
- 部屋を低解像度の図形へ再構築しない
- 猫8姿勢をsheetから直接使用する
- 動的に必要な箇所だけ、正本由来の最小layerへ分ける
- 状態、保存、入力、行動controllerは維持する

---

## 4. Direct-art source of truth

| Key | Runtime path | Dimensions | SHA-256 |
|---|---|---:|---|
| room | `public/assets/game/IMG_3036.png` | 852×1846 RGBA | `ed17e8f3b5e6774720d3f6587cbee0531b26a9ec985c357a25922e128d0bfb1d` |
| cat | `public/assets/game/IMG_3037.png` | 1536×1024 RGBA | `93daf7f3f669a89a48e1709a9568adc0cef77bedbc21b2be291b9f98840ec90e` |
| brand | `public/assets/game/IMG_3038.png` | 1254×1254 RGBA | `a1566a67ad07af7f8fc17aabab83dc2b5cf99e4cd8e12b1f481db338ab33ba54` |

### 用途

- `IMG_3036.png`: RoomSceneの完成背景として直接表示
- `IMG_3037.png`: 透明sheetから8 exact poseを登録して直接表示
- `IMG_3038.png`: FirstMeetingSceneの主visual、favicon、touch iconの正本

### 不変条件

- 3 PNGをbyte-for-byteで保存・build・配信する
- 再圧縮、再生成、palette削減、色補正、alpha一括変更を行わない
- catとbrandの黒く見える背景は透明
- pose rectangle、pivot、state map、hit areaは画像を変更しないmetadata
- runtime外部取得を行わない
- source／dist／productionのSHAを分けて検査する

`docs/art/v08-room-concept.png`と`docs/art/v08-cat-pose-reference.png`は旧半解像度資料であり、runtime正本ではない。正本は`public/assets/game/`の3ファイルである。

---

## 5. 現行描画contract

### EngineとCanvas

- Phaser 4.2.1をrepositoryへ固定
- `Phaser.WEBGL`を明示
- Canvasは`Phaser.Scale.NONE`。起動前に`#game`のCSS寸法を測り、backing storeを`min(max(devicePixelRatio, 1), 2)`倍する
- camera zoomへbacking倍率の逆数を組み込み、CSS上の構図・入力座標・source-spaceをDPR間で一致させる
- WebGL失敗をCanvas fallbackで隠さない
- direct-artはLINEAR sampling
- antialiasを有効化
- world positionを整数へ強制しない
- cameraはviewportごとのfractional zoom

### Room source-space

- width: 852
- height: 1846
- center: 426,923
- fit: centered cover

| CSS viewport | Zoom | Draw size | Crop |
|---:|---:|---:|---|
| 320×667 | 0.3755868545 | 320×693.33 | 上下各約13.17 CSS px |
| 393×852 | 0.4615384615 | 393.23×852 | 左右各約0.12 CSS px |
| 430×932 | 0.5048754063 | 430.15×932 | 左右各約0.08 CSS px |

393×852と430×932は実質無欠損。320×667で切れるのは上端の壁と下端の床で、主要objectを欠損させない。

画像を横へ引き伸ばさない。全画素表示が必要な診断時はcontainを使用し、320×667では左右各約6.08 CSS pxの余白を明示する。

### 6 Phaser layers

順序を維持する。

1. `roomLayer`: 承認済みroom PNG
2. `shadowLayer`: 猫の接地影
3. `furnitureLayer`: 動的なobjectと玩具床cover
4. `catLayer`: 承認済みcat pose
5. `foregroundLayer`: 寝床前縁などの遮蔽
6. `lightLayer`: 朝・夕・夜の局所lightとwash

承認済みroom PNGに含まれる静止家具を、再び個別の簡略textureへ描き直さない。猫はroom PNGへ焼き込まない。

---

## 6. 猫asset contract

### 8 exact poses

sheetの自動trimは禁止する。低alphaの微小speckleがあるため、以下の固定rectangleを使用する。

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

base scaleは0.75。仮合成で、座る、歩く、寝床の丸寝、玩具への飛びつきがroomと同じ縮尺に見えることを確認済み。

### Source-space anchors

| Anchor | Position |
|---|---:|
| `center-idle` | `370,1320` |
| `carrier` | `370,1320` |
| `rug-play` | `551,1510` |
| `bed-sleep` | `744,1170` |
| `bowl-wait` | `280,1450` |
| `window-watch` | `430,1000` |

### 21 logical state map

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

logical timingとbehavior sequenceは維持するが、固有作画は8姿勢しかない。non-loop transitionは終端poseを複数frame保持し、action完了前にsequence先頭へ巻き戻って見えない長さにしている。同じ姿勢を繰り返しても、瞬き、耳、尻尾、呼吸、歩行周期、transitionが完成したとは扱わない。

### Pose別の撫で領域とprop anchor

`DIRECT_CAT_PET_ZONES`は各poseのfloor pivot相対`x,y,w,h`で、8姿勢すべてに`head`、`back`、`tail`を持つ。leftは記録値、rightはxをmirrorする。どの領域にも入らない猫上の入力は`flank`として扱う。

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

`DIRECT_CAT_PROP_ANCHORS.crouch.caughtToy`はpivot相対`-104,-8`。leftではx=-104、rightではx=+104へmirrorし、派生toyを前足へ追従させる。

### 追加制作が必要

- 呼吸
- 瞬き
- 耳と視線
- 尻尾
- 連続した歩行
- 立つ、座る、伏せるtransition
- 丸寝、横寝へのtransitionと寝息
- notice、crouch、pounce、catch、recoverの中割り
- 撫で反応
- 食事animation

追加frameは8正本poseと同じ顔、目、額・背・尾の柄、体格、pixel density、光源を維持する。

---

## 7. 玩具、寝床、食器の境界

### 玩具

room正本にはballが焼き込まれている。

現在は境界RMSE探索と目視で選んだ同じroom textureの床subframe`toy-floor-cover`、rect `271,1457,92,92`を登録し、destination `552,1493`へ`play-catch`中だけ表示して焼き込みballを隠す。同時に原本roomのtight crop `510,1444,88,94`をruntime canvasへ切り出し、18-point polygon clipした透明CanvasTexture `direct.toy-ball`を猫の近くへ表示する。新binaryや再生成画像は使っていない。

これは暫定的な二重表示防止であり、次は未完成。

- 本格的なballなしclean plate
- runtime派生ではない、正式な独立toy art
- 猫がballを咥える最終専用frame
- 床patternの継ぎ目を実機で確認すること

### 寝床

curl poseはscale 0.75、anchor 744,1170で寝床へ収まる。原本roomのcrop `620,1075,232,145`を10-point polygon clipした透明CanvasTexture `direct.bed-foreground`を生成し、猫より手前の`foregroundLayer`へ置く暫定遮蔽は実装済み。WebGL非対応のGeometryMaskは使わない。ただし、3サイズ・実機での遮蔽検証と最終専用アートは未完成であり、暫定CanvasTextureだけで最終完成とは扱わない。

### 食器

食器はroom正本へ焼き込まれている。Canvas hitは維持する。今後は原本位置を変えず、食事量、接近、匂い、咀嚼、口舐めを追加する。

---

## 8. 維持するゲームlogic

### 状態と保存

- `src/state.js`の`version: 6`
- LocalStorage key `tail-room-state-v6`
- 現実時間
- 朝食・夕食
- 空腹、energy、comfort、bond
- 好きな撫で方・食事
- 思い出
- 留守中進行
- 成長
- 制作者用時間操作

描画版を0.8.1へ上げたことを理由に保存schemaを変更しない。変更する場合はv6移行testが先。

### 行動優先順位

- first meeting
- sleep
- hunger
- low energy
- player request
- autonomous behavior
- ambient behavior

`CatBehaviorController`の決定的seed、background pause対策、1 tick上限、同一自主行動の連続防止を維持する。

### Input

- 猫、食器、寝床、玩具、窓: Canvas内形状判定
- 名前、食事sheet、思い出、設定、制作者menu、error: DOM
- 透明DOM hotspotは禁止
- screen座標をsource-spaceへ正しく逆変換する

---

## 9. 現行source structure

重要な正本:

- `src/game/art/DirectArtManifest.js`
- `src/game/art/DirectArt.js`
- `src/game/world/WorldCamera.js`
- `src/game/world/RoomWorld.js`
- `src/game/entities/Cat.js`
- `src/game/behavior/CatBehaviorController.js`
- `src/game/input/**`
- `src/state.js`
- `src/state/GameStateStore.js`
- `src/ui/UIController.js`
- `src/styles.css`
- `public/assets/game/IMG_3036.png`
- `public/assets/game/IMG_3037.png`
- `public/assets/game/IMG_3038.png`
- `scripts/**`
- `tests/**`
- `vendor/phaser-4.2.1/**`

`DirectArtManifest.js`はURL、寸法、SHA、pose rectangle、pivot、logical state map、pose別pet zone、prop anchor、room subframe、2件の`DIRECT_DERIVED_TEXTURES`を一元管理する。`DirectArt.js`はpreload、寸法検査、LINEAR filter、frame登録に加え、18-point／10-point polygon clipから透明CanvasTextureを生成する。WebGL非対応のGeometryMaskは使用しない。

旧procedural art generatorは現行source of truthではない。旧値を前提にしたtest、docs、debug表示を残さない。

`dist/`はbuild成果物。直接編集せず、`npm run build`で生成し、public assetとのbyte parityを検査する。

---

## 10. 現在の検証状態

| Gate | Status |
|---|---|
| v0.8.1 source commit | `PENDING` |
| 3 PNG source SHA | `PENDING` |
| 3 PNG dist SHA | `PENDING` |
| Local tests | `PENDING` |
| GitHub Actions | `PENDING` |
| 320×667 screenshot | `PENDING` |
| 393×852 screenshot | `PENDING` |
| 430×932 screenshot | `PENDING` |
| Direct-art visual parity | `PENDING` |
| Canvas hit位置 | `PENDING` |
| Toy floor cover | `PENDING` |
| Sleep placement | `PENDING` |
| Vercel deployment | `PENDING` |
| Canonical URL served SHA | `PENDING` |
| 物理iPhone / iOS Safari | `NOT TESTED` |
| 実GPU fps | `NOT TESTED` |

「sourceへ実装した」と「CIで合格した」と「productionへ配信した」と「物理iPhoneで合格した」を混同しない。

---

## 11. 次のWorkが行う順序

1. latest mainと作業treeを確認
2. `DirectArtManifest.js`の3 URL、寸法、SHAを原本と照合
3. source／public／distのbyte parityを確認
4. local syntax、unit、architecture、camera、input、motion testを実行
5. local WebGL smokeで3対象サイズを取得
6. day背景と8 poseのvisual parityを確認
7. first meetingで`IMG_3038.png`、撫で、命名、Room遷移を確認
8. cat、food、bed、toy、windowのCanvas hitと、8 pose別head／back／tail領域の左右mirrorを確認
9. `play-catch`時だけtoy floor coverとcaught toy派生へ切り替わり、paw anchorを左右mirrorしてball二重表示を防ぐことを確認
10. curlがbedへ収まり、masked foregroundが自然に遮蔽することを確認。暫定実装と最終専用アートを区別して報告
11. GitHubへ意図した変更だけをcommit・push
12. 新しいQuality Gateの結果を確認
13. 同じSHAをVercelへ配信
14. canonical URL、build metadata、3 PNG responseを確認
15. screenshot、CI run、deployment ID、SHAを揃えて報告
16. 物理iPhoneで表示、入力、復帰、fpsを確認

旧Run 54や旧deploymentをv0.8.1の証拠欄へ入れない。

---

## 12. v0.8.1 software acceptance

同一commit SHAで次を満たした時だけsoftware gate合格。

1. 3 PNGが正本SHAと一致
2. distもbyte-for-byte一致
3. `npm run check` exit 0
4. 新Quality Gate success
5. 3サイズWebGL smoke success
6. room、shadow、furniture、cat、foreground、lightの順序一致
7. first meeting、Canvas hit、toy、sleep、保存v6回帰が合格
8. day visual parityが合格
9. 同一SHAのVercel deploymentがREADY
10. canonical URLが同一revisionを配信
11. reportとPNG artifactを保存

software gateに合格しても、物理iPhone、iOS Safari、実GPUは別gate。

---

## 13. ロードマップ

### v0.8.1 Direct-art correction

- 承認済み3 PNGをruntimeへ直接使用
- room source-spaceとfractional centered cover
- 8 exact poseと21 logical state接続
- 6 layer、Canvas hit、状態・保存v6維持
- FirstMeetingとfaviconへbrand正本を使用

### v0.8.x Motion completion

- 8 poseと同一猫の追加中割り
- 歩行周期
- 呼吸、瞬き、耳、視線、尾
- 睡眠transitionと寝息
- 玩具clean plate、持つ最終専用frame、検証済みの最終寝床アート
- 朝、夕方、夜のsource-matched art

### v0.9 撫でる

- 頭、顎、耳の後ろ、背中、脇腹、足、しっぽ
- 指経路、速度、距離、方向
- real-timeの目、耳、身体反応
- 音、触覚、断る反応

### v0.10 食事

- 食器へ入る
- 音へ気づく
- 接近、匂い、食べる、咀嚼
- 食事量減少、口舐め
- 通知予約解除

### v0.11 睡眠の深化

- 眠気
- 複数寝床
- 寝床ごとの進入と遮蔽
- 昼寝と夜睡眠
- 睡眠習慣、寝返り、深夜反応

### v0.12 遊びと発見

- drag猫じゃらし
- real-time視線追従
- 玩具別catch／recover
- 箱、紙袋、カーテン、日なた
- 発見記録

### iOS Alpha

撫でる、食事、睡眠の3体験が成立した時点で開始する。

- native notification
- native haptics
- offline assets
- background resume
- TestFlight
- device logs

---

## 14. 絶対に維持する商品方針

### リアルにする対象

- 現実時間
- 空腹
- 睡眠
- 留守中の生活
- 猫の意思
- 好き嫌い
- 習慣
- プレイヤーとの距離
- 関係の記憶

### 世話不足

- 食事を忘れれば空腹になる
- 行動や反応が変わる
- 状態通知は来る
- 死亡、失踪、永久的な病気、data消失は起こさない
- 回復課金を行わない
- 罪悪感で再訪させない

原則は「結果はある。破滅的な罰はない」。

### 時間は2種類

生活時計は現実と1対1。関係時計は撫で方、遊ぶ時間、食事の規則性、部屋の物、安心して過ごした時間、初めての行動で進む。

身体は数か月でゆっくり成長する。関係と行動は初日から変化させる。

### 猫と犬

- まず猫1匹を商品品質まで完成
- 共通identityを維持した毛柄展開は猫完成後
- 毛柄へ性格を固定しない
- 犬は猫完成後に専用骨格、行動、散歩を持つ別制作

---

## 15. 禁止事項

- 3正本PNGを参考資料へ戻す
- 元画像を低解像度のprocedural artへ描き直す
- 正本画像を似た別画像へ再生成する
- roomをCSS、SVG、単純図形で置換する
- 猫をroom背景へ焼き込む
- 非等方scaleで画像を歪める
- direct-artへ整数zoomとNEARESTを強制する
- 別個体に見えるAI frameを混ぜる
- 同じ8姿勢の反復を完成animationと報告する
- 玩具を背景と猫側へ二重表示する
- 暫定bed foregroundを検証済みの最終アートと報告する
- 透明DOM buttonを重ねる
- 行動を文章だけで説明する
- 猫を常に正面向きにする
- 指を離した後だけ反応する
- いきなりfull 3D化する
- 食事、治療、死亡回避への課金
- 食事中、睡眠中、撫でている途中の広告
- Web完成までiOSを待つ
- 旧CI・旧deploymentを現行合格へ流用する
- 実機未確認を実機確認済みと断定する
- mainへbuild failureを反映する

---

## 16. 報告ルール

各作業報告には必ず以下を含める。

- 変更したこと
- 変更理由
- 未完成・未検証
- GitHub commit SHA
- GitHub Actions runと結果
- Vercel確認URL
- Vercel deployment IDとstate
- served SHA
- 3 PNG SHA
- 320×667、393×852、430×932 screenshot
- 実機確認の有無
- OK／NGの根拠

完成していないものを完成と書かない。Vercel確認URLは毎回記載する。

---

## 17. 最重要判断

次のWorkは、旧procedural-art版へ戻ってはいけない。v0.8.1で最初に閉じるべき課題は、新機能ではなく**承認された3画像をそのまま表示するvisual parity**である。

その後に、玩具clean plate、猫が持つ最終専用frame、最終寝床アート、追加中割りを制作する。8姿勢しかない状態で「動き完成」とは判断しない。

Phaser 4.2.1 WebGL、852×1846 source-space、fractional centered cover、LINEAR sampling、6 layers、Canvas形状判定、21 logical states、保存v6互換を土台として進める。
