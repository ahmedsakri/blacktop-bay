"""Prepare credited, bounded loop banks from the source files listed in ENGINE-SOURCES.json.
Requires ffmpeg; downloads are a separate, deliberate provenance check.
"""
import argparse, array, hashlib, json, math, pathlib, struct, subprocess, wave
parser = argparse.ArgumentParser()
parser.add_argument('--sources', type=pathlib.Path, required=True)
parser.add_argument('--output', type=pathlib.Path, required=True)
parser.add_argument('--only', action='append', default=[], help='Prepare only this bank ID (repeatable); validates names before writing.')
args = parser.parse_args()
RATE = 24000
specs = [
 ('ferrari-355', 'ferrari-43484.mp3', [(1.2,1.5,.10),(5.1,1.5,.55),(8.55,1.45,.95)]),
 ('porsche-911', 'porsche-55727.mp3', [(0.15,1.4,.10),(4.35,1.45,.55),(2.25,1.5,.95)]),
 ('mustang-idle', 'mustang-119449.mp3', [(4.0,2.1,.10)]),
 ('aston-acceleration', 'aston-0600.wav', [(0.2,1.1,.15),(1.4,1.1,.80)]),
 ('huracan-v10', 'huracan-564375.mp3', [(11.5,1.4,.10),(16.5,1.35,.55),(26.15,1.15,.95)]),
 ('murcielago-v12', 'murcielago-112075.mp3', [(4.0,1.4,.10),(33.0,1.3,.55),(44.6,1.3,.90)]),
 ('ferrari-classic-v12', 'ferrari-v12-43483.mp3', [(6.7,1.35,.10),(1.7,1.35,.55),(3.3,1.35,.95)]),
 ('honda-na-i4', 'honda-f20c.ogg', [(24.0,1.3,.10),(7.0,1.3,.50),(51.0,1.3,.95)]),
 ('audi-turbo-i4', 'audi-i4-425384.mp3', [(1.1,1.35,.10),(11.0,1.35,.50),(18.0,1.35,.95)]),
 ('volvo-turbo-i5', 'volvo-i5-95838.mp3', [(11.0,1.5,.10),(20.0,1.3,.80)]),
 ('mercedes-i6', 'mercedes-i6-433603.mp3', [(4.4,1.15,.15),(3.8,1.1,.55),(2.7,1.15,.95)]),
 ('chevrolet-v6', 'chevy-v6-351962.mp3', [(11.0,1.35,.10),(1.0,1.35,.50),(4.0,1.35,.95)]),
 ('bmw-diesel', 'diesel-401550.mp3', [(.3,1.3,.10),(.3,1.3,.55,'diesel-401547.mp3'),(.25,1.3,.95,'diesel-401549.mp3')]),
 ('tesla-electric', 'tesla-761685.mp3', [(.25,1.1,.10),(1.9,1.1,.55),(3.65,1.1,.95)]),
 ('maserati-granturismo-v8', 'maserati-465453.mp3', [(3.5,1.35,.10),(26.0,1.35,.55),(44.0,1.35,.95)]),
 ('mercedes-amg-v8', 'amg-505321.mp3', [(4.85,1.15,.10),(1.05,.80,.55),(2.35,1.10,.95)]),
]
unknown=set(args.only)-{spec[0] for spec in specs}
if unknown: parser.error('Unknown bank(s): '+', '.join(sorted(unknown)))
if args.only: specs=[spec for spec in specs if spec[0] in args.only]
args.output.mkdir(parents=True,exist_ok=True)
results=[]
for ident,filename,ranges in specs:
 source=args.sources/filename
 decoded={}
 def samples(name):
  if name not in decoded:
   raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(args.sources/name),'-ac','1','-ar',str(RATE),'-af','highpass=f=65,lowpass=f=5800','-f','f32le','-'])
   decoded[name]=array.array('f'); decoded[name].frombytes(raw)
  return decoded[name]
 packed=[]; layers=[]
 for span in ranges:
  start,length,rev=span[:3]; source_name=span[3] if len(span)>3 else filename
  values=samples(source_name)
  x=list(values[round(start*RATE):round((start+length)*RATE)])
  if len(x)!=round(length*RATE): raise ValueError(f'{ident}: source interval exceeds {source_name}')
  average=sum(x)/len(x); x=[v-average for v in x]
  n=round(min(.10,length*.09)*RATE)
  # Rotate the loop through a cosine overlap, retaining real recorded cycles.
  cross=[x[-n+i]*math.cos(i/(n-1)*math.pi/2)**2+x[i]*math.sin(i/(n-1)*math.pi/2)**2 for i in range(n)]
  out=x[n:-n]+cross
  # Remove seam DC and match the final endpoint gently to the next sample.
  mean=sum(out)/len(out); out=[v-mean for v in out]
  correction=out[0]-out[-1]
  for i in range(96): out[-96+i]+=correction*(i/95)**2
  rms=math.sqrt(sum(v*v for v in out)/len(out)); peak=max(abs(v) for v in out)
  gain=min(.18/max(rms,1e-9),.66/max(peak,1e-9)); out=[v*gain for v in out]
  begin=len(packed)/RATE; packed.extend(round(max(-1,min(1,v))*32767) for v in out)
  layer={'start':round(begin,6),'end':round(len(packed)/RATE,6),'rev':rev,'sourceStart':start,'sourceDuration':length}
  if source_name!=filename: layer['sourceFile']=source_name
  layers.append(layer)
 target=args.output/(ident+'-v1.wav')
 with wave.open(str(target),'wb') as f:
  f.setnchannels(1);f.setsampwidth(2);f.setframerate(RATE);f.writeframes(struct.pack('<'+'h'*len(packed),*packed))
 results.append({'id':ident,'file':target.name,'bytes':target.stat().st_size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'duration':len(packed)/RATE,'sampleRate':RATE,'sourceFile':filename,'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'layers':layers})
(args.output/'engine-loop-data.json').write_text(json.dumps(results,indent=2)+'\n')
print(json.dumps({'banks':len(results),'totalBytes':sum(r['bytes'] for r in results),'banksData':results},indent=2))
