import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {createCharacterStationRun,reducer,STOP_BEFORE,type Run} from './engine';
import {buildStationJourney} from './stationJourney';
import {advanceOnMap,mapTaskPoint,mapDistance,trainPoint} from './stationMapTravel';
import {activeObstacle,createMapObstacles,newBlock,mapQueueWait} from './mapObstructions';
import MapObstructionPanel from './MapObstructionPanel';
import {createGameResult} from './gameResult';

function begin(city='hangzhou'){
 let s=createCharacterStationRun(city,'student',false,()=>.6);s={...s,phase:'station',remaining:10000,stationJourney:buildStationJourney(s)};
 return reducer(s,{type:'MAP_ENABLE'});
}
function walk(s:Run){for(let i=0;i<5000&&s.stationRunning&&!s.stationMap?.block&&!s.event;i++)s=reducer(s,{type:'TICK',dt:.1});return s;}
function queueRun(){let s=begin();s.stationBeat=s.stationJourney.findIndex(b=>b.id==='security-queue');s.stationMap={...s.stationMap!,position:mapTaskPoint(s),obstacles:[]};return reducer(s,{type:'MAP_TARGET',point:trainPoint(s)});}
describe('people and facilities interrupt actual map travel',()=>{
 it('hits the closest person across a long movement segment instead of passing through',()=>{
  let s=begin();s=reducer(s,{type:'MAP_TARGET',point:trainPoint(s)});const hit=advanceOnMap(s,1000);
  expect(hit.obstruction?.kind).toBe('door');expect(hit.encounter).toBe(false);expect(hit.map.position.y).toBeGreaterThan(hit.obstruction!.point.y);
  expect(mapDistance(hit.map.position,hit.obstruction!.point)).toBeCloseTo(8);
 });
 it('sprint, map taps and resume cannot push through a blockage or skip the current task',()=>{
  let s=walk(reducer(begin(),{type:'MAP_TARGET',point:trainPoint(begin())}));expect(activeObstacle(s.stationMap!)?.kind).toBe('door');
  const pos=s.stationMap!.position,beat=s.stationBeat,seconds=s.student!.sprintSeconds;
  for(const a of [{type:'SPRINT_INPUT',held:true},{type:'RUN_INPUT',held:true},{type:'MAP_TARGET',point:trainPoint(s)}] as const)expect(reducer(s,a)).toBe(s);
  s=reducer(s,{type:'TICK',dt:3});expect(s.stationMap!.position).toEqual(pos);expect(s.stationRunning).toBe(false);expect(s.student!.sprintSeconds).toBe(seconds);expect(s.stationBeat).toBe(beat);
 });
 it('sidestepping really changes position, retains the goal and does not subtract a flat penalty',()=>{
  let s=walk(reducer(begin(),{type:'MAP_TARGET',point:trainPoint(begin())})),position=s.stationMap!.position,time=s.remaining,goal=s.stationMap!.destination,beat=s.stationBeat;
  s=reducer(s,{type:'MAP_CLEAR',method:'sidestep'});expect(s.remaining).toBe(time);expect(s.stationBeat).toBe(beat);expect(s.stationMap!.destination).toEqual(goal);expect(s.stationMap!.bypassing).toBe(true);
  s=reducer(s,{type:'TICK',dt:.2});expect(s.stationMap!.position.x).not.toBe(position.x);expect(s.remaining).toBeLessThan(time);
  const end=walk(s);expect(end.event?.id).toBe('hz-fork');expect(end.stationMap!.obstacles.find(o=>o.kind==='door')!.cleared).toBe(true);
 });
 it('a side route interrupted by a rest can resume without snapping the avatar to the centre',()=>{
  let s=walk(reducer(begin(),{type:'MAP_TARGET',point:trainPoint(begin())}));s=reducer(s,{type:'MAP_CLEAR',method:'sidestep'});s=reducer(s,{type:'TICK',dt:.2});s=reducer(s,{type:'RUN_INPUT',held:false});
  const position=s.stationMap!.position,path=s.stationMap!.path;s=reducer(s,{type:'MAP_TARGET',point:trainPoint(s)});expect(s.stationMap!.position).toEqual(position);expect(s.stationMap!.path).toEqual(path);expect(s.stationRunning).toBe(true);expect(walk(s).event?.id).toBe('hz-fork');
 });
 it('asking someone to move has real waiting progress and resumes the onward goal',()=>{
  let s=walk(reducer(begin(),{type:'MAP_TARGET',point:trainPoint(begin())})),beat=s.stationBeat;
  s=reducer(s,{type:'MAP_CLEAR',method:'ask'});const before=s.remaining,pos=s.stationMap!.position,duration=s.stationMap!.block!.duration;
  s=reducer(s,{type:'TICK',dt:.1});expect(s.stationMap!.block!.elapsed).toBe(.1);expect(s.stationMap!.position).toEqual(pos);expect(s.stationRunning).toBe(false);
  s=reducer(s,{type:'TICK',dt:duration-.1});expect(s.stationMap!.block).toBeNull();expect(s.stationRunning).toBe(true);expect(s.remaining).toBeCloseTo(before-duration);expect(s.stationBeat).toBe(beat);expect(s.logs.at(-1)!.seconds).toBeCloseTo(duration);
 });
 it('keeps the planned destination through mandatory actions, then stops at the next one',()=>{
  let s=walk(reducer(begin(),{type:'MAP_TARGET',point:trainPoint(begin())}));s=reducer(s,{type:'MAP_CLEAR',method:'sidestep'});s=walk(s);expect(s.event!.id).toBe('hz-fork');
  const goal=s.stationMap!.destination;s=reducer(s,{type:'CHOICE',choice:s.event!.choices[0]});expect(s.stationRunning).toBe(true);expect(s.stationMap!.destination).toEqual(goal);s=walk(s);expect(s.stationMap!.block||s.event).toBeTruthy();
 });
 it('crowds live on a branch, so the outer bridge does not contain the middle crowd',()=>{
  const s=begin('guangzhou'),obs=createMapObstacles(s),crowd=obs.find(o=>o.kind==='crowd')!;
  const entry=s.city.id==='guangzhou'?{x:85,y:150}:{x:0,y:0};expect(crowd.point.x).toBeGreaterThan(entry.x);
  expect(obs).toEqual(s.stationMap!.obstacles);expect(createMapObstacles(s)).toEqual(obs);
  let n:Run={...s,stationMap:{...s.stationMap!,position:entry,obstacles:[crowd]}};n=reducer(n,{type:'MAP_TARGET',point:{x:115,y:55}});n=walk(n);expect(n.stationMap!.block).toBeNull();expect(n.event).toBeNull();
 });
 it('a closed window cannot be cleared by waiting and cannot mark the ticket gate passed',()=>{
  let s=begin('zhengzhou');s.stationBeat=s.stationJourney.findIndex(b=>b.id==='gate-scan');const obstacle=s.stationMap!.obstacles.find(o=>o.kind==='closed')!;
  s.stationMap={...s.stationMap!,position:{x:410,y:55},path:[mapTaskPoint(s)],destination:trainPoint(s),legBeat:s.stationBeat,legDistance:25,block:newBlock(obstacle)};
  expect(reducer(s,{type:'MAP_CLEAR',method:'wait'})).toBe(s);const beat=s.stationBeat;s=reducer(s,{type:'MAP_CLEAR',method:'leave'});expect(s.gatePassed).toBe(false);expect(s.stationBeat).toBe(beat);expect(s.stationMap!.path[0].x).not.toBe(410);
  s=walk(s);expect(s.event?.id).toBe('gate-scan');expect(s.gatePassed).toBe(false);
 });
 it('queues start with no selection and people leave one at a time',()=>{
  let s=queueRun();expect(s.event).toBeNull();expect(s.stationMap!.block!.lane).toBeNull();expect(s.stationMap!.block!.mode).toBe('stopped');
  s=reducer(s,{type:'MAP_CLEAR',method:'join',lane:0});const b=s.stationMap!.block!,people=b.queues[0].people,beat=s.stationBeat;
  s=reducer(s,{type:'TICK',dt:b.queues[0].interval+.01});expect(s.stationMap!.block!.queues[0].people).toBe(people-1);expect(s.stationMap!.position).toEqual(mapTaskPoint(s));expect(s.stationBeat).toBe(beat);expect(s.stationRunning).toBe(false);
  expect(reducer(s,{type:'MAP_CLEAR',method:'tray'})).toBe(s);
 });
 it('the unselected B and C queues advance at their own speeds while waiting in slow A',()=>{
  let s=queueRun();const queues=s.stationMap!.block!.queues;
  // This seed puts luggage checks in A and the two faster checkpoints in B/C.
  expect(queues[0].interval).toBeGreaterThan(queues[1].interval);
  s=reducer(s,{type:'MAP_CLEAR',method:'join',lane:0});
  const dt=Math.max(queues[1].interval,queues[2].interval)+.01;
  s=reducer(s,{type:'TICK',dt});const next=s.stationMap!.block!;
  expect(next.queues[0].people).toBe(queues[0].people);
  for(const lane of [1,2])expect(next.queues[lane].people).toBe(queues[lane].people-1);
  const html=renderToStaticMarkup(<MapObstructionPanel run={s} dispatch={()=>{}}/>);
  for(const lane of [1,2])expect(html).toContain(`${queues[lane].label} · ${queues[lane].people-1} 人`);
  expect(next.lane).toBe(0);expect(s.stationRunning).toBe(false);
 });
 it('switching joins the current tail and preserves a partially checked front passenger',()=>{
  let s=reducer(queueRun(),{type:'MAP_CLEAR',method:'join',lane:0});
  s=reducer(s,{type:'TICK',dt:.6});const queues=s.stationMap!.block!.queues,position=s.stationMap!.position;
  s=reducer(s,{type:'MAP_CLEAR',method:'join',lane:1});const block=s.stationMap!.block!;
  expect(block.queues).toEqual(queues);expect(block.duration).toBeCloseTo(mapQueueWait(queues[1]));
  expect(block.duration).toBeLessThan(queues[1].people*queues[1].interval);
  expect(reducer(s,{type:'MAP_CLEAR',method:'join',lane:1})).toBe(s);
  s=reducer(s,{type:'TICK',dt:queues[1].interval-queues[1].serviceElapsed+.01});
  expect(s.stationMap!.block!.queues[1].people).toBe(queues[1].people-1);
  expect(s.stationMap!.position).toEqual(position);
 });
 it('all checkpoints keep moving while choosing, using the same game time as the countdown',()=>{
  let s=queueRun();const queues=s.stationMap!.block!.queues,before=s.remaining;
  const dt=(Math.max(queues[1].interval,queues[2].interval)+.01)*4;
  s=reducer(s,{type:'TICK',dt});expect(s.remaining).toBeCloseTo(before-dt);
  expect(s.stationMap!.block!.lane).toBeNull();expect(s.stationMap!.block!.mode).toBe('stopped');
  for(const lane of [1,2])expect(s.stationMap!.block!.queues[lane].people).toBe(queues[lane].people-1);
  s=reducer(s,{type:'MAP_CLEAR',method:'join',lane:1});
  expect(s.stationMap!.block!.duration).toBeCloseTo(mapQueueWait(s.stationMap!.block!.queues[1]));
 });
 it('a queue that empties before switching goes straight to the tray, with no automatic security pass',()=>{
  let s=reducer(queueRun(),{type:'MAP_CLEAR',method:'join',lane:0});
  const dt=mapQueueWait(s.stationMap!.block!.queues[1]),beat=s.stationBeat;
  s=reducer(s,{type:'TICK',dt});expect(s.stationMap!.block!.queues[1].people).toBe(0);
  const before=s.remaining;s=reducer(s,{type:'MAP_CLEAR',method:'join',lane:1});
  expect(s.stationMap!.block!.mode).toBe('tray');expect(s.remaining).toBe(before);
  expect(s.stationBeat).toBe(beat);expect(s.seen).not.toContain('security-queue');
  const people=s.stationMap!.block!.queues[0].people,interval=s.stationMap!.block!.queues[0].interval;
  s=reducer(s,{type:'TICK',dt:interval*4});
  expect(s.stationMap!.block!.queues[0].people).toBe(people-1);
  expect(s.stationMap!.block!.queues.every(q=>q.people>=0)).toBe(true);
  s=reducer(s,{type:'MAP_CLEAR',method:'tray'});expect(s.stationBeat).toBe(beat+1);
 });
 it('the slower short queue takes longer and choosing a queue is not a time deduction',()=>{
  const s=queueRun(),queues=s.stationMap!.block!.queues,short=queues.reduce((best,q,i)=>q.people<queues[best].people?i:best,0),fast=queues.reduce((best,q,i)=>q.people*q.interval<queues[best].people*queues[best].interval?i:best,0);
  const slow=reducer(s,{type:'MAP_CLEAR',method:'join',lane:short}),quick=reducer(s,{type:'MAP_CLEAR',method:'join',lane:fast});expect(slow.remaining).toBe(s.remaining);expect(quick.remaining).toBe(s.remaining);expect(slow.stationMap!.block!.duration).toBeGreaterThan(quick.stationMap!.block!.duration);
  const switched=reducer(reducer(slow,{type:'TICK',dt:.5}),{type:'MAP_CLEAR',method:'join',lane:fast});expect(switched.stationMap!.block!.elapsed).toBe(0);expect(switched.stationMap!.block!.waited).toBe(2);
 });
 it('waiting charges time once, and passing security still requires placing the bag',()=>{
  let s=queueRun();s=reducer(s,{type:'MAP_CLEAR',method:'join',lane:0});const before=s.remaining,duration=s.stationMap!.block!.duration,beat=s.stationBeat;
  s=reducer(s,{type:'TICK',dt:duration});expect(s.stationMap!.block!.mode).toBe('tray');expect(s.remaining).toBeCloseTo(before-duration*4);expect(s.student!.environmentLoss).toBeCloseTo(duration*4);expect(s.stationBeat).toBe(beat);expect(s.seen).not.toContain('security-queue');
  const time=s.remaining;s=reducer(s,{type:'MAP_CLEAR',method:'tray'});expect(s.remaining).toBe(time);expect(s.stationBeat).toBe(beat+1);expect(s.seen).toContain('security-queue');expect(s.logs.at(-1)!.seconds).toBeCloseTo(duration*4);expect(s.stationRunning).toBe(true);expect(reducer(s,{type:'MAP_CLEAR',method:'tray'})).toBe(s);
 });
 it('an oversized queue frame charges its remainder as normal time and cannot pass security',()=>{
  let s=queueRun();s=reducer(s,{type:'MAP_CLEAR',method:'join',lane:0});const before=s.remaining,duration=s.stationMap!.block!.duration;s=reducer(s,{type:'TICK',dt:duration+2});expect(s.remaining).toBeCloseTo(before-duration*4-2);expect(s.stationMap!.block!.mode).toBe('tray');expect(s.stationBeat).toBe(queueRun().stationBeat);
 });
 it('a deadline while blocked ends the run without allowing motion',()=>{
  let s=walk(reducer(begin(),{type:'MAP_TARGET',point:trainPoint(begin())}));s={...s,remaining:STOP_BEFORE+.5};const pos=s.stationMap!.position;s=reducer(s,{type:'TICK',dt:1});expect(s.phase).toBe('result');expect(s.success).toBe(false);expect(s.stationMap!.position).toEqual(pos);expect(reducer(s,{type:'MAP_CLEAR',method:'sidestep'})).toBe(s);
 });
 it('the queue and ordinary blockage have distinct actions with no default answer',()=>{
  const s=queueRun(),html=renderToStaticMarkup(<MapObstructionPanel run={s} dispatch={()=>{}}/>);expect(html).toContain('排这队');expect(html).not.toContain('aria-pressed="true"');
  const door=walk(reducer(begin(),{type:'MAP_TARGET',point:trainPoint(begin())})),people=renderToStaticMarkup(<MapObstructionPanel run={door} dispatch={()=>{}}/>);expect(people).toContain('按住说声借过');expect(people).toContain('侧身，从旁边绕过去');
 });
 it('reports the map queue choice and waiting as environment time',()=>{
  let s=queueRun();const queues=s.stationMap!.block!.queues,lane=queues.reduce((best,q,i)=>q.people*q.interval<queues[best].people*queues[best].interval?i:best,0);s=reducer(s,{type:'MAP_CLEAR',method:'join',lane});const duration=s.stationMap!.block!.duration;s=reducer(s,{type:'TICK',dt:duration});s=reducer(s,{type:'MAP_CLEAR',method:'tray'});
  const result=createGameResult(s);expect(result.securityGood).toBe(true);const impact=result.timeImpacts.find(i=>i.eventId==='map-security')!;expect(impact.avoidable).toBe(false);expect(impact.deltaSeconds).toBeCloseTo(-duration*4);expect(impact.source).toContain('逐人检查');
 });
 it('Beijing does not make the player place the same bag twice but retains the strict child check',()=>{
  let s=createCharacterStationRun('beijing','mom',false,()=>.6);s={...s,phase:'station',stationJourney:buildStationJourney(s),remaining:10000};s=reducer(s,{type:'MAP_ENABLE'});s.stationBeat=s.stationJourney.findIndex(b=>b.id==='security-queue');s.stationMap={...s.stationMap!,position:mapTaskPoint(s),obstacles:[]};s=reducer(s,{type:'MAP_TARGET',point:trainPoint(s)});s=reducer(s,{type:'MAP_CLEAR',method:'join',lane:0});s=reducer(s,{type:'TICK',dt:s.stationMap!.block!.duration});s=reducer(s,{type:'MAP_CLEAR',method:'tray'});expect(s.seen).toContain('bj-tray');expect(s.stationJourney[s.stationBeat].id).toBe('bj-parent-strict');expect(s.seen).not.toContain('bj-parent-strict');
 });
});
