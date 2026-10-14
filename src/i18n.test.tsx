import {afterEach,describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {createCharacterStationRun,reducer,type Run} from './engine';
import {buildStationJourney,journeyPrompt} from './stationJourney';
import {STATIONS} from './stations';
import {EventSheet,Sheet} from './App';
import Station from './Station';
import LobbyIntro from './LobbyIntro';
import Results from './Results';
import {freshProgress} from './achievements';
import {Preparation,CharacterPreparation} from './StudentUI';
import {ParentPreparation} from './ParentUI';
import {getLanguage,setLanguage,translate} from './i18n';
import english from './locales/en.json';
import templates from './locales/en-patterns.json';
import {factorText} from './outcomes';
import {canonicalTitle,formatRecordDate} from './resultPresentation';
import {TITLE_CONFIGS} from './titles';

const han=/[\u3400-\u9fff]/;
const visible=(html:string)=>html.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
afterEach(()=>setLanguage('zh'));
describe('bilingual presentation preserves canonical game rules',()=>{
 it('result factors preserve multi-part sources, costs, estimates and random-event disclosure',()=>{
  for(const positive of [false,true])for(const estimated of [false,true])for(const avoidable of [false,true]){
   const text=factorText({id:'direction',source:'坐反方向，下一站折返',category:'navigation',deltaSeconds:positive?1575:-1575,positive,estimated,avoidable});
   expect(translate(text,'en')).toBe('Wrong metro direction; turn back next stop: '+(positive?'saved ':'spent ')+(estimated?'about ':'')+'1575 s'+(avoidable?'':' (random event)')+'.');
   expect(translate(text,'zh')).toBe(text);
  }
  expect(translate('这局波折不断，靠最后阶段冲刺追回约 23 秒，还是赶上了。','en')).toBe('A difficult run, but Final-stage sprint saved about 23 s and you made it.');
 });
 it('unknown copy is preserved rather than partly replaced by fragments',()=>{
  expect(translate('未来车站规划','en')).toBe('未来车站规划');
  expect(translate('新任务：幸福感 +20','en')).toBe('新任务：幸福感 +20');
 });
 it('saved record dates use the selected locale without rewriting stored values',()=>{
  expect(formatRecordDate('2026/10/14','en')).toBe('14/10/2026');
  expect(formatRecordDate('2026/10/14','zh')).toBe('2026/10/14');
  expect(formatRecordDate('2026/2/30','en')).toBe('2026/2/30');
  expect(formatRecordDate('unknown date','en')).toBe('unknown date');
 });
 it('old English invite titles and canonical Chinese titles support either display language',()=>{
  for(const title of TITLE_CONFIGS){
   expect(canonicalTitle(translate(title.name,'en'))).toBe(title.name);
   expect(translate(canonicalTitle(translate(title.name,'en')),'zh')).toBe(title.name);
  }
  expect(canonicalTitle('A custom title')).toBe('A custom title');
 });
 it('both help dialogs and mandatory event dialogs offer a switch within the focus trap',()=>{
  for(const event of [false,true]){
   setLanguage('zh');const zh=renderToStaticMarkup(<Sheet title="别慌，玩法很简单。" event={event}>test</Sheet>);
   expect(zh).toContain('aria-label="Switch to English"');
   setLanguage('en');const en=renderToStaticMarkup(<Sheet title="别慌，玩法很简单。" event={event}>test</Sheet>);
   expect(en).toContain('aria-label="切换为中文"');expect(en).toContain("Stay calm. Here&#x27;s how to play.");
  }
 });
 it('Chinese is unchanged; every catalog entry and numeric template has an English rendering',()=>{
  for(const source of Object.keys(english)){expect(translate(source,'zh')).toBe(source);expect(translate(source,'en'),source).not.toMatch(han);}
  for(const source of Object.keys(templates)){
   const example=source.replace(/\{(\d+)\}/g,(_,key)=>String(Number(key)+12));
   expect(translate(example,'en'),source).not.toMatch(han);
  }
 });
 it('dynamic costs and waiting recovery translate without changing prices or resource numbers',()=>{
  const text='−45 秒 · 敏捷 +5、本局精力上限 +10（90 → 100，最高 100），当前体力 +10；进站后前 3 游戏分钟自然恢复 +20%，占着一只手；等待期间：体力 +2.35 · 疲劳 −0.02';
  const en=translate(text,'en');expect(en).not.toMatch(han);expect(en).toContain('energy capacity +10');expect(en).toContain('Stamina +2.35');expect(en.match(/\d+(?:\.\d+)?/g)).toEqual(text.match(/\d+(?:\.\d+)?/g));
 });
 it('switching languages leaves the current event, elapsed time, resources and canonical choice valid',()=>{
  let run=createCharacterStationRun('shanghai','student',false,()=>.5);
  run={...run,phase:'station',stationJourney:buildStationJourney(run)};
  run.stationBeat=run.stationJourney.findIndex(b=>b.id==='vertical-choice');run.stationProgress=1;run.event=journeyPrompt(run);run.eventElapsed=2.4;
  const before=JSON.stringify(run),choice=run.event.choices[1];
  setLanguage('en');expect(getLanguage()).toBe('en');expect(translate(choice.label)).toBe('Run the stair shortcut');
  expect(JSON.stringify(run)).toBe(before);
  const en=reducer(run,{type:'CHOICE',choice});setLanguage('zh');const zh=reducer(run,{type:'CHOICE',choice});
  expect(en).toEqual(zh);expect(en.student!.vertical).toBe('stairs');
 });
 it('share text keeps adjacent station and result parameters in the right English order',()=>{
  expect(translate('我在上海虹桥站没赶上，拿到称号「理论计算失败」。你也来挑战这座车站！','en')).toBe('I missed the train at Shanghai Hongqiao Station and earned “The Math Failed”. Try this station too!');
  expect(translate('我在北京南站赶上了，拿到称号「从容上车」。你也来挑战这座车站！','en')).toBe('I caught the train at Beijing South Station and earned “Boarded Calmly”. Try this station too!');
 });
 it('real wrong-direction and queue costs translate in result causes and image/share text',()=>{
  let run=createCharacterStationRun('shanghai','student',false,()=>.5);
  run={...run,phase:'route'};run=reducer(run,{type:'ROUTE',route:run.city.spawnStations[run.spawn].routes[0]});
  run=reducer(run,{type:'DIRECTION',correct:false});run=reducer(run,{type:'TICK',dt:1.1});run={...run,phase:'result',success:false,event:null};
  setLanguage('en');const text=visible(renderToStaticMarkup(<Results run={run} progress={freshProgress()} saved replay={()=>{}} share={()=>{}} selectStation={()=>{}}/>));
  expect(text).not.toMatch(han);expect(text).toContain('Wrong direction');
  expect(translate('坐反方向，下一站折返，花费1575 秒。')).not.toMatch(han);
  let parent=createCharacterStationRun('shanghai','mom',false,()=>.5);
  parent={...parent,phase:'station',stationJourney:buildStationJourney(parent)};parent.stationBeat=parent.stationJourney.findIndex(b=>b.id==='security-queue');parent.stationProgress=1;parent.event=journeyPrompt(parent);
  parent=reducer(parent,{type:'CHOICE',choice:parent.event.choices[2]});parent={...parent,phase:'result',success:false,event:null};
  const parentText=visible(renderToStaticMarkup(<Results run={parent} progress={freshProgress()} saved replay={()=>{}} share={()=>{}} selectStation={()=>{}}/>));
  expect(parentText).not.toMatch(han);expect(parentText).toContain('Queue C');
 });
 it.each(STATIONS)('all travelers at $name render lobby, preparation, events and results in English',(station)=>{
  setLanguage('en');const progress=freshProgress(),missing:string[]=[];
  const check=(label:string,html:string)=>{const text=visible(html);if(han.test(text))missing.push(label+': '+(text.match(/.{0,25}[\u3400-\u9fff].{0,45}/g)??[]).join(' | '));};
  for(const who of ['student','worker','tourist','mom'] as const)for(const hard of [false,true]){
   const base=createCharacterStationRun(station.id,who,hard,()=>.5);
   check(station.id+'/'+who+'/lobby',renderToStaticMarkup(<LobbyIntro run={base} progress={progress} onSelect={()=>{}}/>));
   for(let step=0;step<(who==='student'||who==='worker'?3:2);step++){
    const run={...base,phase:'preparation' as const,student:base.student?{...base.student,prep:step}:undefined,characterTime:base.characterTime?{...base.characterTime,prepStep:step}:undefined,parent:base.parent?{...base.parent,prepStep:step}:undefined};
    check(station.id+'/'+who+'/prep',renderToStaticMarkup(run.student?<Preparation run={run} dispatch={()=>{}}/>:run.parent?<ParentPreparation run={run} dispatch={()=>{}}/>:<CharacterPreparation run={run} dispatch={()=>{}}/>));
   }
   const journey=buildStationJourney(base);
   for(let index=0;index<journey.length;index++){
    const run:Run={...base,phase:'station',stationJourney:journey,stationBeat:index,stage:journey[index].stage,stationProgress:1,event:null,escalatorLane:0};run.event=journeyPrompt(run);
    const original=JSON.stringify(run);
    check(station.id+'/'+who+'/'+run.event.id,renderToStaticMarkup(<Station run={run} dispatch={()=>{}} blocked><EventSheet run={run} dispatch={()=>{}}/></Station>));
    expect(JSON.stringify(run)).toBe(original);
   }
   for(const success of [false,true]){
    const run:Run={...base,phase:'result',success,stationJourney:journey,gateRemaining:15};
    check(station.id+'/'+who+'/result',renderToStaticMarkup(<Results run={run} progress={progress} saved replay={()=>{}} share={()=>{}} selectStation={()=>{}}/>));
   }
  }
  expect(missing.join('\n')).toBe('');
 });
});
