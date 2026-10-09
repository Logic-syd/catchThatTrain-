import type {Choice} from './data';

export default function GateChoices({choices,onChoose}:{choices:Choice[];onChoose:(choice:Choice)=>void}){
 return <div className="eight-gates">{choices.map(c=><button key={c.label} onClick={()=>onChoose(c)}>
  <b>{c.label}</b>
  <div className="queue-people" aria-hidden="true">{Array.from({length:c.queuePeople??0},(_,i)=><i key={i}/>)}</div>
  <span>{c.detail.split(' · ')[0]}</span><small>{c.detail.split(' · ').slice(1).join(' · ')}</small>
 </button>)}</div>;
}
