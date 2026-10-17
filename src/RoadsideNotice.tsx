import type {CSSProperties, Dispatch} from 'react';
import type {Action, Run} from './engine';
import {roadsidePrompt, roadsideSecondsRemaining, ROADSIDE_ART, ROADSIDE_SECONDS} from './hongqiao';
import {studentDistractionPrompt} from './characterChallenges';
import {localizeNode, translate} from './i18n';
import TeaShopIcon from './TeaShopIcon';
import './roadsideNotice.css';

/** A passing opportunity: the engine owns its lifetime and acceptance. */
export default function RoadsideNotice({run, dispatch, disabled=false}:{run:Run;dispatch:Dispatch<Action>;disabled?:boolean}) {
 const notice=run.roadsideNotice, remaining=roadsideSecondsRemaining(run);
 if(!notice||!run.student||remaining<=0)return null;
 const art=ROADSIDE_ART[notice.id], prompt=studentDistractionPrompt(notice.id,run.student);
 if(!art||!prompt)return null;
 const available=!disabled&&!!roadsidePrompt(run);
 // Required tasks keep the screen; the engine's deadline continues unchanged.
 if(!available)return null;
 return <aside className="roadside-notice-anchor" aria-label={translate('路边小诱惑')}>
  <button className="roadside-toast" data-roadside={notice.id} data-revision={notice.revision} disabled={!available}
   onClick={()=>dispatch({type:'ROADSIDE_STOP',id:notice.id,revision:notice.revision})}
   style={{'--notice-left':`${Math.max(0,Math.min(100,remaining/ROADSIDE_SECONDS*100))}%`} as CSSProperties}>
   <span className="roadside-toast-art" aria-hidden="true">{notice.id==='student-tea-shop'?<TeaShopIcon cityId={run.city.id} size={46}/>:art.icon}</span>
   <span className="roadside-toast-copy"><strong>{localizeNode(art.label)}</strong><small>{localizeNode(prompt.choices[0].detail)}</small><span>{localizeNode('想停就点，不点就路过')}</span></span>
   <span className="roadside-toast-count" aria-hidden="true">{Math.ceil(remaining)}<small>s</small></span>
   <span className="roadside-toast-progress" aria-hidden="true"/>
  </button>
 </aside>;
}
