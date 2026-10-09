import {describe,it,expect} from 'vitest';
import {createCharacterStationRun,reducer,projectedTime,journeyRouteSeconds,STOP_BEFORE,type Run} from './engine';
import {freshTimeLedger} from './timeLedger';
import {buildStationJourney} from './stationJourney';
import {characterEventPrompt} from './characterTime';
import {mapSecurityBlock,newBlock} from './mapObstructions';
import {trainPoint} from './stationMapTravel';
import {transferStopIndex} from './metroFlow';
import {simulateBalance} from '../scripts/simulateBalance';

const roles=['student','worker','tourist','mom'] as const;
function reconciles(s:Run){
 expect(s.timeLedger.totalSeconds).toBeCloseTo(s.initial-s.remaining,7);
 expect(s.timeLedger.entries.reduce((sum,e)=>sum+e.seconds,0)).toBeCloseTo(s.initial-s.remaining,7);
 expect(s.timeLedger.entries.filter(e=>e.category==='unclassified')).toEqual([]);
 expect(s.timeLedger.realSeconds).toBeCloseTo(s.elapsed,7);
 if(s.gatePassed)expect(s.initial-STOP_BEFORE-s.timeLedger.entries.filter(e=>e.deadline==='gate').reduce((sum,e)=>sum+e.seconds,0)).toBeCloseTo(s.gateRemaining,7);
}
function station(character:typeof roles[number]='student'):Run{
 let s=createCharacterStationRun('beijing',character,false,()=>.6);
 s={...s,phase:'station',stationJourney:buildStationJourney(s)};
 return reducer(s,{type:'MAP_ENABLE',manual:true});
}

describe('actual countdown accounting for every character',()=>{
 it.each(roles)('%s records completed routes and failed runs without treating display logs as charges',character=>{
  for(const policy of ['paced','sprint'] as const)reconciles(simulateBalance({city:'guangzhou',character,policy,seed:921,reading:5}));
 });
 it('preserves all 48 opening budgets while exposing their unallocated buffer',()=>{
  const baselines={shanghai:[1770,1860,1980,1860],beijing:[1230,1380,1500,1350],guangzhou:[1710,1830,1950,1830],hangzhou:[1080,1200,1290,1170],wuhan:[1560,1740,1830,1680],zhengzhou:[1470,1620,1710,1560]};
  for(const [city,budgets] of Object.entries(baselines))for(const [i,character] of roles.entries())for(const hard of [false,true]){
   const s=createCharacterStationRun(city,character,hard,()=>.6);
   expect(s.initial-STOP_BEFORE).toBe(budgets[i]-(hard?(character==='mom'?75:90):0));
   expect(s.timeBudget!.departureBudgetSeconds).toBe(s.initial);
   expect(s.timeBudget!.calibration.errorBudgetSeconds).toBeNull();
  }
 });
 it('sleep charges only the jumped route share and keeps the selected metro price frozen',()=>{
  let s=createCharacterStationRun('shanghai','tourist',false,()=>.6);
  s=reducer({...s,phase:'route'},{type:'ROUTE',route:s.city.spawnStations[0].routes[0]});
  s={...s,phase:'metro',metroProgress:.2,characterTime:{...s.characterTime!,fatigue:90,load:80}};
  expect(journeyRouteSeconds(s,s.route!)).not.toBeCloseTo(s.metroDuration);
  expect(projectedTime(s)).toBeCloseTo(s.remaining-STOP_BEFORE-s.metroDuration*.8);
  const event=characterEventPrompt(s,'tourist-sleep')!;s={...s,event};
  const n=reducer(s,{type:'CHOICE',choice:event.choices.find(c=>c.label.startsWith('提前 1'))!});
  const delta=(n.metroProgress-s.metroProgress)*s.metroDuration;
  expect(s.remaining-n.remaining).toBeCloseTo(delta);
  expect(n.timeLedger.totalSeconds).toBeCloseTo(delta);
  expect(n.timeLedger.entries.every(e=>e.category.startsWith('metro'))).toBe(true);
  reconciles(n);
 });
 it.each(roles)('%s pays the frozen transfer itinerary once, with transfer operation time separate',character=>{
  let s=createCharacterStationRun('shanghai',character,false,()=>.6);
  const route=s.city.spawnStations[0].routes.find(r=>r.transfers>0)!;
  s=reducer({...s,phase:'route'},{type:'ROUTE',route});
  s=reducer({...s,metroIncident:null,seen:['tourist-sleep']},{type:'DIRECTION',correct:true});
  for(let i=0;i<500&&s.phase!=='station'&&s.phase!=='result';i++){
   if(s.event){s=reducer(s,{type:'TICK',dt:1});s=reducer(s,{type:'CHOICE',choice:s.event!.choices[0]});}
   else if(s.phase==='arrival')s=reducer(s,{type:s.metroStopIndex===route.stops.length-1||s.metroStopIndex===transferStopIndex(route)?'ALIGHT':'CONTINUE_METRO'});
   else{s=reducer(s,{type:'PREPARE_DOOR'});s=reducer(s,{type:'TICK',dt:.1});}
  }
  expect(s.phase).toBe('station');expect(s.metroTransferred).toBe(true);
  const sum=(category:string)=>s.timeLedger.entries.filter(e=>e.category===category).reduce((n,e)=>n+e.seconds,0);
  expect(sum('metroRide')).toBeCloseTo(s.metroTimeBudget!.rideSeconds,7);
  expect(sum('metroWalk')).toBeCloseTo(s.metroTimeBudget!.walkSeconds,7);
  expect(sum('metroTransfer')).toBeCloseTo(s.metroTimeBudget!.transferSeconds,7);
  reconciles(s);
 });
 it('wrong-direction recovery separates elapsed waiting from its fixed penalty',()=>{
  let s=createCharacterStationRun('hangzhou','worker');
  s=reducer({...s,phase:'direction'},{type:'DIRECTION',correct:false});
  s=reducer(s,{type:'TICK',dt:2.5});
  expect(s.timeLedger.entries.find(e=>e.category==='recoveryWait')!.seconds).toBe(2.5);
  expect(s.timeLedger.entries.find(e=>e.category==='navigationPenalty')!.seconds).toBe(75);
  reconciles(s);
 });
 it('queue ticks consume time once; completed queue logs and tray actions do not charge again',()=>{
  let s=station(),securityIndex=s.stationJourney.findIndex(b=>b.id==='security-queue');
  const security=mapSecurityBlock(s,s.stationMap!.position);
  s={...s,stationBeat:securityIndex,stationMap:{...s.stationMap!,block:security.block,obstacles:[security.obstacle]}};
  s=reducer(s,{type:'MAP_CLEAR',method:'join',lane:0});
  while(s.stationMap!.block!.mode==='queue')s=reducer(s,{type:'TICK',dt:.1});
  const before=s.remaining,charged=s.timeLedger.totalSeconds;
  const done=reducer(s,{type:'MAP_CLEAR',method:'tray'});
  expect(done.logs.at(-1)!.seconds).toBeGreaterThan(0);
  expect(done.remaining).toBe(before);expect(done.timeLedger.totalSeconds).toBe(charged);
  expect(done.stationJourney[done.stationBeat].id).not.toBe('bj-tray');
  expect(done.timeLedger.entries.some(e=>e.category==='securityQueue')).toBe(true);
  reconciles(done);
 });
 it('waiting for a child exposes the actual delay without an extra feedback charge',()=>{
  let s=station();const child={id:'map-child',kind:'child' as const,point:s.stationMap!.position,direction:{x:1,y:0},cleared:false,phase:0};
  s={...s,stationMap:{...s.stationMap!,obstacles:[child],block:newBlock(child)}};
  s=reducer(s,{type:'MAP_CLEAR',method:'wait'});
  const n=reducer(s,{type:'TICK',dt:2.2});
  expect(n.timeLedger.totalSeconds).toBeCloseTo(2.2);
  expect(n.stationMap!.childDelay!.seconds).toBeCloseTo(2.2);
  expect(n.logs.at(-1)!.seconds).toBeCloseTo(2.2);reconciles(n);
 });
 it('one delayed map frame equals smooth frames in both new and legacy student accounting',()=>{
  let s=station();s=reducer(s,{type:'MAP_TARGET',point:trainPoint(s)});s=reducer(s,{type:'RUN_INPUT',held:true});
  const big=reducer(s,{type:'TICK',dt:.5});let small=s;
  for(let i=0;i<5;i++)small=reducer(small,{type:'TICK',dt:.1});
  expect(big.timeLedger).toEqual(small.timeLedger);
  expect(big.student!.clockSpent).toEqual(small.student!.clockSpent);
  reconciles(big);
  expect(Object.values(big.student!.clockSpent).reduce((sum,x)=>sum+x,0)+big.student!.decisionLoss+big.student!.environmentLoss).toBeCloseTo(big.initial-big.remaining);
 });
 it('timeouts split interaction time from penalty, and post-gate spending uses the departure deadline',()=>{
  const base=station('worker');
  let s:Run={...base,gatePassed:true,gateRemaining:base.remaining-STOP_BEFORE,event:{id:'audit-hold',phase:'station',title:'hold',description:'',interaction:{kind:'hold',seconds:1,penalty:15,required:3},choices:[]}};
  s=reducer(s,{type:'TICK',dt:1.1});
  expect(s.timeLedger.totalSeconds).toBeCloseTo(16.1);
  expect(s.timeLedger.entries.find(e=>e.category==='operationPenalty')!.seconds).toBeCloseTo(15);
  expect(s.timeLedger.entries.every(e=>e.deadline==='departure')).toBe(true);reconciles(s);
 });
 it('new runs reset accounting; invalid input and display-only logs do not add charges',()=>{
  let s=reducer(createCharacterStationRun(),{type:'START'});s=reducer(s,{type:'TICK',dt:3});
  const next=createCharacterStationRun('hangzhou');
  expect(reducer(s,{type:'NEW',run:next}).timeLedger).toEqual(freshTimeLedger());
  for(const dt of [0,-1,NaN,Infinity])expect(reducer(s,{type:'TICK',dt})).toBe(s);
 });
});
