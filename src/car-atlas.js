import './circuit-atlas.css';
import './car-atlas.css';
import {VEHICLES,getVehicle} from './vehicles.js';
import {loadProgression} from './progression.js';
import {carLibraryMarkup,carLibraryCard,findCars,loadFavorites,saveFavorites,hasCarFilters,clearCarFilters} from './collection-browser.js';
import {carPreviewMarkup,readAtlasCurrentCar,adjacentPreview} from './car-atlas-view.js';
import {icon} from './icons.js';
const $=id=>document.getElementById(id);
let progression=loadProgression(),current=readAtlasCurrentCar(),preview=current,favorites=loadFavorites();
let view={query:'',family:'all',brand:'all',sort:'latest',favoritesOnly:false,compare:false};
let favoritesSessionOnly=false;
const library=$('atlas-car-library');library.innerHTML=carLibraryMarkup();
function updateCredits(){const count=progression.credits.toLocaleString('en');$('atlas-credits').innerHTML=`${icon('credits')} <span>${count}<small>CREDITS</small></span>`;$('atlas-credits').setAttribute('aria-label',`${count} saved upgrade credits`);}
function renderPreview({focus=false}={}){
 const cars=findCars({...view,progression,favorites});
 $('car-preview').innerHTML=carPreviewMarkup(preview,{progression,current,position:cars.findIndex(car=>car.id===preview)+1,count:cars.length});
 if(focus){$('car-preview-heading').focus({preventScroll:true});$('car-preview').scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});$('car-preview-status').textContent=`Previewing ${getVehicle(preview).name}. Open the garage to select this car.`;}
}
function refresh({restoreFavorite=null}={}){
 const cars=findCars({...view,progression,favorites});
 $('car-library-grid').innerHTML=cars.map(car=>carLibraryCard(car,{selected:current,favorites,progression,compare:view.compare})).join('');
 $('library-count').textContent=`${cars.length} of ${VEHICLES.length} cars${view.compare?` · compared with ${getVehicle(current).name}`:''}`;
 $('library-empty').hidden=cars.length>0;$('clear-car-filters').disabled=!hasCarFilters(view);
 $('favorites-only').setAttribute('aria-pressed',String(view.favoritesOnly));
 const previewPosition=cars.findIndex(car=>car.id===preview)+1;
 const counter=$('car-preview').querySelector('.car-preview-navigation>span');
 if(counter)counter.innerHTML=`${previewPosition?String(previewPosition).padStart(2,'0'):'—'} <small>/ ${String(cars.length).padStart(2,'0')}</small>`;
 for(const button of $('car-preview').querySelectorAll('[data-preview-step]'))button.disabled=cars.length<2;
 for(const button of library.querySelectorAll('[data-library-family]'))button.setAttribute('aria-pressed',String(button.dataset.libraryFamily===view.family));
 for(const button of library.querySelectorAll('[data-library-car]')){
  const car=getVehicle(button.dataset.libraryCar),article=button.closest('article'),image=button.querySelector('img');
  image.src=`/assets/cars/manufacturers/${car.assetId}.webp`;image.loading='lazy';image.decoding='async';image.classList.add('ready');
  button.setAttribute('aria-label',`Preview ${car.name}${car.id===current?', your current car':''}`);
  button.setAttribute('aria-pressed',String(car.id===preview));article.classList.toggle('is-preview',car.id===preview);
  button.querySelector('.library-inspect-label').innerHTML=`${car.id===preview?'IN PREVIEW':'PREVIEW CAR'} ${icon('arrow-up-right')}`;
 }
 if(restoreFavorite)(library.querySelector(`[data-favorite="${restoreFavorite}"]`)||library.querySelector('[data-library-car]')||$('car-search')).focus({preventScroll:true});
}
function clear(){view=clearCarFilters(view);$('car-search').value='';$('car-brand').value='all';refresh();$('car-search').focus();}
$('car-search').addEventListener('input',event=>{view.query=event.target.value;refresh();});
$('car-brand').addEventListener('change',event=>{view.brand=event.target.value;refresh();});
$('car-sort').addEventListener('change',event=>{view.sort=event.target.value;refresh();});
$('compare-cars').addEventListener('change',event=>{view.compare=event.target.checked;refresh();});
$('favorites-only').addEventListener('click',()=>{view.favoritesOnly=!view.favoritesOnly;refresh();});
$('clear-car-filters').addEventListener('click',clear);$('reset-car-search').addEventListener('click',clear);
library.addEventListener('click',event=>{
 const family=event.target.closest('[data-library-family]');if(family){view.family=family.dataset.libraryFamily;refresh();return;}
 const favorite=event.target.closest('[data-favorite]');if(favorite){
  const id=favorite.dataset.favorite;if(favorites.has(id))favorites.delete(id);else favorites.add(id);
  const saved=saveFavorites(favorites);favoritesSessionOnly=!saved;$('favorite-status').textContent=saved?`${getVehicle(id).name} ${favorites.has(id)?'added to':'removed from'} favourites.`:'Your favourites are available for this visit. Browser storage is unavailable.';
  refresh({restoreFavorite:id});return;
 }
 const inspect=event.target.closest('[data-library-car]');if(inspect){preview=inspect.dataset.libraryCar;renderPreview({focus:true});refresh();}
});
$('car-preview').addEventListener('click',event=>{
 const button=event.target.closest('[data-preview-step]');if(!button||button.disabled)return;
 const direction=Number(button.dataset.previewStep),cars=findCars({...view,progression,favorites});
 preview=adjacentPreview(preview,cars,direction);renderPreview();refresh();
 $('car-preview').querySelector(`[data-preview-step="${direction}"]`)?.focus({preventScroll:true});
 $('car-preview-status').textContent=`Previewing ${getVehicle(preview).name}. Open the garage to select this car.`;
});
// A garage opened in another tab can change credits and upgrades. Read, never
// award or overwrite progression, when the collection becomes visible again.
document.addEventListener('visibilitychange',()=>{if(!document.hidden){progression=loadProgression();current=readAtlasCurrentCar();if(!favoritesSessionOnly)favorites=loadFavorites();updateCredits();renderPreview();refresh();}});
updateCredits();renderPreview();refresh();
