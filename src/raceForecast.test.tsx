import {describe,it,expect,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {createCharacterStationRun,reducer,type Run} from './engine';
import {buildStationJourney,journeyPrompt} from './stationJourney';
import {STATIONS} from './stations';
import {BALANCE} from './balanceConfig';
import {fastestRemainingSeconds,raceForecast,maximumTravelFactor} from './raceForecast';
import {characterMovementFactor} from './characterTime';
import {parentMovementFactor} from './parent';
import {mapTaskPoint} from './stationMapTravel';
import {simulateBalance} from '../scripts/simulateBalance';
import RaceClock from './RaceClock';

const roles=['student','worker','tourist','mom'] as const;
function station(city='hangzhou',role:typeof roles[number]='student'):Run{
 const s=createCharacterStationRun(city,role,false,()=>.6);
 return {...s,phase:'station',remaining:1400,stationJourney:buildStationJourney(s)};
}
describe('meaningful operation floor and equal mistake cost',()=>{
 it('even the smallest no-detour, identity-already-ready plan has 12 meaningful operations',()=>{
  // Exclude everything removable, all optional interactions, identity retries,
  // movement inputs and intermediate metro stops. This is a conservative floor.
  const optional=new Set(['identity-search','escalator-choice','gz-lift','bj-tray','worker-boss-call','wh-parent-duck-repeat']);
  for(const st of STATIONS)for(const role of roles)for(const seed of [.1,.6,.9]){
   const s=createCharacterStationRun(st.id,role,false,()=>seed);
   const beats=buildStationJourney({...s,identityReady:true}).filter(b=>!optional.has(b.id));
   const preparations=role==='tourist'||role==='mom'?2:3;
   const floor=preparations+3+beats.reduce((sum,b)=>sum+(b.id==='security-queue'?2:1),0);
   expect(floor,`${st.id}/${role}`).toBeGreaterThanOrEqual(BALANCE.minimumOperations);
  }
 });
 it('duplicate input and queue switching cannot inflate the operation count',()=>{
  let s=reducer(createCharacterStationRun('hangzhou'),{type:'START'});
  s=reducer(s,{type:'PREP_PICK',step:0,option:'skip'});
  expect(s.metrics.operations).toHaveLength(1);
  s=reducer(s,{type:'PREP_PICK',step:0,option:'skip'});
  s=reducer(s,{type:'TICK',dt:2});expect(s.metrics.operations).toHaveLength(1);
  s=station();s={...s,stationBeat:s.stationJourney.findIndex(b=>b.id==='security-queue')};
  s=reducer(s,{type:'MAP_ENABLE',manual:true});
  s={...s,stationMap:{...s.stationMap!,position:mapTaskPoint(s)}};
  s=reducer(s,{type:'MAP_TARGET',point:mapTaskPoint(s)});
  for(const lane of [0,1,2,0,1])s=reducer(s,{type:'MAP_CLEAR',method:'join',lane});
  expect(s.metrics.operations.filter(o=>o.id==='map-security:queue')).toHaveLength(1);
 });
 it('the same wrong turn costs every role equally, while correct choices and explicit metro costs stay unchanged',()=>{
  const costs=roles.map(role=>{
   let s=station('hangzhou',role);s={...s,event:journeyPrompt(s)};
   const right=s.event!.choices.find(c=>c.stationDecision?.optimal)!,wrong=s.event!.choices.find(c=>!c.stationDecision?.optimal)!;
   expect(right.seconds).toBe(0);
   const next=reducer(s,{type:'CHOICE',choice:wrong});
   expect(s.remaining-next.remaining).toBe(wrong.seconds);
   return wrong.seconds;
  });
  expect(costs).toEqual([45,45,45,45]);
  expect(BALANCE.metroAnnouncement.choiceSeconds).toBe(5);expect(BALANCE.metroAnnouncement.missSeconds).toBe(50);
 });
});

describe('live optimistic deadline comparison',()=>{
 it('does not consume randomness or show a random probability, and compares the correct deadline',()=>{
  const s=station(),rng=vi.spyOn(Math,'random');rng.mockClear();
  const before=raceForecast(s)!;const html=renderToStaticMarkup(<RaceClock run={s}/>);
  expect(before.remaining).toBe(1220);expect(before.fastest).toBeGreaterThan(0);
  expect(html).toContain('理论最短');expect(html).not.toMatch(/几率|概率|%/);expect(rng).not.toHaveBeenCalled();rng.mockRestore();
  const after={...s,gatePassed:true,remaining:180,stationBeat:s.stationJourney.length-1};
  expect(raceForecast(after)!.remaining).toBe(180);expect(renderToStaticMarkup(<RaceClock run={after}/>)).toContain('到车门理论最短');
 });
 it('only warns definitively below the lower bound; it never terminates the run or rounds into a false loss',()=>{
  let s=station();const f=raceForecast(s)!;
  s={...s,remaining:180+f.fastest-.1};expect(raceForecast(s)!.status).not.toBe('impossible');
  s={...s,remaining:180+f.fastest-2};expect(raceForecast(s)!.status).toBe('impossible');
  expect(renderToStaticMarkup(<RaceClock run={s}/>)).toContain('这趟肯定赶不上了');expect(s.phase).toBe('station');
  s={...s,remaining:180+f.fastest+20};expect(raceForecast(s)!.status).toBe('tight');
 });
 it('handles a finished leg and pending split without treating a shop shortcut as normal full-distance travel',()=>{
  let s=station('shanghai');s={...s,stationBeat:s.stationJourney.findIndex(b=>b.id==='sh-corridor')};
  s=reducer(s,{type:'MAP_ENABLE',manual:true});s={...s,stationMap:{...s.stationMap!,position:mapTaskPoint(s)},stationProgress:1,event:journeyPrompt(s)};
  const before=fastestRemainingSeconds(s)!;
  for(const choice of s.event!.choices){const next=reducer(s,{type:'CHOICE',choice});expect(fastestRemainingSeconds(next)!+choice.seconds).toBeGreaterThanOrEqual(before-.1);}
 });
 it.each(roles)('%s speed bound includes all possible boosts',role=>{
  const s=station('wuhan',role),cap=maximumTravelFactor(s);
  for(const energy of [0,20,60,100])for(const load of [0,35,100]){
   const n={...s,remaining:200,student:s.student?{...s.student,stats:{...s.student.stats,agility:100,load},stamina:energy,exhausted:false,late:true}:undefined,characterTime:s.characterTime?{...s.characterTime,energy,maxEnergy:100,fatigue:0,load,exhausted:false}:undefined,parent:s.parent?{...s.parent,energy,maxEnergy:100,load,syncRemaining:12}:undefined};
   expect(n.parent?parentMovementFactor(n.parent,true):characterMovementFactor(n,true)).toBeLessThanOrEqual(cap+1e-8);
  }
 });
 it('all 24 successful map scenarios finish at least 12 operations and never receive a false impossibility warning',()=>{
  for(const st of STATIONS)for(const character of roles){
   const samples:{bound:number;remaining:number;gatePassed:boolean}[]=[];let lastKey='';
   const end=simulateBalance({city:st.id,character,reading:5,onState:s=>{
    if(s.phase!=='station')return;
    const key=[s.stationBeat,s.event?.id,s.stationMap?.block?.mode,Math.floor(s.elapsed/5)].join(':');if(key===lastKey)return;lastKey=key;
    const bound=fastestRemainingSeconds(s)!;
    samples.push({bound,remaining:s.remaining,gatePassed:s.gatePassed});
   }});
   expect(end.success,`${st.id}/${character}`).toBe(true);
   expect(end.metrics.operations.length,`${st.id}/${character}`).toBeGreaterThanOrEqual(12);
   for(const sample of samples){
    const spent=sample.remaining-(sample.gatePassed?end.remaining:end.gateRemaining+180);
    expect(sample.bound,`${st.id}/${character}: optimistic bound <= actual future time`).toBeLessThanOrEqual(spent+.01);
    expect(sample.bound).toBeLessThan(sample.remaining-(sample.gatePassed?0:180));
   }
  }
 },30000);
});
