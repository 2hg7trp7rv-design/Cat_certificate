# Tail Room v0.7 Validation

検証日: 2026-08-18 JST

## 判定

v0.7の描画基盤は、リポジトリ構造、静的ビルド、Vercel配信、CI上のソフトウェアWebGL描画と主要タッチ導線まで合格しています。

実iPhone、iOS Safari、実GPUの性能は未確認です。そのため、v0.7の「基盤実装」は完了ですが、「実機を含む全面合格」は未達です。

## 検証済みチェックポイント

| 項目 | 結果 |
|---|---|
| GitHub commit | `368a2cd99d6013460a16004992225fe67c290fd3` |
| Quality Gate | [Run 46](https://github.com/2hg7trp7rv-design/Cat_room/actions/runs/32046435711) — success |
| WebGL evidence artifact | `tail-room-v0.7-webgl-smoke`, artifact `9293080360` |
| Vercel deployment | `dpl_Ad8LYruuA4UG5BskZvpVijdD6naY` — READY / production |
| 公開確認URL | `https://cat-certificate.vercel.app` — HTTP 200 |
| Phaser | 4.2.1、`Phaser.WEBGL`固定 |
| Vendor SHA-256 | `f4c5fd140d118c10fa9090641a03c17303bab9bfdc28e0626296777db1bb1bde` |

Run 46のartifact `9293080360`は2026-08-24 16:38:40 UTCに失効する。90日保存の設定は、この文書を反映するコミット後に生成される新しいartifactから適用する。

## 自動検証環境

- GitHub-hosted `ubuntu-24.04`
- Chrome `151.0.7922.108`
- ChromeDriver `151.0.7922.77`
- WebGL 1.0
- ANGLE / Vulkan / SwiftShader
- 日本語表示用Noto CJK
- Node.js `22.23.2`

3サイズは1200×1100のdesktop headless Chrome内で`#app`をCSS指定し、element screenshotを取得したもの。mobile viewport、mobile UA、DPR、iPhone emulationではない。

SwiftShaderの起動フラグはChromium公式方針に合わせている。これはCIでWebGLコードパスを実行するためであり、実機GPUの代替ではない。

## 合格した内容

| 対象 | 根拠 |
|---|---|
| 静的成果物 | `dist/`を現行ソースから生成し、ソースとのbyte parityをテスト |
| Renderer | WebGL 1.0 context active、context lostなし、Canvas fallbackなし |
| 構造 | room、shadow、furniture、cat、foreground、lightの6レイヤー |
| アート分離 | 23個の仮ラスターパーツ。猫と部屋の焼き込みなし |
| 入力 | 透明DOMホットスポットなし。Canvas形状判定 |
| 320×667 | app 320×667、PNG 320×667、横overflowなし |
| 393×852 | app 393×852、PNG 393×852、横overflowなし |
| 430×932 | app 430×932、PNG 430×932、横overflowなし |
| 夜間 | 393×852、21:38相当、猫の目・鼻・輪郭を目視可能 |
| 初回導線 | ゆっくり撫でる → 名前パネル表示 → 既定名「こむぎ」で開始 → RoomScene |
| 部屋入力 | 食器へタッチ → 食事シート表示 |
| Quality Gate | 35 JS files、31 tests、build、browser smokeがsuccess |

## FPS診断値

| サイズ | SwiftShader診断最小 | 診断平均 | 診断最大 |
|---|---:|---:|---:|
| 320×667 | 17.86 | 18.42 | 18.87 |
| 393×852 | 11.90 | 14.18 | 15.65 |
| 430×932 | 18.05 | 18.43 | 18.73 |

この数値はCPUベースのSwiftShaderとCI負荷を含む。レイアウトや入力のsmokeには使えるが、実GPUの30fps下限を判定する根拠にはしない。実iPhoneで別途測定する。

## 未検証

- 実iPhone Safari
- Apple GPU
- 実機の60fps目標／30fps下限
- バックグラウンド復帰後の描画と状態
- 長時間のcontext loss耐性
- iOSのタッチ遅延
- TestFlight

## 再検証

```sh
npm ci
npm run check
npm run smoke
```

`npm run smoke`にはChrome／ChromeDriverとソフトウェアWebGLが必要。GitHub Actionsでは自動で実行し、3サイズ、夜間、初回導線、食事シートのPNGと`report.json`をartifactへ保存する。

## 公式参照

- [Phaser 4.2.1 release](https://github.com/phaserjs/phaser/releases/tag/v4.2.1)
- [Phaser installation](https://docs.phaser.io/phaser/getting-started/installation)
- [Chromium SwiftShader](https://chromium.googlesource.com/chromium/src/+/main/docs/gpu/swiftshader.md)
- [Chrome 138 WebGL SwiftShader change](https://developer.chrome.com/blog/chrome-138-beta/)
