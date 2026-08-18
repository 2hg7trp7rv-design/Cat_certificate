# Tail Room Motion Bible

更新日: 2026-08-18 JST  
対象: Creator Preview 0.8以降

## 1. 原則

猫を常時激しく動かさない。生命感は、予備動作、本動作、余韻、静かな間から作る。

- renderは60fpsを目標とする
- sprite animationは原則8〜12fps
- pounceだけ12〜15fpsを許可する
- frameごとの表示時間を変え、均一loopを避ける
- 同時に複数の大動作を再生しない
- background中の未再生animationを復帰時に高速再生しない
- 同じ行動を3回連続で選ばない

## 2. 行動優先順位

1. Scene停止、復帰、安全処理
2. 睡眠、空腹、低energy
3. プレイヤーへの短い反応
4. 窓、玩具、ラグなどの自主行動
5. 呼吸、瞬き、耳、視線、尾の微細動作

眠っている猫は玩具操作で必ず起こさない。耳を向ける、片目を開く、寝返りを打つ反応を許可する。

## 3. 家具アンカー

| Anchor | 用途 | 許可姿勢 |
|---|---|---|
| `center-idle` | 通常待機 | sit, stand, loaf |
| `rug-play` | 一人遊び | crouch, pounce, catch, lie |
| `bed-sleep` | 睡眠 | curl, side |
| `bowl-wait` | 空腹 | stand, sit, look |
| `window-watch` | 観察 | sit, look |

各anchorは足元座標、向き、進入口、退出口、接地影、前景遮蔽を持つ。ソファへの跳躍とtower昇降はv0.8の範囲外。

## 4. 基本animation

| State | Frames | Rhythm |
|---|---:|---|
| idle breathing | 4 | 2.8〜4.0秒 |
| blink | 4 | 0.24〜0.36秒 |
| ear | 3 | 0.18〜0.30秒 |
| look | 5 | 0.45〜0.75秒 |
| tail | 6 | 0.8〜1.4秒の後に休止 |
| stand / sit | 各6 | 8〜10fps |
| lie | 8 | 8〜10fps |
| walk | 6 | 10〜12fps |
| turn | 5 | 8〜10fps |
| curl transition | 8 | 8〜10fps |
| curl sleep | 4 | 3.6〜5.0秒 |
| side transition | 7 | 8〜10fps |
| side sleep | 4 | 3.6〜5.0秒 |
| play notice | 4 | 8〜10fps |
| play crouch | 6 | 8〜10fps＋溜め |
| play pounce | 6 | 12〜15fps |
| play catch | 6 | 10〜12fps |
| play recover | 6 | 8〜10fps |

## 5. 完成sequence

### 丸寝

`bedを見る → bedへ歩く → 確認 → 向きを変える → 前足を畳む → 丸くなる → 寝息`

### 横寝

`rugまたはbedへ歩く → 伏せる → 横へ倒れる → 足を伸ばす → 寝息 → 稀な寝返り`

### 一人遊び

`toyへ気づく → 耳と視線 → crouch → 腰を小さく振る → pounce → 前足で捕獲 → 離す → 座り直す`

playは最後に必ずtoyを捕まえる。永久追跡にしない。

## 6. 中断規則

- blinkとearは即時中断可能
- walkは次の足接地で中断可能
- pounce、curl transition、wakeは完了まで中断不可
- pointer連打によるreactionをqueueしない
- sleep中のpettingは睡眠姿勢を壊さない短い反応にする

## 7. QA

- 30秒でblink、ear、look、tailのうち最低2種類を確認できる
- 2分の覚醒状態で最低1回は姿勢または場所が変わる
- walk前後に瞬間移動しない
- 停止時の足滑りは1 art px以内
- sleep時に胴体が寝床へ収まる
- curlとsideをsilhouetteだけで区別できる
- playが説明文なしでnotice、crouch、pounce、catchと読める
- seed固定時に同じsequenceを再現できる
