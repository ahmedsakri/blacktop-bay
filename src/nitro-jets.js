import * as THREE from 'three';

// Two intersecting tapered planes per verified tailpipe. Unlike camera-facing
// particle cores the jet always points backwards along the car's own heading.
// One fixed instanced draw, shared geometry, and no per-frame allocations.
export function createNitroJets(scene, {low=false}={}) {
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute([
    -.5,0,0,.5,0,0,-.5,0,-1,.5,0,-1,
    0,-.5,0,0,.5,0,0,-.5,-1,0,.5,-1,
  ],3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,0,1,1,1,0,0,1,0,0,1,1,1],2));
  geometry.setIndex([0,1,2,1,3,2,4,5,6,5,7,6]);
  const uniforms={time:{value:0},strength:{value:0}};
  const material=new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,side:THREE.DoubleSide,
    blending:THREE.AdditiveBlending,toneMapped:false,
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;vec3 p=position;p.xy*=1.-uv.y*.91;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(p,1.);}`,
    fragmentShader:`varying vec2 vUv;uniform float time;uniform float strength;
      void main(){float edge=exp(-pow(abs(vUv.x-.5)*2.,1.4)*4.5);float tail=pow(1.-vUv.y,.85);
      float pulse=.93+.07*sin(time*21.-vUv.y*15.);float a=edge*tail*pulse*strength*.68;
      vec3 blue=mix(vec3(.065,.31,1.),vec3(.68,.9,1.),pow(edge,3.)*pow(1.-vUv.y,2.));
      if(a<.005)discard;gl_FragColor=vec4(blue,a);}`,
  });
  const mesh=new THREE.InstancedMesh(geometry,material,4);mesh.name='nitro-directional-jets';mesh.count=0;
  mesh.frustumCulled=false;mesh.renderOrder=3;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(mesh);
  const transform=new THREE.Object3D();let strength=0;
  return {mesh,
    update(car,exhausts,dt,{active=false,reducedMotion=false,time=0}={}){
      if(reducedMotion||!car||!exhausts.length){this.clear();return;}
      strength+=(Number(active)-strength)*(1-Math.exp(-Math.max(0,dt)*(active?21:15)));
      uniforms.strength.value=strength;uniforms.time.value=time;
      mesh.visible=strength>.008;mesh.count=mesh.visible?Math.min(4,exhausts.length):0;
      const speed=Math.max(0,Math.min(80,car.speed||0)),s=Math.sin(car.yaw),c=Math.cos(car.yaw);
      for(let i=0;i<mesh.count;i++){
        const outlet=exhausts[i],width=low?.17:.19,length=(.85+speed*.023)*( .65+strength*.35);
        transform.position.set(car.x+c*outlet.x+s*outlet.z,outlet.y,car.z-s*outlet.x+c*outlet.z);
        transform.rotation.set(0,car.yaw,0);transform.scale.set(width,width,length);transform.updateMatrix();mesh.setMatrixAt(i,transform.matrix);
      }
      mesh.instanceMatrix.needsUpdate=true;
    },
    clear(){strength=0;uniforms.strength.value=0;mesh.count=0;mesh.visible=false;},
    dispose(){mesh.removeFromParent();geometry.dispose();material.dispose();},
  };
}
