import {describe,it,expect} from 'vitest';
import {createCharacterStationRun,STOP_BEFORE} from './engine';
import {buildStationJourney,journeyPrompt} from './stationJourney';
import {escalatorPrompt} from './stationEncounters';
import {simulateBalance} from '../scripts/simulateBalance';
import {REFERENCE_PLAYER,referenceChoice,referenceSprint,isReferenceEnvironment,referenceEnvironmentSeconds,type ReferenceMovement} from '../scripts/referencePlayer';

describe('normal-completion reference measurement',()=>{
 it.each(['student','worker','tourist','mom'] as const)('%s measures the whole route without changing production opening time or collecting penalties',character=>{
  const before=createCharacterStationRun('hangzhou',character,false,()=>.6);
  let moving:ReferenceMovement|undefined;
  const run=simulateBalance({city:'hangzhou',character,reference:true,seed:921,onReferenceMovement:stats=>moving=stats});
  expect(run.success).toBe(true);
  expect(run.initial).toBe(before.initial+REFERENCE_PLAYER.measurementAllowance);
  expect(run.timeBudget!.departureBudgetSeconds).toBe(before.initial);
  expect(createCharacterStationRun('hangzhou',character,false,()=>.6).initial).toBe(before.initial);
  const total=run.timeLedger.entries.reduce((t,e)=>t+e.seconds,0);
  expect(total).toBeCloseTo(run.initial-run.remaining,6);
  expect(run.timeLedger.entries.filter(e=>['operationPenalty','navigationPenalty','sprintPenalty','unclassified'].includes(e.category))).toEqual([]);
  expect(run.student?.late??false).toBe(false);
  expect(Math.abs(moving!.gateSprintSeconds/moving!.gateMovingSeconds-REFERENCE_PLAYER.sprintDuty[character])).toBeLessThan(.02);
  expect(moving!.sprintSeconds).toBeLessThan(moving!.movingSeconds*.2);
  expect(run.timeLedger.entries.some(e=>e.deadline==='departure')).toBe(true);
 });
 it('excludes the artificial measurement allowance from the real opening-margin comparison',()=>{
  const run=simulateBalance({city:'zhengzhou',character:'worker',reference:true,seed:921});
  const gateCost=run.timeLedger.entries.filter(e=>e.deadline==='gate').reduce((t,e)=>t+e.seconds,0);
  const currentOpening=run.timeBudget!.gateBudgetSeconds;
  expect(currentOpening-gateCost).toBeLessThan(0);
  expect(run.gateRemaining-REFERENCE_PLAYER.measurementAllowance).toBeCloseTo(currentOpening-gateCost,6);
  expect(run.initial-STOP_BEFORE-gateCost).toBeGreaterThan(0);
 });
 it('does not obtain a clear escalator from the hidden outcome, or choose by hidden option costs',()=>{
  let s=createCharacterStationRun('shanghai','mom',false,()=>.6);
  const e=escalatorPrompt();
  for(const states of [['clear','blocked','steady'],['blocked','steady','clear']] as const){
   s={...s,stationLuck:{...s.stationLuck,escalators:[...states]}};
   expect(referenceChoice(s,e).label).toBe('2 号扶梯');
  }
  s={...s,stationJourney:buildStationJourney(s)};
  s={...s,stationBeat:s.stationJourney.findIndex(b=>b.id==='sh-corridor')};
  const prompt=journeyPrompt(s);
  const changed={...prompt,choices:prompt.choices.map(c=>({...c,seconds:c.seconds+999,stationDecision:c.stationDecision?{...c.stationDecision,optimal:!c.stationDecision.optimal}:undefined})).reverse()};
  expect(referenceChoice(s,prompt).label).toBe(referenceChoice(s,changed).label);
 });
 it('budgets sustained safe pulses and refuses sprinting on low energy or with the child far behind',()=>{
  for(const role of ['student','worker','tourist','mom'] as const){
   let sprint=0;
   for(let t=0;t<1000;t++)if(referenceSprint(role,t/10,100,100,0))sprint++;
   expect(sprint/1000).toBeCloseTo(REFERENCE_PLAYER.sprintDuty[role],6);
   expect(referenceSprint(role,5,5,100,0)).toBe(false);
   expect(referenceSprint(role,5,100,100,5)).toBe(false);
  }
 });
 it('normal security and gate waiting stay out of environmental handling',()=>{
  for(const source of ['map-security','map-security:finished','gates:4 号','bj-parent-strict:分开放'])expect(isReferenceEnvironment(source)).toBe(false);
  for(const source of ['map-child','map-crowd','bag-snag:解开','security:交出剪刀','escalator-operation:跟着扶梯上楼'])expect(isReferenceEnvironment(source)).toBe(true);
 });
 it('counts obstacle instructions once as operations and only extra escalator waiting as environment',()=>{
  const entry={phase:'station' as const,deadline:'gate' as const,source:'map-child',category:'interaction' as const,seconds:4};
  expect(referenceEnvironmentSeconds(entry)).toBe(0);
  expect(referenceEnvironmentSeconds({...entry,category:'obstructionWait',seconds:2.2})).toBe(2.2);
  expect(referenceEnvironmentSeconds({...entry,source:'escalator-operation:等前面',category:'eventCost',seconds:30})).toBe(15);
  expect(referenceEnvironmentSeconds({...entry,source:'map-security',category:'securityQueue',seconds:24})).toBe(0);
 });
 it('replays the same reference seed deterministically and restores the global random function',()=>{
  const random=Math.random;
  const a=simulateBalance({city:'shanghai',character:'mom',reference:true,seed:1004});
  const b=simulateBalance({city:'shanghai',character:'mom',reference:true,seed:1004});
  expect(a.timeLedger).toEqual(b.timeLedger);expect(Math.random).toBe(random);
 });
 it('unknown multi-option events cannot silently fall back to the cheapest choice',()=>{
  const s=createCharacterStationRun();
  expect(()=>referenceChoice(s,{id:'new-unknown',phase:'station',title:'',description:'',choices:[{label:'one',detail:'',seconds:0},{label:'two',detail:'',seconds:5}]})).toThrow('visible-clue rule');
 });
});
