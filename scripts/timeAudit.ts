import {STOP_BEFORE,createCharacterStationRun,journeyRouteSeconds} from '../src/engine';
import {STATIONS} from '../src/stations';
import {simulateBalance,type BalanceCharacter,type BalanceOptions} from './simulateBalance';

// This is a deterministic accounting audit. The driver knows routes and queues;
// these outcomes must not be presented as first-play or human success rates.
// Run with: vite-node scripts/timeAudit.ts [--seeds=921,1004,1087]
const details=process.argv.includes('--details');
const seedArg=process.argv.find(arg=>arg.startsWith('--seeds='));
const seeds=(seedArg?seedArg.slice('--seeds='.length).split(','):['921']).map(Number);
if(!seeds.length||seeds.some(seed=>!Number.isSafeInteger(seed)))throw Error('Use integer seeds, e.g. --seeds=921,1004,1087');
const characters:BalanceCharacter[]=['student','worker','tourist','mom'];
const rushedPreparation:Record<BalanceCharacter,string[]>={student:['skip','skip','skip'],worker:['leave-gifts','leave','ignore'],tourist:['go','light'],mom:['toilet-skip','snacks-skip']};
const scenarios=[
 {id:'prepared-paced',name:'默认准备／分段冲刺',policy:'paced'},
 {id:'prepared-walk',name:'默认准备／全程步行',policy:'walk'},
 {id:'prepared-sprint',name:'默认准备／持续冲刺',policy:'sprint'},
 {id:'rushed-paced',name:'省时准备／分段冲刺',policy:'paced',rushed:true},
 {id:'one-mistake-paced',name:'默认准备／一次方向误判',policy:'paced',mistakes:1},
] as const;
const round=(value:number)=>Math.round(value*1000)/1000;
const errors:string[]=[];
const budgets:unknown[]=[];
const rows:unknown[]=[];
let clearCount=0,deadlineFailureCount=0,notCompletedCount=0,maxLedgerError=0,maxGateError=0,maxRealError=0,unclassifiedCount=0;
const started=performance.now();
for(const character of characters)for(const station of STATIONS)for(const hard of [false,true])for(const seed of seeds)for(const scenario of scenarios){
 const id=[character,station.id,hard?'hard':'normal',seed,scenario.id].join('/');
 const options:BalanceOptions={city:station.id,character,hard,seed,reading:5,policy:scenario.policy,mistakes:'mistakes' in scenario?scenario.mistakes:0,...'rushed' in scenario?{preparation:rushedPreparation[character]}:{}};
 try{
  const run=simulateBalance(options),ledger=run.timeLedger;
  const spent=run.initial-run.remaining;
  const entriesTotal=ledger.entries.reduce((total,entry)=>total+entry.seconds,0);
  const beforeGate=ledger.entries.filter(entry=>entry.deadline==='gate').reduce((total,entry)=>total+entry.seconds,0);
  const afterGate=ledger.entries.filter(entry=>entry.deadline==='departure').reduce((total,entry)=>total+entry.seconds,0);
  const error=Math.abs(entriesTotal-spent),totalError=Math.abs(ledger.totalSeconds-spent),realError=Math.abs(ledger.realSeconds-run.elapsed);
  const unknown=ledger.entries.some(e=>e.category==='unclassified'&&Math.abs(e.seconds)>.000001);
  if(unknown){unclassifiedCount++;errors.push(id+': unclassified clock adjustment');}
  maxRealError=Math.max(maxRealError,realError);
  const gateError=run.gatePassed?Math.abs((run.initial-STOP_BEFORE-beforeGate)-run.gateRemaining):null;
  const categories:Record<string,number>={};
  for(const entry of ledger.entries)categories[entry.category]=(categories[entry.category]??0)+entry.seconds;
  maxLedgerError=Math.max(maxLedgerError,error,totalError);maxGateError=Math.max(maxGateError,gateError??0);
  if(error>.001||totalError>.001||realError>.001||(gateError??0)>.001)errors.push(id+': countdown/ledger mismatch');
  if(run.success)clearCount++;else deadlineFailureCount++;
  if(scenario.id==='prepared-paced'&&seed===seeds[0]){
   const start=createCharacterStationRun(station.id,character,hard,()=>.6);
   const actualInitialMetro=Math.min(...start.city.spawnStations[start.spawn].routes.map(route=>journeyRouteSeconds(start,route)));
   budgets.push({character,station:station.id,stationName:station.name,difficulty:hard?'hard':'normal',visibleGateBudget:round(run.initial-STOP_BEFORE),internalDepartureBudget:round(run.initial),breakdown:run.timeBudget,actualInitialMetro:round(actualInitialMetro),legacyMetroOverAllocation:round(run.timeBudget!.metroSeconds-actualInitialMetro)});
  }
  rows.push({id,character,station:station.id,difficulty:hard?'hard':'normal',seed,scenario:scenario.id,readingSeconds:5,preparation:options.preparation??'driver-default',result:run.success?'cleared':'deadline-failure',clippedByDeadline:!run.success,notCompleted:false,initialGateBudget:round(run.initial-STOP_BEFORE),initialInternalBudget:round(run.initial),remainingInternal:round(run.remaining),selectedMetroBudget:run.metroTimeBudget,actualSpent:round(spent),accounted:round(entriesTotal),ledgerTotal:round(ledger.totalSeconds),ledgerError:round(error),ledgerTotalError:round(totalError),beforeGate:round(beforeGate),afterGate:round(afterGate),gateMargin:run.gatePassed?round(run.gateRemaining):null,gateLedgerError:gateError===null?null:round(gateError),elapsedRealSeconds:round(run.elapsed),ledgerRealSeconds:round(ledger.realSeconds),operations:run.metrics.operations.length,breathStops:run.student?.breathStops??0,actualNavigationMistakes:run.stationDecisions.filter(decision=>decision.category==='navigation'&&!decision.optimal).length,categories:Object.fromEntries(Object.entries(categories).map(([category,seconds])=>[category,round(seconds)])),...(details?{entries:ledger.entries.map(entry=>({...entry,seconds:round(entry.seconds)}))}:{})});
 }catch(error){
  notCompletedCount++;errors.push(id+': '+String(error));
  rows.push({id,character,station:station.id,difficulty:hard?'hard':'normal',seed,scenario:scenario.id,result:'driver-error',clippedByDeadline:false,notCompleted:true,error:String(error)});
 }
}
console.log(JSON.stringify({
 metadata:{generatedAt:new Date().toISOString(),sourceRevision:process.env.TIME_AUDIT_REV??null,seeds,characters,stations:STATIONS.map(station=>station.id),difficulties:['normal','hard'],readingSeconds:5,scenarios,expectedCases:characters.length*STATIONS.length*2*seeds.length*scenarios.length,wallSeconds:round((performance.now()-started)/1000),note:'Known-answer driver; paced means 4 real seconds sprint then 3 real seconds walk subject to stamina/strain. Failed runs stop at their deadline, so their spent time is not a complete-route cost. Counts are accounting scenarios, not human success rates.'},
 summary:{cases:rows.length,cleared:clearCount,deadlineFailures:deadlineFailureCount,notCompleted:notCompletedCount,maxLedgerError:round(maxLedgerError),maxGateLedgerError:round(maxGateError),maxRealSecondsError:round(maxRealError),unclassifiedCount,errors},
 initialBudgets:budgets,
 rows,
},null,2));
if(errors.length)process.exitCode=1;
