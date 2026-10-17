// Short player-facing choices. IDs, prices and effects still come from the rules.
type BriefPreparation = {title:string;choices:Record<string,{label:string;hint:string}>};
const copy:Record<string,BriefPreparation> = {
 tea:{title:'要不要买杯奶茶？',choices:{
  buy:{label:'买一杯',hint:'提提神，但占一只手'},
  skip:{label:'赶车要紧',hint:'双手空出来，路上更利索'},
 }},
 id:{title:'身份证放哪儿了？',choices:{
  check:{label:'检查一下',hint:'放进前袋，检票时好找'},
  skip:{label:'到站再找',hint:'少耽搁，之后得翻包'},
 }},
 breakfast:{title:'空着肚子出发？',choices:{
  eat:{label:'吃个饭团',hint:'垫垫肚子，后半程不挨饿'},
  skip:{label:'上车再吃',hint:'先赶路，后面容易饿'},
 }},
 'worker-0':{title:'妈：“这袋特产也带上。”',choices:{
  'take-gifts':{label:'带上',hint:'一份心意，箱子更重'},
  'leave-gifts':{label:'轻装走',hint:'少带一袋，走得轻松'},
 }},
 'worker-1':{title:'妈：“吃完再走吧。”',choices:{
  eat:{label:'再吃两口',hint:'留点后劲，赶路时用'},
  leave:{label:'真得走了',hint:'省下吃饭的时间'},
 }},
 'worker-2':{title:'老板：“明早九点，别迟到。”',choices:{
  reply:{label:'回一句，收手机',hint:'这条消息不再追问'},
  ignore:{label:'先静音',hint:'暂时清静，路上可能打来'},
 }},
 'tourist-0':{title:'走了一天，还撑得住吗？',choices:{
  coffee:{label:'买杯咖啡',hint:'比歇脚更解乏'},
  rest:{label:'坐一会儿',hint:'缓口气，攒点力气'},
  go:{label:'车上再歇',hint:'先赶路，地铁上还能补觉'},
 }},
 'tourist-1':{title:'纪念品也要带回去？',choices:{
  keep:{label:'带回去',hint:'留个念想，行李更重'},
  light:{label:'放下纪念品',hint:'少点负担，走得轻松'},
 }},
 'parent-0':{title:'“我不想上厕所！”',choices:{
  'toilet-first':{label:'先去一趟',hint:'提前上厕所，推迟尿急'},
  'toilet-skip':{label:'先出门',hint:'路上可能得找厕所'},
 }},
 'parent-1':{title:'零食带不带？',choices:{
  'snacks-pack':{label:'带两份',hint:'哄娃有备，背包重一点'},
  'snacks-skip':{label:'轻装走',hint:'闹起来得哄，或临时买'},
 }},
};

export function preparationTitle(taskId:string,fallback:string){return copy[taskId]?.title??fallback;}
export function preparationChoice<T extends {id:string;label:string;detail:string;seconds:number}>(taskId:string,choice:T):T{
 const brief=copy[taskId]?.choices[choice.id];
 // A new/unmapped choice retains its original disclosure until its brief is authored.
 return brief?{...choice,label:brief.label,detail:`${choice.seconds>0?`−${choice.seconds} 秒`:'不额外耗时'} · ${brief.hint}`}:choice;
}
