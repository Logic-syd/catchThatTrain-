const createShanghaiRun=(hard=false,rng=Math.random)=>createRun('shanghai','student',hard,true,rng);
// Legacy engine regression fixtures; student chapter has its own integration tests.
import {createRun} from './engine';
import {describe,it,expect} from 'vitest';
import {reducer,STOP_BEFORE,type Run} from './engine';
import {createStationLuck,ESCALATOR_X,escalatorPrompt,type EscalatorState} from './stationEncounters';
import {stationTarget} from './stationFlow';
import {findWalkPath,isBlocked} from './navigation';

function station():Run{return {...createShanghaiRun(),phase:'station',remaining:900};}
function elder(scam:boolean):Run{const s=station();return reducer({...s,stationLuck:{...s.stationLuck,elderScam:scam}},{type:'STATION_EVENT',id:'elder-block'});}
function lift(state:EscalatorState,lane=0):Run{
 const s=station();
 return reducer({...s,stage:1,escalatorLane:lane,stationLuck:{...s.stationLuck,escalators:[state,state,state]}},{type:'STATION_EVENT',id:'escalator-ride'});
}

describe('backpack student and exit events',()=>{
 it('uses the backpack identity throughout the run',()=>{expect(station().character.name).toBe('背包大学生');});
 it('releases a caught backpack only after action, even after reading slowly',()=>{
  const s=reducer(station(),{type:'STATION_EVENT',id:'bag-snag'});
  expect(s.event?.interaction?.kind).toBe('swipe');
  const success=reducer(s,{type:'CHOICE',choice:s.event!.choices[0]});expect(success.remaining).toBe(s.remaining-8);
  const timeout=reducer(s,{type:'TICK',dt:7});expect(timeout.event).toBe(s.event);expect(timeout.remaining).toBe(s.remaining-7);
  const done=reducer(timeout,{type:'CHOICE',choice:timeout.event!.choices[0]});
  expect(done.remaining).toBe(timeout.remaining-8);expect(reducer(done,{type:'STATION_EVENT',id:'bag-snag'}).event).toBeNull();
 });
 it('going around always costs ten seconds, regardless of the hidden risk',()=>{
  for(const scam of [false,true]){
   const s=elder(scam);const n=reducer(s,{type:'CHOICE',choice:s.event!.choices[0]});
   expect(n.remaining).toBe(s.remaining-10);expect(n.event).toBeNull();expect(n.detour).toMatchObject({x:235,y:1260});
   expect(n.seen).toContain('elder-block');
  }
 });
 it('a push reveals the sampled outcome without rerolling or deducting twice',()=>{
  for(const scam of [false,true]){
   const s=elder(scam);const action={type:'CHOICE' as const,choice:s.event!.choices[1]};
   const n=reducer(s,action);expect(n.remaining).toBe(s.remaining-(scam?60:2));
   expect(reducer(s,action)).toEqual(n);expect(n.event?.id).toBe('elder-outcome');
   const done=reducer(n,{type:'CHOICE',choice:n.event!.choices[0]});expect(done.remaining).toBe(n.remaining);expect(done.event).toBeNull();
   expect(reducer(done,{type:'STATION_EVENT',id:'elder-block'}).event).toBeNull();
  }
 });
 it('uses the same risk for grandma and grandpa and the 30% boundary',()=>{
  for(const person of [0,.9])for(const risk of [.299999,.3]){
   const rolls=[person,risk,.7,.4];const luck=createStationLuck(()=>rolls.shift()!);
   expect(luck.elder).toBe(person<.5?'grandma':'grandpa');expect(luck.elderScam).toBe(risk<.3);
  }
 });
 it('waits for the elder choice and still respects the final boarding deadline',()=>{
  const s=elder(true);const n=reducer(s,{type:'TICK',dt:8});expect(n.remaining).toBe(s.remaining-8);expect(n.detour).toBeNull();expect(n.event).toBe(s.event);
  const late=reducer({...s,remaining:STOP_BEFORE+50},{type:'CHOICE',choice:s.event!.choices[1]});expect(late.phase).toBe('result');expect(late.event).toBeNull();
 });
});

describe('three hidden escalator outcomes',()=>{
 it('puts one of each outcome in every run, in all six possible orders',()=>{
  const orders=new Set<string>();
  for(const a of [.1,.45,.9])for(const b of [.1,.9]){
   const rolls=[.5,.5,a,b];const luck=createStationLuck(()=>rolls.shift()!);
   expect(new Set(luck.escalators)).toEqual(new Set(['clear','steady','blocked']));orders.add(luck.escalators.join(','));
  }
  expect(orders.size).toBe(6);expect(escalatorPrompt().choices.every(c=>c.detail==='前方情况未知')).toBe(true);
 });
 it('visits the selected physical lane before revealing it and can exit every lane',()=>{
  for(let lane=0;lane<3;lane++){
   let s:Run={...station(),stage:1};expect(stationTarget(s).id).toBe('escalator-choice');
   s=reducer(s,{type:'STATION_EVENT',id:'escalator-choice'});s=reducer(s,{type:'CHOICE',choice:s.event!.choices[lane]});
   expect(s.event).toBeNull();expect(s.escalatorLane).toBe(lane);expect(stationTarget(s)).toMatchObject({id:'escalator-ride',x:ESCALATOR_X[lane]});
   const approach=findWalkPath({x:320,y:1188},stationTarget(s));expect(approach.length).toBeGreaterThan(0);expect(approach.every(p=>!isBlocked(p))).toBe(true);
   s=reducer(s,{type:'STATION_EVENT',id:'escalator-ride'});s=reducer(s,{type:'CHOICE',choice:s.event!.choices[0]});
   const exit=stationTarget(s);expect(exit).toMatchObject({detour:true,x:ESCALATOR_X[lane],y:952});
   const path=findWalkPath(approach.at(-1)!,exit);expect(path.length).toBeGreaterThan(0);expect(path.every(p=>!isBlocked(p))).toBe(true);
   s=reducer(s,{type:'DETOUR_DONE'});expect(stationTarget(s)).toMatchObject({next:2});
  }
 });
 it('clear lanes offer a temporary speed boost instead of adding countdown time',()=>{
  const s=lift('clear');const n=reducer(s,{type:'CHOICE',choice:s.event!.choices[0]});expect(n.remaining).toBe(s.remaining);expect(n.boost).toBe(4);
  expect(reducer(n,{type:'TICK',dt:1}).boost).toBe(3);expect(reducer(n,{type:'TICK',dt:5}).boost).toBe(0);
 });
 it('ordinary and blocked lanes have different delays and no speed boost',()=>{
  for(const [state,seconds] of [['steady',15],['blocked',30]] as const){
   const s=lift(state);const n=reducer(s,{type:'CHOICE',choice:s.event!.choices[0]});expect(n.remaining).toBe(s.remaining-seconds);expect(n.boost).toBe(0);
  }
 });
 it('reading never chooses an escalator or completes its ride for the player',()=>{
  const choice=reducer({...station(),stage:1},{type:'STATION_EVENT',id:'escalator-choice'});
  const selected=reducer(choice,{type:'TICK',dt:10});expect(selected.escalatorLane).toBeNull();expect(selected.event).toBe(choice.event);expect(selected.remaining).toBe(choice.remaining-10);
  for(const state of ['clear','steady','blocked'] as const){
   const s=lift(state,1);const timeout=reducer(s,{type:'TICK',dt:8});expect(timeout.event).toBe(s.event);expect(timeout.detour).toBeNull();expect(timeout.remaining).toBe(s.remaining-8);expect(timeout.boost).toBe(0);
  }
 });
 it('replay resets the chosen lane, speed boost and completed encounters',()=>{
  const n=reducer({...station(),escalatorLane:2,boost:4,seen:['escalator-choice','escalator-ride']},{type:'NEW',run:createShanghaiRun()});
  expect(n.escalatorLane).toBeNull();expect(n.boost).toBe(0);expect(n.seen).toEqual([]);
 });
});
