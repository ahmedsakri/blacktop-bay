"""Bounded CC0 pine derivative. Run after download-source.py and extract-clusters.py.
Python needs numpy/Pillow; outputs and authoring inputs stay outside the game repo.
No needle decimation: complete original needle components are baked at their
original twig positions, to three orthographic cutout planes per branch cluster.
"""
from pathlib import Path
import argparse,sys
args=argparse.ArgumentParser(add_help=False);args.add_argument("--source");options,_=args.parse_known_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else sys.argv[1:])
import json,math,struct,hashlib,io
import numpy as np
from PIL import Image
P=(Path(options.source).resolve() if options.source else Path(__file__).resolve().parents[3]/'camber-reign-asset-sources/conifer-upgrade'); O=P/'drafts';O.mkdir(exist_ok=True)
data=np.load(P/'source-clusters.npz');pos=data['positions'];norm=data['normals'];uv=data['uv'];labels=data['labels'];bark=data['bark'];count=int(labels.max())+1
photo=np.array(Image.open(P/'source/textures/pine_sapling_small_twig_diff_1k.jpg').convert('RGB'));alpha=np.array(Image.open(P/'source/textures/pine_sapling_small_twig_alpha_1k.png').convert('L'))
barkphoto=Image.open(P/'source/textures/pine_sapling_small_bark_diff_1k.jpg').convert('RGB')
ROOT=float(bark[:,:,2].min());TILE=256;COLS=9;ROWS=9
cache=P/'baked-branches.png'; meta=P/'baked-branches.json'
if not cache.exists():
 atlas=Image.new('RGBA',(TILE*COLS,TILE*ROWS));cards=[];tiles=[]
 for c in range(count):
  pick=labels==c;ps=pos[pick];ns=norm[pick];ts=uv[pick];allpoints=ps.reshape(-1,3);center=allpoints.mean(0)
  _,_,axes=np.linalg.svd(allpoints-center,full_matrices=False);axis=axes[0];other=axes[1];third=np.cross(axis,other)
  if axis[2]<0:axis=-axis;third=-third
  for side in range(3):
   angle=side*math.pi/3;right=other*math.cos(angle)+third*math.sin(angle);up=axis;forward=np.cross(right,up)
   rel=ps-center;projection=np.stack((rel@right,rel@up,rel@forward),axis=-1);lo=projection[:,:,:2].min((0,1));hi=projection[:,:,:2].max((0,1));span=(hi-lo)*1.035;middle=(hi+lo)/2;origin=center+right*middle[0]+up*middle[1]
   vertices=np.array([origin-right*span[0]/2-up*span[1]/2,origin+right*span[0]/2-up*span[1]/2,origin+right*span[0]/2+up*span[1]/2,origin-right*span[0]/2+up*span[1]/2])
   pr=projection.copy();pr[:,:,0]=(pr[:,:,0]-middle[0])/span[0]*(TILE-4)+TILE/2;pr[:,:,1]=TILE/2-(pr[:,:,1]-middle[1])/span[1]*(TILE-4)
   pixels=np.zeros((TILE,TILE,4),dtype=np.uint8);depth=np.full((TILE,TILE),-np.inf,dtype=np.float32)
   for q in range(len(pr)):
    v=pr[q];den=(v[1,1]-v[2,1])*(v[0,0]-v[2,0])+(v[2,0]-v[1,0])*(v[0,1]-v[2,1])
    if abs(den)<1e-7:continue
    x0=max(1,int(np.floor(v[:,0].min())));x1=min(TILE-2,int(np.ceil(v[:,0].max())));y0=max(1,int(np.floor(v[:,1].min())));y1=min(TILE-2,int(np.ceil(v[:,1].max())))
    if x1<x0 or y1<y0:continue
    yy,xx=np.mgrid[y0:y1+1,x0:x1+1];xx=xx+.5;yy=yy+.5
    a=((v[1,1]-v[2,1])*(xx-v[2,0])+(v[2,0]-v[1,0])*(yy-v[2,1]))/den;b=((v[2,1]-v[0,1])*(xx-v[2,0])+(v[0,0]-v[2,0])*(yy-v[2,1]))/den;cc=1-a-b;z=a*v[0,2]+b*v[1,2]+cc*v[2,2]
    mask=(a>=-1e-5)&(b>=-1e-5)&(cc>=-1e-5)&(z>depth[y0:y1+1,x0:x1+1])
    if not mask.any():continue
    tex=a[:,:,None]*ts[q,0]+b[:,:,None]*ts[q,1]+cc[:,:,None]*ts[q,2];tx=np.clip(np.rint(tex[:,:,0]*(photo.shape[1]-1)).astype(int),0,photo.shape[1]-1);ty=np.clip(np.rint(tex[:,:,1]*(photo.shape[0]-1)).astype(int),0,photo.shape[0]-1)
    mask &= alpha[ty,tx]>=100
    ny=a*ns[q,0,2]+b*ns[q,1,2]+cc*ns[q,2,2];light=.87+.13*np.abs(ny)
    rgb=np.clip(photo[ty,tx]*light[:,:,None],0,255).astype(np.uint8);dest=pixels[y0:y1+1,x0:x1+1];dest[:,:,:3][mask]=rgb[mask];dest[:,:,3][mask]=255;depth[y0:y1+1,x0:x1+1][mask]=z[mask]
   # Expand only RGB under transparent pixels to protect mipmap needle edges.
   occupied=pixels[:,:,3]>0
   for repeat in range(6):
    prev=pixels[:,:,:3].copy();known=np.any(prev>0,axis=2);total=np.zeros(prev.shape,dtype=np.float32);n=np.zeros(known.shape,dtype=np.float32)
    for dy,dx in [(0,1),(0,-1),(1,0),(-1,0)]:
     moved=np.roll(prev,(dy,dx),(0,1));has=np.roll(known,(dy,dx),(0,1));total+=moved*has[:,:,None];n+=has
    fill=(~known)&(n>0);pixels[:,:,:3][fill]=(total[fill]/n[fill,None]).astype(np.uint8)
   index=c*3+side;atlas.paste(Image.fromarray(pixels),(index%COLS*TILE,index//COLS*TILE));cards.append({'cluster':c,'side':side,'vertices':vertices.tolist(),'center':origin.tolist()});tiles.append({'cluster':c,'side':side,'sourceTriangles':int(len(pr)),'alphaCoverage':float(occupied.mean())})
  print('Baked source branch',c+1,'/',count,flush=True)
 atlas.save(cache);meta.write_text(json.dumps({'cards':cards,'tiles':tiles,'rootOffset':ROOT},indent=2))
else:atlas=Image.open(cache)
record=json.loads(meta.read_text());cards=record['cards']
# Blender z-up -> glTF y-up, apply common root once to all variants.
def convert(x,position=True):
 x=np.array(x,dtype=np.float32).copy()
 if position:x[:,2]-=ROOT
 return np.stack((x[:,0],x[:,2],-x[:,1]),axis=1)
manifest={'asset':'https://polyhaven.com/a/pine_sapling_small','authors':{'Rico Cilliers':'Modeling','Rob Tuytel':'Photography'},'license':'CC0-1.0','changes':'Original sapling A trunk and branch positions retained. Each complete original needle/cone component assigned to its nearest original woody twig. Those 27 twig groups are orthographically baked from the source geometry, UVs, photographs and alpha into three crossed, locally oriented cutout planes per twig; no opaque canopy volumes and no arbitrary branch placement. Each plane has explicit opposing front faces with shared upward/spherical normals, preserving soft foliage lighting without backface normal inversion. Only distant trunk geometry is decimated. Textures are resized and WebP compressed. Z-up converted to Y-up; roots aligned to zero.','sourceGeometry':{'trunkTriangles':540,'foliageTriangles':141966,'twigGroups':count},'variants':{}}
manifest['sourceFiles']=json.loads((P/'source-provenance.json').read_text())['files']
manifest['licenseUrl']='https://polyhaven.com/license'
manifest['apiDocumentation']='https://polyhaven.com/our-api'
for key,tile,barksize,barkpath in [('desktop',160,512,None),('mobile',112,256,None),('desktopFar',80,128,'bark-far.npy'),('mobileFar',56,128,'bark-mobilefar.npy')]:
 g={'asset':{'version':'2.0','generator':'Camber Reign offline source-derived twig bake','copyright':'Pine Sapling Small by Rico Cilliers and Rob Tuytel / Poly Haven, CC0-1.0'},'extensionsUsed':['EXT_texture_webp'],'extensionsRequired':['EXT_texture_webp'],'scene':0,'scenes':[{'nodes':[0,1]}],'nodes':[{'name':'pine-trunk','mesh':0},{'name':'pine-needle-branches','mesh':1}],'meshes':[],'materials':[],'textures':[],'images':[],'samplers':[{'magFilter':9729,'minFilter':9987,'wrapS':10497,'wrapT':10497}],'accessors':[],'bufferViews':[],'buffers':[]};binary=bytearray()
 def buf(raw,target=None):
  while len(binary)%4:binary.append(0)
  idx=len(g['bufferViews']);view={'buffer':0,'byteOffset':len(binary),'byteLength':len(raw)}
  if target:view['target']=target
  g['bufferViews'].append(view);binary.extend(raw);return idx
 def accessor(arr,kind):
  arr=np.asarray(arr);view=buf(arr.tobytes(),34962 if kind!='SCALAR' else 34963);index=len(g['accessors']);acc={'bufferView':view,'componentType':5126 if arr.dtype==np.float32 else 5123,'count':len(arr),'type':kind}
  if kind=='VEC3':acc['min']=arr.min(0).tolist();acc['max']=arr.max(0).tolist()
  g['accessors'].append(acc);return index
 def texture(im,name):
  out=io.BytesIO();im.save(out,format='WEBP',quality=86,method=6,exact=True);index=len(g['images']);g['images'].append({'bufferView':buf(out.getvalue()),'mimeType':'image/webp','name':name});g['textures'].append({'sampler':0,'extensions':{'EXT_texture_webp':{'source':index}}});return index
 leaf=atlas.resize((tile*COLS,tile*ROWS),Image.Resampling.LANCZOS)
 # Keep source needle coverage meaningful at the far mip budget. This applies
 # a cutout coverage threshold after minification, without filling branch gaps.
 # The material is alpha-test only; binary alpha greatly reduces transfer cost.
 arr=np.array(leaf);arr[:,:,3]=np.where(arr[:,:,3]>=(72 if 'Far' in key else 80),255,0).astype('uint8');leaf=Image.fromarray(arr)
 barktex=texture(barkphoto.resize((barksize,barksize),Image.Resampling.LANCZOS),'pine-source-bark');leaftex=texture(leaf,'pine-original-needle-sprays')
 g['materials']=[{'name':'pine-source-bark','pbrMetallicRoughness':{'baseColorTexture':{'index':barktex},'roughnessFactor':.94,'metallicFactor':0}},{'name':'pine-needle-cutouts','doubleSided':False,'alphaMode':'MASK','alphaCutoff':.36,'pbrMetallicRoughness':{'baseColorTexture':{'index':leaftex},'roughnessFactor':1,'metallicFactor':0}}]
 trunks=np.load(P/barkpath) if barkpath else bark;trunks=trunks.reshape(-1,8).copy();tp=convert(trunks[:,:3]);tp[:,1]-=tp[:,1].min();tn=convert(trunks[:,3:6],False);tu=trunks[:,6:8];parts=[(tp,tn,tu,np.arange(len(tp),dtype=np.uint16))]
 ps=[];ns=[];ts=[];idx=[]
 for i,card in enumerate(cards):
  vertices=np.array(card['vertices']);converted=convert(vertices);origin=convert(np.array([card['center']]))[0];outward=np.array([origin[0]*.35,.7,origin[2]*.35]);outward/=np.linalg.norm(outward);offset=len(ps);face=np.cross(converted[1]-converted[0],converted[2]-converted[0]);face/=np.linalg.norm(face);ps.extend(converted+face*.000002);ps.extend(converted-face*.000002);ns.extend([outward]*8)
  # Cards are bottom-left, bottom-right, top-right, top-left. glTF top-left UVs.
  gutter=2/TILE;carduv=[((i%COLS+u)/COLS,(i//COLS+v)/ROWS) for u,v in [(gutter,1-gutter),(1-gutter,1-gutter),(1-gutter,gutter),(gutter,gutter)]];ts.extend(carduv+carduv);idx.extend([offset,offset+1,offset+2,offset,offset+2,offset+3,offset+6,offset+5,offset+4,offset+7,offset+6,offset+4])
 parts.append((np.array(ps,dtype=np.float32),np.array(ns,dtype=np.float32),np.array(ts,dtype=np.float32),np.array(idx,dtype=np.uint16)))
 for material,(ps,ns,ts,idx) in enumerate(parts):g['meshes'].append({'name':['pine-trunk','pine-needle-branches'][material],'primitives':[{'attributes':{'POSITION':accessor(ps,'VEC3'),'NORMAL':accessor(ns,'VEC3'),'TEXCOORD_0':accessor(ts.astype(np.float32),'VEC2')},'indices':accessor(idx,'SCALAR'),'material':material}]})
 while len(binary)%4:binary.append(0)
 g['buffers']=[{'byteLength':len(binary)}];js=json.dumps(g,separators=(',',':')).encode();js+=b' '*((-len(js))%4);glb=struct.pack('<III',0x46546c67,2,12+8+len(js)+8+len(binary))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(binary),0x004e4942)+binary
 name='pine-sapling-small'+('-far' if 'Far' in key else '')+('-mobile' if key.startswith('mobile') else '')+'.glb';(O/name).write_bytes(glb)
 points=np.concatenate([p[0] for p in parts]);variant={'file':name,'triangles':int(sum(len(p[3])//3 for p in parts)),'primitives':2,'bytes':len(glb),'sha256':hashlib.sha256(glb).hexdigest(),'minY':float(points[:,1].min()),'height':float(points[:,1].max()-points[:,1].min()),'radius':float(np.linalg.norm(points[:,[0,2]],axis=1).max()),'twigGroups':count,'canopyCards':len(cards),'embeddedImages':2,'textureDimensions':[[barksize,barksize],[tile*COLS,tile*ROWS]],'alphaMode':'MASK','alphaCutoff':.36};manifest['variants'][key]=variant;print(key,variant,flush=True)
(O/'provenance.json').write_text(json.dumps(manifest,indent=2)+'\n');(O/'scanned-pine-manifest.js').write_text('// Generated CC0 source-derived pine branches; see trees/pine-provenance.json.\nexport const SCANNED_PINE_SHAPE=Object.freeze({maxHeightToRadius:2.7338345717972268,uniform:true});\nexport const SCANNED_PINE_VARIANTS=Object.freeze('+json.dumps(manifest['variants'],indent=2)+');\n')
