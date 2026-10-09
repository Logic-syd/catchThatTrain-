import {STATIONS} from '../src/stations';
import {BALANCE} from '../src/balanceConfig';
import {simulateBalance,balanceSummary} from './simulateBalance';

const rows=[];
for(const character of ['student','worker','tourist','mom'] as const)for(const station of STATIONS)for(const mistakes of [0,1]){
 const runs=Array.from({length:8},(_,i)=>{
  const s=simulateBalance({city:station.id,character,seed:921+i*83,reading:5,mistakes});
  return {...balanceSummary(s),wrongTurns:s.stationDecisions.filter(d=>d.category==='navigation'&&!d.optimal).length};
 });
 const wins=runs.filter(r=>r.won);
 rows.push({character,station:station.id,mistakes,clears:`${wins.length}/8`,minOperationsOnSuccess:wins.length?Math.min(...wins.map(r=>r.operations)):null,maxOperationsOnSuccess:wins.length?Math.max(...wins.map(r=>r.operations)):null,gateMargin:wins.length?[Math.min(...wins.map(r=>r.gateMargin)),Math.max(...wins.map(r=>r.gateMargin))]:null,actualWrongTurns:[Math.min(...runs.map(r=>r.wrongTurns)),Math.max(...runs.map(r=>r.wrongTurns))]});
}
console.log(JSON.stringify({scenario:{date:'2026-10-09',samples:8,reading:5,policy:'paced',seed:921,seedStep:83,minimumOperations:BALANCE.minimumOperations,navigationMistakeMultiplier:BALANCE.navigationMistakeMultiplier,note:'Known routes/queues, prepared characters. Scenario success is not human first-play success.'},rows},null,2));
