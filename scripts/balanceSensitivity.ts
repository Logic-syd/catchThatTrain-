import {simulateBalance,balanceSummary} from './simulateBalance';
// Compare reading time, preparation and mistakes; scenario counts are not human win rates.
const cities=['shanghai','beijing','guangzhou','hangzhou','wuhan','zhengzhou'];
const cases=[
 {name:'baseline',reading:5,mistakes:0,preparation:['skip','check','eat']},
 {name:'read8',reading:8,mistakes:0,preparation:['skip','check','eat']},
 {name:'read8-one-wrong',reading:8,mistakes:1,preparation:['skip','check','eat']},
 {name:'read8-two-wrong',reading:8,mistakes:2,preparation:['skip','check','eat']},
 {name:'read8-skip-all-one-wrong',reading:8,mistakes:1,preparation:['skip','skip','skip']},
 {name:'read12-one-wrong',reading:12,mistakes:1,preparation:['skip','check','eat']},
 {name:'read8-cake-one-wrong',reading:8,mistakes:1,preparation:['take','check','eat']},
];
const rows=[];
for(const adjustment of [0,-30,-45])for(const c of cases)for(const city of cities){
 const runs=Array.from({length:8},(_,i)=>{const s=simulateBalance({...c,city,seed:921+i*83,budgetAdjustment:adjustment});return {...balanceSummary(s),wrongTurns:s.student!.wrongTurns};});
 const wins=runs.filter(r=>r.won);
 rows.push({adjustment,case:c.name,city,clears:wins.length,samples:runs.length,margin:wins.length?[Math.min(...wins.map(r=>r.gateMargin)),Math.max(...wins.map(r=>r.gateMargin))]:null,wrongTurns:[Math.min(...runs.map(r=>r.wrongTurns)),Math.max(...runs.map(r=>r.wrongTurns))]});
}
console.log(JSON.stringify({scenario:{character:'student',samples:8,seed:921,seedStep:83,policy:'paced',adjustments:[0,-30,-45],cases},note:'Scenario sensitivity only; all players know the optimal route/queue and use paced sprinting. Mistake count is an upper limit: some stations have only one eligible direction decision. No empirical human win rate.',rows},null,2));
