import {useState} from 'react';
import {Trophy,LockKeyhole,RotateCcw,Download,Share2} from 'lucide-react';
import {formatTime,type Run} from './engine';
import {summarizeRun,lossLabels} from './outcomes';
import {stationFor} from './stations';
import {ACHIEVEMENTS,featuredUnlock,isCharacterUnlocked,newlyUnlockedCharacter,type Progress} from './achievements';
import {StudentReport} from './StudentUI';
import {StationMap} from './StationMaps';
const categories=[['all','全部'],['general','通用'],['student','大学生'],['worker','打工人'],['tourist','游客'],['mother','带娃家长'],['family','家庭'],['station','车站'],['hidden','隐藏']] as const;
const rarities={common:'普通',uncommon:'特别',rare:'稀有',legendary:'传说'};
export function failureRemark(gapSeconds:number,runId:string,errors:number){
 const gap=Math.max(0,Math.ceil(gapSeconds));
 const lines=gap<=100?[
  '就差一点点了，下次一定赶得上。',
  '这趟擦肩而过，真的只差一点。',
  '再快一点点，结局就不一样了。',
 ]:gap<=200?[
  '这次吃了点亏，下次记住这趟的教训。',
  '下次把时间留给关键路段，还有机会。',
  '差距不算大，下次要吸取这趟的教训。',
 ]:errors>=2?[
  '一路上走错、耽搁太多，这趟追不上了。',
  '失误一件接一件，最后差得有点远。',
  '一路上踩了太多坑，下次得换个走法。',
 ]:[
  '一路上耽搁太多，这趟差得有点远。',
  '这趟耗时太多，下次得重新安排节奏。',
  '差得有点远，下次先把时间留给赶路。',
 ];
 const hash=Array.from(runId).reduce((total,char)=>total+char.charCodeAt(0),0);
 return lines[hash%lines.length];
}
export function AchievementShelf({progress}:{progress:Progress}){
 const [category,setCategory]=useState('all');const visible=ACHIEVEMENTS.filter(a=>(!a.legacy||progress.unlocked[a.id])&&(category==='all'||category==='hidden'?category==='all'||a.hidden:a.category===category&&!a.hidden));
 const active=ACHIEVEMENTS.filter(a=>!a.legacy||progress.unlocked[a.id]);
 return <div className="achievement-shelf"><p>已解锁 {active.filter(a=>progress.unlocked[a.id]).length} / {active.length} · 当前连胜 {progress.streak} · 最长连胜 {progress.bestWinStreak}</p><nav className="achievement-filters" aria-label="成就分类">{categories.map(([id,label])=><button key={id} aria-pressed={id===category} onClick={()=>setCategory(id)}>{label}</button>)}</nav>{['worker','tourist','mother'].includes(category)&&<p className="achievement-note">{category==='worker'?(isCharacterUnlocked(progress,'worker')?'打工人已解锁，可以开始累计对应成就。':'大学生赶上一次后解锁打工人。'):category==='tourist'?(isCharacterUnlocked(progress,'tourist')?'疲惫游客已解锁，可以开始累计对应成就。':'打工人赶上一次后解锁疲惫游客。'):(isCharacterUnlocked(progress,'mom')?'带娃家长已解锁，可以开始累计对应成就。':'疲惫游客赶上一次后解锁带娃家长。')}</p>}{category==='family'&&<p className="achievement-note">婴儿车家庭章节尚未开放。</p>}<div className="achievement-grid">{visible.map(a=>{const unlocked=progress.unlocked[a.id],hidden=a.hidden&&!unlocked,p=progress.achievementProgress[a.id];return <article key={a.id} className={unlocked?'unlocked':'locked'}>{unlocked?<Trophy size={23}/>:<LockKeyhole size={21}/>}<div><b>{hidden?'未发现的故事':a.name}</b><small>{hidden?'在赶车途中，藏着意料之外的经历。':a.description}</small>{!hidden&&<><span className={'rarity rarity-'+a.rarity}>{rarities[a.rarity]}</span>{unlocked?<small>解锁于 {new Date(unlocked.at).toLocaleDateString('zh-CN')}</small>:<div className="achievement-progress"><progress max={a.target} value={p?.current??0}/><span>{p?.current??0} / {a.target}</span></div>}</>}</div>{unlocked&&<em>已解锁</em>}</article>;})}</div></div>;
}
export default function Results({run,progress,saved,replay,share,saveImage=share,selectStation}:{run:Run;progress:Progress;saved:boolean;replay:()=>void;share:()=>void;saveImage?:()=>void;selectStation:()=>void}){
 const o=summarizeRun(run),r=o.result,st=stationFor(run),fresh=progress.lastRunId===run.id?progress.lastUnlocks:[],featured=featuredUnlock(fresh),newCharacter=newlyUnlockedCharacter(progress,run);
 return <section className={'end-scene results-v3 '+(run.success?'won':'lost')}>
  <header className="result-heading"><span className="chapter-sticker">{st.name} · {run.success?'赶上了！':'没赶上'}</span><h1>{o.title}</h1><p className="result-margin">{run.success?<>检票还剩 <strong>{Math.ceil(r.resultMarginSeconds)} 秒</strong></>:o.distanceToTarget!==null?<>距{run.gatePassed?'车门':'检票口'}约 <strong>{o.distanceToTarget} 米</strong></>:<>止步{run.metrics.endPhase==='preparation'?'出门准备':run.metrics.endPhase==='route'?'路线选择':'地铁途中'}</>}{!run.success&&<small>{failureRemark(-r.resultMarginSeconds,run.id,r.errors)}</small>}</p><div className="result-tags">{o.tags.map(t=><span key={t}>#{t}</span>)}</div><p className="result-summary">{o.summary}</p><button className="share-result-button" onClick={share}><Share2 size={19}/>分享称号，叫朋友来挑战</button></header>
  <div className="reason-card"><h2>{run.success?'这局你为什么赶上了':'这局你为什么没赶上'}</h2><ul className="factor-list">{o.factors.map(i=><li key={i.id}><div><b>{i.source}</b><small>{i.decisive?(i.positive?'关键贡献':'关键耗时'):'本局影响'}{!i.avoidable?' · 随机事件，无法避免':''}</small></div><strong className={i.positive?'time-gain':'time-loss'}>{i.estimated?'约 ':''}{i.positive?'+':'−'}{Math.round(Math.abs(i.deltaSeconds))}<small> 秒</small></strong></li>)}{o.reasons.slice(o.factors.length).map(t=><li className="factor-context" key={t}>{t}</li>)}</ul>{o.advice&&<p className="result-advice">{o.advice}</p>}</div>
  {newCharacter&&<aside className="character-unlock" role="status"><span aria-hidden="true">🔓</span><div><small>新人物解锁</small><b>{newCharacter==='worker'?'打工人':newCharacter==='tourist'?'疲惫游客':'带娃家长'}</b><p>再赶一趟，就能选这个人物出发。</p></div></aside>}
  {featured&&<aside className={'achievement-feature rarity-'+featured.rarity} role="status"><Trophy size={28}/><div><small>新成就 · {rarities[featured.rarity]}</small><b>{featured.name}</b><p>{featured.description}</p>{fresh.length>1&&<details><summary>另解锁 {fresh.length-1} 项成就</summary>{fresh.filter(id=>id!==featured.id).map(id=><p key={id}>{ACHIEVEMENTS.find(a=>a.id===id)?.name}</p>)}</details>}</div></aside>}
  <details className="result-details"><summary>本局表现与时间明细 <span>路线效率 {Math.round(r.routeEfficiency)}%</span></summary><div className="time-ledger"><div><span>主要时间损失</span><b>{o.largestLoss.seconds>0?lossLabels[o.largestLoss.source]+' · '+Math.round(o.largestLoss.seconds)+' 秒':'无额外损失记录'}</b></div><div><span>最大追回来源</span><b>{o.largestRecovery.seconds>0?o.largestRecovery.source+' · '+Math.round(o.largestRecovery.seconds)+' 秒':'无额外追回记录'}</b></div><div><span>走错 / 坐过站</span><b>{r.wrongTurns} / {r.missedStops} 次</b></div><div><span>检票余量 / 预计差距</span><b>{r.success?'+':'−'}{formatTime(Math.abs(r.resultMarginSeconds))}{r.marginEstimated?'（估算）':''}</b></div></div>{run.student&&<StudentReport run={run}/>} {run.characterTime&&<div className="report-grid character-result-grid"><span>最终{run.characterTime.characterId==='worker'?'体力':'精力'}<b>{Math.round(run.characterTime.energy)} / {run.characterTime.maxEnergy}</b></span><span>疲劳值<b>{Math.round(run.characterTime.fatigue)} / 100</b></span><span>负重<b>{Math.round(run.characterTime.load)} / 100</b></span>{run.characterTime.characterId==='worker'?<><span>妈妈留饭<b>{run.characterTime.motherStayed?'多陪了一会儿':'抱过妈妈就出发'}</b></span><span>老板催促<b>{run.characterTime.bossCalls?'路上打来 '+run.characterTime.bossCalls+' 次':run.characterTime.ignoredWork?'消息没回，老板没再打来':'已回复，老板没再追问'}</b></span><span>土特产<b>{run.characterTime.souvenirs?'带上了':'没带'}</b></span></>:<><span>地铁补觉<b>{run.characterTime.slept?'设了闹钟':'一直保持清醒'}</b></span><span>陌生站导航<b>{run.characterTime.mapChecked?'看图确认':'凭人流判断'}</b></span><span>坐过站<b>{r.missedStops} 次</b></span></>}</div>}{run.parent&&<div className="report-grid character-result-grid parent-result-grid"><span>家长精力<b>{Math.round(run.parent.energy)} / {run.parent.maxEnergy}</b></span><span>孩子体力<b>{Math.round(run.parent.childEnergy)} / 100</b></span><span>随身负重<b>{run.parent.load} / 100</b></span><span>孩子耐心<b>{Math.round(run.parent.patience)} / 100</b></span><span>孩子掉队<b>{run.parent.separationCount} 次</b></span><span>厕所处理<b>{run.parent.wetPants?"没忍住":run.parent.childToilet?"去过厕所":"没耽误"}</b></span><span>牵手冲刺<b>{run.parent.syncUsed?"用过":"没用"}</b></span></div>}<details className="impact-details"><summary>查看时间影响及比较基准</summary>{r.timeImpacts.map(i=><p key={i.id}>{i.source}：{i.deltaSeconds>0?'+':'−'}{Math.round(Math.abs(i.deltaSeconds))} 秒{ i.estimated?'（估算）':''}<small>{i.baseline??'本局实际扣时'} · {i.avoidable?'主动选择或操作':'随机环境'}</small></p>)}<small>时间影响用于比较选择，不与实际总用时再次相加。失败差距按剩余路径估算。</small></details><div className="station-lesson"><span>这次记住一个诀窍</span><b>{st.short}</b><p>{o.lesson}</p><StationMap station={st} run={run}/></div></details>
  <div className="end-buttons"><button className="big-action" onClick={replay}><RotateCcw size={19}/>{run.success?'再赶一趟！':'再试一次'}</button><button className="soft-action" onClick={saveImage}><Download size={19}/>留下战绩</button></div><button className="quiet-button" onClick={selectStation}>换一座车站挑战 →</button><p className="save-status">{saved?'徽章与进度已保存在本机。':'浏览器未允许保存；本次徽章已显示，关闭后可能无法保留。'}</p>
  <details className="result-details"><summary>我的成就册 <span>{Object.keys(progress.unlocked).length} 项已解锁</span></summary><AchievementShelf progress={progress}/></details>
 </section>;
}
