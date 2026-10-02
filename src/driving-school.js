export const SCHOOL_KEY='camber-reign-driving-school-v1';
export const LESSONS=Object.freeze([
 {id:'steer',title:'Find your line',text:'Steer through a corner. Acceleration is automatic.',cue:'Steer left or right'},
 {id:'drift',title:'Make the corner yours',text:'Turn sharply at speed, then straighten to bank a drift.',cue:'Turn at speed · straighten'},
 {id:'boost',title:'Choose your moment',text:'Use Nitro on a clear stretch of road.',cue:'Hold Nitro to boost'},
 {id:'pickup',title:'Follow the charge',text:'Drive through a glowing Nitro canister on the road.',cue:'Collect one Nitro canister'},
 {id:'perfect',title:'Perfect your timing',text:'Start Nitro, release, then press again when the marker enters the blue window.',cue:'Press · release · press in blue'},
]);
export function createDrivingSchool(){let index=0,steered=0,skipped=0,lastScore=0,started=false,lastPickup=0;return {
 get active(){return index<LESSONS.length;},get lesson(){return LESSONS[index]||null;},get index(){return index;},get skipped(){return skipped;},
 skip(){if(index<LESSONS.length){index++;skipped++;started=false;}return this.lesson;},
 update(race,input,dt){if(index>=LESSONS.length||race?.state!=='racing')return false;if(!started){lastScore=race.score||0;lastPickup=race.pickupEvent?.id||0;started=true;}
 const lesson=LESSONS[index];if(lesson.id==='steer'&&Math.abs(input.steer)>.25&&race.car.speed>5)steered+=Math.min(.05,Math.max(0,dt));
 const done=lesson.id==='steer'?steered>1.2:lesson.id==='drift'?(race.score||0)>lastScore:lesson.id==='boost'?race.nitro?.active:lesson.id==='pickup'?(race.pickupEvent?.id||0)>lastPickup:race.nitro?.mode==='perfect';
 if(done){index++;lastScore=race.score||0;lastPickup=race.pickupEvent?.id||0;return true;}return false;
 }
};}
export function schoolSeen(storage){try{return ['seen','complete'].includes(storage.getItem(SCHOOL_KEY));}catch{return false;}}
export function saveSchool(storage,complete=false){try{storage.setItem(SCHOOL_KEY,complete?'complete':'seen');return true;}catch{return false;}}
