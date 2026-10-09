import {readGameStorage,writeGameStorage} from './playtestEnvironment';
import {initialMapTravel,setMapDestination,advanceOnMap,mapDistance,mapTaskPoint,mapPath,pathLength,type MapTravel,type MapPoint} from './stationMapTravel';
import {activeObstacle,bypassObstacle,clearMapObstacle,mapSecurityBlock,advanceMapQueues,mapQueueWait,obstructionTitle,type ClearMethod} from './mapObstructions';
import {trackMapChildDelay} from './mapTimeFeedback';
import {freshMetrics,trackTransition,type RunMetrics} from './resultMetrics';
import {applyCharacterEvent,applyTimedChoice,characterEventPrompt,characterMovementFactor,createCharacterTimeState,tickCharacterTime,type CharacterTimeState} from './characterTime';
import {BALANCE} from './balanceConfig';
import {buildTimeBudget,type TimeBudget} from './timeBudget';
import {freshTimeLedger,trackTimeLedger,type TimeLedger,type MetroTimeBudget} from './timeLedger';
import {applyJourneyDecision,prepareNextJourney} from './journeyRules';
import {summarizeRun} from './outcomes';
import {stationFor,stationChallenge,STATIONS,type StationDecision} from './stations';
import {runnerWave} from './runner';
import {STUDENT,HONGQIAO,PREPARATIONS,studentState,gameShanghai,movementFactor,focusWindow,studentPrompt,type StudentState} from './studentConfig';
import { cities, characters, events, type CityConfig, type CharacterConfig, type MetroRoute, type EventConfig, type Choice } from './data';
import { identityPrompt, stationPrompt, createStationPlan, type Encounter } from './flow';
import { planMetroIncident,applyMetroAnnouncement,metroIncidentCheckpoint,transferStopIndex, METRO_INCIDENT_CHANCE } from './metroFlow';
import { createStationLuck, elderPrompt, elderOutcome, escalatorPrompt, escalatorRide, type StationLuck } from './stationEncounters';
import {buildStationJourney,journeyPrompt,type StationBeat} from './stationJourney';
import {applyParentChoice,applyParentPreparation,createParentState,isParentBlock,parentBlockPrompt,parentMovementFactor,tickParent,type ParentState} from './parent';
export const TIME_SCALE = 4;
export const METRO_SECONDS = 7;
export const DOOR_SECONDS = 4;
export const STOP_BEFORE = 180;
export type Phase='preparation'|'lobby'|'route'|'direction'|'wrong'|'metro'|'arrival'|'transfer'|'metro-recovery'|'station'|'result';
export type Log={title:string;seconds:number;eventId?:string};
export type Run={timeBudget?:TimeBudget;timeLedger:TimeLedger;metroTimeBudget?:MetroTimeBudget;metroAnnouncementRoll?:number;metroAnnouncement?:{mode:'door'|'seated';miss:boolean};stationMap?:MapTravel;metrics:RunMetrics;stationDecisions:StationDecision[];endEventId:string|null;student?:StudentState;characterTime?:CharacterTimeState;parent?:ParentState;id:string;city:CityConfig;character:CharacterConfig;spawn:number;hard:boolean;remaining:number;initial:number;departure:number;phase:Phase;route?:MetroRoute;metroProgress:number;metroDuration:number;elapsed:number;phaseElapsed:number;event:EventConfig|null;eventElapsed:number;seen:string[];logs:Log[];slow:number;gate:string;gatePassed:boolean;gateRemaining:number;stage:number;distance:number;success:boolean;stationEvents:number;stamina:number;stationLane:number|null;metroMisses:number;metroStopIndex:number;metroTransferred:boolean;metroIncidentRoll:number;metroIncidentVariant:number;metroIncident:EventConfig|null;metroRecoveryMessage:string;metroRecoveryTarget:'metro'|'arrival';identityEarly:boolean;identityReady:boolean;identityStage:"wallet"|"card";identityItems:string[];identityCards:string[];encounters:Encounter[];detour:{x:number;y:number;label:string}|null;stationLuck:StationLuck;escalatorLane:number|null;boost:number;stationJourney:StationBeat[];stationBeat:number;stationProgress:number;stationRunning:boolean;eventOverdue:boolean};
export function pick<T>(array:T[],rng=Math.random):T{return array[Math.floor(rng()*array.length)]!;}
export function routeSeconds(route:MetroRoute,character:CharacterConfig){return route.minutes*60+route.walk/1.5/character.speed+route.transfers*(character.stroller?90:character.luggage?45:20);}
export function createRun(cityId?:string,characterId?:string,hard=false,first=false,rng=Math.random):Run{
 const city=first?cities[0]:cities.find(c=>c.id===cityId)||pick(cities);
 const character=first?characters[0]:characters.find(c=>c.id===characterId)||pick(characters);
 const spawn=first?0:Math.floor(Math.random()*city.spawnStations.length);
 const best=Math.min(...city.spawnStations[spawn].routes.map(r=>routeSeconds(r,character)));
 // Seven seconds of travel, split by real stop decisions. Dwell time is additional.
 const metroIncidentRoll=rng(),metroIncidentVariant=rng();
 const initial=best+(hard?420:522)/character.speed+STOP_BEFORE;
 const run:Run={timeLedger:freshTimeLedger(),metrics:freshMetrics(),stationDecisions:[],endEventId:null,id:crypto.randomUUID(),city,character,spawn,hard,initial,remaining:initial,departure:15*3600,phase:'lobby',metroProgress:0,metroDuration:0,elapsed:0,phaseElapsed:0,event:null,eventElapsed:0,seen:[],logs:[],slow:0,gate:city.stationConfig.gate,gatePassed:false,gateRemaining:0,stage:0,distance:970,success:false,stationEvents:0,stamina:100,stationLane:null,metroMisses:0,metroStopIndex:0,metroTransferred:false,metroIncidentRoll,metroIncidentVariant,metroIncident:null,metroRecoveryMessage:'',metroRecoveryTarget:'metro',identityEarly:metroIncidentRoll<METRO_INCIDENT_CHANCE&&metroIncidentVariant<1/3,identityReady:false,identityStage:"wallet",identityItems:shuffle(["wallet","phone","keys","headphones","bottle","umbrella","notebook","pen","glasses","charger","tissue","snack","lipstick","comb","watch","camera","sock","sanitizer"],rng),identityCards:shuffle(["id","bank","metro","student","photo","receipt"],rng),encounters:createStationPlan(hard,rng),detour:null,stationLuck:createStationLuck(rng),escalatorLane:null,boost:0,stationJourney:[],stationBeat:0,stationProgress:0,stationRunning:false,eventOverdue:false};
 return {...run,metroAnnouncementRoll:rng()};
}
export function createStationRun(cityId='shanghai',hard=false,rng=Math.random):Run{
 const s=createRun('shanghai','student',hard,true,rng);const original=cities.find(c=>c.id===cityId)??cities[0];
 const chapter=STATIONS.find(c=>c.id===original.id)!;const city=gameShanghai(original);
 city.stationConfig={...city.stationConfig,gate:chapter.gate};
 city.spawnStations=city.spawnStations.map(p=>({...p,routes:p.routes.map(r=>r.lines.length>2?{...r,lines:[r.lines[0],r.lines.at(-1)!],transfers:1,via:r.via?.split(' / ')[0]}:r)}));
 const best=Math.min(...city.spawnStations[0].routes.map(r=>r.minutes*60+r.walk/1.5+r.transfers*20));
 // Student runs budget for a viable route, the station's walking distance,
 // and a short decision buffer. Pricing from the slowest route made every other
 // route finish with many unused minutes and removed the stakes from route choice.
 const timeBudget=buildTimeBudget({metroSeconds:best,stationWalkSeconds:chapter.walking,legacyAllowanceSeconds:BALANCE.studentDecisionBuffer[chapter.id],hardReductionSeconds:hard?BALANCE.hardReduction.student:0,gateClosingLeadSeconds:STOP_BEFORE});
 const initial=timeBudget.departureBudgetSeconds;
 return {...s,city,gate:chapter.gate,timeBudget,initial,remaining:initial,student:studentState(rng)};
}
export function createCharacterStationRun(cityId='shanghai',characterId:'student'|'worker'|'tourist'|'mom'='student',hard=false,rng=Math.random):Run{
 if(characterId==='student')return createStationRun(cityId,hard,rng);
 const base=createStationRun(cityId,hard,rng),character=characters.find(c=>c.id===characterId)!;const chapter=STATIONS.find(c=>c.id===cityId)!;
 if(characterId==='mom'){
  const parent=createParentState(rng);
  const best=Math.min(...base.city.spawnStations[base.spawn].routes.map(r=>r.minutes*60+r.walk/1.5/character.speed+r.transfers*20));
  const timeBudget=buildTimeBudget({metroSeconds:best,stationWalkSeconds:chapter.walking/parentMovementFactor(parent),legacyAllowanceSeconds:BALANCE.parentDecisionBuffer[chapter.id],hardReductionSeconds:hard?BALANCE.hardReduction.mom:0,gateClosingLeadSeconds:STOP_BEFORE});
  const initial=timeBudget.departureBudgetSeconds;
  return {...base,character,student:undefined,parent,timeBudget,initial,remaining:initial,stamina:parent.energy,phase:'lobby'};
 }
 const characterTime=createCharacterTimeState(characterId,rng);
 const context={...base,character,student:undefined,characterTime};
 const factor=characterMovementFactor(context,false);
 const best=Math.min(...base.city.spawnStations[base.spawn].routes.map(r=>journeyRouteSeconds(context,r)));
 const timeBudget=buildTimeBudget({metroSeconds:best,stationWalkSeconds:chapter.walking/factor,legacyAllowanceSeconds:BALANCE.characterDecisionBuffer[characterId]+(BALANCE.characterStationExtra[characterId][chapter.id]??0),hardReductionSeconds:hard?BALANCE.hardReduction[characterId]:0,gateClosingLeadSeconds:STOP_BEFORE});
 const initial=timeBudget.departureBudgetSeconds;
 return {...base,character,student:undefined,characterTime,timeBudget,initial,remaining:initial,stamina:characterTime.energy,phase:'lobby'};
}
export function createShanghaiRun(hard=false,rng=Math.random):Run{return createStationRun('shanghai',hard,rng);}

function shuffle<T>(items:T[],rng:()=>number){for(let i=items.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[items[i],items[j]]=[items[j],items[i]];}return items;}
export function formatTime(seconds:number){const s=Math.max(0,Math.ceil(seconds));return Math.floor(s/60).toString().padStart(2,'0')+':'+(s%60).toString().padStart(2,'0');}
export function clockTime(seconds:number){return String(Math.floor(seconds/3600)%24).padStart(2,'0')+':'+String(Math.floor(seconds/60)%60).padStart(2,'0');}
export function journeyRouteBudget(s:Run,route:MetroRoute):MetroTimeBudget{
 const rideSeconds=route.minutes*60,walkSeconds=route.walk/1.5/(s.parent?parentMovementFactor(s.parent):characterMovementFactor(s,false)),transferSeconds=route.transfers*(s.character.stroller?90:s.character.luggage?45:20);
 return {rideSeconds,walkSeconds,transferSeconds,totalSeconds:rideSeconds+walkSeconds+transferSeconds};
}
export function journeyRouteSeconds(s:Run,route:MetroRoute){return journeyRouteBudget(s,route).totalSeconds;}
export function projectedTime(s:Run,route=s.route){
 const cost=route?(route===s.route?s.metroDuration:journeyRouteSeconds(s,route)):Math.min(...s.city.spawnStations[s.spawn].routes.map(r=>journeyRouteSeconds(s,r)));
 return Math.max(0,s.remaining-STOP_BEFORE-cost*(['metro','arrival','transfer','metro-recovery'].includes(s.phase)?1-s.metroProgress:['station','result'].includes(s.phase)?0:1));
}
export function randomEvent(s:Run,phase:'metro'|'station'):EventConfig{
 const pool=events.filter(e=>!s.seen.includes(e.id)&&(!e.character||e.character.includes(s.character.id))&&(e.phase===phase||e.phase==='both')&&!e.id.includes('-'));
 return pick(pool.length?pool:[events[0]]);
}
export type Action={type:'MAP_CLEAR';method:ClearMethod;lane?:number}|{type:'MAP_ENABLE';manual?:boolean}|{type:'MAP_TARGET';point:MapPoint}|{type:'PERSON_PICK';option:string;step:number}|{type:'PARENT_PREP';option:string;step:number}|{type:'PARENT_SYNC'}|{type:'PARENT_RELEASE'}|{type:'CHANGE_LANE';direction:-1|1}|{type:'PREP_PICK';option:string;step:number}|{type:'SPRINT_INPUT';held:boolean}|{type:'POCKET_PICK';pocket:number}|{type:'PREPARE_DOOR'}|{type:'OBSERVE'}|{type:'READ_MAP'}|{type:'START'}|{type:'NEW';run:Run}|{type:'ROUTE';route:MetroRoute}|{type:'DIRECTION';correct:boolean}|{type:'TICK';dt:number}|{type:'CHOICE';choice:Choice}|{type:'ALIGHT'}|{type:'CONTINUE_METRO'}|{type:'STAGE';stage:number;distance:number}|{type:'STATION_EVENT';id?:string}|{type:'GATE'}|{type:'WIN'}|{type:'PENALTY';title:string;seconds:number}|{type:'STAMINA';value:number}|{type:'ID_PICK';item:string}|{type:'DETOUR_DONE'}|{type:'RUN_INPUT';held:boolean};
function stopSprint(s:Run):Run{return {...s,stationMap:s.stationMap?.manual?{...s.stationMap,driveHeld:false}:s.stationMap,stationRunning:false,student:s.student?{...s.student,sprinting:false}:undefined,characterTime:s.characterTime?{...s.characterTime,sprinting:false}:undefined,parent:s.parent?{...s.parent,sprinting:false}:undefined};}
function enterMapTask(s:Run):Run{
 if(s.stationJourney[s.stationBeat]?.id==='security-queue'){
  const {obstacle,block}=mapSecurityBlock(s,mapTaskPoint(s));
  return stopSprint({...s,stationProgress:1,stationMap:{...s.stationMap!,block,obstacles:[...s.stationMap!.obstacles.filter(o=>o.id!==obstacle.id),obstacle]}});
 }
 return stopSprint({...s,stationProgress:1,event:journeyPrompt(s),eventElapsed:0,eventOverdue:false});
}
function finish(s:Run,success=false):Run{return {...s,endEventId:s.event?.id??s.stationMap?.block?.id??null,phase:'result',event:null,success};}
function deadline(s:Run):Run{return s.remaining<=(s.gatePassed?0:STOP_BEFORE)?finish(s):s;}
function choice(s:Run,c:Choice,title=c.outcome??s.event?.title??'途中耽误'):Run{
 if(c.stationDecision){const d=c.stationDecision;
  s={...applyJourneyDecision(s,d),student:s.student?{...s.student,wrongTurns:s.student.wrongTurns+(d.category==='navigation'&&!d.optimal?1:0),stamina:d.group==='gz-lift'?Math.max(0,Math.min(s.student.stats.energy,s.student.stamina+(d.value==='stairs'?-22:25))):s.student.stamina}:undefined};
 }

 if(s.student){let u={...s.student,decisionLoss:s.student.decisionLoss+c.seconds};
  if(c.studentEffect==='wrong-turn'){u.wrongTurns++;title='走到 B 区，折返 A 区';}
  if(['stairs','lift','escalator'].includes(c.studentEffect??''))u.vertical=c.studentEffect as StudentState['vertical'];
  if(s.event?.id==='escalator-ride'&&u.vertical==='stairs')u.stamina=Math.max(0,u.stamina-22);
  if(s.event?.id==='escalator-operation'){const environmental=Math.min(c.seconds,Math.max(0,STUDENT.badLuckBudget-u.environmentLoss));u.environmentLoss+=environmental;u.decisionLoss-=c.seconds;c={...c,seconds:environmental};}
  if(c.studentEffect==='queue'||c.studentEffect==='lift')u.stamina=Math.min(u.stats.energy,u.stamina+c.seconds/4*STUDENT.recover);
  s={...s,student:u};
 }

 const next=deadline({...s,event:null,eventElapsed:0,eventOverdue:false,stationLane:c.lane??s.stationLane,escalatorLane:c.escalator??s.escalatorLane,boost:c.boost??s.boost,detour:c.detour??s.detour,seen:s.event?[...s.seen,s.event.id]:s.seen,remaining:s.remaining-c.seconds,slow:c.restore?0:c.slow??s.slow,gate:c.gate?s.city.stationConfig.alternateGate:s.gate,logs:[...s.logs,{title,seconds:c.seconds}]});
 return next.phase==='station'&&s.stationJourney.length?completeStationBeat(next):next;
}
function completeStationBeat(s:Run):Run{
 const beat=s.stationJourney[s.stationBeat];
 if(!beat)return s;
 if(beat.id==='board-train')return finish(s,true);
 const gate=beat.id==='gate-scan';
 let index=s.stationBeat+1;
 s=prepareNextJourney(s);
 if(s.student)s={...s,student:{...s.student,sprinting:false,observed:false,runner:{...s.student.runner,wave:0,blocked:false}}};
 if(s.characterTime)s={...s,characterTime:{...s.characterTime,sprinting:false,runner:{...s.characterTime.runner,wave:0,blocked:false}}};
 if(s.parent)s={...s,parent:{...s.parent,sprinting:false,runner:{...s.parent.runner,wave:0,blocked:false}}};
 let next:Run={...s,seen:[...new Set([...s.seen,beat.id])],stationBeat:index,stationMap:s.stationMap?{...s.stationMap,path:[],legBeat:-1}:undefined,stationProgress:0,stationRunning:false,detour:null,stage:s.stationJourney[index]?.stage??s.stage,distance:Math.round((s.stationJourney.length-index)*30),gatePassed:gate||s.gatePassed,gateRemaining:gate?s.remaining-STOP_BEFORE:s.gateRemaining};
 if(next.stationMap?.destination){
  const goal=next.stationMap.destination;
  if(mapDistance(next.stationMap.position,goal)>.1){next={...next,stationMap:setMapDestination(next,goal)};next.stationRunning=next.stationMap!.path.length>0&&(!next.stationMap!.manual||!!next.stationMap!.driveHeld);}
  else next.stationMap={...next.stationMap,destination:null};
 }
 return next;
}
function recoverMetro(s:Run,title:string,seconds:number,target:'metro'|'arrival'):Run{
 if(s.student)s={...s,student:{...s.student,decisionLoss:s.student.decisionLoss+seconds,wrongTurns:s.student.wrongTurns+(title.startsWith('坐过')?0:1),doorReady:false}};
 return deadline({...s,phase:'metro-recovery',phaseElapsed:0,metroRecoveryMessage:title,metroRecoveryTarget:target,remaining:s.remaining-seconds,logs:[...s.logs,{title,seconds}]});
}
function continueMetro(s:Run):Run{
 if(s.metroStopIndex===s.route!.stops.length-1)return recoverMetro({...s,metroMisses:s.metroMisses+1},'坐过火车站了，下一站折返',80,'arrival');
 if(s.metroStopIndex===transferStopIndex(s.route!)&&!s.metroTransferred)return recoverMetro(s,'错过计划换乘站，折返重新换乘',65,'arrival');
 return {...s,phase:'metro',phaseElapsed:0,student:s.student?{...s.student,doorReady:false}:undefined};
}
function reduceCore(s:Run,a:Action):Run{
 if(a.type==='NEW')return a.run;
 if(s.phase==='result')return s;
 if(a.type==='PARENT_PREP'&&s.parent&&s.phase==='preparation'&&a.step===s.parent.prepStep){
  const parent=applyParentPreparation(s.parent,a.option);if(!parent)return s;
  const seconds=a.option==='toilet-first'?60:0;
  return deadline({...s,parent,remaining:s.remaining-seconds,phase:parent.prepStep>=2?'route':'preparation',logs:[...s.logs,{title:a.option==='toilet-first'?'出门前带孩子上厕所':a.option==='toilet-skip'?'先赶车，没上厕所':a.option==='snacks-pack'?'带了两份零食':'轻装出门，没带零食',seconds,eventId:'parent-prep-'+a.option}]});
 }
 if(a.type==='PARENT_SYNC'&&s.parent&&s.phase==='station'&&!s.event&&!s.parent.syncUsed&&s.remaining-STOP_BEFORE<=120&&s.remaining-STOP_BEFORE>0)return {...s,parent:{...s.parent,syncUsed:true,syncRemaining:12,gap:0}};
 if(a.type==='PARENT_RELEASE'&&s.parent&&s.phase==='station'&&s.parent.carrying&&s.city.id!=='guangzhou')return {...s,parent:{...s.parent,carrying:false,gap:0}};
 if(a.type==='READ_MAP'&&s.characterTime)return {...s,characterTime:{...s.characterTime,mapChecked:true}};
 if(a.type==='PERSON_PICK'&&s.characterTime&&s.phase==='preparation'&&s.characterTime.prepStep===a.step)return deadline(applyTimedChoice(s,a.option));
 if(a.type==='MAP_ENABLE'){
  if(s.phase!=='station')return s;
  if(!s.stationMap)return {...s,stationMap:{...initialMapTravel(s),manual:!!a.manual,driveHeld:false},stationRunning:false};
  if(a.manual&&!s.stationMap.manual)return stopSprint({...s,stationMap:{...s.stationMap,manual:true,driveHeld:false}});
  return s;
 }
 if(a.type==='MAP_CLEAR'){
  if(s.phase!=='station'||s.event||!s.stationMap?.block)return s;
  const map=s.stationMap,block=map.block!,obstacle=activeObstacle(map);if(!obstacle)return s;
  if(a.method==='join'&&obstacle.kind==='security'&&block.mode!=='tray'&&a.lane!==undefined&&Number.isInteger(a.lane)&&block.queues[a.lane]){
   if(block.mode==='queue'&&block.lane===a.lane)return s;
   const q=block.queues[a.lane];
   const duration=mapQueueWait(q);
   return {...s,stationMap:{...map,block:{...block,mode:duration>0?'queue':'tray',elapsed:0,duration,lane:a.lane}},stationDecisions:[...s.stationDecisions,{group:'security-queue',value:String(a.lane),category:'queue',optimal:duration===Math.min(...block.queues.map(mapQueueWait))}]};
  }
  if(a.method==='tray'&&obstacle.kind==='security'&&block.mode==='tray'){
   const n={...s,stationMap:clearMapObstacle(map),logs:[...s.logs,{title:'队伍终于轮到你，放好背包，安检放行',seconds:block.waited,eventId:'map-security'}]};
   let next=completeStationBeat(n);
   // Beijing's old tray beat is the same bag operation just completed on the map.
   if(next.stationJourney[next.stationBeat]?.id==='bj-tray')next=completeStationBeat(next);
   return {...next,stationMap:{...next.stationMap!,notice:'安检放行，拿好背包继续跑！'}};
  }
  if(block.mode!=='stopped')return s;
  if((a.method==='sidestep'&&['door','landing','child','crowd'].includes(obstacle.kind))||(a.method==='leave'&&obstacle.kind==='closed'))return {...s,stationMap:bypassObstacle(map,obstacle),stationRunning:!map.manual||!!map.driveHeld,student:s.student?{...s.student,runner:{...s.student.runner,dodges:s.student.runner.dodges+1}}:undefined,characterTime:s.characterTime?{...s.characterTime,runner:{...s.characterTime.runner,dodges:s.characterTime.runner.dodges+1}}:undefined,parent:s.parent?{...s.parent,runner:{...s.parent.runner,dodges:s.parent.runner.dodges+1}}:undefined,logs:[...s.logs,{title:obstacle.kind==='closed'?'人工窗口未开放，改走自助通道':'侧身绕开：'+obstructionTitle(obstacle.kind),seconds:0,eventId:obstacle.id}]};
  if(a.method==='ask'&&['door','landing','crowd'].includes(obstacle.kind))return {...s,stationMap:{...map,block:{...block,mode:'yielding',elapsed:0,duration:.8+obstacle.phase/6.28*.8}}};
  if(a.method==='wait'&&obstacle.kind==='child')return {...s,stationMap:{...map,block:{...block,mode:'waiting',elapsed:0,duration:2.2}}};
  return s;
 }
 if(a.type==='MAP_TARGET'){
  if(s.phase!=='station'||s.event||!s.stationMap||s.stationMap.block||!Number.isFinite(a.point.x)||!Number.isFinite(a.point.y))return s;
  if(s.stationMap.bypassing)return {...s,stationRunning:s.stationMap.path.length>0&&(!s.stationMap.manual||!!s.stationMap.driveHeld)};
  const stationMap=setMapDestination(s,a.point);if(mapDistance(stationMap.position,mapTaskPoint(s))<.05)return enterMapTask({...s,stationMap});return {...s,stationMap,stationRunning:stationMap.path.length>0&&(!stationMap.manual||!!stationMap.driveHeld)};
 }
 if(a.type==='RUN_INPUT'&&s.stationMap?.manual&&s.phase==='station'){
  if(!a.held)return stopSprint(s);
  if(s.event||s.stationMap.block||!s.stationMap.path.length)return s;
  return {...stopSprint(s),stationMap:{...s.stationMap,driveHeld:true},stationRunning:true};
 }
 if(a.type==='SPRINT_INPUT'&&s.stationMap?.manual&&s.phase==='station'){
  if(s.event||s.stationMap.block||!s.stationMap.path.length)return s;
  s={...s,stationMap:{...s.stationMap,driveHeld:a.held||s.stationMap.driveHeld}};
 }
 if((a.type==='SPRINT_INPUT'||a.type==='RUN_INPUT')&&s.stationMap?.block)return s;
 if(a.type==='SPRINT_INPUT'&&a.held&&s.stationMap&&!s.stationMap.path.length)return s;
 if(a.type==='PREPARE_DOOR'&&s.phase==='metro'&&!s.event&&s.metroAnnouncement?.mode==='seated'){
  const door:Choice={label:'改变主意，去门口等着',detail:'',seconds:BALANCE.metroAnnouncement.choiceSeconds,metroEffect:'door-wait'};
  return choice(applyMetroAnnouncement(s,door),door,door.label);
 }
 if(s.student){
  let u=s.student;
  if(a.type==='PREP_PICK'){
   if(s.phase!=='preparation'||a.step!==u.prep)return s;const prep=PREPARATIONS[u.prep],option=prep?.options.find(o=>o.id===a.option);if(!option)return s;
   const stats={...u.stats};for(const [key,value] of Object.entries(option.stats??{}))stats[key as keyof typeof stats]=Math.max(0,Math.min(100,stats[key as keyof typeof stats]+value!));
   u={...u,stats,stamina:stats.energy,prep:u.prep+1,choices:{...u.choices,[prep.id]:option.id},decisionLoss:u.decisionLoss+option.seconds,cake:prep.id==='cake'?option.id==='take':u.cake,checkedID:prep.id==='id'?option.id==='check':u.checkedID,breakfast:prep.id==='breakfast'?option.id==='eat':u.breakfast};
   if(u.checkedID)u.pocket=0;
   return deadline({...s,student:u,remaining:s.remaining-option.seconds,phase:u.prep===PREPARATIONS.length?'route':'preparation',logs:[...s.logs,{title:option.label,seconds:option.seconds}]});
  }
  if(a.type==='CHANGE_LANE'){
   if(s.phase!=='station'||s.event)return s;
   const lane=Math.max(0,Math.min(2,u.runner.lane+a.direction));const wave=runnerWave(s);
   const cleared=u.runner.blocked&&wave&&lane!==wave.lane;
   return {...s,student:{...u,runner:{...u.runner,lane,blocked:cleared?false:u.runner.blocked,wave:u.runner.wave+(cleared?1:0)}}};
  }
  if(a.type==='SPRINT_INPUT'){
   if(s.phase!=='station'||s.event)return s;
   return {...s,student:{...u,sprinting:a.held&&!u.exhausted&&!u.runner.blocked},stationRunning:a.held?true:s.stationRunning};
  }
  if(a.type==='PREPARE_DOOR')return s.phase==='metro'&&!s.event?{...s,student:{...u,doorReady:true}}:s;
  if(a.type==='OBSERVE')return s.event?.id==='security-queue'?{...s,student:{...u,observed:true},event:studentPrompt('security-queue',{...u,observed:true},s.gate)!}:s;
  if(a.type==='READ_MAP')return {...s,student:{...u,mapRead:true}};
  if(a.type==='POCKET_PICK'){
   if(s.event?.id!=='identity-search'||a.pocket<0||a.pocket>3||u.searched.includes(a.pocket))return s;
   if(a.pocket===u.pocket)return choice({...s,student:u,identityReady:true},{label:'',detail:'',seconds:0},u.checkedID?'从检查过的前袋取出身份证':'终于在书包里找到身份证');
   return deadline({...s,remaining:s.remaining-5,student:{...u,bagMistakes:u.bagMistakes+1,decisionLoss:u.decisionLoss+5,searched:[...u.searched,a.pocket]},logs:[...s.logs,{title:'翻错了书包夹层',seconds:5}]});
  }
 }
 if(a.type==='CHANGE_LANE'&&s.characterTime&&s.phase==='station'&&!s.event){const r=s.characterTime.runner,w=runnerWave(s),lane=Math.max(0,Math.min(2,r.lane+a.direction)),cleared=r.blocked&&w&&lane!==w.lane;return {...s,characterTime:{...s.characterTime,runner:{...r,lane,blocked:cleared?false:r.blocked,wave:r.wave+(cleared?1:0)}}};}
 if(a.type==='CHANGE_LANE'&&s.parent&&s.phase==='station'&&!s.event){const r=s.parent.runner,w=runnerWave(s),lane=Math.max(0,Math.min(2,r.lane+a.direction)),cleared=r.blocked&&w&&lane!==w.lane;return {...s,parent:{...s.parent,runner:{...r,lane,blocked:cleared?false:r.blocked,wave:r.wave+(cleared?1:0)}}};}
 if(a.type==='SPRINT_INPUT'&&s.characterTime&&s.phase==='station'&&!s.event)return {...s,stationRunning:a.held||s.stationRunning,characterTime:{...s.characterTime,sprinting:a.held&&!s.characterTime.exhausted&&!s.characterTime.runner.blocked}};
 if(a.type==='SPRINT_INPUT'&&s.parent&&s.phase==='station'&&!s.event)return {...s,stationRunning:a.held||s.stationRunning,parent:{...s.parent,sprinting:a.held&&!s.parent.exhausted&&!s.parent.runner.blocked}};
 if(a.type==='RUN_INPUT')return s.phase==='station'?{...s,stationRunning:a.held&&!s.event,student:s.student?{...s.student,sprinting:false}:undefined,characterTime:s.characterTime?{...s.characterTime,sprinting:false}:undefined,parent:s.parent?{...s.parent,sprinting:false}:undefined}:s;
 if(a.type==='START')return s.phase==='lobby'?{...s,phase:s.student||s.characterTime||s.parent?'preparation':'route',phaseElapsed:0}:s;
 if(a.type==='ROUTE')return s.phase==='route'?{...s,route:a.route,metroAnnouncement:undefined,metroIncident:planMetroIncident(a.route,s.metroIncidentRoll,s.metroIncidentVariant,s.character.id),metroDuration:journeyRouteSeconds(s,a.route),metroTimeBudget:journeyRouteBudget(s,a.route),phase:'direction',phaseElapsed:0}:s;
 if(a.type==='DIRECTION'){if(s.phase!=='direction')return s;if(!a.correct)return {...s,phase:'wrong',phaseElapsed:0};return {...s,phase:'metro',phaseElapsed:0};}
 if(a.type==='CONTINUE_METRO')return s.phase==='arrival'&&!s.event?continueMetro({...s,metroAnnouncement:undefined}):s;
 if(a.type==='ALIGHT'){
  if(s.phase!=='arrival'||s.event)return s;
  s={...s,metroAnnouncement:undefined};
  if(s.student){const delay=s.student.doorReady?0:12;s=deadline({...s,remaining:s.remaining-delay,student:{...s.student,decisionLoss:s.student.decisionLoss+delay,doorSavings:s.student.doorSavings+(delay?0:12)},logs:[...s.logs,{title:delay?'没提前靠门，挤过人群':'提前靠门，快速下车',seconds:delay}]});if(s.phase==='result')return s;}

  if(s.metroStopIndex===transferStopIndex(s.route!)&&!s.metroTransferred)return {...s,phase:'transfer',event:s.student?{id:'transfer-run',title:'跟着换乘标识，跑过通道！',description:'连续点击六次，主动完成换乘。',phase:'metro',interaction:{kind:'tap',required:6,seconds:12,penalty:0},choices:[{label:'换乘完成',detail:'继续上车',seconds:0}]}:null,phaseElapsed:0,metroTransferred:true,logs:[...s.logs,{title:'在'+s.route!.stops[s.metroStopIndex]+'换乘'+s.route!.lines[1]+'号线',seconds:0}]};
  if(s.metroStopIndex===s.route!.stops.length-1)return {...s,phase:'station',phaseElapsed:0,event:null,stage:0,stationJourney:buildStationJourney(s),stationBeat:0,stationProgress:0,stationRunning:false,student:s.student?{...s.student,stationStart:s.remaining}:undefined};
  return recoverMetro(s,'在'+s.route!.stops[s.metroStopIndex]+'下早了，重新上车',60,'metro');
 }
 if(a.type==='PENALTY')return deadline({...s,remaining:s.remaining-a.seconds,logs:[...s.logs,{title:a.title,seconds:a.seconds}]});
 if(a.type==='DETOUR_DONE')return {...s,detour:null};
 if(a.type==='ID_PICK'&&s.event?.id==='identity-search'){
  const expected=s.identityStage==='wallet'?'wallet':'id';
  if(a.item!==expected)return deadline({...s,remaining:s.remaining-5,logs:[...s.logs,{title:'拿错了，再找找',seconds:5}]});
  if(s.identityStage==='wallet')return {...s,identityStage:'card',eventElapsed:0,eventOverdue:false};
  return choice({...s,identityReady:true},{label:'',detail:'',seconds:0},'身份证找到了，放进外袋');
 }
 if(a.type==='CHOICE'){
  if(!s.event||s.event.id==='identity-search')return s;
  if(s.event.id==='metro-announcement'){
   const selected=s.event.choices.find(c=>c.label===a.choice.label);if(!selected)return s;
   return choice(applyMetroAnnouncement(s,selected),selected,selected.label);
  }
  if(s.parent&&isParentBlock(s.event.id)){
   const selected=s.event.choices.find(c=>c.label===a.choice.label);if(!selected)return s;
   const parent=applyParentChoice(s.parent,s.event.id,selected.label,selected.seconds);
   return deadline({...s,parent,remaining:s.remaining-selected.seconds,event:null,eventElapsed:0,eventOverdue:false,stationRunning:false,logs:[...s.logs,{title:selected.label,seconds:selected.seconds,eventId:s.event.id}]});
  }
  if(s.student&&s.event.id==='transfer-run'){if(!s.event.choices.some(c=>c.label===a.choice.label))return s;return {...s,phase:'metro',event:null,phaseElapsed:0,student:{...s.student,doorReady:false}};}
  if(s.student&&s.event.id==='student-breath'){
   const selected=s.event.choices.find(c=>c.label===a.choice.label);if(!selected)return s;
   return deadline({...s,event:null,eventElapsed:0,eventOverdue:false,stationRunning:false,student:{...s.student,stamina:Math.max(s.student.stamina,65),sprinting:false,decisionLoss:s.student.decisionLoss+selected.seconds},remaining:s.remaining-selected.seconds,logs:[...s.logs,{title:'连续冲刺岔气，停下调整呼吸',seconds:selected.seconds,eventId:'student-breath'}]});
  }

  if(s.characterTime&&s.event.id==='tourist-sleep'){
   const selected=s.event.choices.find(c=>c.label===a.choice.label);if(!selected)return s;
   const chosen=choice(applyCharacterEvent(s,'tourist-sleep',selected.label),selected,selected.label);
   if(chosen.phase!=='metro'||!chosen.characterTime?.sleeping)return chosen;
   const last=chosen.route!.stops.length-1,transfer=transferStopIndex(chosen.route!);
   const alarmIndex=Math.max(1,last-chosen.characterTime.alarmStops);
   const wakeIndex=!chosen.metroTransferred&&transfer>0?Math.min(alarmIndex,transfer):alarmIndex;
   const progress=wakeIndex/last;
   const arrived:Run={...chosen,phase:'arrival',phaseElapsed:0,metroProgress:progress,metroStopIndex:wakeIndex,remaining:chosen.remaining-(progress-chosen.metroProgress)*chosen.metroDuration,event:null,eventElapsed:0};
   return deadline({...arrived,event:characterEventPrompt(arrived,'tourist-wake')??null});
  }
  if(s.characterTime&&s.event.id==='tourist-wake'){
   const selected=s.event.choices.find(c=>c.label===a.choice.label);if(!selected)return s;
   const awakened=applyCharacterEvent(s,'tourist-wake',selected.label);
   if(selected.label==='醒醒！')return {...choice(awakened,selected,'闹钟叫醒，确认站名'),phaseElapsed:0};
   return recoverMetro({...awakened,event:null,eventElapsed:0},'闹钟没叫醒，坐过一站后折返',selected.seconds,'arrival');
  }

  if(s.characterTime&&s.event){const selected=s.event.choices.find(c=>c.label===a.choice.label);if(!selected)return s;
   if(s.event.id==='zz-hometown'&&selected.label==='告诉他')return {...s,event:stationChallenge(s,'zz-hometown-answer')??s.event,eventElapsed:0,eventOverdue:false};
   s=applyCharacterEvent(s,s.event.id,selected.label);
  }
  if(!s.event)return s;
  let chosen=a.choice;
  if(s.stationJourney.length){const selected=s.event.choices.find(c=>c.label===chosen.label);if(!selected)return s;chosen=selected;}
  if(s.parent)s={...s,parent:applyParentChoice(s.parent,s.event.id,chosen.label,chosen.seconds)};
  if(s.event!.id==='zz-number'&&chosen.stationDecision&&!chosen.stationDecision.optimal){return deadline({...s,remaining:s.remaining-chosen.seconds,eventElapsed:0,stationDecisions:[...s.stationDecisions,chosen.stationDecision],student:s.student?{...s.student,wrongTurns:s.student.wrongTurns+1,decisionLoss:s.student.decisionLoss+chosen.seconds}:undefined,logs:[...s.logs,{title:'看成 '+chosen.label+'，折返重新核对',seconds:chosen.seconds,eventId:'zz-number'}]});}
  if(s.stationJourney.length&&s.event!.id==='elder-block'){
   const selected=s.event!.choices.find(c=>c.effect===chosen.effect);if(!selected)return s;
   if(selected.effect==='elder-detour')return {...s,event:{id:'elder-detour-action',title:'侧面有空隙，侧身挤过去！',description:'向上滑动小人，收好背包，从旁边绕开。',phase:'station',interaction:{kind:'swipe',seconds:7,penalty:15},choices:[{label:'侧身通过',detail:'绕开老人 · −10 秒',seconds:10}]},eventElapsed:0,eventOverdue:false};
   const scam=s.stationLuck.elderScam,seconds=scam?60:2;
   if(s.student)s={...s,student:{...s.student,decisionLoss:s.student.decisionLoss+seconds}};
   return deadline({...s,event:elderOutcome(scam),eventElapsed:0,eventOverdue:false,remaining:s.remaining-seconds,logs:[...s.logs,{title:scam?'推了一下，被碰瓷耽误了':'推了一下，挤过通道',seconds}]});
  }
  if(s.stationJourney.length&&s.event!.id==='escalator-ride'&&(!s.student||s.student.vertical==='escalator')){
   const selected=s.event!.choices.find(c=>c.label===chosen.label);if(!selected)return s;
   const fast=!!selected.boost,blocked=s.stationLuck.escalators[s.escalatorLane!]==='blocked';
   return {...s,event:{id:'escalator-operation',phase:'station',title:fast?(s.student?.cake?'一手拎着蛋糕盒，先护好再快走！':'前面让开了，快走四步！'):blocked?'被堵住了，先等前面的人走。':'站稳扶手，跟着扶梯上楼。',description:fast?(s.student?.cake?'多点一下扶稳手里的蛋糕盒，再沿扶梯快步上楼。':'连续点击四次，沿扶梯快步上楼。'):'按住扶手，等这一段走完才能继续。',interaction:{kind:fast?'tap':'hold',required:fast?4+(s.student?.cake?1:0):blocked?3:1.5,seconds:9,penalty:15},choices:[{...selected,boost:undefined,detour:undefined,label:fast?'快走上楼':'按住扶手'}]},eventElapsed:0,eventOverdue:false};
  }
  if(s.event!.id==='elder-block'){
   const selected=s.event!.choices.find(c=>c.effect===chosen.effect);
   if(!selected)return s;
   if(selected.effect==='elder-push'){
    const scam=s.stationLuck.elderScam;
    const next=choice(s,{...selected,seconds:scam?60:2},scam?'推了一下，被碰瓷耽误了':'推了一下，挤过通道');
    return next.phase==='result'?next:{...next,event:elderOutcome(scam),eventElapsed:0};
   }
   return choice(s,selected,'绕开挡路的老人');
  }
  if(s.event!.id==='escalator-choice'){
   const selected=s.event!.choices.find(c=>c.escalator===chosen.escalator);
   return selected?choice(s,selected,'选择了'+selected.label):s;
  }
  return choice(s,chosen);
 }
 if(a.type==='STATION_EVENT'&&s.stationJourney.length)return s;
 if(a.type==='STATION_EVENT'&&s.phase==='station'&&!s.event){
  const e=a.id==='elder-block'?elderPrompt(s.stationLuck):a.id==='escalator-choice'?s.escalatorLane===null?escalatorPrompt():undefined:a.id==='escalator-ride'?s.escalatorLane!==null?escalatorRide(s.stationLuck.escalators[s.escalatorLane],s.escalatorLane):undefined:a.id==='identity-search'?!s.identityReady?identityPrompt('station'):undefined:a.id?stationPrompt(a.id,s.hard):randomEvent(s,'station');
  if(!e||s.seen.includes(e.id))return s;
  return {...s,event:e,eventElapsed:0,stationEvents:s.stationEvents+1};
 }
 if(s.stationJourney.length&&['STAGE','DETOUR_DONE','GATE','WIN','STATION_EVENT'].includes(a.type))return s;
 if(a.type==='STAGE')return s.phase==='station'?{...s,stage:Math.max(s.stage,a.stage),distance:a.distance}:s;
 if(a.type==='STAMINA')return {...s,stamina:a.value};
 if(a.type==='GATE')return s.phase==='station'&&s.stage===4&&s.identityReady&&!s.event&&s.remaining>STOP_BEFORE?{...s,gatePassed:true,gateRemaining:s.remaining-STOP_BEFORE,stage:5}:s.remaining<=STOP_BEFORE?finish(s):s;
 if(a.type==='WIN')return s.phase==='station'&&s.gatePassed&&s.remaining>0?finish(s,true):s;
 if(a.type==='TICK'){
  if(s.phase==='lobby')return s;
  if(!Number.isFinite(a.dt)||a.dt<=0)return s;
  const dt=Math.max(0,a.dt);
  let n:Run={...s,remaining:s.remaining-dt*clockRate(s),elapsed:s.elapsed+dt,phaseElapsed:s.phaseElapsed+dt,slow:Math.max(0,s.slow-dt),boost:Math.max(0,s.boost-dt)};
  if(s.student){let u={...s.student,stats:{...s.student.stats},elapsedGame:s.student.elapsedGame+dt*clockRate(s)};
   u.late=u.late||(s.gatePassed?s.remaining:s.remaining-STOP_BEFORE)<=STUDENT.lateThreshold;
   if(!u.breakfast&&!u.hungry&&s.phase==='station'&&s.stage>=3){u.hungry=true;u.stats.energy=Math.max(0,u.stats.energy-10);}
   const running=s.phase==='station'&&s.stationRunning&&!s.event&&!u.runner.blocked;
   const sprint=running&&u.sprinting&&!u.exhausted;
   const recovery=(running?STUDENT.walkRecover:STUDENT.recover)*(.65+u.stats.energy/100*.4667)*(1-u.stats.load/250)*(u.late?STUDENT.lateRecovery:1);
   u.stamina=Math.max(0,Math.min(u.stats.energy,u.stamina+((sprint?-STUDENT.drain:recovery)-(running&&u.cake?(sprint?STUDENT.cakeSprintDrain:STUDENT.cakeWalkDrain):0))*dt));
   if(sprint)u.sprintStrain+=dt;
   else if(s.phase==='station'&&!s.event&&!s.stationMap?.block&&!u.runner.blocked&&(!running||!u.exhausted))u.sprintStrain=Math.max(0,u.sprintStrain-(running?1.5:2)*dt);
   if(u.stamina===0){u.exhausted=true;u.sprinting=false;}else if(u.exhausted&&u.stamina>=15)u.exhausted=false;
   if(running){u.movingSeconds+=dt;if(sprint){u.sprintSeconds+=dt;u.sprintSaved+=dt*TIME_SCALE*(movementFactor(s.student)/movementFactor({...s.student,sprinting:false,exhausted:false})-1);}}
   if(s.event){u.eventTime={...u.eventTime,[s.event.id]:(u.eventTime[s.event.id]??0)+dt*clockRate(s)};}
   if(s.event?.id==='identity-search')u.bagSeconds+=dt*clockRate(s);
   if(u.late&&sprint)u.lateSprintSaved+=dt*TIME_SCALE*(movementFactor(s.student)/movementFactor({...s.student,sprinting:false,exhausted:false})-1);
   if(u.late&&u.exhausted)u.exhaustedLateSeconds+=dt;
   if(s.phase==='transfer')u.transferSeconds+=dt*clockRate(s);
   n.student=u;
   if(sprint&&u.sprintStrain>=STUDENT.breathLimit){
    n={...n,student:{...u,sprinting:false,sprintStrain:0,breathStops:u.breathStops+1},stationMap:n.stationMap?.manual?{...n.stationMap,driveHeld:false}:n.stationMap,stationRunning:false,event:{id:'student-breath',phase:'station',title:'冲太猛，岔气了！',description:`你一直在冲，呼吸乱了。这次停步要花 ${STUDENT.breathPenalty} 秒；走路或主动停下能提前缓解冲刺负荷。`,interaction:{kind:'hold',required:1.5,seconds:10,penalty:0},choices:[{label:'按住调整呼吸',detail:`耽误 ${STUDENT.breathPenalty} 秒 · 恢复体力`,seconds:STUDENT.breathPenalty}]},eventElapsed:0,eventOverdue:false};
    return deadline(n);
   }
  }
  if(s.characterTime){const t=tickCharacterTime(s.characterTime,dt,s.phase==='station'&&s.stationRunning&&!s.event&&!s.stationMap?.block);n={...n,characterTime:t,stamina:t.energy};}
  if(s.parent){
   const running=s.phase==='station'&&s.stationRunning&&!s.event&&!s.parent.runner.blocked;
   n.parent=tickParent(s.parent,s.phase,dt,s.phase==='metro'?0:dt*clockRate(s),running);
   n.stamina=n.parent.energy;
   if(s.phase==='station'&&!s.event&&!s.stationMap?.block){const block=parentBlockPrompt(n.parent);if(block)return deadline(stopSprint({...n,event:block,eventElapsed:0,eventOverdue:false}));}
  }
  if(s.event){
   n.eventElapsed+=dt;
   if(s.student){n.eventOverdue=n.eventElapsed>=(s.event.interaction?.seconds??12)*focusWindow(s.student.stats.focus);return deadline(n);}

   if(s.phase==='station'&&s.stationJourney.length){
    const limit=s.event.id==='identity-search'?(s.identityStage==='wallet'?8:6):(s.event.interaction?.seconds??10);
    if(n.eventElapsed>=limit&&!s.eventOverdue){const penalty=s.event.interaction?.penalty??15;n={...n,eventOverdue:true,remaining:n.remaining-penalty,logs:[...n.logs,{title:'耽误了，仍需完成：'+s.event.title,seconds:penalty}]};}
    return deadline(n);
   }
   if(s.event.id==='identity-search'){
    const limit=s.identityStage==='wallet'?8:6;
    if(n.eventElapsed>=limit){
     if(s.identityStage==='wallet')return deadline({...n,identityStage:'card',eventElapsed:0,eventOverdue:false,remaining:n.remaining-20,logs:[...n.logs,{title:'钱包终于翻到了',seconds:20}]});
     return choice({...n,identityReady:true},{label:'',detail:'',seconds:35},'找太久了，终于拿到身份证');
    }
    return deadline(n);
   }
   if(n.eventElapsed>=(s.event.interaction?.seconds??10)){
    if(s.event.id==='metro-announcement'){const seated=s.event.choices[1];n=choice(applyMetroAnnouncement(n,seated),seated,'还坐着等下一站');}
    else if(s.event.id==='elder-block')n=choice(n,s.event.choices[0],'没选，自动绕开老人');
    else if(s.event.id==='escalator-choice')n=choice(n,s.event.choices[1],'没选，走中间的 2 号扶梯');
    else if(s.event.id==='escalator-ride')n=choice(n,s.event.choices.at(-1)!,'跟着扶梯上楼');
    else if(s.event.id==='tourist-wake')n=recoverMetro({...applyCharacterEvent(n,'tourist-wake','再睡一下'),event:null,eventElapsed:0},'闹钟没叫醒，坐过一站后折返',s.event.interaction?.penalty??80,'arrival');
    else n=choice(n,{label:'',detail:'',seconds:s.event.interaction?.penalty??55},'没来得及：'+s.event.title);
   }
   return deadline(n);
  }
  if(s.phase==='station'&&s.stationMap?.block){
   const map=s.stationMap,block=map.block!,waiting=['queue','waiting','yielding'].includes(block.mode);
   if(!waiting){
    if(block.queues.length)n.stationMap={...map,block:{...block,queues:advanceMapQueues(block.queues,dt*clockRate(s)/TIME_SCALE)}};
    return deadline(n);
   }
   const waitingDt=Math.min(dt,Math.max(0,block.duration-block.elapsed)),progress=block.elapsed+waitingDt,elapsed=block.duration-progress<1e-9?block.duration:progress,waited=block.waited+waitingDt*clockRate(s);
   // The frame remainder runs at normal time once the queue has stopped at the tray.
   n.remaining+=(dt-waitingDt)*(clockRate(s)-1);
   const queues=advanceMapQueues(block.queues,(waitingDt*clockRate(s)+dt-waitingDt)/TIME_SCALE);
   n.stationMap={...map,block:{...block,elapsed,waited,queues}};
   if(n.student)n.student={...n.student,environmentLoss:n.student.environmentLoss+waitingDt*clockRate(s)};
   if(elapsed>=block.duration){
    if(block.mode==='queue')n.stationMap={...n.stationMap,block:{...n.stationMap.block!,mode:'tray'}};
    else {n.stationMap=clearMapObstacle(n.stationMap);n.stationRunning=n.stationMap.path.length>0&&(!n.stationMap.manual||!!n.stationMap.driveHeld);n.logs=[...n.logs,{title:'前面的人让开，继续赶路',seconds:waited,eventId:block.id}];}
   }
   return deadline(n);
  }
  if(s.phase==='station'&&s.stationJourney.length){
   const beat=s.stationJourney[s.stationBeat];
   if(s.stationMap){
    if(beat&&s.stationRunning){
     const speed=s.parent?parentMovementFactor(s.parent,s.parent.sprinting):characterMovementFactor(s,s.student?s.student.sprinting:!!s.characterTime?.sprinting);
     const result=advanceOnMap(s,Math.min(dt,.25)*speed*s.stationMap.legDistance/beat.seconds);
     n.stationMap=result.map;
     n.stationProgress=Math.max(0,Math.min(.99,1-pathLength(result.map.position,mapPath(n,result.map.position,mapTaskPoint(n)))/Math.max(1,result.map.legDistance)));
     if(result.encounter)n=enterMapTask(n);
     if(result.obstruction){n=stopSprint(n);if(n.student)n.student={...n.student,runner:{...n.student.runner,collisions:n.student.runner.collisions+1}};if(n.characterTime)n.characterTime={...n.characterTime,runner:{...n.characterTime.runner,collisions:n.characterTime.runner.collisions+1}};if(n.parent)n.parent={...n.parent,runner:{...n.parent.runner,collisions:n.parent.runner.collisions+1}};}
     if(!result.map.path.length)n=stopSprint(n);
    }
    return deadline(n);
   }
   if(beat&&s.stationRunning&&!s.student?.runner.blocked&&!s.characterTime?.runner.blocked&&!s.parent?.runner.blocked){
    n.stationProgress=Math.min(1,s.stationProgress+Math.min(dt,.25)*(s.parent?parentMovementFactor(s.parent,s.parent.sprinting):characterMovementFactor(s,s.student?s.student.sprinting:!!s.characterTime?.sprinting))/beat.seconds);
    const wave=runnerWave(s);
    if(wave&&n.stationProgress>=wave.at&&(n.student||n.characterTime||n.parent)){
     const runner=n.student?.runner??n.characterTime?.runner??n.parent!.runner;
     if(runner.lane===wave.lane){n.stationProgress=wave.at;if(n.student)n.student={...n.student,sprinting:false,runner:{...n.student.runner,blocked:true,collisions:n.student.runner.collisions+1}};else if(n.characterTime)n.characterTime={...n.characterTime,sprinting:false,runner:{...n.characterTime.runner,blocked:true,collisions:n.characterTime.runner.collisions+1}};else n.parent={...n.parent!,sprinting:false,runner:{...n.parent!.runner,blocked:true,collisions:n.parent!.runner.collisions+1}};}
     else if(n.student)n.student={...n.student,runner:{...n.student.runner,wave:n.student.runner.wave+1,dodges:n.student.runner.dodges+1}};else if(n.characterTime)n.characterTime={...n.characterTime,runner:{...n.characterTime.runner,wave:n.characterTime.runner.wave+1,dodges:n.characterTime.runner.dodges+1}};else n.parent={...n.parent!,runner:{...n.parent!.runner,wave:n.parent!.runner.wave+1,dodges:n.parent!.runner.dodges+1}};
    }
    if(n.stationProgress>=1){n.event=journeyPrompt(n);n.eventElapsed=0;n.eventOverdue=false;n.stationRunning=false;if(n.student)n.student={...n.student,sprinting:false};if(n.parent)n.parent={...n.parent,sprinting:false};}
   }
   return deadline(n);
  }
  if(s.phase==='wrong'&&n.phaseElapsed>=2.5){
   if(n.student)n.student={...n.student,wrongTurns:n.student.wrongTurns+1,decisionLoss:n.student.decisionLoss+75};
   n={...n,phase:'direction',phaseElapsed:0,remaining:n.remaining-75,logs:[...s.logs,{title:'坐反方向，下一站折返',seconds:75}]};
  }
  if(s.phase==='transfer'&&!s.student&&n.phaseElapsed>=1.2)n={...n,phase:'metro',phaseElapsed:0};
  if(s.phase==='metro-recovery'&&n.phaseElapsed>=2)n={...n,phase:s.metroRecoveryTarget,phaseElapsed:0};
  if(s.phase==='metro'){
   const old=s.metroProgress;
   const stopProgress=(s.metroStopIndex+1)/(s.route!.stops.length-1);
   let next=Math.min(stopProgress,old+dt/METRO_SECONDS);
   if(stopProgress-next<1e-9)next=stopProgress;
   const incident=s.metroIncident;
   const incidentAt=metroIncidentCheckpoint(s.route!,incident);
   const checkpoint=incident&&!s.seen.includes(incident.id)&&old<incidentAt&&next>=incidentAt;
   const sleepCheckpoint=!checkpoint&&s.characterTime?.characterId==='tourist'&&!s.seen.includes('tourist-sleep')&&old<.2&&next>=.2;
   if(checkpoint)next=incidentAt;
   else if(sleepCheckpoint)next=.2;
   const movingSeconds=(next-old)*METRO_SECONDS;
   n.remaining=s.remaining-(next-old)*s.metroDuration-Math.max(0,dt-movingSeconds)*clockRate(s);
   n.metroProgress=next;
   if(n.parent)n.parent=tickParent(n.parent,'metro',0,(next-old)*s.metroDuration,false);
   if(n.student&&s.student)n.student.elapsedGame=s.student.elapsedGame+s.remaining-n.remaining;
   if(checkpoint){n.event=incident;n.eventElapsed=0;}
   if(sleepCheckpoint){n.event=characterEventPrompt(n,'tourist-sleep')??null;n.eventElapsed=0;}
   if(next>=stopProgress){
    n.phase='arrival';n.phaseElapsed=0;n.metroStopIndex=s.metroStopIndex+1;
    if(n.metroStopIndex===s.route!.stops.length-1&&s.metroAnnouncement?.mode==='seated'&&s.metroAnnouncement.miss)return recoverMetro({...n,metroAnnouncement:undefined,metroMisses:n.metroMisses+1},'坐过站了，折返重新下车',BALANCE.metroAnnouncement.missSeconds,'arrival');
   }
  }
  // At ordinary stops, doing nothing means staying on. Missing a required exit
  // costs time and returns to that stop, without charging the journey twice.
  if(s.phase==='arrival'&&n.phaseElapsed>=DOOR_SECONDS&&!n.event)n=continueMetro(n);
  return deadline(n);
 }
 return s;
}
export type RecordEntry={title?:string;stationPlaystyle?:string;reason?:string;id:string;city:string;character:string;success:boolean;extreme:boolean;margin:number;elapsed:number;date:string};
export function readRecords():RecordEntry[]{try{const v=JSON.parse(readGameStorage('catch-train-records')||'[]');return Array.isArray(v)?v.filter(r=>r&&typeof r.id==='string'&&typeof r.success==='boolean').slice(0,30):[];}catch{return [];}}
export function saveRecord(run:Run){const records=readRecords();if(!records.some(r=>r.id===run.id)){records.unshift({title:summarizeRun(run).title,stationPlaystyle:summarizeRun(run).stationPlaystyle,reason:summarizeRun(run).summary,id:run.id,city:run.city.name,character:run.character.name,success:run.success,extreme:run.success&&run.gateRemaining<30,margin:run.gateRemaining,elapsed:run.elapsed,date:new Date().toLocaleDateString('zh-CN')});try{writeGameStorage('catch-train-records',JSON.stringify(records.slice(0,30)));}catch{/* optional storage */}}}

// Reading and choosing run at real time; travel keeps its compressed game clock.
export function clockRate(s:Run){if(s.stationMap?.block)return s.stationMap.block.mode==='queue'?TIME_SCALE:1;return !s.event&&s.phase==='station'&&s.stationRunning&&!s.student?.runner.blocked&&!s.characterTime?.runner.blocked&&!s.parent?.runner.blocked?TIME_SCALE:1;}
export function reducer(s:Run,a:Action):Run{
 if(a.type==='TICK'&&Number.isFinite(a.dt)&&s.phase!=='lobby'&&s.phase!=='result'){
  // A delayed mobile frame must not charge full travel time while only moving
  // a quarter-second. Substeps also stop at people and event boundaries.
  if(s.stationMap&&a.dt>.25){
   let next=s,left=a.dt;
   while(left>1e-8&&next.phase!=='result'){const step=Math.min(.1,left);next=reducer(next,{type:'TICK',dt:step});left-=step;}
   return next;
  }
 }
 let n=trackMapChildDelay(s,reduceCore(s,a));
 if(n.logs.length>s.logs.length){const eventId=s.event?.id??(a.type==='PREP_PICK'?'prepare-'+PREPARATIONS[s.student?.prep??0]?.id:a.type==='ALIGHT'?'metro-door':'metro-route');n={...n,logs:n.logs.map((l,i)=>i<s.logs.length?l:{...l,eventId:l.eventId??eventId})};}
 if(a.type!=='TICK'||!s.student||!n.student||n===s)return trackTransition(s,trackTimeLedger(s,n,a,clockRate(s),METRO_SECONDS),a);
 const charged=(n.student.decisionLoss-s.student.decisionLoss)+(n.student.environmentLoss-s.student.environmentLoss);
 const spent=Math.max(0,s.remaining-n.remaining-charged);
 const key=s.phase==='metro'&&!s.event?'journey':s.event?'handling':s.phase==='station'&&s.stationRunning&&!s.student.runner.blocked?'moving':'waiting';
 n={...n,student:{...n.student,clockSpent:{...n.student.clockSpent,[key]:n.student.clockSpent[key]+spent}}};
 return trackTransition(s,trackTimeLedger(s,n,a,clockRate(s),METRO_SECONDS),a);
}
