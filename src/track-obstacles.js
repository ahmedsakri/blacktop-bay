import {sampleTrack} from './track.js';

export function getTrackObstacles(track) {
  return (track.obstacles || []).map(obstacle => {
    const road=sampleTrack(obstacle.s,track);
    return {...obstacle, x:road.x+road.nx*(obstacle.lane||0),z:road.z+road.nz*(obstacle.lane||0),
      y:road.y||0,tx:road.tx,tz:road.tz,nx:road.nx,nz:road.nz};
  });
}

export function obstacleBlocksPosition(obstacle, x, y, z, clearance=2.2) {
  return y < obstacle.y+obstacle.height && y+1.4 > obstacle.y
    && Math.hypot(x-obstacle.x,z-obstacle.z)<obstacle.radius+clearance;
}

// Return actual contacts to the caller's event system. Bounded normal rebound
// retains glancing travel and cannot launch the car through adjacent barriers.
export function resolveTrackObstacles(racer, obstacles) {
  const car=racer.car,contacts=[];
  for(const obstacle of obstacles){
    if(car.y>=obstacle.y+obstacle.height || car.y+1.4<=obstacle.y)continue;
    if(Math.hypot(car.x-obstacle.x,car.z-obstacle.z)>obstacle.radius+2.2)continue;
    for(const axle of [-1.15,1.15]){
      const dx=car.x+Math.sin(car.yaw)*axle-obstacle.x,dz=car.z+Math.cos(car.yaw)*axle-obstacle.z;
      const distance=Math.hypot(dx,dz),overlap=obstacle.radius+.95-distance;
      if(overlap<=0)continue;
      const nx=distance>1e-6?dx/distance:-obstacle.tx,nz=distance>1e-6?dz/distance:-obstacle.tz;
      const outward=-(car.vx*nx+car.vz*nz),speed=Math.hypot(car.vx,car.vz);
      car.x+=nx*overlap;car.z+=nz*overlap;
      if(outward>0){const impulse=outward+Math.min(1.6,outward*.12);car.vx+=nx*impulse;car.vz+=nz*impulse;}
      if(outward>.7){
        const retained=outward>=8&&speed>=12?.82:.995;car.vx*=retained;car.vz*=retained;
        contacts.push({speed,normalSpeed:outward,obstacleId:obstacle.id,
          x:obstacle.x+nx*obstacle.radius,y:obstacle.y,z:obstacle.z+nz*obstacle.radius,nx,nz});
      }
    }
  }
  return contacts;
}
