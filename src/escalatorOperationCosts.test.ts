import {describe,it,expect} from 'vitest';
import {createCharacterStationRun,reducer,type Run} from './engine';
import {escalatorRide,type EscalatorState} from './stationEncounters';

function station(state:EscalatorState):Run{
 const run=createCharacterStationRun('shanghai','student',false,()=>.5);
 return {...run,phase:'station',event:escalatorRide(state,0),escalatorLane:0,stationBeat:0,stationProgress:1,stationLuck:{...run.stationLuck,escalators:[state,'steady','blocked']},stationJourney:[{id:'escalator-ride',stage:1,label:'上楼',seconds:2},{id:'security-queue',stage:2,label:'安检',seconds:2}]};
}
describe('escalator operations and fixed waiting costs',()=>{
 it('describes four real clicks without promising an unused speed buff',()=>{
  const s=station('clear'),fast=s.event!.choices[0];
  expect(fast.detail).toContain('点击 4 次');expect(fast.detail).not.toContain('加速');expect(fast.seconds).toBe(0);
  const operation=reducer(s,{type:'CHOICE',choice:fast});
  expect(operation.event?.interaction).toMatchObject({kind:'tap',required:4});
  expect(operation.remaining).toBe(s.remaining);
  expect(operation.event?.choices[0].boost).toBeUndefined();
 });
 it.each([['clear',1,10],['steady',0,15],['blocked',0,30]] as const)('labels %s fixed waiting separately from the hold', (state,index,seconds)=>{
  const s=station(state),selected=s.event!.choices[index];
  expect(selected.waitSeconds).toBe(seconds);expect(selected.seconds).toBe(seconds);
  expect(selected.detail).toContain(`固定等待 ${seconds} 秒`);
  expect(selected.detail).toContain('另需按住');
  const operation=reducer(s,{type:'CHOICE',choice:selected});
  expect(operation.remaining).toBe(s.remaining);expect(operation.event?.interaction?.kind).toBe('hold');
  expect(operation.event?.choices[0].waitSeconds).toBe(seconds);
 });
});
