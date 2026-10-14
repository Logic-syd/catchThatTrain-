import {describe,it,expect,vi,afterEach} from 'vitest';
import {createStationRun,reducer,journeyRouteSeconds,STOP_BEFORE,type Run,saveRecord,readRecords} from './engine';
import {STATIONS,stationChallenge} from './stations';
import {buildStationJourney,journeyPrompt} from './stationJourney';
import {runnerWave} from './runner';
import {summarizeRun,targetDistance} from './outcomes';
import {awardRun,freshProgress,persistRun,readProgress,ACHIEVEMENTS} from './achievements';
import {eventHoldSeconds} from './eventTiming';
import {focusWindow} from './studentConfig';
function rng(seed:number){return ()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
function tick(s:Run,n:number,eventId?:string){while(n>1e-8&&s.phase!=='result'&&(!eventId||s.event?.id===eventId)){const dt=Math.min(.1,n);s=reducer(s,{type:'TICK',dt});n-=dt;}return s;}
function at(city:string,id:string){let s=createStationRun(city);s={...s,phase:'station',remaining:1200,stationJourney:buildStationJourney(s)};s.stationBeat=s.stationJourney.findIndex(b=>b.id===id);s.event=journeyPrompt(s);return s;}
function choose(s:Run,index=0){return reducer(s,{type:'CHOICE',choice:s.event!.choices[index]});}
function win(city='shanghai'){return {...createStationRun(city),phase:'result' as const,success:true,gatePassed:true,gateRemaining:60,identityReady:true};}
afterEach(()=>vi.unstubAllGlobals());
describe('six actual station chapters',()=>{
 it('has six distinct layouts, node topology, beat sequences and palettes',()=>{
  expect(new Set(STATIONS.map(s=>JSON.stringify(s.nodes))).size).toBe(6);
  expect(new Set(STATIONS.map(s=>s.accent)).size).toBe(6);
  expect(new Set(STATIONS.map(st=>buildStationJourney(createStationRun(st.id)).map(b=>b.id).join(','))).size).toBe(6);
  for(const st of STATIONS)for(const [a,b] of st.edges){expect(st.nodes.some(n=>n.id===a)).toBe(true);expect(st.nodes.some(n=>n.id===b)).toBe(true);}
 });
 it('Guangzhou outer bridge skips elevator; central route is shorter with more obstacles',()=>{
  const s=at('guangzhou','gz-route');const outer=choose(s,0),center=choose(s,1);
  expect(outer.stationJourney.some(b=>b.id==='gz-lift')).toBe(false);expect(center.stationJourney.some(b=>b.id==='gz-lift')).toBe(true);
  expect(outer.stationJourney[outer.stationBeat].seconds).toBeGreaterThan(center.stationJourney[center.stationBeat].seconds);
  expect(outer.stationDecisions[0].density).toBe(1);expect(center.stationDecisions[0].density).toBe(3);
 });
 it('wrong Zhengzhou number does not open the gate or finish the challenge',()=>{
  let s=at('zhengzhou','zz-number');const beat=s.stationBeat;s=choose(s,0);expect(s.event?.id).toBe('zz-number');expect(s.stationBeat).toBe(beat);expect(s.student!.wrongTurns).toBe(1);expect(s.gatePassed).toBe(false);
  s=choose(s,2);expect(s.event).toBeNull();expect(s.stationBeat).toBe(beat+1);
 });
 it('Wuhan floor choice and stair/elevator resource costs are meaningful',()=>{
  const wrong=choose(at('wuhan','wh-floor'),1);expect(wrong.remaining).toBe(1150);expect(wrong.stationDecisions[0].optimal).toBe(false);
  const stairs=choose(at('wuhan','vertical-choice'),1);expect(stairs.stationJourney.some(b=>b.id==='escalator-choice')).toBe(false);expect(stairs.student!.vertical).toBe('stairs');expect(stairs.stationDecisions[0].value).toBe('stairs');
 });
 it('all routes finish or reach their deadline, while the skilled fast route clears with paced sprinting and actual input costs',()=>{
  let slowerRouteLosses=0;
  for(const st of STATIONS)for(let routeIndex=0;routeIndex<createStationRun(st.id).city.spawnStations[0].routes.length;routeIndex++){
   let s=reducer(createStationRun(st.id,false,rng(921+routeIndex)),{type:'START'});
   const initialBudget=s.initial;
   let recovering=false,waveKey='',waveVisibleAt=0;
   for(const option of ['skip','check','eat']){s=tick(s,1.2+.18);s=reducer(s,{type:'PREP_PICK',option,step:s.student!.prep});}
   const fastest=s.city.spawnStations[0].routes.reduce((best,route)=>journeyRouteSeconds(s,route)<journeyRouteSeconds(s,best)?route:best);
   s=tick(s,1.2+.18);s=reducer(s,{type:'ROUTE',route:s.city.spawnStations[0].routes[routeIndex]});
   s=tick(s,1.2+.18);s=reducer(s,{type:'DIRECTION',correct:true});
   for(let i=0;i<9000&&s.phase!=='result';i++){
    if(s.event){
     const id=s.event.id;s=tick(s,1.2,id);if(s.phase==='result'||s.event?.id!==id)continue;
     if(id==='identity-search'){
      expect(s.student!.checkedID).toBe(true);
      s=tick(s,.18+.65/focusWindow(s.student!.stats.focus),id);
      if(s.event?.id===id)s=reducer(s,{type:'POCKET_PICK',pocket:0});
      continue;
     }
     if(id==='security-queue'&&!s.student!.observed&&s.student!.stats.focus<75){
      s=tick(s,2.5/focusWindow(s.student!.stats.focus),id);
      if(s.event?.id===id)s=reducer(s,{type:'OBSERVE'});
     }
     if(s.phase==='result'||s.event?.id!==id)continue;
     const e=s.event;let index=0;
     if(e.choices.some(c=>c.id==='leave')&&e.id.startsWith('student-'))index=e.choices.findIndex(c=>c.id==='leave');
     if(id==='vertical-choice')index=e.choices.findIndex(c=>c.label.includes('楼梯'));
     if(id==='security-queue')index=e.choices.findIndex(c=>/轻装|推进快|推进很快/.test(c.detail));
     if(id==='gates')index=e.choices.reduce((best,c,i)=>c.seconds<e.choices[best].seconds?i:best,0);
     if(id==='zz-number')index=e.choices.findIndex(c=>c.label===s.gate);
     expect(index,st.id+' visible choice '+id).toBeGreaterThanOrEqual(0);
     const operation=e.interaction?.kind==='hold'?eventHoldSeconds(s,e):e.interaction?.kind==='tap'?(e.interaction.required??5)*.18:e.interaction?.kind==='swipe'?.55:.18;
     s=tick(s,operation,id);if(s.event?.id===id)s=choose(s,index);
    }else if(s.phase==='arrival'){
     s=tick(s,.6+.18);
     if(s.phase==='arrival'&&!s.event)s=reducer(s,{type:s.metroStopIndex===s.route!.stops.length-1||(!s.metroTransferred&&s.route!.stops[s.metroStopIndex]===s.route!.via)?'ALIGHT':'CONTINUE_METRO'});
    }else if(s.phase==='station'){
     const r=s.student!.runner,w=runnerWave(s);
     if(r.blocked){s=tick(s,.5);if(s.phase==='station'&&!s.event)s=reducer(s,{type:'CHANGE_LANE',direction:r.lane===2?-1:1});continue;}
     if(w){const key=s.stationBeat+':'+r.wave;if(key!==waveKey){waveKey=key;waveVisibleAt=s.elapsed;}if(w.lane===r.lane&&s.elapsed-waveVisibleAt>=.25)s=reducer(s,{type:'CHANGE_LANE',direction:r.lane===2?-1:1});}
     if(!s.stationRunning)s=reducer(s,{type:'RUN_INPUT',held:true});
     const u=s.student!;if(u.sprintStrain>=4)recovering=true;else if(u.sprintStrain<=1)recovering=false;
     const sprint=!recovering&&(u.sprinting?u.stamina>u.stats.energy*.3:u.stamina>=u.stats.energy*.7);
     if(sprint!==u.sprinting)s=reducer(s,{type:'SPRINT_INPUT',held:sprint});
     s=tick(s,.1);
    }
    else{s=reducer(s,{type:'PREPARE_DOOR'});s=tick(s,.1);}
   }
   const context=st.id+' route '+routeIndex+' '+JSON.stringify({initial:initialBudget,remaining:s.remaining,routeSeconds:journeyRouteSeconds(s,s.route!),metroStop:s.metroStopIndex,metroProgress:s.metroProgress,endEvent:s.endEventId});
   // Keep traversing after a failure so every original route remains covered.
   expect.soft(s.phase,context+' completed without getting stuck').toBe('result');
   expect.soft(s.initial,context+' original budget').toBe(initialBudget);
   const u=s.student!,accounted=Object.values(u.clockSpent).reduce((sum,seconds)=>sum+seconds,0)+u.decisionLoss+u.environmentLoss;
   expect.soft(accounted,context+' clock ledger').toBeCloseTo(initialBudget-s.remaining,5);
   if(s.route!.id===fastest.id){
    expect.soft(u.stationStart,context+' fast route reached station').toBeGreaterThan(0);
    expect.soft(s.success,context+' fast route').toBe(true);
   }else{
    // A slower metro route can use up the real budget before reaching the station.
    expect.soft(u.stationStart>0||(!s.success&&s.remaining<=STOP_BEFORE&&s.metroProgress>0),context+' reached station or legitimately missed the deadline in transit').toBe(true);
    if(!s.success)slowerRouteLosses++;
   }
   expect.soft(s.gate,context).toBe(st.gate);expect.soft(s.metroTransferred,context).toBe(!!s.route!.transfers);
   const o=summarizeRun(s);expect.soft(o.stationPlaystyle,context).toBe(st.playstyle);expect.soft(o.reasons.length,context).toBeGreaterThanOrEqual(2);expect.soft(o.tags.length,context).toBeLessThanOrEqual(3);
  }
  expect(slowerRouteLosses).toBeGreaterThan(0);
 });
});
describe('evidence based awards and outcomes',()=>{
 it('V1.1 uses 3/10/30 second title boundaries',()=>{
  expect(summarizeRun({...win(),gateRemaining:2}).title).toBe('最后一秒选手');
  expect(summarizeRun({...win(),gateRemaining:10}).title).toBe('压哨上车王');
  expect(summarizeRun({...win(),gateRemaining:15}).title).toBe('心脏还好吗');
 });
 it('uses recorded impacts, not a made-up benefit for checking ID',()=>{
  const s=win();s.student={...s.student!,checkedID:true};const o=summarizeRun(s);
  expect(o.factors).toHaveLength(0);expect(o.result.timeImpacts.some(i=>i.deltaSeconds===28)).toBe(false);
  expect(o.reasons).toHaveLength(2);expect(summarizeRun(s)).toEqual(o);
 });
 it('distance estimates use remaining segments, not the legacy fixed counter',()=>{
  let s=at('hangzhou','gate-scan');s.stationProgress=.99;expect(targetDistance(s)).toBeLessThanOrEqual(10);expect(targetDistance(createStationRun())).toBeNull();
 });
 it('awards are deduplicated, streaks reset, and six stations unlock cumulatively',()=>{
  let p=freshProgress();const s=win();p=awardRun(p,s);expect(awardRun(p,s)).toBe(p);
  p=awardRun(p,win());p=awardRun(p,win());expect(p.unlocked['three-wins']).toBeDefined();
  p=awardRun(p,{...win(),success:false});expect(p.streak).toBe(0);expect(p.clutchStreak).toBe(0);
  for(const st of STATIONS)p=awardRun(p,win(st.id));expect(p.unlocked['six-stations']).toBeDefined();
  let clutch=freshProgress();for(let i=0;i<3;i++)clutch=awardRun(clutch,{...win(),gateRemaining:10});expect(clutch.unlocked['clutch-pro']).toBeDefined();
 });
 it('save/read survives reload and storage rejection is honest',()=>{
  const memory=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(k:string)=>memory.get(k)??null,setItem:(k:string,v:string)=>memory.set(k,v)});
  const s=win();const a=persistRun(s);expect(a.saved).toBe(true);expect(readProgress().wins).toBe(1);expect(persistRun(s).progress.wins).toBe(1);
  saveRecord(s);expect(readRecords()[0].title).toBe(summarizeRun(s).title);
  vi.stubGlobal('localStorage',{getItem:()=>'{broken',setItem:()=>{throw Error('blocked');}});expect(readProgress().wins).toBe(0);expect(persistRun(win()).saved).toBe(false);
 });
 it('every achievement advertises its condition and currently playable character',()=>{expect(new Set(ACHIEVEMENTS.map(a=>a.id)).size).toBe(ACHIEVEMENTS.length);expect(ACHIEVEMENTS.every(a=>a.description.length>0)).toBe(true);});
});
