import {getLanguage,translate,type Language} from './i18n';
import {TITLE_CONFIGS} from './titles';

/** Recognize titles from older English links without translating arbitrary input. */
export function canonicalTitle(title:string):string{
 return TITLE_CONFIGS.find(item=>item.name===title||translate(item.name,'en')===title)?.name??title;
}

/** Stored records use year/month/day; parse components rather than UTC timestamps. */
export function formatRecordDate(source:string,locale:Language=getLanguage()):string{
 const match=source.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
 if(!match)return source;
 const [,year,month,day]=match.map(Number),date=new Date(year,month-1,day);
 if(date.getFullYear()!==year||date.getMonth()!==month-1||date.getDate()!==day)return source;
 return date.toLocaleDateString(locale==='en'?'en-GB':'zh-CN');
}
