import StationTravelMap from './StationTravelMap';
import MapObstructionPanel,{MapObstructionScene,MapObstructionTimeLoss} from './MapObstructionPanel';
import {activeObstacle,obstructionTitle} from './mapObstructions';
import StationRunControls from './StationRunControls';
import StationTaskScene,{stationTaskLabel} from './StationTaskScene';
import {StationActionContext,type StationActionProgress} from './StationActionContext';
import {completedStationAction,stationEventKey} from './stationFeedback';
import {stationFor,stationArrivalGuide} from './stations';
import {StudentEnergy} from './StudentUI';
import {ParentStatus} from './ParentUI';
import {useCallback,useEffect,useRef,useState,type Dispatch,type ReactNode} from 'react';
import {Check,MapPin} from 'lucide-react';
import type {Run,Action} from './engine';
export default function Station({run,dispatch,blocked,children}:{run:Run;dispatch:Dispatch<Action>;blocked:boolean;children?:ReactNode}){
 const station=stationFor(run);
 const beat=run.stationJourney[run.stationBeat],u=run.student;
 const mapBlock=run.stationMap?.block,mapObstacle=run.stationMap?activeObstacle(run.stationMap):undefined;
 const eventKey=stationEventKey(run);
 const [actionState,setActionState]=useState<StationActionProgress&{key:string}>({key:'',progress:0,active:false,label:''});
 const actionRef=useRef(actionState);
 const liveEventKey=useRef(eventKey);liveEventKey.current=eventKey;
 const reportAction=useCallback((value:StationActionProgress)=>{if(liveEventKey.current!==eventKey)return;const next={...value,progress:Math.max(0,Math.min(1,value.progress)),key:eventKey};actionRef.current=next;setActionState(next);},[eventKey]);
 const action=actionState.key===eventKey?actionState:{progress:0,active:false,label:''};
 const [completion,setCompletion]=useState<ReturnType<typeof completedStationAction>>(null);
 const previousRun=useRef(run);
 useEffect(()=>{
  const previous=previousRun.current;previousRun.current=run;
  const feedback=completedStationAction(previous,run,actionRef.current.key===stationEventKey(previous)?actionRef.current.label:undefined);
  if(feedback)setCompletion(feedback);
  else if(run.id!==previous.id||run.event?.id!==previous.event?.id)setCompletion(null);
 },[run]);
 useEffect(()=>{if(actionRef.current.key!==eventKey){const empty={key:eventKey,progress:0,active:false,label:''};actionRef.current=empty;setActionState(empty);}},[eventKey]);
 useEffect(()=>{if(!completion)return;const timer=setTimeout(()=>setCompletion(null),2200);return()=>clearTimeout(timer);},[completion]);

 const [showGuide,setShowGuide]=useState(false);
 useEffect(()=>{dispatch({type:'MAP_ENABLE',manual:true});},[dispatch,run.id]);
 useEffect(()=>{if(blocked)dispatch({type:'RUN_INPUT',held:false});},[blocked,dispatch]);
 const obstacle=run.event,moving=run.stationRunning&&!blocked&&!mapBlock;
 const sceneRun=obstacle?run:completion?completion.run:null;
 return <StationActionContext.Provider value={reportAction}><section className={'station-journey map-journey layout-'+station.id+(obstacle?' handling-event':'')} data-beat={beat?.id}>
  {run.parent?<ParentStatus run={run} dispatch={dispatch}/>:((u||run.characterTime)&&<StudentEnergy run={run} dispatch={dispatch}/>)}
  <div className="journey-status"><span>{mapObstacle?'停下了 · '+obstructionTitle(mapObstacle.kind):obstacle?'停下处理 · '+stationTaskLabel(run):'赶往 '+run.gate+' · '+beat?.label}</span><button onClick={()=>setShowGuide(v=>!v)} aria-expanded={showGuide}>看路牌</button></div>
  <div className="map-viewport"><StationTravelMap run={run} dispatch={dispatch} blocked={blocked||!!mapBlock} action={action}/>{showGuide&&<aside className="map-guide"><b>这趟去 {run.gate} 检票口</b><p>{stationArrivalGuide(run)}</p><button onClick={()=>setShowGuide(false)}>记住了</button></aside>}
   {mapBlock&&<div className="map-task-closeup obstruction-closeup"><MapObstructionScene run={run} action={action}/></div>}
   {!mapBlock&&sceneRun&&<div className="map-task-closeup" key={stationEventKey(sceneRun)}><StationTaskScene run={sceneRun} progress={obstacle?action.progress:1} active={!!obstacle&&action.active} actionLabel={obstacle?action.label:completion?.title}/></div>}
  </div>
  <div className="journey-interaction" key={eventKey}>
   <span className="operation-handle"/>
   <MapObstructionTimeLoss run={run}/>
   {mapBlock?<MapObstructionPanel key={mapBlock.id+':'+mapBlock.mode} run={run} dispatch={dispatch}/>:obstacle?<><div className="operation-caption"><MapPin size={17}/><b>遇到事情了 · 先处理，再赶路</b></div>{children}{action.label&&<div className="task-action-feedback" role="status"><span>{action.label}</span>{action.progress>0&&action.progress<1&&<b>{Math.round(action.progress*100)}%</b>}</div>}</>:<>
    {completion&&<div className="task-completion" role="status"><Check size={18}/><span><b>{completion.title}</b></span>{completion.seconds>0&&<strong>−{completion.seconds} 秒</strong>}</div>}
    <div className="map-run-heading"><b>{moving?'正沿地图通道赶路':run.stationMap?.path.length?'路线选好了，按住继续':'按住出发，地图上可以改道'}</b><span>目标：{run.gate}</span></div>
    {run.stationMap?.notice&&<div className="map-collision-notice" role="status">{run.stationMap.notice}</div>}
    <StationRunControls run={run} dispatch={dispatch} blocked={blocked}/>

   </>}
  </div>
 </section></StationActionContext.Provider>;
}
