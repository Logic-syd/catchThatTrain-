import {localizeNode,translate} from './i18n';
import type {Run} from './engine';
import {MAZE_LOCATIONS,type TouristMaze} from './touristMaze';
const POSITIONS=[[25,65],[85,25],[150,25],[85,105],[150,105],[215,65]];
export function TouristMazeMap({maze}:{maze:TouristMaze}){
 return <div className="tourist-maze-map"><svg viewBox="0 0 245 135" role="img" aria-label={translate("已探索的岔路，问号是未到达区域")}>
  {localizeNode(maze.trail.map(([a,b],i)=><line key={i} x1={POSITIONS[a][0]} y1={POSITIONS[a][1]} x2={POSITIONS[b][0]} y2={POSITIONS[b][1]} stroke="#b28b55" strokeWidth="3"/>))}
  {localizeNode(POSITIONS.map(([x,y],i)=><g key={i}><circle cx={x} cy={y} r="15" fill={i===maze.node?'#e87942':i===5?'#76a16b':maze.visited.includes(i)?'#f4dfba':'#ebe4d5'}/><text x={x} y={y+5} textAnchor="middle" fill={i===maze.node?'white':'#775e3b'} fontSize="13">{localizeNode(i===maze.node?'你':i===5?'检':maze.visited.includes(i)?'·':'?')}</text></g>))}
 </svg><p>{localizeNode("现在：")}{localizeNode(MAZE_LOCATIONS[maze.node])}{localizeNode(" · 走过 ")}{localizeNode(maze.steps)}{localizeNode(" 段 · 问路 ")}{localizeNode(maze.asks)}{localizeNode(" 次 · 看路标 ")}{localizeNode(maze.signs)}{localizeNode(" 次")}</p><small>{localizeNode(maze.wrongTurns?`绕过 ${maze.wrongTurns} 次，经过的岔路会留在图上。`:'问路和路标能确认当前岔路，方向要自己选。')}</small></div>;
}
export function CharacterChallengeSummary({run}:{run:Run}){
 return <div className="report-grid character-challenge-summary">
  {localizeNode(run.student&&<><span>{localizeNode("幸福感 / 道德")}<b>{localizeNode(run.student.happiness)} / {localizeNode(run.student.morality)}</b></span><span>{localizeNode("路边停留")}<b>{localizeNode(run.student.distractions)}{localizeNode(" 次 · ")}{localizeNode(run.student.distractionSeconds)}{localizeNode(" 游戏秒")}</b></span></>)}
  {localizeNode(run.characterTime?.characterId==='worker'&&<span>{localizeNode("公司临时要求")}<b>{localizeNode(run.characterTime.workInterruptions)}{localizeNode(" 次")}</b></span>)}
  {localizeNode(run.touristMaze&&<><span>{localizeNode("寻路")}<b>{localizeNode(run.touristMaze.steps)}{localizeNode(" 段 · 绕路 ")}{localizeNode(run.touristMaze.wrongTurns)}{localizeNode(" 次")}</b></span><span>{localizeNode("确认方向")}<b>{localizeNode("问路 ")}{localizeNode(run.touristMaze.asks)}{localizeNode(" · 路标 ")}{localizeNode(run.touristMaze.signs)}</b></span></>)}
  {localizeNode(run.parent&&<><span>{localizeNode("最高怒气")}<b>{localizeNode(run.parent.angerPeak)} / 100</b></span><span>{localizeNode("情绪爆发")}<b>{localizeNode(run.parent.outbursts)}{localizeNode(" 次 · 处理 ")}{localizeNode(run.parent.rageDelaySeconds)}{localizeNode(" 游戏秒")}</b></span></>)}
 </div>;
}
