import type {Run} from './engine';
import {movementFactor} from './studentConfig';
import type {RunnerState} from './runner';
export interface CharacterTimeState {
 characterId:'worker'|'tourist';
 prepStep:number;
 energy:number;
 maxEnergy:number;
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
 actualDelay:number;bossCallsLeft:number;wrongWayRisk:boolean;sprinting:boolean;exhausted:boolean;runner:RunnerState;
}
export interface TimedChoice {id:string;label:string;detail:string;seconds:number;energy?:number;fatigue?:number;load?:number;focus?:number;set?:Partial<CharacterTimeState>}
export interface TimedPrompt {eyebrow:string;title:string;story:string;choices:TimedChoice[]}
export const characterTimeProfiles={
 student:{label:'背包大学生',agility:80,maxEnergy:90,energy:90,fatigue:0,load:15,focus:55,baseSpeed:1,sprintSpeed:1.9,walkRecovery:2.2,restRecovery:5,fatigueRecovery:0,description:'精力和手机都满格，唯一的问题是总觉得还来得及。'},
 worker:{label:'打工人',agility:60,maxEnergy:60,energy:60,fatigue:0,load:35,focus:85,baseSpeed:.9,sprintSpeed:1.65,walkRecovery:1.15,restRecovery:3.5,fatigueRecovery:0,description:'从家里返工，妈妈不断往箱子里塞东西；路线熟，负重是麻烦。'},
 tourist:{label:'疲惫游客',agility:55,maxEnergy:35,energy:35,fatigue:70,load:30,focus:50,baseSpeed:.86,sprintSpeed:1.55,walkRecovery:.9,restRecovery:4.5,fatigueRecovery:-.015,description:'已退房，在陌生城市走了两万多步；必须赶回家上班。'},
} as const;
export function createCharacterTimeState(id:'worker'|'tourist',rng:()=>number=Math.random):CharacterTimeState{const p=characterTimeProfiles[id];return {characterId:id,prepStep:0,energy:p.energy,maxEnergy:p.maxEnergy,fatigue:p.fatigue,load:p.load,focus:p.focus,bossUnread:false,ignoredWork:false,bossCalls:0,bossCallsLeft:0,motherStayed:false,souvenirs:false,coffee:false,slept:false,sleeping:false,alarmStops:2,mapChecked:false,actualDelay:0,wrongWayRisk:rng()<.35,sprinting:false,exhausted:false,runner:{lane:1,wave:0,blocked:false,collisions:0,dodges:0,seed:Math.floor(rng()*3)}};}
export function timedPrompt(s:Run):TimedPrompt|undefined{
 const t=s.characterTime;if(!t)return;
 if(t.characterId==='worker'){
  if(t.prepStep===0)return {eyebrow:'出门前 · 家门口',title:'妈把一袋土特产放进箱子：“这个也带上。”',story:'行李已经收好了，明早九点还得回去上班。',choices:[{id:'take-gifts',label:'带上，妈特地准备的',detail:'负重 +15 · 解锁妈妈的土特产',seconds:0,load:15,set:{souvenirs:true}},{id:'leave-gifts',label:'先不带了，轻装赶车',detail:'不增加负重 · 妈妈嘴上说好，还是有点舍不得',seconds:0}]};
  if(t.prepStep===1)return {eyebrow:'出门前 · 再吃两口',title:'妈：“吃完再走，路上就不用找东西了。”',story:'厨房里还热着饭菜，行李箱旁边已经多了两袋吃的。',choices:[{id:'eat',label:'再吃两口，马上走',detail:'−60 秒 · 精力 +10',seconds:60,energy:10},{id:'leave',label:'真得走了，到了发消息',detail:'不花时间 · 妈妈送你到门口',seconds:0}]};
  return {eyebrow:'出门前 · 工作群',title:'老板又发来消息：“明早九点，别迟到。”',story:'假期结束了，你不得不回去上班。老板还在催，箱子里全是妈妈塞的东西。',choices:[{id:'reply',label:'回一句“知道了”，关掉手机',detail:'−20 秒 · 专注 +5 · 不再追着问',seconds:20,focus:5,set:{bossUnread:false,bossCallsLeft:0}},{id:'ignore',label:'先静音，赶车要紧',detail:'现在不花时间 · 路上老板还可能打来',seconds:0,focus:-3,set:{bossUnread:true,bossCalls:2,bossCallsLeft:2}}]};
 }
 if(t.prepStep===0)return {eyebrow:'出门前 · 已退房',title:'今日步数 23,487。你真的不想再动了。',story:'酒店已经退房，今晚只有这趟车能赶回家上班。要不要先缓口气？',choices:[{id:'coffee',label:'买杯咖啡提神',detail:'−50 秒 · 精力 +10 · 疲劳 −15',seconds:50,energy:10,fatigue:-15,set:{coffee:true}},{id:'rest',label:'靠着小箱子坐一会',detail:'−30 秒 · 精力 +10 · 疲劳 −5',seconds:30,energy:10,fatigue:-5},{id:'go',label:'起来就走，车上再休息',detail:'不花时间 · 保留地铁补觉机会',seconds:0}]};
 if(t.prepStep===1)return {eyebrow:'出门前 · 小号行李箱',title:'一个小箱子，一个背包。纪念品要不要留下？',story:'不是行李太多，是你已经走了一整天，腿有点发沉。',choices:[{id:'keep',label:'纪念品带回家',detail:'负重 +5 · 旅行没白逛',seconds:0,load:5,set:{souvenirs:true}},{id:'light',label:'先放下，轻装赶车',detail:'负重 −5 · 陌生站里更好走',seconds:0,load:-5}]};
 return {eyebrow:'出门前 · 眼皮打架',title:'还有几站到家？你要不要在地铁上眯一会？',story:'你已经很累。睡得越久，恢复越多，但闹钟定晚了就可能坐过站。',choices:[{id:'alarm-3',label:'提前 3 站叫醒',detail:'休息 25 秒 · 精力 +8 · 疲劳 −6 · 最稳',seconds:25,energy:8,fatigue:-6,set:{slept:true,sleeping:true,alarmStops:3}},{id:'alarm-2',label:'提前 2 站叫醒',detail:'休息 45 秒 · 精力 +14 · 疲劳 −12',seconds:45,energy:14,fatigue:-12,set:{slept:true,sleeping:true,alarmStops:2}},{id:'alarm-1',label:'提前 1 站叫醒',detail:'休息 65 秒 · 精力 +20 · 疲劳 −20 · 睡过站风险高',seconds:65,energy:20,fatigue:-20,set:{slept:true,sleeping:true,alarmStops:1}},{id:'awake',label:'撑着，盯紧站名',detail:'不额外花时间 · 保持清醒和方向感',seconds:0,focus:8}]};
}
export function characterEventPrompt(s:Run,id:string){
 const t=s.characterTime;if(!t)return undefined;
 if(id==='worker-boss-call'&&t.bossCallsLeft>0)return {id,phase:'station' as const,title:t.bossCallsLeft===1?'老板又打来了：“你到底看没看消息？”':'手机又震了：老板发来一条语音',description:'你已经在赶车，工作群还在持续催。接电话会占用赶路时间。',interaction:{kind:'choice' as const,seconds:10,penalty:18},choices:[{label:'接起来，说明正在回程',detail:'花 35 秒 · 专注 +5',seconds:35},{label:'挂掉，继续赶车',detail:'不花时间 · 老板可能再打来',seconds:0}]};
 if(id==='tourist-sleep')return {id,phase:'metro' as const,title:'车厢晃得人睁不开眼，要睡一会吗？',description:'你很疲惫。恢复精力可以让站内走得更快，但要设好闹钟。',interaction:{kind:'choice' as const,seconds:12,penalty:20},choices:[{label:'提前 3 站叫醒',detail:'睡 25 秒 · 精力 +8 · 疲劳 −6 · 最稳',seconds:25},{label:'提前 2 站叫醒',detail:'睡 45 秒 · 精力 +14 · 疲劳 −12',seconds:45},{label:'提前 1 站叫醒',detail:'睡 65 秒 · 精力 +20 · 疲劳 −20 · 睡过站风险高',seconds:65},{label:'撑着，盯紧站名',detail:'不额外花时间 · 保持清醒和方向感',seconds:0}]};
 if(id==='tourist-wake')return {id,phase:'metro' as const,title:'到站了！闹钟响了，醒醒！',description:'按住按钮快速确认站名。反应慢了会被带过站，再花时间折返。',interaction:{kind:'tap' as const,seconds:3,penalty:80,required:1},choices:[{label:'醒醒！',detail:'立刻下车，抓住开门时间',seconds:0},{label:'再睡一下',detail:'闹钟没叫醒你 · 坐过站并折返',seconds:80}]};
 if(id==='tourist-wheel')return {id,phase:'station' as const,title:'行李箱轮子卡住了！',description:'坏掉的轮子一直往旁边偏。停下来调整会花时间，硬拖会更耗精力。',interaction:{kind:'choice' as const,seconds:10,penalty:18},choices:[{label:'停下来调整轮子',detail:'多花 20 秒 · 负重减少 5',seconds:20},{label:'先硬拖着赶路',detail:'不花时间 · 精力额外消耗',seconds:0}]};
 if(id==='tourist-wayfinding')return {id,phase:'station' as const,title:t.mapChecked?'这里的指示牌怎么又变了？':'出口好多，哪个才是铁路出发？',description:t.focus<35?'走了一整天，字都看花了。陌生车站里人流也可能带错方向。':'先看清铁路出发标识，跟着人群不一定对。',interaction:{kind:'choice' as const,seconds:10,penalty:18},choices:[{label:'停一下，看楼层地图',detail:'花 12 秒确认方向 · 记住路线',seconds:12},{label:'跟着人流先走',detail:t.wrongWayRisk?'看着像近路，可能要折返':'顺着人流，不花确认时间',seconds:t.wrongWayRisk?42:0}]};
 return undefined;
}
export function applyCharacterEvent(s:Run,eventId:string,choiceLabel:string):Run{
 const t=s.characterTime;if(!t)return s;let n={...t};
 if(eventId==='zz-hometown-answer'){
  if(choiceLabel==='说真话')n.focus=Math.max(0,n.focus-10);
  if(choiceLabel==='说工资 5000'){n.focus=Math.max(0,n.focus-5);n.maxEnergy=Math.max(n.maxEnergy,n.energy+5);n.energy+=5;}
 }
 if(eventId==='zz-hometown'&&choiceLabel==='停下来聊两句')n.focus=Math.max(0,n.focus-2);
 if(eventId==='sh-corridor'&&choiceLabel.includes('挤进商店'))n.focus=Math.max(0,n.focus-3);
 if(eventId==='vertical-choice'){
  if(choiceLabel==='走楼梯')n.energy=Math.max(0,n.energy-22);
  if(choiceLabel==='等直达电梯')n.energy=Math.min(n.maxEnergy,n.energy+15);
 }
 if(eventId==='gz-lift'){
  if(choiceLabel==='改走楼梯')n.energy=Math.max(0,n.energy-22);
  if(choiceLabel==='等电梯，恢复体力')n.energy=Math.min(n.maxEnergy,n.energy+25);
 }
 if(eventId==='worker-boss-call'){n.bossCalls++;
  if(choiceLabel.startsWith('接起来')){n.focus=Math.min(100,n.focus+5);n.bossCallsLeft=0;n.bossUnread=false;}
  else {n.bossCallsLeft=Math.max(0,n.bossCallsLeft-1);n.bossUnread=n.bossCallsLeft>0;}
 }
 if(eventId==='tourist-sleep'){const alarm=choiceLabel.startsWith('提前 1')?1:choiceLabel.startsWith('提前 2')?2:choiceLabel.startsWith('提前 3')?3:0;if(alarm){n.slept=true;n.sleeping=true;n.alarmStops=alarm;const energy=alarm===1?20:alarm===2?14:8,fatigue=alarm===1?20:alarm===2?12:6;n.energy=Math.min(n.maxEnergy,n.energy+energy);n.fatigue=Math.max(0,n.fatigue-fatigue);}}
 if(eventId==='tourist-wake'){if(choiceLabel==='醒醒！'){n.sleeping=false;n.energy=Math.min(n.maxEnergy,n.energy+4);}else{n.sleeping=false;n.energy=Math.max(0,n.energy-6);return {...s,characterTime:n,metroMisses:s.metroMisses+1};}}
 if(eventId==='tourist-wheel'){if(choiceLabel.startsWith('停下来')){n.energy=Math.max(0,n.energy-2);}else{n.energy=Math.max(0,n.energy-3);n.fatigue=Math.min(100,n.fatigue+3);}}
 if(eventId==='tourist-wayfinding'){
  if(choiceLabel.startsWith('停一下')){n.mapChecked=true;n.focus=Math.min(100,n.focus+4);}
  else if(n.wrongWayRisk){n.actualDelay+=42;n.focus=Math.max(0,n.focus-5);}
 }
 return {...s,characterTime:n};
}
export function applyTimedChoice(s:Run,id:string):Run{
 const t=s.characterTime,p=timedPrompt(s),choice=p?.choices.find(c=>c.id===id);if(!t||!choice)return s;
 const nextState:CharacterTimeState={...t,prepStep:t.prepStep+1,energy:Math.max(0,Math.min(t.maxEnergy,t.energy+(choice.energy??0))),fatigue:Math.max(0,Math.min(100,t.fatigue+(choice.fatigue??0))),load:Math.max(0,Math.min(100,t.load+(choice.load??0))),focus:Math.max(0,Math.min(100,t.focus+(choice.focus??0))),actualDelay:t.actualDelay+choice.seconds,...choice.set};
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
 const fatigueSpeed=Math.max(.82,1-fatigue*.0015),energySpeed=Math.max(.7,.72+energyRatio*.28),loadSpeed=1/Math.max(.75,1+(load-15)*.0045);
 const lateWorker=t?.characterId==='worker'&&run.remaining-(run.gatePassed?0:180)<=120?1.1:1;
 const lateTourist=t?.characterId==='tourist'&&run.remaining-(run.gatePassed?0:180)<=120?1.05:1;
 return p.baseSpeed*fatigueSpeed*energySpeed*loadSpeed*focusSlow*lateWorker*lateTourist*(sprinting?1.55:1);
}
