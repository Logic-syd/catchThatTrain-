import {BALANCE} from './balanceConfig';
import {NORMAL_REFERENCE,type BudgetCharacter} from './referenceBudgets';

/** All values here are countdown seconds, never real input/animation seconds. */
export interface TimeBudgetInput {
 metroSeconds:number;
 /** Legacy chapter walking allocation. It includes the post-gate board-train leg
  * and is not yet a calibrated reference player's journey to the ticket gate. */
 stationWalkSeconds:number;
 /** Existing buffer: interaction costs, environment and mistakes are not separated. */
 legacyAllowanceSeconds:number;
 hardReductionSeconds:number;
 gateClosingLeadSeconds:number;
 roundingSeconds?:number;
}

export interface TimeBudget {
 metroSeconds:number;
 stationWalkSeconds:number;
 legacyAllowanceSeconds:number;
 roundingSeconds:number;
 roundingAdjustmentSeconds:number;
 hardReductionSeconds:number;
 gateClosingLeadSeconds:number;
 /** Time visible to the player before ticket-gate closure. */
 gateBudgetSeconds:number;
 /** Engine clock until departure; the closing lead is included exactly once. */
 departureBudgetSeconds:number;
 calibration:{
  status:'legacy-unallocated'|'reference-v2';
  mandatoryInteractionSeconds:number|null;
  expectedEnvironmentSeconds:number|null;
  errorBudgetSeconds:number|null;
 };
}

/** Preserve the existing opening budget while making its terms auditable.
 * Null calibrated terms are unknown, not zero, and are never added again. */
export function buildTimeBudget(input:TimeBudgetInput):TimeBudget {
 const roundingSeconds=input.roundingSeconds??30;
 for(const [name,value] of Object.entries(input)){
  if(value!==undefined&&(!Number.isFinite(value)||value<0))throw new RangeError(`${name} must be finite and non-negative`);
 }
 if(roundingSeconds<=0)throw new RangeError('roundingSeconds must be positive');
 const unrounded=input.metroSeconds+input.stationWalkSeconds+input.legacyAllowanceSeconds;
 const rounded=Math.ceil(unrounded/roundingSeconds)*roundingSeconds;
 const gateBudgetSeconds=rounded-input.hardReductionSeconds;
 if(gateBudgetSeconds<0)throw new RangeError('hardReductionSeconds exceeds the opening gate budget');
 return {
  metroSeconds:input.metroSeconds,
  stationWalkSeconds:input.stationWalkSeconds,
  legacyAllowanceSeconds:input.legacyAllowanceSeconds,
  roundingSeconds,
  roundingAdjustmentSeconds:rounded-unrounded,
  hardReductionSeconds:input.hardReductionSeconds,
  gateClosingLeadSeconds:input.gateClosingLeadSeconds,
  gateBudgetSeconds,
  departureBudgetSeconds:gateBudgetSeconds+input.gateClosingLeadSeconds,
  calibration:{status:'legacy-unallocated',mandatoryInteractionSeconds:null,expectedEnvironmentSeconds:null,errorBudgetSeconds:null},
 };
}

/** Use the measured full reference plus explicit mistake allowance. Legacy
 * buffers and post-gate walking are not added. Round once to a whole second. */
export function buildReferenceTimeBudget(station:string,character:BudgetCharacter,hard:boolean,gateClosingLeadSeconds:number):TimeBudget {
 const reference=NORMAL_REFERENCE[character][station];
 if(!reference)throw new RangeError('Missing normal reference: '+character+'/'+station);
 if(!Number.isFinite(gateClosingLeadSeconds)||gateClosingLeadSeconds<0)throw new RangeError('Invalid gate closing lead');
 const errorBudgetSeconds=BALANCE.errorBudgetSeconds[character];
 const hardReductionSeconds=hard?BALANCE.hardReduction[character]:0;
 const {metroSeconds,stationWalkSeconds,mandatoryInteractionSeconds,expectedEnvironmentSeconds}=reference;
 // Stored measurement components use hundredths; avoid binary noise adding a second.
 const unrounded=Math.round((metroSeconds+stationWalkSeconds+mandatoryInteractionSeconds+expectedEnvironmentSeconds+errorBudgetSeconds)*100)/100;
 const rounded=Math.ceil(unrounded);
 const gateBudgetSeconds=rounded-hardReductionSeconds;
 return {metroSeconds,stationWalkSeconds,legacyAllowanceSeconds:0,roundingSeconds:1,
  roundingAdjustmentSeconds:rounded-unrounded,hardReductionSeconds,gateClosingLeadSeconds,
  gateBudgetSeconds,departureBudgetSeconds:gateBudgetSeconds+gateClosingLeadSeconds,
  calibration:{status:'reference-v2',mandatoryInteractionSeconds,expectedEnvironmentSeconds,errorBudgetSeconds}};
}
