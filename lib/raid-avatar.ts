import type { AvatarSlot, AvatarState, Item } from './types';
import { DEFAULT_AVATAR_ITEMS } from './default-avatar-items';
import { REWARD_FOLDER_ITEMS } from './reward-folder-items';
const COLORS={skin:['#FFE0BD','#F1C27D','#E0AC69','#C68642','#8D5524'],hair:['#2A1B12','#3B2F2F','#6B3E26','#A56B46','#E8D7B7','#546E7A','#7B1FA2','#1565C0'],eye:['#6B4423','#2E7D32','#1565C0','#6A1B9A','#37474F','#D4A017']};
export const RAID_AVATAR_ITEMS:Item[]=[...DEFAULT_AVATAR_ITEMS,...REWARD_FOLDER_ITEMS.filter((x:any)=>x.type==='avatar').map((x:any)=>({...x,id:x.id,acquiredAt:new Date(0).toISOString()} as Item))];
const pick=<T,>(a:T[])=>a[Math.floor(Math.random()*a.length)];
export function randomRaidAvatar(){const slots:AvatarSlot[]=['cape','hair','eyes','eyebrow','mouth','face','top','bottom','shoes','hat','headAccessory','accessory','pet']; const equipped:any={}; for(const slot of slots){const choices=RAID_AVATAR_ITEMS.filter(x=>x.slot===slot); if(choices.length && (['hair','eyes','top','bottom','shoes'].includes(slot)||Math.random()>.35)) equipped[slot]=pick(choices).id;} const state:AvatarState={skinColor:pick(COLORS.skin),hairColor:pick(COLORS.hair),eyeColor:pick(COLORS.eye),equipped}; return {state,items:RAID_AVATAR_ITEMS};}
export {COLORS as RAID_AVATAR_COLORS};
