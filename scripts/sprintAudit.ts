import {simulateBalance,type BalanceCharacter,type BalancePolicy} from './simulateBalance';
import {STATIONS} from '../src/stations';
import {SPRINT} from '../src/sprintConfig';
import {BALANCE} from '../src/balanceConfig';
const rows=[],stress=[],errors:string[]=[];
for(const role of ['student','worker','tourist','mom'] as BalanceCharacter[])for(const station of STATIONS)for(const policy of ['reference','walk','paced','sprint'] as const){
 const runs=[];
 for(let i=0;i<8;i++){
  const seed=921+i*83;
  const run=simulateBalance({city:station.id,character:role,reference:true,policy:policy==='reference'?undefined:policy as BalancePolicy,seed});
  const gate=run.timeLedger.entries.filter(e=>e.deadline==='gate');
  runs.push({seed,gateSeconds:gate.reduce((s,e)=>s+e.seconds,0),movingSeconds:gate.filter(e=>e.category==='stationMovement').reduce((s,e)=>s+e.seconds,0),breathStops:run.student?.breathStops??0});
  if(!run.success)errors.push(`${role}/${station.id}/${policy}/${seed}: extended measurement incomplete`);
 }
 const mean=(key:keyof typeof runs[number])=>runs.reduce((s,r)=>s+r[key],0)/runs.length;
 rows.push({role,station:station.id,policy,meanGateSeconds:mean('gateSeconds'),meanMovingSeconds:mean('movingSeconds'),meanBreathStops:mean('breathStops'),runs});
}
for(const station of STATIONS)for(const preparation of [['skip','check','eat'],['skip','skip','skip']])for(let i=0;i<32;i++){
 const seed=921+i*83;
 const run=simulateBalance({city:station.id,reference:true,policy:'sprint',budgetAdjustment:0,reading:0,seed,preparation});
 stress.push({station:station.id,seed,preparation,success:run.success,breathStops:run.student!.breathStops});
 if(run.success)errors.push(`${station.id}/${seed}/${preparation.join(',')}: held sprint passed`);
}
console.log(JSON.stringify({metadata:{configuration:SPRINT,errorBudgetSeconds:BALANCE.errorBudgetSeconds,comparisonRuns:rows.length*8,stressRuns:stress.length,note:'Full-route comparison uses extended deadlines and identical declared choices, 5s reading; paced is 4s sprint/3s walk. Stress uses real deadlines, zero reading and always-held sprint. Scenario results are not human pass rates.'},rows,stress,errors},(_key,value)=>typeof value==='number'?Math.round(value*1000)/1000:value,2));
if(errors.length)process.exitCode=1;
