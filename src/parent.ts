import {TIME_SCALE} from './gameClock';
import type {Run} from './engine';
import type {Choice,EventConfig} from './data';
import type {RunnerState} from './runner';

export interface ParentState {
 prepStep:number; appearance:'mom'|'dad'; energy:number; maxEnergy:number; load:number;
 childEnergy:number; patience:number; toilet:number; gap:number; carrying:boolean;
 snacks:number; water:number; sprinting:boolean; exhausted:boolean; runner:RunnerState;
 toiletDeferred:boolean; wetPants:boolean; childToilet:boolean; toiletVisits:number; separationCount:number;
 childEnergyMin:number;patienceMin:number;
 patienceZero:boolean; childNegativeEvents:number; childDelaySeconds:number;
 carriedSeconds:number; snacksUsed:number; syncUsed:boolean; syncRemaining:number; syncSprintSaved:number;
 duckBought:boolean; duckRefused:boolean; blockCooldown:number;
 anger:number;angerPeak:number;outbursts:number;rageDelaySeconds:number;
}
export const parentProfile={agility:60,energy:70,focus:85,load:30};
export const PARENT_SPRINT={multiplier:1.25,syncMultiplier:1.4,drain:6.5,carryingDrain:8.5,toiletThreshold:80};
export const PARENT_TOILET_PER_GAME_MINUTE={station:4,metro:2.5,other:.45} as const;
export function canParentSprint(p:ParentState){return !p.exhausted&&p.energy>0&&p.toilet<PARENT_SPRINT.toiletThreshold;}
export function createParentState(rng:()=>number=Math.random):ParentState{return {
 prepStep:0,appearance:rng()<.5?'mom':'dad',energy:70,maxEnergy:70,load:30,
 childEnergy:70,patience:76,toilet:30+Math.floor(rng()*26),gap:0,carrying:false,
 snacks:0,water:1,sprinting:false,exhausted:false,runner:{lane:1,wave:0,blocked:false,collisions:0,dodges:0,seed:Math.floor(rng()*3)},
 toiletDeferred:false,wetPants:false,childToilet:false,toiletVisits:0,separationCount:0,childEnergyMin:70,patienceMin:76,patienceZero:false,childNegativeEvents:0,childDelaySeconds:0,
 carriedSeconds:0,snacksUsed:0,syncUsed:false,syncRemaining:0,syncSprintSaved:0,
 duckBought:false,duckRefused:false,blockCooldown:0,anger:20,angerPeak:20,outbursts:0,rageDelaySeconds:0
};}
const clamp=(n:number)=>Math.max(0,Math.min(100,n));
export function parentMovementFactor(p:ParentState,sprinting=false){
 const energy=Math.max(.78,.82+p.energy/p.maxEnergy*.18);
 const child=p.childEnergy<20&&!p.carrying?.88:1;
 return .98*energy*child*(1-Math.max(0,p.load-30)*.003)*(p.carrying?.84:1)*(sprinting&&canParentSprint(p)?(p.syncRemaining>0?PARENT_SPRINT.syncMultiplier:PARENT_SPRINT.multiplier):1);
}
// Toilet is settled by the engine's complete game-time ledger; movement uses real time.
export function parentToiletAfter(toilet:number,phase:Run['phase'],gameSeconds:number){
 const rate=phase==='station'?PARENT_TOILET_PER_GAME_MINUTE.station:phase==='metro'?PARENT_TOILET_PER_GAME_MINUTE.metro:PARENT_TOILET_PER_GAME_MINUTE.other;
 return clamp(toilet+gameSeconds/60*rate);
}
export type ParentWaitResource='energy'|'childEnergy'|'patience';
/** Passive waiting only. Task effects replace their named resources for the same duration. */
export function advanceParentWait(p:ParentState,phase:Run['phase'],gameSeconds:number,excluded:readonly ParentWaitResource[]=[]):ParentState{
 if(!Number.isFinite(gameSeconds)||gameSeconds<=0)return p;
 const energy=excluded.includes('energy')?p.energy:Math.max(0,Math.min(p.maxEnergy,p.energy+1.15*gameSeconds));
 const childEnergy=excluded.includes('childEnergy')?p.childEnergy:clamp(p.childEnergy+(p.carrying?.22:.02)*gameSeconds);
 const patience=excluded.includes('patience')?p.patience:clamp(p.patience-(phase==='station'?.055:.018)*gameSeconds);
 return {...p,energy,childEnergy,patience,exhausted:energy<=0||p.exhausted&&energy<12,childEnergyMin:Math.min(p.childEnergyMin,childEnergy),patienceMin:Math.min(p.patienceMin,patience)};
}
export function tickParent(p:ParentState,phase:Run['phase'],dt:number,gameSeconds:number,running:boolean,settleWaiting=true):ParentState{
 const sprint=phase==='station'&&running&&p.sprinting&&canParentSprint(p);
 const moving=phase==='station'&&running;
 const waiting=!moving&&settleWaiting?advanceParentWait(p,phase,dt):p;
 const energy=moving?Math.max(0,Math.min(p.maxEnergy,p.energy+(sprint?-(p.carrying?PARENT_SPRINT.carryingDrain:PARENT_SPRINT.drain):p.carrying?-.55:.55)*dt)):waiting.energy;
 const exhausted=energy<=0?true:p.exhausted&&energy<12;
 const childEnergy=moving?clamp(p.childEnergy+(p.carrying?.22:-(sprint?.72:.4))*dt):waiting.childEnergy;
 const patience=moving?clamp(p.patience-(sprint?.33:.1)*dt):waiting.patience;
 const toilet=parentToiletAfter(p.toilet,phase,gameSeconds);
 const gap=p.carrying?0:Math.max(0,Math.min(10,p.gap+(sprint&&p.syncRemaining<=0?1.65:moving?-1.5:0)*dt));
 return {...p,energy,exhausted,childEnergy,patience,toilet,gap,childEnergyMin:Math.min(p.childEnergyMin,childEnergy),patienceMin:Math.min(p.patienceMin,patience),sprinting:sprint&&!exhausted&&toilet<PARENT_SPRINT.toiletThreshold,
  carriedSeconds:p.carriedSeconds+(p.carrying&&moving?dt:0),syncRemaining:Math.max(0,p.syncRemaining-dt),blockCooldown:Math.max(0,p.blockCooldown-dt),
  syncSprintSaved:p.syncSprintSaved+(sprint&&p.syncRemaining>0?dt*TIME_SCALE*(PARENT_SPRINT.syncMultiplier-1):0)};
}
export const parentPreparation=[
 {title:'孩子说“不想上厕所”',story:'出门前最后问一次。现在去一趟，会不会换来后面的安心？',options:[
  {id:'toilet-first',label:'先去，检查好再出门',detail:'−60 秒 · 尿意归零',seconds:60},
  {id:'toilet-skip',label:'先走，到了车站再说',detail:'现在不花时间 · 路上可能尿急',seconds:0}
 ]},
 {title:'零食要不要塞进包里？',story:'孩子一路都在看你的小袋子。水壶已经带了，零食还没装。',options:[
  {id:'snacks-pack',label:'带两份小零食',detail:'负重略增 · 可安抚孩子两次',seconds:0},
  {id:'snacks-skip',label:'轻装出门',detail:'不花时间 · 后面只能安慰或现买',seconds:0}
 ]}
] as const;
export function applyParentPreparation(p:ParentState,id:string):ParentState|null{
 if(p.prepStep===0&&id==='toilet-first')return {...p,prepStep:1,toilet:0,toiletDeferred:false,childToilet:true,toiletVisits:1};
 if(p.prepStep===0&&id==='toilet-skip')return {...p,prepStep:1};
 if(p.prepStep===1&&id==='snacks-pack')return {...p,prepStep:2,snacks:2,load:p.load+4};
 if(p.prepStep===1&&id==='snacks-skip')return {...p,prepStep:2};
 return null;
}
const choose=(id:string,title:string,description:string,choices:Choice[],kind:'choice'|'hold'|'tap'='choice',required=1.5):EventConfig=>({id,title,description,phase:'station',interaction:{kind,seconds:12,penalty:0,...kind!=='choice'?{required}:{}},choices});
export function parentBlockPrompt(p:ParentState):EventConfig|null{
 if(p.blockCooldown>0)return null;
 if(p.gap>=7.5&&!p.carrying)return refreshParentPrompt(p,choose('parent-gap','“等等我！”孩子被甩在后面了','前进被迫停下。先接到孩子，不能一个人跑到检票口。',[
  {id:'wait',label:'停下等孩子',detail:'点击选择 · 等孩子跟上 −8 秒',seconds:8},
  {id:'carry',label:'回头抱起来',detail:'约 5 秒 · 后面走得慢、家长更耗体力',seconds:5}
 ]));
 if(p.toilet>=100&&!p.wetPants)return refreshParentPrompt(p,choose('parent-accident','孩子没忍住，裤子湿了','先稳住孩子。仍然可以上车，别让这一刻直接决定整局。',[{id:'comfort',label:'安慰孩子，先上车',detail:'耐心 −15 · 孩子走慢一点',seconds:8}]));
 if(p.toilet>=95&&!p.toiletDeferred)return refreshParentPrompt(p,choose('parent-toilet','“我真的想上厕所！”','最近的厕所要绕一段。现在去，还是先往检票口赶？',[
  {id:'toilet',label:'现在去厕所',detail:'−75 秒 · 尿意归零，孩子安心',seconds:75},
  {id:'defer',label:'再忍一下，先赶路',detail:'现在不花时间 · 后面可能出意外',seconds:0}
 ]));
 if(p.anger>=80)return refreshParentPrompt(p,choose('parent-rage','“今天就算不赶车，我也要揍你一顿！”','鞋带、喊累、蹲地上……你气得想发作，脚步已经停下。先决定怎么处理这股怒气。',[
  {id:'breathe',label:'忍住，深呼吸，牵好手',detail:'花 12 游戏秒 · 怒气下降，孩子安心',seconds:12,waitSeconds:12},
  {id:'lecture',label:'停下来，训孩子一顿',detail:'花 45 游戏秒 · 怒气下降，孩子更不想走',seconds:45,waitSeconds:45},
 ]));
 if(p.childEnergy<=18&&!p.carrying)return refreshParentPrompt(p,choose('parent-tired','“我走不动了。”','孩子停在路中间。抱、休息，还是慢慢牵着走？',[
  {id:'carry',label:'抱起来继续走',detail:'点击选择 · 抱起 −4 秒 · 家长更耗体力',seconds:4},
  {id:'rest',label:'坐下休息一下',detail:'−30 秒 · 孩子体力恢复',seconds:30},
  {id:'walk',label:'牵着慢慢走',detail:'−12 秒 · 稍后还可能喊累',seconds:12}
 ]));
 if(p.patience<=0)return refreshParentPrompt(p,choose('parent-patience','“我不走了！”','孩子抱着栏杆不动。先安抚，脚步才能继续。',[
  ...p.snacks>0?[{id:'snack',label:'给一份零食',detail:'消耗 1 份 · 耐心明显恢复',seconds:5}]:[],
  {id:'comfort',label:'蹲下来好好说',detail:'点击选择 · 安慰孩子 −12 秒',seconds:12},
  {id:'rest',label:'一起休息一会儿',detail:'−25 秒 · 双方都缓口气',seconds:25}
 ]));
 return null;
}
export function isParentBlock(id:string){return id.startsWith('parent-');}
const legacyParentChoiceIds:Record<string,string>={"等电梯，恢复体力": "lift", "等电梯，恢复精力": "lift", "改走楼梯": "stairs", "停下等孩子": "wait", "回头抱起来": "carry", "安慰孩子，先上车": "comfort", "现在去厕所": "toilet", "再忍一下，先赶路": "defer", "抱起来继续走": "carry", "坐下休息一下": "rest", "牵着慢慢走": "walk", "给一份零食": "snack", "蹲下来好好说": "comfort", "一起休息一会儿": "rest", "拿水壶给孩子喝": "water", "去商店买瓶水": "buy", "说好上车再买，牵手走": "defer", "把孩子抱起来": "carry", "提前分开放进托盘": "prepared", "抱着孩子直接过": "rescan", "去右侧可靠的电梯": "right", "赌左侧近电梯": "left", "买一份小包装": "buy", "答应上车再吃，先走": "defer", "牵好手继续走": "continue", "先吃一份零食": "snack", "说好上车再买": "defer", "回头买周黑鸭": "buy", "牵好孩子，看清 21A": "hold", "A 队 · 6 人，轻装旅客": "a", "B 队 · 3 人，前面大件行李多": "b", "C 队 · 8 人，双通道": "c", "走楼梯": "stairs", "去三部扶梯看看": "escalator", "等直达电梯": "lift"};
export function applyParentChoice(p:ParentState,eventId:string,label:string,seconds:number,choiceId?:string):ParentState{
 const id=choiceId??legacyParentChoiceIds[label];
 let n={...p,blockCooldown:4};
 if(isParentBlock(eventId))n.childDelaySeconds+=seconds;
 if(eventId==='parent-gap'){
  n.gap=0;n.separationCount++;n.childNegativeEvents++;
  if(id==='carry'){n.carrying=true;n.energy-=5;}else if(id==='wait')n.childEnergy=clamp(n.childEnergy+4);
 }
 if(eventId==='parent-tired'){
  n.childNegativeEvents++;if(id==='carry'){n.carrying=true;n.childEnergy=clamp(n.childEnergy+12);n.energy-=4;}
  else if(id==='rest'){n.childEnergy=clamp(n.childEnergy+36);n.patience=clamp(n.patience+8);n.energy+=7;}
  else if(id==='walk')n.childEnergy=Math.max(n.childEnergy,18);
 }
 if(eventId==='parent-patience'){
  n.patienceZero=true;n.childNegativeEvents++;
  if(id==='snack'&&n.snacks>0){n.snacks--;n.load=Math.max(30,n.load-2);n.snacksUsed++;n.patience=clamp(n.patience+42);}
  else if(id==='rest'){n.patience=clamp(n.patience+32);n.energy+=5;}else if(id==='comfort')n.patience=clamp(n.patience+26);
 }
 if(eventId==='parent-toilet'){
  n.childNegativeEvents++;if(id==='toilet'){n.toilet=0;n.toiletDeferred=false;n.childToilet=true;n.toiletVisits++;n.patience=clamp(n.patience+8);}
  else if(id==='defer'){n.toiletDeferred=true;n.toilet=Math.max(96,n.toilet);n.patience=clamp(n.patience-5);}
 }
 if(eventId==='parent-accident'){n.wetPants=true;n.childNegativeEvents++;n.toilet=50;n.patience=clamp(n.patience-15);n.childEnergy=clamp(n.childEnergy-8);}
 if(eventId==='child-shoelace'){
  n.childDelaySeconds+=seconds;n.childNegativeEvents++;n.anger=clamp(n.anger+25);
  if(id==='drag'){n.childEnergy=clamp(n.childEnergy-6);n.anger=clamp(n.anger+10);}
 }
 if(eventId==='child-distraction'){
  n.childDelaySeconds+=seconds;n.childNegativeEvents++;n.anger=clamp(n.anger+35);
  if(id==='carry'){n.carrying=true;n.gap=0;n.energy-=4;}
  if(id==='comfort')n.patience=clamp(n.patience+10);
  if(id==='shout'){n.patience=clamp(n.patience-25);n.anger=clamp(n.anger+20);}
 }
 if(['parent-gap','parent-tired','parent-toilet','parent-patience','parent-accident'].includes(eventId))n.anger=clamp(n.anger+18);
 if(['sh-parent-shop','wh-parent-duck','wh-parent-duck-repeat','gz-parent-carry'].includes(eventId))n.anger=clamp(n.anger+12);
 if(eventId==='parent-rage'){
  n.outbursts++;n.rageDelaySeconds+=seconds;
  n.anger=clamp(n.anger-(id==='lecture'?75:65));
  n.patience=clamp(n.patience+(id==='lecture'?-18:8));
 }
 n.angerPeak=Math.max(n.angerPeak,n.anger);
 if(eventId==='gz-parent-carry'){n.carrying=true;n.gap=0;n.childEnergy=clamp(n.childEnergy+8);}
 if(eventId==='gz-lift')n.energy+=id==='stairs'?-22:id==='lift'?25:0;
 if(eventId==='vertical-choice'){
  if(id==='stairs')n.childEnergy=clamp(n.childEnergy-18);
  if(id==='lift'){n.childEnergy=clamp(n.childEnergy+12);n.patience=clamp(n.patience-6);}
 }
 if(eventId==='bj-parent-strict'&&id==='rescan'){n.patience=clamp(n.patience-12);n.childNegativeEvents++;}
 if(eventId==='hz-parent-lift'&&id==='right'){n.energy+=5;n.childEnergy=clamp(n.childEnergy+5);}
 if(eventId==='wh-parent-duck'){
  if(id==='buy'){n.duckBought=true;n.patience=clamp(n.patience+30);}
  else if(id==='defer'){n.duckRefused=true;n.patience=clamp(n.patience-17);n.childNegativeEvents++;}
 }
 if(eventId==='wh-parent-duck-repeat'){
  if(id==='snack'&&n.snacks>0){n.snacks--;n.load=Math.max(30,n.load-2);n.snacksUsed++;n.patience=clamp(n.patience+22);}
  else if(id==='buy'){n.duckBought=true;n.patience=clamp(n.patience+30);}
  else if(id==='defer')n.patience=clamp(n.patience-9);
 }
 if(eventId==='zz-parent-child'&&id==='hold')n.gap=0;
 if(eventId==='sh-parent-shop'){
  if(id==='water'&&n.water>0){n.water--;n.patience=clamp(n.patience+14);n.toilet=clamp(n.toilet+6);}
  else if(id==='buy'){n.water++;n.load+=2;n.patience=clamp(n.patience+20);}
  else if(id==='defer'){n.patience=clamp(n.patience-15);n.childNegativeEvents++;}
 }
 n.energy=Math.max(0,Math.min(n.maxEnergy,n.energy));
 n.exhausted=n.energy<=0||p.exhausted&&n.energy<12;
 n.childEnergyMin=Math.min(n.childEnergyMin,n.childEnergy);
 n.patienceMin=Math.min(n.patienceMin,n.patience);
 return n;
}
type ParentResource='energy'|'childEnergy'|'patience'|'load'|'toilet'|'anger';
const resourceNames:Record<ParentResource,string>={energy:'家长精力',childEnergy:'孩子体力',patience:'耐心',load:'负重',toilet:'饮水尿意',anger:'怒气'};
// The same effect function feeds previews and settlement; fixed time is charged by the engine.
const parentChoiceDetails:Record<string,Record<string,{hint?:string;resources:ParentResource[]}>>={
 'child-shoelace':{help:{hint:'蹲下系好鞋带，再牵手走',resources:['anger']},drag:{hint:'鞋带仍松着，孩子更累',resources:['childEnergy','anger']}},
 'child-distraction':{comfort:{hint:'劝孩子起来再走',resources:['patience','anger']},carry:{hint:'抱着继续走，更慢、更耗体力',resources:['energy','anger']},shout:{hint:'孩子更不愿意走，怒气仍会累积',resources:['patience','anger']}},
 'parent-rage':{breathe:{hint:'稳住情绪再继续',resources:['anger','patience']},lecture:{hint:'耽误更久，孩子更不愿意走',resources:['anger','patience']}},
 'parent-gap':{wait:{hint:'点击选择后等孩子跟上，掉队距离归零',resources:['childEnergy']},carry:{hint:'抱起后走得慢、家长更耗体力',resources:['energy']}},
 'parent-tired':{carry:{hint:'抱起后走得慢、家长更耗体力',resources:['energy','childEnergy']},rest:{resources:['energy','childEnergy','patience']},walk:{hint:'孩子仍可能喊累',resources:['childEnergy']}},
 'parent-patience':{snack:{hint:'消耗 1 份零食',resources:['patience','load']},comfort:{hint:'点击选择后安慰孩子，再继续走',resources:['patience']},rest:{resources:['energy','patience']}},
 'parent-toilet':{toilet:{hint:'尿意归零',resources:['patience']},defer:{hint:'尿意至少 96，后面可能出意外',resources:['patience']}},
 'parent-accident':{comfort:{hint:'尿意回落到 50',resources:['patience','childEnergy']}},
 'gz-parent-carry':{carry:{hint:'按住抱起，后续走得慢、家长更耗体力',resources:['childEnergy']}},
 'gz-lift':{lift:{hint:'等候电梯',resources:['energy']},stairs:{hint:'抱着孩子走楼梯',resources:['energy']}},
 'vertical-choice':{stairs:{resources:['childEnergy']},lift:{resources:['childEnergy','patience']}},
 'bj-parent-strict':{rescan:{hint:'被叫回来重新检查',resources:['patience']}},
 'hz-parent-lift':{right:{hint:'多走一段，顺利上楼',resources:['energy','childEnergy']}},
 'wh-parent-duck':{buy:{hint:'后面不再讨要周黑鸭',resources:['patience']},defer:{hint:'后面还会再喊',resources:['patience']}},
 'wh-parent-duck-repeat':{snack:{hint:'消耗 1 份零食',resources:['patience','load']},buy:{resources:['patience']},defer:{resources:['patience']}},
 'sh-parent-shop':{water:{hint:'消耗 1 瓶水',resources:['patience','toilet']},buy:{hint:'获得 1 瓶水',resources:['patience','load']},defer:{resources:['patience']}}
};
export function parentWaitOverrides(eventId:string,choice:Choice):ParentWaitResource[]{
 const id=choice.id??legacyParentChoiceIds[choice.label];
 return (parentChoiceDetails[eventId]?.[id]?.resources??[]).filter((key):key is ParentWaitResource=>key==='energy'||key==='childEnergy'||key==='patience');
}
export function refreshParentPrompt(p:ParentState,event:EventConfig):EventConfig{
 const details=parentChoiceDetails[event.id];if(!details)return event;
 return {...event,choices:event.choices.map(c=>{
  const id=c.id??legacyParentChoiceIds[c.label],detail=details[id];if(!detail)return c;
  const after=applyParentChoice(p,event.id,c.label,c.seconds,id);
  const changes=detail.resources.map(key=>{
   const delta=after[key]-p[key],value=Math.round(Math.abs(delta)*100)/100;
   const full=delta===0&&(key==='energy'?p.energy>=p.maxEnergy:key!=='load'&&p[key]>=100);
   return `${resourceNames[key]} ${delta<0?'−':'+'}${value}${full?'（已满，无恢复收益）':''}`;
  });
  let decision=c.stationDecision;
  if(decision&&event.id==='gz-lift')decision={...decision,optimal:id==='lift'?p.energy<25:p.energy>=25};
  if(decision&&event.id==='vertical-choice')decision={...decision,optimal:id==='lift'?p.childEnergy<30:p.childEnergy>=30};
  if(decision&&event.id==='wh-parent-duck'&&id==='buy')decision={...decision,optimal:p.patience<30};
  return {...c,id,stationDecision:decision,detail:[c.seconds?`−${c.seconds} 秒`:'不额外扣时',detail.hint,...changes].filter(Boolean).join(' · ')};
 })};
}
export function parentStationPrompt(s:Run,id:string):EventConfig|undefined{
 const prompt=parentStationPromptBase(s,id);
 return prompt&&s.parent?refreshParentPrompt(s.parent,prompt):prompt;
}
function parentStationPromptBase(s:Run,id:string):EventConfig|undefined{
 const p=s.parent;if(!p)return undefined;
 if(id==='child-shoelace')return choose(id,'“鞋带又开了，等等我！”','你刚想加速，孩子停下来指着鞋子。前面还有一段路。',[
  {id:'help',label:'蹲下系好，再牵手走',detail:'花 8 游戏秒',seconds:8},
  {id:'drag',label:'先牵着走，马上就到了',detail:'现在不花时间 · 孩子体力下降，怒气更高',seconds:0},
 ]);
 if(id==='child-distraction')return choose(id,'孩子蹲在地上：“我要看这块地砖。”','你已经催了好几次，他偏偏在这时候不肯走。怒气一点点往上冒。',[
  {id:'comfort',label:'蹲下来劝他起来',detail:'花 10 游戏秒',seconds:10,waitSeconds:10},
  {id:'carry',label:'抱起来，先继续走',detail:'花 4 游戏秒 · 抱娃更慢、更耗体力',seconds:4},
  {id:'shout',label:'大声催他，快点走！',detail:'现在不花时间 · 孩子耐心下降，怒气更高',seconds:0},
 ]);
 if(id==='gz-lift')return choose(id,'中区电梯排队，改走楼梯吗？','抱着孩子等电梯，可以恢复家长精力；楼梯省等候，但更耗家长体力。',[
  {id:'lift',label:'等电梯，恢复精力',detail:'',seconds:45,stationDecision:{group:id,value:'lift',category:'mixed',optimal:p.energy<25}},
  {id:'stairs',label:'改走楼梯',detail:'',seconds:12,stationDecision:{group:id,value:'stairs',category:'mixed',optimal:p.energy>=25}}
 ]);
 if(id==='sh-parent-shop')return choose(id,'“我想买水！就在那边。”','虹桥长廊还没走完，孩子被商店吸引住了。水壶里还有水，先处理好才肯继续走。',[
  ...p.water>0?[{id:'water',label:'拿水壶给孩子喝',detail:'−3 秒 · 耐心恢复，尿意略增',seconds:3}]:[],
  {id:'buy',label:'去商店买瓶水',detail:'−35 秒 · 孩子安静下来',seconds:35},
  {id:'defer',label:'说好上车再买，牵手走',detail:'现在不花时间 · 耐心 −15',seconds:0}
 ]);
 if(id==='gz-parent-carry')return choose(id,'一路都是抱着走的小孩','孩子看了一圈，也伸出双手：“我也要抱！”今天这段路，得带着孩子一起过去。',[{id:'carry',label:'把孩子抱起来',detail:'按住抱起 · 后续速度和精力受负重影响',seconds:0}],'hold',1.8);
 if(id==='bj-parent-strict')return choose(id,'北京南安检，真的一件也不能省',`安检员指着托盘：“孩子的水壶、${p.snacks>0?'零食、':''}包，都要分开放。请按顺序来。”`,[
  {id:'prepared',label:'提前分开放进托盘',detail:'−20 秒 · 严格检查，一次通过',seconds:20,stationDecision:{group:id,value:'prepared',category:'queue',optimal:true}},
  {id:'rescan',label:'抱着孩子直接过',detail:'被叫回来重新检查 · −65 秒',seconds:65,stationDecision:{group:id,value:'rescan',category:'queue',optimal:false}}
 ]);
 if(id==='hz-parent-lift')return choose(id,'左边电梯近，右边电梯远','左侧电梯上个月就坏了，维修牌还挂着；右侧要多走一段，但你知道肯定能用。',[{id:'right',label:'去右侧可靠的电梯',detail:'多走一段 · −18 秒 · 顺利上楼',seconds:18,stationDecision:{group:id,value:'right',category:'vertical',optimal:true}},{id:'left',label:'赌左侧近电梯',detail:'仍在维修，折返 · −65 秒',seconds:65,stationDecision:{group:id,value:'left',category:'vertical',optimal:false}}]);
 if(id==='wh-parent-duck')return choose(id,p.appearance==='mom'?'“妈妈，我要吃周黑鸭！”':'“爸爸，我要吃周黑鸭！”','武汉站的周黑鸭柜台就在换层口。孩子一路盯着招牌，拉着你不走。',[
  {id:'buy',label:'买一份小包装',detail:'−45 秒 · 后面安静下来',seconds:45,stationDecision:{group:id,value:'buy',category:'vertical',optimal:p.patience<30,skip:['wh-parent-duck-repeat']}},
  {id:'defer',label:'答应上车再吃，先走',detail:'现在不花时间 · 后面还会再喊',seconds:0}
 ]);
 if(id==='wh-parent-duck-repeat')return choose(id,p.duckBought?'周黑鸭已经拿好了':'“周黑鸭呢？我现在就想吃！”',p.duckBought?'孩子抱着小包装，你们继续赶路。':'刚走到出发层，孩子又停了下来。安慰、拿零食，还是回头买？',p.duckBought?[{id:'continue',label:'牵好手继续走',detail:'不再耽误',seconds:0}]:[
  ...p.snacks>0?[{id:'snack',label:'先吃一份零食',detail:'−5 秒 · 消耗 1 份零食',seconds:5}]:[],
  {id:'defer',label:'说好上车再买',detail:'−12 秒 · 耐心继续下降',seconds:12},
  {id:'buy',label:'回头买周黑鸭',detail:'−55 秒 · 孩子安静下来',seconds:55}
 ]);
 if(id==='zz-parent-child')return choose(id,'孩子被左右两边一样的大厅看花了','一边有老乡招手，一边是 21A 指示。孩子想往另一边跑，先牵好手再认编号。',[{id:'hold',label:'牵好孩子，看清 21A',detail:'按住确认，再去正确的右翼',seconds:0}],'hold',1.5);
 if(id==='security-queue')return choose(id,'三条安检队，孩子站久了会烦躁','先看每队的行李和检查速度。北京南的流程尤其严格，别只数人数。',[
  {id:'a',label:'A 队 · 6 人，轻装旅客',detail:'推进快 · −24 秒',seconds:24,stationDecision:{group:id,value:'a',category:'queue',optimal:true}},
  {id:'b',label:'B 队 · 3 人，前面大件行李多',detail:'看着短，开包慢 · −55 秒',seconds:55,stationDecision:{group:id,value:'b',category:'queue',optimal:false}},
  {id:'c',label:'C 队 · 8 人，双通道',detail:'比较稳 · −32 秒',seconds:32,stationDecision:{group:id,value:'c',category:'queue',optimal:false}}
 ]);
 if(id==='vertical-choice')return choose(id,'牵着孩子上楼，选哪条路？','楼梯省等候却消耗孩子体力；电梯能让孩子恢复体力，等待会消耗耐心。',[
  {id:'stairs',label:'走楼梯',detail:'−12 秒 · 孩子体力 −18',seconds:12,stationDecision:{group:id,value:'stairs',category:'vertical',optimal:p.childEnergy>=30}},
  {id:'escalator',label:'去三部扶梯看看',detail:'随机畅通或拥堵',seconds:0,stationDecision:{group:id,value:'escalator',category:'vertical',optimal:true}},
  {id:'lift',label:'等直达电梯',detail:'−38 秒 · 孩子体力 +12',seconds:38,stationDecision:{group:id,value:'lift',category:'vertical',optimal:p.childEnergy<30}}
 ]);
 if(id==='escalator-ride'){
  const mode=[...s.stationDecisions].reverse().find(d=>d.group==='vertical-choice')?.value;
  if(mode==='stairs'||mode==='lift')return choose(id,mode==='stairs'?'扶好孩子，一起上楼':'电梯到了，牵好手进来',mode==='stairs'?'孩子体力已在选楼梯时扣除；连点完成上楼。':'按住等所有人出电梯，再一起进去。',[{label:mode==='stairs'?'上到出发层':'牵手进电梯',detail:'完成换层',seconds:0}],mode==='stairs'?'tap':'hold',mode==='stairs'?4:2);
 }
 return undefined;
}
