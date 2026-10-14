import {describe,it,expect,vi} from 'vitest';
import {createCharacterStationRun,reducer,type Run} from './engine';
import {stationPrompt} from './flow';
import {createStationLuck,GATE_QUEUE_SECONDS,type StationLuck} from './stationEncounters';

const legacyLuck:StationLuck={elder:'grandma',elderScam:false,escalators:['clear','steady','blocked']};
const queues=[65,48,35,10,32,5,65,4];

describe('gate costs and per-run queues',()=>{
 it('prices the displayed extra walk and queue together for all eight lanes',()=>{
  const event=stationPrompt('gates',false,{...legacyLuck,gateQueues:queues})!;
  expect(event.choices).toHaveLength(8);
  for(const [lane,c] of event.choices.entries()){
   expect(c.lane).toBe(lane);expect(c.id).toBe(`lane-${lane+1}`);
   expect(c.waitSeconds).toBe(queues[lane]);expect(c.fixedWalkSeconds).toBeGreaterThan(0);
   expect(c.seconds).toBe(c.fixedWalkSeconds!+c.waitSeconds!);
   expect(c.detail).toContain(`附加步行 ${c.fixedWalkSeconds} 秒`);
   expect(c.detail).toContain(`排队 ${c.waitSeconds} 秒`);
   expect(c.detail).toContain(`合计 ${c.seconds} 秒`);
  }
  // The closest useful queue wins here; blindly picking the shortest queue does not.
  expect(event.choices.reduce((a,b)=>a.seconds<b.seconds?a:b).lane).toBe(3);
  expect(event.choices.reduce((a,b)=>a.waitSeconds!<b.waitSeconds!?a:b).lane).toBe(7);
 });
 it.each(['student','worker','tourist','mom'] as const)('charges the complete quoted cost once for %s',character=>{
  const initial=createCharacterStationRun('shanghai',character,false,()=>.5);
  const event=stationPrompt('gates',false,{...legacyLuck,gateQueues:queues})!;
  const s:Run={...initial,phase:'station',event,stationBeat:0,stationProgress:1,stationJourney:[{id:'gates',stage:4,label:'选择通道',seconds:2},{id:'gate-scan',stage:4,label:'刷证',seconds:1.5}]};
  const c=event.choices[7],done=reducer(s,{type:'CHOICE',choice:c});
  expect(s.remaining-done.remaining).toBe(c.fixedWalkSeconds!+c.waitSeconds!);
  expect(done.logs.at(-1)?.seconds).toBe(c.seconds);
  expect(done.stationLane).toBe(7);expect(done.stationBeat).toBe(1);
  expect(reducer(done,{type:'CHOICE',choice:c}).remaining).toBe(done.remaining);
 });
 it('freezes generated queues and never draws random values while reading prompts',()=>{
  const luck=createStationLuck(()=>.2),saved=[...luck.gateQueues!];
  expect([...saved].sort((a,b)=>a-b)).toEqual([...GATE_QUEUE_SECONDS].sort((a,b)=>a-b));
  expect(createStationLuck(()=>.8).gateQueues).not.toEqual(saved);
  const random=vi.spyOn(Math,'random').mockImplementation(()=>{throw Error('prompt must not reroll');});
  try{
   const first=stationPrompt('gates',false,luck);
   for(let i=0;i<8;i++)expect(stationPrompt('gates',false,luck)).toEqual(first);
   expect(luck.gateQueues).toEqual(saved);
   expect(stationPrompt('gates')).toEqual(stationPrompt('gates',false,legacyLuck));
  }finally{random.mockRestore();}
 });
});
