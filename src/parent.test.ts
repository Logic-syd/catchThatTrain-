import {describe,it,expect} from 'vitest';
import {createCharacterStationRun,journeyRouteSeconds,reducer,type Run} from './engine';
import {buildStationJourney,journeyPrompt} from './stationJourney';
import {runnerWave} from './runner';
import {STATIONS} from './stations';
import {createGameResult} from './gameResult';
import {awardRun,freshProgress,isCharacterUnlocked} from './achievements';

function at(city:string,id:string):Run{
 const base=createCharacterStationRun(city,'mom',false,()=>.2);
 const stationJourney=buildStationJourney(base);
 const stationBeat=stationJourney.findIndex(b=>b.id===id);
 expect(stationBeat,`${city}/${id}`).toBeGreaterThanOrEqual(0);
 const run={...base,phase:'station' as const,remaining:2200,stationJourney,stationBeat};
 return {...run,event:journeyPrompt(run)};
}
const choose=(run:Run,i=0)=>reducer(run,{type:'CHOICE',choice:run.event!.choices[i]});

describe('带娃家长的车站事件',()=>{
 it('出门准备只扣一次时间，并真正改变孩子资源',()=>{
  let run=reducer(createCharacterStationRun('shanghai','mom',false,()=>.2),{type:'START'});
  const before=run.remaining;
  run=reducer(run,{type:'PARENT_PREP',option:'toilet-first',step:0});
  expect(run.remaining).toBe(before-60);expect(run.parent?.toilet).toBe(0);expect(run.parent?.toiletVisits).toBe(1);
  expect(reducer(run,{type:'PARENT_PREP',option:'toilet-first',step:0})).toBe(run);
  run=reducer(run,{type:'PARENT_PREP',option:'snacks-pack',step:1});
  expect(run.parent?.snacks).toBe(2);expect(run.phase).toBe('route');
 });
 it('四个指定车站有固定、会拦路的专属事件',()=>{
  const specific={guangzhou:'gz-parent-carry',beijing:'bj-parent-strict',wuhan:'wh-parent-duck',hangzhou:'hz-parent-lift'};
  for(const [city,id] of Object.entries(specific))expect(at(city,id).event?.id).toBe(id);
  expect(at('guangzhou','gz-parent-carry').event?.interaction?.kind).toBe('hold');
 });
 it('杭州近电梯确实折返，远电梯虽然要走但更快',()=>{
  const run=at('hangzhou','hz-parent-lift');
  const right=choose(run,0),left=choose(run,1);
  expect(run.remaining-right.remaining).toBe(18);
  expect(run.remaining-left.remaining).toBe(65);
  expect(right.stationDecisions.at(-1)?.optimal).toBe(true);
 });
 it('武汉不买周黑鸭，孩子会再喊一次；买了则跳过',()=>{
  const run=at('wuhan','wh-parent-duck');
  const bought=choose(run,0),refused=choose(run,1);
  expect(bought.parent?.duckBought).toBe(true);
  expect(bought.stationJourney.some(b=>b.id==='wh-parent-duck-repeat')).toBe(false);
  expect(refused.parent?.duckRefused).toBe(true);
  expect(refused.stationJourney.some(b=>b.id==='wh-parent-duck-repeat')).toBe(true);
  expect(at('wuhan','wh-parent-duck-repeat').event?.id).toBe('wh-parent-duck-repeat');
 });
 it('北京严格安检，预先分盘比被叫回去快',()=>{
  const run=at('beijing','bj-parent-strict');
  expect(run.remaining-choose(run,0).remaining).toBe(20);
  expect(run.remaining-choose(run,1).remaining).toBe(65);
 });
 it('孩子掉队会强制停步，处理后才能继续',()=>{
  const base=at('guangzhou','gz-parent-carry');
  let run:Run={...base,event:null,parent:{...base.parent!,gap:8,blockCooldown:0},stationRunning:true};
  run=reducer(run,{type:'TICK',dt:.1});
  expect(run.event?.id).toBe('parent-gap');expect(run.stationRunning).toBe(false);
  const beat=run.stationBeat;
  run=choose(run,0);
  expect(run.event).toBeNull();expect(run.stationBeat).toBe(beat);expect(run.parent?.gap).toBe(0);
 });
 it('尿急延期后仍会出现意外，但不会直接结束游戏',()=>{
  const base=at('shanghai','sh-parent-shop');
  let run:Run={...base,event:null,parent:{...base.parent!,toilet:95,toiletDeferred:false,blockCooldown:0}};
  run=reducer(run,{type:'TICK',dt:.1});expect(run.event?.id).toBe('parent-toilet');
  run=choose(run,1);expect(run.parent?.toiletDeferred).toBe(true);
  run={...run,parent:{...run.parent!,toilet:100,blockCooldown:0}};
  run=reducer(run,{type:'TICK',dt:.1});expect(run.event?.id).toBe('parent-accident');
  run=choose(run);expect(run.phase).toBe('station');expect(run.parent?.wetPants).toBe(true);
 });
 it('零食用完仍能安抚孩子，最后牵手冲刺只可用一次',()=>{
  const base=at('shanghai','sh-parent-shop');
  let run:Run={...base,event:null,remaining:290,parent:{...base.parent!,snacks:0,patience:0,patienceMin:0,blockCooldown:0}};
  run=reducer(run,{type:'TICK',dt:.1});expect(run.event?.id).toBe('parent-patience');
  expect(run.event?.choices.some(c=>c.label.includes('零食'))).toBe(false);
  run=choose(run);expect(run.parent?.patience).toBeGreaterThan(0);
  run=reducer(run,{type:'PARENT_SYNC'});expect(run.parent?.syncUsed).toBe(true);
  expect(reducer(run,{type:'PARENT_SYNC'})).toBe(run);
 });
 it('孩子全程没掉队的胜利会写入成就数据',()=>{
  const run={...createCharacterStationRun('shanghai','mom',false,()=>.2),phase:'result' as const,success:true,gateRemaining:80};
  const result=createGameResult(run);
  expect(result.characterId).toBe('mother');expect(result.characterStats.childNeverSeparated).toBe(true);
  const profile=awardRun(freshProgress(),run);
  expect(profile.unlocked['mother-first']).toBeDefined();
  const tourist={...createCharacterStationRun('shanghai','tourist',false,()=>.2),phase:'result' as const,success:true};
  expect(isCharacterUnlocked(awardRun(freshProgress(),tourist),'mom')).toBe(true);
 });
 it('六站都能从下地铁到检票上车，事件不会卡关',()=>{
  for(const station of STATIONS){
   const base=createCharacterStationRun(station.id,'mom',false,()=>.2);
   const best=Math.min(...base.city.spawnStations[base.spawn].routes.map(r=>journeyRouteSeconds(base,r)));
   let run:Run={...base,phase:'station',remaining:base.initial-best,identityReady:true,stationJourney:buildStationJourney({...base,identityReady:true})};
   for(let i=0;i<11000&&run.phase!=='result';i++){
    if(run.event){let option=run.event.choices[0];if(run.event.id==='zz-number')option=run.event.choices.find(c=>c.label===run.gate)!;run=reducer(run,{type:'CHOICE',choice:option});}
    else {const wave=runnerWave(run),lane=run.parent!.runner.lane;if(wave&&wave.lane===lane)run=reducer(run,{type:'CHANGE_LANE',direction:lane===2?-1:1});run=reducer(run,{type:'RUN_INPUT',held:true});run=reducer(run,{type:'TICK',dt:.1});}
   }
   expect(run.success,`${station.id}: ${run.event?.id??run.phase}, beat ${run.stationBeat}, remaining ${run.remaining}`).toBe(true);
  }
 });
 it('从出门、地铁到广州南检票的完整流程可以完成',()=>{
  let run=reducer(createCharacterStationRun('guangzhou','mom',false,()=>.2),{type:'START'});
  run=reducer(run,{type:'PARENT_PREP',option:'toilet-first',step:0});
  run=reducer(run,{type:'PARENT_PREP',option:'snacks-pack',step:1});
  const route=[...run.city.spawnStations[run.spawn].routes].sort((a,b)=>journeyRouteSeconds(run,a)-journeyRouteSeconds(run,b))[0];
  run=reducer(run,{type:'ROUTE',route});run=reducer(run,{type:'DIRECTION',correct:true});
  for(let i=0;i<12500&&run.phase!=='result';i++){
   if(run.event){if(run.event.id==='identity-search'){run=reducer(run,{type:'ID_PICK',item:'wallet'});run=reducer(run,{type:'ID_PICK',item:'id'});}else{let option=run.event.choices[0];if(run.event.id==='zz-number')option=run.event.choices.find(c=>c.label===run.gate)!;run=reducer(run,{type:'CHOICE',choice:option});}}
   else if(run.phase==='arrival')run=reducer(run,{type:run.metroStopIndex===route.stops.length-1||route.via===route.stops[run.metroStopIndex]?'ALIGHT':'CONTINUE_METRO'});
   else if(run.phase==='station'){const wave=runnerWave(run),lane=run.parent!.runner.lane;if(wave&&wave.lane===lane)run=reducer(run,{type:'CHANGE_LANE',direction:lane===2?-1:1});run=reducer(run,{type:'RUN_INPUT',held:true});run=reducer(run,{type:'TICK',dt:.1});}
   else run=reducer(run,{type:'TICK',dt:.1});
  }
  expect(run.success,`${run.phase} / ${run.event?.id} / remaining ${run.remaining}`).toBe(true);
  expect(run.seen).toContain('gz-parent-carry');
  expect(run.parent?.carriedSeconds).toBeGreaterThan(0);
  expect(createGameResult(run).characterStats.childToilet).toBe(true);
 });
});
