import {describe,it,expect} from 'vitest';
import {createCharacterStationRun,reducer,type Run} from './engine';
import {buildStationJourney,journeyPrompt} from './stationJourney';

describe('路线距离作用于实际通路，不随人物任务插入而改变',()=>{
 it.each(['student','worker','tourist','mom'] as const)('%s 上海和广州两条路线均改变指定行走段',who=>{
  for(const [station,eventId,target] of [['shanghai','sh-corridor','security-queue'],['guangzhou','gz-route','gz-crossing']]){
   const base=createCharacterStationRun(station,who,false,()=>.4);
   const beats=buildStationJourney(base),index=beats.findIndex(b=>b.id===eventId);
   const context:Run={...base,phase:'station',stationJourney:beats,stationBeat:index,stationProgress:1};
   const event=journeyPrompt(context),s={...context,event};
   for(const choice of event.choices){
    const n=reducer(s,{type:'CHOICE',choice});
    expect(n.stationJourney.find(b=>b.id===target)!.seconds).toBeCloseTo(beats.find(b=>b.id===target)!.seconds*choice.stationDecision!.travelScale!);
    for(const beat of beats.filter(b=>b.id!==target)){
     const after=n.stationJourney.find(b=>b.id===beat.id);
     if(after)expect(after.seconds).toBe(beat.seconds);
    }
    if(station==='guangzhou')expect(n.stationJourney.some(b=>b.id==='gz-lift')).toBe(!choice.stationDecision!.skip?.includes('gz-lift'));
   }
  }
 });
});
