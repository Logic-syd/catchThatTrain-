import type {Run,Action} from './engine';
import {movementFactor} from './studentConfig';
import {stationFor} from './stations';
import {parentMovementFactor} from './parent';
export type CharacterId='student'|'worker'|'tourist'|'mother'|'family';
export type ImpactCategory='decision'|'navigation'|'movement'|'character'|'environment'|'operation'|'resource';
export interface TimeImpact{id:string;source:string;category:ImpactCategory;deltaSeconds:number;avoidable:boolean;positive:boolean;decisive?:boolean;estimated?:boolean;characterId?:string;eventId?:string;decisionId?:string;phase?:string;tag?:string;baseline?:string}
export interface RunMetrics{impacts:TimeImpact[];characterStats:Record<string,number|boolean>;choiceResults:{judgment:boolean[];accessibility:boolean[];sleep:boolean[]};pendingRisk:{beat:number;collisions:number}|null;wrongDirections:number;mapViews:number;bagAttempts:number;earlySprintSeconds:number;lowEnergySeconds:number;minEnergyRatio:number;lateFar:boolean;lateGateEntry:boolean;projectedRiskNode:string|null;wasProjectedToFail:boolean;initialMarginRatio:number|null;routeEfficiency:number;highRiskResults:boolean[];stableChoices:number;endPhase:string|null;estimatedSecondsToGoal:number|null}
export const freshMetrics=():RunMetrics=>({impacts:[],characterStats:{},choiceResults:{judgment:[],accessibility:[],sleep:[]},pendingRisk:null,wrongDirections:0,mapViews:0,bagAttempts:0,earlySprintSeconds:0,lowEnergySeconds:0,minEnergyRatio:1,lateFar:false,lateGateEntry:false,projectedRiskNode:null,wasProjectedToFail:false,initialMarginRatio:null,routeEfficiency:100,highRiskResults:[],stableChoices:0,endPhase:null,estimatedSecondsToGoal:null});
export const normalizeCharacter=(id:string):CharacterId=>id==='mom'?'mother':id as CharacterId;
const routeCost=(s:Run,r= s.route)=>r?r.minutes*60+r.walk/1.5/(s.student?movementFactor({...s.student,sprinting:false,exhausted:false}):s.parent?parentMovementFactor(s.parent):s.character.speed)+r.transfers*20:0;
export function remainingEstimate(s:Run):number{
 if(s.stationJourney.length){const end=s.gatePassed?s.stationJourney.length-1:s.stationJourney.findIndex(b=>b.id==='gate-scan');
  return s.stationJourney.slice(s.stationBeat,end+1).reduce((sum,b,i)=>sum+b.seconds*4*(i===0?1-s.stationProgress:1)+(i===0&&s.event?Math.max(0,(s.event.interaction?.required??2)-s.eventElapsed):2),0);
 }
 const metro=s.route?routeCost(s)*(1-s.metroProgress):Math.min(...s.city.spawnStations[s.spawn].routes.map(r=>routeCost(s,r)));
 return metro+stationFor(s).walking+90;
}
export function impactCategory(id:string):ImpactCategory{
 if(id.startsWith('prepare-'))return 'decision';if(/identity/.test(id))return 'character';
 if(/station-sign|metro-route|metro-transfer-sign|hz-|zz-|wh-floor|bj-entry/.test(id))return 'navigation';
 if(/escalator-operation|metro-stop/.test(id))return 'environment';
 if(/queue|gates|vertical|gz-lift|elder/.test(id))return 'decision';return 'operation';
}
export function trackTransition(s:Run,n:Run,a:Action):Run{
 if(a.type==='NEW'||n===s||s.phase==='result')return n;
 const m:RunMetrics={...(s.metrics??freshMetrics()),impacts:[...(s.metrics?.impacts??[])],characterStats:{...s.metrics?.characterStats},highRiskResults:[...(s.metrics?.highRiskResults??[])],choiceResults:{judgment:[...(s.metrics?.choiceResults?.judgment??[])],accessibility:[...(s.metrics?.choiceResults?.accessibility??[])],sleep:[...(s.metrics?.choiceResults?.sleep??[])]}};
 const add=(id:string,source:string,delta:number,category:ImpactCategory,avoidable=true,extra:Partial<TimeImpact>={})=>{
  if(!Number.isFinite(delta)||Math.abs(delta)<.00001)return;
  const i=m.impacts.findIndex(x=>x.id===id),old=i>=0?m.impacts[i].deltaSeconds:0;
  const item:TimeImpact={id,source,category,deltaSeconds:old+delta,positive:old+delta>0,avoidable,characterId:normalizeCharacter(s.character.id),phase:s.phase,...extra};
  if(i>=0)m.impacts[i]=item;else m.impacts.push(item);
 };
 const event=s.event?.id??'',u=s.student,v=n.student;
 if(a.type==='ROUTE'&&n.route){const best=Math.min(...s.city.spawnStations[s.spawn].routes.map(r=>routeCost(n,r)));m.routeEfficiency=Math.min(100,best/routeCost(n)*100);m.initialMarginRatio=(n.initial-180-best-stationFor(n).walking-90)/Math.max(1,n.initial-180);add('route-choice','选择了耗时更长的地铁路线',best-routeCost(n),'navigation',true,{tag:'路线判断失误',baseline:'同起点最快地铁路线'});}
 if(a.type==='DIRECTION'&&!a.correct&&s.phase==='direction')m.wrongDirections++;
 if(a.type==='READ_MAP')m.mapViews++;
 if(a.type==='POCKET_PICK'&&event==='identity-search'&&u&&!u.searched.includes(a.pocket)&&a.pocket>=0&&a.pocket<4)m.bagAttempts++;
 const newLogs=n.logs.slice(s.logs.length);
 for(const l of newLogs){
  const id=l.eventId??event,cat=impactCategory(id);let cost=l.seconds,source=l.title,tag:string|undefined;
  if(id==='security-queue'&&u){const median=[...u.queues].sort((a,b)=>a.seconds-b.seconds)[1].seconds;cost=l.seconds-median;source=cost>0?'安检队比本站常规队更慢':'安检队比本站常规队更快';tag=cost>0?'安检误判':'安检选对了';}
  if(a.type==='CHOICE'&&id===event&&a.choice.stationDecision&&!a.choice.stationDecision.optimal)source=a.choice.label+'后折返';
  if(id==='prepare-tea')source='买奶茶';if(id==='prepare-breakfast')source='买饭团';if(id==='prepare-id')source='出门前检查身份证';
  add('event-'+id+'-'+(a.type==='CHOICE'?a.choice.label:l.title),source,-cost,cat,cat!=='environment',{eventId:id,decisionId:a.type==='CHOICE'?a.choice.label:undefined,tag,baseline:id==='security-queue'?'同局安检队耗时中位数':undefined});
 }
 if(u&&v){
  add('door','提前靠门',v.doorSavings-u.doorSavings,'operation',true,{tag:'提前靠门',baseline:'未靠门固定多花 12 秒'});
  const total=v.sprintSaved-u.sprintSaved,late=v.lateSprintSaved-u.lateSprintSaved;
  add('sprint-late','最后阶段冲刺',late,'movement',true,{tag:'最后冲刺',estimated:true,baseline:'同路段普通前进速度'});
  add('sprint-early','途中冲刺',total-late,'movement',true,{tag:'主动冲刺',estimated:true,baseline:'同路段普通前进速度'});
  if(a.type==='TICK'&&s.phase!=='lobby'){
   if(u.sprinting&&!u.late&&s.stationRunning&&!s.event)m.earlySprintSeconds+=a.dt;
   m.minEnergyRatio=Math.min(m.minEnergyRatio,v.stamina/Math.max(1,v.stats.energy));if(v.stamina/v.stats.energy<=.1)m.lowEnergySeconds+=a.dt;
   if(s.event){const budget=s.event.interaction?.kind==='choice'?5:Math.max(2,s.event.interaction?.required??5);const delta=Math.max(0,n.eventElapsed-budget)-Math.max(0,s.eventElapsed-budget);add('handling-'+event,event==='identity-search'?'身份证翻找超出基础操作时间':'处理「'+s.event.title+'」超出基础时间',delta*-1,impactCategory(event),true,{eventId:event,tag:event==='identity-search'?'身份证翻包':undefined,baseline:'基础操作预算 '+budget+' 秒'});}
   const wait=v.clockSpent.waiting-u.clockSpent.waiting;
   if(wait>0&&['preparation','route','direction','station'].includes(s.phase))add('idle','选择前停留、休息与路障拦停',-wait,'operation',true,{tag:'停留过久'});
   const margin=n.remaining-(n.gatePassed?0:180);if(!n.gatePassed&&margin<=60&&remainingEstimate(n)>60)m.lateFar=true;
  }
  if((!s.gatePassed&&n.gatePassed&&n.gateRemaining<=30)||(s.stage<4&&n.stage>=4&&n.remaining-180<=30))m.lateGateEntry=true;
  if(a.type==='CHOICE'&&event==='security-queue')m.characterStats.shortSlowQueue=a.choice.seconds>Math.min(...u.queues.map(q=>q.seconds))&&a.choice.label.includes(Math.min(...u.queues.map(q=>q.people))+' 人');
  if(a.type==='CHOICE'&&event==='elder-block'&&a.choice.effect==='elder-push')m.highRiskResults.push(!s.stationLuck.elderScam);
  if(a.type==='CHOICE'&&(a.choice.stationDecision?.optimal||a.choice.effect==='elder-detour'))m.stableChoices++;
  if(a.type==='CHOICE'&&a.choice.stationDecision)m.choiceResults.judgment.push(a.choice.stationDecision.optimal);
  if(a.type==='CHOICE'&&event==='security-queue')m.choiceResults.judgment.push(a.choice.seconds===Math.min(...u.queues.map(q=>q.seconds)));
  if(a.type==='CHOICE'&&(a.choice.stationDecision?.density??0)>=3)m.pendingRisk={beat:n.stationBeat,collisions:v.runner.collisions};
  if(m.pendingRisk&&(n.event&&n.stationBeat===m.pendingRisk.beat||n.phase==='result')){m.highRiskResults.push(n.phase!=='result'&&v.runner.collisions===m.pendingRisk.collisions);m.pendingRisk=null;}
  m.characterStats={...m.characterStats,tea:v.choices.tea==='buy',breakfast:v.breakfast,checkedID:v.checkedID,idFound:n.identityReady,bagAttempts:m.bagAttempts,bagMistakes:v.bagMistakes,bagSeconds:v.bagSeconds,lateSprintSaved:v.lateSprintSaved,earlySprintSeconds:m.earlySprintSeconds,lowEnergySeconds:m.lowEnergySeconds,finalEnergy:v.stamina,exhaustedLateSeconds:v.exhaustedLateSeconds,otherDelay:n.logs.some(l=>l.seconds>0&&l.eventId!=='prepare-tea'&&l.eventId!=='prepare-breakfast'&&l.eventId?.startsWith('prepare-')),extraPreparationSeconds:n.logs.filter(l=>l.eventId?.startsWith('prepare-')).reduce((t,l)=>t+l.seconds,0)};
 }
 if(s.parent&&n.parent){
  const gain=n.parent.syncSprintSaved-s.parent.syncSprintSaved;
  add('parent-sync','最后牵着孩子同步冲刺',gain,'movement',true,{tag:'牵手冲刺',estimated:true,baseline:'同路段普通牵手前进'});
  if(a.type==='CHOICE'&&a.choice.stationDecision){m.choiceResults.judgment.push(a.choice.stationDecision.optimal);if(a.choice.stationDecision.category==='vertical')m.choiceResults.accessibility.push(a.choice.stationDecision.optimal);if(a.choice.stationDecision.optimal)m.stableChoices++;}
  if(a.type==='TICK'){m.minEnergyRatio=Math.min(m.minEnergyRatio,n.parent.energy/n.parent.maxEnergy);if(n.parent.energy<=7)m.lowEnergySeconds+=a.dt;}
 }
 const node=n.phase+':'+n.stationBeat+':'+n.metroStopIndex;
 if(n.phase!=='lobby'&&n.phase!=='result'&&n.route){const risk=n.remaining-(n.gatePassed?0:180)-remainingEstimate(n)<-30;
  if(risk){if(m.projectedRiskNode&&m.projectedRiskNode!==node)m.wasProjectedToFail=true;m.projectedRiskNode??=node;}else m.projectedRiskNode=null;
 }
 if(n.phase==='result'){m.endPhase=s.phase;m.estimatedSecondsToGoal=n.success?0:remainingEstimate({...n,event:s.event});}
 return {...n,metrics:m};
}
