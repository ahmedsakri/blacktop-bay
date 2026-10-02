// Small original vector course illustrations. Positions and headings come from
// the actual arcade route; no generic circuit silhouettes or invented turns.
const cache=new WeakMap();
let illustrationId=0;
const decimal=value=>Number(value.toFixed(2));
export function circuitArtGeometry(track) {
 const existing=cache.get(track);if(existing)return existing;
 const source=track.samples;
 let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
 for(const p of source){minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minZ=Math.min(minZ,p.z);maxZ=Math.max(maxZ,p.z);}
 const scale=140/Math.max(maxX-minX,maxZ-minZ,1),cx=(minX+maxX)/2,cz=(minZ+maxZ)/2;
 const point=p=>({x:decimal(90+(p.x-cx)*scale),y:decimal(90+(p.z-cz)*scale),rotation:decimal(-Math.atan2(p.tx,p.tz)*180/Math.PI),s:p.s});
 // Every second simulation sample preserves the detailed silhouette while
 // keeping thirty-eight inline cards light enough for phones.
 const points=source.filter((_,index)=>index%2===0).map(point);
 const path=points.map((p,index)=>`${index?'L':'M'}${p.x},${p.y}`).join(' ')+'Z';
 const directions=[.22,.52,.78].map(fraction=>{
  const target=track.length*fraction;
  let nearest=source[0];for(const p of source)if(Math.abs(p.s-target)<Math.abs(nearest.s-target))nearest=p;
  return point(nearest);
 });
 const roadWidth=decimal(Math.max(4.2,Math.min(8.5,track.width*scale)));
 const geometry={points,path,start:point(source[0]),directions,scale,roadWidth};cache.set(track,geometry);return geometry;
}
export function illustratedCircuitMarkup(track) {
 const geometry=circuitArtGeometry(track),key=`course-art-${++illustrationId}`;
 const route=`${key}-route`,surface=`${key}-surface`,start=geometry.start,width=geometry.roadWidth;
 const checkers=[];
 for(let row=0;row<2;row++)for(let col=0;col<4;col++)if((row+col)%2===0)checkers.push(`<rect x="${col*3-6}" y="${row*3-3}" width="3" height="3" fill="#FFFFFF"/>`);
 return `<svg class="illustrated-circuit" viewBox="0 0 180 180" fill="none" aria-hidden="true" focusable="false"><defs><path id="${route}" d="${geometry.path}"/><linearGradient id="${surface}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#485164"/><stop offset="1" stop-color="#252D3D"/></linearGradient></defs><g stroke-linecap="round" stroke-linejoin="round"><use href="#${route}" transform="translate(0 1.8)" stroke="#000000" stroke-opacity=".45" stroke-width="${width+6}"/><use href="#${route}" stroke="#D5D9E1" stroke-width="${width+3}"/><use href="#${route}" stroke="#9246FF" stroke-width="${width+3}" stroke-dasharray="5 5"/><use href="#${route}" stroke="#101321" stroke-width="${width+1}"/><use href="#${route}" stroke="url(#${surface})" stroke-width="${width}"/><use href="#${route}" stroke="#E7E7EF" stroke-opacity=".48" stroke-width=".65" stroke-dasharray="2.5 4"/></g><g fill="#FFF71E" stroke="#110017" stroke-width=".75" stroke-linejoin="round">${geometry.directions.map(p=>`<path class="circuit-direction" transform="translate(${p.x} ${p.y}) rotate(${p.rotation})" d="M0 3.6L-2.6-2.6L0-1.1L2.6-2.6Z"/>`).join('')}</g><g class="circuit-start-finish" transform="translate(${start.x} ${start.y}) rotate(${start.rotation})"><rect x="-8" y="-5" width="16" height="10" rx="1" fill="#110017"/><rect x="-7" y="-4" width="14" height="8" fill="#FFFFFF"/><rect x="-6" y="-3" width="12" height="6" fill="#110017"/>${checkers.join('')}</g></svg>`;
}
