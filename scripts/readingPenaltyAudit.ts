import {simulateBalance,type BalanceCharacter} from './simulateBalance';
import {STATIONS} from '../src/stations';
import {REFERENCE_PLAYER} from './referencePlayer';

// Isolate the reading-time cliff; this is a ledger diagnosis, not a pass-rate test.
const rows=[];
for(const role of ['student','worker','tourist','mom'] as BalanceCharacter[])for(const station of STATIONS){
 const runs=[5,8].map(reading=>{
  const s=simulateBalance({city:station.id,character:role,seed:921,reference:true,reading,budgetAdjustment:REFERENCE_PLAYER.measurementAllowance});
  if(!s.success||Math.abs(s.initial-s.remaining-s.timeLedger.totalSeconds)>.001)throw Error('Incomplete or unreconciled reading scenario');
  const entries=s.timeLedger.entries.filter(e=>e.deadline==='gate');
  return {reading,gateSeconds:entries.reduce((sum,e)=>sum+e.seconds,0),penalties:entries.filter(e=>e.category==='operationPenalty'),interactionSeconds:entries.filter(e=>e.category==='interaction').reduce((sum,e)=>sum+e.seconds,0)};
 });
 rows.push({role,station:station.id,extraSeconds:runs[1].gateSeconds-runs[0].gateSeconds,extraOperationPenalty:runs[1].penalties.reduce((sum,e)=>sum+e.seconds,0)-runs[0].penalties.reduce((sum,e)=>sum+e.seconds,0),runs});
}
console.log(JSON.stringify({metadata:{baseRevision:'81f1c20',seed:921,runCount:48,note:'Extended deadline, reference preparation and movement, 5 versus 8 seconds per new prompt. Source-level ledger diagnosis, not human pass probability.'},rows},(_key,value)=>typeof value==='number'?Math.round(value*1000)/1000:value,2));
