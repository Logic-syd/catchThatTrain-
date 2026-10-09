import type {Run} from './engine';
import type {LittleYouMotion} from './LittleYou';
import type {StationActionProgress} from './StationActionContext';
import {activeObstacle} from './mapObstructions';

export function stationAvatarEffort(run:Run):'fresh'|'strained'|'exhausted'{
 const energy=run.student?.stamina??run.characterTime?.energy??run.parent?.energy??100;
 const max=run.student?.stats.energy??run.characterTime?.maxEnergy??run.parent?.maxEnergy??100;
 if(run.student?.exhausted||run.characterTime?.exhausted||run.parent?.exhausted)return 'exhausted';
 if((run.student?.sprintStrain??0)>=4.5||energy/Math.max(1,max)<.35||(run.characterTime?.fatigue??0)>=65)return 'strained';
 return 'fresh';
}

export function stationAvatarMotion(run:Run,blocked:boolean,action?:StationActionProgress):LittleYouMotion{
 if(run.phase!=='station')return 'waiting';
 const map=run.stationMap,block=map?.block;
 if(block){
  const obstacle=activeObstacle(map!);
  if(obstacle?.kind==='security')return 'waiting';
  if(obstacle?.kind==='child'||block.mode==='waiting')return 'braking';
  if(block.mode==='yielding'||(block.mode==='stopped'&&action?.active&&action.label==='按住说声借过'))return 'asking';
  return 'blocked';
 }
 if(blocked||!run.stationRunning)return 'waiting';
 if(map?.bypassing)return 'sidestepping';
 return run.student?.sprinting||run.characterTime?.sprinting||run.parent?.sprinting?'sprinting':'running';
}
