// Local-only receiver for the actual WebGL review fixture. It is not part of
// the production build and accepts no arbitrary destination paths or track IDs.
import http from 'node:http';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {TRACKS} from '../src/track.js';

const root=resolve(import.meta.dirname,'../public/assets/circuits/previews');
const valid=new Set(TRACKS.map(t=>t.id)),captures=new Map(),origin='http://127.0.0.1:4197';
await mkdir(root,{recursive:true});
const server=http.createServer(async(req,res)=>{
 if(req.headers.origin!==origin){res.writeHead(403);res.end('Local fixture origin required');return;}
 res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');
 res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');
 if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
 const match=/^\/capture\/([a-z0-9-]+)$/.exec(req.url||'');
 if(req.method!=='POST'||!match||!valid.has(match[1])){res.writeHead(404);res.end('Unknown capture');return;}
 let body='';req.on('data',chunk=>{body+=chunk;if(body.length>2*1024*1024)req.destroy();});
 req.on('end',async()=>{
  try{
   const {dataUrl,metadata={}}=JSON.parse(body),id=match[1];
   if(typeof dataUrl!=='string'||!dataUrl.startsWith('data:image/webp;base64,'))throw new Error('WebP canvas capture required');
   const bytes=Buffer.from(dataUrl.slice(23),'base64');
   if(bytes.length<1000||bytes.length>500000||bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WEBP')throw new Error('Invalid or excessive image');
   if(metadata.width!==960||metadata.height!==540||!Number.isFinite(metadata.sector))throw new Error('Capture dimensions/sector required');
   const p=metadata.camera?.position,q=metadata.camera?.quaternion;
   if(!Array.isArray(p)||p.length!==3||!p.every(Number.isFinite)||!Array.isArray(q)||q.length!==4||!q.every(Number.isFinite))throw new Error('Actual camera pose required');
   await writeFile(resolve(root,`${id}.webp`),bytes);
   captures.set(id,{id,path:`/assets/circuits/previews/${id}.webp`,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),...metadata});
   const entries=TRACKS.filter(t=>captures.has(t.id)).map(t=>captures.get(t.id));
   await writeFile(resolve(root,'manifest.json'),JSON.stringify({version:1,source:'Camber Reign actual createWorld WebGL renderer',fixture:'reports/track-world-review.html',captureMethod:'CUA-controlled local browser canvas WebP export',license:'Original project-generated scene imagery; licensed source surfaces retain public/assets/environments/surfaces/provenance.json',dimensions:[960,540],quality:.78,totalBytes:entries.reduce((sum,e)=>sum+e.bytes,0),entries},null,2)+'\n');
   res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({id,bytes:bytes.length,complete:captures.size,total:TRACKS.length}));
   console.log(`Saved ${id}: ${bytes.length} bytes (${captures.size}/${TRACKS.length})`);
  }catch(error){res.writeHead(400);res.end(String(error.message||error));}
 });
});
server.listen(4198,'127.0.0.1',()=>console.log('Capture receiver ready at 127.0.0.1:4198'));
process.on('SIGINT',()=>server.close(()=>process.exit(0)));process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
