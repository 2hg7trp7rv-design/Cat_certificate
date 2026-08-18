# Tail Room v0.8 Validation

更新日: 2026-08-18 JST  
対象: Creator Preview 0.8.0

## 1. 判定

現在の判定は**実装＋CIソフトウェアWebGLゲート合格、実機ゲート未完**。

v0.8のピクセル描画、猫motion、behavior controller、温かいDOM UIはruntime／evidence SHA `0358b05bd2888ef4afa7951d924e95ababda654f`へ実装済み。`node scripts/check.mjs`はexit 0で41 JavaScript構文検査・47 tests、GitHub Actions Quality Gate Run 52は`completed / success`、同じSHAのVercel productionは`READY`となった。Run 52のartifactからreportとPNGも取得済み。

物理iPhone、iOS Safari、hardware GPU性能は`NOT TESTED`。CIのChrome 151＋ANGLE SwiftShaderによるソフトウェアWebGL合格は、実機確認や実GPU fpsの代わりにはならない。

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

`docs/art/v08-room-concept.png`と`docs/art/v08-cat-pose-reference.png`は画像生成を用いたvisual direction資料であり、runtimeへ貼る素材ではない。runtimeの部屋、家具、猫、影、光は131個の分離textureとして生成され、concept／reference画像を背景へ焼き込んでいない。

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

| Evidence | Result | Measured value |
|---|---|---|
| Runtime／evidence commit | 確定 | `0358b05bd2888ef4afa7951d924e95ababda654f` |
| Local／CI quality gate | 合格 | exit 0、41 JavaScript構文検査、47 tests pass |
| Quality Gate | 合格 | [Run 52](https://github.com/2hg7trp7rv-design/Cat_room/actions/runs/32096447738)、job `95588640609`、`completed / success` |
| WebGL renderer | 合格 | Chrome `151.0.7922.108`、WebGL 1、ANGLE SwiftShader、Canvas 1個、context lostなし、fallbackなし |
| Pixel manifest | 合格 | 131 created、131 non-empty、0 reused、`temporary: false` |
| Layer order | 合格 | room、shadow、furniture、cat、foreground、light |
| Japanese UI font | 合格 | `Tail Room JP` 400／700、両face `loaded` |
| First meeting | 合格 | ゆっくり撫でる → 名前panel → 既定名`こむぎ` → RoomScene |
| Room input | 合格 | cat、food sheet、bed touch feedback、toyをCanvas上の位置から操作 |
| Toy sequence | 合格 | walk → notice → crouch → pounce → catch → recover → sit、完了後にroom toyを復元 |
| Sleep sequence | 合格 | walk → curl transition → curl、12秒deadlineに対し2,949msでcurl到達 |
| 320×667 | 合格 | Canvas 320×667、横overflowなし、`room-320x667.png` |
| 393×852 | 合格 | Canvas 393×852、横overflowなし、昼／夜PNGとinteraction PNG |
| 430×932 | 合格 | Canvas 430×932、横overflowなし、`room-430x932.png` |
| Smoke artifact | 取得済み | ID `9310114629`、`tail-room-v0.8-webgl-smoke` |

Artifact digestは`sha256:072eab5dda7ab62a6f1f323442dc83f5ff7338dff287ee6b55e331fe08d7d153`、expires atは`2026-11-16T03:42:32Z`。ローカル出力先の契約名は`artifacts/v0.8/`である。

3サイズ検査は、1200×1100のdesktop headless Chrome内で`#app`とCanvasを320×667、393×852、430×932へ固定し、要素単位のPNGを取得する。mobile viewport、mobile UA、DPR、iPhone emulationではないため、実機相当の証拠には使わない。

### Failure history

- Run 48: 静的checkは通過したが、Phaser 4のContainerに存在しない`setDisplayOrigin()`を`Cat`から呼び、scene遷移時に例外となってWebGL smokeが失敗した。呼び出しを削除し、Container entityでの再使用を禁じるarchitecture testを追加した
- Run 49: 日本語screenshot font setupがGitHub runnerのapt mirrorで停止し、2回目のattemptも含めて最終的に`cancelled`となった
- Run 50: apt取得へtimeoutを追加したがsetupを完了できず、`failure`となった。`Tail Room JP`をリポジトリへ同梱し、workflowからapt依存を除去した
- Run 51: 同梱fontの400／700を両方`loaded`と判定する一方、未使用の400を明示ロードしていなかったため、Room 3ケースが30秒timeoutした。`document.fonts.load()`で両weightを先に読み込み、match数とstatusを検査するよう修正した
- 上記runは合格証拠へ含めない。最終判定はRun 52のreportとartifactによる

## 4. Vercel evidence

| Evidence | Result | Measured value |
|---|---|---|
| Project | 確定 | `cats-room`、project ID `prj_x77pFkTy2D8nBYq0QKDZZtV59Bz3` |
| Deployment ID | 確定 | `dpl_CB63B9ksMX3YQrF2LceQLpx1QSfv` |
| Deployment state | 合格 | `READY / production`、`aliasError: null` |
| Served revision | 合格 | GitHub SHA `0358b05bd2888ef4afa7951d924e95ababda654f`と一致 |
| Canonical URL | 合格 | `https://cat-certificate.vercel.app`、HTTP 200、title `Tail Room — Creator Preview 0.8` |
| Bundled font | 合格 | `/assets/fonts/noto-sans-jp-400.ttf`、HTTP 200、`content-type: font/ttf` |
| Build metadata | 合格 | `/build-meta.json`: version `0.8.0`、engine `phaser-4.2.1`、`runtimeFetches: false` |

旧deploymentがREADYでもv0.8の証拠には使わない。上記deployment ID、runtime／evidence SHA、正本URLの応答を同じ報告へ結び付けた。

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

v0.8のsoftware release checkpointは、次の5条件をSHA `0358b05bd2888ef4afa7951d924e95ababda654f`で満たした。

1. 最終treeで`npm run check`がexit 0
2. 同一SHAのQuality Gateがsuccess
3. WebGL smokeで3対象サイズ、131 textures、6 layers、初回導線、Room入力が合格
4. 同一SHAのVercel deploymentがREADYで正本URLがHTTP 200
5. artifactのreportとPNGを取得して報告へ添付

物理iPhoneの項目は別のhardware gateであり、現時点では未完。上記5条件を満たしても「実iPhone検証済み」「iOS Safari検証済み」「実GPU 30fps以上」とは書かない。次のv0.9作業へ入る前に、このhardware gateを先に閉じる。
