// Quiet spectators are the majority. These IDs are shared by the live rig,
// offline motion baker and distance renderer, so seated clips cannot drift.
// Bump together whenever any rig, reduced mesh or palette changes. All tiers
// must bypass older cached assets as one compatible geometry/motion release.
export const SPECTATOR_ASSET_VERSION='2026-10-03-affine24-v1';
export const SPECTATOR_GESTURES=Object.freeze(['wave','clap','raised-fist','film','both-hands','watch','folded-hands','conversation']);
export const SPECTATOR_GESTURE_WEIGHTS=Object.freeze([5,5,5,5,5,6,6,6,7,7,0,1,1,2,3,4]);
