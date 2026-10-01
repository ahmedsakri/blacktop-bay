import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const all=JSON.parse(fs.readFileSync(root+'/reports/circuit-research/source-circuits.geojson')).features;
const records=[
['melbourne','Albert Park','au-1953','Australia','Oceania','australia',5.278,'A flowing lakeside loop with fast direction changes.'],
['shanghai','Shanghai','cn-2004','China','Asia','china',5.451,'Tightening spiral turns, linked sweepers and a long back straight.'],
['suzuka','Suzuka','jp-1962','Japan','Asia','japan',5.807,'Rhythmic esses, a broad Spoon sweep and a fast return.'],
['miami','Miami','us-2022','United States','Americas','miami',5.412,'Stadium-side switchbacks linking three acceleration zones.'],
['montreal','Gilles Villeneuve','ca-1978','Canada','Americas','canada',4.361,'Island straights, chicanes and a widened return hairpin.'],
['monaco','Monaco','mc-1929','Monaco','Europe','monaco',3.337,'A compact harbour circuit with a widened hotel hairpin.'],
['barcelona','Barcelona-Catalunya','es-1991','Spain','Europe','barcelona-catalunya',4.657,'Long loaded sweepers and a flowing final sector.'],
['spielberg','Red Bull Ring','at-1969','Austria','Europe','austria',4.326,'A short triangular course with three big acceleration zones.'],
['silverstone','Silverstone','gb-1948','United Kingdom','Europe','great-britain',5.891,'Fast airfield sweepers and the linked Maggotts-Becketts sequence.'],
['spa','Spa-Francorchamps','be-1925','Belgium','Europe','belgium',7.004,'A long forest course with sweeping bends and the Bus Stop.'],
['hungaroring','Hungaroring','hu-1986','Hungary','Europe','hungary',4.381,'A twisting sequence of linked corners with few rests.'],
['zandvoort','Zandvoort','nl-1948','Netherlands','Europe','netherlands',4.259,'A winding dune circuit with a broad final sweep.'],
['monza','Monza','it-1922','Italy','Europe','italy',5.793,'Long straights, softened chicanes and the sweeping Parabolica.'],
['madring','Madring','es-2026','Spain','Europe','spain',5.414,'A street-and-permanent hybrid with a broad Monumental loop.'],
['baku','Baku City','az-2016','Azerbaijan','Asia','azerbaijan',6.003,'Right-angle city corners and a long seafront blast.'],
['sepang','Sepang','my-1999','Malaysia','Asia','bahrain',5.543,'Wide linked bends and twin straights joined by a hairpin.'],
['singapore','Marina Bay','sg-2008','Singapore','Asia','singapore',4.927,'A technical city loop with the revised waterfront straight.'],
['austin','Circuit of the Americas','us-2012','United States','Americas','united-states',5.513,'A broad hairpin, flowing esses and a long back straight.'],
['mexico','Hermanos Rodríguez','mx-1962','Mexico','Americas','mexico',4.304,'Long straights lead to esses and a slow stadium section.'],
['interlagos','Interlagos','br-1940','Brazil','Americas','brazil',4.309,'A compact anti-clockwise bowl with flowing outer sweepers.'],
['lasvegas','Las Vegas Strip','us-2023','United States','Americas','las-vegas',6.201,'A long Strip straight, right-angle turns and a rounded Sphere loop.'],
['lusail','Lusail','qa-2004','Qatar','Middle East','qatar',5.419,'A sequence of high-speed sweepers and a long main straight.'],
['yasmarina','Yas Marina','ae-2009','United Arab Emirates','Middle East','united-arab-emirates',5.281,'A flowing modern layout with long straights and a broad marina loop.'],
['sakhir','Bahrain International','bh-2002','Bahrain','Middle East','bahrain',5.412,'Desert straights linked by hairpins and a technical middle sector.'],
['jeddah','Jeddah Corniche','sa-2021','Saudi Arabia','Middle East','saudi-arabia',6.174,'A fast narrow silhouette with flowing waterfront bends.'],
];
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
function resample(p,n=120){let lens=[0];for(let i=0;i<p.length;i++)lens.push(lens.at(-1)+dist(p[i],p[(i+1)%p.length]));let j=0;return Array.from({length:n},(_,i)=>{const s=lens.at(-1)*i/n;while(lens[j+1]<s)j++;const f=(s-lens[j])/(lens[j+1]-lens[j]);return [0,1].map(a=>p[j][a]+(p[(j+1)%p.length][a]-p[j][a])*f);});}
function smooth(p,sigma){const k=Math.ceil(sigma*3),ws=Array.from({length:k*2+1},(_,i)=>Math.exp(-.5*((i-k)/sigma)**2)),w=ws.reduce((a,b)=>a+b);return p.map((_,i)=>[0,1].map(a=>ws.reduce((s,v,j)=>s+v*p[(i+j-k+p.length)%p.length][a],0)/w));}
function adapt(f,id){
 const coords=f.geometry.coordinates.slice(0,-1);const lat=coords.reduce((a,p)=>a+p[1],0)/coords.length,lon=coords.reduce((a,p)=>a+p[0],0)/coords.length;
 let p=coords.map(c=>[(c[0]-lon)*111320*Math.cos(lat*Math.PI/180),-(c[1]-lat)*111320]);
 const length=p.reduce((s,v,i)=>s+dist(v,p[(i+1)%p.length]),0);
 const target=({monaco:2400,montreal:2650,spa:3200,shanghai:3000,madring:2850,jeddah:2850,sepang:2900})[id]||2700;
 p=p.map(v=>v.map(x=>x*target/length));p=smooth(resample(p,160),.8);
 // Suzuka's real overpass cannot be represented by the game's planar collision system.
 // Original unrolled rhythm course: grid -> opening bends -> S curves -> Degners ->
 // hairpin -> Spoon-style outer sweep -> fast return -> final chicane.
 if(id==='suzuka')return [[-150,-210],[-65,-210],[30,-210],[150,-200],[205,-150],[200,-92],[155,-65],[125,-20],[155,22],[118,67],[150,106],[116,143],[35,145],[-18,104],[-72,132],[-98,197],[-173,220],[-231,175],[-240,95],[-212,16],[-233,-58],[-198,-125],[-211,-175],[-194,-206]].map(v=>v.map(x=>x*1.5));
 const base=p.map(v=>[...v]);
 for(let iter=0;iter<150;iter++){
  const n=p.length,forces=p.map((v,i)=>[0,1].map(a=>(p[(i+n-1)%n][a]+p[(i+1)%n][a]-2*v[a])*.045+(base[i][a]-v[a])*.015));
  for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){
   const sep=Math.min(j-i,n-j+i);if(sep<5)continue;
   const d=dist(p[i],p[j]);if(d>=46||d<.01)continue;
   const force=(46-d)*.18;for(let a=0;a<2;a++){const v=(p[i][a]-p[j][a])/d*force;forces[i][a]+=v;forces[j][a]-=v;}
  }
  p=p.map((v,i)=>v.map((x,a)=>x+forces[i][a]));
 }
 p=smooth(resample(p,120),.7);
 // Reposition the grid to the flattest 110m straight; preserves travel direction.
 let best=Infinity,start=0;
 for(let i=0;i<p.length;i++){
  let score=0;for(let k=-1;k<=6;k++){const a=p[(i+k+120)%120],b=p[(i+k+1+120)%120],c=p[(i+k+2+120)%120];const t=Math.atan2(b[1]-a[1],b[0]-a[0])-Math.atan2(c[1]-b[1],c[0]-b[0]);score+=Math.atan2(Math.sin(t),Math.cos(t))**2;}if(score<best){best=score;start=i;}
 }
 p=[...p.slice(start),...p.slice(0,start)];
 const bounds=[0,1].map(a=>(Math.min(...p.map(v=>v[a]))+Math.max(...p.map(v=>v[a])))/2);
 return p.map(v=>v.map((x,a)=>Math.round((x-bounds[a])*100)/100));
}
const pack=records.map(([id,name,dataId,country,region,slug,realLengthKm,description],i)=>({id,name,venueName:all.find(f=>f.properties.id===dataId).properties.Name,description,country,region,series:'grand-prix',season:2026,calendarStatus:i<23?'current':'original-calendar-bonus',round:i<23?i+1:null,sourceUrl:`https://www.formula1.com/en/racing/${i<23?2026:2025}/${slug}`,dataSourceUrl:`https://github.com/bacinger/f1-circuits/blob/394d8fbe70ef2c0b0c8d23ff7bee61fa09606055/circuits/${dataId}.geojson`,realLengthKm,environment: ['sakhir','lusail'].includes(id)?'desert':['madring','baku','singapore','mexico','lasvegas','yasmarina'].includes(id)?'urban':['melbourne','miami','montreal','monaco','zandvoort','sepang','jeddah'].includes(id)?'coastal':'parkland',layoutKind:'compact-adaptation',adaptationNote:id==='suzuka'?'Non-crossing reinterpretation: the real figure-eight overpass is unrolled for planar racing. Corner sequence and scale are adapted.':id==='madring'?'Compact adaptation of the published venue outline; La Monumental is flattened and widened. Not a surveyed replica.':'Compact, flattened arcade adaptation. Hairpins and chicanes are widened; the starting grid may be relocated for safe racing.',width:16,points:adapt(all.find(f=>f.properties.id===dataId),id)}));
fs.writeFileSync(root+'/src/grand-prix-circuits.js',`// Compact adaptations of geographic outlines, not surveyed replicas or official game assets.\n// Derived from f1-circuits by Tomislav Bacinger (MIT), source commit\n// 394d8fbe70ef2c0b0c8d23ff7bee61fa09606055. Full notice: /credits/f1-circuits-MIT.txt.\n// Calendar verified on 2026-10-01; see reports/grand-prix-circuit-research.md.\nexport const GRAND_PRIX_CIRCUITS = [${pack.map(({points,...record})=>JSON.stringify(record,null,2).slice(0,-2)+',\n  \"points\": ['+points.map(p=>JSON.stringify(p)).join(',')+']\n}').join(',\n')}];\n`);

