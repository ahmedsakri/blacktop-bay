const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const finite=(v,f=0)=>Number.isFinite(v)?v:f;
/** Bounded, damped suspension presentation driven by actual driving forces. */
export function createChassisMotion() {
  let lastSpeed=0, pitch=0, roll=0, heave=0, compression=0, lastLanding=0, lastImpact=0,identity,wasActive=false;
  const snapshot=()=>({pitch,roll,heave,front:clamp(-pitch*.9+heave,-.07,.06),rear:clamp(pitch*.9+heave,-.07,.06)});
  return {
    update({speed=0,steering=0,brake=0,air,impact,active=true,paused=false,raceId}={},dt=0) {
      dt=clamp(finite(dt),0,.06); speed=finite(speed);
      if(identity!==raceId){identity=raceId;pitch=roll=heave=compression=0;lastLanding=lastImpact=0;lastSpeed=speed;wasActive=false;}
      // Keep actual road velocity separate from wheel animation speed. Pause
      // and resume must not manufacture a 0-to-30 m/s acceleration impulse.
      if(paused){lastSpeed=speed;wasActive=false;return snapshot();}
      if(active&&!wasActive)lastSpeed=speed;
      const acceleration=dt>0?clamp((speed-lastSpeed)/dt,-24,15):0; lastSpeed=speed;
      wasActive=active;
      if(Number.isSafeInteger(air?.event?.id)&&air.event.id<lastLanding)lastLanding=0;
      if(Number.isSafeInteger(impact?.id)&&impact.id<lastImpact)lastImpact=0;
      if (air?.event?.kind==='landing' && air.event.id!==lastLanding) {compression=.055;lastLanding=air.event.id;}
      if (impact?.id && impact.id!==lastImpact) {compression=Math.max(compression,.025*finite(impact.strength));lastImpact=impact.id;}
      compression*=Math.exp(-dt*11);
      const grounded=air?.phase!=='airborne';
      // Front is +Z: negative X rotation lifts the nose. Positive steering
      // turns driver-right (-X), so outward body lean is negative Z rotation.
      const targetPitch=active&&grounded?clamp(-acceleration*.0022+finite(Number(brake))*.018,-.035,.055):0;
      const targetRoll=active&&grounded?clamp(-finite(steering)*Math.abs(speed)*.0014,-.046,.046):0;
      const blend=1-Math.exp(-dt*9);
      pitch+=(targetPitch-pitch)*blend;roll+=(targetRoll-roll)*blend;
      heave+=((-compression)-heave)*(1-Math.exp(-dt*15));
      return snapshot();
    },
  };
}
