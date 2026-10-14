/** Public opening budgets, in game seconds. Never adjusted after a run starts. */
export type PlayableDifficultyCharacter='student'|'worker'|'tourist'|'mom';
export type DifficultyPolicy={buffer:number;hardReduction:number;minimum:number};
/** Reasonable novice input benchmark; family is a future, unavailable character. */
export const DIFFICULTY_TARGETS={student:.875,worker:.70,tourist:.60,mom:.40,family:.20} as const;
/** Student has its own first-level band; the middle tiers allow ±5 percentage points. */
export const DIFFICULTY_TARGET_RANGES={
 student:{min:.85,max:.90},worker:{min:.65,max:.75},tourist:{min:.55,max:.65},mom:{min:.35,max:.45},
} as const;
const POLICIES:Record<PlayableDifficultyCharacter,Omit<DifficultyPolicy,'minimum'>>={
 student:{buffer:130,hardReduction:0},
 worker:{buffer:150,hardReduction:0},
 tourist:{buffer:185,hardReduction:0},
 mom:{buffer:180,hardReduction:0},
};
// Fixed station task allowances: long corridors and carrying/vertical tasks.
// These are chosen before any input, and never depend on a seed or outcome.
const STATION_BUFFER:Partial<Record<PlayableDifficultyCharacter,Record<string,number>>>={
 student:{shanghai:15,guangzhou:-15,wuhan:-20},
 worker:{shanghai:10,guangzhou:-15,hangzhou:-30,wuhan:-10,zhengzhou:15},
 tourist:{shanghai:30,guangzhou:20},
 mom:{shanghai:25,beijing:20,guangzhou:90,hangzhou:-10,wuhan:-10},
};
export function difficultyPolicy(character:PlayableDifficultyCharacter,station:string):DifficultyPolicy{
 const policy=POLICIES[character];
 return {...policy,buffer:policy.buffer+(STATION_BUFFER[character]?.[station]??0),minimum:0};
}
