import {STATIONS} from './stations';
export type Category='general'|'student'|'worker'|'tourist'|'mother'|'family'|'station';
export type Rarity='common'|'uncommon'|'rare'|'legendary';
export type Rule={field:string;op:'eq'|'gte'|'lte'|'lt'|'gt';value:number|boolean|string}|{all:Rule[]}|{any:Rule[]};
export interface Achievement{id:string;name:string;description:string;category:Category;rarity:Rarity;hidden?:boolean;legacy?:boolean;condition:Rule;target:number;mode:'once'|'count'|'streak'|'value';progressField?:string;sequenceField?:string}
export const field=(field:string,op:'eq'|'gte'|'lte'|'lt'|'gt',value:number|boolean|string):Rule=>({field,op,value});
const f=(k:string,v:number|boolean=true,op:'eq'|'gte'|'lte'|'lt'|'gt'='eq')=>field('r.'+k,op,v),c=(k:string,v:number|boolean=true,op:'eq'|'gte'|'lte'|'lt'|'gt'='eq')=>f('characterStats.'+k,v,op);
const all=(...all:Rule[]):Rule=>({all});const win=f('success'),fail=f('success',false),clutch=all(win,f('resultMarginSeconds',10,'lte'));
const a=(id:string,name:string,description:string,category:Category,condition:Rule,target=1,mode:Achievement['mode']='once',rarity:Rarity='common',extra:Partial<Achievement>={}):Achievement=>({id,name,description,category,condition,target,mode,rarity,...extra});
export const ACHIEVEMENTS:Achievement[]=[
 a('first-win','第一次总是最难','第一次成功赶上车。','general',win),
 a('three-wins','三连上车','连续 3 局成功。','general',win,3,'streak','uncommon'),
 a('five-wins','五连上车','连续 5 局成功。','general',win,5,'streak','rare'),
 a('clutch-pro','压哨专业户','累计 3 次检票余量不超过 10 秒并登车。','general',clutch,3,'count','rare'),
 a('last-second','真·最后一秒','检票余量不超过 1 秒并成功登车。','general',all(win,f('resultMarginSeconds',1,'lte')),1,'once','rare'),
 a('perfect-run','一路顺风','一局没有走错、坐过站或翻包错误并成功。','general',all(win,f('errors',0)),1,'once','uncommon'),
 a('route-ten','路线达人','累计 10 局零走错、零坐反。','general',all(f('wrongTurns',0),f('wrongDirections',0)),10,'count','uncommon'),
 a('map-memory','地图记住了','同一站连续 3 局路线效率至少 90%。','general',f('routeEfficiency',90,'gte'),3,'value','uncommon',{progressField:'station.goodRouteStreak'}),
 a('gambler','赌徒','连续成功完成 3 次高风险选择。','general',win,3,'streak','rare',{sequenceField:'r.highRiskResults'}),
 a('stable-five','稳健派','采用稳定路径成功 5 局。','general',all(win,f('stableChoices',1,'gte')),5,'count','uncommon'),
 a('comeback','逆风翻盘','戏剧性指数至少 80，仍成功登车。','general',all(win,f('dramaScore',80,'gte')),1,'once','rare'),
 a('disaster-star','灾难片主角','戏剧性指数至少 100，仍成功登车。','general',all(win,f('dramaScore',100,'gte')),1,'once','legendary'),
 a('so-close','就差一点','失败时距离检票口或车门不足 20 米。','general',all(fail,f('position.distanceToGoalMeters',20,'lt')),1,'once','uncommon'),
 a('one-late','差一秒','失败时按剩余路程估算，差距不超过 1 秒。','general',all(fail,f('resultMarginSeconds',-1,'gte')),1,'once','rare'),
 a('returning','我还会回来的','同一车站失败至少 3 次后，首次成功。','general',all(win,field('station.wins','eq',1),field('station.failuresBeforeFirstWin','gte',3)),1,'once','rare'),
 a('student-tea-three','奶茶党','买奶茶并成功 3 次。','student',all(win,c('tea')),3,'count','uncommon'),
 a('student-bag-five','包里有谱','连续 5 局大学生，身份证第一次就找对。','student',all(c('idFound'),c('bagMistakes',0)),5,'streak','uncommon'),
 a('student-bag-mystery','身份证失踪案','一局翻找至少 4 个书包夹层。','student',c('bagAttempts',4,'gte'),1,'once','uncommon'),
 a('student-time-three','极限时间管理','初始赶车余量不足 10% 并成功 3 次。','student',all(win,f('initialMarginRatio',.1,'lt')),3,'count','rare'),
 a('student-young','年轻真好','最后冲刺成为关键贡献，并完成 5 次余量不超过 10 秒的成功。','student',all(clutch,c('lateSprintDecisive')),5,'count','rare'),
 a('student-breakfast','吃完再赶','吃了饭团，仍成功登车。','student',all(win,c('breakfast'))),
 a('student-everything','什么都要','奶茶、饭团和另一项主动耗时选择之后仍成功。','student',all(win,c('tea'),c('breakfast'),c('otherDelay')),1,'once','rare'),
 a('worker-gifts','土特产也带回去了','带着土特产成功登车。','worker',all(win,c('localGifts'))),
 a('worker-load','重装返工','负重至少 75，成功 3 次。','worker',all(win,c('load',75,'gte')),3,'count','uncommon'),
 a('worker-judgment','职业本能','连续 5 次安检或路线判断正确。','worker',win,5,'streak','uncommon',{sequenceField:'r.choiceResults.judgment'}),
 a('worker-punctual','明天照常打卡','成功且检票余量至少 3 分钟。','worker',all(win,f('resultMarginSeconds',180,'gte'))),
 a('worker-holiday','人还在假期','忽略工作消息，仍然成功。','worker',all(win,c('ignoredWork')),1,'once','uncommon'),
 a('worker-buff','班味加速器','最后冲刺 buff 成为关键贡献并压哨成功。','worker',all(clutch,c('workBuffDecisive')),1,'once','rare'),
 a('tourist-first','红眼车幸存者','首次以游客成功。','tourist',win),
 a('tourist-bed','地铁也是床','地铁补觉后成功 3 次。','tourist',all(win,c('slept')),3,'count','uncommon'),
 a('tourist-alarm','闹钟靠谱','连续 5 次地铁补觉没有坐过站。','tourist',all(c('slept'),f('missedStops',0)),5,'streak','uncommon',{sequenceField:'r.choiceResults.sleep'}),
 a('tourist-overslept','睡过头了','因睡过站而失败。','tourist',all(fail,c('slept'),c('missedStopDecisive')),1,'once','uncommon'),
 a('tourist-coffee','咖啡续命','咖啡成为关键成功因素。','tourist',all(win,c('coffeeDecisive')),1,'once','rare'),
 a('tourist-low','两万步以后还能跑','初始精力不超过 25，仍压哨成功。','tourist',all(clutch,c('initialEnergy',25,'lte')),1,'once','rare'),
 a('mother-first','带娃也能赶车','首次以带娃妈妈成功。','mother',win),
 a('mother-together','一个都没掉队','孩子全程未掉队并成功。','mother',all(win,c('childNeverSeparated')),1,'once','uncommon'),
 a('mother-toilet','厕所危机解除','孩子去过厕所，仍成功登车。','mother',all(win,c('childToilet')),1,'once','uncommon'),
 a('mother-wet','车赶上了，裤子没赶上','孩子尿裤子后，仍成功登车。','mother',all(win,c('wetPants')),1,'once','rare',{hidden:true}),
 a('mother-super','超级妈妈','经历至少 3 个孩子负面事件，仍成功。','mother',all(win,c('childNegativeEvents',3,'gte')),1,'once','rare'),
 a('mother-patience','情绪管理大师','完成一局，孩子耐心全程未归零。','mother',c('patienceNeverZero'),1,'once','uncommon'),
 a('family-first','一家整整齐齐','首次以婴儿车家庭成功。','family',win),
 a('family-stroller','婴儿车熟练工','婴儿车保持展开并成功 3 次。','family',all(win,c('strollerOpen')),3,'count','uncommon'),
 a('family-access','无障碍路线大师','连续 5 次无障碍路线判断正确。','family',win,5,'streak','uncommon',{sequenceField:'r.choiceResults.accessibility'}),
 a('family-items','什么都带上了','返回取至少 2 件物品后仍成功。','family',all(win,c('retrievedItems',2,'gte')),1,'once','rare'),
 a('family-lift','电梯受害者','电梯延误是关键败因。','family',all(fail,c('liftDecisive')),1,'once','uncommon'),
 a('family-tough','这家人命真硬','至少 3 项负面系统同时影响，仍成功。','family',all(win,c('negativeSystems',3,'gte')),1,'once','rare'),
 a('family-heavy','重装上阵','负重至少 90，仍成功。','family',all(win,c('load',90,'gte')),1,'once','rare'),
 a('secret-student','大学生的时间观','主动准备至少花费 120 秒，并有失误，仍压哨成功。','student',all(clutch,c('extraPreparationSeconds',120,'gte'),f('errors',1,'gte')),1,'once','legendary',{hidden:true}),
 a('secret-disaster-win','这都能赶上？','戏剧性指数至少 100，仍然成功。','general',all(win,f('dramaScore',100,'gte')),1,'once','legendary',{hidden:true}),
 a('secret-disaster-loss','今天真不该出门','戏剧性指数至少 100，最终失败。','general',all(fail,f('dramaScore',100,'gte')),1,'once','rare',{hidden:true}),
 a('secret-tea','奶茶误我','奶茶的单项时间损失足以填补失败差距。','student',all(fail,c('tea'),c('teaDecisive')),1,'once','rare',{hidden:true}),
 a('secret-lift','电梯害人','电梯是关键败因，预计差距不超过 30 秒。','general',all(fail,c('liftDecisive'),f('resultMarginSeconds',-30,'gte')),1,'once','rare',{hidden:true}),
 a('secret-second','真就差一秒','失败时按剩余路程估算，差距不超过 1 秒。','general',all(fail,f('resultMarginSeconds',-1,'gte')),1,'once','legendary',{hidden:true}),
 ...STATIONS.map(st=>a('station-'+st.id,st.id==='shanghai'?'首次征服上海虹桥':st.id==='beijing'?'北京南零失误':st.id==='guangzhou'?'广州南也没拦住你':st.id==='wuhan'?'武汉站换层专家':st.id==='zhengzhou'?'郑州东认路达人':'杭州东路线王',`在${st.name}成功${st.id==='shanghai'?'':'，本站关键选择全部正确'}。`,'station',all(win,field('r.stationId','eq',st.id),...(st.id==='shanghai'?[]:[f('stationMastery')])),1,'once','uncommon')),
 a('six-stations','六站都拦不住','六站都至少成功一次。','station',field('p.conqueredStations','gte',6),6,'value','rare',{progressField:'p.conqueredStations'}),
 // Old rules remain as historical badges; changed thresholds receive new IDs.
 ...[
 ['three-clutch','三连压哨','连续 3 局在 15 秒内压哨成功。'],['safe-stops','站名记得牢','连续 3 局成功且零方向错误、零坐过站。'],['first-clutch','第一次极限成功','在 15 秒内压哨成功。'],['ten-meters','只差十米','距离目标 10 米内失败。'],['bag-ready','包里有谱 · 旧版','提前检查身份证并零翻错成功。'],['tea-win','奶茶党也能赢','买奶茶仍赶上车。'],['found-id','身份证不再失踪','未检查但 12 秒内零失误找到身份证并登车。']
 ].map(([id,name,description])=>a(id,name,description+'（旧版纪念徽章）','general',field('never','eq',true),1,'once','common',{legacy:true}))
];
export function getField(context:unknown,path:string):unknown{return path.split('.').reduce<unknown>((v,k)=>v&&typeof v==='object'?(v as Record<string,unknown>)[k]:undefined,context);}
export function matches(rule:Rule,context:unknown):boolean{if('all'in rule)return rule.all.every(r=>matches(r,context));if('any'in rule)return rule.any.some(r=>matches(r,context));const v=getField(context,rule.field);if(v===undefined||v===null)return false;if(rule.op==='eq')return v===rule.value;if(typeof v!=='number'||typeof rule.value!=='number'||!Number.isFinite(v))return false;return rule.op==='gte'?v>=rule.value:rule.op==='lte'?v<=rule.value:rule.op==='lt'?v<rule.value:v>rule.value;}
