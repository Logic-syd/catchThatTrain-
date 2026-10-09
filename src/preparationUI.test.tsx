import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {createCharacterStationRun,reducer,type Action,type Run} from './engine';
import {Preparation,CharacterPreparation} from './StudentUI';
import {ParentPreparation} from './ParentUI';
import {PreparationComplete} from './PreparationFrame';

const noop=()=>{};
const scenarios=[
 {character:'student',steps:[
  {current:'小蛋糕',question:'朋友打包好的小蛋糕',option:'take',receipt:'带上小蛋糕',seconds:75},
  {current:'身份证',question:'身份证，真的在包里吗',option:'skip',receipt:'先跑到检票口再说吧',seconds:0},
  {current:'早餐',question:'早餐还没吃',option:'eat',receipt:'买个饭团，吃完再走',seconds:60},
 ]},
 {character:'worker',steps:[
  {current:'土特产',question:'妈把一袋土特产放进箱子',option:'leave-gifts',receipt:'先不带了，轻装赶车',seconds:0},
  {current:'再吃两口',question:'吃完再走',option:'eat',receipt:'再吃两口，马上走',seconds:60},
  {current:'老板消息',question:'老板又发来消息',option:'ignore',receipt:'不理',seconds:0},
 ]},
 {character:'tourist',steps:[
  {current:'缓口气',question:'今日步数 23,487',option:'rest',receipt:'靠着小箱子坐一会',seconds:30},
  {current:'纪念品',question:'纪念品要不要留下',option:'light',receipt:'先放下，轻装赶车',seconds:0},
 ]},
 {character:'mom',steps:[
  {current:'上厕所',question:'孩子说“不想上厕所”',option:'toilet-skip',receipt:'先赶车，没上厕所',seconds:0},
  {current:'带零食',question:'零食要不要塞进包里',option:'snacks-pack',receipt:'带了两份零食',seconds:0},
 ]},
] as const;

function renderPreparation(run:Run){
 return renderToStaticMarkup(run.student?<Preparation run={run} dispatch={noop}/>:run.parent?<ParentPreparation run={run} dispatch={noop}/>:<CharacterPreparation run={run} dispatch={noop}/>);
}
function pick(run:Run,option:string):Run{
 const action:Action=run.student?{type:'PREP_PICK',option,step:run.student.prep}:run.parent?{type:'PARENT_PREP',option,step:run.parent.prepStep}:{type:'PERSON_PICK',option,step:run.characterTime!.prepStep};
 return reducer(run,action);
}

describe('preparation step feedback',()=>{
 it.each(scenarios)('$character advances through its questions and keeps the actual last choice on the route screen',({character,steps})=>{
  let run=reducer(createCharacterStationRun('shanghai',character,false,()=>.2),{type:'START'});
  const initial=run.remaining;
  expect(renderToStaticMarkup(<PreparationComplete run={run}/>)).toBe('');
  for(const [index,step] of steps.entries()){
   expect(run.phase).toBe('preparation');
   const html=renderPreparation(run);
   expect(html.match(/aria-current="step"/g)).toHaveLength(1);
   expect(html.match(/<li[^>]*aria-current="step"[\s\S]*?<\/li>/)?.[0]).toContain(step.current);
   expect(html.match(/<h2[^>]*>[\s\S]*?<\/h2>/)?.[0]).toContain(step.question);
   expect(html).toContain(`${index+1} / ${steps.length}`);
   if(index===0)expect(html).not.toContain('上一题已完成');
   else{
    const previous=steps[index-1];
    expect(html).toContain('上一题已完成');
    expect(html).toContain(`<b>${previous.receipt}</b>`);
    if(previous.seconds>0)expect(html).toContain(`−${previous.seconds} 秒`);
   }
   run=pick(run,step.option);
  }
  expect(run.phase).toBe('route');
  expect(run.remaining).toBe(initial-steps.reduce((total,step)=>total+step.seconds,0));
  const html=renderToStaticMarkup(<PreparationComplete run={run}/>);
  expect(html).toContain('准备完成，去赶地铁！');
  expect(html).toContain('下一步 · 选一条去车站的路线');
  expect(html).toContain(`<b>${steps.at(-1)!.receipt}</b>`);
  expect(html).not.toContain(`<b>${steps[0].receipt}</b>`);
 });

 it('keeps the last preparation receipt when a later unrelated log is recorded',()=>{
  let run=reducer(createCharacterStationRun('shanghai','student',false,()=>.2),{type:'START'});
  for(const option of ['skip','skip','eat'])run=pick(run,option);
  run={...run,logs:[...run.logs,{title:'无关事件',seconds:15,eventId:'metro-route'}]};
  const html=renderToStaticMarkup(<PreparationComplete run={run}/>);
  expect(html).toContain('买个饭团，吃完再走');
  expect(html).toContain('−60 秒');
  expect(html).not.toContain('无关事件');
 });

 it('rejects expired worker step actions without charging time or advancing again',()=>{
  let run=reducer(createCharacterStationRun('shanghai','worker',false,()=>.2),{type:'START'});
  run=pick(run,'take-gifts');
  expect(reducer(run,{type:'PERSON_PICK',option:'eat',step:0})).toBe(run);
  const before=run.remaining;
  const eat:Action={type:'PERSON_PICK',option:'eat',step:1};
  run=reducer(run,eat);
  expect(run.remaining).toBe(before-60);
  expect(reducer(run,eat)).toBe(run);
 });
});
