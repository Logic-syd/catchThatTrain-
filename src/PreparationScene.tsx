import {localizeNode} from './i18n';
import {LittleYou} from './Scenes';
import TeaShopIcon from './TeaShopIcon';

/** A decorative scene around the existing preparation decision; no extra inputs or clock. */
export default function PreparationScene({step,cityId}:{step:number;cityId:string}){
 const bag=step===1, breakfast=step===2;
 return <div className={`preparation-scene preparation-scene--${bag?'bag':breakfast?'breakfast':'tea'}`} aria-hidden="true">
  <svg className="preparation-street" viewBox="0 0 420 300" fill="none">
   <path d="M0 240V55h44v-25h62v36h32V19h78v53h33V40h95v34h76v166Z" fill="#E5DDC6" opacity=".6"/>
   <path d="M25 91h18m-18 25h18m40-64v20m0 18v20m80-63h20m-20 25h20m90-11h21m-21 25h21m53 18h22" stroke="#D1C6A9" strokeWidth="7"/>
   <path d="M0 234h420v66H0z" fill="#E0D4B5"/>
   <path d="M0 251h420M25 275h86m47 0h126m44 0h72" stroke="#C8B996" strokeWidth="2"/>
   <ellipse cx="211" cy="237" rx="157" ry="13" fill="#847451" opacity=".12"/>
   {bag?<>
    <rect x="101" y="180" width="213" height="17" rx="5" fill="#A88359"/>
    <path d="M118 196v45m176-45v45" stroke="#756F55" strokeWidth="9"/>
    <rect x="107" y="132" width="200" height="36" rx="5" fill="#B89A6A"/>
    <path d="M153 132v64m117-64v64" stroke="#8A7855" strokeWidth="5"/>
    <path d="M177 94v-9c0-23 52-23 52 0v9" stroke="#836440" strokeWidth="10"/>
    <rect x="155" y="85" width="98" height="111" rx="26" fill="#C7A464" stroke="#8F734B" strokeWidth="3"/>
    <path d="M169 115h70" stroke="#846947" strokeWidth="4" strokeLinecap="round"/>
    <rect x="171" y="125" width="70" height="56" rx="11" fill="#DDC38C" stroke="#9E8153" strokeWidth="2"/>
    <g transform="rotate(-12 210 128)"><rect x="186" y="102" width="57" height="37" rx="5" fill="#FFFBEC" stroke="#94A291" strokeWidth="2"/><rect x="192" y="109" width="15" height="20" rx="3" fill="#B5C6AF"/><path d="M214 111h21m-21 8h16m-16 8h19" stroke="#B2AB91" strokeWidth="2"/></g>
    <path d="M169 142h70" stroke="#9E8153" strokeWidth="3"/>
    <circle cx="244" cy="169" r="5" fill="#E9D6A4"/>
   </>:<>
    <rect x="94" y="63" width="232" height="166" rx="9" fill="#F4E8CA" stroke="#B69D75" strokeWidth="2"/>
    <rect x="103" y="74" width="214" height="35" rx="5" fill={breakfast?'#A27847':'#873F43'}/>
    {!breakfast&&<g transform="translate(108 75) scale(.4)"><TeaShopIcon cityId={cityId} size={80}/></g>}
    <text x={breakfast?210:225} y="97" fill="#FFF0D1" textAnchor="middle" fontSize="16" fontWeight="700">{localizeNode(breakfast?'街角早餐':'鲜萃茶铺')}</text>
    <rect x="108" y="135" width="133" height="73" rx="3" fill="#635F4D"/>
    <path d="M113 141h123v31H113z" fill="#91977B"/>
    <path d="m116 142 35 29m-14-29 35 29" stroke="#C1C3A0" strokeWidth="5" opacity=".5"/>
    <rect x="254" y="136" width="57" height="91" rx="3" fill="#BDBD9A" stroke="#AC9572" strokeWidth="3"/>
    <path d="M261 146h43v51h-43z" fill="#E3DFBC"/>
    <path d="M299 204v9" stroke="#8E7B58" strokeWidth="3" strokeLinecap="round"/>
    <path d="M95 110h230l12 25H83z" fill="#E8CFA1"/>
    {[0,1,2,3,4,5].map(i=><path key={i} d={`M${99+i*39} 110h20l${i>2?4:-4} 25h-24Z`} fill={breakfast?'#B7985A':'#A75C56'}/>)}
    <path d="M84 135h253v8c-6 7-16 7-23 0-7 7-16 7-23 0-7 7-16 7-23 0-7 7-16 7-23 0-7 7-16 7-23 0-7 7-16 7-23 0-7 7-16 7-23 0-7 7-16 7-23 0-7 7-16 7-23 0-7 7-16 7-23 0-7 7-16 7-23 0Z" fill={breakfast?'#B7985A':'#A75C56'}/>
    <rect x="101" y="200" width="149" height="11" rx="3" fill="#B89366"/>
    {breakfast?<g>
     <ellipse cx="176" cy="195" rx="46" ry="6" fill="#D8C09A"/>
     <path d="m145 190 17-30q5-7 10 0l17 30q2 5-4 5h-36q-6 0-4-5Z" fill="#FFF7DC" stroke="#DCCAA1" strokeWidth="2"/>
     <path d="M157 180h20v15h-20z" fill="#66795C"/>
     <path d="m185 191 12-22q4-6 8 0l12 22q2 4-3 4h-26q-5 0-3-4Z" fill="#FFF7DC"/>
     <path className="prep-steam" d="M159 151q-5-7 0-14m24 13q-5-7 0-14" stroke="#FFF6DF" strokeWidth="3" strokeLinecap="round"/>
    </g>:<g>
     <path d="m181 154 6-19" stroke="#8B7053" strokeWidth="4" strokeLinecap="round"/>
     <path d="m155 158 6 39h34l6-39" fill="#FFF1D3" stroke="#B9986B" strokeWidth="2"/>
     <rect x="151" y="154" width="54" height="7" rx="3" fill="#DBC393"/>
     <g transform="translate(166 166) scale(.29)"><TeaShopIcon cityId={cityId} size={80}/></g>
    </g>}
   </>}
   <path d="M355 171v72" stroke="#9B9475" strokeWidth="5"/>
   <path d="M321 161h61l14 14-14 14h-61z" fill="#7D9478" stroke="#F8F0D5" strokeWidth="2"/>
   <text x="351" y="180" fill="#FFFAE5" textAnchor="middle" fontSize="12" fontWeight="700">{localizeNode('地铁')}</text>
   <path d="M28 216h35l-5 24H33z" fill="#B58965"/>
   <path d="M46 219v-38m0 26q-23 0-19-21 21 1 19 21m0-7q22-1 18-22-20 4-18 22" fill="#98A27A" stroke="#79896A" strokeWidth="2"/>
   <foreignObject x="39" y="183" width="88" height="80"><div className="preparation-player"><LittleYou motion="waiting"/></div></foreignObject>
  </svg>
 </div>;
}
