# Tail Room v0.8 Implementation Contract

更新日: 2026-08-18 JST

## Scope

v0.8は、v0.7のWebGL・状態・入力・保存互換性を維持しながら、世界をpixel artへ置き換え、猫の生命感、代表的な睡眠、代表的な一人遊び、温かいUIを成立させる。

### Implement now

- pixel rendering configuration
- separated pixel room/furniture/cat/shadow/light textures
- warm DOM UI
- idle, blink, ear, look, tail
- stand, sit, loaf, lie, turn, walk
- curl sleep and side sleep
- one autonomous toy sequence
- behavior anchors and deterministic QA controls

### Keep for later depth

- v0.9: 部位別の撫で、継続中反応、拒否、触覚
- v0.10: 食器量、匂い、咀嚼、口舐め
- v0.11: 複数寝床、睡眠習慣、深夜反応
- v0.12: drag猫じゃらし、複数玩具、箱、袋、発見記録

## Release gate

- `npm run check`
- v0.8 architecture and state tests
- GitHub Actions WebGL smoke
- 320×667、393×852、430×932 evidence
- Vercel production READY and canonical URL HTTP 200
- physical iPhone and hardware GPU remain explicitly unverified until performed
