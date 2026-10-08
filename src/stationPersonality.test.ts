import {describe,expect,it} from 'vitest';
import {createCharacterStationRun,reducer,type Run} from './engine';
import {buildStationJourney,journeyPrompt} from './stationJourney';
import {runnerWave} from './runner';
import {STATIONS} from './stations';
import {createGameResult} from './gameResult';

function at(city:string,character:'student'|'worker'|'tourist',beat:string):Run{
 const initial=createCharacterStationRun(city,character,false,()=>.2);
 const run={...initial,phase:'station' as const,remaining:1600,stationJourney:buildStationJourney(initial)};
 const stationBeat=run.stationJourney.findIndex(b=>b.id===beat);
 expect(stationBeat).toBeGreaterThanOrEqual(0);
 return {...run,stationBeat,event:journeyPrompt({...run,stationBeat})};
}
function select(run:Run,label:string):Run{const option=run.event?.choices.find(c=>c.label===label);expect(option).toBeDefined();return reducer(run,{type:'CHOICE',choice:option!});}

describe('fixed station personalities and character tasks',()=>{
 it('all three characters receive each station map challenge and the same fixed local encounter',()=>{
  const fixed:Record<string,string>={shanghai:'sh-corridor',beijing:'bj-entry',guangzhou:'gz-route',hangzhou:'hz-fork',wuhan:'wh-floor',zhengzhou:'zz-hometown'};
  for(const station of STATIONS)for(const character of ['student','worker','tourist'] as const){
   const run=at(station.id,character,fixed[station.id]);
   expect(run.event?.choices.length,`${station.id}/${character}`).toBeGreaterThan(1);
   expect(station.personality.length).toBeGreaterThan(8);
  }
 });
 it('Zhengzhou wage conversation has the promised time, focus and stamina consequences',()=>{
  const full=at('zhengzhou','worker','zz-hometown');
  const start={...full,characterTime:{...full.characterTime!,energy:50}};
  const no=select(start,'不告诉他，继续找路');
  expect(no.remaining).toBe(start.remaining-30);
  const told=select(start,'告诉他');
  expect(told.event?.id).toBe('zz-hometown-answer');
  expect(told.stationBeat).toBe(start.stationBeat);
  const truth=select(told,'说真话');
  expect(truth.characterTime!.focus).toBe(start.characterTime!.focus-10);
  const low=select(told,'说工资 5000');
  expect(low.characterTime!.focus).toBe(start.characterTime!.focus-5);
  expect(low.characterTime!.energy).toBe(start.characterTime!.energy+5);
  const fullEnergy=select(select(full,'告诉他'),'说工资 5000');
  expect(fullEnergy.characterTime!.energy).toBe(full.characterTime!.energy+5);
  expect(fullEnergy.characterTime!.maxEnergy).toBe(full.characterTime!.maxEnergy+5);
 });
 it('unread boss messages interrupt twice unless the worker answers the first call',()=>{
  const base=createCharacterStationRun('hangzhou','worker',false,()=>.2);
  const initial={...base,characterTime:{...base.characterTime!,bossUnread:true,bossCallsLeft:2}};
  const beats=buildStationJourney(initial);
  expect(beats.filter(b=>b.id==='worker-boss-call')).toHaveLength(2);
  const first=beats.findIndex(b=>b.id==='worker-boss-call');
  const run:Run={...initial,phase:'station',stationJourney:beats,stationBeat:first,event:journeyPrompt({...initial,stationJourney:beats,stationBeat:first})};
  const answered=select(run,'接起来，说明正在回程');
  expect(answered.stationJourney.filter(b=>b.id==='worker-boss-call')).toHaveLength(1);
  expect(answered.characterTime!.bossCallsLeft).toBe(0);
 });
 it('replying costs 10 stamina while ignoring only sometimes schedules a call',()=>{
  const base=createCharacterStationRun('hangzhou','worker',false,()=>.2);
  const prep:Run={...base,phase:'preparation',characterTime:{...base.characterTime!,prepStep:2,energy:50},stamina:50};
  const reply=reducer(prep,{type:'PERSON_PICK',option:'reply',step:2});
  expect(reply.characterTime!.energy).toBe(40);
  expect(reply.stamina).toBe(40);
  expect(reply.remaining).toBe(prep.remaining);
  expect(reply.characterTime!.bossCallsLeft).toBe(0);
  const noCall=reducer({...prep,characterTime:{...prep.characterTime!,bossMayCall:false}},{type:'PERSON_PICK',option:'ignore',step:2});
  expect(noCall.characterTime!.ignoredWork).toBe(true);
  expect(noCall.characterTime!.bossCallsLeft).toBe(0);
  expect(buildStationJourney(noCall).filter(b=>b.id==='worker-boss-call')).toHaveLength(0);
  const withCall=reducer({...prep,characterTime:{...prep.characterTime!,bossMayCall:true}},{type:'PERSON_PICK',option:'ignore',step:2});
  expect(buildStationJourney(withCall).filter(b=>b.id==='worker-boss-call')).toHaveLength(2);
 });
 it('route decisions change later tasks for workers and tourists too',()=>{
  const outer=select(at('guangzhou','tourist','gz-route'),'看标识，走外围连桥');
  const center=select(at('guangzhou','tourist','gz-route'),'听热心人，挤中区近路');
  expect(outer.stationJourney.some(b=>b.id==='gz-lift')).toBe(false);
  expect(center.stationJourney.some(b=>b.id==='gz-lift')).toBe(true);
  const stairs=select(at('wuhan','worker','vertical-choice'),'走楼梯');
  expect(stairs.stationJourney.some(b=>b.id==='escalator-choice')).toBe(false);
  expect(stairs.characterTime!.energy).toBeLessThan(at('wuhan','worker','vertical-choice').characterTime!.energy);
 });
 it('worker and tourist wrong turns appear in the result data',()=>{
  const wrong=select(at('hangzhou','worker','hz-fork'),'跟着通勤人流左转');
  expect(createGameResult(wrong).wrongTurns).toBeGreaterThan(0);
 });
 it('worker and tourist can clear every station sequence',()=>{
  for(const station of STATIONS)for(const character of ['worker','tourist'] as const){
   const initial=createCharacterStationRun(station.id,character,false,()=>.2);
   let run:Run={...initial,phase:'station',remaining:2200,identityReady:true,stationJourney:buildStationJourney({...initial,identityReady:true})};
   for(let i=0;i<9000&&run.phase!=='result';i++){
    if(run.event){const options=run.event.choices;let option=options[0];
     if(run.event.id==='zz-number')option=options.find(c=>c.label===run.gate)!;
     if(run.event.id==='escalator-choice')option=options[0];
     run=reducer(run,{type:'CHOICE',choice:option});
    }else{
     const wave=runnerWave(run),lane=run.characterTime!.runner.lane;
     if(wave&&wave.lane===lane)run=reducer(run,{type:'CHANGE_LANE',direction:lane===2?-1:1});
     run=reducer(run,{type:'RUN_INPUT',held:true});
     run=reducer(run,{type:'TICK',dt:.1});
    }
   }
   expect(run.success,`${station.id}/${character}: ${run.event?.id??run.phase}, beat ${run.stationBeat}, remaining ${run.remaining}, seen ${run.seen.join(',')}`).toBe(true);
  }
 });
});
