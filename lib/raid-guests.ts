import { supabase } from './supabase';
import type { AvatarState, Item, Student } from './types';

export interface RaidGuest { id:string; roomCode:string; nickname:string; joinOrder:number; avatarState:AvatarState; items:Item[]; createdAt:string; updatedAt:string }
const enabled=!!process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=(code:string)=>`ssaemraid_guests_${code.toUpperCase()}`;
const toStudent=(g:RaidGuest):Student=>({id:g.id,classId:g.roomCode,attendanceNumber:g.joinOrder,nickname:g.nickname,score:0,coins:0,items:g.items||[],avatarId:'raid-random',avatarState:g.avatarState,roomDecorations:[]});
export function raidGuestToStudent(g:RaidGuest){return toStudent(g)}
export async function listRaidGuests(roomCode:string):Promise<RaidGuest[]>{ const code=roomCode.toUpperCase(); if(enabled){const {data,error}=await supabase.from('raid_guests').select('*').eq('room_code',code).order('join_order'); if(!error)return (data||[]).map((r:any)=>({id:r.id,roomCode:r.room_code,nickname:r.nickname,joinOrder:r.join_order,avatarState:r.avatar_state,items:r.items||[],createdAt:r.created_at,updatedAt:r.updated_at}));} if(typeof window==='undefined')return []; return JSON.parse(localStorage.getItem(key(code))||'[]'); }

export async function findRaidGuestByNickname(roomCode:string,nickname:string):Promise<RaidGuest|null>{
 const target=nickname.trim().toLocaleLowerCase();
 if(!target)return null;
 const guests=await listRaidGuests(roomCode);
 return guests.slice().reverse().find(g=>g.nickname.trim().toLocaleLowerCase()===target)||null;
}
export async function createRaidGuest(roomCode:string,nickname:string,avatarState:AvatarState,items:Item[]):Promise<RaidGuest>{
 const code=roomCode.toUpperCase(), cleanNickname=nickname.trim();
 if(enabled){
  // 입장 순번 계산과 40명 제한을 DB 트랜잭션 안에서 처리하여
  // 여러 학생이 동시에 들어와도 같은 join_order가 생기지 않게 합니다.
  const {data,error}=await supabase.rpc('ssaemraid_create_raid_guest',{
   p_room_code:code,p_nickname:cleanNickname,p_avatar_state:avatarState,p_items:items
  });
  if(!error&&data){
   const r:any=Array.isArray(data)?data[0]:data;
   return {id:r.id,roomCode:r.room_code,nickname:r.nickname,joinOrder:r.join_order,avatarState:r.avatar_state,items:r.items||[],createdAt:r.created_at,updatedAt:r.updated_at};
  }
  throw new Error(error?.message||'보스전 입장에 실패했습니다.');
 }
 const existing=await listRaidGuests(code);
 if(existing.length>=40)throw new Error('보스전에는 최대 40명까지 참여할 수 있습니다.');
 const g:RaidGuest={id:crypto.randomUUID(),roomCode:code,nickname:cleanNickname,joinOrder:(existing.reduce((m,x)=>Math.max(m,x.joinOrder),0)+1),avatarState,items,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
 localStorage.setItem(key(code),JSON.stringify([...existing,g])); return g;
}
export async function updateRaidGuest(g:RaidGuest){g.updatedAt=new Date().toISOString(); if(enabled){const {error}=await supabase.from('raid_guests').update({nickname:g.nickname,avatar_state:g.avatarState,items:g.items,updated_at:g.updatedAt}).eq('id',g.id); if(error)throw new Error(error.message); return;} const all=await listRaidGuests(g.roomCode); localStorage.setItem(key(g.roomCode),JSON.stringify(all.map(x=>x.id===g.id?g:x)));}
export async function deleteRaidGuest(id:string,roomCode:string){if(enabled){await supabase.from('raid_guests').delete().eq('id',id);return;} const all=await listRaidGuests(roomCode);localStorage.setItem(key(roomCode),JSON.stringify(all.filter(x=>x.id!==id)));}
export function saveRaidGuestSession(g:RaidGuest){sessionStorage.setItem('ssaemraid_guest',JSON.stringify(g));}
export function getRaidGuestSession():RaidGuest|null{if(typeof window==='undefined')return null;try{return JSON.parse(sessionStorage.getItem('ssaemraid_guest')||'null')}catch{return null}}
