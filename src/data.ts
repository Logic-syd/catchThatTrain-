import {SPRINT} from './sprintConfig';
export type CharacterConfig = { id: string; name: string; short: string; emoji: string; difficulty: number; speed: number; sprintSpeed: number; luggage: boolean; child: boolean; stroller: boolean; description: string; specialEvents: string[] };
export const characters: CharacterConfig[] = [
 {id:'student',name:'背包大学生',short:'朋友家出来 · 精力满格 · 容易拖到最后',emoji:'🎓',difficulty:1,speed:1,sprintSpeed:SPRINT.multiplier.student,luggage:false,child:false,stroller:false,description:'短途出游后从朋友家回学校。精力和手机都满格，只是总觉得还来得及。',specialEvents:['student']},
 {id:'worker',name:'打工人',short:'从家返工 · 妈妈塞满行李 · 路线熟',emoji:'🧳',difficulty:2,speed:.92,sprintSpeed:.92*SPRINT.multiplier.worker,luggage:true,child:false,stroller:false,description:'假期结束，从家里返工。妈妈不断往箱子里塞东西，老板还在催你明早打卡。',specialEvents:['luggage','wheel','worker-boss-call']},
 {id:'tourist',name:'疲惫游客',short:'已退房 · 23,487 步 · 陌生城市',emoji:'📷',difficulty:3,speed:.88,sprintSpeed:.88*SPRINT.multiplier.tourist,luggage:true,child:false,stroller:false,description:'酒店已退房，旅行走了两万多步；必须赶回家上班。小箱子不重，但在陌生车站很容易碰壁。',specialEvents:['sign','lost','tourist-wayfinding']},
 {id:'mom',name:'带娃家长',short:'一个都不能少',emoji:'👩‍👧',difficulty:4,speed:.94,sprintSpeed:.94*SPRINT.multiplier.mom,luggage:false,child:true,stroller:false,description:'你认得路，也跑得动。孩子会累、会尿急，冲太快还会掉队。',specialEvents:['toilet','child','toy']},
 {id:'family',name:'婴儿车与大箱子的家庭',short:'全家总动员',emoji:'👨‍👩‍👧',difficulty:5,speed:.7,sprintSpeed:1.35,luggage:true,child:true,stroller:true,description:'婴儿车不能走楼梯。寻找无障碍电梯，给全家留出转弯空间。',specialEvents:['lift','stroller','toilet']}
];
export type MetroRoute = { id:string; lines:string[]; color:string; minutes:number; walk:number; transfers:number; risk:'low'|'medium'|'high'; tip:string; direction:string; opposite:string; stops:string[]; via?:string };
export type StationConfig = { accent:string; crowd:number; width:number; gate:string; alternateGate:string; entryName:string; feature:string; liftWait:number; obstacleShift:number };
export type CityConfig = {id:string;name:string;en:string;stationName:string;destination:string;train:string;spawnStations:{name:string;routes:MetroRoute[]}[];stationConfig:StationConfig;specialEvents:string[]};
const route=(id:string,lines:string[],minutes:number,walk:number,direction:string,opposite:string,stops:string[],via?:string):MetroRoute=>({id,lines,minutes,walk,transfers:lines.length-1,direction,opposite,stops,via,color:lines[0]==='2'?'#62a744':lines[0]==='10'?'#bba0d8':lines[0]==='1'?'#d14f57':'#3296a0',risk:lines.length===1?'low':walk>600?'high':'medium',tip:lines.length===1?'少换乘，稳稳向前':walk>600?'快一点，也冒险一点':'注意换乘通道与方向'});
const station=(accent:string,crowd:number,gate:string,feature:string,shift=0):StationConfig=>({accent,crowd,width:640,gate,alternateGate:'21B',entryName:'铁路出发 · 进站口',feature,liftWait:55+crowd*10,obstacleShift:shift});
export const cities:CityConfig[]=[
 {id:'shanghai',name:'上海',en:'SHANGHAI',stationName:'上海虹桥站',destination:'北京南',train:'G14',stationConfig:station('#4879dc',10,'12A','看起来到了，其实还没到。',0),specialEvents:['sh-airport','sh-corridor','sh-exit'],spawnStations:[
 {name:'南京东路',routes:[route('sh-n-2',['2'],36,380,'蟠祥路方向','浦东1号2号航站楼方向',['南京东路','人民广场','静安寺','虹桥2号航站楼','虹桥火车站']),route('sh-n-10',['10'],39,240,'虹桥火车站方向','基隆路方向',['南京东路','豫园','交通大学','虹桥路','虹桥火车站']),route('sh-n-x',['2','10'],33,760,'蟠祥路方向','浦东1号2号航站楼方向',['南京东路','静安寺','虹桥2号航站楼','虹桥火车站'],'虹桥2号航站楼')]},
 {name:'人民广场',routes:[route('sh-p-2',['2'],34,400,'蟠祥路方向','浦东1号2号航站楼方向',['人民广场','静安寺','中山公园','虹桥火车站']),route('sh-p-x',['8','10'],39,650,'沈杜公路方向','市光路方向',['人民广场','老西门','虹桥路','虹桥火车站'],'老西门')]},
 {name:'交通大学',routes:[route('sh-j-10',['10'],25,320,'虹桥火车站方向','基隆路方向',['交通大学','虹桥路','上海动物园','虹桥火车站']),route('sh-j-x',['11','2'],30,720,'嘉定北方向','迪士尼方向',['交通大学','江苏路','中山公园','虹桥火车站'],'江苏路')]}]},
 {id:'beijing',name:'北京',en:'BEIJING',stationName:'北京南站',destination:'上海虹桥',train:'G103',stationConfig:station('#bd5551',14,'8A','穿过人海，再确认一次南北。',24),specialEvents:['bj-crowd','bj-north','bj-transfer'],spawnStations:[
 {name:'西单',routes:[route('bj-x-4',['4'],17,540,'天宫院方向','安河桥北方向',['西单','菜市口','陶然亭','北京南站']),route('bj-x-x',['1','5','14'],30,880,'环球度假区方向','古城方向',['西单','东单','蒲黄榆','北京南站'],'东单 / 蒲黄榆')]},
 {name:'宣武门',routes:[route('bj-s-4',['4'],13,440,'天宫院方向','安河桥北方向',['宣武门','菜市口','陶然亭','北京南站']),route('bj-s-x',['2','5','14'],29,780,'和平门方向','长椿街方向',['宣武门','崇文门','蒲黄榆','北京南站'],'崇文门 / 蒲黄榆')]},
 {name:'蒲黄榆',routes:[route('bj-p-14',['14'],12,380,'张郭庄方向','善各庄方向',['蒲黄榆','景泰','永定门外','北京南站']),route('bj-p-x',['5','7','4'],25,730,'天通苑北方向','宋家庄方向',['蒲黄榆','磁器口','菜市口','北京南站'],'磁器口 / 菜市口')]}]},
 {id:'guangzhou',name:'广州',en:'GUANGZHOU',stationName:'广州南站',destination:'深圳北',train:'G6251',stationConfig:station('#e99a38',12,'16A','站很大，每一个转弯都算数。',-20),specialEvents:['gz-fast','gz-hall','gz-queue'],spawnStations:[
 {name:'公园前',routes:[route('gz-g-2',['2'],31,420,'广州南站方向','嘉禾望岗方向',['公园前','昌岗','汉溪长隆','广州南站']),route('gz-g-x',['1','3','7'],42,780,'天河客运站方向','西塱方向',['公园前','体育西路','汉溪长隆','广州南站'],'体育西路 / 汉溪长隆')]},
 {name:'汉溪长隆',routes:[route('gz-h-7',['7'],13,420,'美的大道方向','燕山方向',['汉溪长隆','钟村','石壁','广州南站']),route('gz-h-x',['3','22'],18,740,'海傍方向','天河客运站方向',['汉溪长隆','番禺广场','广州南站'],'番禺广场')]},
 {name:'昌岗',routes:[route('gz-c-2',['2'],24,360,'广州南站方向','嘉禾望岗方向',['昌岗','南洲','石壁','广州南站']),route('gz-c-x',['8','3','7'],36,690,'万胜围方向','滘心方向',['昌岗','客村','汉溪长隆','广州南站'],'客村 / 汉溪长隆')]}]},
 {id:'hangzhou',name:'杭州',en:'HANGZHOU',stationName:'杭州东站',destination:'南京南',train:'G7564',stationConfig:station('#509788',8,'6B','选对线路，也要选对广场。',35),specialEvents:['hz-east','hz-exit','hz-transfer'],spawnStations:[
 {name:'西湖文化广场',routes:[route('hz-w-1',['1'],16,340,'萧山国际机场方向','湘湖方向',['西湖文化广场','打铁关','闸弄口','火车东站']),route('hz-w-19',['19'],11,880,'永盛路方向','苕溪方向',['西湖文化广场','驿城路','火车东站（东广场）'])]},
 {name:'龙翔桥',routes:[route('hz-l-1',['1'],23,320,'萧山国际机场方向','湘湖方向',['龙翔桥','凤起路','打铁关','火车东站']),route('hz-l-x',['1','19'],20,770,'萧山国际机场方向','湘湖方向',['龙翔桥','西湖文化广场','火车东站（东广场）'],'西湖文化广场')]},
 {name:'钱江路',routes:[route('hz-q-4',['4'],15,430,'池华街方向','浦沿方向',['钱江路','景芳','新风','火车东站']),route('hz-q-x',['2','1'],30,600,'良渚方向','朝阳方向',['钱江路','凤起路','火车东站'],'凤起路')]}]},
 {id:'wuhan',name:'武汉',en:'WUHAN',stationName:'武汉站',destination:'长沙南',train:'G1103',stationConfig:station('#8868ba',10,'9A','上楼，下楼，再穿过长长的大厅。',-35),specialEvents:['wh-floor','wh-hall','wh-sign'],spawnStations:[
 {name:'洪山广场',routes:[route('wh-h-4',['4'],29,520,'武汉火车站方向','柏林方向',['洪山广场','岳家嘴','园林路','武汉火车站']),route('wh-h-x',['2','8','4'],37,750,'天河机场方向','佛祖岭方向',['洪山广场','街道口','岳家嘴','武汉火车站'],'街道口 / 岳家嘴')]},
 {name:'岳家嘴',routes:[route('wh-y-4',['4'],21,480,'武汉火车站方向','柏林方向',['岳家嘴','仁和路','工业四路','武汉火车站']),route('wh-y-x',['8','7','5'],36,840,'金潭路方向','军运村方向',['岳家嘴','徐东','徐家棚','武汉站东广场'],'徐东 / 徐家棚')]},
 {name:'徐家棚',routes:[route('wh-x-5',['5'],28,720,'武汉站东广场方向','红霞方向',['徐家棚','科普公园','厂前','武汉站东广场']),route('wh-x-x',['8','4'],30,500,'军运村方向','金潭路方向',['徐家棚','岳家嘴','武汉火车站'],'岳家嘴')]}]},
 {id:'zhengzhou',name:'郑州',en:'ZHENGZHOU',stationName:'郑州东站',destination:'西安北',train:'G2005',stationConfig:station('#bc963e',9,'15B','环线转一圈，时间可不等人。',15),specialEvents:['zz-ring','zz-hall','zz-exit'],spawnStations:[
 {name:'紫荆山',routes:[route('zz-z-1',['1'],25,460,'河南大学新区方向','河南工业大学方向',['紫荆山','燕庄','东风南路','郑州东站']),route('zz-z-x',['2','5'],32,680,'贾河方向','南四环方向',['紫荆山','黄河路','金水东路','郑州东站'],'黄河路')]},
 {name:'五一公园',routes:[route('zz-w-1',['1'],39,380,'河南大学新区方向','河南工业大学方向',['五一公园','紫荆山','会展中心','郑州东站']),route('zz-w-5',['5'],43,600,'外环 · 月季公园方向','内环 · 桐淮方向',['五一公园','月季公园','黄河路','郑州东站'])]},
 {name:'黄河路',routes:[route('zz-h-5',['5'],24,560,'外环 · 省人民医院方向','内环 · 郑州人民医院方向',['黄河路','省人民医院','金水东路','郑州东站']),route('zz-h-x',['2','1'],29,690,'南四环方向','贾河方向',['黄河路','紫荆山','郑州东站'],'紫荆山')]}]}
];
export type Choice = {outcome?:string;queuePeople?:number;metroEffect?:'door-wait'|'seated-wait';stationDecision?:import('./stations').StationDecision;studentEffect?:'escalator'|'stairs'|'lift'|'queue'|'wrong-turn';effect?:'elder-push'|'elder-detour';escalator?:number;boost?:number;detour?:{x:number;y:number;label:string};lane?:number;label:string; detail:string; seconds:number; slow?:number; restore?:boolean; gate?:boolean};
export type EventConfig={interaction?:import('./flow').Interaction;id:string;title:string;description:string;phase:'metro'|'station'|'both';choices:Choice[];character?:string[]};
const event=(id:string,title:string,description:string,seconds:number,alt:string,altSeconds:number,phase:EventConfig['phase']='both',character?:string[]):EventConfig=>({id,title,description,phase,character,choices:[{label:alt,detail:altSeconds?`预计 ${altSeconds} 秒`:'继续赶路',seconds:altSeconds},{label:'稳妥处理',detail:`预计 ${seconds} 秒`,seconds,restore:true}]});
export const events:EventConfig[]=[
 event('signal','前方信号等待','列车临时停车。趁现在确认路线，还是站到车门旁准备下车？',47,'提前到车门旁',32,'metro'),
 event('wait','下一班车还要等','站台上人渐渐多了。走到车厢两端也许更好上车。',85,'走到站台另一端',40,'metro'),
 event('crowd','换乘通道人潮涌动','人群堵在扶梯口，旁边还有一条稍远的通道。',75,'走旁边的通道',40),
 event('escalator','扶梯口堵住了','大箱子挡在入口。等一下，还是换一部扶梯？',65,'绕到另一部扶梯',38),
 event('luggage','行李箱卡住了','箱轮卡在地砖缝里。放慢速度把它提起来吧。',37,'提起箱子继续走',24,'both',['worker','tourist','family']),
 event('wheel','箱轮开始抗议','再拖下去会越走越慢。',42,'换一只手提着走',25,'both',['worker','tourist','family']),
 event('sign','再确认一次指示牌','你有点不确定刚才那个箭头。打开线路图能帮你判断。',32,'向工作人员问路',22,'both',['tourist']),
 event('lost','等等，这是哪一层？','你记不清刚才的楼层标识了。',48,'找楼层指示牌',28,'station',['tourist']),
 {id:'toilet',title:'妈妈，我想上厕所',description:'小手拽住了你。厕所就在前面，要做个决定了。',phase:'both',character:['mom','family'],choices:[{label:'再坚持一会儿',detail:'孩子跟随速度降低 40%，稍后还会需要照顾',seconds:0,slow:70},{label:'先去厕所',detail:'预计 2 分 30 秒，恢复跟随速度',seconds:150,restore:true}]},
 {id:'child',title:'小朋友跟不上了',description:'回头看看，孩子在人群后面喊你。',phase:'both',character:['mom','family'],choices:[{label:'牵好小手',detail:'停下 25 秒，恢复跟随',seconds:25,restore:true},{label:'慢慢等他跟上',detail:'接下来 45 秒走得更慢',seconds:0,slow:45}]},
 event('toy','玩具掉了','心爱的玩具滚到长椅下面了。',42,'一起捡起来',28,'both',['mom','family']),
 event('lift','电梯刚刚满员','带着婴儿车，只能选择无障碍通道。',95,'寻找下一部电梯',60,'station',['family']),
 event('stroller','婴儿车需要转弯','转角有一排箱子，通道比想象中窄。',45,'从宽通道绕行',30,'station',['family']),
 event('student','跑起来，风都追不上','前方换乘通道很空，要不要抓紧这段机会？',20,'轻装小跑通过',0,'metro',['student']),
 event('water','有一点渴了','售货机就在旁边。补点水，还是继续向前？',20,'先赶车，之后再喝',0,'station'),
 event('id','身份证放哪儿了？','在包内袋里摸到了卡套。提前准备就能快一点。',38,'提前拿出身份证',12,'station'),
 event('rescan','行李需要复检','安检员示意你打开侧袋，确认里面的充电设备。',60,'配合安检员检查',40,'station'),
 event('bottle','水瓶忘记拿出来了','按工作人员指引，拿出水瓶完成检查。',35,'立即取出水瓶',20,'station'),
 event('queue','这条队伍走得很慢','隔壁队伍短一些，但换过去也需要时间。',80,'换到隔壁队伍',45,'station'),
 event('tour','旅行团停在路中间','一面小旗子后面，是一大群正在数人的旅客。',60,'沿大厅外侧绕过',30,'station'),
 event('phone','手机电量只剩 1%','赶紧记住车次和检票口，别依赖屏幕了。',30,'记住车次和检票口',12,'station'),
 event('ticket','检票口前排起了队','先准备好证件，跟着队伍往前走。',50,'提前准备证件',22,'station'),
 event('wrongexit','出口名称有点相似','铁路出发与到达不是一个方向。',65,'查看出发层标识',20,'station'),
 event('cleaning','前方正在清洁','湿滑区域被围栏拦住，请从侧面通行。',55,'沿围栏绕行',28,'station'),
 event('door','车门前挤满了人','先下后上，等人群散开再通过。',45,'走到另一扇车门',26,'metro'),
 event('missed','刚刚错过一班车','车尾灯消失在隧道里，下一班还要一会儿。',100,'趁等车确认换乘',70,'metro'),
 event('bag','背包拉链开了','停下来收好物品，别在路上再掉东西。',26,'快速整理好',15),
 event('announcement','广播声音有点模糊','看一下电子屏，确认目的地和车次。',25,'确认电子屏',15),
 event('shortcut','前面有条宽敞通道','绕开商铺门口，通行反而会快一点。',20,'走宽敞通道',0,'station'),
 {id:'gatechange',title:'广播：检票口调整',description:'你乘坐的列车改在 21B 检票。大厅指示已更新，请重新确认方向。',phase:'station',choices:[{label:'记住 21B，立即出发',detail:'新的检票口在大厅另一侧',seconds:0,gate:true}]},
 ...[
 ['sh-airport','是机场，还是火车站？','虹桥航站楼并不是虹桥火车站。看清铁路标志。'],['sh-corridor','虹桥的长长长通道','指示牌说到了，脚却说还没有。'],['sh-exit','虹桥出口分岔','跟随铁路出发标识，避开机场出口。'],
 ['bj-crowd','北京南，人从众','进站层汇入一股新的客流。'],['bj-north','南北入口别弄反','出发层指示牌在立柱的另一边。'],['bj-transfer','换乘还有一段路','通道尽头才是你要找的扶梯。'],
 ['gz-fast','快线路的远出口','列车快了，出站通道却更长了。'],['gz-hall','广州南的巨大大厅','抬头找分区，再找检票口。'],['gz-queue','南站进站高峰','安检队伍在入口处分成两路。'],
 ['hz-east','东广场不是东站大厅','还需要走一段连接通道。'],['hz-exit','火车东站出口选择','对准铁路出发的图标。'],['hz-transfer','换乘层不在同一层','沿着指示再下一层。'],
 ['wh-floor','武汉站楼层变化','先上出发层，再寻找检票口。'],['wh-hall','大厅比想象中更宽','找准方向，减少绕行。'],['wh-sign','东广场指示牌','铁路入口与地铁入口分开了。'],
 ['zz-ring','环线方向再确认','内环与外环都会到，但耗时不同。'],['zz-hall','东站候车厅分区','先确认字母，再确认数字。'],['zz-exit','东站出口汇流','几条线路的旅客都汇进了这里。']
 ].map(([id,title,desc])=>event(id,title,desc,65,'停下确认指示',25))
];
