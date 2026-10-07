import {describe,it,expect} from 'vitest';
import {createShanghaiRun,reducer,STOP_BEFORE,type Run} from './engine';
import {buildStationJourney} from './stationJourney';
import {runnerWave} from './runner';
function init():Run{let s=createShanghaiRun();return {...s,phase:'station' as const,remaining:1500,stationJourney:buildStationJourney(s)};}
function tick(s:Run,t:number){for(let i=0;i<Math.round(t*10);i++)s=reducer(s,{type:'TICK',dt:.1});return s;}
function rng(seed:number){return ()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
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
describe('fair normal-mode budget and transparent accounting',()=>{
 it('correct novice play without sprinting succeeds across all routes and 60 random journeys',()=>{
  let smallest=Infinity;
  for(let seed=1;seed<=60;seed++){
   let s=reducer(createShanghaiRun(false,rng(seed*7919)),{type:'START'});
   for(const option of ['skip','check','eat']){s=tick(s,6);s=reducer(s,{type:'PREP_PICK',option,step:s.student!.prep});}
   s=tick(s,6);s=reducer(s,{type:'ROUTE',route:s.city.spawnStations[0].routes[seed%3]});s=tick(s,5);s=reducer(s,{type:'DIRECTION',correct:true});
   for(let i=0;i<12000&&s.phase!=='result';i++){
    if(s.event){
     s=tick(s,7);if(s.phase==='result')break;
     if(s.event!.id==='identity-search'){s=reducer(s,{type:'POCKET_PICK',pocket:s.student!.pocket});continue;}
     const e=s.event!;let index=0;
     if(e.id==='security-queue')index=e.choices.findIndex(c=>c.seconds===55); // Shortest queue is slow: still a reasonable novice choice.
     if(e.id==='escalator-choice')index=s.stationLuck.escalators.indexOf('blocked');
     if(e.id==='gates')index=e.choices.findIndex(c=>c.seconds===Math.max(...e.choices.map(o=>o.seconds))); // Even the slowest gate remains survivable.
     s=reducer(s,{type:'CHOICE',choice:e.choices[index]});
    }else if(s.phase==='arrival'){
     s=tick(s,1);s=reducer(s,{type:s.metroStopIndex===s.route!.stops.length-1||s.route!.stops[s.metroStopIndex]===s.route!.via?'ALIGHT':'CONTINUE_METRO'});
    }else if(s.phase==='station'){
     if(!s.stationRunning){s=tick(s,2);s=reducer(s,{type:'RUN_INPUT',held:true});}
     const wave=runnerWave(s);if(wave&&wave.lane===s.student!.runner.lane)s=reducer(s,{type:'CHANGE_LANE',direction:wave.lane===2?-1:1});s=tick(s,.1);
    }else{s=reducer(s,{type:'PREPARE_DOOR'});s=tick(s,.1);}
   }
   expect(s.success,`seed ${seed}, remaining ${s.remaining}, beat ${s.stationBeat}, ${JSON.stringify(s.student!.clockSpent)}, logs ${JSON.stringify(s.logs)}`).toBe(true);
   expect(s.student!.sprintSeconds).toBe(0);expect(s.student!.wrongTurns).toBe(0);
   const u=s.student!,accounted=Object.values(u.clockSpent).reduce((a,b)=>a+b,0)+u.decisionLoss+u.environmentLoss;
   expect(accounted,`seed ${seed} accounting`).toBeCloseTo(s.initial-s.remaining,5);
   smallest=Math.min(smallest,s.gateRemaining);
  }
  expect(smallest).toBeGreaterThan(45);
  console.info('60 no-sprint novice runs: minimum check-in margin',Math.round(smallest),'game seconds');
 });
 it('deadlines still fail and replay clears obstacle stats',()=>{
  let s={...init(),remaining:STOP_BEFORE+.5};s=tick(s,1);expect(s.phase).toBe('result');expect(s.success).toBe(false);
  const fresh=reducer(s,{type:'NEW',run:createShanghaiRun()});expect(fresh.student!.runner.collisions).toBe(0);expect(fresh.student!.clockSpent.moving).toBe(0);
 });
});
