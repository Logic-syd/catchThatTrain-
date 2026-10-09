import type {Run} from './engine';
import type {StationDecision} from './stations';

// Shared by actual travel and the optimistic time calculation. Do not renormalize
// walking time after a shortcut: only the next leg gets its advertised scale.
export function applyJourneyDecision(s:Run,d:StationDecision):Run{
 let beats=s.stationJourney.filter(b=>!d.skip?.includes(b.id));
 if(d.travelScale&&beats[s.stationBeat+1])beats=beats.map((b,i)=>i===s.stationBeat+1?{...b,seconds:b.seconds*d.travelScale!}:b);
 return {...s,stationJourney:beats,stationDecisions:[...s.stationDecisions,d]};
}
export function prepareNextJourney(s:Run):Run{
 const beat=s.stationJourney[s.stationBeat];
 if(s.characterTime?.characterId==='worker'&&beat?.id==='worker-boss-call'&&s.characterTime.bossCallsLeft===0)s={...s,stationJourney:s.stationJourney.filter((b,i)=>i<=s.stationBeat||b.id!=='worker-boss-call')};
 const vertical=s.student?.vertical??[...s.stationDecisions].reverse().find(d=>d.group==='vertical-choice')?.value;
 if(beat?.id==='vertical-choice'&&vertical&&vertical!=='escalator'){
  const name=vertical==='stairs'?'楼梯':'直达电梯';
  s={...s,stationJourney:s.stationJourney.filter(b=>b.id!=='escalator-choice').map(b=>b.id==='escalator-ride'?{...b,label:'走向选中的'+name}:b)};
 }
 return s;
}
