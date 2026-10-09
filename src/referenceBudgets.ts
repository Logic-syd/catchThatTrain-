// Frozen normal-mode reference v1: 32 seeds per role/station, engine 9d6a228.
// Source: docs/design/reference-time-report.json (committed in 3ae6fd3).
// Countdown seconds to ticket-gate completion; excludes post-gate boarding.
// Includes declared preparation and reading. Environment uses observed handling,
// not an additional 35s allowance or a claim of unavoidable RNG.
export type BudgetCharacter='student'|'worker'|'tourist'|'mom';
export interface NormalReference {metroSeconds:number;stationWalkSeconds:number;mandatoryInteractionSeconds:number;expectedEnvironmentSeconds:number}
export const NORMAL_REFERENCE:Record<BudgetCharacter,Record<string,NormalReference>>={
 student:{
  shanghai:{metroSeconds:1116.35,stationWalkSeconds:336.44,mandatoryInteractionSeconds:236.87,expectedEnvironmentSeconds:36.54},
  beijing:{metroSeconds:771.78,stationWalkSeconds:199.92,mandatoryInteractionSeconds:207.97,expectedEnvironmentSeconds:14.39},
  guangzhou:{metroSeconds:1053.61,stationWalkSeconds:347.31,mandatoryInteractionSeconds:210.25,expectedEnvironmentSeconds:33.19},
  hangzhou:{metroSeconds:641.49,stationWalkSeconds:212.22,mandatoryInteractionSeconds:196.81,expectedEnvironmentSeconds:5.77},
  wuhan:{metroSeconds:1058.75,stationWalkSeconds:247.57,mandatoryInteractionSeconds:216.05,expectedEnvironmentSeconds:5.77},
  zhengzhou:{metroSeconds:959.67,stationWalkSeconds:265.09,mandatoryInteractionSeconds:209.37,expectedEnvironmentSeconds:14.39},
 },
 worker:{
  shanghai:{metroSeconds:1165.78,stationWalkSeconds:462.41,mandatoryInteractionSeconds:216.5,expectedEnvironmentSeconds:36.54},
  beijing:{metroSeconds:883,stationWalkSeconds:275.67,mandatoryInteractionSeconds:181.11,expectedEnvironmentSeconds:14.39},
  guangzhou:{metroSeconds:1140.11,stationWalkSeconds:482.64,mandatoryInteractionSeconds:183.38,expectedEnvironmentSeconds:33.19},
  hangzhou:{metroSeconds:711.52,stationWalkSeconds:291.82,mandatoryInteractionSeconds:169.95,expectedEnvironmentSeconds:5.77},
  wuhan:{metroSeconds:1165.85,stationWalkSeconds:341.09,mandatoryInteractionSeconds:195.69,expectedEnvironmentSeconds:5.77},
  zhengzhou:{metroSeconds:1054.41,stationWalkSeconds:369.42,mandatoryInteractionSeconds:212.51,expectedEnvironmentSeconds:14.39},
 },
 tourist:{
  shanghai:{metroSeconds:1180.94,stationWalkSeconds:496.5,mandatoryInteractionSeconds:210.77,expectedEnvironmentSeconds:56.54},
  beijing:{metroSeconds:917.12,stationWalkSeconds:295.86,mandatoryInteractionSeconds:170.99,expectedEnvironmentSeconds:14.39},
  guangzhou:{metroSeconds:1166.65,stationWalkSeconds:515.7,mandatoryInteractionSeconds:178.26,expectedEnvironmentSeconds:53.19},
  hangzhou:{metroSeconds:733,stationWalkSeconds:313.2,mandatoryInteractionSeconds:159.83,expectedEnvironmentSeconds:5.77},
  wuhan:{metroSeconds:1198.71,stationWalkSeconds:368.84,mandatoryInteractionSeconds:185.57,expectedEnvironmentSeconds:5.77},
  zhengzhou:{metroSeconds:1083.48,stationWalkSeconds:395.07,mandatoryInteractionSeconds:172.39,expectedEnvironmentSeconds:14.39},
 },
 mom:{
  shanghai:{metroSeconds:1125.25,stationWalkSeconds:417.79,mandatoryInteractionSeconds:235.86,expectedEnvironmentSeconds:41.22},
  beijing:{metroSeconds:791.81,stationWalkSeconds:238.06,mandatoryInteractionSeconds:201.11,expectedEnvironmentSeconds:14.39},
  guangzhou:{metroSeconds:1069.18,stationWalkSeconds:479.37,mandatoryInteractionSeconds:185.18,expectedEnvironmentSeconds:33.19},
  hangzhou:{metroSeconds:654.1,stationWalkSeconds:267.05,mandatoryInteractionSeconds:187.95,expectedEnvironmentSeconds:5.77},
  wuhan:{metroSeconds:1078.04,stationWalkSeconds:320.15,mandatoryInteractionSeconds:222.04,expectedEnvironmentSeconds:10.46},
  zhengzhou:{metroSeconds:976.73,stationWalkSeconds:310.49,mandatoryInteractionSeconds:184.01,expectedEnvironmentSeconds:14.39},
 },
};
