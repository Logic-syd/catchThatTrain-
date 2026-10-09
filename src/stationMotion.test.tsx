import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {createCharacterStationRun,reducer,type Run} from './engine';
import {buildStationJourney} from './stationJourney';
import {trainPoint} from './stationMapTravel';
import {newBlock} from './mapObstructions';
import {stationAvatarMotion} from './stationMotion';
import StationTravelMap from './StationTravelMap';
import {MapObstructionScene} from './MapObstructionPanel';

function begin(character:'student'|'worker'|'tourist'|'mom'='student'){
 let s=createCharacterStationRun('hangzhou',character,false,()=>.6);
 s={...s,phase:'station',remaining:10000,stationJourney:buildStationJourney(s)};
 return reducer(s,{type:'MAP_ENABLE'});
}
function hitDoor(){let s=begin();s=reducer(s,{type:'MAP_TARGET',point:trainPoint(s)});for(let i=0;i<1000&&!s.stationMap!.block;i++)s=reducer(s,{type:'TICK',dt:.1});return s;}

describe('avatar motions follow the actual map operation',()=>{
 it.each(['student','worker','tourist','mom'] as const)('%s runs, sprints and rests with its real input',(character)=>{
  let s=begin(character);expect(stationAvatarMotion(s,false)).toBe('waiting');
  s=reducer(s,{type:'MAP_TARGET',point:trainPoint(s)});expect(stationAvatarMotion(s,false)).toBe('running');
  s=reducer(s,{type:'SPRINT_INPUT',held:true});expect(stationAvatarMotion(s,false)).toBe('sprinting');
  s=reducer(s,{type:'SPRINT_INPUT',held:false});expect(stationAvatarMotion(s,false)).toBe('running');
  s=reducer(s,{type:'RUN_INPUT',held:false});expect(stationAvatarMotion(s,false)).toBe('waiting');
 });
 it('keeps eager steps and responds to holding/releasing the ask button without passing through people',()=>{
  let s=hitDoor();const position=s.stationMap!.position;
  expect(stationAvatarMotion(s,true)).toBe('blocked');
  expect(stationAvatarMotion(s,true,{active:true,progress:.4,label:'按住说声借过'})).toBe('asking');
  expect(stationAvatarMotion(s,true,{active:false,progress:.4,label:'按住说声借过'})).toBe('blocked');
  s=reducer(s,{type:'MAP_CLEAR',method:'ask'});expect(stationAvatarMotion(s,true)).toBe('asking');
  const duration=s.stationMap!.block!.duration;
  s=reducer(s,{type:'TICK',dt:duration/2});expect(s.stationMap!.position).toEqual(position);
  s=reducer(s,{type:'TICK',dt:duration/2});expect(stationAvatarMotion(s,false)).toBe('running');
 });
 it('shows side steps for the physical detour, and rests when that detour is paused',()=>{
  let s=reducer(hitDoor(),{type:'MAP_CLEAR',method:'sidestep'});expect(stationAvatarMotion(s,false)).toBe('sidestepping');
  s=reducer(s,{type:'RUN_INPUT',held:false});expect(stationAvatarMotion(s,false)).toBe('waiting');
  s=reducer(s,{type:'RUN_INPUT',held:true});expect(stationAvatarMotion(s,false)).toBe('sidestepping');
 });
 it('brakes for children and waits honestly in security, instead of showing travel while immobilized',()=>{
  const s=begin(),map=s.stationMap!;
  for(const [kind,motion] of [['child','braking'],['security','waiting']] as const){
   const obstacle=kind==='child'?map.obstacles.find(o=>o.kind===kind)!:{...map.obstacles[0],kind,id:'map-security'};
   const n:Run={...s,stationRunning:false,stationMap:{...map,obstacles:[obstacle],block:newBlock(obstacle)}};
   expect(stationAvatarMotion(n,true)).toBe(motion);
   expect(stationAvatarMotion({...n,phase:'result'},true)).toBe('waiting');
  }
 });
 it('both the map and closeup reflect the hold gesture, with articulated limbs visible',()=>{
  const run=hitDoor(),action={active:true,progress:.4,label:'按住说声借过'};
  const map=renderToStaticMarkup(<StationTravelMap run={run} dispatch={()=>{}} blocked action={action}/>);
  const closeup=renderToStaticMarkup(<MapObstructionScene run={run} action={action}/>);
  expect(map).toContain('travel-avatar asking');expect(closeup).toContain('little-you asking');
  expect(closeup).toContain('借过！');expect(closeup).toContain('little-leg left');expect(closeup).toContain('little-arm right');
  expect(renderToStaticMarkup(<MapObstructionScene run={run}/>)).not.toContain('借过！');
 });
});
