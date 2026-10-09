import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {createCharacterStationRun,reducer,type Run} from './engine';
import {buildStationJourney} from './stationJourney';
import {mapDistance,trainPoint} from './stationMapTravel';
import {activeObstacle} from './mapObstructions';
import {stationAvatarEffort,stationAvatarMotion} from './stationMotion';
import StationRunControls from './StationRunControls';

function begin(character:'student'|'worker'|'tourist'|'mom'='student',city='hangzhou'){
 let s=createCharacterStationRun(city,character,false,()=>.6);
 s={...s,phase:'station',remaining:10000,stationJourney:buildStationJourney(s)};
 s=reducer(s,{type:'MAP_ENABLE',manual:true});
 return reducer(s,{type:'MAP_TARGET',point:trainPoint(s)});
}
function drive(s:Run){for(let i=0;i<5000&&s.stationRunning&&!s.stationMap!.block&&!s.event;i++)s=reducer(s,{type:'TICK',dt:.1});return s;}
function hitDoor(){return drive(reducer(begin(),{type:'RUN_INPUT',held:true}));}
function markup(run:Run){return renderToStaticMarkup(<StationRunControls run={run} dispatch={()=>{}} blocked={false}/>);}
const energy=(s:Run)=>s.student?.stamina??s.characterTime?.energy??s.parent!.energy;

describe('held map travel with clear character reactions',()=>{
 it.each(['student','worker','tourist','mom'] as const)('%s chooses a route, holds to travel, and releases to rest without losing the route',character=>{
  let s=begin(character);const start=s.stationMap!.position,path=s.stationMap!.path,goal=s.stationMap!.destination;
  expect(s.stationRunning).toBe(false);expect(s.stationMap!.driveHeld).toBe(false);
  s=reducer(s,{type:'TICK',dt:.1});expect(s.stationMap!.position).toEqual(start);
  s=reducer(s,{type:'RUN_INPUT',held:true});s=reducer(s,{type:'TICK',dt:.1});
  expect(mapDistance(start,s.stationMap!.position)).toBeGreaterThan(0);expect(stationAvatarMotion(s,false)).toBe('running');
  s=reducer(s,{type:'SPRINT_INPUT',held:true});s=reducer(s,{type:'RUN_INPUT',held:false});
  const stopped=s.stationMap!.position,before=energy(s);
  s=reducer(s,{type:'TICK',dt:.5});expect(s.stationMap!.position).toEqual(stopped);expect(energy(s)).toBeGreaterThanOrEqual(before);
  expect(s.stationRunning).toBe(false);expect(s.stationMap!.driveHeld).toBe(false);
  expect(stationAvatarMotion(s,false)).toBe('waiting');expect(s.stationMap!.destination).toEqual(goal);expect(s.stationMap!.path).toEqual(path);
  s=reducer(s,{type:'RUN_INPUT',held:true});s=reducer(s,{type:'TICK',dt:.1});expect(s.stationMap!.position).not.toEqual(stopped);
 });
 it.each(['student','worker','tourist','mom'] as const)('%s sprint travels faster and spends real energy',character=>{
  const fresh=begin(character),start=fresh.stationMap!.position;
  const walk=reducer(reducer(fresh,{type:'RUN_INPUT',held:true}),{type:'TICK',dt:.1});
  const sprint=reducer(reducer(fresh,{type:'SPRINT_INPUT',held:true}),{type:'TICK',dt:.1});
  expect(stationAvatarMotion(sprint,false)).toBe('sprinting');
  expect(mapDistance(start,sprint.stationMap!.position)).toBeGreaterThan(mapDistance(start,walk.stationMap!.position));
  expect(energy(sprint)).toBeLessThan(energy(fresh));
 });
 it('upgrades an already open automatic map, then does not cancel a held gesture when enabled again',()=>{
  let s=begin();s={...s,stationMap:{...s.stationMap!,manual:false},stationRunning:true};
  s=reducer(s,{type:'MAP_ENABLE',manual:true});expect(s.stationRunning).toBe(false);
  s=reducer(s,{type:'RUN_INPUT',held:true});expect(reducer(s,{type:'MAP_ENABLE',manual:true})).toBe(s);
 });
 it('a blockage releases the travel gesture; asking for passage does not restart the player automatically',()=>{
  let s=hitDoor();expect(activeObstacle(s.stationMap!)!.kind).toBe('door');expect(s.stationMap!.driveHeld).toBe(false);
  const pos=s.stationMap!.position,goal=s.stationMap!.destination;
  for(const action of [{type:'RUN_INPUT',held:true},{type:'SPRINT_INPUT',held:true}] as const)expect(reducer(s,action)).toBe(s);
  s=reducer(s,{type:'MAP_CLEAR',method:'ask'});s=reducer(s,{type:'TICK',dt:s.stationMap!.block!.duration});
  expect(s.stationMap!.block).toBeNull();expect(s.stationRunning).toBe(false);expect(s.stationMap!.position).toEqual(pos);expect(s.stationMap!.destination).toEqual(goal);
  expect(markup(s)).toContain('路线还在。按住赶路继续');
  s=reducer(s,{type:'RUN_INPUT',held:true});s=reducer(s,{type:'TICK',dt:.1});expect(s.stationMap!.position).not.toEqual(pos);
 });
 it('a sidestep is prepared by the choice and physically performed by holding travel, including after release',()=>{
  let s=reducer(hitDoor(),{type:'MAP_CLEAR',method:'sidestep'});const pos=s.stationMap!.position;
  expect(s.stationRunning).toBe(false);expect(markup(s)).toContain('按住赶路，小人会侧身绕过前面的人。');
  s=reducer(s,{type:'TICK',dt:.1});expect(s.stationMap!.position).toEqual(pos);
  s=reducer(s,{type:'RUN_INPUT',held:true});s=reducer(s,{type:'TICK',dt:.1});expect(s.stationMap!.position.x).not.toBe(pos.x);expect(stationAvatarMotion(s,false)).toBe('sidestepping');
  s=reducer(s,{type:'RUN_INPUT',held:false});const stopped=s.stationMap!.position,path=s.stationMap!.path;
  s=reducer(s,{type:'TICK',dt:.1});expect(s.stationMap!.position).toEqual(stopped);expect(s.stationMap!.path).toEqual(path);
  s=reducer(s,{type:'RUN_INPUT',held:true});expect(drive(s).event?.id).toBe('hz-fork');
 });
 it('shows visible panting and actionable advice before the actual student breathing penalty',()=>{
  let s=begin('student','shanghai');s.student={...s.student!,sprintStrain:5};s=reducer(s,{type:'SPRINT_INPUT',held:true});
  expect(stationAvatarEffort(s)).toBe('strained');const html=markup(s);
  expect(html).toContain('呼…快岔气了！');expect(html).toContain('松开冲刺，按住赶路慢走');expect(html).toContain('little-pant');expect(html).toContain('sprinting effort-strained');
  s.student={...s.student!,sprintStrain:6.99};s=reducer(s,{type:'TICK',dt:.1});
  expect(s.event?.id).toBe('student-breath');expect(s.stationMap!.driveHeld).toBe(false);expect(s.stationRunning).toBe(false);
  s=reducer(s,{type:'CHOICE',choice:s.event!.choices[0]});expect(s.stationRunning).toBe(false);expect(s.stationMap!.path.length).toBeGreaterThan(0);
  s=reducer(s,{type:'RUN_INPUT',held:true});expect(s.stationRunning).toBe(true);
 });
 it('links the front-facing reaction to depleted energy and the tourist fatigue, rather than randomly acting tired',()=>{
  let s=begin();expect(stationAvatarEffort(s)).toBe('fresh');
  s.student={...s.student!,stamina:20};expect(stationAvatarEffort(s)).toBe('strained');
  s.student={...s.student!,stamina:0,exhausted:true};const html=markup(s);
  expect(html).toContain('呼…呼…真的跑不动了！');expect(html).toContain('waiting effort-exhausted');expect(html).toContain('class="map-sprint" disabled');expect(html).toContain('喘口气再冲');
  expect(stationAvatarEffort(begin('tourist'))).toBe('strained');
 });
 it('releases a held run when a child crisis interrupts the parent, and waits for a new gesture after it is resolved',()=>{
  let s=reducer(begin('mom'),{type:'RUN_INPUT',held:true});s.parent={...s.parent!,gap:9};
  s=reducer(s,{type:'TICK',dt:.1});expect(s.event?.id).toBe('parent-gap');expect(s.stationMap!.driveHeld).toBe(false);
  s=reducer(s,{type:'CHOICE',choice:s.event!.choices[0]});expect(s.stationRunning).toBe(false);expect(s.stationMap!.driveHeld).toBe(false);
  s=reducer(s,{type:'RUN_INPUT',held:true});expect(s.stationRunning).toBe(true);
 });
});
