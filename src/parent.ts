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
}
export const parentProfile={agility:60,energy:70,focus:85,load:30};
export function createParentState(rng:()=>number=Math.random):ParentState{return {
 prepStep:0,appearance:rng()<.5?'mom':'dad',energy:70,maxEnergy:70,load:30,
 childEnergy:70,patience:76,toilet:30+Math.floor(rng()*26),gap:0,carrying:false,
 snacks:0,water:1,sprinting:false,exhausted:false,runner:{lane:1,wave:0,blocked:false,collisions:0,dodges:0,seed:Math.floor(rng()*3)},
 toiletDeferred:false,wetPants:false,childToilet:false,toiletVisits:0,separationCount:0,childEnergyMin:70,patienceMin:76,patienceZero:false,childNegativeEvents:0,childDelaySeconds:0,
 carriedSeconds:0,snacksUsed:0,syncUsed:false,syncRemaining:0,syncSprintSaved:0,
 duckBought:false,duckRefused:false,blockCooldown:0
};}
const clamp=(n:number)=>Math.max(0,Math.min(100,n));
export function parentMovementFactor(p:ParentState,sprinting=false){
 const energy=Math.max(.78,.82+p.energy/p.maxEnergy*.18);
 const child=p.childEnergy<20&&!p.carrying?.88:1;
 return .98*energy*child*(1-Math.max(0,p.load-30)*.003)*(p.carrying?.84:1)*(sprinting?(p.syncRemaining>0?1.7:1.48):1);
}
export function tickParent(p:ParentState,phase:Run['phase'],dt:number,gameSeconds:number,running:boolean):ParentState{
 const sprint=phase==='station'&&running&&p.sprinting&&!p.exhausted;
 const moving=phase==='station'&&running;
 const energy=Math.min(p.maxEnergy,clamp(p.energy+(sprint?-(p.carrying?5.6:4.6):moving?(p.carrying?-.55:.55):1.15)*dt));
 const exhausted=energy<=0?true:p.exhausted&&energy<12;
 const childEnergy=clamp(p.childEnergy+(p.carrying?.22:moving?-(sprint?.72:.4):.02)*dt);
 const patience=clamp(p.patience-(moving?(sprint?.33:.1):phase==='station'?.055:.018)*dt);
 const toilet=clamp(p.toilet+gameSeconds/60*(phase==='station'?6:phase==='metro'?2.5:0.45));
 const gap=p.carrying?0:Math.max(0,Math.min(10,p.gap+(sprint&&p.syncRemaining<=0?1.65:moving?-1.5:0)*dt));
 return {...p,energy,exhausted,childEnergy,patience,toilet,gap,childEnergyMin:Math.min(p.childEnergyMin,childEnergy),patienceMin:Math.min(p.patienceMin,patience),sprinting:exhausted?false:p.sprinting,
  carriedSeconds:p.carriedSeconds+(p.carrying&&moving?dt:0),syncRemaining:Math.max(0,p.syncRemaining-dt),blockCooldown:Math.max(0,p.blockCooldown-dt),
  syncSprintSaved:p.syncSprintSaved+(sprint&&p.syncRemaining>0?dt*4*.22:0)};
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
 if(p.gap>=7.5&&!p.carrying)return choose('parent-gap','“等等我！”孩子被甩在后面了','前进被迫停下。先接到孩子，不能一个人跑到检票口。',[
  {label:'停下等孩子',detail:'按住等孩子跟上 · 约 8 秒',seconds:8},
  {label:'回头抱起来',detail:'约 5 秒 · 后面走得慢、家长更耗体力',seconds:5}
 ]);
 if(p.toilet>=100&&!p.wetPants)return choose('parent-accident','孩子没忍住，裤子湿了','先稳住孩子。仍然可以上车，别让这一刻直接决定整局。',[{label:'安慰孩子，先上车',detail:'耐心 −15 · 孩子走慢一点',seconds:8}]);
 if(p.toilet>=95&&!p.toiletDeferred)return choose('parent-toilet','“我真的想上厕所！”','最近的厕所要绕一段。现在去，还是先往检票口赶？',[
  {label:'现在去厕所',detail:'−75 秒 · 尿意归零，孩子安心',seconds:75},
  {label:'再忍一下，先赶路',detail:'现在不花时间 · 后面可能出意外',seconds:0}
 ]);
 if(p.childEnergy<=18&&!p.carrying)return choose('parent-tired','“我走不动了。”','孩子停在路中间。抱、休息，还是慢慢牵着走？',[
  {label:'抱起来继续走',detail:'不用等 · 家长更耗体力',seconds:4},
  {label:'坐下休息一下',detail:'−30 秒 · 孩子体力恢复',seconds:30},
  {label:'牵着慢慢走',detail:'−12 秒 · 稍后还可能喊累',seconds:12}
 ]);
 if(p.patience<=0)return choose('parent-patience','“我不走了！”','孩子抱着栏杆不动。先安抚，脚步才能继续。',[
  ...p.snacks>0?[{label:'给一份零食',detail:'消耗 1 份 · 耐心明显恢复',seconds:5}]:[],
  {label:'蹲下来好好说',detail:'按住安慰 · 约 12 秒',seconds:12},
  {label:'一起休息一会儿',detail:'−25 秒 · 双方都缓口气',seconds:25}
 ]);
 return null;
}
export function isParentBlock(id:string){return id.startsWith('parent-');}
export function applyParentChoice(p:ParentState,eventId:string,label:string,seconds:number):ParentState{
 let n={...p,blockCooldown:4};
 if(isParentBlock(eventId))n.childDelaySeconds+=seconds;
 if(eventId==='parent-gap'){
  n.gap=0;n.separationCount++;n.childNegativeEvents++;
  if(label.includes('抱')){n.carrying=true;n.energy=clamp(n.energy-5);}else n.childEnergy=clamp(n.childEnergy+4);
 }
 if(eventId==='parent-tired'){
  n.childNegativeEvents++;if(label.includes('抱')){n.carrying=true;n.childEnergy=clamp(n.childEnergy+12);n.energy=clamp(n.energy-4);}
  else if(label.includes('休息')){n.childEnergy=clamp(n.childEnergy+36);n.patience=clamp(n.patience+8);n.energy=clamp(n.energy+7);}
  else n.childEnergy=18;
 }
 if(eventId==='parent-patience'){
  n.patienceZero=true;n.childNegativeEvents++;
  if(label.includes('零食')&&n.snacks>0){n.snacks--;n.load=Math.max(30,n.load-2);n.snacksUsed++;n.patience=42;}
  else if(label.includes('休息')){n.patience=32;n.energy=clamp(n.energy+5);}else n.patience=26;
 }
 if(eventId==='parent-toilet'){
  n.childNegativeEvents++;if(label.includes('去厕所')){n.toilet=0;n.toiletDeferred=false;n.childToilet=true;n.toiletVisits++;n.patience=clamp(n.patience+8);}
  else {n.toiletDeferred=true;n.toilet=Math.max(96,n.toilet);n.patience=clamp(n.patience-5);}
 }
 if(eventId==='parent-accident'){n.wetPants=true;n.childNegativeEvents++;n.toilet=50;n.patience=clamp(n.patience-15);n.childEnergy=clamp(n.childEnergy-8);}
 if(eventId==='gz-parent-carry'){n.carrying=true;n.gap=0;n.childEnergy=clamp(n.childEnergy+8);}
 if(eventId==='vertical-choice'){
  if(label.includes('楼梯'))n.childEnergy=clamp(n.childEnergy-18);
  if(label.includes('电梯')){n.childEnergy=clamp(n.childEnergy+12);n.patience=clamp(n.patience-6);}
 }
 if(eventId==='bj-parent-strict'&&label.includes('直接')){n.patience=clamp(n.patience-12);n.childNegativeEvents++;}
 if(eventId==='hz-parent-lift'&&label.includes('右侧')){n.energy=clamp(n.energy+5);n.childEnergy=clamp(n.childEnergy+5);}
 if(eventId==='wh-parent-duck'){
  if(label.includes('买一份')){n.duckBought=true;n.patience=clamp(n.patience+30);}
  else {n.duckRefused=true;n.patience=clamp(n.patience-17);n.childNegativeEvents++;}
 }
 if(eventId==='wh-parent-duck-repeat'){
  if(label.includes('零食')&&n.snacks>0){n.snacks--;n.load=Math.max(30,n.load-2);n.snacksUsed++;n.patience=clamp(n.patience+22);}
  else if(label.includes('回头买')){n.duckBought=true;n.patience=clamp(n.patience+30);}
  else n.patience=clamp(n.patience-9);
 }
 if(eventId==='zz-parent-child'&&label.includes('牵好'))n.gap=0;
 if(eventId==='sh-parent-shop'){
  if(label.includes('水壶')&&n.water>0){n.water--;n.patience=clamp(n.patience+14);n.toilet=clamp(n.toilet+6);}
  else if(label.includes('买瓶水')){n.water++;n.load+=2;n.patience=clamp(n.patience+20);}
  else {n.patience=clamp(n.patience-15);n.childNegativeEvents++;}
 }
 return n;
}
export function parentStationPrompt(s:Run,id:string):EventConfig|undefined{
 const p=s.parent;if(!p)return undefined;
 if(id==='sh-parent-shop')return choose(id,'“我想买水！就在那边。”','虹桥长廊还没走完，孩子被商店吸引住了。水壶里还有水，先处理好才肯继续走。',[
  ...p.water>0?[{label:'拿水壶给孩子喝',detail:'−3 秒 · 耐心恢复，尿意略增',seconds:3}]:[],
  {label:'去商店买瓶水',detail:'−35 秒 · 孩子安静下来',seconds:35},
  {label:'说好上车再买，牵手走',detail:'现在不花时间 · 耐心 −15',seconds:0}
 ]);
 if(id==='gz-parent-carry')return choose(id,'一路都是抱着走的小孩','孩子看了一圈，也伸出双手：“我也要抱！”今天这段路，得带着孩子一起过去。',[{label:'把孩子抱起来',detail:'按住抱起 · 后续速度和精力受负重影响',seconds:0}],'hold',1.8);
 if(id==='bj-parent-strict')return choose(id,'北京南安检，真的一件也不能省',`安检员指着托盘：“孩子的水壶、${p.snacks>0?'零食、':''}包，都要分开放。请按顺序来。”`,[
  {label:'提前分开放进托盘',detail:'−20 秒 · 严格检查，一次通过',seconds:20,stationDecision:{group:id,value:'prepared',category:'queue',optimal:true}},
  {label:'抱着孩子直接过',detail:'被叫回来重新检查 · −65 秒',seconds:65,stationDecision:{group:id,value:'rescan',category:'queue',optimal:false}}
 ]);
 if(id==='hz-parent-lift')return choose(id,'左边电梯近，右边电梯远','左侧电梯上个月就坏了，维修牌还挂着；右侧要多走一段，但你知道肯定能用。',[{label:'去右侧可靠的电梯',detail:'多走一段 · −18 秒 · 顺利上楼',seconds:18,stationDecision:{group:id,value:'right',category:'vertical',optimal:true}},{label:'赌左侧近电梯',detail:'仍在维修，折返 · −65 秒',seconds:65,stationDecision:{group:id,value:'left',category:'vertical',optimal:false}}]);
 if(id==='wh-parent-duck')return choose(id,p.appearance==='mom'?'“妈妈，我要吃周黑鸭！”':'“爸爸，我要吃周黑鸭！”','武汉站的周黑鸭柜台就在换层口。孩子一路盯着招牌，拉着你不走。',[
  {label:'买一份小包装',detail:'−45 秒 · 后面安静下来',seconds:45,stationDecision:{group:id,value:'buy',category:'vertical',optimal:p.patience<30,skip:['wh-parent-duck-repeat']}},
  {label:'答应上车再吃，先走',detail:'现在不花时间 · 后面还会再喊',seconds:0}
 ]);
 if(id==='wh-parent-duck-repeat')return choose(id,p.duckBought?'周黑鸭已经拿好了':'“周黑鸭呢？我现在就想吃！”',p.duckBought?'孩子抱着小包装，你们继续赶路。':'刚走到出发层，孩子又停了下来。安慰、拿零食，还是回头买？',p.duckBought?[{label:'牵好手继续走',detail:'不再耽误',seconds:0}]:[
  ...p.snacks>0?[{label:'先吃一份零食',detail:'−5 秒 · 消耗 1 份零食',seconds:5}]:[],
  {label:'说好上车再买',detail:'−12 秒 · 耐心继续下降',seconds:12},
  {label:'回头买周黑鸭',detail:'−55 秒 · 孩子安静下来',seconds:55}
 ]);
 if(id==='zz-parent-child')return choose(id,'孩子被左右两边一样的大厅看花了','一边有老乡招手，一边是 21A 指示。孩子想往另一边跑，先牵好手再认编号。',[{label:'牵好孩子，看清 21A',detail:'按住确认，再去正确的右翼',seconds:0}],'hold',1.5);
 if(id==='security-queue')return choose(id,'三条安检队，孩子站久了会烦躁','先看每队的行李和检查速度。北京南的流程尤其严格，别只数人数。',[
  {label:'A 队 · 6 人，轻装旅客',detail:'推进快 · −24 秒',seconds:24,stationDecision:{group:id,value:'a',category:'queue',optimal:true}},
  {label:'B 队 · 3 人，前面大件行李多',detail:'看着短，开包慢 · −55 秒',seconds:55,stationDecision:{group:id,value:'b',category:'queue',optimal:false}},
  {label:'C 队 · 8 人，双通道',detail:'比较稳 · −32 秒',seconds:32,stationDecision:{group:id,value:'c',category:'queue',optimal:false}}
 ]);
 if(id==='vertical-choice')return choose(id,'牵着孩子上楼，选哪条路？','楼梯省等候却更累；电梯慢一点，但能让孩子和你缓口气。',[
  {label:'走楼梯',detail:'−12 秒 · 孩子体力 −18',seconds:12,stationDecision:{group:id,value:'stairs',category:'vertical',optimal:p.childEnergy>=30}},
  {label:'去三部扶梯看看',detail:'随机畅通或拥堵',seconds:0,stationDecision:{group:id,value:'escalator',category:'vertical',optimal:true}},
  {label:'等直达电梯',detail:'−38 秒 · 孩子体力 +12',seconds:38,stationDecision:{group:id,value:'lift',category:'vertical',optimal:p.childEnergy<30}}
 ]);
 if(id==='escalator-ride'){
  const mode=[...s.stationDecisions].reverse().find(d=>d.group==='vertical-choice')?.value;
  if(mode==='stairs'||mode==='lift')return choose(id,mode==='stairs'?'扶好孩子，一起上楼':'电梯到了，牵好手进来',mode==='stairs'?'连点上楼，孩子体力会下降。':'按住等所有人出电梯，再一起进去。',[{label:mode==='stairs'?'上到出发层':'牵手进电梯',detail:'完成换层',seconds:0}],mode==='stairs'?'tap':'hold',mode==='stairs'?4:2);
 }
 return undefined;
}
