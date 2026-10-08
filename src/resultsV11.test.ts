import {describe,it,expect,vi,afterEach} from 'vitest';
import {createStationRun,reducer,type Run} from './engine';
import {buildStationJourney,journeyPrompt} from './stationJourney';
import {createGameResult,analyzeFactors,type GameResult} from './gameResult';
import {selectTitle,TITLE_CONFIGS} from './titles';
import {summarizeRun,resultTags} from './outcomes';
import {ACHIEVEMENTS,awardResult,awardRun,freshProgress,migrateLegacy,readProgress,parseProfile,featuredUnlock,persistRun,PROFILE_KEY} from './achievements';
import {matches} from './achievementConfig';
import type {TimeImpact} from './resultMetrics';
function base(extra:Partial<GameResult>={}):GameResult{return {...createGameResult({...createStationRun(),phase:'result',success:true,gateRemaining:60}),...extra,runId:extra.runId??crypto.randomUUID()};}
const impact=(eventId:string,deltaSeconds:number,extra:Partial<TimeImpact>={}):TimeImpact=>({id:eventId,eventId,source:eventId,deltaSeconds,category:'decision',positive:deltaSeconds>0,avoidable:true,...extra});
function analyzed(r:GameResult){return {...r,timeImpacts:analyzeFactors(r).impacts};}
function at(id:string):Run{let s=createStationRun();s={...s,phase:'station',remaining:1200,stationJourney:buildStationJourney(s)};s.stationBeat=s.stationJourney.findIndex(b=>b.id===id);s.event=journeyPrompt(s);return s;}
afterEach(()=>vi.unstubAllGlobals());
describe('V1.1 causal settlement',()=>{
 it('one deterministic title, priority covers A/B/F/G examples',()=>{
  expect(selectTitle(base()).name).toBe('没有一秒白跑');
  expect(selectTitle(base({resultMarginSeconds:2})).name).toBe('最后一秒选手');
  expect(selectTitle(base({characterId:'mother',resultMarginSeconds:8,characterStats:{wetPants:true}})).name).toBe('车赶上了，裤子没赶上');
  expect(selectTitle(base({resultMarginSeconds:2,dramaScore:105})).name).toBe('这都能赶上？');
  expect(new Set(TITLE_CONFIGS.map(t=>t.id)).size).toBe(TITLE_CONFIGS.length);
 });
 it('cake is decisive with a 50s gap, but cannot alone fix a 240s gap (C/D)',()=>{
  const cake=impact('prepare-cake',-75);const close=analyzed(base({success:false,resultMarginSeconds:-50,timeImpacts:[cake],characterStats:{cake:true}}));
  expect(selectTitle(close).name).toBe('蛋糕护送失败');expect(analyzeFactors(close).advice).toContain('足以赶上');
  const far=analyzed({...close,resultMarginSeconds:-240});expect(selectTitle(far).name).not.toBe('蛋糕护送失败');expect(analyzeFactors(far).advice).toBeUndefined();
 });
 it('never blames random delay or invents a next-run fix (E)',()=>{
  const r=base({success:false,resultMarginSeconds:-60,timeImpacts:[impact('metro-stop',-80,{avoidable:false,category:'environment'})]});
  const a=analyzeFactors(r);expect(a.factors).toHaveLength(1);expect(a.advice).toBeUndefined();expect(selectTitle(analyzed(r)).name).toBe('今天不宜赶车');
 });
 it('smallest sufficient combined set; never labels one small loss a sole cause',()=>{
  const r=base({success:false,resultMarginSeconds:-70,timeImpacts:[impact('security',-41),impact('sprint-resource',-35),impact('prepare-id',-5)]});
  const a=analyzeFactors(r);expect(a.impacts.filter(i=>i.decisive)).toHaveLength(2);expect(a.advice).toContain('单独省一项还不够');expect(a.advice).toContain('76');
 });
 it('success contributions strictly exceed margin to be decisive; zero does not invent a gain',()=>{
  const a=analyzeFactors(base({resultMarginSeconds:7,timeImpacts:[impact('door',12),impact('sprint-late',24),impact('queue',7)]}));
  expect(a.impacts.map(i=>i.decisive)).toEqual([true,true,false]);expect(a.factors).toHaveLength(3);
 });
 it('tags and factors are deduplicated and capped at three',()=>{
  const r=base({errors:0,dramaScore:105,securityGood:true,characterStats:{idFound:true,bagMistakes:0,bagSeconds:2},timeImpacts:[impact('door',12,{tag:'提前靠门'}),impact('queue',8,{tag:'安检选对了'}),impact('sprint-late',25,{tag:'最后冲刺'}),impact('other',10)]});
  const a=analyzeFactors(r),tags=resultTags(r,a.factors);expect(a.factors).toHaveLength(3);expect(tags.length).toBeLessThanOrEqual(3);expect(new Set(tags).size).toBe(tags.length);
 });
 it('failure position and signed margin preserve estimate semantics',()=>{
  const s=at('gate-scan');s.remaining=180;s.stationProgress=.95;const r=createGameResult({...s,phase:'result',success:false});
  expect(r.resultMarginSeconds).toBeLessThan(0);expect(r.marginEstimated).toBe(true);expect(r.position.distanceToGoalMeters).toBeLessThan(10);
 });
 it('missing character signals never unlock optional character conditions',()=>{
  const r=base({characterId:'tourist',resultMarginSeconds:5});const p=awardResult(freshProgress(),r);
  expect(p.unlocked['tourist-low']).toBeUndefined();expect(matches({field:'r.missing',op:'lt',value:10},{r})).toBe(false);
 });
});
describe('event-time telemetry',()=>{
 it('logs choice cost exactly once, with stable positive sign and no invented ID saving',()=>{
  let s=reducer(createStationRun(),{type:'START'});s=reducer(s,{type:'PREP_PICK',option:'take',step:0});s=reducer(s,{type:'PREP_PICK',option:'check',step:1});
  expect(s.metrics.impacts.filter(i=>i.eventId==='prepare-cake').map(i=>i.deltaSeconds)).toEqual([-75]);
  expect(s.metrics.impacts.find(i=>i.eventId==='prepare-id')?.deltaSeconds).toBe(-30);
  expect(s.metrics.impacts.every(i=>i.positive===(i.deltaSeconds>0))).toBe(true);
  const o=summarizeRun({...s,phase:'result',success:true,gateRemaining:60});expect(o.result.timeImpacts.some(i=>i.deltaSeconds===28)).toBe(false);
 });
 it('queue benefit compares actual choices against the explicit same-run median',()=>{
  let s=at('security-queue');const best=s.event!.choices.find(c=>c.seconds===24)!;s=reducer(s,{type:'CHOICE',choice:best});
  const i=s.metrics.impacts.find(i=>i.eventId==='security-queue')!;expect(i.deltaSeconds).toBe(8);expect(i.baseline).toContain('中位数');
 });
 it('counts four pockets, not repeated taps; no negative amounts counted twice',()=>{
  let s=at('identity-search');s.student={...s.student!,pocket:3};for(let p=0;p<3;p++)s=reducer(s,{type:'POCKET_PICK',pocket:p});
  const before=s;s=reducer(s,{type:'POCKET_PICK',pocket:2});expect(s).toBe(before);s=reducer(s,{type:'POCKET_PICK',pocket:3});
  expect(s.metrics.bagAttempts).toBe(4);expect(s.metrics.impacts.reduce((t,i)=>t+i.deltaSeconds,0)).toBe(-15);
 });
 it('operation excess and wait are separately recorded, not added twice',()=>{
  let s=at('identity-search');for(let i=0;i<100;i++)s=reducer(s,{type:'TICK',dt:.1});
  const entries=s.metrics.impacts.filter(i=>i.eventId==='identity-search');expect(entries).toHaveLength(1);expect(entries[0].deltaSeconds).toBeCloseTo(-5);expect(s.metrics.impacts.find(i=>i.id==='idle')).toBeUndefined();
 });
 it('random escalator delay remains uncontrollable while slow decision reading is controllable',()=>{
  let s=at('escalator-ride');s.event={id:'escalator-operation',phase:'station',title:'前方堵住了',description:'',choices:[{label:'等待',detail:'',seconds:30}]};s=reducer(s,{type:'CHOICE',choice:s.event.choices[0]});
  expect(s.metrics.impacts.find(i=>i.eventId==='escalator-operation')?.avoidable).toBe(false);
 });
 it('a single low-margin observation is not a comeback; risk across a completed node is',()=>{
  let s=at('security-queue');s.route=s.city.spawnStations[0].routes[0];s.remaining=220;
  s=reducer(s,{type:'OBSERVE'});expect(s.metrics.wasProjectedToFail).toBe(false);
  s=reducer(s,{type:'CHOICE',choice:s.event!.choices.find(c=>c.seconds===24)!});
  expect(s.phase).not.toBe('result');expect(s.metrics.wasProjectedToFail).toBe(true);
 });
});
describe('persistent achievements and lifecycle',()=>{
 it('serializable catalog; every category and seven hidden entries exist',()=>{
  expect(JSON.parse(JSON.stringify(ACHIEVEMENTS))).toEqual(ACHIEVEMENTS);expect(ACHIEVEMENTS.filter(a=>a.hidden)).toHaveLength(7);
  for(const c of ['general','student','worker','tourist','mother','family','station'])expect(ACHIEVEMENTS.some(a=>a.category===c)).toBe(true);
 });
 it('duplicate settlement does not re-award or increase stats (H)',()=>{
  const r=base();const p=awardResult(freshProgress(),r);expect(awardResult(p,r)).toBe(p);expect(p.totalRuns).toBe(1);expect(p.totalWins).toBe(1);
 });
 it('streaks break on failure, exits do not count; character streaks are independent',()=>{
  let p=freshProgress();for(let i=0;i<4;i++){p=awardResult(p,base({characterStats:{idFound:true,bagMistakes:0}}));p=awardResult(p,base({characterId:'worker',success:false,resultMarginSeconds:-90}));}
  expect(p.achievementProgress['student-bag-five'].current).toBe(4);expect(p.currentWinStreak).toBe(0);expect(awardRun(p,createStationRun())).toBe(p);
  p=awardResult(p,base({characterStats:{idFound:true,bagMistakes:0}}));expect(p.unlocked['student-bag-five']).toBeDefined();
 });
 it('cake requires three wins and cumulative clutch tolerates intervening failure',()=>{
  let p=freshProgress();for(let i=0;i<3;i++){p=awardResult(p,base({resultMarginSeconds:9,characterStats:{cake:true}}));if(i<2){expect(p.unlocked['student-tea-three']).toBeUndefined();p=awardResult(p,base({success:false,resultMarginSeconds:-90}));}}
  expect(p.unlocked['student-tea-three']).toBeDefined();expect(p.unlocked['clutch-pro']).toBeDefined();expect(p.unlocked['three-wins']).toBeUndefined();
 });
 it('station-specific good-route streak and first win after three failures',()=>{
  let p=freshProgress();for(let i=0;i<3;i++)p=awardResult(p,base({success:false,stationId:'wuhan',resultMarginSeconds:-80}));
  p=awardResult(p,base({stationId:'shanghai',routeEfficiency:40}));expect(p.unlocked['map-memory']).toBeDefined();p=awardResult(p,base({stationId:'wuhan'}));expect(p.unlocked.returning).toBeDefined();
 });
 it('risk and character judgment streaks track choices rather than number of runs',()=>{
  let p=awardResult(freshProgress(),base({highRiskResults:[true,true]}));expect(p.achievementProgress.gambler.current).toBe(2);
  p=awardResult(p,base({highRiskResults:[false,true,true,true]}));expect(p.unlocked.gambler).toBeDefined();
  p=awardResult(p,base({characterId:'worker',choiceResults:{judgment:[true,true,true,true,true],accessibility:[],sleep:[]}}));expect(p.unlocked['worker-judgment']).toBeDefined();
 });
 it('all seven hidden achievements have a reachable rule trigger and rarest is featured',()=>{
  const cases:Partial<GameResult>[]=[{resultMarginSeconds:5,errors:1,characterStats:{extraPreparationSeconds:180}},{characterId:'mother',characterStats:{wetPants:true}},{dramaScore:105},{success:false,resultMarginSeconds:-90,dramaScore:105},{success:false,resultMarginSeconds:-50,characterStats:{cake:true},timeImpacts:[impact('prepare-cake',-75)]},{success:false,resultMarginSeconds:-25,timeImpacts:[impact('vertical-choice',-35)]},{success:false,resultMarginSeconds:-1}];
  let p=freshProgress();for(const c of cases)p=awardResult(p,base(c));expect(ACHIEVEMENTS.filter(a=>a.hidden&&p.unlocked[a.id])).toHaveLength(7);expect(featuredUnlock(['first-win','secret-second'])?.id).toBe('secret-second');
 });
 it('old earned badges survive migration without inventing new progress',()=>{
  const p=migrateLegacy({version:1,wins:3,streak:2,completed:['old1','old2','old3'],stationWins:{shanghai:3},unlocked:{'bag-ready':{at:'2026-10-01',runId:'old3'}}});
  expect(p.unlocked['bag-ready']).toBeDefined();expect(p.achievementProgress['student-bag-five'].current).toBe(0);expect(p.totalRuns).toBe(3);expect(parseProfile(JSON.parse(JSON.stringify(p)))).toEqual(p);
 });
 it('malformed profiles sanitize values; storage failures keep in-memory progress',()=>{
  expect(parseProfile({schemaVersion:1,totalRuns:-4,totalWins:'99',processedRunIds:[1,'ok'],unlocked:[],characterStats:{student:{wins:'bad'}}}).totalWins).toBe(0);
  vi.stubGlobal('localStorage',{getItem:()=>null,setItem:()=>{throw Error('blocked');}});
  const s={...createStationRun(),phase:'result' as const,success:true,gateRemaining:60};const p=persistRun(s);expect(p.saved).toBe(false);expect(persistRun(s,p.progress).progress.totalRuns).toBe(1);
 });
 it('reload migration is saved under v1 key; processed IDs remain bounded',()=>{
  const store=new Map([['catch-train-achievements-v1',JSON.stringify({version:1,wins:1,completed:['old'],unlocked:{},stationWins:{}})]]);vi.stubGlobal('localStorage',{getItem:(k:string)=>store.get(k)??null,setItem:(k:string,v:string)=>store.set(k,v)});
  expect(readProgress().totalWins).toBe(1);expect(store.has(PROFILE_KEY)).toBe(true);
  let p=freshProgress();p.processedRunIds=Array.from({length:512},(_,i)=>String(i));p=awardResult(p,base());expect(p.processedRunIds).toHaveLength(512);
 });
});
