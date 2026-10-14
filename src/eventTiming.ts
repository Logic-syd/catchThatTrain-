import type {EventConfig} from './data';
import type {Run} from './engine';
import {focusWindow} from './studentConfig';

// Share the actual deadline with the UI; non-student events use fixed windows.
export function eventTimeLimit(run:Run,event:EventConfig|null=run.event):number{
 if(!event)return 0;
 const seconds=event.interaction?.kind==='identity'
  ?run.identityStage==='wallet'?8:6
  :event.interaction?.seconds??(run.student?12:10);
 return seconds*(run.student?focusWindow(run.student.stats.focus):1);
}

export function eventHoldSeconds(run:Run,event:EventConfig|null=run.event):number{
 return (event?.interaction?.required??2)*(run.student?.tea?1.25:1);
}
