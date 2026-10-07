import {runnerWave} from './runner';
import {describe,it,expect} from 'vitest';
import {createShanghaiRun,reducer,STOP_BEFORE,journeyRouteSeconds,type Run} from './engine';
import {STUDENT,HONGQIAO,movementFactor,studentPrompt} from './studentConfig';
import {buildStationJourney} from './stationJourney';
function prepared(options=['skip','check','eat'],seed=.9){let s=reducer(createShanghaiRun(false,()=>seed),{type:'START'});for(const option of options)s=reducer(s,{type:'PREP_PICK',option,step:s.student!.prep});return s;}
function station(options?:string[]):Run{const s=prepared(options);return {...s,phase:'station',student:{...s.student!,stationStart:900},remaining:900,stationJourney:buildStationJourney(s)};}
function tick(s:Run,seconds:number){for(let i=0;i<Math.ceil(seconds*10);i++)s=reducer(s,{type:'TICK',dt:.1});return s;}
function select(s:Run,i=0){return reducer(s,{type:'CHOICE',choice:s.event!.choices[i]});}
function at(id:string,options?:string[]){let s=station(options);s.stationBeat=s.stationJourney.findIndex(b=>b.id===id);s.stationProgress=.999;s.student={...s.student!,runner:{...s.student!.runner,wave:99}};s=reducer(s,{type:'RUN_INPUT',held:true});return tick(s,.1);}
describe('Hongqiao student chapter',()=>{
 it('starts with 35:30 and three explicit choices, replay has fresh stats',()=>{
  const s=createShanghaiRun();expect(s.remaining-STOP_BEFORE).toBe(2130);expect(s.student!.stats).toEqual(STUDENT.baseStats);
  const n=prepared(['buy','check','eat']);expect(n.phase).toBe('route');expect(n.remaining).toBe(s.remaining-210);expect(n.student!.stats).toEqual({agility:85,energy:100,focus:65,load:15});
  expect(reducer(n,{type:'PREP_PICK',option:'eat',step:2})).toBe(n);expect(createShanghaiRun().student!.choices).toEqual({});
 });
 it('route choices fit the opening budget and preparation affects walking efficiency',()=>{
  const s=prepared();for(const r of s.city.spawnStations[0].routes)expect(journeyRouteSeconds(s,r)).toBeLessThan(s.remaining-STOP_BEFORE);
  const fast=prepared(['buy','skip','skip']);expect(journeyRouteSeconds(fast,fast.city.spawnStations[0].routes[0])).toBeLessThan(journeyRouteSeconds(s,s.city.spawnStations[0].routes[0]));
 });
 it('sprinting moves faster, exhausts, cannot be spammed, then recovers',()=>{
  const start=station();start.stationJourney=[{id:'gates',stage:4,label:'long',seconds:100}];
  const walk=tick(reducer(start,{type:'RUN_INPUT',held:true}),4);const sprint=tick(reducer(start,{type:'SPRINT_INPUT',held:true}),4);
  expect(sprint.stationProgress).toBeGreaterThan(walk.stationProgress*1.8);expect(sprint.student!.stamina).toBeLessThan(walk.student!.stamina);
  let drained=tick(reducer({...start,student:{...start.student!,stamina:1}},{type:'SPRINT_INPUT',held:true}),.3);expect(drained.student!.exhausted).toBe(true);
  drained=reducer(drained,{type:'SPRINT_INPUT',held:true});expect(drained.student!.sprinting).toBe(false);expect(tick(reducer(drained,{type:'RUN_INPUT',held:false}),6).student!.exhausted).toBe(false);
 });
 it('late buff uses check-in cutoff, hunger applies exactly once',()=>{
  let s=station(['skip','skip','skip']);s={...s,stage:3,remaining:STOP_BEFORE+110};s=tick(s,.1);expect(s.student!.late).toBe(true);expect(tick({...s,gatePassed:true,remaining:250},.1).student!.late).toBe(true);expect(s.student!.stats.energy).toBe(80);expect(tick(s,1).student!.stats.energy).toBe(80);
  expect(movementFactor({...s.student!,sprinting:true})).toBeGreaterThan(movementFactor({...s.student!,sprinting:true,late:false}));
 });
 it('checked ID is in front pocket; wrong pockets stay searched, no auto completion',()=>{
  let s=at('identity-search');expect(s.student!.pocket).toBe(0);s=reducer(s,{type:'POCKET_PICK',pocket:2});expect(s.student!.bagMistakes).toBe(1);
  expect(reducer(s,{type:'POCKET_PICK',pocket:2})).toBe(s);s=tick(s,15);expect(s.identityReady).toBe(false);expect(s.event!.id).toBe('identity-search');
  s=reducer(s,{type:'POCKET_PICK',pocket:0});expect(s.identityReady).toBe(true);expect(s.event).toBeNull();expect(s.student!.bagSeconds).toBeGreaterThan(14);
 });
 it('milk tea trades time for energy and slows two-handed tasks until put away',()=>{
  const s=station(['buy','skip','skip']);expect(s.student!.tea).toBe(true);expect(s.student!.stats.energy).toBe(100);
  const stairs=studentPrompt('escalator-ride',{...s.student!,vertical:'stairs'})!;expect(stairs.interaction!.required).toBe(10);
  const n=reducer(s,{type:'DROP_TEA'});expect(studentPrompt('escalator-ride',{...n.student!,vertical:'stairs'})!.interaction!.required).toBe(8);expect(n.student!.stats.energy).toBe(100);
 });
 it('unprepared searches have varied locations, replays reset them',()=>{
  const positions=new Set(Array.from({length:30},()=>createShanghaiRun().student!.pocket));expect(positions.size).toBe(4);
  expect(prepared(['skip','skip','skip']).student!.checkedID).toBe(false);
 });
 it('observing security shows useful hidden hints and does not advance the beat',()=>{
  const s=at('security-queue'),observed=reducer(s,{type:'OBSERVE'});expect(observed.stationBeat).toBe(s.stationBeat);expect(observed.event!.choices.map(c=>c.detail)).not.toEqual(s.event!.choices.map(c=>c.detail));
  const short=observed.student!.queues.findIndex(q=>q.people===3),fast=observed.student!.queues.findIndex(q=>q.seconds===24);expect(observed.event!.choices[short].seconds).toBeGreaterThan(observed.event!.choices[fast].seconds);
 });
 it('stairs skip escalator selection, cost stamina and require an operation',()=>{
  let s=at('vertical-choice');s=select(s,1);expect(s.stationJourney[s.stationBeat].id).toBe('escalator-ride');s.stationProgress=.999;s.student={...s.student!,runner:{...s.student!.runner,wave:99}};s=tick(reducer(s,{type:'RUN_INPUT',held:true}),.1);expect(s.event!.interaction!.kind).toBe('tap');
  const energy=s.student!.stamina;s=select(s);expect(s.student!.stamina).toBe(energy-22);
 });
 it('unavoidable waiting cannot exceed bad luck budget and timeout adds no flat charge',()=>{
  let s=at('escalator-ride');s={...s,event:{id:'escalator-operation',title:'wait',description:'',phase:'station',choices:[{label:'wait',detail:'',seconds:30}]},student:{...s.student!,environmentLoss:175}};
  const time=s.remaining;const n=select(s);expect(n.remaining).toBe(time-5);expect(n.student!.environmentLoss).toBe(180);
  const late=tick(s,14);expect(late.remaining).toBeCloseTo(time-14);expect(late.event).not.toBeNull();
 });
 it('door preparation saves time only for the next stop',()=>{
  let s=prepared();const route=s.city.spawnStations[0].routes[0];s={...s,phase:'metro',route,metroStopIndex:0};s=reducer(s,{type:'PREPARE_DOOR'});expect(s.student!.doorReady).toBe(true);
  const departed=reducer({...s,phase:'arrival',metroStopIndex:1},{type:'CONTINUE_METRO'});expect(departed.student!.doorReady).toBe(false);
  const arrival={...s,phase:'arrival' as const,metroStopIndex:route.stops.length-1};expect(reducer(arrival,{type:'ALIGHT'}).remaining).toBe(s.remaining);
  expect(reducer({...arrival,student:{...s.student!,doorReady:false}},{type:'ALIGHT'}).remaining).toBe(s.remaining-12);
 });
 it('map knowledge clarifies station direction; wrong turn is player cost',()=>{
  let s=at('station-sign');expect(studentPrompt('station-sign',{...s.student!,mapRead:true})!.description).toContain('左侧');s=select(s,1);expect(s.student!.wrongTurns).toBe(1);expect(s.student!.decisionLoss).toBeGreaterThanOrEqual(55);
 });
 it('all selected routes can complete with skilled play; transfer never auto advances',()=>{
  for(let routeIndex=0;routeIndex<3;routeIndex++){
   let s=prepared(['skip','check','skip'],.9);s=reducer(s,{type:'ROUTE',route:s.city.spawnStations[0].routes[routeIndex]});s=reducer(s,{type:'DIRECTION',correct:true});
   for(let i=0;i<10000&&s.phase!=='station';i++){
    if(s.phase==='arrival')s=reducer(s,{type:s.metroStopIndex===s.route!.stops.length-1||s.route!.stops[s.metroStopIndex]===s.route!.via?'ALIGHT':'CONTINUE_METRO'});
    else if(s.event){expect(s.event.id).toBe('transfer-run');const held=tick(s,2);expect(held.phase).toBe('transfer');s=select(held);}
    else {s=reducer(s,{type:'PREPARE_DOOR'});s=tick(s,.1);}
   }
   expect(s.phase).toBe('station');
   for(let i=0;i<5000&&s.phase!=='result';i++){
    if(s.event){s=tick(s,.8);if(s.event!.id==='identity-search')s=reducer(s,{type:'POCKET_PICK',pocket:s.student!.pocket});else {let index=s.event!.id==='vertical-choice'?1:s.event!.id==='gates'?3:0;if(s.event!.id==='security-queue')index=s.event!.choices.findIndex(c=>c.seconds===24);s=select(s,index);}}
    else{const w=runnerWave(s);if(w&&s.student!.runner.lane===w.lane)s=reducer(s,{type:'CHANGE_LANE',direction:w.lane===2?-1:1});s=reducer(s,{type:s.student!.exhausted?'RUN_INPUT':'SPRINT_INPUT',held:true});s=tick(s,.1);}
   }
   expect(s.success,`route ${routeIndex} remaining ${s.remaining}`).toBe(true);expect(s.seen).toContain('gate-scan');
  }
 });
});
