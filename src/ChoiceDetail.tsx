// Emphasize only costs already disclosed to the player; hidden queue costs stay hidden.
export default function ChoiceDetail({text}:{text:string}){
 return <small className="choice-detail">{text.split(/([−-]\d+\s*秒)/g).map((part,i)=>/^[−-]\d+\s*秒$/.test(part)?<b className="choice-time-cost" key={i}>{part.replace(/^[−-](\d+)\s*秒$/,'−$1 秒')}</b>:part)}</small>;
}
