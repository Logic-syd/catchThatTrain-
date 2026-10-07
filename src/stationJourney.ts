import {stationFor,stationChallenge} from './stations';
import {studentPrompt} from './studentConfig';
import type { Run } from './engine';
import type { EventConfig } from './data';
import { elderPrompt, escalatorPrompt, escalatorRide } from './stationEncounters';
import { identityPrompt, stationPrompt } from './flow';
import {characterEventPrompt} from './characterTime';
import {parentStationPrompt} from './parent';
export type StationBeat={id:string;stage:number;label:string;seconds:number};
export function buildStationJourney(s:Run):StationBeat[]{
 let beats:StationBeat[]=s.encounters.filter(e=>e.stage===0).map(e=>({id:e.id,stage:0,label:e.id==='bag-snag'?'背好包，冲出地铁':'穿过出站通道',seconds:2}));
 beats.push({id:'escalator-choice',stage:1,label:'赶到扶梯口',seconds:3},{id:'escalator-ride',stage:1,label:'走向选中的扶梯',seconds:1.5});
 if(s.encounters.some(e=>e.id==='security'))beats.push({id:'security',stage:2,label:'跑到安检入口',seconds:3});
 for(const e of s.encounters.filter(e=>e.stage===3))beats.push({id:e.id,stage:3,label:'穿过候车大厅',seconds:3});
 if(!s.identityReady)beats.push({id:'identity-search',stage:4,label:'赶到候检区，准备证件',seconds:3});
 beats.push({id:'gates',stage:4,label:'赶到 12A 检票口',seconds:2},{id:'gate-scan',stage:4,label:'走进选中的检票通道',seconds:1.5},{id:'board-train',stage:5,label:'最后一段，冲向车门！',seconds:4});
 const lift=beats.findIndex(b=>b.id==='escalator-choice');beats.splice(lift,0,{id:'vertical-choice',stage:1,label:'看路牌，选择上楼方式',seconds:3});
 const security=beats.findIndex(b=>b.stage>=2);beats.splice(security,0,{id:'security-queue',stage:2,label:'穿过虹桥长通道，赶到安检',seconds:6});
 const hall=beats.findIndex(b=>b.stage>=3);beats.splice(hall,0,{id:'station-sign',stage:3,label:'进入候车大厅，找到 A 区',seconds:6});
 const add=(id:string,stage:number,label:string,seconds=3):StationBeat=>({id,stage,label,seconds});
 const tail=beats.filter(b=>['identity-search','gates','gate-scan','board-train'].includes(b.id));
 const intro=beats.filter(b=>b.stage===0);
 const queue=add('security-queue',2,'观察安检队伍',4),sign=add('station-sign',3,'认清本站检票口区域',4);
 switch(s.city.id){
  case 'shanghai':beats.splice(beats.findIndex(b=>b.id==='security-queue'),0,add('sh-corridor',2,'长廊里被人拦住：商店还是外侧？',4));break;
  case 'beijing':beats=[...intro.slice(0,1),add('bj-entry',0,'看清南入口的开放标识'),queue,add('bj-tray',2,'到你安检，准备托盘'),sign,...tail];break;
  case 'guangzhou':beats=[...intro.slice(0,1),add('gz-route',0,'南区路口：近路还是连桥？'),add('gz-crossing',1,'穿过选中的大厅通路',7),add('gz-lift',1,'中区需要再换一层'),queue,add('security',2,'通过北区安检'),sign,...tail];break;
  case 'hangzhou':beats=[add('hz-fork',0,'西广场与东侧出发路口',3),queue,add('hz-zone',3,'A / B 连廊再次分流',4),...tail];break;
  case 'wuhan':beats=[add('wh-floor',0,'在 B1 中庭先认楼层'),...beats.filter(b=>b.id.startsWith('escalator')||b.id==='vertical-choice'),add('wh-landing',1,'到达平台，确认 2F 出发'),queue,sign,...tail];break;
  case 'zhengzhou':beats=[...intro.slice(0,1),queue,add('zz-hometown',3,'老乡在中央大厅拦住你',3),add('zz-wing',3,'中央大厅，选择东西翼',6),add('zz-number',4,'核对相似的检票口编号',4),...tail];break;
 }
 if(s.parent){
  const insertAfter=(target:string,beat:StationBeat)=>{const i=beats.findIndex(b=>b.id===target);if(i>=0)beats.splice(i+1,0,beat);};
  if(s.city.id==='shanghai')insertAfter('sh-corridor',add('sh-parent-shop',2,'孩子在长廊商店前停下',3));
  if(s.city.id==='beijing')insertAfter('bj-tray',add('bj-parent-strict',2,'严格安检：孩子的水壶、零食分开检查',3));
  if(s.city.id==='guangzhou')insertAfter('gz-route',add('gz-parent-carry',0,'路上都抱着孩子，你家孩子也要抱',3));
  if(s.city.id==='hangzhou')insertAfter('hz-fork',add('hz-parent-lift',1,'左边近电梯维修，右边远电梯可靠',3));
  if(s.city.id==='wuhan'){insertAfter('wh-floor',add('wh-parent-duck',0,'孩子盯上了周黑鸭',3));insertAfter('wh-landing',add('wh-parent-duck-repeat',1,'“周黑鸭呢？”又停了一次',3));}
  if(s.city.id==='zhengzhou')insertAfter('zz-hometown',add('zz-parent-child',3,'在对称大厅牵好孩子',3));
 }
 if(s.characterTime?.characterId==='worker'&&s.characterTime.bossUnread&&s.characterTime.bossCallsLeft>0){let i=Math.min(2,beats.length-1);beats.splice(i,0,add('worker-boss-call',beats[i].stage,'老板又发来工作消息',1));if(s.characterTime.bossCallsLeft>1){i=Math.max(4,Math.floor(beats.length*.65));beats.splice(i,0,add('worker-boss-call',beats[i].stage,'老板又催一次，还得处理',1));}}
 if(s.characterTime?.characterId==='tourist'&&['shanghai','guangzhou'].includes(s.city.id)){const i=Math.max(2,beats.findIndex(b=>b.stage>=3));beats.splice(i,0,add('tourist-wheel',3,'拖着走了一天的行李箱',1));}
 beats=beats.map(b=>b.id==='gates'?{...b,label:'赶到 '+s.gate+' 检票口'}:b);
 const weight=beats.reduce((a,b)=>a+b.seconds,0);const total=stationFor(s).walking/4;
 return beats.map(b=>({...b,seconds:b.seconds/weight*total}));
}
export function journeyPrompt(s:Run):EventConfig{
 const id=s.stationJourney[s.stationBeat].id;
 const parent=parentStationPrompt(s,id);if(parent)return parent;
 const challenge=stationChallenge(s,id);if(challenge)return challenge;
 if(s.student){const prompt=studentPrompt(id,s.student,s.gate);if(prompt){if(id==='vertical-choice'&&s.city.id==='wuhan')return {...prompt,title:'后面的人催着上楼，先选对换层方式',description:'这一班大家都赶时间。'+prompt.description,choices:prompt.choices.map(c=>({...c,stationDecision:{group:id,value:c.studentEffect??'escalator',category:'vertical',optimal:c.studentEffect==='stairs'?s.student!.stamina>=22:c.studentEffect==='lift'?s.student!.stamina<22:true}}))};if(id==='security-queue'&&s.city.id==='beijing')return {...prompt,title:'安检员催着摆托盘，先判断哪队快',description:'工作人员严格按流程放行。'+prompt.description};return prompt;}}
 if(s.characterTime){
  const t=s.characterTime;
  if(id==='vertical-choice')return {id,phase:'station',title:s.city.id==='wuhan'?'后面的人催着走，楼梯、扶梯还是电梯？':'上出发层，楼梯、扶梯还是电梯？',description:(s.city.id==='wuhan'?'这班人都急着换层。':'')+(t.characterId==='worker'?'箱子里还有妈妈塞的东西。楼梯更快，但负重会吃掉体力。':'走了一整天，腿已经发软。楼梯省时间，电梯能喘口气。'),interaction:{kind:'choice',seconds:12,penalty:0},choices:[{label:'去三部扶梯看看',detail:'随机遇到畅通或拥堵',seconds:0,stationDecision:{group:id,value:'escalator',category:'vertical',optimal:true}},{label:'走楼梯',detail:'省等候 · 体力 −22',seconds:0,stationDecision:{group:id,value:'stairs',category:'vertical',optimal:t.energy>=25}},{label:'等直达电梯',detail:'花 35 秒 · 体力 +15',seconds:35,stationDecision:{group:id,value:'lift',category:'vertical',optimal:t.energy<25}}]};
  if(id==='escalator-ride'){const mode=[...s.stationDecisions].reverse().find(d=>d.group==='vertical-choice')?.value;if(mode==='stairs'||mode==='lift')return {id,phase:'station',title:mode==='stairs'?'背好行李，一步步上楼':'电梯到了，收好行李进电梯',description:mode==='stairs'?'连点登上出发层，体力会被消耗。':'按住开门键，等所有人进电梯。',interaction:{kind:mode==='stairs'?'tap':'hold',required:mode==='stairs'?8:2,seconds:14,penalty:0},choices:[{label:'上到出发层',detail:'完成换层',seconds:0}]};}
  if(id==='security-queue'){const queues=[{people:6,seconds:24,hint:'轻装旅客，推进快'},{people:3,seconds:55,hint:'大件行李多，开包慢'},{people:8,seconds:32,hint:'双通道，处理快'}];return {id,phase:'station',title:s.city.id==='beijing'?'安检员按流程放行，最短队一定快吗？':'安检三队，最短的一队一定快吗？',description:(s.city.id==='beijing'?'工作人员不会让人插队。':'')+(t.focus>=70?'你看出了每队处理速度的差别。':'先看行李和通道数，别只数人头。'),interaction:{kind:'choice',seconds:12,penalty:0},choices:queues.map((q,i)=>({label:String.fromCharCode(65+i)+' 队 · '+q.people+' 人',detail:t.focus>=70||t.mapChecked?q.hint:'人少不一定快；观察行李再选',seconds:q.seconds,stationDecision:{group:id,value:String(i),category:'queue',optimal:q.seconds===24}}))};}
  if(id==='station-sign'){const left=parseInt(s.gate)<=15;return {id,phase:'station',title:`出发大厅到了，${s.gate} 在哪边？`,description:`车票 ${s.gate}。← 1–15 号 ｜ 16–30 号 →。`,interaction:{kind:'choice',seconds:12,penalty:0},choices:[{label:left?'左转 1–15 区':'右转 16–30 区',detail:'沿数字标识走',seconds:0,stationDecision:{group:id,value:'correct',category:'navigation',optimal:true}},{label:left?'右转跟人流':'左转跟人流',detail:'折返 +55 秒',seconds:55,stationDecision:{group:id,value:'wrong',category:'navigation',optimal:false}}]};}
 }
 if(id==='gz-crossing')return {id,phase:'station',title:'穿过人流，借过一下！',description:'连点四次提醒前面的旅客，先让出通路再前进。',interaction:{kind:'tap',required:4,seconds:12,penalty:0},choices:[{label:'借过，谢谢！',detail:'通过这一段人流',seconds:0}]};
 if(id==='wh-landing')return {id,phase:'station',title:'身后乘客催你快走，先确认 2F',description:'按住看清楼层牌。别被催着误入 1F 到达通道。',interaction:{kind:'hold',required:2,seconds:10,penalty:0},choices:[{label:'确认 2F 铁路出发',detail:'楼层正确',seconds:0}]};
 if(id==='elder-block')return elderPrompt(s.stationLuck);
 if(id==='escalator-choice')return escalatorPrompt();
 if(id==='escalator-ride')return escalatorRide(s.stationLuck.escalators[s.escalatorLane!],s.escalatorLane!);
 if(id==='identity-search')return identityPrompt('station');
 if(id==='gate-scan')return {id,phase:'station',title:'闸机还没开，刷身份证！',description:`${(s.stationLane??3)+1} 号通道到了。按住读卡区，等绿灯亮起。`,interaction:{kind:'hold',seconds:8,penalty:15,required:1.2},choices:[{label:'按住刷身份证',detail:'绿灯亮起才放行',seconds:0}]};
 if(id==='board-train')return {id,phase:'station',title:'车门就在眼前！',description:'最后三步，连点冲上车！',interaction:{kind:'tap',seconds:6,penalty:10,required:3},choices:[{label:'上车！',detail:'赶上了',seconds:0}]};
 const persona=characterEventPrompt(s,id);if(persona)return persona;
 const prompt=stationPrompt(id,s.hard)??{id,phase:'station' as const,title:'工作消息终于静音了',description:'把手机收起来，继续赶路。',interaction:{kind:'choice' as const,seconds:8,penalty:0},choices:[{label:'继续往前',detail:'不再接听',seconds:0}]};return id==='gates'?{...prompt,description:prompt.description.replace('12A',s.gate)}:prompt;
}
