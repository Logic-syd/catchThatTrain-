/** Paired input-policy simulation, never a measured human success rate.
 * npx vite-node scripts/simulate-skill-balance.ts --samples=20 --characters=student --stations=shanghai
 * Optional: --skills=skilled,novice,error-prone --plans=balanced,lean,prepared
 * --modes=normal,extreme --locomotion=sprint|walk --offset=0 --seed-base=2654435769
 * Profile overrides: --novice-read=2.2 --novice-choice-error=.08 --novice-alarm=1.7
 * --novice-alarm-jitter=1 --novice-obstacle-miss=.1; all numeric profile fields
 * accept the same kebab-case spelling. Metadata records every effective value.
 */
import {createCharacterStationRun,reducer,journeyRouteSeconds,STOP_BEFORE,type Run,type Action} from '../src/engine';
import {runnerWave} from '../src/runner';
import {STATIONS} from '../src/stations';
import {PREPARATIONS,bagHint,focusWindow} from '../src/studentConfig';
import {timedPrompt} from '../src/characterTime';
import {eventHoldSeconds} from '../src/eventTiming';
import {secondsToGoal} from '../src/timeModel';
import type {Choice} from '../src/data';
import {difficultyPolicy,DIFFICULTY_TARGETS,DIFFICULTY_TARGET_RANGES} from '../src/difficulty';
import {advanceSpatialMotion,buildSpatialScene,planSpatialPath,type SpatialScene} from '../src/spatialChoice';
import {roadsidePrompt} from '../src/hongqiao';
import {metroBoardingChoice,needsMetroBranchExit,type MetroTerminal} from '../src/metroBranch';

type Character='student'|'worker'|'tourist'|'mom';
type Skill='skilled'|'novice'|'error-prone';
type Plan='balanced'|'lean'|'prepared';
type Profile={read:number;tap:number;arrival:number;choiceError:number;obstacleReaction:number;obstacleMiss:number;collisionRecovery:number;alarm:number;alarmJitter:number;observe:number;search:number;swipe:number;distraction:number;mazeInfo:number;lecture:number};
const profiles:Record<Skill,Profile>={
 skilled:{read:1.2,tap:.18,arrival:.6,choiceError:0,obstacleReaction:.25,obstacleMiss:0,collisionRecovery:.5,alarm:.8,alarmJitter:.4,observe:1,search:1.2,swipe:.55,distraction:.04,mazeInfo:1,lecture:0},
 novice:{read:2.2,tap:.28,arrival:1,choiceError:.08,obstacleReaction:.65,obstacleMiss:.1,collisionRecovery:1.2,alarm:1.7,alarmJitter:1,observe:.65,search:2,swipe:1,distraction:.28,mazeInfo:.8,lecture:.08},
 'error-prone':{read:3.6,tap:.45,arrival:1.8,choiceError:.22,obstacleReaction:1.2,obstacleMiss:.28,collisionRecovery:2,alarm:2.9,alarmJitter:1.6,observe:.15,search:3,swipe:1.5,distraction:.65,mazeInfo:.4,lecture:.35}
};
const args:Record<string,string|undefined>=Object.fromEntries(process.argv.slice(2).filter(a=>a.startsWith('--')).map(a=>a.slice(2).split('=')));
const number=(key:string,fallback:number)=>args[key]===undefined?fallback:Number(args[key]);
const samples=number('samples',20),offset=number('offset',0),seedBase=number('seed-base',0x9e3779b9);
if(!Number.isInteger(samples)||samples<1||!Number.isInteger(offset)||offset<0||!Number.isInteger(seedBase))throw Error('Invalid samples, offset or seed-base');
function select<T extends string>(key:string,available:readonly T[],defaults:readonly T[]=available):T[]{
 const values=args[key]?.split(',')??[...defaults];
 if(!values.length||values.some(x=>!available.includes(x as T))||new Set(values).size!==values.length)throw Error('Invalid '+key);
 return values as T[];
}
const characters=select('characters',['student','worker','tourist','mom'] as const);
const stations=select('stations',STATIONS.map(s=>s.id));
const modes=select('modes',['normal','extreme'] as const);
const skills=select('skills',['skilled','novice','error-prone'] as const);
const plans=select('plans',['balanced','lean','prepared'] as const,['balanced']);
const locomotion=select('locomotion',['sprint','walk'] as const,['sprint'])[0];
for(const [skill,p] of Object.entries(profiles))for(const key of Object.keys(p) as (keyof Profile)[]){
 const flag=skill+'-'+key.replace(/[A-Z]/g,c=>'-'+c.toLowerCase()),value=number(flag,p[key]);
 if(!Number.isFinite(value)||value<0||(['choiceError','obstacleMiss','observe','distraction','mazeInfo','lecture'].includes(key)&&value>1))throw Error('Invalid '+flag);
 p[key]=value;
}
const sprintStart=number('sprint-start',.7),sprintStop=number('sprint-stop',.3),closeMargin=number('close-margin',45);
if(!(sprintStop>=0&&sprintStop<sprintStart&&sprintStart<=1)||!Number.isFinite(closeMargin)||closeMargin<0)throw Error('Invalid sprint thresholds or close-margin');

// Keyed input noise stays paired even when a slow profile visits extra events.
function noise(seed:number,key:string){let h=seed>>>0;for(const c of key)h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;h^=h>>>16;h=Math.imul(h,0x85ebca6b);h^=h>>>13;return (h>>>0)/4294967296;}
const round=(n:number)=>Math.round(n*1000)/1000;
const navigation=new Set(['station-sign','bj-entry','hz-fork','hz-zone','wh-floor','zz-wing','zz-number','metro-transfer-sign','metro-announcement','old-ticket']);
const rows:{who:Character;station:string;mode:string;skill:Skill;plan:Plan;success:boolean;gateMargin:number|null;close:boolean}[]=[];
let totalTransitions=0;

console.log(JSON.stringify({type:'metadata',inputModelVersion:6,samples,offset,seedBase,characters,stations,modes,skills,plans,locomotion,profiles,sprintStart,sprintStop,closeMargin,targetSuccessRates:DIFFICULTY_TARGETS,targetSuccessRanges:DIFFICULTY_TARGET_RANGES,difficultyPolicies:Object.fromEntries(characters.map(who=>[who,Object.fromEntries(stations.map(station=>[station,difficultyPolicy(who,station)]))])),seedRule:'(seedBase ^ Math.imul(sample+1,0x85ebca6b)) >>> 0',notes:[
 'Input model v6 follows automatic ordinary walking after student tasks at all six stations. It starts movement only when the engine is actually stopped; finishing a task never injects a synthetic restart, sprint or extra time debit.',
 'All six student stations now offer optional five-real-second roadside notices. Ignoring a notice has no decline click or modal reading delay. Accepting uses the unchanged keyed distraction probability, advances actual TICK time for one tap reaction while movement continues, and only stops if the same notice remains available. The accepted event then uses actual modal reading and hold time. Expired notices are not recovered. The engine owns the absolute elapsed-time deadline and any queued notice; hiding a notice does not pause its deadline, and the simulator has no independent expiry clock.',
 'Input model v5 reads the visible Line 10 terminus and alights at Longxi Road when the train is bound for Hangzhong Road. Platform reading and tapping consume actual time; the same choiceError probability can cause one wrong-train choice, followed by recovery. Formal waiting/detour fees come only from BOARD_METRO. Historical v4 simulations did not include this branch task.',
 'Input model v4 adds student Hongqiao spatial entrances and optional roadside distractions. Other character/station input policies remain v3; historical v3 student results use the previous stop-and-choose journey.',
 'Spatial scenes use the same visible geometry and advanceSpatialMotion as the UI. Reading and pointer activation consume real time; travel advances only by actual eventElapsed TICK increments before the reached entrance is selected.',
 'Spatial obstacle misses use the existing obstacleMiss probability: initially point straight toward the selected entrance, then spend actual collisionRecovery time before routing around a blocked obstacle. No synthetic collision penalty is added.',
 'Hongqiao escalator entrances expose clear/steady/blocked queues before entry: choose the least congested visible entrance, with the unchanged choiceError probability. Other stations retain their prior unseen-escalator input policy.',
 'Roadside temptation probabilities still match v3; v4/v5 limited optional hotspots to Hongqiao, while v6 uses the actual visible notice at all six stations. Current notice identity and event revision are used so a late action cannot accept a later activity.',
 'Input model v3 models emotional distractions, repeated company demands, visible sign/ask maze choices and parent outburst handling. Historical v2 games used the earlier journeys and input policy.',
 'Input model v2 includes visible date-check mistakes for the revised old-ticket task. Historical v1 baselines retain the earlier forced-cost task and input policy.',
 'Profiles share game seeds and preparation plans, with keyed input noise independent of mode/skill.',
 'Within one mode, skill profiles are paired on the same game. Normal/extreme share seeds but the game may consume RNG differently.',
 'No time injection, synthetic penalties, forced outcomes or resampling after losses. Current game uses default spawn.',
 'Student pockets follow visible hints; unknown queues use visible people counts. Student observation consumes its actual hold time.',
 'Prepared/lean are sensitivity plans, not a population distribution. Input profiles are explicit assumptions, not measured human cohorts.'
]}));

for(let sample=offset;sample<offset+samples;sample++)for(const station of stations)for(const who of characters)for(const mode of modes)for(const plan of plans)for(const skill of skills){
 const gameSeed=(seedBase^Math.imul(sample+1,0x85ebca6b))>>>0,p=profiles[skill];
 let seed=gameSeed;const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const key=[sample,station,who,mode,plan,skill].join(':');
 let s=createCharacterStationRun(station,who,mode==='extreme',rng);
 const finished=()=>s.phase==='result';
 const initial=s.initial,spawn=s.spawn;
 const random=(name:string)=>noise(gameSeed,station+':'+who+':'+plan+':'+name);
 const jitter=(seconds:number,name:string)=>seconds*(.8+.4*random(name));
 const runner=()=>s.student?.runner??s.characterTime?.runner??s.parent!.runner;
 const visits=new Map<string,number>(),arrivals=new Map<number,number>(),failedItems=new Set<string>();
 const preparation:{id:string;option:string;seconds:number}[]=[],choices:{event:string;option:string;seconds:number;deviation:boolean}[]=[],timeouts:{event:string;phase:string;penalty:number}[]=[];
 const spatialOperations:{event:string;intendedChoice:number;reachedChoice:number|null;seconds:number;obstacleCorrections:number}[]=[];
 const roadsideInteractions:{event:string;accepted:boolean;stopped:boolean}[]=[];
 const roadsideConsidered=new Set<string>();
 const mistakes:{kind:string;event:string;option?:string}[]=[];
 let transitions=0,sprintSeconds=0,movingSeconds=0,collisionSeconds=0,readSeconds=0,operationSeconds=0,identityAttempts=0,collisions=0,endPhase='',endEvent='',directionTried=false;
 let studentRecovering=false,parentRegrouping=false,sprintBurst=0,doorConsidered=-1,metroBoardAttempts=0;
 let waveKey='',waveVisibleAt=0,waveMissed=false;
 let routeInfo:{id:string;rank:number;seconds:number;lines:string[]}|null=null;
 let alarm:{reaction:number;success:boolean;extraSeconds:number}|null=null;

 function check(){
  const bound=(name:string,value:number,cap:number)=>{if(!Number.isFinite(value)||!Number.isFinite(cap)||value<0||value>cap+1e-8)throw Error(JSON.stringify({key,name,value,cap}));};
  if(!Number.isFinite(s.remaining))throw Error('Invalid clock '+key);
  if(s.student){for(const [name,value] of Object.entries(s.student.stats))bound(name,value,100);bound('stamina',s.student.stamina,s.student.stats.energy);bound('happiness',s.student.happiness,100);bound('morality',s.student.morality,100);}
  if(s.characterTime){const t=s.characterTime;bound('energy',t.energy,t.maxEnergy);bound('reserve',t.energyReserve??0,10);for(const k of ['fatigue','focus','load'] as const)bound(k,t[k],100);}
  if(s.parent){const q=s.parent;bound('energy',q.energy,q.maxEnergy);for(const k of ['childEnergy','patience','toilet','anger'] as const)bound(k,q[k],100);for(const k of ['snacks','water'] as const)if(!Number.isInteger(q[k])||q[k]<0)throw Error('Invalid inventory '+key);}
 }
 function act(action:Action){
  if(s.phase==='result')return;
  const before=s;s=reducer(s,action);transitions++;check();
  collisions+=Math.max(0,runner().collisions-(before.student?.runner??before.characterTime?.runner??before.parent!.runner).collisions);
  const added=s.logs.slice(before.logs.length),automatic=action.type==='TICK'&&added.some(l=>/仍需完成|没来得及|闹钟没叫醒|找太久|钱包终于/.test(l.title));
  if(before.event&&(!before.eventOverdue&&s.eventOverdue||automatic))timeouts.push({event:before.event.id,phase:before.phase,penalty:round(added.reduce((sum,l)=>sum+l.seconds,0))});
  if(s.phase==='result'){endPhase=before.phase;endEvent=s.endEventId??before.event?.id??before.stationJourney[before.stationBeat]?.id??'none';}
 }
 function tick(seconds:number,eventId?:string,category?:'read'|'operation'|'collision'){
  while(seconds>1e-8&&s.phase!=='result'&&(!eventId||s.event?.id===eventId)){
   const dt=Math.min(.1,seconds),before=s.elapsed;
   const moving=s.phase==='station'&&s.stationRunning&&!s.event&&!runner().blocked;
   const sprinting=(s.student??s.characterTime??s.parent!).sprinting;
   act({type:'TICK',dt});const actual=s.elapsed-before;
   if(moving)movingSeconds+=actual;if(moving&&sprinting)sprintSeconds+=actual;
   if(category==='read')readSeconds+=actual;if(category==='operation')operationSeconds+=actual;if(category==='collision')collisionSeconds+=actual;
   seconds-=dt;
  }
 }
 function choose(c:Choice,deviation=false){
  if(!s.event)return;choices.push({event:s.event.id,option:c.id??c.label,seconds:c.seconds,deviation});
  if(deviation)mistakes.push({kind:'choice',event:s.event.id,option:c.id??c.label});
  act({type:'CHOICE',choice:c,eventRevision:s.event.revision});
 }
 function walkSpatialScene(scene:SpatialScene,intendedChoice:number,eventKey:string):number|null{
  const id=s.event!.id,started=s.elapsed;
  let position=scene.start,path=planSpatialPath(scene,intendedChoice),waypoint=0,obstacleCorrections=0,reachedChoice:number|null=null;
  const exit=scene.exits.find(candidate=>candidate.choiceIndex===intendedChoice);
  if(!exit||!path.length)throw Error('Missing spatial route '+key+':'+id+':'+intendedChoice);
  // An imprecise initial input attempts a direct line through the visible space;
  // the shared collision geometry, rather than an invented time fee, stops it.
  let direct=scene.obstacles.length>0&&random(eventKey+':spatial-obstacle-miss')<p.obstacleMiss;
  const destination=path[path.length-1];
  tick(p.tap,id,'operation');
  for(let frame=0;frame<1200&&s.event?.id===id&&!finished();frame++){
   const target=direct?destination:path[waypoint];
   if(!target)throw Error('Spatial route ended without entrance '+key+':'+id);
   const before=s.eventElapsed;tick(.05,id,'operation');
   if(s.event?.id!==id||finished())break;
   const actual=s.eventElapsed-before;
   const moved=advanceSpatialMotion(scene,position,{target},actual);position=moved.position;
   if(moved.choiceIndex!==null){reachedChoice=moved.choiceIndex;break;}
   if(moved.blocked){
    if(!direct)throw Error('Planned spatial path blocked '+key+':'+id+':'+JSON.stringify(position));
    obstacleCorrections++;mistakes.push({kind:'spatial-obstacle',event:id});
    tick(jitter(p.collisionRecovery,eventKey+':spatial-recovery'),id,'operation');
    direct=false;path=planSpatialPath({...scene,start:position},intendedChoice);waypoint=0;
    if(!path.length)throw Error('No spatial correction path '+key+':'+id);
   }else if(!direct&&Math.hypot(position.x-target.x,position.y-target.y)<.01)waypoint++;
  }
  spatialOperations.push({event:id,intendedChoice,reachedChoice,seconds:round(s.elapsed-started),obstacleCorrections});
  if(reachedChoice===null&&s.event?.id===id&&!finished())throw Error('Spatial traversal stuck '+key+':'+id);
  return reachedChoice;
 }
 act({type:'START'});
 while(s.phase==='preparation'){
  const step=s.student?.prep??s.characterTime?.prepStep??s.parent!.prepStep;
  tick(jitter(p.read,'prep:'+step),undefined,'read');if(finished())break;
  if(s.student){
   const prep=PREPARATIONS[step];const id=plan==='lean'?'skip':prep.id==='tea'?(plan==='prepared'?'buy':'skip'):prep.id==='id'?'check':'eat';
   const c=prep.options.find(c=>c.id===id)!;preparation.push({id:prep.id,option:id,seconds:c.seconds});act({type:'PREP_PICK',step,option:id});
  }else if(s.characterTime){
   const prompt=timedPrompt(s)!;
   const ids=who==='worker'?(plan==='lean'?['leave-gifts','leave','ignore']:plan==='prepared'?['take-gifts','eat','reply']:['leave-gifts','eat','reply']):(plan==='lean'?['go','light']:plan==='prepared'?['coffee','keep']:['coffee','light']);
   const c=prompt.choices.find(c=>c.id===ids[step])!;preparation.push({id:who+'-prep-'+step,option:c.id,seconds:c.seconds});act({type:'PERSON_PICK',step,option:c.id});
  }else{
   const id=step===0?(plan==='lean'?'toilet-skip':'toilet-first'):(plan==='lean'?'snacks-skip':'snacks-pack');
   preparation.push({id:'parent-prep-'+step,option:id,seconds:id==='toilet-first'?60:0});act({type:'PARENT_PREP',step,option:id});
  }
 }
 if(s.phase==='route'){
  tick(jitter(p.read,'route'),undefined,'read');
  if(s.phase==='route'){
   const sorted=[...s.city.spawnStations[s.spawn].routes].sort((a,b)=>journeyRouteSeconds(s,a)-journeyRouteSeconds(s,b));
   const route=sorted[0];routeInfo={id:route.id,rank:0,seconds:journeyRouteSeconds(s,route),lines:route.lines};act({type:'ROUTE',route});
  }
 }

 for(let iterations=0;iterations<30000&&s.phase!=='result';iterations++){
  if(s.phase==='direction'&&!s.event){
   tick(jitter(p.read,'direction:'+Number(directionTried)),undefined,'read');
   if(s.phase==='direction'){
    const wrong=!directionTried&&random('direction-error')<p.choiceError;directionTried=true;
    if(wrong)mistakes.push({kind:'direction',event:'metro-direction'});
    act({type:'DIRECTION',correct:!wrong});
   }
  }else if(s.phase==='metro-platform'&&!s.event){
   const visit=s.metroBranch!.platformVisit;
   tick(jitter(p.read,'metro-platform:'+visit),undefined,'read');
   tick(p.tap,undefined,'operation');
   if(s.phase!=='metro-platform'||s.metroBranch?.platformVisit!==visit)continue;
   const wrong=metroBoardAttempts++===0&&random('metro-branch-board-error')<p.choiceError;
   const terminal:MetroTerminal=wrong?'hangzhong':'hongqiao',choice=metroBoardingChoice(s,terminal);
   if(!choice)throw Error('Missing visible metro boarding choice '+key);
   choices.push({event:'metro-platform',option:terminal,seconds:choice.seconds,deviation:wrong});
   if(wrong)mistakes.push({kind:'wrong-branch-train',event:'metro-platform',option:terminal});
   act({type:'BOARD_METRO',terminal,visit});
  }else if(s.event){
   const id=s.event.id,visit=visits.get(id)??0;visits.set(id,visit+1);const eventKey=id+':'+visit;sprintBurst=0;
   if(id==='tourist-wake'){
    const reaction=Math.max(0,p.alarm+(random('alarm')*2-1)*p.alarmJitter),beforeLogs=s.logs.length;
    tick(reaction,id,'read');tick(p.tap,id,'operation');
    const awake=s.event?.id===id;if(awake)choose(s.event!.choices[0]);
    alarm={reaction:round(reaction+p.tap),success:awake,extraSeconds:s.logs.slice(beforeLogs).reduce((sum,l)=>sum+l.seconds,0)};
    continue;
   }
   tick(jitter(p.read,eventKey+':read'),id,'read');if(finished()||s.event?.id!==id)continue;
   if(id==='tourist-maze'&&s.touristMaze){
    const known=s.touristMaze.known.includes(s.touristMaze.node);
    let option:string;
    if(!known&&random(eventKey+':confirm')<p.mazeInfo)option=random(eventKey+':ask')<.25?'ask':'sign';
    else if(known){option=s.event.description.includes('往左')?'left':'right';if(random(eventKey+':maze-error')<p.choiceError)option=option==='left'?'right':'left';}
    else option=random(eventKey+':guess')<.5?'left':'right';
    const selected=s.event.choices.find(c=>c.id===option)!;tick(p.tap,id,'operation');
    if(s.event?.id===id)choose(selected,!!selected.stationDecision&&!selected.stationDecision.optimal);
    continue;
   }
   if(id==='identity-search'){
    if(s.student){
     const u=s.student,hint=bagHint(u);let candidates=[0,1,2,3].filter(i=>!u.searched.includes(i));
     if(u.checkedID)candidates=[0];
     else if(hint.includes('外侧小袋'))candidates=candidates.filter(i=>i<2);
     else if(hint.includes('大件物品'))candidates=candidates.filter(i=>i>=2);
     const pocket=candidates.sort((a,b)=>random('pocket-order:'+a)-random('pocket-order:'+b))[0];
     if(pocket===undefined)throw Error('No unsearched visible pocket '+key);
     tick(p.tap,id,'operation');tick((u.checkedID?.65:1.4)/focusWindow(u.stats.focus)*(u.tea?1.25:1),id,'operation');
     if(s.event?.id===id){identityAttempts++;act({type:'POCKET_PICK',pocket});}
    }else{
     const stage=s.identityStage,expected=stage==='wallet'?'wallet':'id',items=stage==='wallet'?s.identityItems:s.identityCards;
     const slip=!failedItems.has(stage)&&random('identity-error:'+stage)<p.choiceError;
     const selected=slip?items.find(item=>item!==expected)!:expected;
     tick(jitter(p.search,eventKey+':search')+p.tap,id,'operation');
     // A metro timeout may itself find the wallet and change the visible task.
     if(s.event?.id===id&&s.identityStage===stage){identityAttempts++;if(slip){failedItems.add(stage);mistakes.push({kind:'identity',event:id,option:selected});}act({type:'ID_PICK',item:selected});}
    }
    continue;
   }
   if(id==='security-queue'&&s.student&&!s.student.observed&&s.student.stats.focus<75&&random(eventKey+':observe')<p.observe){
    tick(2.5/focusWindow(s.student.stats.focus),id,'operation');if(s.event?.id===id)act({type:'OBSERVE'});
   }
   if(finished()||s.event?.id!==id)continue;
   const e=s.event,spatialScene=buildSpatialScene(s);let index=0;
   if(id.startsWith('student-')&&e.choices.some(c=>c.id==='indulge'))index=e.choices.findIndex(c=>c.id===(s.roadsideActive===id||random(eventKey+':temptation')<p.distraction?'indulge':'leave'));
   else if(id==='parent-rage')index=e.choices.findIndex(c=>c.id===(random(eventKey+':lecture')<p.lecture?'lecture':'breathe'));
   else if(id==='tourist-sleep')index=Math.max(0,e.choices.findIndex(c=>c.id==='alarm-2'));
   else if(id==='vertical-choice'){
    const energy=s.student?.stamina??s.characterTime?.energy??s.parent!.energy;
    const label=energy>=30?'楼梯':'电梯';index=Math.max(0,e.choices.findIndex(c=>c.label.includes(label)));
   }else if(id==='security-queue'){
    const visibleFast=e.choices.findIndex(c=>/轻装|推进快|推进很快/.test(c.detail));
    index=visibleFast>=0?visibleFast:e.choices.reduce((best,c,i)=>(Number(c.label.match(/(\d+) 人/)?.[1])||Infinity)<(Number(e.choices[best].label.match(/(\d+) 人/)?.[1])||Infinity)?i:best,0);
   }else if(id==='gates')index=e.choices.reduce((best,c,i)=>c.seconds<e.choices[best].seconds?i:best,0);
   else if(id==='zz-number')index=Math.max(0,e.choices.findIndex(c=>c.label===s.gate));
   else if(id==='escalator-choice'){
    if(spatialScene){const rank={clear:0,steady:1,blocked:2};index=[...spatialScene.exits].sort((a,b)=>(rank[a.status??'blocked']-rank[b.status??'blocked'])||a.choiceIndex-b.choiceIndex)[0].choiceIndex;}
    else index=Math.floor(random('escalator-lane')*e.choices.length);
   }
   let deviation=false;
   if((navigation.has(id)||id==='security-queue'||id==='gates'||id.startsWith('worker-company')||spatialScene&&id==='escalator-choice')&&visit===0&&e.choices.length>1&&random(eventKey+':choice-error')<p.choiceError){
    const alternatives=e.choices.map((_,i)=>i).filter(i=>i!==index);index=alternatives[Math.floor(random(eventKey+':wrong-option')*alternatives.length)];deviation=true;
   }
   const selected=e.choices[index];
   if(spatialScene){
    const reached=walkSpatialScene(spatialScene,index,eventKey);
    if(reached!==null&&s.event?.id===id)choose(s.event.choices[reached],deviation||reached!==index);
    continue;
   }
   const operation=e.interaction?.kind==='hold'?eventHoldSeconds(s,e):e.interaction?.kind==='tap'?(e.interaction.required??5)*p.tap:e.interaction?.kind==='swipe'?p.swipe:p.tap;
   tick(operation,id,'operation');if(s.event?.id===id)choose(selected,deviation);
  }else if(s.phase==='arrival'){
   const stop=s.metroStopIndex,visit=arrivals.get(stop)??0;arrivals.set(stop,visit+1);
   tick(jitter(p.arrival,'arrival:'+stop+':'+visit),undefined,'read');if(s.phase!=='arrival'||s.event)continue;
   const target=needsMetroBranchExit(s)||stop===s.route!.stops.length-1||(!s.metroTransferred&&s.route!.stops[stop]===s.route!.via);
   const wrong=visit===0&&random('stop-error:'+stop)<p.choiceError;
   if(wrong)mistakes.push({kind:target?'missed-stop':'early-exit',event:'metro-stop-'+stop});
   act({type:target!==wrong?'ALIGHT':'CONTINUE_METRO'});
  }else if(s.phase==='station'){
   const roadside=roadsidePrompt(s);
   if(roadside&&!roadsideConsidered.has(roadside.id)){
    roadsideConsidered.add(roadside.id);
    const accepted=random(roadside.id+':0:temptation')<p.distraction;
    if(accepted){
     tick(p.tap,undefined,'operation');
     if(roadsidePrompt(s)?.id===roadside.id)act({type:'ROADSIDE_STOP',id:roadside.id,revision:roadside.revision!});
    }
    roadsideInteractions.push({event:roadside.id,accepted,stopped:s.roadsideActive===roadside.id});
    if(finished()||s.event)continue;
   }
   const r=runner(),w=runnerWave(s);
   if(r.blocked){
    tick(jitter(p.collisionRecovery,'collision:'+s.stationBeat+':'+r.wave),undefined,'collision');
    if(s.phase==='station'&&!s.event&&runner().blocked)act({type:'CHANGE_LANE',direction:runner().lane===2?-1:1});
    continue;
   }
   if(w){
    const current=s.stationBeat+':'+r.wave;
    if(current!==waveKey){waveKey=current;waveVisibleAt=s.elapsed;waveMissed=random('wave-miss:'+current)<p.obstacleMiss;}
    if(w.lane===r.lane&&!waveMissed&&s.elapsed-waveVisibleAt>=jitter(p.obstacleReaction,'wave-reaction:'+current))act({type:'CHANGE_LANE',direction:r.lane===2?-1:1});
   }
   if(!s.stationRunning)act({type:'RUN_INPUT',held:true});
   if(locomotion==='sprint'){
    const state=s.student??s.characterTime??s.parent!,energy=s.student?.stamina??s.characterTime?.energy??s.parent!.energy,cap=s.student?.stats.energy??s.characterTime?.maxEnergy??s.parent!.maxEnergy;
    let desired=state.sprinting?energy>cap*sprintStop:energy>=cap*sprintStart;
    if(s.student){if(s.student.sprintStrain>=4||sprintBurst>=4)studentRecovering=true;else if(s.student.sprintStrain<=1)studentRecovering=false;if(studentRecovering)desired=false;}
    if(s.parent){if(s.parent.gap>=4)parentRegrouping=true;else if(s.parent.gap<=2)parentRegrouping=false;if(parentRegrouping||s.parent.toilet>=80)desired=false;}
    if(desired!==state.sprinting)act({type:'SPRINT_INPUT',held:desired});
   }
   sprintBurst=(s.student??s.characterTime??s.parent!).sprinting?sprintBurst+.1:0;tick(.1);
  }else{
   if(s.student&&s.phase==='metro'&&doorConsidered!==s.metroStopIndex){
    doorConsidered=s.metroStopIndex;
    if(random('prepare-door:'+doorConsidered)>=p.choiceError)act({type:'PREPARE_DOOR'});
   }
   tick(.1);
  }
 }
 if(s.phase!=='result')throw Error('Traversal stuck '+key+':'+s.phase+':'+s.event?.id);
 const gateMargin=s.gatePassed?round(s.gateRemaining):null;
 const close=s.success&&gateMargin!==null&&gateMargin<=closeMargin;
 rows.push({who,station,mode,skill,plan,success:s.success,gateMargin,close});totalTransitions+=transitions;
 console.log(JSON.stringify({type:'game',sample,seed:gameSeed,station,who,mode,skill,plan,locomotion,spawn,initial,success:s.success,remaining:round(s.remaining),gatePassed:s.gatePassed,gateMargin,departureMargin:s.success?round(s.remaining):null,estimatedResultMargin:round(s.remaining-(s.gatePassed?0:STOP_BEFORE)-secondsToGoal(s)),close,endPhase,endEvent,preparation,route:routeInfo,choices,mistakes,identityAttempts,collisions,collisionSeconds:round(collisionSeconds),spatialOperations,roadsideInteractions,timeouts,alarm,metroMisses:s.metroMisses,metroBranch:s.metroBranch,distractions:s.student?.distractions,distractionSeconds:s.student?.distractionSeconds,workInterruptions:s.characterTime?.workInterruptions,maze:s.touristMaze,parentAnger:s.parent?.anger,parentOutbursts:s.parent?.outbursts,sprintSeconds:round(sprintSeconds),movingSeconds:round(movingSeconds),readSeconds:round(readSeconds),operationSeconds:round(operationSeconds),transitions}));
}
const quantile=(values:number[],fraction:number)=>values.length?round([...values].sort((a,b)=>a-b)[Math.floor((values.length-1)*fraction)]):null;
const cells=[];
for(const who of characters)for(const mode of modes)for(const skill of skills)for(const plan of plans){
 const selected=rows.filter(r=>r.who===who&&r.mode===mode&&r.skill===skill&&r.plan===plan),won=selected.filter(r=>r.success),margins=won.flatMap(r=>r.gateMargin===null?[]:[r.gateMargin]);
 cells.push({who,mode,skill,plan,total:selected.length,wins:won.length,successRate:round(won.length/selected.length),closeWins:won.filter(r=>r.close).length,gateMarginP10:quantile(margins,.1),gateMarginMedian:quantile(margins,.5),gateMarginP90:quantile(margins,.9)});
}
console.log(JSON.stringify({type:'summary',finished:rows.length,wins:rows.filter(r=>r.success).length,losses:rows.filter(r=>!r.success).length,transitions:totalTransitions,resourceBounds:'passed',cells}));
