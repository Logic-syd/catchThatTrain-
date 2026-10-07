export type Point={x:number;y:number};
export type Box=Point&{w:number;h:number};
export const STATION_OBSTACLES:Box[]=[
 {x:69,y:426,w:153,h:49},{x:409,y:427,w:153,h:49},
 {x:54,y:555,w:158,h:50},{x:277,y:558,w:126,h:58},
 {x:50,y:698,w:166,h:27},{x:424,y:698,w:166,h:27},
 {x:38,y:871,w:133,h:52},{x:467,y:873,w:130,h:52},
 {x:39,y:1332,w:176,h:35},
 {x:247,y:1350,w:145,h:31},{x:466,y:1234,w:127,h:63}
];
export function isBlocked(p:Point,solids=STATION_OBSTACLES){
 return p.x<27||p.x>613||p.y<25||p.y>1560||solids.some(b=>p.x>b.x-13&&p.x<b.x+b.w+13&&p.y>b.y-13&&p.y<b.y+b.h+13);
}
export function findWalkPath(start:Point,dest:Point,solids=STATION_OBSTACLES):Point[]{
 if(!Number.isFinite(dest.x)||!Number.isFinite(dest.y))return [];
 const size=20,cols=32,rows=79,sx=Math.floor(start.x/size),sy=Math.floor(start.y/size);
 const tx=Math.max(1,Math.min(30,Math.floor(dest.x/size))),ty=Math.max(1,Math.min(77,Math.floor(dest.y/size)));
 const key=(x:number,y:number)=>y*cols+x;
 const queue=[[sx,sy]],seen=new Map<number,number>();seen.set(key(sx,sy),-1);
 let end=key(sx,sy),best=Infinity;
 // Select the nearest reachable cell, even when pointer rounding lands inside
 // a padded obstacle. A valid click beside a wall must not silently do nothing.
 for(let i=0;i<queue.length;i++){
  const [x,y]=queue[i],p={x:x*size+10,y:y*size+10},distance=Math.hypot(p.x-dest.x,p.y-dest.y);
  if(!isBlocked(p,solids)&&distance<best){best=distance;end=key(x,y);}
  if(x===tx&&y===ty&&!isBlocked(p,solids)){end=key(x,y);break;}
  for(const [dx,dy] of [[0,-1],[1,0],[0,1],[-1,0]]){
   const nx=x+dx,ny=y+dy,k=key(nx,ny);
   if(nx<0||nx>=cols||ny<0||ny>=rows||seen.has(k)||isBlocked({x:nx*size+10,y:ny*size+10},solids))continue;
   seen.set(k,key(x,y));queue.push([nx,ny]);
  }
 }
 const path:Point[]=[];
 while(end!==-1&&end!==key(sx,sy)){path.unshift({x:(end%cols)*size+10,y:Math.floor(end/cols)*size+10});end=seen.get(end)??-1;}
 return path;
}
