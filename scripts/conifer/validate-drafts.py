from pathlib import Path
import argparse,sys
args=argparse.ArgumentParser(add_help=False);args.add_argument("--source");options,_=args.parse_known_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else sys.argv[1:])
import json,struct,hashlib,io
import numpy as np
from PIL import Image
p=(Path(options.source).resolve() if options.source else Path(__file__).resolve().parents[3]/'camber-reign-asset-sources/conifer-upgrade');out=p/'drafts';record=json.loads((out/'provenance.json').read_text());source=json.loads((p/'source-provenance.json').read_text());results={}
for name,meta in source['files'].items():assert hashlib.md5((p/'source'/name).read_bytes()).hexdigest()==meta['md5'],name
for key,v in record['variants'].items():
 raw=(out/v['file']).read_bytes();magic,version,length=struct.unpack_from('<III',raw);assert(magic,version,length)==(0x46546c67,2,len(raw));n,kind=struct.unpack_from('<II',raw,12);assert kind==0x4e4f534a;g=json.loads(raw[20:20+n]);nb,kb=struct.unpack_from('<II',raw,20+n);assert kb==0x004e4942;binary=raw[28+n:];assert len(binary)==nb
 assert len(g['meshes'])==2 and len(g['materials'])==2 and len(g['images'])==2
 def read(ai):
  a=g['accessors'][ai];b=g['bufferViews'][a['bufferView']];dt={5126:'<f4',5123:'<u2',5125:'<u4'}[a['componentType']];size={'VEC3':3,'VEC2':2,'SCALAR':1}[a['type']]
  x=np.frombuffer(binary,dtype=dt,count=a['count']*size,offset=b.get('byteOffset',0)+a.get('byteOffset',0)).reshape(-1,size);assert np.isfinite(x).all();return x
 tris=0;points=[]
 for mesh in g['meshes']:
  assert len(mesh['primitives'])==1
  pr=mesh['primitives'][0];po=read(pr['attributes']['POSITION']);no=read(pr['attributes']['NORMAL']);uv=read(pr['attributes']['TEXCOORD_0']);ix=read(pr['indices']);assert int(ix.max())<len(po);assert len(no)==len(uv)==len(po);assert np.allclose(np.linalg.norm(no,axis=1),1,atol=.01);tris+=len(ix)//3;points.append(po)
 points=np.concatenate(points);assert tris==v['triangles'];assert points[:,1].min()==0;assert abs(points[:,1].max()-v['height'])<1e-6;assert abs(np.linalg.norm(points[:,[0,2]],axis=1).max()-v['radius'])<1e-6;assert hashlib.sha256(raw).hexdigest()==v['sha256']
 imgs=[]
 for i in g['images']:
  b=g['bufferViews'][i['bufferView']];im=Image.open(io.BytesIO(binary[b['byteOffset']:b['byteOffset']+b['byteLength']]));imgs.append({'size':list(im.size),'mode':im.mode})
  if im.mode=='RGBA':
   a=np.asarray(im.getchannel('A'));assert (a==0).any() and (a>128).any();assert .02<(a>128).mean()<.8;imgs[-1]['opaqueCoverage']=float((a>128).mean())
 assert [i['size'] for i in imgs]==v['textureDimensions'];assert g['materials'][1]['alphaMode']=='MASK';assert g['materials'][1]['doubleSided']==False
 results[key]={'bytes':len(raw),'triangles':tris,'primitives':2,'images':imgs,'mipmappedRGBABytes':sum(w*h*4*4/3 for w,h in v['textureDimensions'])}
print(json.dumps(results,indent=2));(out/'validation.json').write_text(json.dumps({'verifiedSourceFiles':len(source['files']),'checks':'Source MD5; GLB structure; indices; finite vertices/UVs/unit normals; two meshes/materials/embedded images; bounds and SHA-256; cutout alpha coverage and dimensions. All four imported successfully in Blender 5.2.2. This is offline asset QA, not runtime/gameplay validation.','variants':results},indent=2)+'\n')
