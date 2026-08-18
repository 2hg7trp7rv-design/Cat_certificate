# Tail Room Work 引き継ぎ書

更新日: 2026-08-18 JST
状態: **このプロジェクトの現行方針を示す最優先資料**

次にこのリポジトリを扱うWorkは、コード変更前に必ず本書を最後まで確認すること。READMEや既存画面より、本書の方針を優先する。v0.8の検証値と未検証境界は[`V08_VALIDATION.md`](V08_VALIDATION.md)を参照する。v0.7の記録は履歴であり、現行仕様ではない。

---

## 1. プロジェクト情報

### 最終目的

家で猫や犬を飼えない人が、スマートフォンの中で1匹のペットと本当に暮らしていると感じられるゲームを作り、App Storeで公開する。

### 商品の中心定義

> 現実時間で暮らす1匹の猫と、プレイヤーの接し方・生活習慣・部屋の環境によって関係を育てるアンビエント生活ゲーム。

食事や睡眠を処理する管理ゲームにはしない。主な報酬は、コインやレベルではなく、初めて名前へ反応する、初めて近くで眠る、初めて箱へ入るなどの「自分の猫だけが見せる行動」と思い出である。

### 対象者

- 住宅事情などで猫や犬を飼えない人
- 動物からの癒やしが不足している人
- 短時間だけ開いて存在を感じたい人
- 長く暮らして自分固有のペットへ育てたい人

### 製品形態

- Web版: 制作者がスマートフォンで確認するための内部プレビュー
- 正式製品: App StoreからインストールするiOSアプリ
- 一般公開Webゲームにはしない
- WebViewでVercelサイトを包んだだけのiOSアプリにはしない

---

## 2. 現在の正本

### GitHub

- 正式リポジトリ: `2hg7trp7rv-design/Cat_room`
- 旧名: `2hg7trp7rv-design/Cat_certificate`
- リポジトリは改名済み。今後は`Cat_room`を使用する
- 使用ブランチ: `main`
- ユーザーの明示許可なしに別リポジトリや別の公開ブランチへ移さない
- v0.8 runtime／evidenceコミット: `26935545f03c11df63bc6ddc4a929ec9bab53ee3`
- v0.8 Quality Gate: [Run 54](https://github.com/2hg7trp7rv-design/Cat_room/actions/runs/32097369705)、job `95591222211`、`completed / success`
- WebGL smoke artifact: ID `9310409064`、`tail-room-v0.8-webgl-smoke`、digest `sha256:684446e1ea24405c1600c2a2f698bb8dcf0db2702f3117b3f4233dc2de523b2a`
- v0.7の旧検証SHAや旧runをv0.8合格の証拠に流用しない
- Work開始時には必ずmainの最新HEADとCIを再取得する

### Vercel

- Vercelプロジェクト名: `cats-room`
- Vercel project id: `prj_x77pFkTy2D8nBYq0QKDZZtV59Bz3`
- 現在の制作者確認URL: `https://cat-certificate.vercel.app`
- ドメイン名は旧名称を維持しているが、現在のプロジェクトは`cats-room`
- v0.8 deployment ID: `dpl_H2kVdQKouknE9S76azQ27vk9iKGx`
- deploymentはv0.8 runtime／evidence SHAと一致し、`READY / production`、`aliasError: null`
- 正本URLはHTTP 200、titleは`Tail Room — Creator Preview 0.8`
- `/assets/fonts/noto-sans-jp-400.ttf`はHTTP 200、`content-type: font/ttf`
- `/build-meta.json`はversion `0.8.0`、engine `phaser-4.2.1`、`runtimeFetches: false`
- `https://cat-certificate-v06-smoke.vercel.app`は旧検証用。今後の正本URLとして使わない
- デプロイIDはコミットごとに変わるため、Work開始時に最新値をVercelから取得する

### 重要

現在のWeb URLは`noindex`だが、厳密なアクセス認証は未設定。URLを知る人は開ける。最終的な制作者限定環境ではVercel Deployment Protectionを検討する。

---

## 3. 現在の実装状態

現行はCreator Preview 0.8.0。

v0.8では、v0.7のPhaser 4.2.1 WebGL、状態エンジン、Canvas内入力を維持し、世界を温かいレトロ・ピクセルアートへ作り直した。猫のmotionと自主行動、代表的な睡眠・一人遊び、温かいDOM UIも実装済み。runtime／evidence SHAに対するQuality Gate Run 54とVercel productionを確認し、現在の判定は**実装＋CIソフトウェアWebGLゲート合格**である。物理iPhone、iOS Safari、実GPUのhardware gateは未完。

### v0.8でソース実装済み

- BootScene、FirstMeetingScene、RoomScene、DebugScene
- 216×472 art px、8pxグリッド、固定2倍world camera、Canvas `RESIZE`
- room、shadow、furniture、cat、foreground、lightの6レイヤー
- 部屋・家具・影・光18個と猫113フレーム、合計131個の独立テクスチャ
- 猫21状態。96×96 art px共通canvas、足元pivot y=88
- 呼吸、瞬き、耳、視線、しっぽ、立つ、座る、香箱、伏せる、歩く、向き直る
- 丸寝、横寝、休息、窓観察、一人遊びのsequence
- 20〜65秒間隔、seed固定、3回連続同一行動を避ける自主行動controller
- 睡眠、空腹、低energyをプレイヤー遊び・自主行動より優先する中断規則
- paper cream、walnut、sage、deep teal基調の温かい不透明DOM UI
- 同梱した日本語`Tail Room JP` 400／700とsystem font fallback
- 状態エンジンと8個のsystem facade
- ローカル固定したPhaserとSHA-256検証
- WebGL初期化失敗時の明示的なエラー表示
- 320×667、393×852、430×932のQA契約とWebGL smoke script

保存データ互換性のため、`src/state.js`のスキーマは`version: 6`、LocalStorage keyは`tail-room-state-v6`を維持している。Creator Preview 0.8.0は描画・motion版であり、保存スキーマ版ではない。

### 継続して廃止しているもの

- 猫と部屋を焼き込んだ1枚画像
- `assets_source/scene_day_*.b64`
- 透明DOMホットスポット
- 旧`src/app.js`
- 古い追跡対象`dist/`
- rootの不要ファイル`test`

リポジトリ内に実行時GitHubローダーは確認されなかった。v0.6の実体はローカルBase64取得だったため、それを削除し、外部GitHub/CDN取得を禁止するテストを追加した。

### 修正済みの重要な失敗点

- 30秒更新のたびに`lastSeenAt`を進め、54秒未満の経過が永続的に失われる状態処理
- Phaser 4のSceneManagerへ存在しない`launch()`を呼ぶDebugScene起動
- Containerの`displayOrigin`を考慮せず、形状判定が表示位置からずれる入力
- ガイドDOMがCanvas上の玩具入力を遮る問題
- タップを撫でとして受理する問題、複数pointerの上書き、pointer-up最終区間の取りこぼし
- WebGL2を先に試すpreflightとPhaserのWebGL1初期化条件の不一致
- 保存済みデータでRoom QA画面が非決定的になる問題

### 未完成・未検証

- Quality Gate Run 54とVercel productionのsoftware gateは合格済み。ただし物理iPhone、iOS Safari、実GPU性能は未検証
- 現在の131テクスチャはVisual Bible準拠の実装素材だが、最終商品アートの描き込みと毛柄展開は未完成
- 撫でている最中の部位別身体反応、拒否、音、触覚は未実装
- 食事の接近、匂い、咀嚼、量減少は未実装
- 代表的な丸寝・横寝は実装したが、複数寝床、睡眠習慣、深夜固有反応は未実装
- 物理iPhone、iOS Safari、実GPUの目標60fps／最低30fpsは未確認
- 通知、TestFlight、App Store版は未実装

### Source of Truth

コードの正本は以下。

- `index.html`
- `src/main.js`
- `src/game/**`
- `src/state.js`
- `src/state/GameStateStore.js`
- `src/ui/UIController.js`
- `src/styles.css`
- `scripts/**`
- `tests/**`
- `vendor/phaser-4.2.1/**`

`dist/`は生成物でありGit管理対象外。直接編集せず、`npm run build`で再生成する。

---

## 4. 絶対に維持する商品方針

### リアルにする対象

リアルにするのは写真のような見た目ではなく、以下。

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

- 食事を忘れれば本当に空腹になる
- 行動や反応が変わる
- 状態通知は来る
- ただし死亡、失踪、永久的な病気、データ消失は起こさない
- 回復課金は行わない
- 罪悪感で再訪させない

原則は「結果はある。破滅的な罰はない」。

### 時間は2種類

#### 生活時計

現実と1対1。

- 朝、昼、夕方、夜
- 食事
- 睡眠
- 留守番
- 曜日、季節

#### 関係時計

プレイヤーとの行動で進む。

- 撫でた場所と速さ
- 遊ぶ時間帯
- 食事の規則性
- 部屋へ置いた物
- 安心して過ごした時間
- 初めての行動

身体は数か月でゆっくり成長するが、関係と行動は初日から変化させる。

### 猫と犬

- まず猫1匹を商品品質まで完成させる
- 発売時は1つの共通リグに3種類程度の毛柄を載せる案を基準とする
- 毛柄へ性格を固定しない
- 犬は猫完成後に専用骨格、専用行動、散歩を持つ別制作として追加する

---

## 5. 最新のゲームループ

> 暮らす → 習慣が形成される → 部屋や接し方を少し変える → 新しい行動を発見する → 思い出に残る → さらに関係が変わる

### 10秒の利用

- アプリを開く
- 今していることを見る
- 一度撫でる
- 閉じる

### 1から3分

- 食事を置く
- 猫じゃらしで遊ぶ
- 部屋の物を触る
- 留守中の変化を見る

### 数日

- 名前への反応
- 好きな場所
- 好きな撫で方
- 食事時刻への反応
- 寝場所

が形成される。

### 数週間から数か月

- 新しい自主行動
- 距離感の変化
- 性格傾向
- 身体成長
- プレイヤー固有の習慣

が生まれる。

### 部屋は第二のコアシステム

部屋は背景ではない。

例:

- 紙袋を置く → 数時間後に入っている
- カーテンを開ける → 日なたへ移動する
- 新しい毛布を置く → 最初は避け、数日後に眠る
- 箱を置く → 匂いを確認し、後日入る

猫を集めず、「自分の猫の新しい行動」を集める。

---

## 6. アートとデザインの確定方針

### 確定した画風

> 温かいピクセルアートの部屋で、プレイヤーが触れていない時間にも、一匹の猫が自分の意思で暮らしている。

懐かしさはCRT走査線や粗いfilterではなく、限定palette、読みやすいsilhouette、整数pixel、静かな間で作る。写真、3D、滑らかなvector、旧ペイント調素材を混在させない。

基準は216×472 art px、8×8 art px grid、固定2倍world camera。端末幅に応じて猫や家具を比例拡大せず、大画面では壁、床、光、小物が多く見える。

### 猫の見た目

- 写真、SVG、滑らかなベクターではない
- 共通frameは96×96 art px、足元pivotを固定
- 実silhouetteは概ね64〜80 art px
- creamとgingerの柄、cocoaの輪郭を全frameで維持
- 身体構造と動きは猫らしい
- 目を巨大化しすぎない
- 人間の笑顔をさせない
- 感情は耳、目、姿勢、しっぽで表現する

### 禁止する見た目

- 円と楕円だけの猫
- 完全左右対称
- 常に正面向き
- 前足が胴体から分離している
- しっぽが管状
- ポーズごとに別個体へ見える
- 猫と部屋の光源が違う
- AI生成した別々の静止画を切り貼りする
- 全身scale tweenを呼吸として使う
- 写実blur shadowとpixel artを混在させる
- CRT走査線、色収差、強いvignetteを足す

### 部屋のレイヤー

runtimeでは以下の6 Phaser layerを順序固定で分離する。

1. `roomLayer`: 外景、壁、床、窓
2. `shadowLayer`: 家具と猫の接地影
3. `furnitureLayer`: カーテン、家具、玩具、食器、寝床
4. `catLayer`: 猫
5. `foregroundLayer`: 猫の手前へ来る物
6. `lightLayer`: 窓光、ランプ光、夜wash

猫と背景を1枚へ焼き込まない。

### 時間帯の光

- 朝: 黄白色の柔らかい斜光
- 昼: 拡散自然光
- 夕方: 低いオレンジ光
- 夜: 青い外光と暖色の小さな室内光を併用

昼画像全体へbrightnessフィルターを掛けて夜にする方式は禁止。

### 正本デザイン資料

- `docs/VISUAL_BIBLE.md`: grid、palette、猫、部屋、光、採用不可例
- `docs/MOTION_BIBLE.md`: 21状態、速度、行動優先順位、anchor、sleep／play sequence
- `docs/UI_SYSTEM.md`: CanvasとDOMの役割、色、component、responsive、accessibility
- `docs/V08_IMPLEMENTATION.md`: v0.8のscopeとrelease gate

これらは作成予定ではなく、現行実装を判断する正本である。

`docs/art/v08-room-concept.png`と`docs/art/v08-cat-pose-reference.png`は、画像生成を用いた構図・素材感・体型のvisual direction資料である。runtimeへ貼る完成素材ではなく、背景や猫へ焼き込んでいない。runtimeの部屋、家具、猫、影、光は`PixelArt.js`から生成する131個の分離textureである。

---

## 7. 新しい技術構造

### 描画

Phaser 4.2.1を正確に固定し、`Phaser.WEBGL`で使用する。Phaser本体は`vendor/phaser-4.2.1/`へ保存し、ビルド時にSHA-256を検証する。

`AUTO`またはCanvas rendererへの暗黙のフォールバックは使用しない。WebGL初期化に失敗した場合はDOMエラーを表示する。低消費電力GPUを一律に拒否せず、性能は実端末で別途検証する。

Phaser 4.2.1には移動と角度Tweenの組み合わせに関する未解決報告[#7341](https://github.com/phaserjs/phaser/issues/7341)がある。v0.8の猫移動は`CatBehaviorController`内の同一update系で補間し、猫frameもmanual clockで選ぶ。今後も猫のposition／rotationを複数Tweenへ分散させない。

### Canvas/WebGLで扱うもの

- 猫
- 部屋
- 家具
- 光、影
- 移動
- 食事
- 睡眠
- 玩具
- 撫で判定
- 行動アニメーション

### DOMで扱うもの

- 名前入力
- 設定
- 通知許可
- 思い出一覧
- 写真共有
- 制作者メニュー
- エラー表示
- アクセシビリティ用代替操作

### 現行ディレクトリ

```text
src
├─ main.js
├─ game
│  ├─ config.js
│  ├─ phaser.js
│  ├─ art
│  │  └─ PixelArt.js
│  ├─ behavior
│  │  └─ CatBehaviorController.js
│  ├─ scenes
│  │  ├─ BootScene.js
│  │  ├─ FirstMeetingScene.js
│  │  ├─ RoomScene.js
│  │  └─ DebugScene.js
│  ├─ entities
│  │  ├─ Cat.js
│  │  ├─ Bowl.js
│  │  ├─ Bed.js
│  │  ├─ Toy.js
│  │  └─ InteractiveObject.js
│  ├─ systems
│  │  ├─ TimeSystem.js
│  │  ├─ NeedSystem.js
│  │  ├─ RelationshipSystem.js
│  │  ├─ HabitSystem.js
│  │  ├─ BehaviorSystem.js
│  │  ├─ GrowthSystem.js
│  │  ├─ MemorySystem.js
│  │  └─ OfflineSimulation.js
│  ├─ input
│  │  ├─ HitArea.js
│  │  ├─ PettingInput.js
│  │  └─ ObjectInput.js
│  └─ world
│     ├─ AmbientRoomMotion.js
│     ├─ RoomWorld.js
│     └─ WorldCamera.js
├─ state.js
├─ state
│  └─ GameStateStore.js
├─ styles.css
└─ ui
   └─ UIController.js
```

### iOS

Webで以下の3体験が成立した時点で、完全なWeb完成を待たずにCapacitor系のiOS内部版とTestFlightへ移行する。

1. 撫でる
2. 食事
3. 睡眠

---

## 8. v0.8再構築結果

### 維持したもの

- `src/state.js`の時間、食事、睡眠、保存、好み、思い出、成長の意味
- `tests/state.test.mjs`と保存互換性
- GitHub Actions Quality Gate
- `vercel.json`のセキュリティヘッダー思想
- 制作者用時間操作

### system facade追加・接続状況

正本ロジックの多くは引き続き`src/state.js`にあり、各systemは段階的に分離するための薄いfacadeである。完全移植済みとは扱わない。

実行時に`GameStateStore`から接続済み:

- 時刻 → `TimeSystem`
- 空腹、元気、安心 → `NeedSystem`
- 好み、親密度 → `RelationshipSystem`
- 留守中処理 → `OfflineSimulation`
- 成長 → `GrowthSystem`
- 習慣 → `HabitSystem`
- 行動選択 → `BehaviorSystem`

単体追加・テスト済みだが、runtimeへは未接続:

- 思い出 → `MemorySystem`

### 再構築済み

- `index.html`
- `src/main.js`
- `src/styles.css`
- 初回導線とRoomScene
- Canvas内入力判定
- 131個のpixel textureを生成する`PixelArt.js`
- 21状態・113フレームを表示する`Cat.js`
- 状態優先、自主行動、移動、sleep／play sequenceを管理する`CatBehaviorController.js`
- 216×472 worldと固定2倍camera
- Phaser/WebGL描画と静的build pipeline
- warm pixel UIとfocus／safe-area対応

### 削除済み

- `assets_source/scene_day_*.b64`
- 追跡対象の古い`dist/`
- rootの不要ファイル`test`
- 透明DOMホットスポット
- 背景へ猫を焼き込んだ画像
- 旧`src/app.js`

### 意図的に残したもの

- 保存スキーマ`version: 6`
- LocalStorage key `tail-room-state-v6`

描画版が0.8であることを理由に保存スキーマを8へ上げない。変更する場合はv6データの明示的な移行テストを先に作る。

---

## 9. 次のWorkが最初に行う作業

### 最初にv0.8 hardware gateを閉じる

v0.8のsoftware release evidenceはSHA `26935545f03c11df63bc6ddc4a929ec9bab53ee3`で閉じた。次のWorkはmainの最新HEADとCIを再確認した後、新機能へ進む前に物理iPhoneゲートを実施する。Run 54のartifactとVercel結果を別SHAの証拠へ流用しない。

### v0.8 software evidence結果

- `npm run check`: exit 0、41 JavaScript構文検査、47 tests pass
- Quality Gate: Run 54、job `95591222211`、`completed / success`
- Browser: Chrome 151、ANGLE SwiftShader WebGL。実GPU性能の証拠ではない
- 320×667、393×852、430×932: Canvas寸法一致、横overflowなし、PNG取得
- texture: 131 created、131 non-empty、`temporary: false`
- layer: room → shadow → furniture → cat → foreground → light
- font: 同梱`Tail Room JP` 400／700 loaded
- first meeting: ゆっくり撫でる → 名前panel → 既定名`こむぎ` → RoomScene
- room: food sheet、bed touch feedback、玩具、睡眠を確認
- 玩具: walk → notice → crouch → pounce → catch → recover → sit、roomの玩具を復元
- 睡眠: walk → transition → curl。12秒deadline内に合格
- Vercel: 同じSHAの`dpl_H2kVdQKouknE9S76azQ27vk9iKGx`が`READY / production`、正本URL HTTP 200

### 失敗履歴

- Run 48は静的checkに合格したが、Phaser 4のContainerで未対応の`setDisplayOrigin()`を呼んだためscene boot後にWebGL smokeが失敗した。呼び出しを削除し、Container entityでの再使用を禁止するtestを追加した
- Run 49は日本語font setupがGitHub runnerのapt mirrorで停止し、最終的に`cancelled`。Run 50はtimeoutを追加してもsetupを完了できず`failure`となった。日本語fontをリポジトリへ同梱し、CIからapt依存を除去した
- Run 51は未使用の400 weightを明示ロードせず、両weightの`loaded`を待ったためRoom 3ケースがtimeoutした。`document.fonts.load()`で400／700を先に読み、match数とstatusを検査するよう修正した
- Run 53はスクリーンショット取得中に状態pollingが止まり、短い`play-recover`を見逃したfalse-negative。behaviorの`onStateChange`を使うbounded motion traceへ変更し、sequenceの全状態を取得するよう修正した
- これらのrunはv0.8合格の証拠ではない。最終software gateはRun 54のみ

### v0.8 source条件の現在地

| 条件 | 状態 | 根拠 |
|---|---|---|
| 8px grid、216×472 world、固定2× | source OK | `PixelArt.js`, `WorldCamera.js` |
| Canvasをviewportへ`RESIZE` | source OK | `config.js` |
| 猫＋部屋の焼き込みなし | source OK | 131個の独立textureと6 layer |
| 猫21状態・113フレーム | source OK | manifestとanimation spec |
| 丸寝・横寝・休息 | source OK | behavior planとmotion test |
| 一人遊びのnotice→catch | source OK | behavior planとmotion test |
| 20〜65秒の自主行動 | source OK | deterministic scheduler |
| warm DOM UI | source OK | `index.html`, `styles.css`, `UIController.js` |
| 3サイズ、横scrollなし | CI OK | Run 54の3サイズがpass |
| GitHub Actions | CI OK | Run 54 `completed / success` |
| Vercel READY / HTTP 200 | production OK | 同一SHAのdeploymentと正本URLを確認 |
| 実iPhone | `NOT TESTED` | 実機確認済みと書かない |
| 目標60fps、最低30fps | `NOT TESTED` | SwiftShader値は実GPU判定に使用不可 |

### v0.8物理iPhoneゲート

1. 最低1台の実iPhone SafariでFirstMeetingSceneとRoomSceneを開く
2. ゆっくり撫でる操作で命名panelが開き、tapだけでは開かないことを確認
3. 食器、寝床、玩具、猫の表示位置と入力位置が一致することを確認
4. 30秒で複数の微細動作、2分で姿勢または場所の変化を確認
5. 丸寝／横寝、一人遊びが説明文なしで読めることを確認
6. 夜間の猫の目、鼻、耳、足、尾が読めることを確認
7. background移行と復帰後に未再生animationの早送りや瞬間移動がないことを確認
8. 実GPUで目標60fps、最低30fpsを計測する
9. 機種、iOS版、Safari版、計測方法、screen captureを記録する

---

## 10. 以後のロードマップ

### v0.8 ピクセル世界と猫の生命感 — 実装＋CIソフトウェアWebGLゲート合格／実機ゲート未完

- 温かいpixel roomとwarm UI
- 呼吸、瞬き、耳、視線、しっぽ
- 座る、香箱、伏せる、立つ、歩く、向き直る
- 丸寝、横寝、休息
- 窓観察と代表的な一人遊び
- seed固定の自主行動

合格条件: 30秒見ても静止画に見えず、歩行中に猫の大きさが変わらず、睡眠と遊びが説明文なしで読める。ソース、CIソフトウェアWebGL、Vercel productionは合格済み。物理iPhone、iOS Safari、実GPUは未検証。

### v0.9 撫でる

- 頭、顎、耳の後ろ、背中、脇腹、足、しっぽ
- 指経路、速度、距離、方向
- リアルタイムの目、耳、身体反応
- 音、触覚
- 猫が断る反応

合格条件: タッチから100ms以内に視覚反応し、指を動かしている最中に猫が反応する。

### v0.10 食事

- 食器へ入る
- 音へ気づく
- 顔を向ける
- 立つ
- 歩く
- 匂いを嗅ぐ
- 食べる
- 咀嚼
- 食事量減少
- 口舐め
- 通知予約解除

合格条件: 説明文を消しても食事行動が分かる。

### v0.11 睡眠の深化

- 眠気
- 複数寝床
- 寝床ごとの進入、前景遮蔽、好み
- 昼寝と夜睡眠の違い
- 睡眠習慣と稀な寝返り
- 深夜起動反応

合格条件: 猫が寝床へ物理的に収まり、昼寝と夜の睡眠が違う。

### v0.12 遊びの深化と発見

- 猫じゃらし
- リアルタイム視線追従
- player入力へ追従する狙いと飛びつき
- 玩具別のcatch／recover差分
- 箱、紙袋、カーテン、日なた
- 発見記録

合格条件: アプリを閉じた時間にも新しい出来事が起き、最低10種類の発見行動がある。

### iOS Alpha

v0.9からv0.11の途中で開始。

- Capacitor系ランタイム
- ローカル通知
- ネイティブ触覚
- オフライン資産
- バックグラウンド復帰
- TestFlight
- 実機ログ

---

## 11. 発売時の最低コンテンツ目標

| 項目 | 最低量 |
|---|---:|
| 共通猫リグ | 1 |
| 毛柄 | 3 |
| 部屋 | 1 |
| 光 | 朝・昼・夕方・夜 |
| 基本待機行動 | 12以上 |
| 撫で反応 | 18以上 |
| 食事反応 | 6以上 |
| 睡眠姿勢 | 5以上 |
| 玩具反応 | 8以上 |
| 家具・環境発見 | 20以上 |
| 思い出イベント | 30以上 |
| 短い遊び | 3以上 |

---

## 12. 禁止事項

- SVG猫へ戻す
- CSS図形だけで猫や部屋を完成扱いする
- 猫と背景を1枚へ焼き込む
- 透明DOMボタンを重ねる
- 行動を文章だけで説明する
- 猫を常に正面向きにする
- 指を離した後だけ反応する
- 3匹を別々の骨格で同時制作する
- いきなりフル3D化する
- マッチ3、2048、無関係なランゲーム
- AIで猫を人間のように喋らせる
- AIを初期版の必須機能にする
- 食事課金、治療課金、死亡回避課金
- 週額サブスクリプション
- 食事中、睡眠中、撫でている途中の広告
- 発売時のチャット、ランキング、共同飼育
- Web完成までiOSを待つ
- 実機未確認を実機確認済みと断定する
- mainへビルド失敗状態を反映する

---

## 13. 報告と納品ルール

各作業報告には必ず以下を含める。

- 何を変更したか
- なぜ変更したか
- 残る問題
- GitHubコミットSHA
- GitHub Actions結果
- Vercel確認URL
- Vercelデプロイ状態
- 画面スクリーンショット
- 確認した端末サイズ
- 実機確認の有無
- OK/NGの根拠

完成していないものを完成と書かない。

---

## 14. Work開始時の最重要判断

次のWorkは、v0.6／v0.7の仮素材へ戻ったり、pixel artへsmooth filterを掛けたり、WebGL失敗をCanvas fallbackで隠したりしてはいけない。

v0.8のruntime SHA、Quality Gate Run 54、3サイズPNG、Vercel READY／HTTP 200は同じsoftware evidenceへ結び付け済み。次のWorkは物理iPhoneと実GPUのhardware gateを最初に閉じる。hardware gateを確認せず「実機検証済み」または「v0.8全面合格」と書かない。

その後は次の順序を守る。

1. v0.9: 撫でている最中に部位別反応を返す
2. v0.10: 食事が接近、匂い、咀嚼まで画面上で起こる
3. v0.11: 複数寝床と睡眠習慣で睡眠を深める
4. v0.12: drag玩具、箱、袋、発見記録へ遊びを広げる

Canvas/WebGL基盤、216×472 world、8px grid、固定2倍camera、6分離layer、v6保存互換性、CI WebGL smokeを土台として進める。この順番を崩さない。
