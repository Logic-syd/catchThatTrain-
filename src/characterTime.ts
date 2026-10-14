import {STOP_BEFORE} from './gameClock';
import {applyWorkChallenge,workChallengePrompt} from './characterChallenges';
import type {Run} from './engine';
import {movementFactor} from './studentConfig';
import type {RunnerState} from './runner';
import type {Choice,EventConfig} from './data';
export interface CharacterTimeState {
 characterId:'worker'|'tourist';
 prepStep:number;
 workPending:number;workInterruptions:number;workCalls:number;
 energy:number;
 maxEnergy:number;
 energyReserve:number;
 energyReserveUsed:number;
 fatigue:number;
 load:number;
 focus:number;
 bossUnread:boolean;
 ignoredWork:boolean;
 bossCalls:number;
 motherStayed:boolean;
 souvenirs:boolean;
 coffee:boolean;
 slept:boolean;sleeping:boolean;
 alarmStops:number;
 mapChecked:boolean;
 wheelDamaged:boolean;
 actualDelay:number;bossCallsLeft:number;wrongWayRisk:boolean;sprinting:boolean;exhausted:boolean;runner:RunnerState;
}
export interface TimedChoice {id:string;label:string;detail:string;seconds:number;energy?:number;storeSurplus?:boolean;fatigue?:number;load?:number;focus?:number;set?:Partial<CharacterTimeState>}
export interface TimedPrompt {eyebrow:string;title:string;story:string;choices:TimedChoice[]}
export const ENERGY_RESERVE_CAP=10;
export const TOURIST_WHEEL_RULES={speedMultiplier:.9,extraDrain:1} as const;
const CHARACTER_RESOURCE_PROFILES={
 worker:{drain:5,recover:1.15,rest:3.5,fatigue:.001},
 tourist:{drain:6,recover:.9,rest:2.5,fatigue:.003}
} as const;
export const fatigueRecoveryFactor=(fatigue:number)=>fatigue>=80?.75:fatigue>=60?.85:1;
const resourceClamp=(value:number,max=100)=>Math.max(0,Math.min(max,value));
const amount=(value:number)=>Number(value.toFixed(2)).toString();
function energyBenefit(t:CharacterTimeState,gain:number){
 const restored=Math.min(gain,Math.max(0,t.maxEnergy-t.energy));
 return {restored,stored:Math.min(gain-restored,Math.max(0,ENERGY_RESERVE_CAP-(t.energyReserve??0)))};
}
function preparationEnergyDetail(t:CharacterTimeState,gain:number){
 const {restored,stored}=energyBenefit(t,gain);
 return `${restored>0?`精力 +${amount(restored)}`:'精力已满'} · ${stored>0?`精力储备 +${amount(stored)}（站内移动时补充）`:(t.energyReserve??0)>=ENERGY_RESERVE_CAP?'精力储备已满':'精力储备 +0'}`;
}
function resourceDetail(label:string,current:number,change:number,max=100){const actual=resourceClamp(current+change,max)-resourceClamp(current,max);return `${label} ${actual<0?'−':'+'}${amount(Math.abs(actual))}`;}
function boundResources(t:CharacterTimeState):CharacterTimeState{
 const energy=resourceClamp(t.energy,t.maxEnergy),exhausted=energy<=.01?true:energy>=10?false:t.exhausted;
 return {...t,energy,exhausted,sprinting:exhausted?false:t.sprinting,energyReserve:resourceClamp(t.energyReserve??0,ENERGY_RESERVE_CAP),energyReserveUsed:Math.max(0,t.energyReserveUsed??0),fatigue:resourceClamp(t.fatigue),load:resourceClamp(t.load),focus:resourceClamp(t.focus)};
}
/** Called only after the resource tick for actual station movement. */
export function consumeEnergyReserve(t:CharacterTimeState):CharacterTimeState{
 const used=Math.min(Math.max(0,t.energyReserve??0),Math.max(0,t.maxEnergy-t.energy));
 return {...t,energy:t.energy+used,energyReserve:(t.energyReserve??0)-used,energyReserveUsed:(t.energyReserveUsed??0)+used};
}
/** Passive time uses debited game seconds; fixed task effects replace excluded fields. */
export function advanceCharacterWait(t:CharacterTimeState,gameSeconds:number,excluded:readonly ('energy'|'fatigue')[]=[]):CharacterTimeState{
 if(!Number.isFinite(gameSeconds)||gameSeconds<=0)return t;
 const profile=CHARACTER_RESOURCE_PROFILES[t.characterId],decay=profile.fatigue*.25;
 const startFatigue=resourceClamp(t.fatigue),changesFatigue=!excluded.includes('fatigue');
 const fatigue=changesFatigue?resourceClamp(startFatigue-decay*gameSeconds):startFatigue;
 let weightedSeconds=gameSeconds;
 if(t.characterId==='tourist'){
  if(!changesFatigue)weightedSeconds*=fatigueRecoveryFactor(startFatigue);
  else {
   // Integrate each fatigue band, so splitting a wait cannot change its recovery.
   // A decreasing fatigue exactly on a boundary spends no time in the higher band.
   const high=Math.min(gameSeconds,Math.max(0,(startFatigue-80)/decay));
   const middle=Math.min(gameSeconds-high,Math.max(0,(Math.min(startFatigue,80)-60)/decay));
   weightedSeconds=high*.75+middle*.85+(gameSeconds-high-middle);
  }
 }
 const energy=resourceClamp(t.energy+(excluded.includes('energy')?0:profile.rest*weightedSeconds),t.maxEnergy);
 const exhausted=energy<=.01?true:energy>=10?false:t.exhausted;
 return {...t,energy,fatigue,exhausted,sprinting:exhausted?false:t.sprinting};
}
/** Semantic overrides apply even when the explicit gain is clipped to zero. */
export function characterWaitOverrides(eventId:string,choice:Choice):('energy'|'fatigue')[]{
 const selected=(id:string,label:string)=>choice.id?choice.id===id:choice.label===label;
 if(eventId==='vertical-choice'&&(selected('lift','等直达电梯')||selected('stairs','走楼梯')))return ['energy'];
 if(eventId==='gz-lift'&&(selected('lift','等电梯，恢复体力')||selected('stairs','改走楼梯')))return ['energy'];
 if(eventId==='tourist-sleep'&&TOURIST_SLEEP_OPTIONS.some(o=>selected(o.id,o.label)))return ['energy','fatigue'];
 if(eventId==='tourist-wake')return ['energy'];
 if(eventId==='zz-hometown-answer'&&selected('low-salary','说工资 5000'))return ['energy'];
 return [];
}
/** dt is real input time; fixed event costs never call this recovery/consumption tick. */
export function tickCharacterResources(t:CharacterTimeState,dt:number,running:boolean):CharacterTimeState{
 if(!Number.isFinite(dt)||dt<=0)return t;
 let n=boundResources(t);
 const sprint=running&&n.sprinting&&!n.exhausted;
 const profile=CHARACTER_RESOURCE_PROFILES[n.characterId];
 const fatigueRecovery=fatigueRecoveryFactor(n.fatigue);
 // Fatigue slows recovery; it never makes sprinting cheaper.
 const delta=(sprint?-profile.drain:(running?profile.recover:profile.rest)*(n.characterId==='tourist'?fatigueRecovery:1))*dt;
 const wheelDrain=running&&n.characterId==='tourist'&&n.wheelDamaged?TOURIST_WHEEL_RULES.extraDrain*dt:0;
 n.energy=resourceClamp(n.energy+delta-wheelDrain,n.maxEnergy);
 if(running)n=consumeEnergyReserve(n);
 if(n.energy<=.01){n.exhausted=true;n.sprinting=false;}else if(n.energy>=10)n.exhausted=false;
 n.fatigue=resourceClamp(n.fatigue+(running?profile.fatigue*dt:-profile.fatigue*.25*dt));
 return n;
}
export const TOURIST_SLEEP_OPTIONS=[
 {id:'alarm-3',label:'提前 3 站叫醒',alarmStops:3,energy:8,fatigue:6,risk:'早点醒，留出确认站名的余量'},
 {id:'alarm-2',label:'提前 2 站叫醒',alarmStops:2,energy:14,fatigue:12,risk:'恢复与提前确认兼顾'},
 {id:'alarm-1',label:'提前 1 站叫醒',alarmStops:1,energy:20,fatigue:20,risk:'较晚醒，留意站名，别睡过站'}
] as const;
function sleepChoices(t:CharacterTimeState):Choice[]{
 return [...TOURIST_SLEEP_OPTIONS.map(o=>({id:o.id,label:o.label,seconds:0,
  detail:`利用地铁行程，不额外扣时 · ${t.energy>=t.maxEnergy?'精力已满':`精力 +${Math.min(o.energy,t.maxEnergy-t.energy).toFixed(1).replace(/\.0$/,'')}`} · 疲劳 −${Math.min(o.fatigue,t.fatigue).toFixed(1).replace(/\.0$/,'')} · ${o.risk}`})),
  {id:'awake',label:'撑着，盯紧站名',detail:'不补觉、不额外扣时 · 不需要闹钟叫醒',seconds:0}];
}
export const characterTimeProfiles={
 student:{label:'背包大学生',agility:80,maxEnergy:90,energy:90,fatigue:0,load:15,focus:55,baseSpeed:1,sprintSpeed:1.9,walkRecovery:2.2,restRecovery:5,fatigueRecovery:0,description:'精力和手机都满格，唯一的问题是总觉得还来得及。'},
 worker:{label:'打工人',agility:60,maxEnergy:60,energy:60,fatigue:0,load:35,focus:85,baseSpeed:.9,sprintSpeed:1.65,walkRecovery:1.15,restRecovery:3.5,fatigueRecovery:0,description:'从家里返工，妈妈不断往箱子里塞东西；路线熟，负重是麻烦。'},
 tourist:{label:'疲惫游客',agility:55,maxEnergy:35,energy:35,fatigue:70,load:30,focus:50,baseSpeed:.86,sprintSpeed:1.55,walkRecovery:CHARACTER_RESOURCE_PROFILES.tourist.recover,restRecovery:CHARACTER_RESOURCE_PROFILES.tourist.rest,fatigueRecovery:-CHARACTER_RESOURCE_PROFILES.tourist.fatigue*.25,description:'已退房，在陌生城市走了两万多步；必须赶回家上班。'},
} as const;
export function createCharacterTimeState(id:'worker'|'tourist',rng:()=>number=Math.random):CharacterTimeState{const p=characterTimeProfiles[id];return {characterId:id,prepStep:0,workPending:0,workInterruptions:0,workCalls:0,energy:p.energy,maxEnergy:p.maxEnergy,energyReserve:0,energyReserveUsed:0,fatigue:p.fatigue,load:p.load,focus:p.focus,bossUnread:false,ignoredWork:false,bossCalls:0,bossCallsLeft:0,motherStayed:false,souvenirs:false,coffee:false,slept:false,sleeping:false,alarmStops:2,mapChecked:false,wheelDamaged:false,actualDelay:0,wrongWayRisk:rng()<.35,sprinting:false,exhausted:false,runner:{lane:1,wave:0,blocked:false,collisions:0,dodges:0,seed:Math.floor(rng()*3)}};}
export function timedPrompt(s:Run):TimedPrompt|undefined{
 const t=s.characterTime;if(!t)return;
 if(t.characterId==='worker'){
  if(t.prepStep===0)return {eyebrow:'出门前 · 家门口',title:'妈把一袋土特产放进箱子：“这个也带上。”',story:'行李已经收好了，明早九点还得回去上班。',choices:[{id:'take-gifts',label:'带上，妈特地准备的',detail:`${resourceDetail('负重',t.load,15)} · 剧情收藏：妈妈的土特产`,seconds:0,load:15,set:{souvenirs:true}},{id:'leave-gifts',label:'先不带了，轻装赶车',detail:'不增加负重 · 妈妈嘴上说好，还是有点舍不得',seconds:0}]};
  if(t.prepStep===1)return {eyebrow:'出门前 · 再吃两口',title:'妈：“吃完再走，路上就不用找东西了。”',story:'厨房里还热着饭菜，行李箱旁边已经多了两袋吃的。',choices:[{id:'eat',label:'再吃两口，马上走',detail:`−60 秒 · ${preparationEnergyDetail(t,10)}`,seconds:60,energy:10,storeSurplus:true,set:{motherStayed:true}},{id:'leave',label:'真得走了，到了发消息',detail:'不花时间 · 妈妈送你到门口',seconds:0}]};
  return {eyebrow:'出门前 · 工作群',title:'老板又发来消息：“明早九点，别迟到。”',story:'假期结束了，你不得不回去上班。老板还在催，箱子里全是妈妈塞的东西。',choices:[{id:'reply',label:'回一句“知道了”，关掉手机',detail:`−20 秒 · ${resourceDetail('专注',t.focus,5)} · 不再追着问`,seconds:20,focus:5,set:{bossUnread:false,bossCallsLeft:0}},{id:'ignore',label:'先静音，赶车要紧',detail:`现在不花时间 · ${resourceDetail('专注',t.focus,-3)} · 路上老板还可能打来`,seconds:0,focus:-3,set:{bossUnread:true,bossCallsLeft:2}}]};
 }
 if(t.prepStep===0)return {eyebrow:'出门前 · 已退房',title:'今日步数 23,487。你真的不想再动了。',story:'酒店已经退房，今晚只有这趟车能赶回家上班。要不要先缓口气？',choices:[{id:'coffee',label:'买杯咖啡提神',detail:`−50 秒 · ${preparationEnergyDetail(t,10)} · ${resourceDetail('疲劳',t.fatigue,-15)}`,seconds:50,energy:10,storeSurplus:true,fatigue:-15,set:{coffee:true}},{id:'rest',label:'靠着小箱子坐一会',detail:`−30 秒 · ${preparationEnergyDetail(t,10)} · ${resourceDetail('疲劳',t.fatigue,-5)}`,seconds:30,energy:10,storeSurplus:true,fatigue:-5},{id:'go',label:'起来就走，车上再休息',detail:'不花时间 · 保留地铁补觉机会',seconds:0}]};
 if(t.prepStep===1)return {eyebrow:'出门前 · 小号行李箱',title:'一个小箱子，一个背包。纪念品要不要留下？',story:'不是行李太多，是你已经走了一整天，腿有点发沉。',choices:[{id:'keep',label:'纪念品带回家',detail:`${resourceDetail('负重',t.load,5)} · 剧情收藏：旅行纪念品`,seconds:0,load:5,set:{souvenirs:true}},{id:'light',label:'先放下，轻装赶车',detail:`${resourceDetail('负重',t.load,-5)} · 陌生站里更好走`,seconds:0,load:-5}]};
 // Sleep is selected on the metro, never as an extra paid preparation step.
 return undefined;
}
function rawCharacterEventPrompt(s:Run,id:string):EventConfig|undefined{
 const t=s.characterTime;if(!t)return undefined;
 const work=workChallengePrompt(id,t);if(work)return work;
 if(id==='worker-boss-call'&&t.bossCallsLeft>0)return {id,phase:'station' as const,title:t.bossCallsLeft===1?'老板又打来了：“你到底看没看消息？”':'手机又震了：老板发来一条语音',description:'你已经在赶车，工作群还在持续催。接电话会占用赶路时间。',interaction:{kind:'choice' as const,seconds:10,penalty:18},choices:[{label:'接起来，说明正在回程',detail:'花 35 秒 · 专注 +5',seconds:35},{label:'挂掉，继续赶车',detail:'不花时间 · 老板可能再打来',seconds:0}]};
 if(id==='tourist-sleep')return {id,phase:'metro' as const,title:'车厢晃得人睁不开眼，要睡一会吗？',description:'地铁照常行驶，补觉不增加路程时间。设好闹钟，响了就及时确认站名。',interaction:{kind:'choice' as const,seconds:12,penalty:20},choices:sleepChoices(t)};
 if(id==='tourist-wake')return {id,phase:'metro' as const,title:'到站了！闹钟响了，醒醒！',description:'点击按钮快速确认站名。反应慢了会被带过站，再花时间折返。',interaction:{kind:'tap' as const,seconds:3,penalty:80,required:1},choices:[{label:'醒醒！',detail:'立刻醒来，看清站名后决定是否下车',seconds:0},{label:'再睡一下',detail:'闹钟没叫醒你 · 坐过站并折返',seconds:80}]};
 if(id==='tourist-wheel')return {id,phase:'station' as const,title:'行李箱轮子卡住了！',description:'轮子卡住让箱子一直往旁边偏。调整后正常移动；硬拖的阻力持续到本局结束。',interaction:{kind:'choice' as const,seconds:10,penalty:18},choices:[{id:'repair',label:'停下来调整轮子',detail:'多花 20 秒 · 恢复正常移动，不再有轮子额外消耗',seconds:20},{id:'drag',label:'先硬拖着赶路',detail:`不花时间 · 本局移动速度 −${amount((1-TOURIST_WHEEL_RULES.speedMultiplier)*100)}% · 实际移动每秒额外消耗 ${TOURIST_WHEEL_RULES.extraDrain} 精力`,seconds:0}]};
 if(id==='tourist-wayfinding')return {id,phase:'station' as const,title:t.mapChecked?'这里的指示牌怎么又变了？':'出口好多，哪个才是铁路出发？',description:t.focus<35?'走了一整天，字都看花了。陌生车站里人流也可能带错方向。':'先看清铁路出发标识，跟着人群不一定对。',interaction:{kind:'choice' as const,seconds:10,penalty:18},choices:[{label:'停一下，看楼层地图',detail:'花 12 秒确认方向 · 记住路线',seconds:12},{label:'跟着人流先走',detail:t.wrongWayRisk?'看着像近路，可能要折返':'顺着人流，不花确认时间',seconds:t.wrongWayRisk?42:0}]};
 return undefined;
}
export function characterEventPrompt(s:Run,id:string):EventConfig|undefined{
 const event=rawCharacterEventPrompt(s,id);return event&&s.characterTime?refreshCharacterPrompt(s.characterTime,event):event;
}
/** Refresh from current resources, preserving the event's costs and interactions. */
export function refreshCharacterPrompt(t:CharacterTimeState,event:EventConfig):EventConfig{
 const energy=(change:number)=>resourceDetail('精力',t.energy,change,t.maxEnergy);
 const focus=(change:number)=>resourceDetail('专注',t.focus,change);
 if(event.id==='tourist-sleep')return {...event,choices:sleepChoices(t)};
 const choices=event.choices.map(c=>{
  const matches=(id:string,label:string)=>c.id?c.id===id:c.label===label;
  if(event.id==='gz-lift'||event.id==='vertical-choice'){
   const gz=event.id==='gz-lift';
   if(matches('stairs',gz?'改走楼梯':'走楼梯'))return {...c,id:'stairs',detail:`${c.seconds?`花 ${c.seconds} 秒`:'省等候'} · ${energy(-22)}`};
   if(matches('lift',gz?'等电梯，恢复体力':'等直达电梯'))return {...c,id:'lift',detail:`等候 ${c.seconds} 秒 · ${energy(gz?25:15)}`};
   if(matches('escalator','去三部扶梯看看'))return {...c,id:'escalator'};
  }
  if(event.id==='zz-hometown-answer'){
   if(matches('truth','说真话'))return {...c,id:'truth',detail:`老乡开口借钱 · ${focus(-10)}`};
   if(matches('low-salary','说工资 5000'))return {...c,id:'low-salary',detail:`被嘲讽 · ${focus(-5)} · ${energy(5)}`};
  }
  if(event.id==='worker-boss-call'){
   if(matches('answer','接起来，说明正在回程'))return {...c,id:'answer',detail:`花 ${c.seconds} 秒 · ${focus(5)} · 不再追着问`};
   if(matches('ignore','挂掉，继续赶车'))return {...c,id:'ignore'};
  }
  if(event.id==='tourist-wake'){
   if(matches('wake','醒醒！'))return {...c,id:'wake',detail:`立刻醒来，看清站名后决定是否下车 · ${energy(4)}`};
   if(matches('oversleep','再睡一下'))return {...c,id:'oversleep',detail:`闹钟没叫醒你 · 坐过站并折返 ${c.seconds} 秒 · ${energy(-6)}`};
  }
  if(event.id==='tourist-wayfinding'){
   if(matches('map','停一下，看楼层地图'))return {...c,id:'map',detail:`花 ${c.seconds} 秒确认方向 · 记住路线 · ${focus(4)}`};
   if(matches('crowd','跟着人流先走'))return {...c,id:'crowd',detail:t.wrongWayRisk?`跟错方向，折返 ${c.seconds} 秒 · ${focus(-5)}`:c.detail};
  }
  return c;
 });
 return {...event,choices};
}
export function applyCharacterEvent(s:Run,eventId:string,choiceLabel:string,choiceId?:string):Run{
 const t=s.characterTime;if(!t)return s;let n=applyWorkChallenge({...t},eventId,choiceId);
 const chosen=(id:string,label:string)=>choiceId?choiceId===id:choiceLabel===label;
 if(eventId==='zz-hometown-answer'){
  if(chosen('truth','说真话'))n.focus=Math.max(0,n.focus-10);
  if(chosen('low-salary','说工资 5000')){n.focus=Math.max(0,n.focus-5);n.energy=Math.min(n.maxEnergy,n.energy+5);}
 }
 if(eventId==='zz-hometown'&&choiceLabel==='停下来聊两句')n.focus=Math.max(0,n.focus-2);
 if(eventId==='sh-corridor'&&choiceLabel.includes('挤进商店'))n.focus=Math.max(0,n.focus-3);
 if(eventId==='vertical-choice'){
  if(chosen('stairs','走楼梯'))n.energy=Math.max(0,n.energy-22);
  if(chosen('lift','等直达电梯'))n.energy=Math.min(n.maxEnergy,n.energy+15);
 }
 if(eventId==='gz-lift'){
  if(chosen('stairs','改走楼梯'))n.energy=Math.max(0,n.energy-22);
  if(chosen('lift','等电梯，恢复体力'))n.energy=Math.min(n.maxEnergy,n.energy+25);
 }
 if(eventId==='worker-boss-call'){n.bossCalls++;
  if(chosen('answer','接起来，说明正在回程')){n.focus=Math.min(100,n.focus+5);n.bossCallsLeft=0;n.bossUnread=false;}
  else {n.bossCallsLeft=Math.max(0,n.bossCallsLeft-1);n.bossUnread=n.bossCallsLeft>0;}
 }
 if(eventId==='tourist-sleep'){
  const option=TOURIST_SLEEP_OPTIONS.find(o=>choiceId?o.id===choiceId:o.label===choiceLabel);
  if(option){n.slept=true;n.sleeping=true;n.alarmStops=option.alarmStops;n.energy=Math.min(n.maxEnergy,n.energy+option.energy);n.fatigue=Math.max(0,n.fatigue-option.fatigue);}
 }
 if(eventId==='tourist-wake'){if(chosen('wake','醒醒！')){n.sleeping=false;n.energy=Math.min(n.maxEnergy,n.energy+4);}else{n.sleeping=false;n.energy=Math.max(0,n.energy-6);n=boundResources(n);return {...s,characterTime:n,stamina:n.energy,metroMisses:s.metroMisses+1};}}
 if(eventId==='tourist-wheel'){
  if(chosen('repair','停下来调整轮子'))n.wheelDamaged=false;
  else if(chosen('drag','先硬拖着赶路'))n.wheelDamaged=true;
 }
 if(eventId==='tourist-wayfinding'){
  if(chosen('map','停一下，看楼层地图')){n.mapChecked=true;n.focus=Math.min(100,n.focus+4);}
  else if(n.wrongWayRisk){n.actualDelay+=42;n.focus=Math.max(0,n.focus-5);}
 }
 n=boundResources(n);return {...s,characterTime:n,stamina:n.energy};
}
export function applyTimedChoice(s:Run,id:string):Run{
 const t=s.characterTime,p=timedPrompt(s),choice=p?.choices.find(c=>c.id===id);if(!t||!choice)return s;
 const stored=choice.storeSurplus?energyBenefit(t,choice.energy??0).stored:0;
 const nextState=boundResources({...t,prepStep:t.prepStep+1,energy:t.energy+(choice.energy??0),energyReserve:(t.energyReserve??0)+stored,fatigue:t.fatigue+(choice.fatigue??0),load:t.load+(choice.load??0),focus:t.focus+(choice.focus??0),actualDelay:t.actualDelay+choice.seconds,...choice.set});
 const next={...s,characterTime:nextState,stamina:nextState.energy,remaining:s.remaining-choice.seconds,logs:[...s.logs,{title:choice.label,seconds:choice.seconds,eventId:`${t.characterId}-prep-${t.prepStep}`}]};
 if(choice.id==='ignore'){nextState.bossCallsLeft=2;nextState.ignoredWork=true;}
 const complete=nextState.prepStep>=(t.characterId==='worker'?3:2);
 return {...next,phase:complete?'route':'preparation'};
}
export function characterMovementFactor(run:Run,sprinting=run.student?.sprinting??false):number{
 if(run.student)return movementFactor({...run.student,sprinting,exhausted:run.student.exhausted});
 const t=run.characterTime,p=t?characterTimeProfiles[t.characterId]:characterTimeProfiles.worker;
 const energyRatio=t?t.energy/Math.max(1,t.maxEnergy):1,load=t?t.load:40,fatigue=t?t.fatigue:0;
 const focusSlow=t&&t.characterId==='tourist'&&t.focus<35?.94:1;
 const fatigueSpeed=Math.max(.82,1-fatigue*.0015),energySpeed=t?.characterId==='tourist'?.92+energyRatio*.08:Math.max(.7,.72+energyRatio*.28),loadSpeed=1/Math.max(.75,1+(load-15)*.0045);
 const lateWorker=t?.characterId==='worker'&&run.remaining-(run.gatePassed?0:STOP_BEFORE)<=120?1.1:1;
 const lateTourist=t?.characterId==='tourist'&&run.remaining-(run.gatePassed?0:STOP_BEFORE)<=120?1.05:1;
 const wheelSpeed=t?.characterId==='tourist'&&t.wheelDamaged?TOURIST_WHEEL_RULES.speedMultiplier:1;
 return p.baseSpeed*fatigueSpeed*energySpeed*loadSpeed*focusSlow*lateWorker*lateTourist*wheelSpeed*(sprinting?1.55:1);
}
