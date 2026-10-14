import {describe,it,expect} from 'vitest';
import {createCharacterStationRun,createShanghaiRun,reducer,journeyRouteSeconds,STOP_BEFORE,type Run} from './engine';
import {buildStationJourney} from './stationJourney';
import {runnerWave} from './runner';
import {eventHoldSeconds} from './eventTiming';
import {focusWindow} from './studentConfig';
function init():Run{let s=createShanghaiRun();return {...s,phase:'station' as const,remaining:1500,stationJourney:buildStationJourney(s)};}
function tick(s:Run,t:number){for(let i=0;i<Math.round(t*10);i++)s=reducer(s,{type:'TICK',dt:.1});return s;}
function rng(seed:number){return ()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
function inputTime(s:Run,seconds:number){
 for(let left=seconds;left>1e-8&&s.phase!=='result';left-=.1)s=reducer(s,{type:'TICK',dt:Math.min(.1,left)});
 return s;
}
describe('three lane running',()=>{
 it('collision actually stops progress, charges only elapsed time, one hit per obstacle',()=>{
  let s=init();s=reducer(s,{type:'RUN_INPUT',held:true});
  for(let i=0;i<200&&!s.student!.runner.blocked;i++)s=tick(s,.1);
  expect(s.student!.runner.blocked).toBe(true);const progress=s.stationProgress,time=s.remaining;
  const waiting=tick(s,8);expect(waiting.stationProgress).toBe(progress);expect(waiting.remaining).toBeCloseTo(time-8);expect(waiting.student!.runner.collisions).toBe(1);
  s=reducer(waiting,{type:'CHANGE_LANE',direction:-1});expect(s.student!.runner.blocked).toBe(false);expect(s.stationRunning).toBe(true);expect(tick(s,.3).stationProgress).toBeGreaterThan(progress);
 });
 it('dodging, boundary clamping and sprint release preserve normal running',()=>{
  let s=init();s=reducer(s,{type:'CHANGE_LANE',direction:-1});s=reducer(s,{type:'CHANGE_LANE',direction:-1});expect(s.student!.runner.lane).toBe(0);
  s=reducer(s,{type:'SPRINT_INPUT',held:true});s=tick(s,.3);s=reducer(s,{type:'SPRINT_INPUT',held:false});expect(s.stationRunning).toBe(true);expect(s.student!.sprinting).toBe(false);
  for(let i=0;i<200&&!s.event;i++){const wave=runnerWave(s);if(wave&&wave.lane===s.student!.runner.lane)s=reducer(s,{type:'CHANGE_LANE',direction:wave.lane===2?-1:1});s=tick(s,.1);}
  expect(s.student!.runner.dodges).toBeGreaterThan(0);expect(s.student!.runner.collisions).toBe(0);expect(s.event).not.toBeNull();expect(reducer(s,{type:'CHANGE_LANE',direction:1})).toBe(s);
 });
 it('pause cannot be bypassed by changing lanes',()=>{let s=init();s=reducer(s,{type:'RUN_INPUT',held:false});s=reducer(s,{type:'CHANGE_LANE',direction:1});expect(tick(s,2).stationProgress).toBe(0);});
});
describe('delayed station ticks',()=>{
 function running(character:'student'|'worker'|'tourist'|'mom'):Run{
  const base=createCharacterStationRun('shanghai',character,false,()=>.5);
  const run:Run={...base,phase:'station',remaining:1500,stationJourney:[{id:'gate-scan',stage:4,label:'approach the gate',seconds:10}],stationRunning:true};
  // Start in a clear lane so the movement comparison is independent of collisions.
  if(run.student)run.student={...run.student,runner:{...run.student.runner,lane:0,wave:99}};
  if(run.characterTime)run.characterTime={...run.characterTime,runner:{...run.characterTime.runner,lane:0,wave:99}};
  if(run.parent)run.parent={...run.parent,runner:{...run.parent.runner,lane:0,wave:99}};
  return run;
 }
 function compare(run:Run,seconds:number){
  const delayed=reducer(run,{type:'TICK',dt:seconds}),regular=tick(run,seconds);
  expect(delayed.stationProgress).toBeCloseTo(regular.stationProgress,10);
  expect(delayed.remaining).toBeCloseTo(regular.remaining,8);
  expect(delayed.elapsed).toBeCloseTo(regular.elapsed,8);
  expect(delayed.event?.id).toBe(regular.event?.id);
  expect(delayed.logs).toEqual(regular.logs);
  expect(delayed.student).toEqual(regular.student);
  expect(delayed.characterTime).toEqual(regular.characterTime);
  expect(delayed.parent).toEqual(regular.parent);
  expect(delayed.metrics).toEqual(regular.metrics);
  return delayed;
 }
 it.each(['student','worker','tourist','mom'] as const)('advances %s movement, resources and accounting for the full elapsed second',character=>{
  const run=running(character),n=compare(run,1);
  expect(run.remaining-n.remaining).toBeCloseTo(4);
  expect(n.stationProgress).toBeGreaterThan(.05);
 });
 it('uses normal time after a collision within the delayed tick',()=>{
  const run=running('student');run.student={...run.student!,runner:{...run.student!.runner,lane:1,wave:0}};
  const n=compare(run,8);
  expect(n.student!.runner.collisions).toBe(1);
  expect(n.student!.runner.blocked).toBe(true);
  expect(n.stationProgress).toBeCloseTo(.38);
  expect(run.remaining-n.remaining).toBeLessThan(32);
 });
 it('spends leftover time on the prompt after reaching the end of a segment',()=>{
  const run=running('student');run.stationProgress=.98;
  const n=compare(run,1);
  expect(n.event?.id).toBe('gate-scan');
  expect(n.eventElapsed).toBeGreaterThan(0);
  expect(run.remaining-n.remaining).toBeLessThan(4);
 });
 it('handles sprint strain and its forced stop during catch-up',()=>{
  const run=running('student');run.stationJourney[0]={...run.stationJourney[0],seconds:100};
  run.student={...run.student!,sprinting:true,sprintStrain:6.5};
  const n=compare(run,1);
  expect(n.event?.id).toBe('student-breath');
  expect(n.student!.breathStops).toBe(1);
 });
 it('keeps walking on the movement clock after sprint energy is exhausted',()=>{
  const run=running('worker');
  run.characterTime={...run.characterTime!,energy:.5,sprinting:true};
  const n=compare(run,1);
  expect(n.characterTime!.exhausted).toBe(true);
  expect(n.characterTime!.sprinting).toBe(false);
  expect(run.remaining-n.remaining).toBeCloseTo(4);
 });
 it('handles a child separation and spends leftover time on the blocking event',()=>{
  const run=running('mom');
  run.parent={...run.parent!,gap:7.4,sprinting:true};
  const n=compare(run,1);
  expect(n.event?.id).toBe('parent-gap');
  expect(n.eventElapsed).toBeGreaterThan(0);
  expect(run.remaining-n.remaining).toBeLessThan(4);
 });
 it('ignores invalid elapsed time and stops catch-up at the deadline',()=>{
  const run=running('student');
  for(const dt of [NaN,Infinity,-1,0])expect(reducer(run,{type:'TICK',dt})).toBe(run);
  run.remaining=STOP_BEFORE+.8;
  const n=compare(run,100);
  expect(n.phase).toBe('result');expect(n.elapsed).toBeLessThan(1);
 });
});
describe('fair normal-mode budget and transparent accounting',()=>{
 it.each(Array.from({length:60},(_,i)=>i+1))('skilled paced sprinting clears seed %s with transparent accounting',seed=>{
   let s=reducer(createShanghaiRun(false,rng(seed*7919)),{type:'START'});
   const initial=s.initial;let recovering=false;
   for(const option of ['skip','check','eat']){s=inputTime(s,1.2);s=reducer(s,{type:'PREP_PICK',option,step:s.student!.prep});}
   const routes=s.city.spawnStations[0].routes;
   const fastest=routes.reduce((best,route)=>journeyRouteSeconds(s,route)<journeyRouteSeconds(s,best)?route:best);
   s=inputTime(s,1.2);s=reducer(s,{type:'ROUTE',route:fastest});s=inputTime(s,1.2);s=reducer(s,{type:'DIRECTION',correct:true});
   for(let i=0;i<12000&&s.phase!=='result';i++){
    if(s.event){
     s=inputTime(s,1.2);if(s.phase==='result')break;
     if(s.event!.id==='identity-search'){
      // Preparation visibly placed the ID in the front pocket; pay the actual hold.
      expect(s.student!.checkedID).toBe(true);s=inputTime(s,.18+.65/focusWindow(s.student!.stats.focus));
      s=reducer(s,{type:'POCKET_PICK',pocket:0});continue;
     }
     if(s.event!.id==='security-queue'&&!s.student!.observed&&s.student!.stats.focus<75){
      s=inputTime(s,2.5/focusWindow(s.student!.stats.focus));s=reducer(s,{type:'OBSERVE'});
     }
     const e=s.event!;let index=0;
     if(e.choices.some(c=>c.id==='leave')&&e.id.startsWith('student-'))index=e.choices.findIndex(c=>c.id==='leave');
     if(e.id==='security-queue')index=e.choices.findIndex(c=>/轻装|推进快|推进很快/.test(c.detail));
     if(e.id==='gates')index=e.choices.findIndex(c=>c.seconds===Math.min(...e.choices.map(o=>o.seconds)));
     if(e.id==='vertical-choice')index=e.choices.findIndex(c=>c.label.includes('楼梯'));
     if(index<0)index=0;
     const operation=e.interaction?.kind==='hold'?eventHoldSeconds(s,e):e.interaction?.kind==='tap'?(e.interaction.required??5)*.18:e.interaction?.kind==='swipe'?.55:.18;
     s=inputTime(s,operation);
     s=reducer(s,{type:'CHOICE',choice:e.choices[index]});
    }else if(s.phase==='arrival'){
     s=inputTime(s,.6);s=reducer(s,{type:s.metroStopIndex===s.route!.stops.length-1||!s.metroTransferred&&s.route!.stops[s.metroStopIndex]===s.route!.via?'ALIGHT':'CONTINUE_METRO'});
    }else if(s.phase==='station'){
     if(!s.stationRunning)s=reducer(s,{type:'RUN_INPUT',held:true});
     const wave=runnerWave(s);if(wave&&wave.lane===s.student!.runner.lane)s=reducer(s,{type:'CHANGE_LANE',direction:wave.lane===2?-1:1});
     const u=s.student!;if(u.sprintStrain>=4)recovering=true;else if(u.sprintStrain<=1)recovering=false;
     const sprint=!recovering&&(u.sprinting?u.stamina>u.stats.energy*.3:u.stamina>=u.stats.energy*.7);
     if(sprint!==u.sprinting)s=reducer(s,{type:'SPRINT_INPUT',held:sprint});
     s=tick(s,.1);
    }else{s=reducer(s,{type:'PREPARE_DOOR'});s=tick(s,.1);}
   }
   expect(s.phase,`seed ${seed} must finish without getting stuck`).toBe('result');
   expect(s.success,`seed ${seed}, remaining ${s.remaining}, beat ${s.stationBeat}, ${JSON.stringify(s.student!.clockSpent)}, logs ${JSON.stringify(s.logs)}`).toBe(true);
   expect(s.initial).toBe(initial);expect(s.route!.id).toBe(fastest.id);
   expect(s.student!.sprintSeconds).toBeGreaterThan(0);expect(s.student!.breathStops).toBe(0);expect(s.student!.wrongTurns).toBe(0);
   const u=s.student!,accounted=Object.values(u.clockSpent).reduce((a,b)=>a+b,0)+u.decisionLoss+u.environmentLoss;
   expect(accounted,`seed ${seed} accounting`).toBeCloseTo(s.initial-s.remaining,5);
   expect(s.gateRemaining).toBeGreaterThan(0);
 });
 it('deadlines still fail and replay clears obstacle stats',()=>{
  let s={...init(),remaining:STOP_BEFORE+.5};s=tick(s,1);expect(s.phase).toBe('result');expect(s.success).toBe(false);
  const fresh=reducer(s,{type:'NEW',run:createShanghaiRun()});expect(fresh.student!.runner.collisions).toBe(0);expect(fresh.student!.clockSpent.moving).toBe(0);
 });
});
