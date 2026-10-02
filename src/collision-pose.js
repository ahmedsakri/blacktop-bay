const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number.isFinite(n)?n:a));
/** Presentation follows a real, timed engine wreck; it never moves colliders. */
export function collisionPose(racer,{reducedMotion=false}={}) {
  const zero={yaw:0,pitch:0,roll:0,lift:0};
  if(reducedMotion||racer?.wreck?.phase!=='impact')return zero;
  const progress=clamp((.7-racer.wreck.remaining)/.7,0,1),pulse=Math.sin(progress*Math.PI);
  const strength=clamp(racer.wreck.strength,.45,1),impact=racer.impact||{},yaw=racer.car?.yaw||0;
  const direction=Math.sign((impact.nx||0)*Math.cos(yaw)-(impact.nz||0)*Math.sin(yaw))||1;
  return {yaw:direction*pulse*.75*strength,pitch:pulse*.16*strength,roll:-direction*pulse*.62*strength,lift:pulse*.24*strength};
}
