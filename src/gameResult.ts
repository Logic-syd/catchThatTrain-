import type {Run} from './engine';
import {freshMetrics,normalizeCharacter,remainingEstimate,type CharacterId,type TimeImpact} from './resultMetrics';
import {characterTimeProfiles} from './characterTime';
import {stationFor} from './stations';
export type ResultPosition={phase:'metro'|'station_entry'|'security'|'concourse'|'gate'|'platform';distanceToGoalMeters?:number};
export interface GameResult{runId:string;success:boolean;resultMarginSeconds:number;marginEstimated:boolean;position:ResultPosition;characterId:CharacterId;stationId:string;routeEfficiency:number;wrongTurns:number;missedStops:number;wrongDirections:number;errors:number;sprintContributionSeconds:number;voluntaryDelaySeconds:number;environmentDelaySeconds:number;dramaScore:number;timeImpacts:TimeImpact[];characterStats:Record<string,number|boolean>;wasProjectedToFail:boolean;initialMarginRatio:number|null;highRiskResults:boolean[];choiceResults:{judgment:boolean[];accessibility:boolean[];sleep:boolean[]};stableChoices:number;mapViews:number;stationMastery:boolean;securityGood:boolean;finalEnergy:number}
export function targetDistance(s:Run):number|null{
 if(!s.stationJourney.length)return null;const end=s.gatePassed?s.stationJourney.length-1:s.stationJourney.findIndex(b=>b.id==='gate-scan');if(end<0)return null;
 return Math.max(0,Math.round(s.stationJourney.slice(s.stationBeat,end+1).reduce((t,b,i)=>t+b.seconds*(i?1:1-s.stationProgress),0)*6));
}
export function createGameResult(s:Run):GameResult{
 const m=s.metrics??freshMetrics(),u=s.student,st=stationFor(s),distance=targetDistance(s);
 const phase:ResultPosition['phase']=!s.stationJourney.length?'metro':s.gatePassed?'platform':s.stage<=1?'station_entry':s.stage===2?'security':s.stage===3?'concourse':'gate';
 // The engine stops at the deadline. Unfinished travel is an estimate, never an observed lateness.
 const remaining=m.estimatedSecondsToGoal??remainingEstimate(s);
 const margin=s.success?s.gateRemaining:Math.min(-.001,s.remaining-(s.gatePassed?0:180)-remaining);
 const t=s.characterTime;const stats:Record<string,number|boolean>={...m.characterStats,...(t?{energy:t.energy,initialEnergy:characterTimeProfiles[t.characterId].energy,fatigue:t.fatigue,load:t.load,coffee:t.coffee,slept:t.slept,alarmSet:t.slept,localGifts:t.souvenirs,ignoredWork:t.ignoredWork,motherStayed:t.motherStayed,bossCalls:t.bossCallsLeft,extraPreparationSeconds:t.actualDelay,lowEnergySeconds:t.energy<=5?45:0,fatigueDecisive:t.fatigue>=70&&t.energy<=5,workEvents:t.bossCalls>0?2:0,workBuffDecisive:t.characterId==='worker'&&t.sprinting&&t.energy>0}:{}),...(u?{tea:u.choices.tea==='buy',breakfast:u.breakfast,checkedID:u.checkedID,idFound:s.identityReady,bagAttempts:m.bagAttempts,bagMistakes:u.bagMistakes,bagSeconds:u.bagSeconds,lateSprintSaved:u.lateSprintSaved,exhaustedLateSeconds:u.exhaustedLateSeconds}: {})};
 const navigationMistakes=s.stationDecisions.filter(d=>d.category==='navigation'&&!d.optimal).length;
 const wrong=Math.max(u?.wrongTurns??0,m.wrongDirections,navigationMistakes)+(t?.actualDelay&&t.characterId==='tourist'&&t.wrongWayRisk&&!t.mapChecked?1:0);
 const queue=s.logs.find(l=>l.eventId==='security-queue');const securityGood=!!queue&&(u?queue.seconds===Math.min(...u.queues.map(q=>q.seconds)):s.stationDecisions.some(d=>d.group==='security-queue'&&d.optimal));
 const navigationLoss=m.impacts.filter(i=>i.category==='navigation'&&i.id!=='route-choice'&&i.deltaSeconds<0).reduce((t,i)=>t-i.deltaSeconds,0);
 const routeEfficiency=Math.max(0,m.routeEfficiency*(st.walking/(st.walking+navigationLoss)));
 const mastery=s.stationDecisions.length>0&&s.stationDecisions.every(d=>d.optimal)&&wrong+s.metroMisses===0&&(st.playstyle!=='queue'||securityGood);
 const liftWait=m.impacts.filter(i=>i.eventId?.includes('lift')||i.eventId==='vertical-choice').reduce((t,i)=>t+Math.max(0,-i.deltaSeconds),0);
 const metroStop=m.impacts.filter(i=>i.eventId==='metro-stop').reduce((t,i)=>t+Math.max(0,-i.deltaSeconds),0);
 const critical=s.stationDecisions.filter(d=>!d.optimal&&!(d.density&&d.density>=3)).length;
 const raw=Math.max(0,wrong-m.wrongDirections-critical)*10+critical*15+m.wrongDirections*18+s.metroMisses*25+(u?.bagMistakes??0)*5+((u?.bagSeconds??0)>30?15:0)+(liftWait>60?12:0)+(metroStop>60?10:0)+(m.minEnergyRatio<.1?8:0)+(m.lateFar?15:0)+(m.lateGateEntry?20:0)+(m.highRiskResults.some((x,i)=>x&&m.highRiskResults[i+1])?10:0)+(m.wasProjectedToFail&&s.success?25:0)+(stats.childToilet?12:0)+(stats.wetPants?25:0)+(stats.patienceZero?20:0);
 return {runId:s.id,success:s.success,resultMarginSeconds:margin,marginEstimated:!s.success,position:{phase,...distance===null?{}:{distanceToGoalMeters:distance}},characterId:normalizeCharacter(s.character.id),stationId:s.city.id,routeEfficiency,wrongTurns:wrong,missedStops:s.metroMisses,wrongDirections:m.wrongDirections,errors:wrong+s.metroMisses+(u?.bagMistakes??0),sprintContributionSeconds:u?.sprintSaved??0,voluntaryDelaySeconds:u?.decisionLoss??0,environmentDelaySeconds:u?.environmentLoss??0,dramaScore:Math.min(120,raw),timeImpacts:m.impacts.map(i=>({...i,positive:i.deltaSeconds>0})),characterStats:stats,wasProjectedToFail:m.wasProjectedToFail,initialMarginRatio:m.initialMarginRatio,highRiskResults:m.highRiskResults,choiceResults:m.choiceResults,stableChoices:m.stableChoices,mapViews:m.mapViews,stationMastery:mastery,securityGood,finalEnergy:u?.stamina??t?.energy??s.stamina};
}
export function analyzeFactors(r:GameResult):{impacts:TimeImpact[];factors:TimeImpact[];advice?:string}{
 const impacts=r.timeImpacts.map(i=>({...i,decisive:false}));
 const candidates=impacts.filter(i=>Math.abs(i.deltaSeconds)>=1&&i.positive===r.success);
 const gap=Math.abs(r.resultMarginSeconds);
 for(const i of candidates)i.decisive=r.success?i.deltaSeconds>gap:-i.deltaSeconds>=gap;
 // Minimal cardinality set for a combined failure: largest controllable costs first.
 const controlled=candidates.filter(i=>i.avoidable).sort((a,b)=>Math.abs(b.deltaSeconds)-Math.abs(a.deltaSeconds));
 let combination:TimeImpact[]=[];
 if(!r.success&&!controlled.some(i=>i.decisive)){let total=0;for(const i of controlled){combination.push(i);total-=i.deltaSeconds;if(total>=gap)break;}if(total>=gap)combination.forEach(i=>i.decisive=true);else combination=[];}
 const rank=(a:TimeImpact,b:TimeImpact)=>Number(b.avoidable)-Number(a.avoidable)||Number(b.decisive)-Number(a.decisive)||Math.abs(b.deltaSeconds)-Math.abs(a.deltaSeconds)||a.id.localeCompare(b.id);
 candidates.sort(rank);
 const factors=candidates.filter(i=>i.avoidable||Math.abs(i.deltaSeconds)>=60||Math.abs(i.deltaSeconds)===Math.max(...candidates.map(x=>Math.abs(x.deltaSeconds)))||!controlled.length).slice(0,3);
 let advice:string|undefined;
 if(!r.success){const single=controlled.find(i=>i.decisive&&-i.deltaSeconds>=gap);if(single)advice=`本局预计还差约 ${Math.ceil(gap)} 秒；若省下「${single.source}」这 ${Math.round(-single.deltaSeconds)} 秒，按时间估算足以赶上。`;
 else if(combination.length>0&&combination.length<=3)advice=`单独省一项还不够；「${combination.map(i=>i.source).join('」和「')}」合计 ${Math.round(combination.reduce((t,i)=>t-i.deltaSeconds,0))} 秒，按时间估算足以补上差距。`;}
 return {impacts,factors,advice};
}
