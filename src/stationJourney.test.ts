const createShanghaiRun=(hard=false,rng=Math.random)=>createRun('shanghai','student',hard,true,rng);
// Legacy engine regression fixtures; student chapter has its own integration tests.
import {createRun} from './engine';
import {describe,it,expect} from 'vitest';
import {reducer,STOP_BEFORE,type Run} from './engine';
import {buildStationJourney} from './stationJourney';
function start():Run{
 const r=createShanghaiRun(false,()=>.2);const route=r.city.spawnStations[0].routes[0];
 return reducer({...r,phase:'arrival',route,metroStopIndex:route.stops.length-1,metroProgress:1,remaining:900,identityReady:false},{type:'ALIGHT'});
}
function reach(s:Run):Run{
 s=reducer(s,{type:'RUN_INPUT',held:true});for(let i=0;i<80&&!s.event;i++)s=reducer(s,{type:'TICK',dt:.1});
 expect(s.event).not.toBeNull();return s;
}
function at(id:string):Run{const s=start();return reach({...s,stationBeat:s.stationJourney.findIndex(b=>b.id===id),escalatorLane:id==='escalator-ride'?0:null});}
function choose(s:Run,index=0){return reducer(s,{type:'CHOICE',choice:s.event!.choices[index]});}
describe('linear station journey blocks progression',()=>{
 it('does not move without input and stops on release',()=>{
  let s=start();expect(reducer(s,{type:'TICK',dt:2}).stationProgress).toBe(0);
  s=reducer(reducer(s,{type:'RUN_INPUT',held:true}),{type:'TICK',dt:.1});expect(s.stationProgress).toBeGreaterThan(0);
  s=reducer(s,{type:'RUN_INPUT',held:false});expect(reducer(s,{type:'TICK',dt:2}).stationProgress).toBe(s.stationProgress);
 });
 it('holding through a blocker cannot advance, even after the timer expires',()=>{
  let s=reach(start());const beat=s.stationBeat,id=s.event!.id;
  for(let i=0;i<10;i++)s=reducer(reducer(s,{type:'RUN_INPUT',held:true}),{type:'TICK',dt:1});
  expect(s.stationRunning).toBe(false);expect(s.stationBeat).toBe(beat);expect(s.stationProgress).toBe(1);expect(s.event!.id).toBe(id);expect(s.eventOverdue).toBe(true);
  const remaining=s.remaining;s=reducer(s,{type:'TICK',dt:1});expect(s.remaining).toBe(remaining-1);
  s=choose(s);expect(s.stationBeat).toBe(beat+1);expect(s.stationProgress).toBe(0);expect(s.stationRunning).toBe(false);
 });
 it('legacy map actions, penalties and arbitrary choices cannot skip a blocker',()=>{
  const s=reach(start());
  for(const a of [{type:'STAGE',stage:5,distance:0},{type:'GATE'},{type:'WIN'},{type:'STATION_EVENT',id:'gates'}] as const)expect(reducer(s,a)).toBe(s);
  const n=reducer(s,{type:'PENALTY',title:'bump',seconds:5});expect(n.stationBeat).toBe(s.stationBeat);expect(n.event).toBe(s.event);
  expect(reducer(s,{type:'CHOICE',choice:{label:'skip',detail:'',seconds:0}})).toBe(s);
 });
 it('going around requires a separate swipe before movement resumes',()=>{
  let s=at('elder-block'),beat=s.stationBeat;s=choose(s);expect(s.event?.id).toBe('elder-detour-action');expect(s.stationBeat).toBe(beat);
  const time=s.remaining;s=choose(s);expect(s.remaining).toBe(time-10);expect(s.stationBeat).toBe(beat+1);expect(s.seen).toContain('elder-block');
 });
 it('push outcome stays blocked until acknowledged and is charged once',()=>{
  let s=at('elder-block');const time=s.remaining,beat=s.stationBeat;s=choose(s,1);expect(s.remaining).toBe(time-60);expect(s.event?.id).toBe('elder-outcome');expect(s.stationBeat).toBe(beat);
  const charged=s.remaining;s=choose(s);expect(s.remaining).toBe(charged);expect(s.stationBeat).toBe(beat+1);
 });
 it('escalator choice leads to an operation, not an instantaneous pass',()=>{
  let s=at('escalator-choice');s=choose(s,2);expect(s.escalatorLane).toBe(2);expect(s.event).toBeNull();
  s=reach(s);expect(s.event?.id).toBe('escalator-ride');const beat=s.stationBeat;s=choose(s);expect(s.event?.interaction?.kind).toBe('tap');expect(s.stationBeat).toBe(beat);
  s=choose(s);expect(s.stationBeat).toBe(beat+1);
 });
 it('blocked escalator requires a hold and charges its delay on completion',()=>{
  let s=at('escalator-ride');s={...s,stationLuck:{...s.stationLuck,escalators:['blocked','steady','clear']},event:null,stationProgress:0};s=reach(s);s=choose(s);expect(s.event?.interaction?.kind).toBe('hold');expect(s.event?.interaction?.required).toBe(3);
  const time=s.remaining;s=choose(s);expect(s.remaining).toBe(time-30);
 });
 it('identity must still be found by the player after timeout',()=>{
  let s=at('identity-search');s=reducer(s,{type:'TICK',dt:9});expect(s.identityReady).toBe(false);expect(s.identityStage).toBe('wallet');
  s=reducer(s,{type:'ID_PICK',item:'wallet'});expect(s.eventOverdue).toBe(false);s=reducer(s,{type:'ID_PICK',item:'id'});expect(s.identityReady).toBe(true);expect(s.event).toBeNull();
 });
 it('only the scan opens the gate, then the final operation boards the train',()=>{
  let s=at('gates');s=choose(s);expect(s.gatePassed).toBe(false);s=reach(s);expect(s.event?.id).toBe('gate-scan');s=choose(s);expect(s.gatePassed).toBe(true);expect(s.gateRemaining).toBe(s.remaining-STOP_BEFORE);
  s=reach(s);expect(s.event?.id).toBe('board-train');s=choose(s);expect(s.success).toBe(true);expect(s.phase).toBe('result');
 });
 it('a full journey cannot skip required beats and replay clears progress',()=>{
  let s=start();for(let i=0;i<40&&s.phase!=='result';i++){
   if(!s.event)s=reach(s);
   if(s.event!.id==='identity-search'){s=reducer(s,{type:'ID_PICK',item:'wallet'});s=reducer(s,{type:'ID_PICK',item:'id'});}else s=choose(s);
  }
  expect(s.success).toBe(true);expect(s.seen).toContain('bag-snag');expect(s.seen).toContain('elder-block');expect(s.seen).toContain('gate-scan');
  const n=reducer(s,{type:'NEW',run:createShanghaiRun()});expect(n.stationJourney).toEqual([]);expect(n.stationRunning).toBe(false);
  expect(buildStationJourney({...start(),identityReady:true}).some(b=>b.id==='identity-search')).toBe(false);
 });
});
