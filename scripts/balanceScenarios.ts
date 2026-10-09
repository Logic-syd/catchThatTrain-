import {simulateBalance,balanceSummary,type BalanceOptions} from './simulateBalance';
// Same seeds and reading time for paired preparation/risk comparisons.
const cases:({name:string}&BalanceOptions)[]=[
 {name:'student-prepared',city:'shanghai',preparation:['skip','check','eat']},
 {name:'student-unchecked',city:'shanghai',preparation:['skip','skip','eat']},
 {name:'student-hungry',city:'shanghai',preparation:['skip','check','skip']},
 {name:'student-cake',city:'shanghai',preparation:['take','check','eat']},
 {name:'worker-fed',city:'shanghai',character:'worker',preparation:['take-gifts','eat','reply']},
 {name:'worker-no-meal',city:'shanghai',character:'worker',preparation:['take-gifts','leave','reply']},
 {name:'tourist-coffee',city:'guangzhou',character:'tourist',preparation:['coffee','keep']},
 {name:'tourist-no-coffee',city:'guangzhou',character:'tourist',preparation:['go','keep']},
 {name:'parent-prepared',city:'guangzhou',character:'mom',preparation:['toilet-first','snacks-pack']},
 {name:'parent-no-toilet',city:'guangzhou',character:'mom',preparation:['toilet-skip','snacks-pack']},
];
const samples=Number(process.env.BALANCE_SAMPLES??8);
if(!Number.isInteger(samples)||samples<1||samples>100)throw Error('BALANCE_SAMPLES must be an integer from 1 to 100');
const rows=cases.map(c=>({name:c.name,runs:Array.from({length:samples},(_,i)=>{
 const s=simulateBalance({...c,policy:'paced',reading:5,seed:921+i*83});
 return {...balanceSummary(s),bagMistakes:s.student?.bagMistakes??null,toiletVisits:s.parent?.toiletVisits??null};
})}));
console.log(JSON.stringify({scenario:{samples,reading:5,seed:921,seedStep:83,policy:'paced'},rows},null,2));
