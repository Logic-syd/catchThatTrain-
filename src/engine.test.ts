const createShanghaiRun=(hard=false,rng=Math.random)=>createRun('shanghai','student',hard,true,rng);
// Legacy engine regression fixtures; student chapter has its own integration tests.
import {describe,it,expect,vi} from 'vitest';
import {cities,characters,events} from './data';
import {stationPrompt,identityPrompt,createStationPlan} from './flow';
import {planMetroIncident,metroIncidentCheckpoint,transferStopIndex} from './metroFlow';
import {createRun,reducer,routeSeconds,TIME_SCALE,METRO_SECONDS,STOP_BEFORE,DOOR_SECONDS,projectedTime,formatTime,saveRecord,readRecords,type Run} from './engine';
function started(){const s=createShanghaiRun(false,()=>.9);return reducer(reducer(s,{type:'START'}),{type:'ROUTE',route:s.city.spawnStations[0].routes[0]});}
function ride(){return reducer(started(),{type:'DIRECTION',correct:true});}
function travel(s:Run){
 let ticks=0;
 while(ticks<1000){
  if(s.phase==='arrival'){
   if(s.metroStopIndex===s.route!.stops.length-1)return {run:s,ticks};
   s=reducer(s,{type:s.metroStopIndex===transferStopIndex(s.route!)?'ALIGHT':'CONTINUE_METRO'});
  }else if(s.phase==='metro'){s=reducer(s,{type:'TICK',dt:.05});ticks++;}
  else if(s.phase==='transfer')s=reducer(s,{type:'TICK',dt:1.2});
  else throw Error('Unexpected travel phase '+s.phase);
  if(s.event)throw Error('Use an incident-free run for travel helper');
 }
 throw Error('Journey did not reach destination');
}
describe('retained configuration and focused Shanghai flow',()=>{
 it('keeps all original city and character configs',()=>{expect(cities).toHaveLength(6);expect(characters).toHaveLength(5);expect(events).toHaveLength(48);for(const c of cities){expect(c.spawnStations).toHaveLength(3);for(const s of c.spawnStations)expect(s.routes.length).toBeGreaterThanOrEqual(2);}});
 it('starts Shanghai student at East Nanjing Road every time',()=>{for(let i=0;i<30;i++){const s=createShanghaiRun();expect(s.city.id).toBe('shanghai');expect(s.character.id).toBe('student');expect(s.city.spawnStations[s.spawn].name).toBe('南京东路');}});
 it('shows a few minutes after metro instead of an hour',()=>{const forecast=projectedTime(createShanghaiRun());expect(forecast).toBeGreaterThan(6*60);expect(forecast).toBeLessThan(10*60);});
 it('hard mode reduces the station budget',()=>{expect(projectedTime(createShanghaiRun(true))).toBeLessThan(projectedTime(createShanghaiRun()));});
 it('all route and character combinations start with an achievable fastest route',()=>{for(const city of cities)for(const ch of characters){const s=createRun(city.id,ch.id);const best=Math.min(...city.spawnStations[s.spawn].routes.map(r=>routeSeconds(r,ch)));expect(s.initial-STOP_BEFORE-best).toBeGreaterThan(400);}});
 it('different route travel costs produce different arrival budgets',()=>{const s=createShanghaiRun();const forecasts=s.city.spawnStations[0].routes.map(r=>projectedTime(s,r));expect(new Set(forecasts).size).toBeGreaterThan(1);});
});
describe('compressed metro accounting',()=>{
 it('keeps the travel cost and seven moving seconds across all stops',()=>{const s=ride();const result=travel(s);expect(result.run.metroStopIndex).toBe(s.route!.stops.length-1);expect(result.ticks*.05).toBeCloseTo(METRO_SECONDS,1);expect(s.remaining-result.run.remaining).toBeCloseTo(s.metroDuration,0);});
 it('first stop arrives quickly and a route-specific station decision is required',()=>{const s=reducer(ride(),{type:'TICK',dt:1.75});expect(s.phase).toBe('arrival');expect(s.metroStopIndex).toBe(1);expect(s.route!.stops[s.metroStopIndex]).toBe('人民广场');});
 it('does not double-charge elapsed montage seconds',()=>{const s=ride();const n=reducer(s,{type:'TICK',dt:.5});expect(s.remaining-n.remaining).toBeCloseTo(s.metroDuration/METRO_SECONDS*.5,5);expect(projectedTime(n)).toBeCloseTo(projectedTime(s),5);});
 it('reserves station time after all metro stops',()=>{expect(travel(ride()).run.remaining-STOP_BEFORE).toBeGreaterThan(400);});
 it('ticks down while a prompt is open but holds the train',()=>{const s={...ride(),event:stationPrompt('couple')!};const n=reducer(s,{type:'TICK',dt:1});expect(n.metroProgress).toBe(s.metroProgress);expect(n.remaining).toBe(s.remaining-1);});
 it('ordinary micro tasks keep waiting without an extra reading penalty',()=>{const s={...ride(),event:stationPrompt('couple')!};const n=reducer(s,{type:'TICK',dt:6});expect(n.event).toBe(s.event);expect(n.phase).toBe('metro');expect(n.remaining).toBe(s.remaining-6);expect(n.logs).toEqual(s.logs);});
 it('no longer forces extra tasks on transfer routes',()=>{let s={...ride(),route:cities[0].spawnStations[0].routes[2]};s=reducer(s,{type:'TICK',dt:7}) as typeof s;expect(s.phase).toBe('arrival');expect(s.event).toBeNull();});
 it('wrong direction returns after 2.5 real seconds and deducts 75 game seconds',()=>{const s=reducer(started(),{type:'DIRECTION',correct:false});const n=reducer(s,{type:'TICK',dt:2.5});expect(n.phase).toBe('direction');expect(n.remaining).toBe(s.remaining-2.5-75);});
 it('missed final doors allow recovery without charging the route twice',()=>{const s={...travel(ride()).run,remaining:700};const n=reducer(s,{type:'TICK',dt:DOOR_SECONDS});expect(n.phase).toBe('metro-recovery');expect(n.metroMisses).toBe(1);expect(n.remaining).toBe(700-DOOR_SECONDS-80);const p=reducer(n,{type:'TICK',dt:2});expect(p.remaining).toBe(n.remaining-2);expect(p.phase).toBe('arrival');expect(p.metroProgress).toBe(1);expect(reducer(p,{type:'ALIGHT'}).phase).toBe('station');});
});
describe('station incidents and deadlines',()=>{
 it('lobby does not count down',()=>{const s=createShanghaiRun();expect(reducer(s,{type:'TICK',dt:100})).toBe(s);});
 it('route decisions cost station budget',()=>{const s=reducer(createShanghaiRun(),{type:'START'});expect(projectedTime(reducer(s,{type:'TICK',dt:3}))).toBe(projectedTime(s)-3);});
 it('penalties can close boarding immediately, without a timer race',()=>{const s={...ride(),remaining:STOP_BEFORE+20,event:stationPrompt('couple')!};const n=reducer(s,{type:'CHOICE',choice:{label:'',detail:'',seconds:25}});expect(n.phase).toBe('result');expect(n.success).toBe(false);});
 it('does not skip station checkpoints with a premature gate or win action',()=>{const s={...ride(),phase:'station' as const,stage:0};expect(reducer(s,{type:'GATE'}).gatePassed).toBe(false);expect(reducer(s,{type:'WIN'}).phase).toBe('station');});
 it('extreme success measures gate time, not time when boarding the train',()=>{let s={...ride(),phase:'station' as const,stage:4,identityReady:true,remaining:200};s=reducer(s,{type:'GATE'}) as typeof s;expect(s.gateRemaining).toBe(20);const n=reducer(s,{type:'TICK',dt:10});expect(n.phase).toBe('station');expect(n.gateRemaining).toBe(20);expect(reducer(n,{type:'WIN'}).success).toBe(true);});
 it('passing gate at the cutoff fails',()=>{const s={...ride(),phase:'station' as const,stage:4,remaining:180};expect(reducer(s,{type:'GATE'}).phase).toBe('result');});
 it('a train can depart after checking in',()=>{const s={...ride(),phase:'station' as const,gatePassed:true,remaining:1};expect(reducer(s,{type:'TICK',dt:1}).success).toBe(false);});
 it('a hidden tab is charged for actual elapsed time',()=>{const s=started();expect(reducer(s,{type:'TICK',dt:s.remaining}).phase).toBe('result');});
 it('known station incidents only trigger once and choices matter',()=>{let s:Run={...ride(),phase:'station'};s=reducer(s,{type:'STATION_EVENT',id:'exit-closed'});expect(s.event?.id).toBe('exit-closed');s=reducer(s,{type:'CHOICE',choice:s.event!.choices[0]});expect(s.seen).toContain('exit-closed');expect(reducer(s,{type:'STATION_EVENT',id:'exit-closed'}).event).toBeNull();});
 it('normal mode never gets an old ticket, hard mode can',()=>{expect(stationPrompt('old-ticket')).toBeUndefined();expect(stationPrompt('old-ticket',true)?.id).toBe('old-ticket');});
 it('eight queues all lead to 12A and vary between rounds',()=>{const results=new Set<string>();for(let i=0;i<20;i++){const e=stationPrompt('gates')!;expect(e.choices).toHaveLength(8);expect(new Set(e.choices.map(c=>c.lane)).size).toBe(8);expect(Math.min(...e.choices.map(c=>c.seconds))).toBe(4);results.add(e.choices.map(c=>c.seconds).join(','));}expect(results.size).toBeGreaterThan(1);});
 it('gate lane selection is retained for actual map navigation',()=>{const e=stationPrompt('gates')!;const s={...ride(),phase:'station' as const,stage:4,event:e};const n=reducer(s,{type:'CHOICE',choice:e.choices[5]});expect(n.stationLane).toBe(5);expect(n.seen).toContain('gates');});
 it('ordinary station reading does not expire or release the obstacle',()=>{const e=stationPrompt('security')!;const s={...ride(),phase:'station' as const,event:e,remaining:700};const n=reducer(s,{type:'TICK',dt:8});expect(n.event).toBe(e);expect(n.remaining).toBe(700-8);expect(n.phase).toBe('station');});
});
describe('records',()=>{
 it('safe formatting for zero and negative times',()=>{expect(formatTime(-30)).toBe('00:00');expect(formatTime(61)).toBe('01:01');});
 it('deduplicates and caps records',()=>{const data=new Map();vi.stubGlobal('localStorage',{getItem:(k:string)=>data.get(k),setItem:(k:string,v:string)=>data.set(k,v)});const s={...started(),success:true};saveRecord(s);saveRecord(s);expect(readRecords()).toHaveLength(1);for(let i=0;i<40;i++)saveRecord({...s,id:String(i)});expect(readRecords()).toHaveLength(30);vi.unstubAllGlobals();});
 it('blocked storage does not prevent play',()=>{vi.stubGlobal('localStorage',{getItem:()=>{throw Error('blocked');},setItem:()=>{throw Error('blocked');}});expect(readRecords()).toEqual([]);expect(()=>saveRecord(started())).not.toThrow();vi.unstubAllGlobals();});
});


describe('identity search: once per journey, two pictures',()=>{
 function identity(early=true):Run {return {...ride(),identityEarly:early,metroIncident:early?identityPrompt('metro'):null};}
 it('occasionally opens on the metro, never every run',()=>{
  const branches=new Set(Array.from({length:80},()=>createShanghaiRun().identityEarly));expect(branches.size).toBe(2);
  const early=reducer(identity(),{type:'TICK',dt:3});expect(early.event?.id).toBe('identity-search');
  const late=reducer(identity(false),{type:'TICK',dt:3});expect(late.event).toBeNull();
 });
 it('shuffles exactly eighteen objects and six wallet items once at creation',()=>{
  const runs=Array.from({length:10},()=>createShanghaiRun());
  for(const r of runs){expect(r.identityItems).toHaveLength(18);expect(new Set(r.identityItems).size).toBe(18);expect(r.identityItems).toContain('wallet');expect(r.identityCards).toHaveLength(6);expect(r.identityCards).toContain('id');}
  expect(new Set(runs.map(r=>r.identityItems.join(','))).size).toBeGreaterThan(1);
 });
 it('requires wallet first, then ID; errors cost time but keep the picture open',()=>{
  let s=reducer(identity(),{type:'TICK',dt:3});const remaining=s.remaining;
  s=reducer(s,{type:'ID_PICK',item:'phone'});expect(s.remaining).toBe(remaining-5);expect(s.identityStage).toBe('wallet');expect(s.event).not.toBeNull();
  s=reducer(s,{type:'ID_PICK',item:'wallet'});expect(s.identityStage).toBe('card');expect(s.eventElapsed).toBe(0);expect(s.identityReady).toBe(false);
  s=reducer(s,{type:'ID_PICK',item:'id'});expect(s.identityReady).toBe(true);expect(s.event).toBeNull();
  expect(reducer(s,{type:'ID_PICK',item:'id'})).toBe(s);
  expect(reducer({...s,phase:'station'},{type:'STATION_EVENT',id:'identity-search'}).event).toBeNull();
 });
 it('cannot skip pictures through an ordinary choice',()=>{
  const s={...identity(),event:identityPrompt('metro')};expect(reducer(s,{type:'CHOICE',choice:{label:'',detail:'',seconds:0}})).toBe(s);
 });
 it('waiting in identity search neither finds the card nor adds a fixed penalty',()=>{
  const base={...identity(),event:identityPrompt('metro')};
  const waited=reducer(base,{type:'TICK',dt:14});
  expect(waited.identityStage).toBe('wallet');expect(waited.identityReady).toBe(false);
  expect(waited.remaining).toBe(base.remaining-14);expect(waited.logs).toEqual(base.logs);
  const wallet=reducer(waited,{type:'ID_PICK',item:'wallet'});
  const n=reducer(wallet,{type:'ID_PICK',item:'id'});
  expect(n.identityReady).toBe(true);expect(n.event).toBeNull();
  expect(reducer({...n,phase:'station'},{type:'STATION_EVENT',id:'identity-search'}).event).toBeNull();
 });
 it('does not allow checking in without ID',()=>{
  const s={...identity(false),phase:'station' as const,stage:4};expect(reducer(s,{type:'GATE'}).gatePassed).toBe(false);
 });
 it('clears identity and incidents on replay',()=>{
  const old={...identity(),identityReady:true,seen:['identity-search']};const fresh=createShanghaiRun();
  const n=reducer(old,{type:'NEW',run:fresh});expect(n.identityReady).toBe(false);expect(n.seen).toEqual([]);
 });
});
describe('random station encounters',()=>{
 it('samples stable plans with two to four incidents and no repeats',()=>{
  const plans=Array.from({length:80},()=>createStationPlan());expect(new Set(plans.map(p=>p.map(e=>e.id).join(','))).size).toBeGreaterThan(5);
  for(const p of plans){expect(p.length).toBeGreaterThanOrEqual(2);expect(p.length).toBeLessThanOrEqual(4);expect(new Set(p.map(e=>e.id)).size).toBe(p.length);expect(p.some(e=>e.id==='old-ticket')).toBe(false);}
 });
 it('hard mode can include or skip the wrong-date incident',()=>{
  const plans=Array.from({length:100},()=>createStationPlan(true));expect(plans.some(p=>p.some(e=>e.id==='old-ticket'))).toBe(true);expect(plans.some(p=>!p.some(e=>e.id==='old-ticket'))).toBe(true);
 });
 it('route decisions change the next physical destination',()=>{
  const e=stationPrompt('broken-lift')!;const s={...ride(),phase:'station' as const,event:e};
  const left=reducer(s,{type:'CHOICE',choice:e.choices[0]});const right=reducer(s,{type:'CHOICE',choice:e.choices[1]});
  expect(left.detour?.x).toBe(130);expect(right.detour?.x).toBe(485);expect(reducer(left,{type:'DETOUR_DONE'}).detour).toBeNull();
 });
});


describe('route-linked metro decisions',()=>{
 it('uses exactly a 30% boundary, with no reroll on stops or ticks',()=>{
  const route=cities[0].spawnStations[0].routes[0];
  for(const roll of [0,.1,.299999])expect(planMetroIncident(route,roll,.5)).not.toBeNull();
  for(const roll of [.3,.5,.999999])expect(planMetroIncident(route,roll,.5)).toBeNull();
  expect(Array.from({length:1000},(_,i)=>planMetroIncident(route,i/1000,.5)).filter(Boolean)).toHaveLength(300);
  let s={...ride(),metroIncident:planMetroIncident(route,.1,.5)};
  s=reducer(s,{type:'TICK',dt:1}) as typeof s;expect(s.event?.id).toBe('metro-crowded-door');
  s=reducer(s,{type:'CHOICE',choice:s.event!.choices[0]}) as typeof s;
  const end=travel(s).run;expect(end.seen.filter(x=>x==='metro-crowded-door')).toHaveLength(1);
 });
 it('choosing a route installs its incident once and changes its stop sequence',()=>{
  const fresh={...createShanghaiRun(),phase:'route' as const,metroIncidentRoll:.1,metroIncidentVariant:.9};
  const direct=reducer(fresh,{type:'ROUTE',route:fresh.city.spawnStations[0].routes[0]});
  const transfer=reducer(fresh,{type:'ROUTE',route:fresh.city.spawnStations[0].routes[2]});
  expect(direct.metroIncident?.id).toBe('metro-announcement');expect(transfer.metroIncident?.id).toBe('metro-transfer-sign');
  expect(direct.route!.stops).not.toEqual(transfer.route!.stops);
  expect(reducer(direct,{type:'ROUTE',route:transfer.route!})).toBe(direct);
 });
 it('all three routes reach the station; transfers actually change lines',()=>{
  for(const route of cities[0].spawnStations[0].routes){
   const selected=reducer({...createShanghaiRun(false,()=>.9),phase:'route'},{type:'ROUTE',route});
   const last=travel(reducer(selected,{type:'DIRECTION',correct:true})).run;
   expect(last.metroTransferred).toBe(!!route.transfers);
   expect(reducer(last,{type:'ALIGHT'}).phase).toBe('station');
  }
 });
 it('early alighting costs time and resumes from the same stop, never skips to the station',()=>{
  const s=reducer(ride(),{type:'TICK',dt:1.75});
  const early=reducer(s,{type:'ALIGHT'});expect(early.phase).toBe('metro-recovery');expect(early.remaining).toBe(s.remaining-60);
  const back=reducer(early,{type:'TICK',dt:2});expect(back.phase).toBe('metro');expect(back.metroProgress).toBe(s.metroProgress);
  const next=reducer(back,{type:'TICK',dt:1.75});expect(next.metroStopIndex).toBe(2);
 });
 it('ordinary stop timeouts mean stay aboard; remaining-travel forecast stays consistent',()=>{
  const s=reducer(ride(),{type:'TICK',dt:1.75});expect(projectedTime(s)).toBeCloseTo(projectedTime(ride()));
  const n=reducer(s,{type:'TICK',dt:DOOR_SECONDS});expect(n.phase).toBe('metro');expect(n.logs).toEqual([]);
  expect(projectedTime(n)).toBeCloseTo(projectedTime(s)-DOOR_SECONDS);
 });
 it('missing the transfer returns to that stop and lets the player transfer',()=>{
  const route=cities[0].spawnStations[0].routes[2];
  const s:Run={...ride(),route,phase:'arrival',metroStopIndex:2,metroProgress:2/3};
  for(const action of [{type:'CONTINUE_METRO'} as const,{type:'TICK',dt:4} as const]){
   const missed=reducer(s,action);expect(missed.phase).toBe('metro-recovery');expect(missed.metroTransferred).toBe(false);
   const back=reducer(missed,{type:'TICK',dt:2});expect(back.phase).toBe('arrival');expect(back.metroStopIndex).toBe(2);
   const transfer=reducer(back,{type:'ALIGHT'});expect(transfer.phase).toBe('transfer');expect(transfer.metroTransferred).toBe(true);
   expect(reducer(transfer,{type:'ALIGHT'})).toBe(transfer);
   const rideAgain=reducer(transfer,{type:'TICK',dt:1.2});expect(rideAgain.phase).toBe('metro');expect(rideAgain.metroProgress).toBe(2/3);
  }
 });
 it('explicitly staying aboard at the destination triggers the same recoverable miss',()=>{
  const s=travel(ride()).run;const n=reducer(s,{type:'CONTINUE_METRO'});
  expect(n.phase).toBe('metro-recovery');expect(n.remaining).toBe(s.remaining-80);
  expect(reducer({...s,remaining:STOP_BEFORE+70},{type:'CONTINUE_METRO'}).phase).toBe('result');
 });
 it('timeouts clear the optional incident and do not cause a second one',()=>{
  const incident=planMetroIncident(ride().route!,.1,.9)!;
  const base=ride(),at=metroIncidentCheckpoint(base.route!,incident);
  const s=reducer({...base,metroIncident:incident,metroProgress:at-.01,metroStopIndex:base.route!.stops.length-2},{type:'TICK',dt:.1});
  const n=reducer(s,{type:'TICK',dt:7});expect(n.event).toBeNull();expect(n.seen).toContain(incident.id);
  expect(travel(n).run.seen.filter(id=>id===incident.id)).toHaveLength(1);
 });
});
