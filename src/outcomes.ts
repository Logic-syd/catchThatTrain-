import type {Run} from './engine';
import {stationFor,type Playstyle} from './stations';
import {createGameResult,analyzeFactors,type GameResult} from './gameResult';
import {selectTitle} from './titles';
import type {TimeImpact} from './resultMetrics';
export {targetDistance} from './gameResult';
export type LossSource='preparation'|'security'|'navigation'|'vertical'|'identity'|'environment'|'waiting'|'other';
export type Outcome={title:string;titleId:string;tags:string[];summary:string;reasons:string[];factors:TimeImpact[];advice?:string;result:GameResult;lesson:string;stationPlaystyle:Playstyle;largestLoss:{source:LossSource;seconds:number};largestRecovery:{source:string;seconds:number};wrongTurns:number;characterEvents:string[];bottleneck:string;distanceToTarget:number|null;securityGood:boolean;stationMastery:boolean;comeback:boolean;losses:Record<LossSource,number>};
export const lossLabels:Record<LossSource,string>={preparation:'出门准备',security:'安检与排队',navigation:'方向与折返',vertical:'换层等待',identity:'身份证搜索',environment:'随机延误',waiting:'停留与操作',other:'其他处理'};
export function lossSource(id:string):LossSource{if(id.startsWith('prepare-'))return 'preparation';if(id.includes('identity'))return 'identity';if(/security|bj-entry|bj-tray|gates/.test(id))return 'security';if(/escalator|vertical|lift|wh-/.test(id))return 'vertical';if(/sign|hz-|zz-|metro-route|route-choice/.test(id))return 'navigation';if(/metro-stop|snag|crowded/.test(id))return 'environment';if(/idle|handling/.test(id))return 'waiting';return 'other';}
export const factorText=(i:TimeImpact)=>`${i.source}，${i.positive?'省下':'花费'}${i.estimated?'约 ':''}${Math.round(Math.abs(i.deltaSeconds))} 秒${!i.avoidable?'（随机事件）':''}。`;
export function resultTags(r:GameResult,factors:TimeImpact[]):string[]{
 const tags:string[]=[],groups=new Set<string>();const add=(t:string,g:string)=>{const dynamic=/\d/.test(t);if(t&&!groups.has(g)&&!(dynamic&&groups.has('dynamic'))&&tags.length<3){groups.add(g);if(dynamic)groups.add('dynamic');tags.push(t);}};
 const top=factors.find(i=>i.decisive)??factors[0];
 if(top)add(top.tag??(top.category==='navigation'?'路线判断失误':top.category==='movement'?'最后冲刺':top.eventId?.includes('lift')?'电梯排队':top.eventId==='prepare-tea'?'奶茶党':top.category==='environment'?'随机延误':''),'contribution');
 const c=r.characterStats;
 if(r.success){if(r.dramaScore>=80)add('顶着 Debuff 上车','drama');else if(r.wasProjectedToFail)add('逆风翻盘','drama');
 if(r.errors===0)add('零走错','navigation');else if(r.missedStops)add('坐过站','navigation');
 if(c.idFound&&Number(c.bagMistakes)===0&&Number(c.bagSeconds)<=5)add('身份证秒找到','character');
 else if(c.childNeverSeparated)add('孩子没掉队','character');else if(c.slept&&r.missedStops===0)add('睡醒刚好到','character');else if(c.tea)add('奶茶党','character');
 if(r.securityGood)add('安检选对了','queue');if(r.stableChoices>=2)add('稳定路线','stable');
 }else{if(r.finalEnergy<=0)add('体力见底','energy');if(r.wrongDirections)add('坐反了','navigation');else if(r.missedStops)add('坐过站','navigation');else if(r.wrongTurns)add('路线判断失误','navigation');
 if(Number(c.bagSeconds)>10)add('翻包 '+Math.round(Number(c.bagSeconds))+' 秒','character');else if(c.childToilet)add('孩子尿急','character');else if(c.loadDecisive)add('土特产太重','character');else if(c.fatigueDecisive)add('困倦拉满','character');
 if(r.position.distanceToGoalMeters!==undefined&&r.position.distanceToGoalMeters<50)add('距终点约 '+r.position.distanceToGoalMeters+' 米','distance');}
 return [...new Set(tags)].slice(0,3);
}
export function summarizeRun(s:Run):Outcome{
 const raw=createGameResult(s),analysis=analyzeFactors(raw),r={...raw,timeImpacts:analysis.impacts},title=selectTitle(r),st=stationFor(s);
 const losses:Outcome['losses']={preparation:0,security:0,navigation:0,vertical:0,identity:0,environment:0,waiting:0,other:0};
 for(const i of r.timeImpacts)if(i.deltaSeconds<0)losses[!i.avoidable?'environment':lossSource(i.eventId??i.id)]-=i.deltaSeconds;
 const max=Object.entries(losses).sort((a,b)=>b[1]-a[1])[0] as [LossSource,number];
 const recovery=[...r.timeImpacts].filter(i=>i.positive).sort((a,b)=>b.deltaSeconds-a.deltaSeconds)[0];
 const reasons=analysis.factors.map(factorText);
 if(reasons.length<2)reasons.push(s.success?(r.errors===0?'没有走错方向、坐过站或翻错书包。':'经历波折，仍在截止前完成了登车。'):'截止时仍未完成最后的通行与检票操作。');
 if(reasons.length<2)reasons.push(s.success?`检票时还剩 ${Math.ceil(r.resultMarginSeconds)} 秒。`:`按剩余路段估算，还需要约 ${Math.ceil(-r.resultMarginSeconds)} 秒。`);
 const comeback=s.success&&(r.dramaScore>=80||r.wasProjectedToFail);
 const summary=comeback?`这局波折不断，${recovery?'靠'+recovery.source+'追回'+(recovery.estimated?'约 ':' ')+Math.round(recovery.deltaSeconds)+' 秒，':''}还是赶上了。`:s.success?`在${st.name}，你把最后一段路跑完了。`:analysis.advice?'差距有迹可循，下次把时间留给关键路段。':'这一局没赶上，先看看时间花在哪里。';
 return {title:title.name,titleId:title.id,result:r,tags:resultTags(r,analysis.factors),summary,reasons:reasons.slice(0,3),factors:analysis.factors,advice:analysis.advice,lesson:st.strategy,stationPlaystyle:st.playstyle,largestLoss:{source:max[0],seconds:max[1]},largestRecovery:{source:recovery?.source??'',seconds:recovery?.deltaSeconds??0},wrongTurns:r.wrongTurns+r.missedStops,characterEvents:Object.entries(r.characterStats).filter(([,v])=>v===true).map(([k])=>k),bottleneck:s.endEventId??s.stationJourney[s.stationBeat]?.label??'地铁途中',distanceToTarget:r.position.distanceToGoalMeters??null,securityGood:r.securityGood,stationMastery:r.stationMastery,comeback,losses};
}
