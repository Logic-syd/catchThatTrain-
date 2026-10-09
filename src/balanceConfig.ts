// Game seconds in the countdown; recovery and sprint drain use real held seconds.
export const BALANCE={
 // Later characters leave less room for a mistaken direction. Random events keep their original costs.
 navigationMistakeMultiplier:{student:1,worker:1.2,tourist:1.4,mom:1.6},
 minimumOperations:12,
 studentDecisionBuffer:{shanghai:210,beijing:150,guangzhou:180,hangzhou:150,wuhan:150,zhengzhou:150} as Record<string,number>,
 characterDecisionBuffer:{worker:160,tourist:150},
 characterStationExtra:{worker:{} as Record<string,number>,tourist:{shanghai:30} as Record<string,number>},
 parentDecisionBuffer:{shanghai:280,beijing:220,guangzhou:280,hangzhou:220,wuhan:220,zhengzhou:220} as Record<string,number>,
 hardReduction:{student:90,worker:90,tourist:90,mom:75},
 parentToiletPerMinute:{station:4.5,metro:1.8,other:.45},
 metroAnnouncement:{doorEnergyCost:5,choiceSeconds:5,missChance:.3,missSeconds:50},
};
