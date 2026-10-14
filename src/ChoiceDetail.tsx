import {getLanguage,translate} from './i18n';
// Emphasize only costs already disclosed to the player; hidden queue costs stay hidden.
export default function ChoiceDetail({text}:{text:string}){
 const english=getLanguage()==='en',localized=translate(text);
 const parts=localized.split(english?/([−-]\d+(?:\.\d+)?\s*s\b|(?:Happiness|Morality)\s*\+\d+)/g:/([−-]\d+\s*秒|(?:幸福感|道德)\s*\+\d+)/g);
 return <small className="choice-detail">{parts.map((part,i)=>(english?/^[−-]\d+(?:\.\d+)?\s*s$/:/^[−-]\d+\s*秒$/).test(part)?<b className="choice-time-cost" key={i}>{english?part:part.replace(/^[−-](\d+)\s*秒$/,'−$1 秒')}</b>:(english?/^(?:Happiness|Morality)\s*\+\d+$/:/^(?:幸福感|道德)\s*\+\d+$/).test(part)?<b className="story-gain" key={i}>{part}</b>:part)}</small>;
}
