import type {Run} from './engine';
import {formatTime} from './engine';
import {raceForecast} from './raceForecast';
import './raceClock.css';

export default function RaceClock({run}:{run:Run}){
 const f=raceForecast(run);if(!f)return null;
 const title=f.status==='impossible'?'这趟肯定赶不上了':f.status==='tight'?'余量很少，别再走错':'抓紧，路上还会耽搁';
 return <div className={'race-clock '+f.status}>
  <div className="race-clock-values"><div><span>{run.gatePassed?'发车还剩':'检票还剩'}</span><strong>{formatTime(f.remaining)}</strong></div><span className="race-clock-versus">对比</span><div><span>{run.gatePassed?'到车门理论最短':'到检票口理论最短'}</span><strong>{formatTime(f.fastest)}</strong></div></div>
  <p className="race-verdict" role="status" aria-live="polite" aria-atomic="true">{title}</p>
  <small>{f.status==='impossible'?'连理论最快也来不及了，可以继续走完这趟。':'按极限速度、一路畅通计算；排队和恢复会更久。'}</small>
 </div>;
}
