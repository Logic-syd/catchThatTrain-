import {describe,expect,it} from 'vitest';
import {createCharacterStationRun,reducer,type Run} from './engine';
import {buildStationJourney,journeyPrompt} from './stationJourney';
import {STUDENT_DISTRACTIONS} from './characterChallenges';
import {roadsidePrompt,updateRoadsideNotices} from './hongqiao';
import {stationForecast} from './timeModel';
import {STUDENT} from './studentConfig';
import type {Choice} from './data';

function road(id:string,city='shanghai'):Run{
 const base=createCharacterStationRun(city,'student',false,()=>.5);
 const stationJourney=buildStationJourney(base),stationBeat=stationJourney.findIndex(b=>b.id===id);
 expect(stationBeat).toBeGreaterThanOrEqual(0);
 return updateRoadsideNotices({...base,phase:'station',event:null,stationJourney,stationBeat,stationProgress:.25,stage:stationJourney[stationBeat].stage,
  student:{...base.student!,breakfast:true,runner:{...base.student!.runner,wave:99}}});
}
function start(s:Run){return reducer(s,{type:'RUN_INPUT',held:true});}
function stop(s:Run){return reducer(s,{type:'ROADSIDE_STOP',id:s.roadsideNotice?.id??s.stationJourney[s.stationBeat].id,revision:s.roadsideNotice?.revision??s.stationBeat});}
function choose(s:Run,id:string){
 const choice=s.event!.choices.find(c=>c.id===id)!;expect(choice).toBeDefined();
 return reducer(s,{type:'CHOICE',choice,eventRevision:s.event!.revision});
}
function dispatchChoice(s:Run,choice:Choice,eventRevision?:number){return reducer(s,{type:'CHOICE',choice,eventRevision});}
function arrive(s:Run){return reducer({...start(s),stationProgress:.999},{type:'TICK',dt:.1});}

describe('Hongqiao student roadside activities preserve the playable road',()=>{
 it.each(STUDENT_DISTRACTIONS)('$id can be passed without a forced card, story award or activity charge',activity=>{
  const s=start({...road(activity.id),stationProgress:.999});
  expect(roadsidePrompt(s)?.id).toBe(activity.id);
  const n=reducer(s,{type:'TICK',dt:.1});
  expect(n.event).toBeNull();expect(n.stationBeat).toBe(s.stationBeat+1);
  expect(n.stationRunning).toBe(true);expect(n.seen).toContain(activity.id);
  expect(n.student!.happiness).toBe(0);expect(n.student!.morality).toBe(0);
  expect(n.student!.distractions).toBe(0);expect(n.student!.distractionSeconds).toBe(0);
  expect(s.remaining-n.remaining).toBeCloseTo(.4,8);
  expect(n.logs.filter(l=>l.eventId===activity.id)).toEqual([]);
  expect(roadsidePrompt(n)?.id).toBe(activity.id);
 });

 it('only the currently visible hotspot can be opened, and a duplicate stop cannot restart the hold',()=>{
  const s=start(road('student-cat'));
  expect(reducer(s,{type:'ROADSIDE_STOP',id:'student-tea-shop',revision:s.stationBeat})).toBe(s);
  const stopped=stop(s);
  expect(stopped.event!.id).toBe('student-cat');expect(stopped.roadsideActive).toBe('student-cat');
  expect(stopped.event!.interaction).toMatchObject({kind:'hold',required:1});
  expect(stopped.stationRunning).toBe(false);expect(stopped.student!.sprinting).toBe(false);
  expect(stopped.remaining).toBe(s.remaining);expect(stopped.stationProgress).toBe(s.stationProgress);
  const reading=reducer(stopped,{type:'TICK',dt:.4});
  expect(stop(reading)).toBe(reading);expect(reading.eventElapsed).toBeCloseTo(.4,8);
  const blocked={...s,student:{...s.student!,runner:{...s.student!.runner,blocked:true}}};
  expect(roadsidePrompt(blocked)).toBeUndefined();expect(stop(blocked)).toBe(blocked);
 });

 it('leaving an opened activity keeps the unfinished road and marks the hotspot consumed',()=>{
  const s=stop(start(road('student-cat'))),after=choose(s,'leave');
  expect(after.stationBeat).toBe(s.stationBeat);expect(after.stationProgress).toBe(.25);
  expect(after.remaining).toBe(s.remaining);expect(after.event).toBeNull();
  expect(after.student!.happiness).toBe(0);expect(after.student!.distractions).toBe(0);
  expect(after.stationRunning).toBe(true);expect(after.roadsideActive).toBeUndefined();
  expect(roadsidePrompt(after)).toBeUndefined();expect(stop(after)).toBe(after);
  const walked=reducer(after,{type:'TICK',dt:.1});
  expect(walked.stationBeat).toBe(after.stationBeat);expect(walked.stationProgress).toBeGreaterThan(after.stationProgress);
 });

 it('fixed activity cost and actual holding time are each charged once, without granting road progress',()=>{
  const base=road('student-cat'),s=stop(start({...base,student:{...base.student!,stamina:10,happiness:95}}));
  const originalChoice=s.event!.choices.find(c=>c.id==='indulge')!;
  const holding=reducer(s,{type:'TICK',dt:1});
  expect(holding.stationProgress).toBe(s.stationProgress);
  const n=dispatchChoice(holding,{...originalChoice,seconds:9999},holding.event!.revision);
  expect(s.remaining-n.remaining).toBeCloseTo(31,8);
  expect(n.student!.stationElapsedGame!-s.student!.stationElapsedGame!).toBeCloseTo(31,8);
  expect(n.student!.eventTime['student-cat']).toBeCloseTo(1,8);
  expect(n.student!.happiness).toBe(100);expect(n.student!.distractions).toBe(1);
  expect(n.student!.distractionSeconds).toBe(30);expect(n.student!.stats).toEqual(s.student!.stats);
  expect(n.student!.stamina).toBe(n.student!.stats.energy);
  expect(n.stationBeat).toBe(s.stationBeat);expect(n.stationProgress).toBe(s.stationProgress);
  expect(n.logs.at(-1)!.seconds).toBe(30);
  expect(dispatchChoice(n,originalChoice,s.event!.revision)).toBe(n);
  expect(stop(n)).toBe(n);
  const advanced=reducer({...n,stationProgress:.999},{type:'TICK',dt:.1});
  expect(advanced.stationBeat).toBe(n.stationBeat+1);expect(advanced.student!.distractions).toBe(1);
  expect(advanced.logs).toHaveLength(n.logs.length);
 });

 it('helping grandma records extra walking without a second waiting recovery or story-based speed benefit',()=>{
  const base=road('student-help-grandma'),s=stop(start({...base,student:{...base.student!,stamina:20}}));
  const holding=reducer(s,{type:'TICK',dt:1}),n=choose(holding,'indulge');
  expect(holding.student!.stamina).toBeGreaterThan(s.student!.stamina);
  expect(n.student!.stamina).toBe(holding.student!.stamina);
  expect(s.remaining-n.remaining).toBeCloseTo(36,8);
  expect(n.student!.stationElapsedGame!-s.student!.stationElapsedGame!).toBeCloseTo(36,8);
  expect(n.student!.morality).toBe(20);expect(n.student!.happiness).toBe(0);
  expect(n.student!.stats).toEqual(s.student!.stats);
  expect(n.stationProgress).toBe(s.stationProgress);
  expect(n.student!.movingSeconds).toBe(s.student!.movingSeconds);
 });

 it('a callback from an earlier activity cannot buy the next activity with the shared indulge option ID',()=>{
  const first=stop(start(road('student-cat'))),oldChoice=first.event!.choices[0],oldRevision=first.event!.revision;
  const completed=choose(first,'leave'),stationBeat=completed.stationJourney.findIndex(b=>b.id==='student-spectacle');
  const later=stop(updateRoadsideNotices({...completed,stationBeat,stationProgress:.2}));
  expect(later.event!.id).toBe('student-spectacle');
  expect(dispatchChoice(later,oldChoice,oldRevision)).toBe(later);
 });

 it('a delayed tick matches small ticks across an optional hotspot and the following required task',()=>{
  const base=road('student-cat'),s=start({...base,stationProgress:.99,student:{...base.student!,stamina:25}});
  const large=reducer(s,{type:'TICK',dt:5});
  let small=s;for(let i=0;i<50;i++)small=reducer(small,{type:'TICK',dt:.1});
  expect(large.stationBeat).toBe(small.stationBeat);expect(large.stationBeat).toBeGreaterThan(s.stationBeat);
  expect(large.stationProgress).toBeCloseTo(small.stationProgress,8);
  expect(large.remaining).toBeCloseTo(small.remaining,8);
  expect(large.student!.stamina).toBeCloseTo(small.student!.stamina,8);
  expect(large.student!.stationElapsedGame).toBeCloseTo(small.student!.stationElapsedGame!,8);
  expect(large.student!.clockSpent).toEqual(small.student!.clockSpent);
  expect(large.event?.id).toBe(small.event?.id);expect(large.logs).toEqual(small.logs);
  expect(large.student!.distractions).toBe(0);
 });
});

describe('Hongqiao ordinary walking resumes only with the player’s existing intent',()=>{
 it('completing a required task restores walking and requires a fresh sprint input',()=>{
  const base={...road('vertical-choice'),stationProgress:.999},s=reducer(reducer(base,{type:'SPRINT_INPUT',held:true}),{type:'TICK',dt:.1});
  expect(s.event!.id).toBe('vertical-choice');expect(s.stationAutoRun).toBe(true);
  expect(s.student!.sprinting).toBe(false);expect(s.stationRunning).toBe(false);
  const n=dispatchChoice(s,s.event!.choices[0],s.event!.revision);
  expect(n.stationRunning).toBe(true);expect(n.student!.sprinting).toBe(false);
  expect(n.stationBeat).toBe(s.stationBeat+1);
  const walked=reducer(n,{type:'TICK',dt:.1});
  expect(walked.stationProgress).toBeGreaterThan(0);expect(walked.student!.sprintSeconds).toBe(n.student!.sprintSeconds);
 });

 it('recovering from over-sprinting resumes ordinary movement on the same road, unless paused',()=>{
  const base=road('vertical-choice'),started=reducer({...base,student:{...base.student!,sprintStrain:STUDENT.breathLimit-.01}},{type:'SPRINT_INPUT',held:true});
  const s=reducer(started,{type:'TICK',dt:.1});expect(s.event!.id).toBe('student-breath');
  const n=dispatchChoice(s,s.event!.choices[0]);
  expect(n.stationBeat).toBe(s.stationBeat);expect(n.stationProgress).toBe(s.stationProgress);
  expect(n.stationRunning).toBe(true);expect(n.student!.sprinting).toBe(false);
  expect(s.remaining-n.remaining).toBe(STUDENT.breathPenalty);
  expect(dispatchChoice(n,s.event!.choices[0])).toBe(n);
  const paused=reducer(s,{type:'RUN_INPUT',held:false}),stopped=dispatchChoice(paused,paused.event!.choices[0]);
  expect(stopped.stationRunning).toBe(false);
 });

 it.each(['student-cat','vertical-choice'])('%s respects a manual pause or focus-loss reset during the activity',id=>{
  const active=id==='student-cat'?stop(start(road(id))):arrive(road(id));
  const paused=reducer(active,{type:'RUN_INPUT',held:false});
  expect(paused.stationAutoRun).toBe(false);
  const n=dispatchChoice(paused,paused.event!.choices[0],paused.event!.revision);
  expect(n.stationRunning).toBe(false);expect(n.student!.sprinting).toBe(false);
  const waiting=reducer(n,{type:'TICK',dt:.1});expect(waiting.stationProgress).toBe(n.stationProgress);
  expect(n.remaining-waiting.remaining).toBeCloseTo(.1,8);
 });

 it('opening a hotspot while already standing still does not initiate movement on completion',()=>{
  const s=stop(road('student-cat')),n=choose(s,'leave');
  expect(n.stationRunning).toBe(false);expect(n.stationProgress).toBe(s.stationProgress);
 });

 it('other student stations now share optional notices and automatic ordinary walking',()=>{
  const base=road('student-cat','beijing');expect(roadsidePrompt(base)?.id).toBe('student-cat');
  const stopped=stop(start(base)),n=choose(stopped,'leave');
  expect(n.stationBeat).toBe(base.stationBeat);expect(n.stationProgress).toBe(base.stationProgress);
  expect(n.stationRunning).toBe(true);expect(roadsidePrompt(n)).toBeUndefined();
  const passed=arrive(n);expect(passed.event).toBeNull();expect(passed.stationRunning).toBe(true);
 });

 it.each(['worker','tourist','mom'] as const)('Hongqiao %s still stops after completing a mandatory task',character=>{
  const base=createCharacterStationRun('shanghai',character,false,()=>.5),stationJourney=buildStationJourney(base);
  const stationBeat=stationJourney.findIndex(b=>b.id==='gate-scan');
  const s:Run={...base,phase:'station',stationJourney,stationBeat,stationProgress:1,stationRunning:false,stationAutoRun:true};
  s.event=journeyPrompt(s);
  const n=dispatchChoice(s,s.event.choices[0],s.event.revision);
  expect(n.gatePassed).toBe(true);expect(n.stationRunning).toBe(false);
  expect(reducer(n,{type:'ROADSIDE_STOP',id:'student-cat',revision:0})).toBe(n);
 });
});

describe('Hongqiao prediction includes the current form of player interaction',()=>{
 it('passing a temptation predicts road travel without a forced reading task; voluntarily stopping adds its real hold',()=>{
  const base=road('student-cat'),beat=base.stationJourney[base.stationBeat],s={...base,stationJourney:[beat],stationBeat:0};
  const passing=stationForecast(s);expect(passing.walking).toBeGreaterThan(0);expect(passing.operations).toBe(0);
  const stopped=stop(s),opened=stationForecast(stopped);
  expect(opened.walking).toBe(passing.walking);expect(opened.operations).toBe(1);
  const holding=reducer(stopped,{type:'TICK',dt:.4}),during=stationForecast(holding);
  expect(during.walking).toBe(passing.walking);expect(during.operations).toBeCloseTo(.6,8);
  const left=choose(holding,'leave');expect(stationForecast(left).operations).toBe(0);
 });

 it('an entrance includes travel across its local scene and consumes the same elapsed handling clock as actual play',()=>{
  const base=road('vertical-choice'),beat=base.stationJourney[base.stationBeat];
  const s:Run={...base,stationJourney:[beat],stationBeat:0,stationProgress:1};s.event=journeyPrompt(s);
  const before=stationForecast(s);expect(before.walking).toBe(0);expect(before.operations).toBeGreaterThan(2);
  const reading=reducer(s,{type:'TICK',dt:2}),after=stationForecast(reading);
  expect(s.remaining-reading.remaining).toBeCloseTo(2,8);
  expect(after.walking).toBe(0);expect(before.operations-after.operations).toBeCloseTo(2,8);
  expect(reading.stationProgress).toBe(1);expect(reading.stationBeat).toBe(0);
  expect(reading.event!.id).toBe('vertical-choice');
 });
});
