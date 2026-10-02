const clamp=v=>Math.max(-1,Math.min(1,Number.isFinite(v)?v:0));
export function readGamepad(pad,{swap=false,deadzone=.13}={}) {
  if(!pad?.connected||pad.mapping!=='standard')return {connected:false,steer:0,nitro:false,brake:false,pause:false};
  const raw=clamp(pad.axes?.[0]),magnitude=Math.abs(raw);
  const steer=magnitude<=deadzone?0:Math.sign(raw)*(magnitude-deadzone)/(1-deadzone);
  const pressed=i=>Boolean(pad.buttons?.[i]?.pressed||pad.buttons?.[i]?.value>.5);
  return {connected:true,steer:clamp(steer+Number(pressed(15))-Number(pressed(14))),nitro:pressed(swap?1:0)||pressed(7),brake:pressed(swap?0:1)||pressed(6),pause:pressed(9)};
}
