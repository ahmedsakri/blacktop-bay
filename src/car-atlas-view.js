import {getVehicle,DEFAULT_VEHICLE_ID,VEHICLES} from './vehicles.js';
import {getUpgradeStats} from './physics.js';
import {normalizeUpgrades} from './progression.js';
import {icon} from './icons.js';
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const METRICS=[
 {key:'topSpeed',label:'Top speed',unit:'KM/H',scale:3.6,digits:0,icon:'flag'},
 {key:'acceleration',label:'Acceleration',unit:'M/S²',scale:1,digits:1,icon:'play'},
 {key:'handling',label:'Handling',unit:'×',scale:1,digits:2,icon:'steering'},
 {key:'nitroCapacity',label:'Nitro',unit:'SEC',scale:1,digits:1,icon:'nitro'},
];
const maxima=Object.fromEntries(METRICS.map(({key})=>[key,Math.max(...VEHICLES.map(car=>getUpgradeStats(car.id,{engine:5,tyres:5,nitro:5,handling:5})[key]))]));
export function readAtlasCurrentCar(storage) {
 try{
  const source=storage??globalThis.localStorage,raw=source?.getItem('blacktop-bay-choices-v1');
  if(typeof raw!=='string'||raw.length>12000)return DEFAULT_VEHICLE_ID;
  const value=JSON.parse(raw);
  return VEHICLES.some(car=>car.id===value?.vehicle)?value.vehicle:DEFAULT_VEHICLE_ID;
 }catch{return DEFAULT_VEHICLE_ID;}
}
// Navigation follows the currently filtered and sorted collection, never a
// hidden or made-up model. Empty views leave the inspected car unchanged.
export function adjacentPreview(id,cars,direction) {
 const ids=cars.map(car=>car.id).filter(id=>VEHICLES.some(car=>car.id===id));
 if(!ids.length)return getVehicle(id).id;
 const index=ids.indexOf(id),step=direction<0?-1:1;
 if(index<0)return step<0?ids.at(-1):ids[0];
 return ids[(index+step+ids.length)%ids.length];
}
export function carPreviewMarkup(id,{progression={},current=DEFAULT_VEHICLE_ID,position=1,count=VEHICLES.length}={}) {
 const car=getVehicle(id),stats=getUpgradeStats(car.id,progression.cars?.[car.id]);
 const upgrades=normalizeUpgrades(progression.cars?.[car.id]);
 const level=Object.values(upgrades).reduce((total,value)=>total+value,0);
 const selected=car.id===current;
 return `<div class="car-preview-details"><p class="car-preview-state${selected?' is-current':''}">${icon(selected?'check':'garage')} ${selected?'YOUR CURRENT CAR':'PREVIEWING'}</p><p class="atlas-eyebrow">${escape(car.brand)}</p><h2 id="car-preview-heading" tabindex="-1">${escape(car.name)}</h2><p class="car-preview-tagline">${escape(car.specs.body)}</p><div class="car-preview-build"><span>YOUR BUILD</span><strong>${String(level).padStart(2,'0')} <small>/ 20</small></strong><div class="car-upgrade-slots" aria-hidden="true">${Array.from({length:20},(_,index)=>`<i${index<level?' class="installed"':''}></i>`).join('')}</div></div><dl class="car-preview-metrics">${METRICS.map(({key,label,unit,scale,digits,icon:mark})=>`<div><dt>${icon(mark)} ${label}</dt><dd>${(stats[key]*scale).toFixed(digits)} <small>${unit}</small></dd><span class="car-stat-track" aria-hidden="true"><i style="--stat-fill:${Math.max(0,Math.min(100,stats[key]/maxima[key]*100)).toFixed(2)}%"></i></span></div>`).join('')}</dl><p class="car-preview-upgrades">${level?`${level} of 20 upgrade levels installed`:'Stock setup · ready to make your own'}</p></div><div class="car-preview-art"><div class="car-studio-wordmark" aria-hidden="true">CAMBER<span>REIGN</span></div><div class="car-studio-floor" aria-hidden="true"></div><span class="car-preview-series">${escape(car.brand)} <i></i> ${escape(car.powertrain==='electric'?'ELECTRIC PERFORMANCE':'RACE COLLECTION')}</span><img src="/assets/cars/manufacturers/${car.assetId}.webp" width="800" height="400" alt="${escape(car.name)} in its original in-game finish" fetchpriority="high" decoding="async"/><span class="car-preview-art-caption">ACTUAL IN-GAME MODEL · ORIGINAL FINISH</span><div class="car-preview-footer"><div class="car-preview-navigation" role="group" aria-label="Preview cars in this collection"><button type="button" data-preview-step="-1" aria-label="Preview previous car"${count<2?' disabled':''}>${icon('arrow-left')}</button><span>${position>0?String(position).padStart(2,'0'):'—'} <small>/ ${String(count).padStart(2,'0')}</small></span><button type="button" data-preview-step="1" aria-label="Preview next car"${count<2?' disabled':''}>${icon('arrow-right')}</button></div><a class="atlas-race" href="/cars/${car.id}/">${icon('garage')} <span>OPEN GARAGE</span> ${icon('arrow-right')}</a></div></div>`;
}
