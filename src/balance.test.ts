import {describe,it,expect} from 'vitest';
import {createCharacterStationRun,reducer,clockRate,type Run} from './engine';
import {applyCharacterEvent,characterEventPrompt,characterMovementFactor,createCharacterTimeState,tickCharacterTime,timedPrompt} from './characterTime';
import {buildStationJourney} from './stationJourney';
import {mapDistance,trainPoint} from './stationMapTravel';
import {STATIONS} from './stations';
import {simulateBalance,balanceSummary} from '../scripts/simulateBalance';

function mapStart(character:'worker'|'tourist'):Run{
 let s=createCharacterStationRun('shanghai',character,false,()=>.6);
 s={...s,phase:'station',remaining:1500,stationJourney:buildStationJourney(s)};
 s=reducer(s,{type:'MAP_ENABLE',manual:true});
 return reducer(s,{type:'MAP_TARGET',point:trainPoint(s)});
}

describe('resource and countdown consistency',()=>{
 it('a meal at full worker energy buys lasting capacity and is charged only once',()=>{
  let s=reducer(createCharacterStationRun('shanghai','worker',false,()=>.6),{type:'START'});
  s=reducer(s,{type:'PERSON_PICK',option:'take-gifts',step:0});const before=s.remaining;
  expect(s.characterTime!.energy).toBe(60);
  s=reducer(s,{type:'PERSON_PICK',option:'eat',step:1});
  expect(s.remaining).toBe(before-60);expect(s.characterTime!.maxEnergy).toBe(70);expect(s.characterTime!.energy).toBe(70);
  expect(reducer(s,{type:'PERSON_PICK',option:'eat',step:1})).toBe(s);
  s=reducer(s,{type:'PERSON_PICK',option:'reply',step:2});
  const recovered=tickCharacterTime(s.characterTime!,20,false);
  expect(recovered.energy).toBe(70);expect(recovered.maxEnergy).toBe(70);
 });
 it('coffee promises the actual available energy gain; fatigue reduction still applies at full energy',()=>{
  const base=createCharacterStationRun('guangzhou','tourist',false,()=>.6);
  expect(timedPrompt(base)!.choices[0].detail).not.toContain('精力 +');
  const full=reducer({...base,phase:'preparation'},{type:'PERSON_PICK',option:'coffee',step:0});
  expect(full.characterTime!.energy).toBe(35);expect(full.characterTime!.fatigue).toBe(55);
  const low={...base,characterTime:{...base.characterTime!,energy:32}};
  expect(timedPrompt(low)!.choices[0].detail).toContain('精力 +3');
  expect(reducer({...low,phase:'preparation'},{type:'PERSON_PICK',option:'coffee',step:0}).characterTime!.energy).toBe(35);
 });
 it('repairing the wheel spends time once, reduces real load and improves movement',()=>{
  const s=mapStart('tourist'),prompt=characterEventPrompt(s,'tourist-wheel')!;
  const n=reducer({...s,event:prompt},{type:'CHOICE',choice:prompt.choices[0]});
  expect(n.remaining).toBe(s.remaining-20);expect(n.characterTime!.load).toBe(s.characterTime!.load-5);
  expect(characterMovementFactor(n)).toBeGreaterThan(characterMovementFactor(s));
  expect(n.characterTime!.energy).toBe(s.characterTime!.energy);
  const dragged=applyCharacterEvent(s,'tourist-wheel',prompt.choices[1].label);
  expect(dragged.characterTime!.load).toBe(s.characterTime!.load);expect(dragged.characterTime!.energy).toBe(s.characterTime!.energy-3);
 });
 it('fatigue slows recovery without making sprinting cost less; timestep subdivision preserves resource totals',()=>{
  const t={...createCharacterTimeState('tourist',()=>.6),sprinting:true,energy:30,fatigue:85};
  const once=tickCharacterTime(t,1,true);let split=t;
  for(let i=0;i<10;i++)split=tickCharacterTime(split,.1,true);
  expect(once.energy).toBe(24);expect(split.energy).toBeCloseTo(once.energy,8);expect(split.fatigue).toBeCloseTo(once.fatigue,8);
  const tired={...t,sprinting:false,energy:10};
  expect(tickCharacterTime(tired,1,false).energy).toBeGreaterThan(tickCharacterTime(tired,1,true).energy);
  expect(tickCharacterTime(tired,1,true).energy).toBeLessThan(tickCharacterTime({...tired,fatigue:0},1,true).energy);
 });
 it.each(['worker','tourist'] as const)('exhausted %s can walk and is charged travelling time; stopping recovers faster',character=>{
  let s=mapStart(character);s={...s,characterTime:{...s.characterTime!,energy:0,exhausted:true}};
  const start=s.stationMap!.position;
  s=reducer(s,{type:'RUN_INPUT',held:true});expect(clockRate(s)).toBe(4);
  const walk=reducer(s,{type:'TICK',dt:.1});
  expect(mapDistance(start,walk.stationMap!.position)).toBeGreaterThan(0);expect(walk.remaining).toBeCloseTo(s.remaining-.4);
  expect(walk.characterTime!.sprinting).toBe(false);expect(walk.characterTime!.exhausted).toBe(true);
  const stopped=reducer(reducer(s,{type:'RUN_INPUT',held:false}),{type:'TICK',dt:.1});
  expect(stopped.stationMap!.position).toEqual(start);expect(stopped.remaining).toBeCloseTo(s.remaining-.1);
  expect(stopped.characterTime!.energy).toBeGreaterThan(walk.characterTime!.energy);
 });
 it('a delayed map frame matches smooth updates in position, time and energy instead of charging for lost movement',()=>{
  const s=reducer(mapStart('worker'),{type:'SPRINT_INPUT',held:true});
  const delayed=reducer(s,{type:'TICK',dt:.5});let smooth=s;
  for(let i=0;i<5;i++)smooth=reducer(smooth,{type:'TICK',dt:.1});
  expect(mapDistance(delayed.stationMap!.position,smooth.stationMap!.position)).toBeLessThan(1e-8);
  expect(delayed.remaining).toBeCloseTo(smooth.remaining,8);expect(delayed.characterTime!.energy).toBeCloseTo(smooth.characterTime!.energy,8);
  for(const dt of [NaN,Infinity,-1,0])expect(reducer(s,{type:'TICK',dt})).toBe(s);
 });
});

describe('complete map balance scenarios, including reading and actual interactions',()=>{
 it('reasonable bursts clear every station, while blindly held student sprinting fails and both time ledgers reconcile',()=>{
  for(const st of STATIONS)for(const seed of [921,1087]){
   const paced=simulateBalance({city:st.id,reading:5,seed}),rush=simulateBalance({city:st.id,policy:'sprint',reading:5,seed});
   expect(paced.success,`${st.id}/${seed}`).toBe(true);expect(paced.student!.breathStops).toBe(0);
   expect(rush.success,`${st.id}/${seed} blind sprint`).toBe(false);expect(rush.student!.breathStops).toBeGreaterThanOrEqual(2);
   for(const run of [paced,rush])expect(balanceSummary(run).ledgerError).toBeCloseTo(0,2);
  }
 });
 it('prepared parent and tourist routes have room for reading in the two longest stations',()=>{
  for(const city of ['shanghai','guangzhou'])for(const character of ['mom','tourist'] as const)for(const seed of [921,1087]){
   const s=simulateBalance({city,character,reading:5,seed});
   expect(s.success,`${city}/${character}/${seed}`).toBe(true);
   if(s.parent)expect(s.parent.toiletVisits).toBe(1);
  }
 });
 it('skipping the parent bathroom preparation produces a real later detour, while preparing prevents that detour',()=>{
  const prepared=simulateBalance({city:'guangzhou',character:'mom',reading:5});
  const skipped=simulateBalance({city:'guangzhou',character:'mom',reading:5,preparation:['toilet-skip','snacks-pack']});
  expect(prepared.logs.some(l=>l.eventId==='parent-toilet')).toBe(false);
  expect(skipped.logs.some(l=>l.eventId==='parent-toilet'&&l.seconds===75)).toBe(true);
 });
 it('scenario randomness is restored and the same seed reproduces time and losses',()=>{
  const original=Math.random,a=balanceSummary(simulateBalance({city:'shanghai',seed:84}));
  expect(Math.random).toBe(original);expect(balanceSummary(simulateBalance({city:'shanghai',seed:84}))).toEqual(a);
 });
});
