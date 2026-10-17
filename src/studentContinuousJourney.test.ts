import {describe,expect,it} from 'vitest';
import {createCharacterStationRun,reducer,type Run} from './engine';
import {buildStationJourney} from './stationJourney';
import {roadsidePrompt,roadsideSecondsRemaining,ROADSIDE_SECONDS} from './hongqiao';
import {STUDENT_DISTRACTIONS} from './characterChallenges';
import {stationForecast} from './timeModel';

const cities=['shanghai','beijing','guangzhou','hangzhou','wuhan','zhengzhou'];
function fixture(city='shanghai',ids=['student-cat','gate-scan'],seconds=100):Run{
 const base=createCharacterStationRun(city,'student',false,()=>.5);
 const journey=buildStationJourney(base);
 const run:Run={...base,phase:'station',stationJourney:ids.map(id=>({...journey.find(b=>b.id===id)!,seconds})),stationBeat:0,stationProgress:0,student:{...base.student!,breakfast:true,runner:{...base.student!.runner,wave:99}}};
 return reducer(run,{type:'NEW',run});
}
function start(run:Run){return reducer(run,{type:'RUN_INPUT',held:true});}
function tick(run:Run,dt:number){return reducer(run,{type:'TICK',dt});}
function open(run:Run){const notice=run.roadsideNotice!;return reducer(run,{type:'ROADSIDE_STOP',id:notice.id,revision:notice.revision});}
function choose(run:Run,id?:string){return reducer(run,{type:'CHOICE',choice:id?run.event!.choices.find(c=>c.id===id)!:run.event!.choices[0],eventRevision:run.event!.revision});}
function noObstacles(run:Run){return {...run,student:{...run.student!,runner:{...run.student!.runner,wave:99}}};}

describe('student continuous walking in all six stations',()=>{
 it.each(cities)('%s resumes normal walking after a checkpoint without preserving sprint input',city=>{
  const raw=fixture(city,['gate-scan','board-train']);
  const sprint=reducer({...raw,stationProgress:.9999},{type:'SPRINT_INPUT',held:true});
  const stopped=tick(sprint,.1);
  expect(stopped.event?.id).toBe('gate-scan');expect(stopped.stationAutoRun).toBe(true);
  expect(stopped.stationRunning).toBe(false);expect(stopped.student!.sprinting).toBe(false);
  const resumed=choose(stopped);
  expect(resumed.stationRunning).toBe(true);expect(resumed.student!.sprinting).toBe(false);
  expect(resumed.stationBeat).toBe(1);expect(tick(resumed,.1).stationProgress).toBeGreaterThan(0);
  const paused=reducer(stopped,{type:'RUN_INPUT',held:false});
  const completed=choose(paused);
  expect(completed.stationRunning).toBe(false);expect(tick(completed,.1).stationProgress).toBe(0);
 });

 it.each(cities)('%s allows all four temptations to expire without a rejection click or fixed charge',city=>{
  for(const activity of STUDENT_DISTRACTIONS){
   const before=start(fixture(city,[activity.id,'gate-scan']));
   const almost=tick(before,4.9);
   expect(roadsidePrompt(almost)?.id).toBe(activity.id);
   expect(roadsideSecondsRemaining(almost)).toBeCloseTo(.1,8);
   const expired=tick(almost,.1);
   expect(expired.roadsideNotice).toBeUndefined();expect(expired.event).toBeNull();
   expect(expired.stationRunning).toBe(true);expect(expired.stationBeat).toBe(0);
   expect(expired.stationProgress).toBeGreaterThan(before.stationProgress);
   expect(before.remaining-expired.remaining).toBeCloseTo(5*4,8);
   expect(expired.student!.distractions).toBe(0);expect(expired.student!.happiness).toBe(0);expect(expired.student!.morality).toBe(0);
   expect(expired.logs.filter(l=>l.eventId===activity.id)).toEqual([expect.objectContaining({seconds:0})]);
   expect(tick(expired,5).logs).toEqual(expired.logs);
  }
 });
});

describe('roadside notices use the existing real-time clock',()=>{
 it('uses five real seconds while manually resting and does not start walking on expiry',()=>{
  const s=fixture();expect(roadsideSecondsRemaining(s)).toBe(ROADSIDE_SECONDS);
  const n=tick(s,5);
  expect(n.roadsideNotice).toBeUndefined();expect(n.stationRunning).toBe(false);expect(n.stationProgress).toBe(0);
  expect(s.remaining-n.remaining).toBeCloseTo(5,8);
 });

 it('keeps its original expiry across a road boundary without waiting for the notice',()=>{
  const base=fixture(),s=start({...base,stationProgress:.9999});
  const n=tick(s,.1);
  expect(n.stationBeat).toBe(1);expect(n.stationRunning).toBe(true);
  expect(n.roadsideNotice).toEqual(s.roadsideNotice);expect(roadsidePrompt(n)?.id).toBe('student-cat');
  const expired=tick(noObstacles(n),4.9);
  expect(expired.roadsideNotice).toBeUndefined();expect(expired.stationProgress).toBeGreaterThan(0);
  expect(s.remaining-expired.remaining).toBeCloseTo(20,8);
 });

 it('a mandatory event disables acceptance but does not extend the visible notice',()=>{
  const base=start(fixture()),crossed=tick({...base,stationProgress:.9999},.1);
  const stopped=tick({...crossed,stationProgress:.9999},.1);
  expect(stopped.event?.id).toBe('gate-scan');expect(stopped.roadsideNotice?.id).toBe('student-cat');
  expect(roadsidePrompt(stopped)).toBeUndefined();expect(open(stopped)).toBe(stopped);
  const expired=tick(stopped,4.8);
  expect(expired.roadsideNotice).toBeUndefined();expect(expired.event?.id).toBe('gate-scan');
  expect(expired.stationProgress).toBe(1);expect(expired.stationBeat).toBe(1);
  expect(expired.student!.distractions).toBe(0);
 });

 it('collision cannot be bypassed by expiry, automatic walking intent, or a stale notice click',()=>{
  const s=start(fixture()),blocked:Run={...s,student:{...s.student!,runner:{...s.student!.runner,blocked:true}}};
  expect(roadsidePrompt(blocked)).toBeUndefined();expect(open(blocked)).toBe(blocked);
  const n=tick(blocked,5);
  expect(n.roadsideNotice).toBeUndefined();expect(n.student!.runner.blocked).toBe(true);
  expect(n.stationBeat).toBe(blocked.stationBeat);expect(n.stationProgress).toBe(blocked.stationProgress);
  expect(blocked.remaining-n.remaining).toBeCloseTo(5,8);
 });

 it('queues closely spaced opportunities and starts each once the preceding notice ends',()=>{
  const raw=fixture('beijing',['student-cat','student-spectacle','gate-scan']);
  let s=start({...raw,stationProgress:.9999});
  s=tick(s,.1);s=tick({...s,stationProgress:.9999},.1);
  expect(s.stationBeat).toBe(2);expect(s.roadsideNotice?.id).toBe('student-cat');
  expect(s.roadsideQueue?.map(n=>n.id)).toEqual(['student-spectacle']);
  const next=tick(noObstacles(s),4.8);
  expect(next.roadsideNotice?.id).toBe('student-spectacle');expect(roadsideSecondsRemaining(next)).toBe(5);
  expect(next.roadsideQueue).toEqual([]);
  const done=tick(next,5);
  expect(done.roadsideNotice).toBeUndefined();expect(done.logs.map(l=>l.eventId)).toEqual(['student-cat','student-spectacle']);
 });

 it('a queued notice waits through a mandatory event, with no fake waiting or route progress',()=>{
  const raw=fixture('beijing',['student-cat','student-spectacle','gate-scan']);
  let s=start({...raw,stationProgress:.9999});
  s=tick(s,.1);s=tick({...noObstacles(s),stationProgress:.9999},.1);s=tick({...noObstacles(s),stationProgress:.9999},.1);
  expect(s.event?.id).toBe('gate-scan');
  const pending=tick(s,5);
  expect(pending.roadsideNotice).toBeUndefined();expect(pending.roadsideQueue?.[0].id).toBe('student-spectacle');
  const resumed=choose(pending);
  expect(resumed.roadsideNotice?.id).toBe('student-spectacle');expect(roadsideSecondsRemaining(resumed)).toBe(5);
  expect(resumed.stationProgress).toBe(0);
 });

 it('one delayed tick matches fifty small ticks for notice expiry, resources and the clock',()=>{
  const s=start({...fixture(),student:{...fixture().student!,stamina:20}}),large=tick(s,5);
  let small=s;for(let i=0;i<50;i++)small=tick(small,.1);
  expect(large.roadsideNotice).toEqual(small.roadsideNotice);expect(large.logs).toEqual(small.logs);
  expect(large.remaining).toBeCloseTo(small.remaining,8);expect(large.stationProgress).toBeCloseTo(small.stationProgress,8);
  expect(large.student!.stamina).toBeCloseTo(small.student!.stamina,8);expect(large.student!.clockSpent).toEqual(small.student!.clockSpent);
 });
});

describe('accepted notices retain canonical costs, current road and callback identity',()=>{
 it('can be accepted on the next road without replacing its required checkpoint or prediction',()=>{
  const base=start({...fixture(),stationProgress:.9999}),crossed=tick(base,.1);
  const before=stationForecast(crossed),opened=open(crossed),forecast=stationForecast(opened);
  expect(opened.event?.id).toBe('student-cat');expect(opened.stationBeat).toBe(1);expect(opened.roadsideNotice).toBeUndefined();
  expect(forecast.walking).toBe(before.walking);expect(forecast.operations-before.operations).toBeCloseTo(1,8);
  const held=tick(opened,1),completed=choose(held,'indulge');
  expect(completed.stationBeat).toBe(crossed.stationBeat);expect(completed.stationProgress).toBe(crossed.stationProgress);
  expect(opened.remaining-completed.remaining).toBeCloseTo(31,8);expect(completed.student!.happiness).toBe(20);
  expect(completed.stationRunning).toBe(true);expect(completed.student!.sprinting).toBe(false);
  const required=tick({...completed,stationProgress:.9999},.1);expect(required.event?.id).toBe('gate-scan');
 });

 it('acceptance removes the five-second deadline; handling still requires the real action',()=>{
  const opened=open(start(fixture())),waiting=tick(opened,6);
  expect(waiting.event?.id).toBe('student-cat');expect(waiting.student!.happiness).toBe(0);
  expect(opened.remaining-waiting.remaining).toBeCloseTo(6,8);expect(waiting.stationProgress).toBe(opened.stationProgress);
  const selected=waiting.event!.choices[0],completed=choose(waiting,'indulge');
  expect(waiting.remaining-completed.remaining).toBe(30);expect(completed.student!.distractions).toBe(1);
  expect(reducer(completed,{type:'CHOICE',choice:selected,eventRevision:waiting.event!.revision})).toBe(completed);
 });

 it('rejects stale and invalid stop revisions and any click after expiry',()=>{
  const s=fixture(),notice=s.roadsideNotice!;
  expect(reducer(s,{type:'ROADSIDE_STOP',id:notice.id,revision:notice.revision+1})).toBe(s);
  const expired=tick(s,5);
  expect(reducer(expired,{type:'ROADSIDE_STOP',id:notice.id,revision:notice.revision})).toBe(expired);
 });

 it('does not restore walking after failure or a manual pause during the accepted activity',()=>{
  const opened=open(start(fixture())),paused=reducer(opened,{type:'RUN_INPUT',held:false});
  const completed=choose(paused,'leave');expect(completed.stationRunning).toBe(false);
  const failing=choose({...opened,remaining:190},'indulge');
  expect(failing.phase).toBe('result');expect(failing.stationRunning).toBe(false);expect(failing.student!.sprinting).toBe(false);
 });
});
