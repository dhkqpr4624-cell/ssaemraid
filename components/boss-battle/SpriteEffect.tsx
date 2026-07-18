'use client';
import { useEffect, useState } from 'react';
export function SpriteEffect({src,cols,rows,frames,duration=900,className='',onDone}:{src:string;cols:number;rows:number;frames?:number;duration?:number;className?:string;onDone?:()=>void}){
 const total=Math.max(1,Math.min(frames ?? cols*rows,cols*rows));
 const [f,setF]=useState(0);
 useEffect(()=>{setF(0);const step=duration/total;const t=setInterval(()=>setF(v=>{if(v>=total-1){clearInterval(t);setTimeout(()=>onDone?.(),0);return v}return v+1}),step);return()=>clearInterval(t)},[src,duration,total,onDone]);
 const col=f%cols,row=Math.floor(f/cols);
 return <div className={`pointer-events-none overflow-hidden bg-no-repeat ${className}`} style={{backgroundImage:`url('${src}')`,backgroundSize:`${cols*100}% ${rows*100}%`,backgroundPosition:`${cols===1?0:col*100/(cols-1)}% ${rows===1?0:row*100/(rows-1)}%`,imageRendering:'pixelated'}}/>;
}
