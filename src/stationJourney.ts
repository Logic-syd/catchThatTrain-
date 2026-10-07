import {stationFor,stationChallenge} from './stations';
import {HONGQIAO,studentPrompt} from './studentConfig';
import type { Run } from './engine';
import type { EventConfig } from './data';
import { elderPrompt, escalatorPrompt, escalatorRide } from './stationEncounters';
import { identityPrompt, stationPrompt } from './flow';
import {characterEventPrompt} from './characterTime';
export type StationBeat={id:string;stage:number;label:string;seconds:number};
export function buildStationJourney(s:Run):StationBeat[]{
 let beats:StationBeat[]=s.encounters.filter(e=>e.stage===0).map(e=>({id:e.id,stage:0,label:e.id==='bag-snag'?'背好包，冲出地铁':'穿过出站通道',seconds:2}));
 beats.push({id:'escalator-choice',stage:1,label:'赶到扶梯口',seconds:3},{id:'escalator-ride',stage:1,label:'走向选中的扶梯',seconds:1.5});
 if(s.encounters.some(e=>e.id==='security'))beats.push({id:'security',stage:2,label:'跑到安检入口',seconds:3});
 for(const e of s.encounters.filter(e=>e.stage===3))beats.push({id:e.id,stage:3,label:'穿过候车大厅',seconds:3});
 if(!s.identityReady)beats.push({id:'identity-search',stage:4,label:'赶到候检区，准备证件',seconds:3});
 beats.push({id:'gates',stage:4,label:'赶到 12A 检票口',seconds:2},{id:'gate-scan',stage:4,label:'走进选中的检票通道',seconds:1.5},{id:'board-train',stage:5,label:'最后一段，冲向车门！',seconds:4});
 if(s.student){
  const lift=beats.findIndex(b=>b.id==='escalator-choice');beats.splice(lift,0,{id:'vertical-choice',stage:1,label:'看路牌，选择上楼方式',seconds:3});
  const security=beats.findIndex(b=>b.stage>=2);beats.splice(security,0,{id:'security-queue',stage:2,label:'穿过虹桥长通道，赶到安检',seconds:6});
  const hall=beats.findIndex(b=>b.stage>=3);beats.splice(hall,0,{id:'station-sign',stage:3,label:'进入候车大厅，找到 A 区',seconds:6});
  const add=(id:string,stage:number,label:string,seconds=3):StationBeat=>({id,stage,label,seconds});
  const tail=beats.filter(b=>['identity-search','gates','gate-scan','board-train'].includes(b.id));
  const intro=beats.filter(b=>b.stage===0);
  const queue=add('security-queue',2,'观察安检队伍',4),sign=add('station-sign',3,'认清本站检票口区域',4);
  switch(s.city.id){
   case 'shanghai':beats.splice(beats.findIndex(b=>b.id==='security-queue'),0,add('sh-corridor',2,'选择穿商店还是绕长廊',4));break;
   case 'beijing':beats=[...intro.slice(0,1),add('bj-entry',0,'看清南入口的开放标识'),queue,add('bj-tray',2,'到你安检，准备托盘'),sign,...tail];break;
   case 'guangzhou':beats=[...intro.slice(0,1),add('gz-route',0,'南区路口：近路还是连桥？'),add('gz-crossing',1,'穿过选中的大厅通路',7),add('gz-lift',1,'中区需要再换一层'),queue,add('security',2,'通过北区安检'),sign,...tail];break;
   case 'hangzhou':beats=[add('hz-fork',0,'西广场与东侧出发路口',3),queue,add('hz-zone',3,'A / B 连廊再次分流',4),...tail];break;
   case 'wuhan':beats=[add('wh-floor',0,'在 B1 中庭先认楼层'),...beats.filter(b=>b.id.startsWith('escalator')||b.id==='vertical-choice'),add('wh-landing',1,'到达平台，确认 2F 出发'),queue,sign,...tail];break;
   case 'zhengzhou':beats=[...intro.slice(0,1),queue,add('zz-wing',3,'中央大厅，选择东西翼',6),add('zz-number',4,'核对相似的检票口编号',4),...tail];break;
  }
  beats=beats.map(b=>b.id==='gates'?{...b,label:'赶到 '+s.gate+' 检票口'}:b);
  const weight=beats.reduce((a,b)=>a+b.seconds,0);const total=stationFor(s).walking/4;
  return beats.map(b=>({...b,seconds:b.seconds/weight*total}));
 }
 if(s.characterTime?.characterId==='worker'&&s.characterTime.bossUnread&&s.characterTime.bossCallsLeft>0){const indices=[1,Math.max(2,Math.floor(beats.length*.55))];for(let i=0;i<Math.min(s.characterTime.bossCallsLeft,2);i++)beats.splice(Math.min(indices[i]+i,beats.length-1),0,{id:'worker-boss-call',stage:i===0?1:3,label:i===0?'老板来电，打断你往前走':'手机又震了，老板还在追问',seconds:1});}
 if(s.characterTime?.characterId==='tourist'){beats.splice(Math.min(1,beats.length),0,{id:'tourist-wayfinding',stage:1,label:'陌生车站，停下来认一次路',seconds:1});beats.splice(Math.max(2,Math.floor(beats.length*.65)),0,{id:'tourist-wheel',stage:3,label:'行李箱轮子又卡住了',seconds:1});}
 return beats;
}
export function journeyPrompt(s:Run):EventConfig{
 const id=s.stationJourney[s.stationBeat].id;
 if(s.student){const prompt=stationChallenge(s,id)??studentPrompt(id,s.student,s.gate);if(prompt){if(id==='vertical-choice'&&s.city.id==='wuhan')return {...prompt,choices:prompt.choices.map(c=>({...c,stationDecision:{group:id,value:c.studentEffect??'escalator',category:'vertical',optimal:c.studentEffect==='stairs'?s.student!.stamina>=22:c.studentEffect==='lift'?s.student!.stamina<22:true}}))};return prompt;}}
 if(id==='gz-crossing')return {id,phase:'station',title:'穿过人流，借过一下！',description:'连点四次提醒前面的旅客，先让出通路再前进。',interaction:{kind:'tap',required:4,seconds:12,penalty:0},choices:[{label:'借过，谢谢！',detail:'通过这一段人流',seconds:0}]};
 if(id==='wh-landing')return {id,phase:'station',title:'平台到了，抬头确认 2F 出发标识。',description:'按住看清楼层牌，别误入 1F 到达通道。',interaction:{kind:'hold',required:2,seconds:10,penalty:0},choices:[{label:'确认 2F 铁路出发',detail:'楼层正确',seconds:0}]};
 if(id==='elder-block')return elderPrompt(s.stationLuck);
 if(id==='escalator-choice')return escalatorPrompt();
 if(id==='escalator-ride')return escalatorRide(s.stationLuck.escalators[s.escalatorLane!],s.escalatorLane!);
 if(id==='identity-search')return identityPrompt('station');
 if(id==='gate-scan')return {id,phase:'station',title:'闸机还没开，刷身份证！',description:`${(s.stationLane??3)+1} 号通道到了。按住读卡区，等绿灯亮起。`,interaction:{kind:'hold',seconds:8,penalty:15,required:1.2},choices:[{label:'按住刷身份证',detail:'绿灯亮起才放行',seconds:0}]};
 if(id==='board-train')return {id,phase:'station',title:'车门就在眼前！',description:'最后三步，连点冲上车！',interaction:{kind:'tap',seconds:6,penalty:10,required:3},choices:[{label:'上车！',detail:'赶上了',seconds:0}]};
 const persona=characterEventPrompt(s,id);if(persona)return persona;
 const prompt=stationPrompt(id,s.hard)??{id,phase:'station' as const,title:'工作消息终于静音了',description:'把手机收起来，继续赶路。',interaction:{kind:'choice' as const,seconds:8,penalty:0},choices:[{label:'继续往前',detail:'不再接听',seconds:0}]};return id==='gates'?{...prompt,description:prompt.description.replace('12A',s.gate)}:prompt;
}
