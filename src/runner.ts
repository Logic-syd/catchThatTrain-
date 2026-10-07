import {stationFor} from './stations';
import type {Run} from './engine';
export type RunnerState={lane:number;wave:number;blocked:boolean;collisions:number;dodges:number;seed:number};
export function runnerWave(s:Run){
 const beat=s.stationJourney[s.stationBeat],r=s.student?.runner??s.characterTime?.runner??s.parent?.runner;
 if(!r||!beat||s.event)return null;
 const st=stationFor(s);const density=s.stationDecisions?.filter(d=>d.density).at(-1)?.density;
 const count=Math.min(3,Math.max(1,Math.floor(beat.seconds/4)),density??(s.city.id==='beijing'||s.city.id==='guangzhou'?3:s.city.id==='hangzhou'?1:beat.seconds>=9?2:1));
 const marks=count===3?[.32,.61,.86]:count===2?[.38,.74]:[.62];
 if(r.wave>=marks.length)return null;
 return {at:marks[r.wave],from:r.wave?marks[r.wave-1]:0,lane:s.stationBeat===0&&r.wave===0?1:(r.seed+st.obstaclePattern[(s.stationBeat+r.wave)%st.obstaclePattern.length])%3,kind:(s.stationBeat+r.wave)%2?'人群':'行李箱'};
}
