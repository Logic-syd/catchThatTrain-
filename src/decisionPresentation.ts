import type {Choice,EventConfig} from './data';
import type {Run} from './engine';

type Playable='student'|'worker'|'tourist'|'mom';
// Public observations and temptations. Costs and route effects remain in the event rules.
export const stationTemptations:Record<string,Record<Playable,string>>={
 shanghai:{
  student:'商店那边有人背着同款书包钻过去，你觉得自己也能挤。',
  worker:'前面一个拖箱子的拐进商店通道，你下意识想跟着省几步。',
  tourist:'腿已经发沉，商店门头就在眼前，像是终于能少走一点。',
  mom:'孩子指着亮堂堂的商店：“走这边嘛！”你也想让他少走一点。'
 },
 beijing:{
  student:'东侧没几个人，你背包不大，觉得侧身进去应该很容易。',
  worker:'老板又亮了消息。东侧没人排队，你想先进去再回他。',
  tourist:'两个门都挂着火车站标识。你在陌生地方，直觉想找人少的。',
  mom:'孩子已经站不住了。看着空空的东门，你很想少排一段。'
 },
 guangzhou:{
  student:'热心人说“年轻人穿中间就行”，你觉得自己能跑出这段人流。',
  worker:'对方也拖着箱子，还说自己经常走这里，看着很有经验。',
  tourist:'有人主动带路，你不用再看地图了，听起来让人松了口气。',
  mom:'热心人指着中区：“好多抱孩子的都往这边走。”你也有点心动。'
 },
 hangzhou:{
  student:'左边的人走得飞快，还有人一路小跑，看着也很着急。',
  worker:'手机还在催工作，左边都是通勤打扮的人，你差点顺着他们走。',
  tourist:'你分不清两个广场，人多又走得快的那边让你更有把握。',
  mom:'孩子被左侧商店吸引，正好那里又有一大群人往前走。'
 },
 wuhan:{
  student:'后面有人催“先上一层再说”，你觉得跑起来总比站着强。',
  worker:'搬货老板一挥手，大箱子都朝一层走，你想跟过去省得问路。',
  tourist:'你刚开口就被催着让路。一层已经看见亮灯，腿也不想再爬。',
  mom:'孩子在喊周黑鸭，老板又催你让开，一层的柜台就在眼前。'
 },
 zhengzhou:{
  student:'左边远远亮着“12A”，你脑子里也记着这两个数字。',
  worker:'刚搭话的老乡在左侧招手：“我常走，跟上！”',
  tourist:'两翼的柱子和屏幕几乎一样，有人招手的那边让你安心一点。',
  mom:'孩子指着左边：“我看到数字了！”一旁的老乡也正招呼你过去。'
 }
};
export const stationTemptationEvent:Record<string,string>={shanghai:'sh-corridor',beijing:'bj-entry',guangzhou:'gz-route',hangzhou:'hz-fork',wuhan:'wh-floor',zhengzhou:'zz-wing'};

type Copy={label?:string;detail:string;outcome:string};
function applyCopies(event:EventConfig,copies:Record<string,Copy>,key:(c:Choice)=>string=c=>c.stationDecision?.value??c.label):EventConfig{
 return {...event,choices:event.choices.map(c=>copies[key(c)]?{...c,...copies[key(c)]}:c)};
}

export function withDecisionClues(run:Run,event:EventConfig):EventConfig{
 const role=run.character.id as Playable;
 const temptation=stationTemptations[run.city.id]?.[role]??'你收好行李，抬头看了看周围。';
 switch(event.id){
  case 'sh-corridor':return applyCopies({...event,description:temptation+' 老太太站在通道口念叨：“急什么急。”商店内有人停下取餐；外侧沿墙能看见远处的出发标识。'},{
   outer:{label:'沿墙走外侧长廊',detail:'要绕过整排商店，通道能看得更远',outcome:'改走外侧长廊，接下来避开商店通道'},
   shops:{label:'挤进商店，从亮着的门头穿过去',detail:'门头离你近，有人正从柜台旁穿过去',outcome:'选了商店通道，前面取餐的人占住了通路'}
  });
  case 'bj-entry':return applyCopies({...event,description:temptation+' 西侧有拉箱子的人排队；东侧门不断有人出来，门边的小牌写着“只出不进”。'},{
   west:{label:'去西侧，跟拉箱子的人排',detail:'门前有队伍，安检员正在招呼下一位',outcome:'从西侧入口进入安检区'},
   east:{label:'试试人少的那边',detail:'门口空出一大片，看起来能直接走过去',outcome:'东侧被拦下，已折返西侧入口'}
  });
  case 'gz-route':return applyCopies({...event,description:temptation+' 中区看得见对面的大厅，却隔着人群和向上的电梯牌；外围连桥的安检标识一直沿同一层延伸。'},{
   outer:{label:'走外围连桥',detail:'得绕过大厅边缘，安检标识沿着连桥延伸',outcome:'连桥接上安检层，接下来不用走中区电梯'},
   center:{label:'跟着热心人穿中区',detail:'对面大厅就在视线里，前面的人正在往里挤',outcome:'穿进中区后还要换层，继续往电梯区走'}
  });
  case 'hz-fork':return applyCopies({...event,description:temptation+' 头顶小牌：← 西广场／到达，东侧／铁路出发 →。'},{
   east:{label:'往右，沿铁路出发牌走',detail:'这侧人稀一些，通道拐角后才看得见大厅',outcome:'沿铁路出发标识进入东侧安检'},
   west:{label:'跟着通勤人流左转',detail:'人群走得很熟练，前面还能看见广场亮光',outcome:'跟来的人是出站通勤，已从到达出口折回'}
  });
  case 'hz-zone':return applyCopies({...event,title:'远处已经亮着“6”了，就走那边？',description:`车票是 ${run.gate}。左边的“6”很醒目，旁边小字写着 A；右边写着 B，编号还藏在柱子后。`},{
   b:{label:'往右侧 B 廊找',detail:'得过了柱子才能看见检票口编号',outcome:'字母对上了，沿 B 廊找到检票口'},
   a:{label:'朝左边亮着的“6”过去',detail:'号码已经看得见，还有人在那边候检',outcome:'走近才发现是 6A，已折回 B 廊'}
  });
  case 'wh-floor':return applyCopies({...event,description:temptation+' 柱子上还有一块楼层牌：B1 地铁，1F 到达，2F 铁路出发。'},{
   '2f':{label:'往上找 2F 出发层',detail:'还要继续换层，先找上楼的通道',outcome:'确认 2F 出发层，接下来选择上楼方式'},
   '1f':{label:'先跟大箱子去 1F',detail:'这一层已经亮着大厅灯，前面的人都在走',outcome:'到了 1F 才发现是到达层，重新回到出发通路'}
  });
  case 'zz-wing':return applyCopies({...event,description:temptation+` 车票 ${run.gate}。头顶牌子：左翼 01–15，右翼 16–30。`},{
   east:{label:'往右侧连廊找',detail:'得过了中央柱子才能看清各个检票口',outcome:'进入 16–30 区，继续核对车票字母'},
   west:{label:'跟着招手的老乡往左',detail:'那边已经看见亮着的号码，老乡还在招手',outcome:'左翼是 01–15 区，已折回中央大厅找 21A'}
  });
  case 'station-sign':return {...event,choices:event.choices.map(c=>({...c,
   label:c.stationDecision?.optimal?(c.label.startsWith('右')?'往右侧编号区找':'往左侧编号区找'):(c.label.startsWith('右')?'往右，跟着拉箱子的人':'往左，跟着拉箱子的人'),
   detail:c.stationDecision?.optimal?'按头顶的数字范围走，拐角后再找具体号码':'前面的人拖着箱子走得很急，像是同样在赶车',
   outcome:c.stationDecision?.optimal?'对上数字范围，继续找检票口':'人群去的是另一片编号区，已折回重新找路'
  }))};
  case 'zz-number':return {...event,choices:event.choices.map(c=>({...c,detail:'对照车票上的数字和字母'}))};
  case 'zz-hometown':return {...event,description:run.character.id==='worker'?'老乡热情地拦住你：“就问一句，工资多少？”你想尽快结束寒暄，身后还有人往中央大厅走。':'老乡挡在分区牌前：“我在这儿熟，聊两句，我告诉你怎么走。”你还没看清车票区域。',choices:event.choices.map(c=>({...c,
   detail:c.label==='告诉他'?'他一脸好奇，像是只想寒暄一句':c.label==='停下来聊两句'?'顺便听他指路，也许省得自己找':c.label.startsWith('不告诉')?'笑着摆摆手，先从他身边过去':'跟他说正在赶车，再抬头看分区牌',
   outcome:c.label.startsWith('不告诉')?'老乡追着问了几句，终于脱身':c.label==='停下来聊两句'?'聊完才发现他说的是另一趟车，还是得自己看牌':undefined
  }))};
  case 'bj-parent-strict':return applyCopies({...event,description:'孩子抱着水壶，前面刚有家长抱孩子过去。你想照着做；但托盘边的小牌要求水壶、包分开检查，安检员还在示意放东西。'},{
   prepared:{detail:'先腾出一只手，把水壶和包分开放',outcome:'分盘检查完成，牵好孩子继续走'},
   rescan:{label:'抱着孩子直接跟过去',detail:'前面的家长已经过去了，孩子也不肯放水壶',outcome:'水壶还没单独检查，被叫回去重新分盘'}
  });
  case 'hz-parent-lift':return applyCopies({...event,description:'左边近电梯的楼层灯亮着，孩子也想过去。你记得它上个月就坏了；门边还摆着维修牌。右侧远些，但你知道肯定能用。'},{
   right:{label:'牵着孩子去右侧电梯',detail:'还要绕过连廊，记得这部能正常用',outcome:'右侧电梯正常到达，带孩子上楼'},
   left:{label:'去左侧看看，灯已经亮了',detail:'就在眼前，也许只是忘了收走维修牌',outcome:'亮的是楼层灯，左侧仍在维修，折返右侧电梯'}
  });
  case 'tourist-wayfinding':return {...event,choices:event.choices.map(c=>c.label.startsWith('跟着')?{...c,detail:'前面几个人拖着行李，走起来很有把握',outcome:run.characterTime?.wrongWayRisk?'跟着人群走到了另一处出口，折返重新找路':'这次人群也往铁路出发，跟上了通路'}:c)};
  case 'gates':return {...event,title:'检票通道开着，往哪边排？',description:(run.character.id==='student'?'你已经把身份证握在手里，想找个人少的口赶快进去。':run.character.id==='worker'?'箱子不好掉头，你想就近找个口排上。':run.character.id==='tourist'?'腿很酸，最近的通道看起来格外诱人。':'孩子不想再走了，你很想就在最近的通道排上。')+' 几条队伍人数差不多，留意前面的人在做什么。'};
 }
 return event;
}

// Shuffle presentation only; spatial gate/queue ordering and action identities stay intact.
export function visibleChoices(run:Run,event:EventConfig):Choice[]{
 if(event.interaction?.kind!=='choice'||event.choices.length<2||event.id==='security-queue')return event.choices;
 let hash=2166136261;
 for(const char of run.id+':'+event.id)hash=Math.imul(hash^char.charCodeAt(0),16777619)>>>0;
 const offset=hash%event.choices.length;
 return [...event.choices.slice(offset),...event.choices.slice(0,offset)];
}
