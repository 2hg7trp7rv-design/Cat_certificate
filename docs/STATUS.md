# Tail Room Status

更新日: 2026-08-17 JST

## Current

Creator Preview 0.6.0 is live as a rejected visual reference. The next active milestone is **v0.7: Canvas/WebGL rendering rebuild**.

Authoritative handoff: [WORK_HANDOFF.md](WORK_HANDOFF.md)

## Verified current state

- Canonical repository: `2hg7trp7rv-design/Cat_room`
- Branch: `main`
- Creator preview: `https://cat-certificate.vercel.app`
- Current production serves v0.6 and returns HTTP 200
- GitHub Actions Quality Gate is passing
- Real-time state, meal timing, sleep timing, growth, preferences, memories, save data and creator time controls exist

## Keep

- `src/state.js` concepts and tests
- Real-time and offline calculations
- Preferences, memories and growth state
- GitHub Actions quality gate
- Creator time controls

## Replace

- Single baked cat-and-room raster scene
- Base64 scene chunks
- Transparent DOM hotspots
- DOM/CSS game-world rendering
- Text-only action feedback
- Runtime GitHub loading

## Repository issues to clean during v0.7

- `dist/` is stale and still contains old v0.5 output
- `assets_source/scene_day_*.b64` is temporary
- root file `test` contains only `あ` and is unnecessary

## Next milestone

Build a verified v0.7 foundation that:

1. Uses Canvas/WebGL for the game world
2. Separates cat, room, furniture, light and shadow
3. Preserves the state engine
4. Removes transparent DOM hotspots
5. Deploys a static build directly to Vercel
6. Passes CI and mobile-size screenshots before reporting completion

## Not complete

- Final Visual Bible
- Final cat art
- Character rig and frame animation
- Real petting response
- Food animation
- Sleep animation
- Audio
- Native haptics and notifications
- TestFlight
- App Store build
