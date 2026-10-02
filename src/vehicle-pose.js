const finite=value=>Number.isFinite(value)?value:0;
// Match the car renderer's Euler(-pitch, yaw, roll, 'YXZ') transform. This
// keeps tyre marks and exhaust anchored during grades and airborne rolls.
export function vehiclePoint(pose,x=0,y=0,z=0,result={}) {
 const yaw=finite(pose?.yaw),pitch=finite(pose?.pitch),roll=finite(pose?.roll);
 const cr=Math.cos(roll),sr=Math.sin(roll),cp=Math.cos(pitch),sp=Math.sin(pitch),cy=Math.cos(yaw),sy=Math.sin(yaw);
 const rx=cr*x-sr*y,ry=sr*x+cr*y,pz=-sp*ry+cp*z;
 result.x=finite(pose?.x)+cy*rx+sy*pz;result.y=finite(pose?.y)+cp*ry+sp*z;result.z=finite(pose?.z)-sy*rx+cy*pz;
 return result;
}
export function interpolateVehiclePose(previous,current,fraction) {
 if(!previous)return current;
 const f=Math.max(0,Math.min(1,finite(fraction))),pose={};
 for(const axis of ['x','y','z'])pose[axis]=finite(previous[axis])+(finite(current[axis])-finite(previous[axis]))*f;
 for(const angle of ['yaw','pitch','roll']){
  const from=finite(previous[angle]),delta=finite(current[angle])-from;
  pose[angle]=from+Math.atan2(Math.sin(delta),Math.cos(delta))*f;
 }
 return pose;
}
