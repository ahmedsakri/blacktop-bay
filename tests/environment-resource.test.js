import test from 'node:test';
import assert from 'node:assert/strict';
import {createEnvironmentResource} from '../src/environment-resource.js';

test('environment rebuild installs replacement before disposing old target and preserves it after a failed build',()=>{
 const scene={environment:null},events=[];let serial=0,fail=false,lost=false;
 const resource=createEnvironmentResource(scene,()=>{if(lost)return null;if(fail)throw Error('build failed');const id=++serial;return {texture:id,dispose(){events.push({disposed:id,current:scene.environment});}};});
 assert.equal(resource.rebuild(),true);assert.equal(scene.environment,1);
 fail=true;assert.throws(resource.rebuild);assert.equal(scene.environment,1);assert.equal(events.length,0);
 fail=false;lost=true;assert.equal(resource.rebuild(),false);assert.equal(scene.environment,1);
 lost=false;assert.equal(resource.rebuild(),true);assert.deepEqual(events,[{disposed:1,current:2}]);
 resource.dispose();resource.dispose();assert.equal(scene.environment,null);assert.deepEqual(events,[{disposed:1,current:2},{disposed:2,current:null}]);assert.equal(resource.rebuild(),false);assert.equal(serial,2);
});
