import * as THREE from 'three';

// The existing aerial photograph covers 90 metres. A second, two-metre scan
// supplies grass/soil grain near the car without shrinking the aerial rocks.
// Both maps are shared by the surface library; materials do not own textures.
export const GROUND_DETAIL = Object.freeze({metres:2,fadeStart:45,fadeEnd:140,colourStrength:.55,normalStrength:.5});

export function addGroundDetail(material,maps){
  if(!material?.isMeshStandardMaterial||material.map!==maps.terrainColor||!maps.groundDetailColor||!maps.groundDetailNormal)return false;
  if(material.userData.groundDetail)return false;
  const previousCompile=material.onBeforeCompile,previousKey=material.customProgramCacheKey();
  material.normalMap=maps.groundDetailNormal;
  material.normalScale.setScalar(GROUND_DETAIL.normalStrength);
  material.userData.groundDetail={...GROUND_DETAIL};
  material.onBeforeCompile=function(shader,renderer){
    previousCompile.call(this,shader,renderer);
    shader.uniforms.groundDetailColor={value:maps.groundDetailColor};
    // Terrain is static, but this also handles instanced rocks using the same
    // material. World projection aligns neighbouring independently built meshes.
    shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>',`#include <uv_vertex>
      vec4 groundPosition=vec4(position,1.);
      #ifdef USE_INSTANCING
        groundPosition=instanceMatrix*groundPosition;
      #endif
      groundPosition=modelMatrix*groundPosition;
      vNormalMapUv=groundPosition.xz/${GROUND_DETAIL.metres.toFixed(1)};
    `);
    shader.fragmentShader='uniform sampler2D groundDetailColor;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      float groundNear=1.-smoothstep(${GROUND_DETAIL.fadeStart.toFixed(1)},${GROUND_DETAIL.fadeEnd.toFixed(1)},length(vViewPosition));
      vec3 groundPhoto=texture2D(groundDetailColor,vNormalMapUv).rgb;
      // Retain the macro vegetation/rock pattern, with bounded photographed
      // grain instead of an unnaturally uniform green or repeated giant rocks.
      float groundGrain=clamp(dot(groundPhoto,vec3(.2126,.7152,.0722))*5.0,.48,1.55);
      diffuseColor.rgb*=mix(1.,groundGrain,groundNear*${GROUND_DETAIL.colourStrength});
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',THREE.ShaderChunk.normal_fragment_maps.replace('mapN.xy *= normalScale;','mapN.xy *= normalScale * groundNear;'));
  };
  material.customProgramCacheKey=()=>previousKey+'|metre-ground-detail-v1';
  material.needsUpdate=true;
  return true;
}

export function addWorldGroundDetail(scene,maps){
  const seen=new Set();let materials=0;
  scene.traverse(object=>{for(const material of [object.material].flat().filter(Boolean)){
    if(seen.has(material))continue;seen.add(material);
    if(addGroundDetail(material,maps))materials++;
  }});
  return {materials,metres:GROUND_DETAIL.metres,extraTextures:2,extraDraws:0};
}
