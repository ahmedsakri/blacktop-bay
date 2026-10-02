"""Prepare credited, bounded loop banks from the source files listed in ENGINE-SOURCES.json.
Requires ffmpeg; downloads are a separate, deliberate provenance check.
"""
import argparse, array, hashlib, json, math, pathlib, struct, subprocess, wave
parser = argparse.ArgumentParser()
parser.add_argument('--sources', type=pathlib.Path, required=True)
parser.add_argument('--output', type=pathlib.Path, required=True)
args = parser.parse_args()
RATE = 24000
specs = [
 ('ferrari-355', 'ferrari-43484.mp3', [(1.2,1.5,.10),(5.1,1.5,.55),(8.55,1.45,.95)]),
 ('porsche-911', 'porsche-55727.mp3', [(0.15,1.4,.10),(4.35,1.45,.55),(2.25,1.5,.95)]),
 ('mustang-idle', 'mustang-119449.mp3', [(4.0,2.1,.10)]),
 ('aston-acceleration', 'aston-0600.wav', [(0.2,1.1,.15),(1.4,1.1,.80)]),
]
args.output.mkdir(parents=True,exist_ok=True)
results=[]
for ident,filename,ranges in specs:
 source=args.sources/filename
 raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(source),'-ac','1','-ar',str(RATE),'-af','highpass=f=65,lowpass=f=5800','-f','f32le','-'])
 values=array.array('f'); values.frombytes(raw)
 packed=[]; layers=[]
 for start,length,rev in ranges:
  x=list(values[round(start*RATE):round((start+length)*RATE)])
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
  layers.append({'start':round(begin,6),'end':round(len(packed)/RATE,6),'rev':rev,'sourceStart':start,'sourceDuration':length})
 target=args.output/(ident+'-v1.wav')
 with wave.open(str(target),'wb') as f:
  f.setnchannels(1);f.setsampwidth(2);f.setframerate(RATE);f.writeframes(struct.pack('<'+'h'*len(packed),*packed))
 results.append({'id':ident,'file':target.name,'bytes':target.stat().st_size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'duration':len(packed)/RATE,'sampleRate':RATE,'sourceFile':filename,'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'layers':layers})
(args.output/'engine-loop-data.json').write_text(json.dumps(results,indent=2)+'\n')
print(json.dumps({'banks':len(results),'totalBytes':sum(r['bytes'] for r in results),'banksData':results},indent=2))
