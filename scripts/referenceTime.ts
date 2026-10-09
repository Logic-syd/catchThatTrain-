import {createCharacterStationRun,STOP_BEFORE} from '../src/engine';
import {STATIONS} from '../src/stations';
import {simulateBalance,type BalanceCharacter} from './simulateBalance';
import {REFERENCE_PLAYER,referenceEnvironmentSeconds,type ReferenceMovement} from './referencePlayer';

const samples=Number(process.argv.find(a=>a.startsWith('--samples='))?.split('=')[1]??32);
if(!Number.isSafeInteger(samples)||samples<1||samples>1000)throw Error('samples must be an integer from 1 to 1000');
const round=(x:number)=>Math.round(x*100)/100;
const quantile=(xs:number[],q:number)=>[...xs].sort((a,b)=>a-b)[Math.floor((xs.length-1)*q)];
const mean=(xs:number[])=>xs.reduce((a,b)=>a+b,0)/xs.length;
const roles:BalanceCharacter[]=['student','worker','tourist','mom'];
const rows=[],groups=[],errors:string[]=[];
for(const character of roles)for(const station of STATIONS){
 const group=[];
 for(let i=0;i<samples;i++){
  const seed=921+i*83;
  let motion:ReferenceMovement={movingSeconds:0,sprintSeconds:0,gateMovingSeconds:0,gateSprintSeconds:0};
  try{
   const run=simulateBalance({city:station.id,character,seed,reference:true,onReferenceMovement:stats=>motion=stats});
   const entries=run.timeLedger.entries,gate=entries.filter(e=>e.deadline==='gate');
   let metro=0,moving=0,operations=0,environment=0,penalties=0,preparation=0,queue=0;
   for(const e of gate){
    if(['metroRide','metroWalk','metroTransfer'].includes(e.category))metro+=e.seconds;
    else if(e.category==='stationMovement')moving+=e.seconds;
    else if(['navigationPenalty','operationPenalty','sprintPenalty','unclassified'].includes(e.category))penalties+=e.seconds;
    else{const extra=referenceEnvironmentSeconds(e);environment+=extra;operations+=e.seconds-extra;}
    if(e.category==='preparationCost')preparation+=e.seconds;
    if(e.category==='securityQueue'||e.source.startsWith('gates:'))queue+=e.seconds;
   }
   const gateTotal=gate.reduce((t,e)=>t+e.seconds,0),total=entries.reduce((t,e)=>t+e.seconds,0);
   const actual=run.initial-run.remaining;
   if(!run.success||!run.gatePassed)errors.push(`${character}/${station.id}/${seed}: measurement did not finish`);
   if(Math.abs(total-actual)>.001||Math.abs(metro+moving+operations+environment+penalties-gateTotal)>.001)errors.push(`${character}/${station.id}/${seed}: accounting mismatch`);
   if(penalties>.001)errors.push(`${character}/${station.id}/${seed}: reference incurred penalty ${penalties}`);
   if(run.student?.late)errors.push(`${character}/${station.id}/${seed}: late bonus contaminated reference`);
   const original=createCharacterStationRun(station.id,character,false,()=>.6).initial-STOP_BEFORE;
   const row={character,station:station.id,seed,currentOpening:original,metro,moving,operations,environment,penalties,preparation,queue,normalWithoutEnvironment:metro+moving+operations,normalWithEnvironment:gateTotal,postGate:total-gateTotal,measuredMargin:original-gateTotal,targetDuty:REFERENCE_PLAYER.sprintDuty[character],actualDuty:motion.gateSprintSeconds/Math.max(.1,motion.gateMovingSeconds),...motion,operationsCount:run.metrics.operations.length,late:run.student?.late??false};
   group.push(row);rows.push(row);
  }catch(error){errors.push(`${character}/${station.id}/${seed}: ${error}`);}
 }
 if(group.length){
  const average=(key:keyof typeof group[number])=>mean(group.map(x=>Number(x[key])));
  const base=average('normalWithoutEnvironment'),env=average('environment');
  groups.push({character,station:station.id,stationName:station.name,samples:group.length,currentOpening:group[0].currentOpening,metro:average('metro'),moving:average('moving'),operations:average('operations'),environment:env,preparation:average('preparation'),queue:average('queue'),normalWithoutEnvironment:base,normalWithEnvironment:base+env,normalWithPlannedEnvironment35:base+35,marginUsingObservedEnvironment:group[0].currentOpening-base-env,marginUsingPlannedEnvironment35:group[0].currentOpening-base-35,p10:quantile(group.map(x=>x.normalWithEnvironment),.1),p90:quantile(group.map(x=>x.normalWithEnvironment),.9),min:Math.min(...group.map(x=>x.normalWithEnvironment)),max:Math.max(...group.map(x=>x.normalWithEnvironment)),targetDuty:group[0].targetDuty,actualDuty:average('actualDuty'),minOperations:Math.min(...group.map(x=>x.operationsCount)),maxPostGate:Math.max(...group.map(x=>x.postGate))});
 }
}
console.log(JSON.stringify({metadata:{referenceVersion:REFERENCE_PLAYER.version,baseRevision:'9d6a228',samplesPerRoleAndStation:samples,expectedRuns:24*samples,actualRuns:rows.length,seedStart:921,seedStep:83,policy:REFERENCE_PLAYER,measurementOnly:true,note:'Offline full-route measurement with extended deadline, excluding urgency bonuses. Production opening times are unchanged. Environment is observed handling under this declared policy, not a pure unavoidable loss estimate. 35s is a planned comparison, never added on top of observed environment. Not a human success-rate estimate.'},errors,groups,rows},(key,value)=>typeof value==='number'?(key.toLowerCase().includes('duty')?Math.round(value*10000)/10000:round(value)):value,2));
if(errors.length)process.exitCode=1;
