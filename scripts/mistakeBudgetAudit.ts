import {BALANCE} from '../src/balanceConfig';
import {NORMAL_REFERENCE,type BudgetCharacter} from '../src/referenceBudgets';
import {buildReferenceTimeBudget} from '../src/timeBudget';
import {simulateBalance} from './simulateBalance';
import {REFERENCE_PLAYER} from './referencePlayer';

const samples=32,errors:string[]=[],groups=[];
for(const role of Object.keys(NORMAL_REFERENCE) as BudgetCharacter[])for(const [city,reference] of Object.entries(NORMAL_REFERENCE[role])){
 const budget=buildReferenceTimeBudget(city,role,false,180),rows=[];
 for(let i=0;i<samples;i++){
  const seed=921+i*83;
  // Real opening budget: override the offline reference's measurement extension.
  const run=simulateBalance({city,character:role,reference:true,budgetAdjustment:0,seed});
  const gateSpent=run.timeLedger.entries.filter(e=>e.deadline==='gate').reduce((sum,e)=>sum+e.seconds,0);
  const ledgerError=Math.abs(run.initial-run.remaining-run.timeLedger.totalSeconds);
  if(!run.success||!run.gatePassed)errors.push(`${role}/${city}/${seed}: reference failed real deadline`);
  if(ledgerError>.001||Math.abs(budget.gateBudgetSeconds-gateSpent-run.gateRemaining)>.001)errors.push(`${role}/${city}/${seed}: ledger mismatch`);
  if(run.initial!==budget.departureBudgetSeconds)errors.push(`${role}/${city}/${seed}: unexpected budget adjustment`);
  rows.push({seed,success:run.success,gateSpent,gateMargin:run.gateRemaining,operations:run.metrics.operations.length,ledgerError});
 }
 const margins=rows.map(r=>r.gateMargin);
 groups.push({role,city,reference,normalRequiredSeconds:Object.values(reference).reduce((a,b)=>a+b,0),errorBudgetSeconds:BALANCE.errorBudgetSeconds[role],openingSeconds:budget.gateBudgetSeconds,hardOpeningSeconds:buildReferenceTimeBudget(city,role,true,180).gateBudgetSeconds,roundingSeconds:budget.roundingAdjustmentSeconds,completed:rows.filter(r=>r.success).length,total:rows.length,meanGateMargin:margins.reduce((a,b)=>a+b,0)/samples,minGateMargin:Math.min(...margins),maxGateMargin:Math.max(...margins),rows});
}
console.log(JSON.stringify({metadata:{referenceSource:process.env.REFERENCE_SOURCE??'docs/design/preparation-reference-report.json',sourceRevision:process.env.TIME_AUDIT_REV??'working-tree',policy:REFERENCE_PLAYER,measurementExtensionApplied:0,samplesPerRoleAndStation:samples,actualRuns:groups.reduce((sum,g)=>sum+g.total,0),errorBudgetSeconds:BALANCE.errorBudgetSeconds,note:'Real-deadline validation of one declared reference policy; not human success rates. Hard budgets retain previous reductions and are audited separately.'},errors,groups},(_key,value)=>typeof value==='number'?Math.round(value*1000)/1000:value,2));
if(errors.length)process.exitCode=1;
