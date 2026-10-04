import bpy,collections,numpy as np
from pathlib import Path
import argparse,sys
args=argparse.ArgumentParser(add_help=False);args.add_argument("--source");options,_=args.parse_known_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else sys.argv[1:])
out=(Path(options.source).resolve() if options.source else Path(__file__).resolve().parents[3]/'camber-reign-asset-sources/conifer-upgrade')
ob=bpy.data.objects['pine_sapling_small_a'];m=ob.data;m.calc_loop_triangles()
parent=list(range(len(m.vertices)))
def root(i):
 while parent[i]!=i:parent[i]=parent[parent[i]];i=parent[i]
 return i
for p in m.polygons:
 for v in p.vertices[1:]:parent[root(v)]=root(p.vertices[0])
c=collections.defaultdict(list)
for p in m.polygons:c[root(p.vertices[0])].append(p.index)
components=[]
for polys in c.values():
 if m.polygons[polys[0]].material_index!=1:continue
 vids=list(set(i for pi in polys for i in m.polygons[pi].vertices));co=np.array([m.vertices[v].co[:] for v in vids]);components.append({'polys':polys,'vertices':vids,'points':co,'center':co.mean(0)})
stems=[c for c in components if len(c['polys'])>350];print('stems',len(stems))
# Keep every complete needle or cone connected component together, assigned by
# nearest point on the original woody twig. There are no arbitrary plant shapes.
points=np.concatenate([s['points'][::max(1,len(s['points'])//60)] for s in stems]);ids=np.concatenate([np.full(len(s['points'][::max(1,len(s['points'])//60)]),i) for i,s in enumerate(stems)])
clusters=[[] for s in stems]
for c in components:
 cluster=next((i for i,s in enumerate(stems) if s is c),None)
 if cluster is None:cluster=int(ids[np.argmin(((points-c['center'])**2).sum(1))])
 clusters[cluster].extend(c['polys'])
# Export expanded triangle vertices so UV splits and imported normals survive.
uv=m.uv_layers.active.data; polys_to_cluster={pi:i for i,polys in enumerate(clusters) for pi in polys}
p=[];n=[];t=[];labels=[];bark=[]
for tri in m.loop_triangles:
 values=[]
 for vi,li in zip(tri.vertices,tri.loops):
  co=m.vertices[vi].co;no=m.vertices[vi].normal;u=uv[li].uv
  values.append([co.x,co.y,co.z,no.x,no.y,no.z,u.x,1-u.y])
 if tri.material_index==0:bark.append(values)
 else:
  p.extend([v[:3] for v in values]);n.extend([v[3:6] for v in values]);t.extend([v[6:] for v in values]);labels.append(polys_to_cluster[tri.polygon_index])
np.savez_compressed(out/'source-clusters.npz',positions=np.array(p,dtype=np.float32).reshape(-1,3,3),normals=np.array(n,dtype=np.float32).reshape(-1,3,3),uv=np.array(t,dtype=np.float32).reshape(-1,3,2),labels=np.array(labels),bark=np.array(bark,dtype=np.float32))
print('wrote',len(labels),'foliage tris',len(bark),'bark tris','clusters',len(clusters),flush=True)
import bmesh
for key,ratio in [('far',.35),('mobilefar',.22)]:
 clone=ob.copy();clone.data=ob.data.copy();bpy.context.collection.objects.link(clone)
 bm=bmesh.new();bm.from_mesh(clone.data);bmesh.ops.delete(bm,geom=[f for f in bm.faces if f.material_index!=0],context='FACES');bm.to_mesh(clone.data);bm.free()
 bpy.context.view_layer.objects.active=clone;clone.select_set(True)
 mod=clone.modifiers.new('Bounded trunk reduction','DECIMATE');mod.ratio=ratio;bpy.ops.object.modifier_apply(modifier=mod.name)
 mesh=clone.data;mesh.calc_loop_triangles();uv=mesh.uv_layers.active.data;outtris=[]
 for tri in mesh.loop_triangles:
  vals=[]
  for vi,li in zip(tri.vertices,tri.loops):
   co=mesh.vertices[vi].co;no=mesh.vertices[vi].normal;u=uv[li].uv
   vals.append([co.x,co.y,co.z,no.x,no.y,no.z,u.x,1-u.y])
  outtris.append(vals)
 np.save(out/('bark-'+key+'.npy'),np.array(outtris,dtype=np.float32));print(key,len(outtris))
 bpy.data.objects.remove(clone,do_unlink=True)
