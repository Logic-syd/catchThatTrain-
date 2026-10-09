import {simulateBalance,type BalanceOptions,type BalanceCharacter,type BalancePolicy} from './simulateBalance';
import {REFERENCE_PLAYER,referenceEnvironmentSeconds} from './referencePlayer';
import {STATIONS} from '../src/stations';
import type {Run} from '../src/engine';
import type {Choice} from '../src/data';

const samples=Number(process.env.BALANCE_SAMPLES??8);
if(!Number.isInteger(samples)||samples<1||samples>64)throw Error('BALANCE_SAMPLES must be 1..64');
type Case={id:string;group:'preparation'|'route'|'sensitivity'|'resource-stress';role:BalanceCharacter;preparation?:string[];city?:string;reading?:number;mistakes?:number;policy?:BalancePolicy;choose?:BalanceOptions['choose']};
const dimensions:Record<BalanceCharacter,string[][]>={student:[['skip','take'],['check','skip'],['eat','skip']],worker:[['take-gifts','leave-gifts'],['eat','leave'],['reply','ignore']],tourist:[['coffee','rest','go'],['keep','light']],mom:[['toilet-first','toilet-skip'],['snacks-pack','snacks-skip']]};
const product=(ds:string[][]):string[][]=>ds.reduce<string[][]>((a,d)=>a.flatMap(xs=>d.map(x=>[...xs,x])),[[]]);
const cases:Case[]=[];
const roles=Object.keys(dimensions) as BalanceCharacter[];
for(const role of roles){
 for(const preparation of product(dimensions[role]))cases.push({id:preparation.join('/'),group:'preparation',role,preparation});
 for(const reading of [3,8])cases.push({id:'reading-'+reading,group:'sensitivity',role,reading});
 for(const mistakes of [1,2,3])cases.push({id:'navigation-'+mistakes,group:'sensitivity',role,mistakes});
}
const choose=(rules:Record<string,(c:Choice)=>boolean>):BalanceOptions['choose']=>(_s,e)=>{
 const rule=rules[e.id];if(!rule)return;
 const selected=e.choices.find(rule);if(!selected)throw Error('Missing scenario option: '+e.id);
 return selected;
};
for(const role of roles){
 cases.push({id:'sh-shop',group:'route',role,city:'shanghai',choose:choose({'sh-corridor':c=>c.stationDecision?.value==='shops'})});
 cases.push({id:'gz-center',group:'route',role,city:'guangzhou',choose:choose({'gz-route':c=>c.stationDecision?.value==='center'})});
}
for(const [id,label] of [['salary-truth','说真话'],['salary-low','说工资 5000']])cases.push({id,group:'route',role:'worker',city:'zhengzhou',choose:choose({'zz-hometown':c=>c.label==='告诉他','zz-hometown-answer':c=>c.label===label})});
for(const city of ['shanghai','guangzhou'])cases.push({id:'drag-wheel',group:'route',role:'tourist',city,choose:choose({'tourist-wheel':c=>c.label.includes('硬拖')})});
cases.push({id:'stay-awake',group:'route',role:'tourist',choose:choose({'tourist-sleep':c=>c.label.includes('撑着')})});
const stressPreparations:Partial<Record<BalanceCharacter,string[][]>>={
 student:[['skip','check','eat'],['skip','check','skip'],['take','check','eat']],
 worker:[['take-gifts','eat','reply'],['take-gifts','leave','reply']],
 tourist:[['coffee','keep'],['go','keep']],
 mom:[['toilet-first','snacks-pack'],['toilet-first','snacks-skip']],
};
for(const role of roles)for(const preparation of stressPreparations[role]!)cases.push({id:'paced/'+preparation.join('/'),group:'resource-stress',role,preparation,policy:'paced'});
const selectedCases=cases.filter(c=>process.argv.includes('--stress-only')?c.group==='resource-stress':c.group!=='resource-stress');
const resources=(s:Run)=>({energy:s.student?.stamina??s.characterTime?.energy??s.parent!.energy,maxEnergy:s.student?.stats.energy??s.characterTime?.maxEnergy??s.parent!.maxEnergy,focus:s.student?.stats.focus??s.characterTime?.focus??0,load:s.student?.stats.load??s.characterTime?.load??s.parent!.load,childEnergy:s.parent?.childEnergy??null});
function measure(c:Case,city:string,seed:number,extension:boolean){
 let gateResources:ReturnType<typeof resources>|undefined,minEnergy=Infinity,overrides=0;
 const s=simulateBalance({city,character:c.role,reference:true,budgetAdjustment:extension?REFERENCE_PLAYER.measurementAllowance:0,seed,preparation:c.preparation,reading:c.reading,mistakes:c.mistakes,policy:c.policy,
  choose:c.choose?(s,e)=>{const choice=c.choose!(s,e);if(choice)overrides++;return choice;}:undefined,
  onState:s=>{if(s.phase==='station')minEnergy=Math.min(minEnergy,resources(s).energy);if(s.gatePassed&&!gateResources)gateResources=resources(s);},
 });
 const entries=s.timeLedger.entries.filter(e=>e.deadline==='gate');
 const seconds=entries.reduce((sum,e)=>sum+e.seconds,0);
 const ledgerError=Math.abs(s.initial-s.remaining-s.timeLedger.totalSeconds);
 if(ledgerError>.001)throw Error('Ledger mismatch');
 if(extension&&!s.success)throw Error('Extended measurement did not finish');
 return {success:s.success,gatePassed:s.gatePassed,gateSeconds:seconds,margin:s.timeBudget!.gateBudgetSeconds-seconds,environment:entries.reduce((sum,e)=>sum+referenceEnvironmentSeconds(e),0),preparationCost:entries.filter(e=>e.category==='preparationCost').reduce((sum,e)=>sum+e.seconds,0),moving:entries.filter(e=>e.category==='stationMovement').reduce((sum,e)=>sum+e.seconds,0),operations:s.metrics.operations.length,navigationMistakes:s.stationDecisions.filter(d=>d.category==='navigation'&&!d.optimal).length,overrides,minEnergy:Number.isFinite(minEnergy)?minEnergy:null,gateResources,breathStops:s.student?.breathStops??0};
}
const baselines=new Map<string,ReturnType<typeof measure>>(),groups=[],errors:string[]=[];
let runCount=0;
for(const c of selectedCases)for(const station of STATIONS.filter(st=>!c.city||st.id===c.city)){
 const rows=[];
 for(let i=0;i<samples;i++){
  const seed=921+i*83,key=c.role+'/'+station.id+'/'+seed+'/'+(c.policy??'reference');
  try{
   let baseline=baselines.get(key);
   if(!baseline){baseline=measure({id:'baseline',group:'preparation',role:c.role,policy:c.policy},station.id,seed,true);runCount++;baselines.set(key,baseline);}
   const isBaseline=['preparation','resource-stress'].includes(c.group)&&JSON.stringify(c.preparation)===JSON.stringify(REFERENCE_PLAYER.preparation[c.role]);
   const full=isBaseline?baseline:measure(c,station.id,seed,true);if(!isBaseline)runCount++;
   const real=measure(c,station.id,seed,false);runCount++;
   if(c.choose&&!full.overrides)throw Error('Scenario never exercised the requested event');
   rows.push({seed,extraSeconds:full.gateSeconds-baseline.gateSeconds,extraMoving:full.moving-baseline.moving,extraPreparation:full.preparationCost-baseline.preparationCost,realSuccess:real.success,realGateMargin:real.gatePassed?real.margin:null,full});
  }catch(error){errors.push(`${c.role}/${station.id}/${c.id}/${seed}: ${error}`);}
 }
 if(rows.length){
  const mean=(xs:number[])=>xs.reduce((s,x)=>s+x,0)/xs.length;
  groups.push({role:c.role,station:station.id,case:c.id,group:c.group,policy:c.policy??'reference',preparation:c.preparation??REFERENCE_PLAYER.preparation[c.role],reading:c.reading??5,requestedNavigationMistakes:c.mistakes??0,samples:rows.length,realClears:rows.filter(r=>r.realSuccess).length,extraSeconds:mean(rows.map(r=>r.extraSeconds)),minExtraSeconds:Math.min(...rows.map(r=>r.extraSeconds)),maxExtraSeconds:Math.max(...rows.map(r=>r.extraSeconds)),extraMoving:mean(rows.map(r=>r.extraMoving)),extraPreparation:mean(rows.map(r=>r.extraPreparation)),fullGateSeconds:mean(rows.map(r=>r.full.gateSeconds)),minActualMistakes:Math.min(...rows.map(r=>r.full.navigationMistakes)),maxActualMistakes:Math.max(...rows.map(r=>r.full.navigationMistakes)),meanGateEnergy:mean(rows.map(r=>r.full.gateResources!.energy)),exhaustedRuns:rows.filter(r=>(r.full.minEnergy??1)<.01).length,rows});
 }
}
console.log(JSON.stringify({metadata:{baseRevision:'81f1c20',samples,runCount,seedStart:921,seedStep:83,policy:REFERENCE_PLAYER,note:'Analysis only. Full-route cost uses extended deadline, realClears uses production deadlines. Same seeds do not guarantee identical downstream draws after branching. Counts describe fixed policies, not human pass rates. Environment column retains reference handling convention, not pure unavoidable RNG.'},errors,baselines:[...baselines].map(([key,value])=>({key,...value})),groups},(_key,value)=>typeof value==='number'?Math.round(value*1000)/1000:value,2));
if(errors.length)process.exitCode=1;
