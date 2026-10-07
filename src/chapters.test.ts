import {describe,it,expect,vi,afterEach} from 'vitest';
import {createStationRun,reducer,STOP_BEFORE,type Run,saveRecord,readRecords} from './engine';
import {STATIONS,stationChallenge} from './stations';
import {buildStationJourney,journeyPrompt} from './stationJourney';
import {runnerWave} from './runner';
import {summarizeRun,targetDistance} from './outcomes';
import {awardRun,freshProgress,persistRun,readProgress,ACHIEVEMENTS} from './achievements';
function rng(seed:number){return ()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
function tick(s:Run,n:number){for(let i=0;i<Math.round(n*10)&&s.phase!=='result';i++)s=reducer(s,{type:'TICK',dt:.1});return s;}
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
 it('all routes reach their station, while the careful fast route clears without sprinting',()=>{
  let slowerRouteLosses=0;
  for(const st of STATIONS)for(let routeIndex=0;routeIndex<createStationRun(st.id).city.spawnStations[0].routes.length;routeIndex++){
   let s=reducer(createStationRun(st.id,false,rng(921+routeIndex)),{type:'START'});
   const fastest=s.city.spawnStations[0].routes.reduce((best,route)=>route.minutes*60+route.walk/1.5+route.transfers*20<best.minutes*60+best.walk/1.5+best.transfers*20?route:best);
   for(const option of ['skip','check','eat']){s=tick(s,5);s=reducer(s,{type:'PREP_PICK',option,step:s.student!.prep});}
   s=reducer(s,{type:'ROUTE',route:s.city.spawnStations[0].routes[routeIndex]});s=reducer(s,{type:'DIRECTION',correct:true});
   for(let i=0;i<9000&&s.phase!=='result';i++){
    if(s.event){s=tick(s,5);if(s.phase==='result')break;const e=s.event!;
     if(e.id==='identity-search'){s=reducer(s,{type:'POCKET_PICK',pocket:s.student!.pocket});continue;}
     let index=0;if(e.id==='vertical-choice')index=1;if(e.id==='escalator-choice')index=s.stationLuck.escalators.indexOf('clear');if(e.id==='security-queue'||e.id==='gates')index=e.choices.findIndex(c=>c.seconds===Math.min(...e.choices.map(c=>c.seconds)));if(e.id==='zz-number')index=e.choices.findIndex(c=>c.label===s.gate);
     s=choose(s,index);
    }else if(s.phase==='arrival'){s=reducer(s,{type:s.metroStopIndex===s.route!.stops.length-1||s.route!.stops[s.metroStopIndex]===s.route!.via?'ALIGHT':'CONTINUE_METRO'});}
    else if(s.phase==='station'){const w=runnerWave(s);if(w&&w.lane===s.student!.runner.lane)s=reducer(s,{type:'CHANGE_LANE',direction:w.lane===2?-1:1});s=reducer(s,{type:'RUN_INPUT',held:true});s=tick(s,.1);}
    else{s=reducer(s,{type:'PREPARE_DOOR'});s=tick(s,.1);}
   }
   expect(s.student!.stationStart,st.id+' route '+routeIndex+' reached station').toBeGreaterThan(0);
   if(s.route!.id===fastest.id)expect(s.success,st.id+' fast route '+routeIndex+' '+s.phase+' '+s.event?.id).toBe(true);
   else if(!s.success)slowerRouteLosses++;
   expect(s.gate).toBe(st.gate);expect(s.metroTransferred).toBe(!!s.route!.transfers);
   const o=summarizeRun(s);expect(o.stationPlaystyle).toBe(st.playstyle);expect(o.reasons.length).toBeGreaterThanOrEqual(2);expect(o.tags.length).toBeLessThanOrEqual(3);
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
