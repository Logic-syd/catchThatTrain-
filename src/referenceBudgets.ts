// Frozen normal reference v2: same 32-seed policy, with sprint-v1 speeds.
// Source: docs/design/sprint-reference-report.json, based on 9b8e92c + sprint changes.
// Countdown seconds to ticket-gate completion; excludes post-gate boarding.
// Includes declared preparation and reading. Observed environment is included once.
export type BudgetCharacter='student'|'worker'|'tourist'|'mom';
export interface NormalReference {metroSeconds:number;stationWalkSeconds:number;mandatoryInteractionSeconds:number;expectedEnvironmentSeconds:number}
export const NORMAL_REFERENCE:Record<BudgetCharacter,Record<string,NormalReference>>={
 student:{
  shanghai:{metroSeconds:1116.35,stationWalkSeconds:352.95,mandatoryInteractionSeconds:236.87,expectedEnvironmentSeconds:36.54},
  beijing:{metroSeconds:771.78,stationWalkSeconds:212,mandatoryInteractionSeconds:207.97,expectedEnvironmentSeconds:14.39},
  guangzhou:{metroSeconds:1053.61,stationWalkSeconds:368.35,mandatoryInteractionSeconds:210.25,expectedEnvironmentSeconds:33.19},
  hangzhou:{metroSeconds:641.49,stationWalkSeconds:221.7,mandatoryInteractionSeconds:196.81,expectedEnvironmentSeconds:5.77},
  wuhan:{metroSeconds:1058.75,stationWalkSeconds:259.74,mandatoryInteractionSeconds:216.05,expectedEnvironmentSeconds:5.77},
  zhengzhou:{metroSeconds:959.67,stationWalkSeconds:281.6,mandatoryInteractionSeconds:209.37,expectedEnvironmentSeconds:14.39},
 },
 worker:{
  shanghai:{metroSeconds:1165.78,stationWalkSeconds:483.06,mandatoryInteractionSeconds:216.5,expectedEnvironmentSeconds:36.54},
  beijing:{metroSeconds:883,stationWalkSeconds:287.47,mandatoryInteractionSeconds:181.11,expectedEnvironmentSeconds:14.39},
  guangzhou:{metroSeconds:1140.11,stationWalkSeconds:501.26,mandatoryInteractionSeconds:183.38,expectedEnvironmentSeconds:33.19},
  hangzhou:{metroSeconds:711.52,stationWalkSeconds:303.37,mandatoryInteractionSeconds:169.95,expectedEnvironmentSeconds:5.77},
  wuhan:{metroSeconds:1165.85,stationWalkSeconds:355.35,mandatoryInteractionSeconds:195.69,expectedEnvironmentSeconds:5.77},
  zhengzhou:{metroSeconds:1054.41,stationWalkSeconds:383.14,mandatoryInteractionSeconds:212.51,expectedEnvironmentSeconds:14.39},
 },
 tourist:{
  shanghai:{metroSeconds:1180.94,stationWalkSeconds:510.81,mandatoryInteractionSeconds:210.77,expectedEnvironmentSeconds:56.54},
  beijing:{metroSeconds:917.12,stationWalkSeconds:304.22,mandatoryInteractionSeconds:170.99,expectedEnvironmentSeconds:14.39},
  guangzhou:{metroSeconds:1166.65,stationWalkSeconds:531.54,mandatoryInteractionSeconds:178.26,expectedEnvironmentSeconds:53.19},
  hangzhou:{metroSeconds:733,stationWalkSeconds:322.11,mandatoryInteractionSeconds:159.83,expectedEnvironmentSeconds:5.77},
  wuhan:{metroSeconds:1198.71,stationWalkSeconds:379.05,mandatoryInteractionSeconds:185.57,expectedEnvironmentSeconds:5.77},
  zhengzhou:{metroSeconds:1083.48,stationWalkSeconds:406.99,mandatoryInteractionSeconds:172.39,expectedEnvironmentSeconds:14.39},
 },
 mom:{
  shanghai:{metroSeconds:1125.25,stationWalkSeconds:424.09,mandatoryInteractionSeconds:235.86,expectedEnvironmentSeconds:41.22},
  beijing:{metroSeconds:791.81,stationWalkSeconds:242.84,mandatoryInteractionSeconds:201.11,expectedEnvironmentSeconds:14.39},
  guangzhou:{metroSeconds:1069.18,stationWalkSeconds:489.34,mandatoryInteractionSeconds:185.18,expectedEnvironmentSeconds:33.19},
  hangzhou:{metroSeconds:654.1,stationWalkSeconds:272.61,mandatoryInteractionSeconds:187.95,expectedEnvironmentSeconds:5.77},
  wuhan:{metroSeconds:1078.04,stationWalkSeconds:326.12,mandatoryInteractionSeconds:222.04,expectedEnvironmentSeconds:10.46},
  zhengzhou:{metroSeconds:976.73,stationWalkSeconds:316.52,mandatoryInteractionSeconds:184.01,expectedEnvironmentSeconds:14.39},
 },
};
