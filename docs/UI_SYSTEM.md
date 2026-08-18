# Tail Room UI System

更新日: 2026-08-18 JST  
対象: Creator Preview 0.8以降

## 1. 役割分担

Canvas/WebGL:

- 猫
- 部屋
- 家具
- 光と影
- 玩具、食事、睡眠
- world内のtouch feedback

DOM:

- HUD
- 名前入力
- 食事、思い出、設定sheet
- creator/debug
- error、loading
- accessibility用情報

日本語本文をbitmapへ焼き込まない。見出し、数値、icon、borderだけにpixel感を持たせ、本文は同梱した`Tail Room JP`で読む。weight 400／700をTTFとして配信し、読み込み失敗時だけsystem Japanese fontへfallbackする。CI Run 54では両weightの`loaded`を確認済み。

## 2. 色とhierarchy

- 背景: paper cream
- 本文: ink cocoa
- 主要action: deep teal + cream text
- 注意: terracotta + ink text
- 選択: sage + ink text
- 夜HUD: night navy + cream
- 補助border: walnut

通常本文のcontrastは4.5:1以上、大きな文字は3:1以上を下限とする。色だけで状態を伝えず、形、文字、動作を併用する。

## 3. Components

- panel: 角丸glassではなく、pixel notchを持つ紙または布のframe
- primary button: 44px以上、deep teal、2px cocoa shadow
- secondary button: cream、walnut border
- icon button: 44×44px以上、16pxまたは24pxのpixel icon
- field: white/cream、cocoa text、明確なfocus ring
- toast: world操作を遮らず`pointer-events:none`
- sheet backdrop: blurを使わず、半透明night navy

## 4. 画面別

### First meeting

- 最上部に小さなTAIL ROOM mark
- 猫と部屋を主役にし、説明は2行以内
- 撫でguideはpixel handではなく、短い軌跡と日本語で示す
- 命名sheetは入力と開始actionを一画面内に収める

### Room HUD

- 常時表示は名前、日数、思い出、設定だけ
- 空腹や睡眠を数値barへしない
- 猫の行動中はsheetや説明を自動表示しない

### Food / Memory / Creator

- すべて同じpanel、heading、button、spacing tokenを使う
- choiceは44px以上
- creator機能は製品UIと明確に分ける

## 5. Responsive

- 320×667で本文やbuttonが切れない
- 393×852を基準確認画面とする
- 430×932では余白を増やし、UIを比例拡大しない
- safe-area insetを上端・下端に適用する
- 横scrollを発生させない

## 6. Motion and accessibility

- sheet open/closeは120〜180ms
- button pressは2px以内の移動または色変化
- `prefers-reduced-motion`時は装飾animationを止める
- essential state changeは静止frameの差し替えで伝える
- focus-visibleを消さない
- game worldの操作には将来のaccessibility代替操作を用意する
