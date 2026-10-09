import {describe,expect,it} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createCharacterStationRun,reducer,type Run} from './engine';
import {buildStationJourney,journeyPrompt} from './stationJourney';
import {completedStationAction,stationEventKey} from './stationFeedback';
import StationTaskScene from './StationTaskScene';

function at(city:string,id:string,character:'student'|'worker'='student'):Run{
 const base=createCharacterStationRun(city,character,false,()=>.1);
 const stationJourney=buildStationJourney(base);
 const stationBeat=stationJourney.findIndex(beat=>beat.id===id);
 if(stationBeat<0)throw new Error(`Missing ${id} in ${city}`);
 const run:Run={...base,phase:'station',remaining:1800,stationJourney,stationBeat,stationProgress:1,stage:stationJourney[stationBeat].stage};
 return {...run,event:journeyPrompt(run)};
}

describe('station action feedback',()=>{
 it('reveals the real east-entry detour cost only after the choice',()=>{
  const previous=at('beijing','bj-entry');
  const choice=previous.event!.choices.find(option=>option.stationDecision?.value==='east')!;
  expect(choice.detail).not.toContain('45');
  const next=reducer(previous,{type:'CHOICE',choice});
  expect(previous.remaining-next.remaining).toBe(45);
  const result=completedStationAction(previous,next,choice.label);
  expect(result?.seconds).toBe(45);
  expect(result?.title).toContain('已折返西侧入口');
 });

 it('keeps observation within the active queue task',()=>{
  const previous=at('beijing','security-queue');
  const next=reducer(previous,{type:'OBSERVE'});
  expect(next.student!.observed).toBe(true);
  expect(next.event!.choices.map(choice=>choice.detail)).not.toEqual(previous.event!.choices.map(choice=>choice.detail));
  expect(next.stationBeat).toBe(previous.stationBeat);
  expect(stationEventKey(next)).toBe(stationEventKey(previous));
  expect(completedStationAction(previous,next)).toBeNull();
 });

 it('does not mistake a failed pocket search and its penalty log for completion',()=>{
  const previous=at('beijing','identity-search');
  const next=reducer(previous,{type:'POCKET_PICK',pocket:(previous.student!.pocket+1)%4});
  expect(next.logs.at(-1)?.seconds).toBe(5);
  expect(next.student!.bagMistakes).toBe(1);
  expect(next.identityReady).toBe(false);
  expect(next.event?.id).toBe('identity-search');
  expect(completedStationAction(previous,next)).toBeNull();
 });

 it('keeps the gate-number task active after a wrong number and penalty',()=>{
  const previous=at('zhengzhou','zz-number');
  const choice=previous.event!.choices.find(option=>option.label==='12A')!;
  const next=reducer(previous,{type:'CHOICE',choice});
  expect(previous.remaining-next.remaining).toBe(35);
  expect(next.logs.at(-1)?.eventId).toBe('zz-number');
  expect(next.event?.id).toBe('zz-number');
  expect(completedStationAction(previous,next,choice.label)).toBeNull();
 });

 it.each(['student','worker'] as const)('does not complete an overdue %s security task',character=>{
  const previous=at('guangzhou','security',character);
  const next=reducer(previous,{type:'TICK',dt:15});
  expect(next.eventOverdue).toBe(true);
  expect(next.event?.id).toBe('security');
  if(character==='worker')expect(next.logs.at(-1)?.title).toContain('仍需完成');
  expect(completedStationAction(previous,next)).toBeNull();
 });

 it('shows the completed gate snapshot and the next destination after the green light',()=>{
  const previous=at('beijing','gate-scan');
  const next=reducer(previous,{type:'CHOICE',choice:previous.event!.choices[0]});
  expect(next.gatePassed).toBe(true);
  expect(next.event).toBeNull();
  expect(next.stationJourney[next.stationBeat].id).toBe('board-train');
  const result=completedStationAction(previous,next);
  expect(result?.title).toContain('绿灯亮了');
  expect(result?.seconds).toBe(0);
  expect(result?.run.event).toBe(previous.event);
  expect(result?.run.stationBeat).toBe(previous.stationBeat);
  expect(result?.run.gatePassed).toBe(true);
  expect(result?.nextLabel).toBe('最后一段，冲向车门！');
 });

 it('does not show a receipt from a different run even at the same completed task',()=>{
  const previous=at('beijing','gate-scan');
  const replay=at('beijing','gate-scan');
  const next=reducer(replay,{type:'CHOICE',choice:replay.event!.choices[0]});
  expect(next.phase).toBe('station');
  expect(next.event).toBeNull();
  expect(stationEventKey(previous)).not.toBe(stationEventKey(replay));
  expect(completedStationAction(previous,next)).toBeNull();
 });

 it('gives sub-events in the same beat distinct keys without completing the beat',()=>{
  const previous=at('shanghai','elder-block');
  const choice=previous.event!.choices.find(option=>option.effect==='elder-detour')!;
  const next=reducer(previous,{type:'CHOICE',choice});
  expect(next.stationBeat).toBe(previous.stationBeat);
  expect(next.event?.id).toBe('elder-detour-action');
  expect(stationEventKey(next)).not.toBe(stationEventKey(previous));
  expect(completedStationAction(previous,next,choice.label)).toBeNull();
 });
});

function scene(run:Run,progress=0){
 return renderToStaticMarkup(createElement(StationTaskScene,{run,progress,active:true}));
}

describe('station task close-ups',()=>{
 it('distinguishes the real entrance, queue, tray, identity, gate and boarding tasks',()=>{
  const cases=[['bj-entry','entry'],['security-queue','security-queue'],['bj-tray','security-tray'],['identity-search','identity'],['gate-scan','gate-scan'],['board-train','board-train']];
  for(const [id,kind] of cases)expect(scene(at('beijing',id))).toContain(`data-task-kind="${kind}"`);
 });

 it('shows stairs and lifts after their actual route choices despite sharing an event id',()=>{
  for(const mode of ['stairs','lift']){
   const previous=at('shanghai','vertical-choice');
   const choice=previous.event!.choices.find(option=>option.studentEffect===mode)!;
   const next=reducer(previous,{type:'CHOICE',choice});
   const arrived={...next,event:journeyPrompt(next)};
   expect(arrived.event.id).toBe('escalator-ride');
   expect(scene(arrived)).toContain(`data-task-kind="${mode}"`);
  }
 });

 it('shows public queue sizes without revealing hidden wait times through text or layout',()=>{
  const run=at('beijing','security-queue');
  expect(run.student!.observed).toBe(false);
  const html=scene(run);
  for(const choice of run.event!.choices)expect(html).toContain(choice.label);
  const changed:Run={...run,student:{...run.student!,queues:run.student!.queues.map((queue,index)=>({...queue,seconds:91+index}))},event:{...run.event!,choices:run.event!.choices.map((choice,index)=>({...choice,seconds:91+index}))}};
  expect(scene(changed)).toBe(html);
 });

 it('does not identify the target pocket before the player finds the ID',()=>{
  const base=at('beijing','identity-search');
  const run={...base,student:{...base.student!,checkedID:false,stats:{...base.student!.stats,focus:20},pocket:0}};
  expect(scene({...run,student:{...run.student,pocket:3}},.6)).toBe(scene(run,.6));
  expect(scene(run,1)).not.toContain('data-scene-object="identity-card"');
  const next=reducer(run,{type:'POCKET_PICK',pocket:0});
  const receipt=completedStationAction(run,next)!;
  expect(scene(receipt.run,1)).toContain('data-scene-object="identity-card"');
 });

 it('opens the gate using reported operation completion rather than elapsed reading time',()=>{
  const run={...at('beijing','gate-scan'),eventElapsed:500};
  expect(scene(run,.4)).not.toContain('>放行<');
  expect(scene(run,1)).toContain('>放行<');
 });
});
