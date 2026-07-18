import type { ItemType, AvatarSlot } from './types';
import type { RewardCategoryMeta } from './reward-categories';

export interface CustomRewardItem {
  id: string;
  name: string;
  type: ItemType;
  category?: string;
  slot?: AvatarSlot;
  rarity?: string;
  icon?: string;
  iconUrl?: string;
  imageUrl?: string;
  layerImageUrl?: string;
  tintMaskUrl?: string;
  overlayImageUrl?: string;
  hairLayerMode?: 'singleColorMask' | 'triple' | 'six';
  shadowImageUrl?: string;
  outlineImageUrl?: string;
  eyeShadowImageUrl?: string;
  underTintMaskUrl?: string;
  underShadowImageUrl?: string;
  underOutlineImageUrl?: string;
  upperTintMaskUrl?: string;
  upperShadowImageUrl?: string;
  upperOutlineImageUrl?: string;
  directionImages?: Record<string, string>;
  availableDirections?: string[];
  isAnimated?: boolean;
  roomSize?: string;
  spriteConfig?: {
    columns: number;
    rows: number;
    frameWidth: number;
    frameHeight: number;
  };
  footprint?: { w: number; h: number };
  defaultDirection?: string;
  description?: string;
  acquiredAt?: string;
  curriculum?: RewardCategoryMeta;
  grade?: string;
  semester?: string;
  subject?: string;
  unit?: string;
  source?: 'custom-editor' | 'imported';
}

const CUSTOM_ITEMS_KEY = 'ssaemquest_custom_reward_items_v1';

function canUseStorage() {
  return typeof window !== 'undefined' && !!window.localStorage;
}

export function normalizeCustomItem(raw: any): CustomRewardItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const type = raw.type || raw.itemType;
  if (!['avatar', 'room', 'badge', 'decoration', 'etc'].includes(type)) return null;

  const id = String(raw.id || `custom_${type}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
  const name = String(raw.name || raw.itemName || '이름 없는 아이템');
  const imageUrl = raw.imageUrl || raw.itemImageUrl || raw.iconUrl;
  const iconUrl = raw.iconUrl || imageUrl;

  return {
    ...raw,
    id,
    name,
    type,
    category: raw.category || (type === 'room' ? 'furniture' : undefined),
    slot: raw.slot || raw.itemSlot,
    rarity: raw.rarity || 'common',
    icon: raw.icon || raw.itemIcon || (type === 'room' ? '🪑' : type === 'badge' ? '🏅' : '🎨'),
    iconUrl,
    imageUrl,
    layerImageUrl: raw.layerImageUrl,
    tintMaskUrl: raw.tintMaskUrl,
    overlayImageUrl: raw.overlayImageUrl,
    hairLayerMode: raw.hairLayerMode,
    shadowImageUrl: raw.shadowImageUrl,
    outlineImageUrl: raw.outlineImageUrl,
    eyeShadowImageUrl: raw.eyeShadowImageUrl,
    underTintMaskUrl: raw.underTintMaskUrl,
    underShadowImageUrl: raw.underShadowImageUrl,
    underOutlineImageUrl: raw.underOutlineImageUrl,
    upperTintMaskUrl: raw.upperTintMaskUrl,
    upperShadowImageUrl: raw.upperShadowImageUrl,
    upperOutlineImageUrl: raw.upperOutlineImageUrl,
    directionImages: raw.directionImages,
    availableDirections: raw.availableDirections,
    isAnimated: !!raw.isAnimated,
    roomSize: raw.roomSize,
    spriteConfig: raw.spriteConfig,
    footprint: raw.footprint || (raw.roomSize === '640x640'
      ? { w: 4, h: 4 }
      : raw.roomSize === '480x480'
        ? { w: 3, h: 3 }
        : raw.roomSize === '320x320'
          ? { w: 2, h: 2 }
          : raw.roomSize === '640x160'
            ? { w: 4, h: 1 }
            : raw.roomSize === '480x160'
              ? { w: 3, h: 1 }
              : raw.roomSize === '320x160'
                ? { w: 2, h: 1 }
                : undefined),
    defaultDirection: raw.defaultDirection,
    description: raw.description || `${name} (제작 아이템)`,
    curriculum: raw.curriculum || raw.rewardCategory || raw.categoryMeta,
    grade: raw.grade || raw.curriculum?.grade || raw.rewardCategory?.grade || raw.categoryMeta?.grade,
    semester: raw.semester || raw.curriculum?.semester || raw.rewardCategory?.semester || raw.categoryMeta?.semester,
    subject: raw.subject || raw.curriculum?.subject || raw.rewardCategory?.subject || raw.categoryMeta?.subject,
    unit: raw.unit || raw.curriculum?.unit || raw.rewardCategory?.unit || raw.categoryMeta?.unit,
    acquiredAt: raw.acquiredAt || new Date().toISOString(),
    source: raw.source || 'custom-editor',
  } as CustomRewardItem;
}

export function getCustomItems(): CustomRewardItem[] {
  if (!canUseStorage()) return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(CUSTOM_ITEMS_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeCustomItem).filter(Boolean) as CustomRewardItem[];
  } catch {
    return [];
  }
}

export function saveCustomItem(raw: any): CustomRewardItem {
  if (!canUseStorage()) throw new Error('localStorage를 사용할 수 없습니다.');
  const item = normalizeCustomItem(raw);
  if (!item) throw new Error('저장할 수 없는 아이템 형식입니다.');
  const items = getCustomItems();
  const existingIndex = items.findIndex(i => i.id === item.id);
  const next = existingIndex >= 0
    ? items.map(i => i.id === item.id ? item : i)
    : [...items, item];
  localStorage.setItem(CUSTOM_ITEMS_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('ssaemquest-custom-items-updated'));
  return item;
}

export function importCustomItem(raw: any): CustomRewardItem {
  const item = normalizeCustomItem({ ...raw, id: raw?.id || undefined, source: 'imported' });
  if (!item) throw new Error('유효하지 않은 아이템 JSON입니다.');
  return saveCustomItem(item);
}

export function searchCustomItems(query: string): CustomRewardItem[] {
  const q = query.trim().toLowerCase();
  const items = getCustomItems();
  if (!q) return items;
  return items.filter(item =>
    item.name.toLowerCase().includes(q) ||
    item.id.toLowerCase().includes(q) ||
    String(item.type).toLowerCase().includes(q) ||
    String(item.category || '').toLowerCase().includes(q)
  );
}

export function clearCustomItemsForDebug() {
  if (canUseStorage()) localStorage.removeItem(CUSTOM_ITEMS_KEY);
}
