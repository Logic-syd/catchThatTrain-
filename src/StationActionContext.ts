import {createContext,useContext} from 'react';

export type StationActionProgress={progress:number;active:boolean;label:string};
const ignoreProgress=(_progress:StationActionProgress)=>{};
// Display feedback only. The existing controls remain responsible for completion.
export const StationActionContext=createContext<(value:StationActionProgress)=>void>(ignoreProgress);
export function useStationAction(){return useContext(StationActionContext);}
