import {sampleTrack} from './track.js';
const WIDTH=320,HEIGHT=200,SEGMENTS=12;
const geometryCache=new WeakMap();
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;

export function raceMapGeometry(track) {
 let cached=geometryCache.get(track);if(cached)return cached;
 let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
 for(const p of track.samples){minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minZ=Math.min(minZ,p.z);maxZ=Math.max(maxZ,p.z);}
 const scale=Math.min(264/Math.max(1,maxX-minX),150/Math.max(1,maxZ-minZ));
 const cx=(minX+maxX)/2,cz=(minZ+maxZ)/2;
 const project=(x,z)=>({x:160+(finite(x,cx)-cx)*scale,y:96+(finite(z,cz)-cz)*scale});
 const points=track.samples.map(p=>({...project(p.x,p.z),s:p.s}));
 const start=sampleTrack(0,track);
 cached={points,project,start:{...project(start.x,start.z),yaw:Math.atan2(start.tx,start.tz)},scale,path:null};
 geometryCache.set(track,cached);return cached;
}

export function raceMapState(track,race={}) {
 const geometry=raceMapGeometry(track),active=race.state==='racing'||race.state==='finished';
 const progress=active?clamp(finite(race.progress),0,1):0;
 const distance=progress*track.length,end=sampleTrack(distance,track);
 const bounded=car=>{const p=geometry.project(car?.x,car?.z);return{x:clamp(p.x,13,WIDTH-13),y:clamp(p.y,13,HEIGHT-13),yaw:finite(car?.yaw)};};
 // The physics engine advances twelve guarded timing sectors per lap. This
 // marker uses that counter; nearest-road projection must never invent one.
 const checkpoint=active&&race.state!=='finished'&&Number.isInteger(race._nextCheckpoint)
  ?clamp(race._nextCheckpoint,1,SEGMENTS):null;
 const gate=checkpoint?sampleTrack(checkpoint*track.length/SEGMENTS,track):null;
 return {progress,distance,progressEnd:geometry.project(end.x,end.z),player:bounded(race.car),
  checkpoint:gate?{...geometry.project(gate.x,gate.z),finish:checkpoint===SEGMENTS}:null,
  rivals:Array.isArray(race.rivals)?race.rivals.filter(r=>Number.isFinite(r.car?.x)&&Number.isFinite(r.car?.z)).map(r=>bounded(r.car)):[]};
}
function routePath(context,points){context.beginPath?.();for(let i=0;i<points.length;i++){const p=points[i];i?context.lineTo(p.x,p.y):context.moveTo(p.x,p.y);}context.closePath();}
function diamond(context,x,y,size){context.beginPath();context.moveTo(x,y-size);context.lineTo(x+size,y);context.lineTo(x,y+size);context.lineTo(x-size,y);context.closePath();}

export function drawRaceMap(context,track,race) {
 const geometry=raceMapGeometry(track),state=raceMapState(track,race),canvas=context.canvas;
 // 2x raster detail remains sharp on phone displays; CSS keeps its original
 // HUD dimensions. Resize only once rather than resetting the context each frame.
 if(canvas.width!==WIDTH*2||canvas.height!==HEIGHT*2){canvas.width=WIDTH*2;canvas.height=HEIGHT*2;}
 context.setTransform(2,0,0,2,0,0);context.clearRect(0,0,WIDTH,HEIGHT);
 context.lineCap='round';context.lineJoin='round';context.setLineDash([]);
 // The native closed route is reusable; only progress and racers vary per frame.
 if(!geometry.path&&typeof globalThis.Path2D==='function'){
  const path=new globalThis.Path2D();routePath(path,geometry.points);geometry.path=path;
 }
 if(!geometry.path)routePath(context,geometry.points);
 const stroke=()=>geometry.path?context.stroke(geometry.path):context.stroke();
 // A dark road halo guarantees contrast against bright desert or sunlit water.
 context.strokeStyle='rgba(17,0,23,.94)';context.lineWidth=17;stroke();
 context.strokeStyle='#cec5dc';context.lineWidth=7;stroke();
 context.strokeStyle='#FFFFFF';context.lineWidth=3.5;stroke();
 if(state.progress>0){
  context.beginPath();const first=geometry.points[0];context.moveTo(first.x,first.y);
  for(const point of geometry.points){if(point.s>state.distance)break;context.lineTo(point.x,point.y);}
  context.lineTo(state.progressEnd.x,state.progressEnd.y);
  context.strokeStyle='#9246FF';context.lineWidth=6;context.stroke();
 }
 const start=geometry.start;
 context.save();context.translate(start.x,start.y);context.rotate(-start.yaw);
 context.fillStyle='#110017';context.fillRect(-12,-8,24,16);
 for(let row=0;row<2;row++)for(let column=0;column<4;column++){
  context.fillStyle=(row+column)%2?'#110017':'#FFFFFF';context.fillRect(column*5-10,row*5-5,5,5);
 }context.restore();
 if(state.checkpoint){
  const p=state.checkpoint;
  if(p.finish){context.beginPath();context.arc(p.x,p.y,14,0,Math.PI*2);context.strokeStyle='#FFF71E';context.lineWidth=2.5;context.stroke();}
  else{diamond(context,p.x,p.y,9);context.fillStyle='#110017';context.fill();context.lineWidth=2.5;context.strokeStyle='#e4d2ff';context.stroke();diamond(context,p.x,p.y,4);context.fillStyle='#9246FF';context.fill();}
 }
 for(const rival of state.rivals){context.beginPath();context.arc(rival.x,rival.y,5.5,0,Math.PI*2);context.fillStyle='#FFFFFF';context.strokeStyle='#110017';context.lineWidth=2.5;context.stroke();context.fill();}
 const player=state.player;
 context.save();context.translate(player.x,player.y);context.rotate(-player.yaw);
 context.beginPath();context.moveTo(0,12);context.lineTo(-8.5,-9);context.lineTo(0,-4.5);context.lineTo(8.5,-9);context.closePath();
 context.strokeStyle='#110017';context.lineWidth=5;context.stroke();context.fillStyle='#FFF71E';context.fill();context.restore();
 return state;
}
