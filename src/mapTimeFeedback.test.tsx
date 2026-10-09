import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {createCharacterStationRun,reducer,type Run} from './engine';
import {buildStationJourney} from './stationJourney';
import {initialMapTravel,trainPoint} from './stationMapTravel';
import {trackMapChildDelay,visibleChildDelay} from './mapTimeFeedback';
import {MapObstructionTimeLoss} from './MapObstructionPanel';

function childEncounter(character:'student'|'worker'|'tourist'|'mom'='student'){
 let s=createCharacterStationRun('hangzhou',character,false,()=>.6);
 s={...s,phase:'station',remaining:10000,elapsed:0,stationJourney:buildStationJourney(s),stationRunning:true};
 const map=initialMapTravel(s),child={...map.obstacles.find(o=>o.kind==='child')!,phase:0};
 s.stationMap={...map,obstacles:[child],position:{x:child.point.x-child.direction.x*7,y:child.point.y-child.direction.y*7},path:[{x:child.point.x+child.direction.x*20,y:child.point.y+child.direction.y*20}],destination:trainPoint(s),legDistance:40};
 const blocked=reducer(s,{type:'TICK',dt:.1});
 expect(blocked.stationMap!.block?.id).toBe('map-child');
 return blocked;
}

describe('visible time loss when avoiding a child',()=>{
 it.each(['student','worker','tourist','mom'] as const)('tracks the %s countdown spent choosing and waiting, without charging it again',character=>{
  let s=childEncounter(character);const before=s.remaining;
  expect(s.stationMap!.childDelay?.seconds).toBe(0);
  s=reducer(s,{type:'TICK',dt:2});
  expect(s.stationMap!.childDelay?.seconds).toBeCloseTo(2,8);
  s=reducer(s,{type:'MAP_CLEAR',method:'wait'});
  expect(s.remaining).toBeCloseTo(before-2,8);
  s=reducer(s,{type:'TICK',dt:2.2});
  const delay=s.stationMap!.childDelay!;
  expect(delay.active).toBe(false);expect(delay.seconds).toBeCloseTo(4.2);
  expect(s.remaining).toBeCloseTo(before-4.2);expect(s.stationMap!.block).toBeNull();
  const html=renderToStaticMarkup(<MapObstructionTimeLoss run={s}/>);
  expect(html).toContain('map-time-loss complete');expect(html).toContain('−4.2 秒');
  expect(html).toContain('避让小孩，耽误了');expect(html).not.toContain('0:');
 });
 it('keeps counting through the physical sidestep, then freezes the feedback when back on the road',()=>{
  let s=childEncounter();const before=s.remaining;
  s=reducer(s,{type:'MAP_CLEAR',method:'sidestep'});
  expect(s.remaining).toBe(before);expect(s.stationMap!.childDelay?.active).toBe(true);
  for(let i=0;i<1500&&s.stationMap!.childDelay?.active;i++)s=reducer(s,{type:'TICK',dt:.1});
  const delay=s.stationMap!.childDelay!;
  expect(delay.active).toBe(false);expect(delay.seconds).toBeGreaterThan(0);
  expect(delay.seconds).toBeCloseTo(before-s.remaining);
  expect(s.stationMap!.bypassing).toBe(false);
  s=reducer(s,{type:'TICK',dt:1});expect(s.stationMap!.childDelay?.seconds).toBe(delay.seconds);
  expect(visibleChildDelay(s)).not.toBeNull();
  s=reducer(s,{type:'TICK',dt:2.1});expect(visibleChildDelay(s)).toBeNull();
 });
 it('shows a clear ongoing notice as soon as the child blocks the player',()=>{
  let s=childEncounter();
  expect(renderToStaticMarkup(<MapObstructionTimeLoss run={s}/>)).toContain('时间正在流失');
  s=reducer(s,{type:'TICK',dt:1});
  const html=renderToStaticMarkup(<MapObstructionTimeLoss run={s}/>);
  expect(html).toContain('map-time-loss ongoing');expect(html).toContain('−1 秒');
  expect(html).toContain('被小孩打断');
 });
 it('does not carry feedback into a new run or the result page',()=>{
  const s=childEncounter();
  expect(renderToStaticMarkup(<MapObstructionTimeLoss run={{...s,phase:'result'}}/>)).toBe('');
  const fresh=createCharacterStationRun('hangzhou','student');
  expect(trackMapChildDelay(s,fresh)).toBe(fresh);expect(visibleChildDelay(fresh)).toBeNull();
 });
 it('can start tracking a child block from a run that was already open before the local update',()=>{
  const s=childEncounter(),map=s.stationMap!;
  const old:Run={...s,stationMap:{...map,childDelay:undefined}};
  const next=reducer(old,{type:'TICK',dt:.1});
  expect(next.stationMap!.childDelay?.active).toBe(true);
  expect(reducer(next,{type:'TICK',dt:1}).stationMap!.childDelay?.seconds).toBeCloseTo(1,8);
 });
});
