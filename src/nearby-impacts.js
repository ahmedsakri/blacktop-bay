const finite=Number.isFinite;
// Both sides of one physical car collision share a point and event lifetime.
function sameContact(a,b) {
 return a?.source==='car'&&b?.source==='car'&&finite(a.x)&&finite(a.z)&&finite(b.x)&&finite(b.z)
  &&Math.hypot(a.x-b.x,a.z-b.z)<.3&&Math.abs((a.remaining||0)-(b.remaining||0))<.045;
}
export function createNearbyImpactTracker({range=60,limit=2}={}) {
 const seen=new Map();let identity;
 return {
  clear(){seen.clear();identity=undefined;},
  consume({raceId,listener,rivals,impact,active=true}={}){
   if(identity!==raceId){seen.clear();identity=raceId;}
   const candidates=[];
   for(const rival of Array.isArray(rivals)?rivals.slice(0,16):[]){
    const id=rival?.id,event=rival?.impact,car=rival?.car||rival;
    if(!['string','number'].includes(typeof id)||!Number.isSafeInteger(event?.id)||event.id<1)continue;
    if(event.id<=(seen.get(id)||0))continue;
    seen.set(id,event.id);if(seen.size>16)seen.delete(seen.keys().next().value);
    if(!active||event.kind!=='crash'||!(event.remaining>0)||!finite(car?.x)||!finite(car?.z)||!finite(listener?.x)||!finite(listener?.z))continue;
    const distance=Math.hypot(car.x-listener.x,car.z-listener.z,(car.y||0)-(listener.y||0));
    if(!finite(distance)||distance>=range||sameContact(event,impact))continue;
    candidates.push({id,car,impact:event,distance,gain:.65*Math.pow(1-distance/range,1.5)});
   }
   const contacts=[],chosen=[];
   for(const item of candidates.sort((a,b)=>a.distance-b.distance)){
    if(contacts.some(contact=>sameContact(item.impact,contact)))continue;
    contacts.push(item.impact);chosen.push(item);if(chosen.length>=limit)break;
   }
   return chosen;
  },
 };
}
