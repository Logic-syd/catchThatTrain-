import {setLanguage,useLanguage} from './i18n';

/** The same control is available in the header and inside modal focus traps. */
export default function LanguageSwitch(){
 const language=useLanguage();
 const label=language==='zh'?'Switch to English':'切换为中文';
 return <button type="button" className="language-switch" aria-label={label} title={label} onClick={()=>setLanguage(language==='zh'?'en':'zh')}>
  <span lang="zh-CN" className={language==='zh'?'selected':''}>中</span>
  <i aria-hidden="true">/</i>
  <span lang="en" className={language==='en'?'selected':''}>EN</span>
 </button>;
}
