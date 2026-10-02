// Preparation is serialized per renderer and yields between small texture
// batches. Loading a GLB alone does not upload its maps or compile its programs.
const queues=new WeakMap();
// Hidden pages may never receive RAF. The timer also releases a wait if a
// visible tab becomes hidden or its frame callbacks are suspended mid-batch.
const yieldFrame=()=>new Promise(resolve=>{
 let frame=null,settled=false,timer;
 const finish=()=>{if(settled)return;settled=true;clearTimeout(timer);if(frame!==null)globalThis.cancelAnimationFrame?.(frame);resolve();};
 const canFrame=!globalThis.document?.hidden&&typeof globalThis.requestAnimationFrame==='function';
 timer=setTimeout(finish,canFrame?32:0);
 if(canFrame)frame=globalThis.requestAnimationFrame(finish);
});
const abortError=()=>new DOMException('Graphics preparation cancelled','AbortError');
export function prepareManufacturerInstances(renderer,models,{camera,scene,signal,onProgress=()=>{},yieldControl=yieldFrame,texturesPerSlice=2}={}){
 if(!renderer||!camera||!scene)return Promise.reject(new TypeError('Graphics preparation requires renderer, camera and scene.'));
 const previous=queues.get(renderer)||Promise.resolve();
 const run=async()=>{
  const uploaded=new Set(),stats={models:0,textures:0,yields:0};let slice=0;
  const check=()=>{if(signal?.aborted||renderer.getContext?.()?.isContextLost?.())throw abortError();};
  check();
  for(const model of models){
   check();const group=model?.group||model;if(!group||model?.disposed)continue;
   const textures=new Set(),collect=value=>{if(value?.isTexture&&!value.isRenderTargetTexture)textures.add(value);};
   group.traverse(mesh=>{if(!mesh.isMesh)return;for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
    for(const value of Object.values(material))collect(value);
    for(const uniform of Object.values(material.uniforms||{})){if(Array.isArray(uniform.value))uniform.value.forEach(collect);else collect(uniform.value);}
   }});
   for(const texture of textures){
    check();if(uploaded.has(texture))continue;renderer.initTexture(texture);uploaded.add(texture);stats.textures++;slice++;
    if(slice>=Math.max(1,Math.min(4,texturesPerSlice))){slice=0;stats.yields++;await yieldControl();}
   }
   check();await renderer.compileAsync(group,camera,scene);check();stats.models++;onProgress({...stats,total:models.length});
   stats.yields++;await yieldControl();
  }
  check();return stats;
 };
 const request=previous.catch(()=>{}).then(run);queues.set(renderer,request.catch(()=>{}));return request;
}
