# Tail Room v0.8 Validation

更新日: 2026-08-18 JST  
対象: Creator Preview 0.8.0

## 1. 判定

現在の判定は**source／structureとローカル品質ゲート合格、release evidence確定待ち**。

v0.8のピクセル描画、猫motion、behavior controller、温かいDOM UIは共有treeへ実装され、ローカル`node scripts/check.mjs`はexit 0で41 JavaScript構文検査・47 testsに合格した。最新SHAのGitHub Actions WebGL smoke、Vercel production、公開PNGは、実際の結果を取得して本書へ記録するまで合格と扱わない。

物理iPhone、iOS Safari、実GPU性能は未検証。CIのソフトウェアWebGLが合格しても実機確認の代わりにはならない。

## 2. Source contract

| 項目 | 実装値 | Source evidence |
|---|---:|---|
| App version | 0.8.0 | `package.json`, `src/main.js` |
| Engine | Phaser 4.2.1 / WebGL固定 | `src/game/config.js`, `vendor/phaser-4.2.1/` |
| World | 216×472 art px | `src/game/world/WorldCamera.js`, `src/game/art/PixelArt.js` |
| Art grid | 8×8 art px | `PIXEL_TEXTURE_MANIFEST.grid` |
| Camera | fixed 2×、integer rounding | `WorldCamera.js`, `config.js` |
| Canvas scale | viewportへ`RESIZE` | `config.js` |
| World layers | 6 | room、shadow、furniture、cat、foreground、light |
| Pixel textures | 131 | room／furniture／shadow／light 18 + cat 113 |
| Cat animation | 21 states／113 frames | `PixelArt.js`, `Cat.js` |
| Cat frame | 96×96 art px | 共通canvas、foot pivot y=88 |
| Autonomous interval | 20〜65秒 | `CatBehaviorController.js` |
| Save schema | version 6 | `src/state.js` |
| LocalStorage key | `tail-room-state-v6` | `src/state.js` |

### Cat states

`idle`, `blink`, `ear`, `look`, `tail`, `stand`, `sit`, `loaf`, `lie`, `walk`, `turn`, `sleep-curl-transition`, `sleep-curl`, `sleep-side-transition`, `sleep-side`, `play-notice`, `play-crouch`, `play-pounce`, `play-catch`, `play-recover`, `welcome`。

### Completed sequences

- 丸寝: 寝床へ移動 → 丸寝transition → 寝息loop
- 横寝: bond条件を満たす猫が寝床へ移動 → 横寝transition → 寝息loop
- 休息: 低energyで寝床へ移動 → 伏せる → 香箱loop
- 窓観察: window anchorへ移動 → 見る → 静かな保持 → 向き直る
- 一人遊び: rugへ移動 → notice → crouch → pounce → catch → recover → sit
- 微細動作: idleの間にblink、ear、look、tailを順序付きで再生

## 3. Automated evidence

以下はroot作業者が最終treeをpush・検証した後に、推測せず実値を記入する。

| Evidence | Required value | Current |
|---|---|---|
| GitHub commit | full SHA | `PENDING` |
| Local quality gate | exit 0、test数 | exit 0、41 JavaScript、47 tests pass |
| Quality Gate | run番号、URL、conclusion | `PENDING` |
| WebGL renderer | active WebGL、Canvas 1個、fallbackなし | `PENDING` |
| Pixel manifest | 131 created、temporary 0 | `PENDING` |
| Layer order | 6層の正確な順序 | `PENDING` |
| First meeting | ゆっくり撫でる → 名前パネル表示 → 既定名で開始 → RoomScene | `PENDING` |
| Room input | cat、food、bed、toyのCanvas形状判定 | `PENDING` |
| 320×667 | 寸法、横scroll、PNG | `PENDING` |
| 393×852 | 寸法、夜間、PNG | `PENDING` |
| 430×932 | 寸法、横scroll、PNG | `PENDING` |
| Static build artifact | artifact名、取得可否 | `PENDING` |

GitHub Actions artifactは`tail-room-v0.8-webgl-smoke`、ローカル出力先は`artifacts/v0.8/`を契約名とする。実際のartifact IDとURLはrun完了後に追記する。

3サイズ検査は、1200×1100のdesktop headless Chrome内で`#app`とCanvasを320×667、393×852、430×932へ固定し、要素単位のPNGを取得する。mobile viewport、mobile UA、DPR、iPhone emulationではないため、実機相当の証拠には使わない。

## 4. Vercel evidence

| Evidence | Required value | Current |
|---|---|---|
| Project | `cats-room` | project ID `prj_x77pFkTy2D8nBYq0QKDZZtV59Bz3` |
| Deployment ID | v0.8 SHA対応 | `PENDING` |
| Deployment state | READY / production | `PENDING` |
| Canonical URL | `https://cat-certificate.vercel.app` | HTTP status `PENDING` |
| Served revision | GitHub SHAと一致 | `PENDING` |

旧deploymentがREADYでもv0.8の証拠にはしない。deployment ID、GitHub SHA、正本URLの応答を同じ報告へ結び付ける。

## 5. Physical-device boundary

### 未実施

- 物理iPhoneでのFirstMeetingSceneとRoomScene
- iOS SafariでのWebGL描画
- ゆっくり撫でる入力と、単純tapの区別
- 猫、食器、寝床、玩具の表示位置とhit位置の一致
- 夜間の目、鼻、耳、足、尾の視認性
- sheet、keyboard、safe-area、orientationの確認
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
| Night readability | `NOT TESTED` |
| Background resume | `NOT TESTED` |
| Screenshot／screen recording | `NOT TESTED` |

## 6. Acceptance rule

v0.8をrelease checkpointと呼べるのは、次をすべて満たした後だけとする。

1. 最終treeで`npm run check`がexit 0
2. 同一SHAのQuality Gateがsuccess
3. WebGL smokeで3対象サイズ、131 textures、6 layers、初回導線、Room入力が合格
4. 同一SHAのVercel deploymentがREADYで正本URLがHTTP 200
5. artifactのreportとPNGを取得して報告へ添付

物理iPhoneの項目は別のhardware gateである。上記5条件を満たしても「実iPhone検証済み」「実GPU 30fps以上」とは書かない。
