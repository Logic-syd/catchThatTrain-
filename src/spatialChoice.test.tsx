import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {createStationRun,type Run} from './engine';
import {journeyPrompt} from './stationJourney';
import {SpatialChoice} from './SpatialChoice';
import {advanceSpatialMotion,buildSpatialScene,isHongqiaoSpatialEvent,planSpatialPath,spatialPositionIsClear,spatialOperationSeconds,type Point,type SpatialScene} from './spatialChoice';

function eventRun(id:string):Run{
 const s=createStationRun('shanghai',false,()=>.5);s.phase='station';s.stationJourney=[{id,stage:2,label:'操作入口',seconds:1}];s.stationBeat=0;s.event=journeyPrompt(s);return s;
}
function walk(scene:SpatialScene,index:number,dt=.05){
 let position={...scene.start},elapsed=0,reached:number|null=null,blocked=false;
 const path=planSpatialPath(scene,index);
 expect(path.length).toBeGreaterThan(0);
 for(const target of path){for(let tick=0;tick<200&&Math.hypot(target.x-position.x,target.y-position.y)>.01&&reached===null;tick++){
  const motion=advanceSpatialMotion(scene,position,{target},dt);position=motion.position;elapsed+=dt;blocked||=motion.blocked;reached=motion.choiceIndex;
  expect(spatialPositionIsClear(scene,position)).toBe(true);
 }}
 return {position,elapsed,reached,blocked};
}
describe('虹桥操作场景：走位、信息、原费用',()=>{
 it('每种入口都能通过实际走位到达，不会误入别的入口，也不能瞬移',()=>{
  for(const id of ['vertical-choice','escalator-choice','sh-corridor','security-queue','station-sign','gates']){
   const s=eventRun(id),scene=buildSpatialScene(s)!;expect(scene.exits).toHaveLength(s.event!.choices.length);
   for(const exit of scene.exits){
    const target={x:exit.x+exit.width/2,y:exit.y+exit.height/2};
    expect(advanceSpatialMotion(scene,scene.start,{target},0)).toEqual({position:scene.start,choiceIndex:null,blocked:false});
    const result=walk(scene,exit.choiceIndex);expect(result.reached,`${id}/${exit.choiceIndex}`).toBe(exit.choiceIndex);expect(result.elapsed).toBeGreaterThan(.4);expect(result.elapsed).toBeLessThan(3.5);
   }
  }
 });
 it('直冲栏杆会被实际挡住，绕行才可进入；一次长更新不穿过障碍',()=>{
  const scene=buildSpatialScene(eventRun('vertical-choice'))!,target={x:180,y:35};
  const hit=advanceSpatialMotion(scene,scene.start,{target},2);
  expect(hit.blocked).toBe(true);expect(hit.choiceIndex).toBeNull();expect(hit.position.y).toBeGreaterThanOrEqual(172);
  const recovery=walk({...scene,start:hit.position},1);expect(recovery.reached).toBe(1);
 });
 it('松手不移动；相同共享计时的长短更新具有相同路程',()=>{
  const scene=buildSpatialScene(eventRun('vertical-choice'))!,input={direction:{x:-1,y:-1}};
  const one=advanceSpatialMotion(scene,scene.start,input,.4);let many={...scene.start};
  for(let i=0;i<8;i++)many=advanceSpatialMotion(scene,many,input,.05).position;
  expect(many.x).toBeCloseTo(one.position.x,8);expect(many.y).toBeCloseTo(one.position.y,8);
  expect(advanceSpatialMotion(scene,many,null,100).position).toEqual(many);
  const straight=advanceSpatialMotion(scene,scene.start,{direction:{x:-1,y:0}},.3),diagonal=advanceSpatialMotion(scene,scene.start,input,.3);
  const distance=(p:Point)=>Math.hypot(p.x-scene.start.x,p.y-scene.start.y);
  expect(distance(diagonal.position)).toBeCloseTo(distance(straight.position),8);
 });
 it('预测读取同一真实走位；缓存区分起点和障碍，文案不改变结果',()=>{
  const scene=buildSpatialScene(eventRun('vertical-choice'))!,seconds=spatialOperationSeconds(scene,1);
  expect(seconds).toBeCloseTo(walk(scene,1,.01).elapsed,1);
  expect(spatialOperationSeconds({...scene,heading:'改过标题'},1)).toBe(seconds);
  const noRail={...scene,obstacles:[]};expect(spatialOperationSeconds(noRail,1)).toBeLessThan(seconds);
  const nearer={...noRail,start:{x:180,y:110}};expect(spatialOperationSeconds(nearer,1)).toBeLessThan(spatialOperationSeconds(noRail,1));
  expect(spatialOperationSeconds(scene,999)).toBe(Infinity);
 });
 it('安检未观察不能泄露等待秒数或隐藏行李；高专注与观察后读取同一费用',()=>{
  let s=eventRun('security-queue');const unknown=buildSpatialScene(s)!;
  expect(unknown.exits.every(e=>e.info[1]==='按住观察看清速度')).toBe(true);
  expect(unknown.exits.every(e=>e.info.every(info=>!info.includes('排队')))).toBe(true);
  s={...s,student:{...s.student!,observed:true}};const observed=buildSpatialScene(s)!;
  observed.exits.forEach((e,i)=>expect(e.info).toContain(`排队 ${s.event!.choices[i].seconds} 秒`));
  s={...s,student:{...s.student!,observed:false,stats:{...s.student!.stats,focus:75}}};
  expect(buildSpatialScene(s)!.exits).toEqual(observed.exits);
 });
 it('扶梯当前状态取本局随机结果，固定等待预览遵循已有环境费用封顶',()=>{
  const s=eventRun('escalator-choice');s.stationLuck={...s.stationLuck,escalators:['blocked','clear','steady']};s.student={...s.student!,environmentLoss:175};
  const before=JSON.stringify(s),scene=buildSpatialScene(s)!;
  expect(scene.exits.map(e=>e.status)).toEqual(['blocked','clear','steady']);
  expect(scene.exits[0].info).toContain('上楼等待 5 秒');expect(scene.exits[1].info).toContain('可快走 · 无固定等待');expect(scene.exits[2].info).toContain('上楼等待 5 秒');
  expect(buildSpatialScene(s)).toEqual(scene);expect(JSON.stringify(s)).toBe(before);
 });
 it('检票保留原八通道完整报价；改票号后区域的空间左右仍正确',()=>{
  const s=eventRun('gates'),scene=buildSpatialScene(s)!;
  expect(scene.heading).toContain(s.gate);expect(scene.exits).toHaveLength(8);
  scene.exits.forEach(e=>{const c=s.event!.choices[e.choiceIndex];expect(e.info).toEqual([`步行 ${c.fixedWalkSeconds} · 排队 ${c.waitSeconds}`,`合计 ${c.seconds} 秒`]);});
  const right=eventRun('station-sign');right.gate='22B';right.event=journeyPrompt(right);
  const signs=buildSpatialScene(right)!;expect(signs.exits.find(e=>e.choiceIndex===0)!.x).toBeGreaterThan(signs.exits.find(e=>e.choiceIndex===1)!.x);
  expect(walk(signs,0).reached).toBe(0);
 });
 it('空间入口没有点击提交按钮，说明公开真实控制方式，范围限于大学生虹桥',()=>{
  const s=eventRun('gates');const before=JSON.stringify(s);
  const html=renderToStaticMarkup(<SpatialChoice run={s} dispatch={()=>{}}/>);
  expect(html).not.toContain('<button');expect(html).toContain('方向键 / WASD');expect(html).toContain('走进入口才会选择');expect(html.match(/data-choice-index=/g)).toHaveLength(8);expect(JSON.stringify(s)).toBe(before);
  expect(isHongqiaoSpatialEvent({...s,city:{...s.city,id:'beijing'}})).toBe(false);
  expect(isHongqiaoSpatialEvent({...s,character:{...s.character,id:'worker'}})).toBe(false);
 });
});
