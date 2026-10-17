import {afterEach,describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {createCharacterStationRun,reducer,type Run} from './engine';
import {buildStationJourney} from './stationJourney';
import {STUDENT_DISTRACTIONS} from './characterChallenges';
import {getLanguage,setLanguage} from './i18n';
import RoadsideNotice from './RoadsideNotice';

function notice(id='student-cat',station='shanghai'):Run{
 const base=createCharacterStationRun(station,'student',false,()=>.5),stationJourney=buildStationJourney(base);
 const stationBeat=stationJourney.findIndex(beat=>beat.id===id);
 expect(stationBeat).toBeGreaterThanOrEqual(0);
 return reducer(base,{type:'NEW',run:{...base,phase:'station',stationJourney,stationBeat,stationProgress:.25}});
}
const html=(run:Run,disabled=false)=>renderToStaticMarkup(<RoadsideNotice run={run} disabled={disabled} dispatch={()=>{}}/>);
afterEach(()=>setLanguage('zh'));

describe('optional roadside notices',()=>{
 it('offers one acceptance button, with a short pass-by hint and the real activity cost',()=>{
  const run=notice(),rendered=html(run);
  expect((rendered.match(/<button/g)??[]).length).toBe(1);
  expect(rendered).toContain('小猫蹭过来了');expect(rendered).toContain('想停就点，不点就路过');
  expect(rendered).toContain('幸福感 +20');expect(rendered).toContain('30 游戏秒');
  expect(rendered).toContain('aria-label="路边小诱惑"');
  expect(rendered).toContain('data-roadside="student-cat"');
  expect(rendered).toContain(`data-revision="${run.roadsideNotice!.revision}"`);
  expect(rendered).not.toContain('role="dialog"');expect(rendered).not.toContain('继续赶路</button>');
 });
 it('uses the existing elapsed clock for the five-second countdown and never restarts it on render',()=>{
  const run=notice(),expiresAt=run.roadsideNotice!.expiresAt,before=JSON.stringify(run);
  expect(html(run)).toContain('>5<small>s</small>');
  const later={...run,elapsed:run.elapsed+2.2};
  expect(html(later)).toContain('>3<small>s</small>');
  expect(html(later)).not.toContain('>5<small>s</small>');
  expect(run.roadsideNotice!.expiresAt).toBe(expiresAt);expect(JSON.stringify(run)).toBe(before);
  expect(html({...run,elapsed:expiresAt})).toBe('');
 });
 it('keeps mandatory tasks and external sheets unobstructed without extending the deadline',()=>{
  const run=notice(),event={id:'identity-search',phase:'station' as const,title:'找身份证',description:'',choices:[]};
  for(const rendered of [html({...run,event}),html(run,true)])expect(rendered).toBe('');
  expect(html({...run,elapsed:run.elapsed+2})).toContain('>3<small>s</small>');
  expect(html(run)).not.toContain('disabled=""');
 });
 it.each(STUDENT_DISTRACTIONS)('$id supports both languages without changing the notice or its revision',activity=>{
  const run=notice(activity.id,'beijing'),before=JSON.stringify(run);
  setLanguage('zh');expect(html(run)).toContain(activity.id);
  setLanguage('en');const rendered=html(run),visible=rendered.replace(/<[^>]*>/g,' ');
  expect(getLanguage()).toBe('en');expect(visible).not.toMatch(/[\u3400-\u9fff]/);
  expect(rendered).toContain(activity.id);expect(rendered).toContain('>5<small>s</small>');
  expect(rendered).toContain(`data-revision="${run.roadsideNotice!.revision}"`);
  expect(JSON.stringify(run)).toBe(before);
 });
 it('uses decorative local tea art across the three station styles with the task name still readable',()=>{
  const styles=new Set<string>();
  for(const station of ['shanghai','hangzhou','guangzhou']){
   const rendered=html(notice('student-tea-shop',station));
   expect(rendered).toContain('<svg');expect(rendered).toContain('aria-hidden="true"');
   expect(rendered).toContain('data-roadside="student-tea-shop"');expect(rendered).toContain('25 游戏秒');
   styles.add(rendered.match(/tea-shop-icon--(\w+)/)![1]);
  }
  expect(styles.size).toBe(3);
 });
});
