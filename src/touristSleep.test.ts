import {describe,it,expect} from 'vitest';
import {createCharacterStationRun,reducer,type Run} from './engine';
import {characterEventPrompt} from './characterTime';
import {planMetroIncident} from './metroFlow';

function riding(routeId='sh-n-2',spawn=0):Run{
 let run=createCharacterStationRun('shanghai','tourist',false,()=>.9);
 run={...run,spawn};
 run=reducer(run,{type:'START'});
 run=reducer(run,{type:'PERSON_PICK',option:'go',step:0});
 run=reducer(run,{type:'PERSON_PICK',option:'light',step:1});
 const route=run.city.spawnStations[spawn].routes.find(option=>option.id===routeId)!;
 run=reducer(run,{type:'ROUTE',route});
 return reducer(run,{type:'DIRECTION',correct:true});
}
function reachSleepChoice(run:Run):Run{
 for(let i=0;i<50&&!run.event;i++)run=reducer(run,{type:'TICK',dt:.1});
 expect(run.event?.id).toBe('tourist-sleep');
 return run;
}

describe('tourist metro nap',()=>{
 it('asks after the train has moved, then jumps to the alarm stop and charges only rail travel',()=>{
  let run=riding();
  expect(run.event).toBeNull();
  expect(run.metroProgress).toBe(0);
  run=reachSleepChoice(run);
  expect(run.metroProgress).toBeCloseTo(.2);
  const before=run.remaining,progress=run.metroProgress;
  run=reducer(run,{type:'CHOICE',choice:run.event!.choices.find(choice=>choice.label==='提前 2 站叫醒')!});
  expect(run.phase).toBe('arrival');
  expect(run.metroStopIndex).toBe(2);
  expect(run.route!.stops[run.metroStopIndex]).toBe('静安寺');
  expect(run.event?.id).toBe('tourist-wake');
  expect(run.remaining).toBeCloseTo(before-(run.metroProgress-progress)*run.metroDuration);
  run=reducer(run,{type:'CHOICE',choice:run.event!.choices[0]});
  expect(run.event).toBeNull();
  expect(run.phaseElapsed).toBe(0);
  expect(run.characterTime!.sleeping).toBe(false);
  expect(reducer(run,{type:'CONTINUE_METRO'}).phase).toBe('metro');
 });
 it('wakes before a required transfer and does not offer impossible alarm stations',()=>{
  let run=reachSleepChoice(riding('sh-n-x'));
  expect(run.event!.choices.map(choice=>choice.label)).not.toContain('提前 3 站叫醒');
  run=reducer(run,{type:'CHOICE',choice:run.event!.choices.find(choice=>choice.label==='提前 1 站叫醒')!});
  expect(run.route!.stops[run.metroStopIndex]).toBe(run.route!.via);
  expect(run.event?.title).toContain(run.route!.via!);
  run=reducer(run,{type:'CHOICE',choice:run.event!.choices[0]});
  expect(reducer(run,{type:'ALIGHT'}).phase).toBe('transfer');
  const earlyTransfer=reachSleepChoice(riding('sh-p-x',1));
  expect(earlyTransfer.event!.choices.map(choice=>choice.label)).toEqual(['提前 2 站叫醒','撑着，盯紧站名']);
 });
 it('staying awake keeps ordinary stop decisions; missing the alarm causes recovery',()=>{
  let awake=reachSleepChoice(riding());
  awake=reducer(awake,{type:'CHOICE',choice:awake.event!.choices.at(-1)!});
  expect(awake.phase).toBe('metro');
  expect(awake.characterTime!.sleeping).toBe(false);
  expect(awake.event).toBeNull();
  let asleep=reachSleepChoice(riding());
  asleep=reducer(asleep,{type:'CHOICE',choice:asleep.event!.choices[0]});
  const miss=reducer(asleep,{type:'TICK',dt:3});
  expect(miss.phase).toBe('metro-recovery');
  expect(miss.metroMisses).toBe(1);
  expect(miss.remaining).toBeCloseTo(asleep.remaining-3-80);
  expect(reducer(miss,{type:'TICK',dt:2}).phase).toBe('arrival');
 });
 it('resolves the route incident before offering a nap',()=>{
  let run=riding();
  run={...run,metroIncident:planMetroIncident(run.route!,0,.5)};
  for(let i=0;i<50&&!run.event;i++)run=reducer(run,{type:'TICK',dt:.1});
  expect(run.event?.id).toBe('metro-crowded-door');
  run=reducer(run,{type:'CHOICE',choice:run.event!.choices[0]});
  expect(reachSleepChoice(run).event?.id).toBe('tourist-sleep');
 });
 it('wake instruction asks for a tap and for station recognition',()=>{
  const run=riding();
  const prompt=characterEventPrompt({...run,metroStopIndex:1},'tourist-wake')!;
  expect(prompt.description).toContain('点一下醒来');
  expect(prompt.description).toContain('决定下车、换乘，还是继续坐');
 });
});
