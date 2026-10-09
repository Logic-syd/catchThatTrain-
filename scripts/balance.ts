import {STATIONS} from '../src/stations';
import {simulateBalance,balanceSummary,type BalanceCharacter,type BalancePolicy} from './simulateBalance';

const numberArg=(name:string,fallback:number)=>{const value=process.argv.find(a=>a.startsWith(name+'='));const n=value?Number(value.slice(name.length+1)):fallback;if(!Number.isFinite(n)||n<0)throw Error('Invalid '+name);return n;};
const detailed=process.argv.includes('--details'),samples=Number(process.env.BALANCE_SAMPLES??8),reading=numberArg('--reading',3),mistakes=numberArg('--mistakes',0),hard=process.argv.includes('--hard');
if(!Number.isInteger(samples)||samples<1||samples>100)throw Error('BALANCE_SAMPLES must be an integer from 1 to 100');
const rows=[];
for(const character of ['student','worker','tourist','mom'] as BalanceCharacter[])for(const st of STATIONS)for(const policy of ['walk','paced','sprint'] as BalancePolicy[]){
 const results=Array.from({length:samples},(_,i)=>balanceSummary(simulateBalance({city:st.id,character,policy,seed:921+i*83,reading,mistakes,hard})));
 const wins=results.filter(r=>r.won),mean=(values:number[])=>Math.round(values.reduce((a,b)=>a+b,0)/Math.max(1,values.length));
 rows.push({character,station:st.id,policy,initialGateBudget:results[0].initialGateBudget,clears:`${wins.length}/${samples}`,gateMargin:wins.length?`${Math.min(...wins.map(r=>r.gateMargin))}–${Math.max(...wins.map(r=>r.gateMargin))}`:'—',meanRealSeconds:mean(results.map(r=>r.realSeconds)),breathStops:mean(results.map(r=>r.breathStops)),ledgerError:results.every(r=>r.ledgerError!==null)?Math.max(...results.map(r=>Math.abs(r.ledgerError!))):null,...(detailed?{runs:results}:{})});
}
console.log(JSON.stringify({scenario:{samples,reading,mistakes,hard,seed:921,seedStep:83,note:'Fixed strategies with known route and queue costs; not real-player win rates.'},rows},null,2));
