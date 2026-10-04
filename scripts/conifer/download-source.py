# Offline downloader. Every input URL/hash is pinned in the shipped provenance.
# python3 scripts/conifer/download-source.py [--source /authoring/directory]
import argparse,json,urllib.request,pathlib,hashlib
args=argparse.ArgumentParser();args.add_argument('--source');options=args.parse_args()
repo=pathlib.Path(__file__).resolve().parents[2]
p=pathlib.Path(options.source).resolve() if options.source else repo.parent/'camber-reign-asset-sources/conifer-upgrade'
p.mkdir(parents=True,exist_ok=True)
record=json.loads((repo/'public/assets/environments/trees/pine-provenance.json').read_text())
files=record['sourceFiles']
for name,meta in files.items():
 path=p/'source'/name;path.parent.mkdir(exist_ok=True,parents=True)
 if path.exists() and hashlib.md5(path.read_bytes()).hexdigest()==meta['md5']:continue
 req=urllib.request.Request(meta['url'],headers={'User-Agent':'CamberReign-OfflineAssetPrep/1.0'})
 data=urllib.request.urlopen(req).read()
 if hashlib.md5(data).hexdigest()!=meta['md5']:raise ValueError('Source hash changed: '+name)
 path.write_bytes(data);print(name,len(data),flush=True)
(p/'source-provenance.json').write_text(json.dumps({'asset':record['asset'],'authors':record['authors'],'license':record['license'],'licenseUrl':record['licenseUrl'],'apiDocumentation':record['apiDocumentation'],'files':files},indent=2)+'\n')
print('Verified source outside the game repository:',p)
