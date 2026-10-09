import type { EventConfig } from './data';
export type Interaction={kind:'gate-number'|'tap'|'swipe'|'scan'|'gates'|'choice'|'identity'|'escalators'|'escalator-ride'|'outcome'|'hold';seconds:number;penalty:number;required?:number};
export type Encounter={stage:number;id:string;x:number;y:number;label:string};
export function createStationPlan(hard=false,rng=Math.random):Encounter[]{
 const plan:Encounter[]=[];
 if(rng()<.65)plan.push({stage:0,id:'bag-snag',x:320,y:1420,label:'背包肩带好像挂住了'});
 if(rng()<.75)plan.push({stage:0,id:'elder-block',x:160,y:1280,label:'前面有位老人挡住了路'});
 if(!plan.length)plan.push(rng()<.5?{stage:0,id:'bag-snag',x:320,y:1420,label:'背包肩带好像挂住了'}:{stage:0,id:'elder-block',x:160,y:1280,label:'前面有位老人挡住了路'});
 if(rng()<.55)plan.push({stage:2,id:'security',x:320,y:825,label:'安检员叫住了你'});
 if(rng()<.65)plan.push(hard&&rng()<.35?{stage:3,id:'old-ticket',x:458,y:510,label:'检票前核对一下日期'}:{stage:3,id:'suitcase',x:478,y:642,label:'行李箱挡住了通道'});
 if(plan.length<2)plan.push({stage:2,id:'security',x:320,y:825,label:'安检员叫住了你'});
 return plan.sort((a,b)=>a.stage-b.stage);

}
export function identityPrompt(phase:'metro'|'station'):EventConfig{
 return {id:'identity-search',title:phase==='metro'?'趁现在，找好身份证！':'到闸机了，身份证呢？',description:'先找到钱包，再从里面拿出身份证。',phase,interaction:{kind:'identity',seconds:8,penalty:35},choices:[]};
}
const choices=(a:string,b:string,sa:number,sb:number)=>[{label:a,detail:sa?'−'+sa+' 秒':'',seconds:sa},{label:b,detail:sb?'−'+sb+' 秒':'',seconds:sb}];
const make=(id:string,title:string,description:string,cs:EventConfig['choices'],interaction:Interaction):EventConfig=>({id,title,description,phase:'station',choices:cs,interaction});
export function stationPrompt(id:string,hard=false):EventConfig|undefined{
 const cases:Record<string,EventConfig>={
 'bag-snag':make('bag-snag','等等，背包被挂住了！','刚下地铁，肩带挂在栏杆上了。向上滑动背包，把肩带从挂钩上解下来。',[{label:'解开肩带，背好包',detail:'把包拿回来 · −8 秒',seconds:8}],{kind:'swipe',seconds:7,penalty:25}),
 'exit-closed':make('exit-closed','这出口，怎么封了？！','正前方拉起了围栏。铁路出发在左侧，机场接驳在右侧。',choices('← 跟着铁路标识走','→ 看人多，跟着走',12,65),{kind:'choice',seconds:8,penalty:60}),
 'couple':make('couple','两位，借过一下——','情侣在扶梯口依依不舍。连续点击，提醒他们让出通道。',[{label:'谢谢，借过！',detail:'终于让开了',seconds:5}],{kind:'tap',seconds:6,penalty:40,required:6}),
 'auntie':make('auntie','小伙子，虹桥往哪走？','阿姨举着手机挡住路。指一下「铁路出发」，大家都能走。',choices('指向「铁路出发 ↑」','跟着她的手机导航走',8,50),{kind:'choice',seconds:7,penalty:40}),
 'broken-lift':make('broken-lift','电梯坏了。是真的坏了。','「维修中」贴在门上。你没带箱子，旁边的楼梯能走。',choices('不等了！跑楼梯','再等另一部电梯',18,65),{kind:'choice',seconds:7,penalty:60}),
 'security':make('security','滴——背包要开一下。','安检员：剪刀不能随身带上车。点出剪刀，交给工作人员处理。',[{label:'交出剪刀，继续赶车',detail:'按要求处理禁限带物品',seconds:20}],{kind:'scan',seconds:8,penalty:55}),
 'suitcase':make('suitcase','谁的箱子卡住通道啦！','向上滑，把箱子提过门槛。用键盘也可以点「提起来」。',[{label:'提过去了！',detail:'通道恢复',seconds:5}],{kind:'swipe',seconds:6,penalty:35}),
 'gates':make('gates','八条通道，哪条最快？','都通往 12A。步行时间 + 排队时间，选总耗时最短的一条。',[
 {label:'1 号',detail:'步行 8 秒 · 排队 65 秒',seconds:73},
 {label:'2 号',detail:'步行 12 秒 · 排队 48 秒',seconds:60},
 {label:'3 号',detail:'步行 18 秒 · 排队 35 秒',seconds:53},
 {label:'4 号',detail:'步行 21 秒 · 排队 4 秒',seconds:25},
 {label:'5 号',detail:'步行 25 秒 · 排队 32 秒',seconds:57},
 {label:'6 号',detail:'步行 30 秒 · 排队 5 秒',seconds:35},
 {label:'7 号',detail:'步行 10 秒 · 排队 65 秒',seconds:75},
 {label:'8 号',detail:'步行 35 秒 · 排队 10 秒',seconds:45}],{kind:'gates',seconds:10,penalty:80}),
 'old-ticket':make('old-ticket','等一下，这是昨天的票？！','游戏剧情：你点错了日期。站务员帮你查到了今天同车次的余票，赶快确认。',[{label:'核对今天日期，重新出票',detail:'游戏内办理，不涉及真实购票 · −60 秒',seconds:60},{label:'拿旧票再试一次',detail:'被闸机退回后再办理 · −100 秒',seconds:100}],{kind:'choice',seconds:8,penalty:100})
 };
 if(id==='old-ticket'&&!hard)return undefined;
 const result=cases[id];
 if(result&&id==='exit-closed')result.choices=result.choices.map((c,i)=>({...c,detour:i?{x:537,y:1310,label:'走错了，从机场侧绕回铁路入口'}:{x:160,y:1270,label:'沿左侧铁路标识绕过去'}}));
 if(result&&id==='broken-lift')result.choices=result.choices.map((c,i)=>({...c,detour:i?{x:485,y:967,label:'另一部电梯，在右边'}:{x:130,y:970,label:'跑左边的楼梯上去'}}));
 if(result&&id==='couple'){
  result.description='两个人停在扶梯口，完全没看见你。怎么过去？';
  result.interaction={kind:'choice',seconds:6,penalty:35};
  result.choices=[{label:'借过！我要赶车！',detail:'提醒他们让开 · −5 秒',seconds:5},{label:'从旁边绕过去',detail:'绕开人群 · −2 秒',seconds:2,detour:{x:390,y:1150,label:'从右边绕过扶梯口'}}];
 }
 if(id==='gates'&&result){
  const queues=[
   {seconds:65,people:4,clue:'队首的人正在翻包找证件',outcome:'排进去才轮到前面的人找证件，等了一阵才放行'},
   {seconds:48,people:6,clue:'前面几只大箱子正挪过窄闸门',outcome:'大箱子逐个挪过闸门，等到你才继续'},
   {seconds:35,people:5,clue:'前面的人正把行李一件件推过去',outcome:'跟着前面的人逐个过闸'},
   {seconds:4,people:3,clue:'证件都拿在手里，绿灯接连亮起',outcome:'前面的证件都已备好，很快轮到你'},
   {seconds:32,people:2,clue:'两个人还在同一个包里找东西',outcome:'虽然只有两个人，他们还要找出证件'},
   {seconds:5,people:4,clue:'几个人拿着证件，刚过去一位',outcome:'这一队已经备好证件，顺着队伍通过'},
   {seconds:65,people:4,clue:'有人反复把手机贴向读卡区',outcome:'前面的旅客反复尝试读卡，队伍停了一阵'},
   {seconds:10,people:2,clue:'闸门前的人正在收好随身物品',outcome:'前面的人收好东西后，轮到你通过'}
  ].map(q=>({...q,order:Math.random()})).sort((a,b)=>a.order-b.order);
  result.choices=result.choices.map((c,i)=>{
   const q=queues[i],distance=Math.abs(68+i*72-320);
   return {...c,lane:i,seconds:q.seconds,queuePeople:q.people,outcome:q.outcome,detail:(distance<70?'就在你面前':distance<180?'沿栏杆过去一段':'在另一端')+' · '+q.people+' 人，'+q.clue};
  });
 }
 return result;
}
