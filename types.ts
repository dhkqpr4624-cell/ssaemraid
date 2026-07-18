/**
 * 방 꾸미기 아이템 레지스트리
 *
 * 나중에 room item PNG를 추가할 때는 ROOM_ITEMS_REGISTRY에 한 줄만 추가하면
 * 교사 보상 선택, 학생 인벤토리, 방 배치 렌더링에서 같은 정의를 재사용합니다.
 */

import type { CSSProperties } from 'react';
import type { Item, RoomDirection } from './types';

export const ROOM_ITEM_IDS = {
  COMMON_BED: 'room_common_bed',
  COMMON_CHAIR: 'room_common_chair',
} as const;

export type RoomItemCategory = 'furniture' | 'floor' | 'wall' | 'decoration';

export interface RoomItemCatalogEntry extends Item {
  type: 'room';
  category: RoomItemCategory;
  rewardSelectable: boolean;
  imageUrl: string;
  iconUrl: string;
  spriteSheet: string;
  naturalWidth: number;
  naturalHeight: number;
  frameWidth: number;
  frameHeight: number;
  columns: number;
  rows: number;
  availableDirections: RoomDirection[];
  defaultDirection: RoomDirection;
  footprint: { w: number; h: number };
  /** render/collision tuning for isometric placement */
  renderWidth?: number;
  collision?: { halfW: number; halfH: number; offsetY: number };
  directionFrames: Partial<Record<RoomDirection, { col: number; row: number }>>;
}

export const ROOM_ITEMS_REGISTRY: RoomItemCatalogEntry[] = [
  {
    id: ROOM_ITEM_IDS.COMMON_BED,
    name: '평범한 침대',
    type: 'room',
    category: 'furniture',
    icon: '🛏️',
    iconUrl: '/assets/items/room/common_bed.png',
    imageUrl: '/assets/items/room/common_bed.png',
    spriteSheet: '/assets/items/room/common_bed.png',
    description: '편안한 휴식을 위한 평범한 침대입니다.',
    rarity: 'common',
    stackable: false,
    acquiredAt: 'system',
    rewardSelectable: true,
    naturalWidth: 236,
    naturalHeight: 80,
    frameWidth: 118,
    frameHeight: 80,
    columns: 2,
    rows: 1,
    availableDirections: ['NW', 'NE', 'SW', 'SE'],
    defaultDirection: 'NW',
    footprint: { w: 2, h: 1 },
    renderWidth: 118,
    collision: { halfW: 38, halfH: 12, offsetY: -5 },
    directionFrames: {
      NW: { col: 0, row: 0 },
      NE: { col: 1, row: 0 },
      SW: { col: 1, row: 0 },
      SE: { col: 0, row: 0 },
      left: { col: 0, row: 0 },
      right: { col: 1, row: 0 },
      front: { col: 1, row: 0 },
      back: { col: 0, row: 0 },
    },
  },
  {
    id: ROOM_ITEM_IDS.COMMON_CHAIR,
    name: '평범한 의자',
    type: 'room',
    category: 'furniture',
    icon: '🪑',
    iconUrl: '/assets/items/room/CommonChair.png',
    imageUrl: '/assets/items/room/CommonChair.png',
    spriteSheet: '/assets/items/room/CommonChair.png',
    description: '편안하게 앉을 수 있는 평범한 의자입니다.',
    rarity: 'common',
    stackable: false,
    acquiredAt: 'system',
    rewardSelectable: true,
    naturalWidth: 160,
    naturalHeight: 160,
    frameWidth: 80,
    frameHeight: 80,
    columns: 2,
    rows: 2,
    availableDirections: ['NW', 'NE', 'SW', 'SE'],
    defaultDirection: 'SW',
    footprint: { w: 1, h: 1 },
    renderWidth: 80,
    collision: { halfW: 22, halfH: 18, offsetY: -8 },
    // 사용자 기준: NW=뒤쪽 오른쪽, NE=뒤쪽 왼쪽, SW=앞쪽 왼쪽, SE=앞쪽 오른쪽
    // 현재 RoomDirection 4방향에 맞춰 가장 가까운 방향으로 매핑합니다.
    directionFrames: {
      NW: { col: 0, row: 0 },
      NE: { col: 1, row: 0 },
      SW: { col: 0, row: 1 },
      SE: { col: 1, row: 1 },
      back: { col: 0, row: 0 },
      right: { col: 1, row: 0 },
      left: { col: 0, row: 1 },
      front: { col: 1, row: 1 },
    },
  },
];

export function getRoomItemById(itemId?: string | null): RoomItemCatalogEntry | undefined {
  if (!itemId) return undefined;
  return ROOM_ITEMS_REGISTRY.find(item => item.id === itemId);
}

export function getAllRoomItems(): RoomItemCatalogEntry[] {
  return ROOM_ITEMS_REGISTRY;
}

export function searchRoomItems(query: string): RoomItemCatalogEntry[] {
  const lowerQuery = query.toLowerCase().trim();
  if (!lowerQuery) return ROOM_ITEMS_REGISTRY;
  return ROOM_ITEMS_REGISTRY.filter(item =>
    item.name.toLowerCase().includes(lowerQuery) ||
    (item.description || '').toLowerCase().includes(lowerQuery)
  );
}

export function filterRoomItemsByRarity(rarity: string): RoomItemCatalogEntry[] {
  return ROOM_ITEMS_REGISTRY.filter(item => item.rarity === rarity);
}

export function getRoomItemCatalogIdFromItem(item: any): string | undefined {
  return item?.catalogItemId || item?.itemId || item?.id;
}

export function getRoomItemFrame(itemId?: string | null, direction: RoomDirection = 'front') {
  const item = getRoomItemById(itemId);
  if (!item) return undefined;
  return item.directionFrames[direction] || item.directionFrames[item.defaultDirection] || { col: 0, row: 0 };
}

export function getDirectionFrameOffset(itemId: string, direction: RoomDirection = 'front'): number {
  const item = getRoomItemById(itemId);
  const frame = getRoomItemFrame(itemId, direction);
  if (!item || !frame) return 0;
  return frame.col * item.frameWidth;
}

export function getDirectionFrameOffsetY(itemId: string, direction: RoomDirection = 'front'): number {
  const item = getRoomItemById(itemId);
  const frame = getRoomItemFrame(itemId, direction);
  if (!item || !frame) return 0;
  return frame.row * item.frameHeight;
}

/**
 * 스프라이트 시트 중 특정 방향 프레임만 보여주는 CSS.
 * <img>를 그대로 쓰면 시트 전체가 보이므로, room item 아이콘/배치 이미지는 이 함수를 사용합니다.
 */
export function getRoomItemFrameStyle(
  itemId?: string | null,
  direction: RoomDirection = 'front',
  displayWidth = 64
): CSSProperties {
  const item = getRoomItemById(itemId);
  if (!item) return {};

  const frame = getRoomItemFrame(item.id, direction) || { col: 0, row: 0 };
  const scale = displayWidth / item.frameWidth;
  const displayHeight = Math.round(item.frameHeight * scale);

  return {
    width: `${Math.round(displayWidth)}px`,
    height: `${displayHeight}px`,
    backgroundImage: `url('${item.spriteSheet}')`,
    backgroundSize: `${Math.round(item.naturalWidth * scale)}px ${Math.round(item.naturalHeight * scale)}px`,
    backgroundPosition: `-${Math.round(frame.col * item.frameWidth * scale)}px -${Math.round(frame.row * item.frameHeight * scale)}px`,
    backgroundRepeat: 'no-repeat',
    imageRendering: 'pixelated',
  };
}

function normalizeFootprintValue(raw: any, roomSize?: string) {
  const fallback = roomSize === '320x320'
    ? { w: 2, h: 2 }
    : roomSize === '320x160'
      ? { w: 2, h: 1 }
      : undefined;
  if (!raw && !fallback) return undefined;
  const w = Number(raw?.w ?? raw?.width ?? fallback?.w ?? 1);
  const h = Number(raw?.h ?? raw?.height ?? fallback?.h ?? 1);
  return {
    w: Math.max(1, Math.min(2, Number.isFinite(w) ? w : 1)),
    h: Math.max(1, Math.min(2, Number.isFinite(h) ? h : 1)),
  };
}

export function normalizeRoomRewardItem(reward: any, inventoryId?: string): Item & Record<string, any> {
  const catalog = getRoomItemById(reward?.itemId);
  const roomSize = reward?.roomSize || catalog?.roomSize;
  const fallbackFootprint = normalizeFootprintValue(undefined, roomSize);
  const normalizedFootprint = normalizeFootprintValue(reward?.footprint, roomSize) || catalog?.footprint || fallbackFootprint;

  return {
    id: inventoryId || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `item-${Date.now()}`),
    itemId: reward?.itemId || catalog?.id,
    catalogItemId: reward?.itemId || catalog?.id,
    name: reward?.itemName || catalog?.name || '방 아이템',
    type: 'room',
    icon: reward?.itemIcon || catalog?.icon || '📦',
    iconUrl: reward?.itemImageUrl || catalog?.iconUrl,
    imageUrl: reward?.itemImageUrl || catalog?.imageUrl,
    description: reward?.itemDescription || catalog?.description,
    rarity: 'common',
    acquiredAt: new Date().toISOString(),
    // item-editor 제작 room item metadata 보존
    roomSize,
    spriteConfig: reward?.spriteConfig || catalog?.spriteConfig,
    directionImages: reward?.directionImages,
    availableDirections: reward?.availableDirections || catalog?.availableDirections,
    defaultDirection: reward?.defaultDirection || catalog?.defaultDirection || reward?.availableDirections?.[0],
    footprint: normalizedFootprint,
  };
}
