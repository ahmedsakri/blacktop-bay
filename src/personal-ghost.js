export const TRIAL_RULES='handling-20261002-v1';
const finite=v=>typeof v==='number'&&Number.isFinite(v);
export function recordScope({track,vehicle,mode,difficulty,stock=false,upgrades={},setup='balanced'}) {
 const levels=['engine','tyres','nitro','handling'].map(k=>Math.max(0,Math.min(5,Number(upgrades[k]||0)))).join('');
 return `${track}-${vehicle}-${mode}-${mode==='time-attack'?'solo':difficulty}-${stock&&mode==='time-attack'?'stock':levels+'-'+setup}-${TRIAL_RULES}`;
}
export function interpolateGhost(frames,time) {
 if(!Array.isArray(frames)||frames.length<2||!finite(time)||time<frames[0].t||time>frames.at(-1).t)return null;
 let low=0,high=frames.length-1;
 while(low+1<high){const mid=(low+high)>>1;if(frames[mid].t<=time)low=mid;else high=mid;}
 const a=frames[low],b=frames[high],f=Math.max(0,Math.min(1,(time-a.t)/(b.t-a.t)));
 const blend=(k,fallback=0)=> (finite(a[k])?a[k]:fallback)+((finite(b[k])?b[k]:fallback)-(finite(a[k])?a[k]:fallback))*f;
 const angle=Math.atan2(Math.sin(b.yaw-a.yaw),Math.cos(b.yaw-a.yaw));
 return {x:blend('x'),y:blend('y'),z:blend('z'),yaw:a.yaw+angle*f,pitch:blend('pitch'),roll:blend('roll'),progress:blend('progress')};
}
const progressIndexes=new WeakMap();
export function ghostTimeAtProgress(frames,progress) {
 if(!finite(progress)||progress<=0||!frames?.length||!finite(frames[0].progress))return null;
 let crossings=progressIndexes.get(frames);
 if(!crossings){crossings=[];let furthest=frames[0].progress;for(let i=1;i<frames.length;i++){const a=frames[i-1],b=frames[i];if(finite(a.progress)&&finite(b.progress)&&b.progress>furthest&&b.progress>a.progress){crossings.push({a,b,start:furthest,end:b.progress});furthest=b.progress;}}progressIndexes.set(frames,crossings);}
 let low=0,high=crossings.length;while(low<high){const mid=(low+high)>>1;if(crossings[mid].end<progress)low=mid+1;else high=mid;}
 const segment=crossings[low];if(!segment||progress<=segment.start)return null;
 const {a,b}=segment;return a.t+(b.t-a.t)*(progress-a.progress)/(b.progress-a.progress);
}
export function createGhostTiming(frames){let nextSector=1;const sectors=[];return {
 update(progress,elapsed){let changed=false;while(nextSector<=12&&progress>=nextSector/12){const target=ghostTimeAtProgress(frames,nextSector/12);sectors.push({sector:nextSector,time:elapsed,delta:target===null?null:elapsed-target});nextSector++;changed=true;}return {changed,sectors:[...sectors],last:sectors.at(-1)||null};},
};}
export function challengeURL({origin='https://camber-reign.web.app',track,vehicle,time}) {
 const hash=new URLSearchParams({challenge:'stock',car:vehicle,time:Number(time).toFixed(2),rules:TRIAL_RULES});return `${origin}/circuits/${track==='harbor'?'harbor':track}/#${hash}`;
}
export function readChallenge(hash,{cars,tracks,track}){try{const p=new URLSearchParams(hash.replace(/^#/,'')),time=Number(p.get('time'));if(p.get('challenge')!=='stock'||p.get('rules')!==TRIAL_RULES||!cars.includes(p.get('car'))||!tracks.includes(track)||!finite(time)||time<=0||time>900)return null;return {vehicle:p.get('car'),track,time};}catch{return null;}}
