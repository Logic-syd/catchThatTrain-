import {describe,expect,it} from 'vitest';
import {createCharacterStationRun,reducer,type Run} from './engine';
import {buildStationJourney,journeyPrompt} from './stationJourney';
import {withResourceFeedback} from './resourceFeedback';
import {characterEventPrompt} from './characterTime';
import {elderPrompt} from './stationEncounters';
import {planMetroIncident} from './metroFlow';
import type {EventConfig} from './data';

type Character='student'|'worker'|'tourist'|'mom';
function standing(character:Character,city='shanghai'):Run{
 const b=createCharacterStationRun(city,character,false,()=>.5);
 const s:Run={...b,phase:'station',stationRunning:false,stationBeat:0,stationProgress:0,stage:0,event:null,stationJourney:[{id:'security-queue',stage:0,label:'等候',seconds:100},{id:'gate-scan',stage:4,label:'通道',seconds:100}]};
 if(s.characterTime)s.characterTime={...s.characterTime,energy:10,fatigue:50,energyReserve:7};
 if(s.parent)s.parent={...s.parent,energy:40,childEnergy:70,patience:76,toilet:10};
 if(s.student)s.student={...s.student,stamina:10};
 return s;
}
function eventAt(character:Character,id:string,city='shanghai'):Run{
 const b=standing(character,city),stationJourney=buildStationJourney(b),stationBeat=stationJourney.findIndex(beat=>beat.id===id);
 expect(stationBeat).toBeGreaterThanOrEqual(0);
 const s={...b,stationJourney,stationBeat,stage:stationJourney[stationBeat].stage};
 return {...s,event:journeyPrompt(s)};
}
function choose(s:Run,id:string):Run{return reducer(s,{type:'CHOICE',choice:s.event!.choices.find(c=>c.id===id)!});}
function idle(s:Run,seconds:number):Run{return reducer({...s,event:null,stationRunning:false},{type:'TICK',dt:seconds});}
function metro(character:'worker'|'tourist'):Run{
 const b=createCharacterStationRun('shanghai',character,false,()=>.5),route=b.city.spawnStations[b.spawn].routes.find(r=>r.transfers===0)!;
 let s=reducer({...b,phase:'route'},{type:'ROUTE',route});
 s=reducer(s,{type:'DIRECTION',correct:true});
 if(s.event?.id==='tourist-sleep')s=choose(s,'awake');
 return {...s,metroIncident:null,characterTime:{...s.characterTime!,energy:10,fatigue:50,energyReserve:7}};
}

describe('all charged passive time has exactly one resource settlement',()=>{
 it.each(['worker','tourist'] as const)('%s fixed queue and the same elapsed idle time restore equally',character=>{
  const s=eventAt(character,'security-queue'),c=s.event!.choices[0];
  const fixed=reducer(s,{type:'CHOICE',choice:c}),elapsed=idle(s,c.seconds);
  expect(fixed.characterTime!.energy).toBeCloseTo(elapsed.characterTime!.energy,8);
  expect(fixed.characterTime!.fatigue).toBeCloseTo(elapsed.characterTime!.fatigue,8);
  expect(fixed.characterTime!.energyReserve).toBe(7);
  expect(fixed.characterTime!.energyReserveUsed).toBe(0);
  expect(s.remaining-fixed.remaining).toBe(c.seconds);
  expect(reducer(fixed,{type:'CHOICE',choice:c})).toBe(fixed);
 });
 it('metro announcement timeout includes its fixed stationary delay once',()=>{
  const b=metro('worker'),event=planMetroIncident(b.route!,0,.9)!;
  expect(event.id).toBe('metro-announcement');
  const s={...b,event,eventElapsed:6.9},n=reducer(s,{type:'TICK',dt:.1});
  expect(s.remaining-n.remaining).toBeCloseTo(40.1,8);
  expect(n.characterTime!.fatigue).toBeCloseTo(50-40.1*.00025,8);
  expect(n.characterTime!.energy).toBe(60);
  expect(n.event).toBeNull();
  const continued=reducer(n,{type:'TICK',dt:.01});
  expect(continued.logs).toHaveLength(n.logs.length);
  expect(n.logs.at(-1)!.seconds).toBe(40);
 });
 it('failed wake-up subtracts its energy after reading recovery, including a delayed tick',()=>{
  const b=metro('tourist'),s:Run={...b,phase:'arrival',event:characterEventPrompt(b,'tourist-wake')!,eventElapsed:0,characterTime:{...b.characterTime!,energy:35,sleeping:true}};
  const large=reducer(s,{type:'TICK',dt:3});
  let small=s;for(let i=0;i<30;i++)small=reducer(small,{type:'TICK',dt:.1});
  expect(large.characterTime!.energy).toBe(29);
  expect(small.characterTime!.energy).toBe(29);
  expect(large.characterTime!.fatigue).toBeCloseTo(small.characterTime!.fatigue,8);
  expect(s.remaining-large.remaining).toBeCloseTo(83,8);
  expect(large.remaining).toBeCloseTo(small.remaining,8);
  expect(large.metroMisses).toBe(1);expect(small.metroMisses).toBe(1);
  expect(large.logs.at(-1)!.seconds).toBe(80);
 });
 it('station hesitation recovery includes a single penalty and cannot repeat it',()=>{
  const b=eventAt('worker','gate-scan'),s={...b,eventElapsed:7.9};
  const first=reducer(s,{type:'TICK',dt:.1});
  expect(first.eventOverdue).toBe(true);
  expect(s.remaining-first.remaining).toBeCloseTo(15.1,8);
  expect(first.characterTime!.fatigue).toBeCloseTo(50-15.1*.00025,8);
  const next=reducer(first,{type:'TICK',dt:.1});
  expect(first.remaining-next.remaining).toBeCloseTo(.1,8);
  expect(next.logs).toHaveLength(first.logs.length);
  const large=reducer(s,{type:'TICK',dt:1});
  let small=s;for(let i=0;i<10;i++)small=reducer(small,{type:'TICK',dt:.1});
  expect(large.remaining).toBeCloseTo(small.remaining,8);
  expect(large.characterTime).toEqual(small.characterTime);
  expect(large.logs).toHaveLength(s.logs.length+1);
 });
 it('preparation toilet waiting advances passive resources and resets urine last',()=>{
  const b=standing('mom'),s:Run={...b,phase:'preparation',stationJourney:[]};
  const n=reducer(s,{type:'PARENT_PREP',step:0,option:'toilet-first'});
  expect(s.remaining-n.remaining).toBe(60);
  expect(n.parent!.energy).toBe(70);
  expect(n.parent!.childEnergy).toBeCloseTo(71.2,8);
  expect(n.parent!.patience).toBeCloseTo(74.92,8);
  expect(n.parent!.toilet).toBe(0);
  expect(reducer(n,{type:'PARENT_PREP',step:0,option:'toilet-first'})).toBe(n);
 });
 it.each(['worker','tourist'] as const)('%s transfer animation does not recover as stationary rest',character=>{
  const b=metro(character),s:Run={...b,phase:'transfer',event:null,phaseElapsed:0};
  const n=reducer(s,{type:'TICK',dt:.5});
  expect(s.remaining-n.remaining).toBeCloseTo(.5,8);
  expect(n.characterTime!.energy).toBe(10);
  expect(n.characterTime!.fatigue).toBe(50);
  expect(n.characterTime!.energyReserve).toBe(7);
 });
 it('the actual scam outcome waits for staff; a successful push does not grant rest',()=>{
  for(const scam of [false,true]){
   const b=eventAt('worker','elder-block'),s={...b,stationLuck:{...b.stationLuck,elderScam:scam}};
   s.event=withResourceFeedback(s,elderPrompt(s.stationLuck));
   const c=s.event.choices.find(c=>c.effect==='elder-push')!,n=reducer(s,{type:'CHOICE',choice:c});
   expect(s.remaining-n.remaining).toBe(scam?60:2);
   expect(n.characterTime!.energy).toBe(scam?60:10);
   expect(n.characterTime!.fatigue).toBeCloseTo(scam?49.985:50,8);
   expect(n.event!.id).toBe('elder-outcome');
   expect(reducer(n,{type:'CHOICE',choice:c})).toBe(n);
  }
 });
 it('metro recovery uses only ride time, excluding bundled access and transfer cost',()=>{
  const s=metro('worker'),n=reducer(s,{type:'TICK',dt:.01});
  const ride=(n.metroProgress-s.metroProgress)*s.route!.minutes*60;
  expect(ride).toBeGreaterThan(0);
  expect(s.remaining-n.remaining).toBeGreaterThan(ride);
  expect(n.characterTime!.energy).toBeCloseTo(10+ride*3.5,8);
  expect(n.characterTime!.fatigue).toBeCloseTo(50-ride*.00025,8);
  expect(n.characterTime!.energyReserve).toBe(7);
 });
 it('gate cards charge walking plus queueing, but only the queue restores energy',()=>{
  const s=eventAt('worker','gates'),c=s.event!.choices.find(c=>c.waitSeconds===4)!;
  expect(c.fixedWalkSeconds).toBeGreaterThan(0);
  expect(c.seconds).toBe(c.waitSeconds!+c.fixedWalkSeconds!);
  expect(c.detail).toContain('等待期间：精力 +14');
  const n=reducer(s,{type:'CHOICE',choice:c});
  expect(s.remaining-n.remaining).toBe(c.seconds);
  expect(n.characterTime!.energy).toBe(24);
  expect(n.characterTime!.fatigue).toBeCloseTo(49.999,8);
  expect(n.logs.at(-1)!.resources!.energy).toEqual({before:10,after:24});
  expect(n.logs.at(-1)!.resources!.fatigue.after).toBeCloseTo(49.999,8);
  expect(c.detail).not.toContain('疲劳 −0');
 });
 it.each(['move-door','wait'] as const)('%s prepares the next alighting once, then continuing resets door readiness',option=>{
  const b=standing('student'),route=b.city.spawnStations[b.spawn].routes.find(r=>r.transfers===0)!;
  const s:Run={...b,phase:'metro',route,metroDuration:route.minutes*60,student:{...b.student!,doorReady:false}};
  s.event=withResourceFeedback(s,planMetroIncident(route,0,.5)!);
  const c=s.event.choices.find(c=>c.id===option)!,n=choose(s,option);
  expect(s.remaining-n.remaining).toBe(option==='wait'?40:12);
  expect(n.student!.doorReady).toBe(true);
  expect(n.student!.stamina).toBe(option==='wait'?n.student!.stats.energy:s.student!.stamina);
  expect(reducer(n,{type:'CHOICE',choice:c})).toBe(n);
  const arrival:Run={...n,phase:'arrival',event:null,metroStopIndex:route.stops.length-1};
  const alighted=reducer(arrival,{type:'ALIGHT'});
  expect(alighted.phase).toBe('station');
  expect(alighted.remaining).toBe(arrival.remaining);
  expect(alighted.student!.doorSavings-arrival.student!.doorSavings).toBe(12);
  expect(reducer(alighted,{type:'ALIGHT'})).toBe(alighted);
  const continued=reducer({...n,phase:'arrival',event:null,metroStopIndex:1},{type:'CONTINUE_METRO'});
  expect(continued.student!.doorReady).toBe(false);
  const later=reducer({...continued,phase:'arrival',metroStopIndex:route.stops.length-1},{type:'ALIGHT'});
  expect(continued.remaining-later.remaining).toBe(12);
 });
});

describe('fixed resource effects and waiting previews agree',()=>{
 it.each(['worker','tourist'] as const)('%s lift resource award replaces natural energy recovery, while fatigue still advances',character=>{
  const s=eventAt(character,'gz-lift','guangzhou'),c=s.event!.choices.find(c=>c.id==='lift')!;
  const n=reducer(s,{type:'CHOICE',choice:c});
  expect(n.characterTime!.energy).toBe(35);
  expect(n.characterTime!.maxEnergy).toBe(character==='worker'?60:35);
  expect(n.characterTime!.fatigue).toBeCloseTo(50-45*(character==='worker'?.00025:.00075),8);
  expect(n.characterTime!.energyReserve).toBe(7);
  expect(s.remaining-n.remaining).toBe(45);
  expect(reducer(n,{type:'CHOICE',choice:c})).toBe(n);
 });
 it('coffee and short rest keep their explicit energy and fatigue totals',()=>{
  for(const [option,cost,fatigue] of [['coffee',50,55],['rest',30,65]] as const){
   const b=createCharacterStationRun('shanghai','tourist',false,()=>.5),s:Run={...b,phase:'preparation',characterTime:{...b.characterTime!,energy:20,fatigue:70}};
   const n=reducer(s,{type:'PERSON_PICK',step:0,option});
   expect(s.remaining-n.remaining).toBe(cost);
   expect(n.characterTime!.energy).toBe(30);
   expect(n.characterTime!.energyReserve).toBe(0);
   expect(n.characterTime!.fatigue).toBe(fatigue);
  }
 });
 it('a full explicit energy award still blocks automatic energy recovery for that field',()=>{
  const s=standing('mom');
  s.parent={...s.parent!,energy:70,childEnergy:17,patience:99};
  // The blocker is a dynamic event, so use the same runtime trigger as actual play.
  const ready=reducer({...s,event:null,stationRunning:false},{type:'TICK',dt:.1});
  const c=ready.event!.choices.find(c=>c.id==='rest')!;
  expect(c.detail).toContain('家长精力 +0');
  const n=reducer(ready,{type:'CHOICE',choice:c});
  expect(n.parent!.energy).toBe(70);
  expect(n.parent!.childEnergy-ready.parent!.childEnergy).toBeCloseTo(36,8);
  expect(n.parent!.patience).toBe(100);
 });
 it('environment budget clipping normalizes both shown wait and actual recovery',()=>{
  const s=standing('student');s.student={...s.student!,environmentLoss:175};
  const raw:EventConfig={id:'escalator-operation',phase:'station',title:'扶梯等待',description:'',choices:[{label:'按住扶手',detail:'等待 30 秒',seconds:30,waitSeconds:30}]};
  s.event=withResourceFeedback(s,raw);
  const c=s.event.choices[0],n=reducer(s,{type:'CHOICE',choice:c});
  expect(c.seconds).toBe(5);expect(c.waitSeconds).toBe(5);
  expect(c.detail).toContain('体力 +25.15');
  expect(s.remaining-n.remaining).toBe(5);
  expect(n.student!.stamina).toBeCloseTo(35.145705,8);
  expect(n.student!.environmentLoss).toBe(180);
 });
 it('milk tea recovery expires within a wait instead of boosting its entire duration',()=>{
  const s=standing('student');
  s.student={...s.student!,stats:{...s.student!.stats,energy:100},choices:{tea:'buy'},stationElapsedGame:179};
  const event:EventConfig={id:'security-queue',phase:'station',title:'短等待',description:'',choices:[{id:'wait',label:'等待',detail:'等待 4 秒',seconds:4,waitSeconds:4}]};
  s.event=withResourceFeedback(s,event);
  const fixed=choose(s,'wait'),elapsed=idle(s,4);
  const plain={...s,student:{...s.student,choices:{tea:'skip'}}};plain.event=withResourceFeedback(plain,event);
  const unboosted=choose(plain,'wait');
  const rate=(unboosted.student!.stamina-s.student.stamina)/4;
  expect(fixed.student!.stamina-unboosted.student!.stamina).toBeCloseTo(rate*.2,8);
  expect(fixed.student!.stamina).toBeCloseTo(elapsed.student!.stamina,8);
  expect(fixed.student!.stationElapsedGame).toBe(183);
  expect(elapsed.student!.stationElapsedGame).toBeCloseTo(183,8);
 });
});
