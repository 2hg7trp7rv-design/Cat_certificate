const frame = (y = 0, angle = 0) => Object.freeze({ y, angle })

/**
 * Source-locked root motion. Only translation and rotation are allowed here;
 * non-uniform scale, cross-fade and regenerated replacement cats are forbidden.
 */
export const CAT_KINEMATIC_PROFILES = Object.freeze({
  walk: Object.freeze([
    frame(0, 0),
    frame(-1, 0.2),
    frame(-2, 0),
    frame(-1, -0.2),
    frame(0, 0),
    frame(-1, 0),
  ]),
  'play-notice': Object.freeze([
    frame(0, 0),
    frame(0, -0.35),
    frame(0, -0.7),
    frame(0, -0.9),
  ]),
  'play-crouch': Object.freeze([
    frame(0, -0.4),
    frame(1, -0.6),
    frame(1, -0.8),
    frame(0, -0.6),
    frame(0, -0.3),
    frame(0, 0),
  ]),
  'play-pounce': Object.freeze([
    frame(0, -1),
    frame(-8, -0.5),
    frame(-18, 0.5),
    frame(-24, 1),
    frame(-12, 0.5),
    frame(0, 0),
  ]),
  'play-recover': Object.freeze([
    frame(0, 0.5),
    frame(-3, 0.3),
    frame(-1, 0),
    frame(0, -0.2),
    frame(0, 0),
    frame(0, 0),
  ]),
})

const STILL = frame(0, 0)

export const resolveCatKinematicTransform = (state, frameIndex = 0) => {
  const profile = CAT_KINEMATIC_PROFILES[state]
  if (!profile?.length) return STILL
  const index = Math.max(0, Math.floor(Number(frameIndex) || 0)) % profile.length
  return profile[index]
}

export default resolveCatKinematicTransform
