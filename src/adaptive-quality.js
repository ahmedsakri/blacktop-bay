import {normalizeQuality, qualitySettings} from './render-quality.js';

// The controller measures rendered-frame intervals, not requestAnimationFrame
// callbacks or CPU submission alone. It never claims to measure GPU/thermal cost.
// Menus, hidden tabs, intentional <=30 Hz caps and loading must be excluded by
// the caller. A single hitch or pause cannot downgrade a whole race.
export function createAdaptiveQuality({mobile=false,dpr=1,choice='auto'}={}) {
 choice=normalizeQuality(choice);
 let level=0,elapsed=0,warmup=2,cooldown=0,good=0,frames=[];
 const status={level:0,p75Ms:0,samples:0,reason:'warming up',changes:0};
 const settings=()=>qualitySettings(choice,{mobile,dpr,adaptiveLevel:level});
 return {
  status,get settings(){return settings();},
  configure(options={}) {
   const next=normalizeQuality(options.choice??choice);
   if(next!==choice){level=0;elapsed=0;warmup=2;good=0;cooldown=0;frames=[];status.level=0;}
   choice=next;mobile=options.mobile??mobile;dpr=options.dpr??dpr;
   return settings();
  },
  reset(){elapsed=0;warmup=2;good=0;frames=[];},
  sample(frameMs,{active=true}={}) {
   if(choice!=='auto'||!active||!Number.isFinite(frameMs)||frameMs<1||frameMs>150){frames=[];elapsed=0;good=0;return false;}
   const dt=frameMs/1000;cooldown=Math.max(0,cooldown-dt);
   if(warmup>0){warmup-=dt;return false;}
   elapsed+=dt;frames.push(frameMs);
   if(elapsed<2||frames.length<30)return false;
   frames.sort((a,b)=>a-b);const p75=frames[Math.floor((frames.length-1)*.75)];
   status.p75Ms=Math.round(p75*10)/10;status.samples=frames.length;
   const duration=elapsed;elapsed=0;frames=[];
   if(p75>26&&level<3&&cooldown===0){level++;cooldown=4;good=0;status.reason='sustained slow frames';}
   else if(p75<18.5&&level>0){good+=duration;if(good>=14&&cooldown===0){level--;cooldown=8;good=0;status.reason='sustained headroom';}else return false;}
   else {good=0;return false;}
   status.level=level;status.changes++;return true;
  },
 };
}
