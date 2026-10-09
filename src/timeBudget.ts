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
  status:'legacy-unallocated';
  mandatoryInteractionSeconds:null;
  expectedEnvironmentSeconds:null;
  errorBudgetSeconds:null;
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
