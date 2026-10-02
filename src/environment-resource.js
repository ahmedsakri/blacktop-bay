// A PMREM owns a render target, not just its texture. Rebuild it after context
// restoration and dispose the previous target only once the replacement exists.
export function createEnvironmentResource(scene,build){
 let target=null,disposed=false;
 const rebuild=()=>{
  if(disposed)return false;const replacement=build();if(!replacement)return false;
  const previous=target;target=replacement;scene.environment=target.texture;previous?.dispose();return true;
 };
 return {rebuild,dispose(){if(disposed)return;disposed=true;if(scene.environment===target?.texture)scene.environment=null;target?.dispose();target=null;}};
}
