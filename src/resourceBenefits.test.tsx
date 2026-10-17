import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {createCharacterStationRun,reducer,type Run} from './engine';
import {buildStationJourney,journeyPrompt} from './stationJourney';
import {CharacterPreparation,Preparation,StudentEnergy} from './StudentUI';
import {createGameResult} from './gameResult';
import {withResourceFeedback} from './resourceFeedback';
import {timedPrompt} from './characterTime';
import {studentPreparation} from './studentConfig';
function station(s:Run):Run{
 const n={...s,phase:'station' as const,event:null,stationRunning:true,stationBeat:0,stationProgress:0,stationJourney:[{id:'gate-scan',stage:4,label:'长廊',seconds:100}],remaining:1500};
 if(n.student)n.student={...n.student,runner:{...n.student.runner,lane:0,wave:99}};
 if(n.characterTime)n.characterTime={...n.characterTime,runner:{...n.characterTime.runner,lane:0,wave:99}};
 if(n.parent)n.parent={...n.parent,toilet:0,runner:{...n.parent.runner,lane:0,wave:99}};
 return n;
}
function at(character:'mom'|'worker'|'tourist',id:string):Run{
 const b=createCharacterStationRun('guangzhou',character,false,()=>.5),stationJourney=buildStationJourney(b),stationBeat=stationJourney.findIndex(x=>x.id===id);
 const n={...b,phase:'station' as const,stationJourney,stationBeat};return {...n,event:journeyPrompt(n)};
}
const choose=(s:Run,id:string)=>reducer(s,{type:'CHOICE',choice:s.event!.choices.find(c=>c.id===id)!});
describe('准备与任务收益的引擎/UI完整链路',()=>{
 it('吃饭得到储备，进站冲刺才使用；日志和结算记录实际变化',()=>{
  let s=reducer(createCharacterStationRun('shanghai','worker',false,()=>.5),{type:'START'});
  s=reducer(s,{type:'PERSON_PICK',step:0,option:'leave-gifts'});
  const detail=timedPrompt(s)!.choices.find(c=>c.id==='eat')!.detail;expect(detail).toContain('精力储备 +10');expect(detail).toContain('精力已满');
  const html=renderToStaticMarkup(<CharacterPreparation run={s} dispatch={()=>{}}/>);expect(html).toContain('留点后劲，赶路时用');expect(html).toContain('−60 秒');expect(html).not.toContain('精力储备 +10');
  const before=s.remaining;s=reducer(s,{type:'PERSON_PICK',step:1,option:'eat'});expect(s.remaining).toBe(before-60);expect(s.characterTime!.energyReserve).toBe(10);expect(s.characterTime!.maxEnergy).toBe(60);
  expect(s.logs.at(-1)!.resources!.energyReserve).toEqual({before:0,after:10});expect(reducer(s,{type:'PERSON_PICK',step:1,option:'eat'})).toBe(s);
  const rested=reducer({...station(s),stationRunning:false},{type:'TICK',dt:1});expect(rested.characterTime!.energyReserve).toBe(10);
  const moving=reducer(reducer(station(s),{type:'SPRINT_INPUT',held:true}),{type:'TICK',dt:1});expect(moving.characterTime!.energy).toBe(60);expect(moving.characterTime!.energyReserve).toBeCloseTo(5);expect(createGameResult(moving).characterStats.energyReserveUsed).toBeCloseTo(5);
  expect(renderToStaticMarkup(<StudentEnergy run={moving} dispatch={()=>{}}/>)).toContain('精力储备 5');
 });
 it('奶茶窗口不在地铁耗尽，站内固定成本和真实读秒共同推进窗口',()=>{
  let s=reducer(createCharacterStationRun('shanghai','student',false,()=>.5),{type:'START'});s=reducer(s,{type:'PREP_PICK',step:0,option:'buy'});
  s=reducer({...s,phase:'route'},{type:'TICK',dt:200});expect(s.student!.stationElapsedGame).toBe(0);
  const b=station(s);b.student={...b.student!,stamina:20,elapsedGame:1500};
  const boosted=reducer(b,{type:'TICK',dt:.1}),plain=reducer({...b,student:{...b.student,choices:{tea:'skip'}}},{type:'TICK',dt:.1});
  expect(boosted.student!.stamina-20).toBeCloseTo((plain.student!.stamina-20)*1.2);
  const elapsed=reducer(b,{type:'PENALTY',seconds:180,title:'等待'});expect(elapsed.student!.stationElapsedGame).toBe(180);
  const after=reducer(elapsed,{type:'TICK',dt:.1});expect(after.student!.stamina-20).toBeCloseTo(plain.student!.stamina-20);
 });
 it('奶茶后饭团仍有饱腹收益，身份证不再回满当前体力',()=>{
  let s=reducer(createCharacterStationRun('shanghai','student',false,()=>.5),{type:'START'});s=reducer(s,{type:'PREP_PICK',step:0,option:'buy'});s={...s,student:{...s.student!,stamina:30}};
  s=reducer(s,{type:'PREP_PICK',step:1,option:'check'});expect(s.student!.stamina).toBe(30);
  expect(studentPreparation(s.student!)!.options.find(o=>o.id==='eat')!.detail).toContain('本局精力上限 +0');
  const html=renderToStaticMarkup(<Preparation run={s} dispatch={()=>{}}/>);expect(html).toContain('后半程不挨饿');expect(html).toContain('−25 秒');expect(html).not.toContain('本局精力上限');
  const fed=reducer(s,{type:'PREP_PICK',step:2,option:'eat'}),hungry=reducer(s,{type:'PREP_PICK',step:2,option:'skip'});
  expect(reducer({...station(fed),stage:3},{type:'TICK',dt:.1}).student!.stats.energy).toBe(100);
  expect(reducer({...station(hungry),stage:3},{type:'TICK',dt:.1}).student!.stats.energy).toBe(90);
 });
 it('硬拖影响后续移动速度与消耗，读题和停步不增加轮子消耗',()=>{
  const b=at('tourist','tourist-wheel'),fixed=station(choose(b,'repair')),dragged=station(choose(b,'drag'));
  fixed.characterTime={...fixed.characterTime!,energy:20};dragged.characterTime={...dragged.characterTime!,energy:20};
  const f=reducer(fixed,{type:'TICK',dt:.1}),d=reducer(dragged,{type:'TICK',dt:.1});expect(d.stationProgress/f.stationProgress).toBeCloseTo(.9);expect(f.characterTime!.energy-d.characterTime!.energy).toBeCloseTo(.1);
  const fi=reducer({...fixed,stationRunning:false},{type:'TICK',dt:.1}),di=reducer({...dragged,stationRunning:false},{type:'TICK',dt:.1});expect(fi.characterTime!.energy).toBe(di.characterTime!.energy);
  const delayed=reducer(dragged,{type:'TICK',dt:1});let regular=dragged;for(let i=0;i<10;i++)regular=reducer(regular,{type:'TICK',dt:.1});expect(delayed.characterTime).toEqual(regular.characterTime);expect(delayed.stationProgress).toBeCloseTo(regular.stationProgress);
 });
 it('家长电梯恢复实际缺口，读取期间变化后重新显示，不重复奖励',()=>{
  let s=at('mom','gz-lift');s={...s,parent:{...s.parent!,energy:69}};s={...s,event:journeyPrompt(s)};
  expect(s.event!.choices.find(c=>c.id==='lift')!.detail).toContain('+1');
  s=reducer(s,{type:'TICK',dt:1});expect(s.parent!.energy).toBe(70);expect(s.event!.choices.find(c=>c.id==='lift')!.detail).not.toContain('+25');
  const n=choose(s,'lift');expect(n.parent!.energy).toBe(70);expect(n.parent!.maxEnergy).toBe(70);expect(n.remaining).toBe(s.remaining-45);
  expect(reducer(n,{type:'CHOICE',choice:s.event!.choices.find(c=>c.id==='lift')!})).toBe(n);
 });
 it.each(['worker','tourist','mom'] as const)('%s 电梯/楼梯操作后直接完成换层，不再错误转扶梯',character=>{
  const b=createCharacterStationRun('wuhan',character,false,()=>.5);let s={...b,phase:'station' as const,stationJourney:buildStationJourney(b)};
  s={...s,stationBeat:s.stationJourney.findIndex(x=>x.id==='vertical-choice')};s={...s,event:journeyPrompt(s)};
  let n=choose(s,'stairs');n={...n,stationBeat:n.stationJourney.findIndex(x=>x.id==='escalator-ride')};n={...n,event:journeyPrompt(n)};
  const after=reducer(n,{type:'CHOICE',choice:n.event!.choices[0]});expect(after.event).toBeNull();expect(after.stationBeat).toBe(n.stationBeat+1);
 });
 it('尿意统一结算后再更新饮水边界提示，不落后一个时间片',()=>{
  const b=createCharacterStationRun('shanghai','mom',false,()=>.5),stationJourney=buildStationJourney(b),stationBeat=stationJourney.findIndex(x=>x.id==='sh-parent-shop');
  let s:Run={...b,phase:'station',stationJourney,stationBeat,parent:{...b.parent!,toilet:99}};s={...s,event:journeyPrompt(s)};
  const n=reducer(s,{type:'TICK',dt:1});expect(n.parent!.toilet).toBeCloseTo(99+4/60);
  expect(n.event!.choices[0].detail).toBe(journeyPrompt(n).choices[0].detail);
 });
 it('零体力消耗和已超过岔气恢复目标都不误报为体力已满',()=>{
  const b=createCharacterStationRun('guangzhou','student',false,()=>.5);
  const empty={...b,student:{...b.student!,stamina:0}};
  const stairs=withResourceFeedback(empty,{id:'gz-lift',phase:'station',title:'上楼',description:'',choices:[{label:'楼梯',detail:'',seconds:0,stationDecision:{group:'gz-lift',value:'stairs',category:'vertical',optimal:false}}]});
  expect(stairs.choices[0].detail).toBe('−0 秒 · 体力无变化');
  const breathing=withResourceFeedback({...b,student:{...b.student!,stamina:70}},{id:'student-breath',phase:'station',title:'调整呼吸',description:'',choices:[{label:'恢复',detail:'',seconds:105}]});
  expect(breathing.choices[0].detail).not.toContain('已满');
 });

});
