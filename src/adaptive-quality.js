import {normalizeQuality, qualitySettings} from './render-quality.js';

const INTERRUPTION_WINDOW_MS=30000, INTERRUPTION_COOLDOWN_MS=4000, INTERRUPTION_LIMIT=3;

// The controller measures rendered-frame intervals, not requestAnimationFrame
// callbacks or CPU submission alone. It never claims to measure GPU/thermal cost.
// Menus, hidden tabs, intentional <=30 Hz caps and loading must be excluded by
// the caller. A single hitch or pause cannot downgrade a whole race.
export function createAdaptiveQuality({mobile=false,dpr=1,choice='auto',width=0,height=0,deviceMemory,hardwareConcurrency}={}) {
 choice=normalizeQuality(choice);
 const display={mobile,dpr,width,height,deviceMemory,hardwareConcurrency};
 let level=0,elapsed=0,warmup=2,cooldown=0,good=0,frames=[],severeTime=0,severeCount=0;
 let interruptions=[],lastInterruptionTime=null,interruptionReadyAt=0;
 const status={level:0,p75Ms:0,samples:0,reason:'warming up',changes:0};
 const settings=()=>qualitySettings(choice,{...display,adaptiveLevel:level});
 return {
  status,get settings(){return settings();},
  configure(options={}) {
   const next=normalizeQuality(options.choice??choice);
   if(next!==choice){interruptions=[];lastInterruptionTime=null;interruptionReadyAt=0;severeTime=0;severeCount=0;level=0;elapsed=0;warmup=2;good=0;cooldown=0;frames=[];status.level=0;}
   choice=next;for(const key of Object.keys(display))if(options[key]!==undefined)display[key]=options[key];
   return settings();
  },
  // Pausing resets frame sampling, but repeated active interruptions must survive
  // that pause. Their independently bounded wall-time history expires below.
  reset(){elapsed=0;warmup=2;good=0;frames=[];severeTime=0;severeCount=0;},
  // Caller reports only a long active-driving interruption that caused a pause,
  // never hidden-tab time, loading, an intentional frame cap or an ordinary pause.
  // This changes rendering work only; the race clock remains owned by its caller.
  noteInterruption(now,{active=true}={}) {
   if(choice!=='auto'||!active||!Number.isFinite(now)||now<0)return false;
   if(lastInterruptionTime!==null&&now<=lastInterruptionTime){
    if(now===lastInterruptionTime)return false;
    interruptions=[];interruptionReadyAt=0;
   }
   lastInterruptionTime=now;
   interruptions=interruptions.filter(time=>now-time<=INTERRUPTION_WINDOW_MS);
   if(now<interruptionReadyAt){interruptions=[];return false;}
   interruptions.push(now);interruptions=interruptions.slice(-INTERRUPTION_LIMIT);
   if(interruptions.length<INTERRUPTION_LIMIT||level>=3)return false;
   level++;status.level=level;status.samples=interruptions.length;status.p75Ms=0;
   status.reason='repeated active interruptions';status.changes++;
   interruptions=[];interruptionReadyAt=now+INTERRUPTION_COOLDOWN_MS;
   elapsed=0;warmup=2;cooldown=Math.max(cooldown,4);good=0;frames=[];severeTime=0;severeCount=0;
   return true;
  },
  sample(frameMs,{active=true}={}) {
   if(choice!=='auto'||!active||!Number.isFinite(frameMs)||frameMs<1){frames=[];elapsed=0;good=0;severeTime=0;severeCount=0;return false;}
   const dt=Math.min(frameMs,500)/1000;cooldown=Math.max(0,cooldown-dt);
   if(frameMs>150){
    // One upload or resumed-tab hitch is not sustained pressure. Consecutive
    // severe intervals are: do not discard them forever at the highest tier.
    severeTime+=dt;severeCount++;good=0;
    if(severeCount>=4&&severeTime>=2&&cooldown===0&&level<3){
     status.samples=severeCount;level++;cooldown=4;warmup=0;elapsed=0;frames=[];severeTime=0;severeCount=0;
     interruptions=[];status.level=level;status.p75Ms=frameMs;status.reason='sustained severe frames';status.changes++;return true;
    }
   }else{severeTime=0;severeCount=0;}
   // Mixed severe/healthy intervals still belong in p75. Alternating stalls
   // are sustained low frame rate, not a series of harmless isolated hitches.
   if(warmup>0){warmup-=dt;return false;}
   elapsed+=dt;frames.push(frameMs);
   if(elapsed<2||frames.length<30)return false;
   frames.sort((a,b)=>a-b);const p75=frames[Math.floor((frames.length-1)*.75)];
   status.p75Ms=Math.round(p75*10)/10;status.samples=frames.length;
   const duration=elapsed;elapsed=0;frames=[];
   if(p75>26&&level<3&&cooldown===0){level++;cooldown=4;good=0;status.reason='sustained slow frames';}
   else if(p75<18.5&&level>0){good+=duration;if(good>=14&&cooldown===0){level--;cooldown=8;good=0;status.reason='sustained headroom';}else return false;}
   else {good=0;return false;}
   interruptions=[];status.level=level;status.changes++;return true;
  },
 };
}
