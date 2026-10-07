const createShanghaiRun=(hard=false,rng=Math.random)=>createRun('shanghai','student',hard,true,rng);
// Legacy engine regression fixtures; student chapter has its own integration tests.
import {createRun} from './engine';
import {describe,it,expect} from 'vitest';
import {} from './engine';
import {stationTarget} from './stationFlow';
import {stationPrompt} from './flow';
import {findWalkPath,isBlocked,type Point} from './navigation';
describe('station walkability',()=>{
 it('a click just below the exit barrier resolves to a reachable tile',()=>{
  const path=findWalkPath({x:320,y:1467},{x:318.42,y:1399.09});
  expect(path.length).toBeGreaterThan(0);
  expect(Math.hypot(path.at(-1)!.x-320,path.at(-1)!.y-1400)).toBeLessThan(25);
 });
 it('every mandatory checkpoint and every ticket lane can be reached',()=>{
  const targets:Point[]=[{x:320,y:1400},{x:145,y:1270},{x:160,y:1190},{x:200,y:1110},{x:475,y:1065},{x:130,y:970},{x:320,y:825},{x:320,y:747},{x:478,y:642},{x:458,y:510},{x:320,y:485},{x:320,y:365}];
  let start={x:320,y:1467};
  for(const target of targets){
   const path=findWalkPath(start,target);
   expect(path.length,JSON.stringify(target)).toBeGreaterThan(0);
   expect(path.every(p=>!isBlocked(p))).toBe(true);
   expect(Math.hypot(path.at(-1)!.x-target.x,path.at(-1)!.y-target.y)).toBeLessThan(25);
   start=path.at(-1)!;
  }
  for(let i=0;i<8;i++){
   const gate={x:68+i*72,y:250},path=findWalkPath(start,gate);
   expect(path.length).toBeGreaterThan(0);
   expect(Math.hypot(path.at(-1)!.x-gate.x,path.at(-1)!.y-gate.y)).toBeLessThan(25);
   expect(findWalkPath(path.at(-1)!,{x:320,y:93}).length).toBeGreaterThan(0);
  }
 });
 it('small pointer differences around each target do not break navigation',()=>{
  for(const target of [{x:320,y:1400},{x:475,y:1065},{x:320,y:825},{x:478,y:642},{x:320,y:365}]){
   for(const dx of [-3,-.5,0,.5,3])for(const dy of [-3,-.5,0,.5,3]){
    const path=findWalkPath({x:320,y:1467},{x:target.x+dx,y:target.y+dy});
    expect(path.length).toBeGreaterThan(0);
    expect(Math.hypot(path.at(-1)!.x-target.x,path.at(-1)!.y-target.y)).toBeLessThan(25);
   }
  }
 });
 it('clicking on scenery safely finds a reachable edge',()=>{
  const path=findWalkPath({x:320,y:1467},{x:300,y:1070});
  expect(path.length).toBeGreaterThan(0);expect(path.every(p=>!isBlocked(p))).toBe(true);
 });
});

describe('random routes and identity fallback',()=>{
 it('places the search at the gate only when ID was not found earlier',()=>{
  const r={...createShanghaiRun(),stage:4,encounters:[]};
  expect(stationTarget(r).id).toBe('identity-search');
  expect(stationTarget({...r,identityReady:true}).id).toBe('gates');
  expect(stationTarget({...r,identityReady:true,seen:['gates'],stationLane:7}).x).toBe(572);
 });
 it('can reach every random incident and both physical detours',()=>{
  const targets=[{x:160,y:1300},{x:320,y:930},{x:537,y:1310},{x:160,y:1270},{x:485,y:967},{x:390,y:1150}];
  for(const id of ['exit-closed','broken-lift','couple'])for(const c of stationPrompt(id)!.choices)if(c.detour)targets.push(c.detour);
  for(const target of targets){
   const path=findWalkPath({x:320,y:1467},target);expect(path.length).toBeGreaterThan(0);
   expect(Math.hypot(path.at(-1)!.x-target.x,path.at(-1)!.y-target.y)).toBeLessThan(25);
  }
 });
 it('uses selected incidents then resumes running',()=>{
  const r={...createShanghaiRun(),stage:0,encounters:[{stage:0,id:'auntie',x:160,y:1300,label:'question'}]};
  expect(stationTarget(r).id).toBe('auntie');
  expect(stationTarget({...r,seen:['auntie']})).toMatchObject({next:1,x:160,y:1190});
  expect(stationTarget({...r,detour:{x:537,y:1310,label:'detour'}})).toMatchObject({detour:true,x:537});
 });
});
