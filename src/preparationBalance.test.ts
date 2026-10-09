import {describe,it,expect} from 'vitest';
import {createCharacterStationRun,reducer,type Run} from './engine';
import {buildStationJourney} from './stationJourney';
import {stationPrompt,identityPrompt} from './flow';
import {simulateBalance,type BalanceCharacter} from '../scripts/simulateBalance';
import {characterEventPrompt} from './characterTime';
import {planMetroIncident} from './metroFlow';
import {movementFactor} from './studentConfig';
import {maximumTravelFactor} from './raceForecast';

describe('reading charges elapsed time, not a second fixed penalty',()=>{
 it.each(['student','worker','tourist','mom'] as const)('%s must still act after slow station reading',role=>{
  const base=createCharacterStationRun('guangzhou',role,false,()=>.6);
  const s:Run={...base,phase:'station',remaining:1200,event:stationPrompt('security')!};
  s.stationJourney=buildStationJourney(s);s.stationBeat=s.stationJourney.findIndex(b=>b.id==='security');
  const n=reducer(s,{type:'TICK',dt:20});
  expect(s.remaining-n.remaining).toBeCloseTo(20);expect(n.event).toBe(s.event);
  expect(n.stationBeat).toBe(s.stationBeat);expect(n.logs).toEqual(s.logs);
  expect(n.timeLedger.entries.every(e=>e.category==='interaction')).toBe(true);
 });
 it('waiting does not search a bag; a wrong item still has its actual mistake cost',()=>{
  const s:Run={...createCharacterStationRun('beijing','worker'),phase:'metro',event:identityPrompt('metro')};
  const wait=reducer(s,{type:'TICK',dt:25});
  expect(wait.remaining).toBe(s.remaining-25);expect(wait.identityStage).toBe('wallet');
  const wrong=reducer(wait,{type:'ID_PICK',item:'phone'});
  expect(wrong.remaining).toBe(wait.remaining-5);expect(wrong.identityReady).toBe(false);
 });
 it('ignoring an actual alarm still misses the stop, and announcement expiry keeps the seated choice',()=>{
  const base=createCharacterStationRun('shanghai','tourist',false,()=>.6),route=base.city.spawnStations[base.spawn].routes[0];
  const s:Run={...base,phase:'metro',route,metroDuration:600,metroProgress:.5,metroStopIndex:1};
  const wake={...s,event:characterEventPrompt(s,'tourist-wake')!};
  const missed=reducer(wake,{type:'TICK',dt:3});
  expect(missed.phase).toBe('metro-recovery');expect(missed.remaining).toBe(wake.remaining-83);
  const event=planMetroIncident({...route,transfers:0},.1,.9,'tourist')!;
  const seated=reducer({...s,event},{type:'TICK',dt:7});
  expect(seated.event).toBeNull();expect(seated.metroAnnouncement?.mode).toBe('seated');
  expect(seated.remaining).toBe(s.remaining-12);
 });
});

const spent=(role:BalanceCharacter,city:string,preparation:string[])=>{
 const s=simulateBalance({character:role,city,preparation,reference:true,seed:921});
 expect(s.success).toBe(true);
 return s.timeLedger.entries.filter(e=>e.deadline==='gate').reduce((sum,e)=>sum+e.seconds,0);
};
describe('preparation investments have route-dependent value',()=>{
 it.each([
  ['student','beijing','zhengzhou',['skip','check','skip'],['skip','check','eat']],
  ['worker','beijing','guangzhou',['take-gifts','leave','reply'],['take-gifts','eat','reply']],
  ['tourist','hangzhou','guangzhou',['go','keep'],['coffee','keep']],
 ] as const)('%s can trade a quicker departure against a longer walk', (role,short,long,skip,prepare)=>{
  expect(spent(role,short,[...skip])).toBeLessThan(spent(role,short,[...prepare]));
  expect(spent(role,long,[...skip])).toBeGreaterThan(spent(role,long,[...prepare]));
 });
 it('hunger affects actual walking, but never lowers the optimistic maximum used to declare a loss',()=>{
  const s=createCharacterStationRun('shanghai','student');
  const hungry={...s,student:{...s.student!,hungry:true}};
  expect(movementFactor(hungry.student)).toBeLessThan(movementFactor(s.student!));
  expect(maximumTravelFactor(hungry)).toBe(maximumTravelFactor(s));
 });
});
