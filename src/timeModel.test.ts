import {describe,it,expect} from 'vitest';
import {createCharacterStationRun,reducer,journeyRouteSeconds,projectedTime,STOP_BEFORE,type Run} from './engine';
import {priceRoute,movementSpeed,routeTravelSeconds,stationBudget,stationWalkingSeconds,stationForecast,remainingMetroSeconds,arrivalMargin,secondsToGoal} from './timeModel';
import {buildStationJourney} from './stationJourney';
import {remainingEstimate} from './resultMetrics';
import {STATIONS} from './stations';
import {difficultyPolicy} from './difficulty';
import {createTouristMaze,applyMazeChoice} from './touristMaze';
const personas=['student','worker','tourist','mom'] as const;
describe('预算、实际路线、预测和结算共用成本规则',()=>{
 it.each(personas)('%s 六站两档预算来自实际状态的最快路线和站内成本',character=>{
  for(const st of STATIONS)for(const hard of [false,true]){
   const s=createCharacterStationRun(st.id,character,hard,()=>.2),policy=difficultyPolicy(character,st.id);
   const budget=stationBudget(s,policy.buffer,policy.hardReduction,policy.minimum);expect(s.initial).toBe(budget.initial);
   expect(budget.travel).toBe(Math.min(...s.city.spawnStations[s.spawn].routes.map(r=>journeyRouteSeconds(s,r))));expect(budget.walking).toBe(stationWalkingSeconds(s));
   for(const r of s.city.spawnStations[s.spawn].routes){expect(projectedTime(s,r)).toBeCloseTo(Math.max(0,s.remaining-STOP_BEFORE-journeyRouteSeconds(s,r)));}
  }
 });
 it.each(personas)('%s 选定后的地铁预测锁定实际成本，恢复/减负不重新计价',character=>{
  let s=reducer(createCharacterStationRun('shanghai',character,false,()=>.8),{type:'START'});
  s={...s,phase:'route',event:null};const r=s.city.spawnStations[s.spawn].routes[0];
  s=reducer(s,{type:'ROUTE',route:r});expect(s.metroDuration).toBe(routeTravelSeconds(s,r));
  s=reducer(s,{type:'DIRECTION',correct:true});s={...s,event:null};
  const before=projectedTime(s),n=reducer(s,{type:'TICK',dt:.5});
  expect(s.remaining-n.remaining).toBeCloseTo(s.metroDuration/7*.5);expect(projectedTime(n)).toBeCloseTo(before);
  const changed:Run={...n,student:n.student?{...n.student,stats:{...n.student.stats,agility:30},stamina:0,exhausted:true}:undefined,characterTime:n.characterTime?{...n.characterTime,energy:0,load:70}:undefined,parent:n.parent?{...n.parent,energy:0,carrying:true}:undefined};
  expect(remainingMetroSeconds(changed)).toBe(remainingMetroSeconds(n));expect(arrivalMargin(changed)).toBe(arrivalMargin(n));
 });
 it('行李和婴儿车的换乘成本与路线账本一致',()=>{
  const s=createCharacterStationRun('beijing','worker',false,()=>.2),r={...s.city.spawnStations[0].routes[0],transfers:2};
  expect(priceRoute(r,1,s.character).transfer).toBe(90);
  expect(priceRoute(r,1,{...s.character,stroller:true}).transfer).toBe(180);
  expect(routeTravelSeconds(s,r)).toBe(r.minutes*60+r.walk/1.5/movementSpeed(s)+90);
 });
 it.each(personas)('%s 站内预测与实际移动使用同一速度，当前等待不重复算路程',character=>{
  const base=createCharacterStationRun('beijing',character,false,()=>.2);
  let s:Run={...base,phase:'station',remaining:1500,stationRunning:true,stationJourney:[{id:'gate-scan',stage:4,label:'入口',seconds:100}]};
  if(s.student)s.student={...s.student,runner:{...s.student.runner,wave:99,lane:0}};
  if(s.characterTime)s.characterTime={...s.characterTime,runner:{...s.characterTime.runner,wave:99,lane:0}};
  if(s.parent)s.parent={...s.parent,toilet:0,runner:{...s.parent.runner,wave:99,lane:0}};
  const forecast=stationForecast(s),n=reducer(s,{type:'TICK',dt:.1});
  expect(forecast.walking).toBeCloseTo(100*4/movementSpeed(s));expect(n.stationProgress/.1).toBeCloseTo(movementSpeed(s)/100);
  const blocked={...s,stationProgress:1,event:{id:'gate-scan',phase:'station' as const,title:'检票',description:'',choices:[{label:'完成',detail:'',seconds:8}]}};
  expect(stationForecast(blocked).walking).toBe(0);expect(stationForecast(blocked).operations).toBe(10);
  expect(remainingEstimate(s)).toBe(secondsToGoal(s));
 });
 it('已修改/跳过的站内段读取现有旅程，不恢复原始长度',()=>{
  const base=createCharacterStationRun('guangzhou','tourist',false,()=>.2),journey=buildStationJourney(base);
  const s={...base,phase:'station' as const,stationJourney:journey.filter(b=>b.id!=='gz-lift').map(b=>({...b,seconds:b.seconds*.8})),stationProgress:.5};
  const end=s.stationJourney.findIndex(b=>b.id==='gate-scan');
  const expected=s.stationJourney.slice(0,end+1).reduce((sum,b,i)=>sum+b.seconds*(i?1:.5)*4/movementSpeed(s),0);
  expect(stationForecast(s).walking).toBeCloseTo(expected);
 });
 it('地铁阶段失败仍估计尚未完成的锁定路线',()=>{
  const base=createCharacterStationRun('beijing','mom',false,()=>.2),route=base.city.spawnStations[0].routes[0];
  const s:Run={...base,phase:'result',success:false,route,metroDuration:500,metroProgress:.4};
  expect(remainingMetroSeconds(s)).toBe(300);expect(remainingEstimate(s)).toBeGreaterThan(300);
 });
 it('游客预测保留完整寻路成本，确认路标不会被误当成已经走完连廊',()=>{
  const base=createCharacterStationRun('shanghai','tourist',false,()=>.2);
  const s:Run={...base,phase:'station',stationJourney:[{id:'tourist-maze',stage:0,label:'寻找铁路安检',seconds:0}],stationBeat:0,stationProgress:1,touristMaze:createTouristMaze()};
  // Three passages plus three signs and six readings at two seconds each.
  expect(stationForecast(s).operations).toBe(96);
  const known={...s,touristMaze:applyMazeChoice(s.touristMaze!,'sign','shanghai')};
  expect(stationForecast(known).operations).toBe(86);
  const moved={...known,touristMaze:applyMazeChoice(known.touristMaze,'left','shanghai')};
  expect(stationForecast(moved).operations).toBe(64);
  const wrong={...s,touristMaze:applyMazeChoice(s.touristMaze!,'right','shanghai')};
  expect(stationForecast(wrong).operations).toBe(128);
  const remembered={...s,touristMaze:{...s.touristMaze!,known:[0,1]}};
  expect(stationForecast(remembered).operations).toBe(76);
 });
});
