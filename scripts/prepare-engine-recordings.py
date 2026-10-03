"""Prepare credited, bounded loop banks from the source files listed in ENGINE-SOURCES.json.
Requires ffmpeg; downloads are a separate, deliberate provenance check.
"""
import argparse, array, hashlib, json, math, pathlib, struct, subprocess, wave
parser = argparse.ArgumentParser()
parser.add_argument('--sources', type=pathlib.Path, required=True)
parser.add_argument('--output', type=pathlib.Path, required=True)
parser.add_argument('--manifest', type=pathlib.Path, default=pathlib.Path(__file__).resolve().parents[1]/'public/assets/audio/ENGINE-SOURCES.json', help='Reviewed source identities, hashes and selected intervals.')
parser.add_argument('--only', action='append', default=[], help='Prepare only this bank ID (repeatable); validates names before writing.')
args = parser.parse_args()
RATE = 24000
# The reviewed provenance manifest is the sole interval/source specification.
# Verify every selected input before creating any output: a renamed or replaced
# recording must never inherit another vehicle's identity or license metadata.
manifest=json.loads(args.manifest.read_text())
entries=manifest['recordings']
specs=[(entry['id'],entry['sourceFile'],[(layer['sourceStart'],layer['sourceDuration'],layer['rev'],layer.get('sourceFile',entry['sourceFile'])) for layer in entry['layers']]) for entry in entries]
unknown=set(args.only)-{spec[0] for spec in specs}
if unknown: parser.error('Unknown bank(s): '+', '.join(sorted(unknown)))
if args.only: specs=[spec for spec in specs if spec[0] in args.only]
selected={spec[0] for spec in specs}
expected={}
for entry in entries:
 if entry['id'] not in selected: continue
 for source in [entry,*entry.get('additionalSources',[])]:
  filename=source['sourceFile']; digest=source['sourceSha256']
  if filename in expected and expected[filename]!=digest: raise ValueError(f'Conflicting source hashes: {filename}')
  expected[filename]=digest
for _,filename,ranges in specs:
 for name in {filename,*(span[3] for span in ranges)}:
  if name not in expected: raise ValueError(f'Unreviewed source: {name}')
  path=args.sources/name
  if pathlib.Path(name).name!=name: raise ValueError(f'Source must be a filename: {name}')
  if hashlib.sha256(path.read_bytes()).hexdigest()!=expected[name]: raise ValueError(f'Source hash mismatch: {name}')
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
