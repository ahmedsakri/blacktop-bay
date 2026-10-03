import * as THREE from 'three';

// Water shares the venue's existing environment/reflection resource and lights.
// A single opaque plane avoids another scene render, transmission buffer or
// texture allocation on phones. Only its shading normal moves, not the track.
export function createWaterSurfaceMaterial({environment='coastal'}={}) {
 const time={value:0},sheltered=environment==='parkland';
 const material=new THREE.MeshPhysicalMaterial({
  color:sheltered?'#123133':'#0c2531',metalness:0,roughness:sheltered?.24:.29,
  ior:1.333,envMapIntensity:.9,
 });
 material.name='VenueLitWater';
 material.userData.waterSurface={reflection:'shared-venue-environment',extraTextures:0,extraRenderPasses:0};
 material.onBeforeCompile=shader=>{
  shader.uniforms.waterTime=time;
  shader.vertexShader='varying vec3 vWaterPosition;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvWaterPosition=(modelMatrix*vec4(position,1.)).xyz;');
  shader.fragmentShader=`varying vec3 vWaterPosition;uniform float waterTime;
   float waterNoise(vec2 p){
    vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
    vec4 h=fract(sin(vec4(dot(i,vec2(127.1,311.7)),dot(i+vec2(1.,0.),vec2(127.1,311.7)),dot(i+vec2(0.,1.),vec2(127.1,311.7)),dot(i+1.,vec2(127.1,311.7))))*43758.5453);
    return mix(mix(h.x,h.y,f.x),mix(h.z,h.w,f.x),f.y);
   }
  `+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_begin>',`#include <normal_fragment_begin>
   vec2 q=vWaterPosition.xz;
   // Low-frequency phase warping breaks the repeated crossed-wave grid.
   float phase=waterNoise(q*.075)*3.2+waterNoise(q*.19+12.)*1.4;
   // Analytic derivatives of crossed swell and fine ripples. Fade small
   // ripples before they become sub-pixel shimmer at the horizon.
   float rippleNear=1.-smoothstep(35.,180.,length(vViewPosition));
   vec2 slope=vec2(.43,.31)*.105*cos(dot(q,vec2(.43,.31))+phase+waterTime*.45);
   slope+=vec2(-.7,.29)*.055*cos(dot(q,vec2(-.7,.29))+phase*1.7-waterTime*.57);
   slope+=vec2(.21,1.1)*.026*cos(dot(q,vec2(.21,1.1))+phase*.8+waterTime*.67);
   slope+=vec2(3.6,2.1)*.008*cos(dot(q,vec2(3.6,2.1))-waterTime*1.6)*rippleNear;
   slope+=vec2(-2.8,4.2)*.005*cos(dot(q,vec2(-2.8,4.2))+waterTime*1.3)*rippleNear;
   normal=normalize(mat3(viewMatrix)*normalize(vec3(-slope.x,1.,-slope.y)));
  `);
 };
 material.customProgramCacheKey=()=> 'venue-lit-water-v1';
 return {material,setTime(value){time.value=Number.isFinite(value)?value:0;}};
}
