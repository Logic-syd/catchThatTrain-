import {describe,it,expect} from 'vitest';
import {createCharacterStationRun} from './engine';
import {eventTimeLimit} from './eventTiming';
import {identityPrompt,stationPrompt} from './flow';
import {focusWindow} from './studentConfig';
import {characterEventPrompt} from './characterTime';

describe('shared event time limits',()=>{
 it('preserves the student focus window',()=>{
  const run=createCharacterStationRun('shanghai','student',false,()=>.5);
  const event=stationPrompt('bag-snag')!;
  for(const focus of [0,55,100]){
   const s={...run,event,student:{...run.student!,stats:{...run.student!.stats,focus}}};
   expect(eventTimeLimit(s)).toBe(7*focusWindow(focus));
  }
 });
 it.each(['worker','tourist','mom'] as const)('keeps %s fixed windows independent of focus',character=>{
  const run=createCharacterStationRun('shanghai',character,false,()=>.5);
  const event=stationPrompt('bag-snag')!;
  expect(eventTimeLimit({...run,event})).toBe(7);
  if(run.characterTime)for(const focus of [0,100])expect(eventTimeLimit({...run,characterTime:{...run.characterTime,focus}},event)).toBe(7);
 });
 it.each(['student','worker','tourist','mom'] as const)('uses wallet and card deadlines for %s',character=>{
  const run=createCharacterStationRun('shanghai',character,false,()=>.5);
  const factor=run.student?focusWindow(run.student.stats.focus):1,event=identityPrompt('station');
  expect(eventTimeLimit({...run,identityStage:'wallet'},event)).toBe(8*factor);
  expect(eventTimeLimit({...run,identityStage:'card'},event)).toBe(6*factor);
 });
 it('shows the actual three-second tourist alarm limit and handles no event',()=>{
  const run=createCharacterStationRun('shanghai','tourist',false,()=>.5);
  expect(eventTimeLimit(run,characterEventPrompt(run,'tourist-wake'))).toBe(3);
  expect(eventTimeLimit(run)).toBe(0);
 });
});
