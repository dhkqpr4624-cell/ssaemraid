import type { AvatarState, Item } from './types';
import { DEFAULT_AVATAR_ASSETS, DEFAULT_AVATAR_COLORS } from './avatar-assets';
import { REWARD_FOLDER_ITEMS } from './reward-folder-items';

const acquiredAt = 'default';

export const DEFAULT_AVATAR_ITEM_IDS = {
  hair: 'default_hair',
  commonHairShort: 'common_hair_short',
  commonBobcut: 'common_bobcut',
  eyes: 'default_eyes',
  eyebrow: 'default_eyebrow',
  mouth: 'default_mouth',
} as const;

export const DEFAULT_AVATAR_ITEMS: Item[] = [
  {
    id: DEFAULT_AVATAR_ITEM_IDS.commonHairShort,
    name: '평범한 숏컷',
    type: 'avatar',
    slot: 'hair',
    icon: '💇',
    // outline/base color 파일이 없어도 동작하도록 shadow 파일을 color mask로도 사용합니다.
    imageUrl: DEFAULT_AVATAR_ASSETS.commonHairShortUnderShadow,
    tintMaskUrl: DEFAULT_AVATAR_ASSETS.commonHairShortUnderColor,
    shadowImageUrl: DEFAULT_AVATAR_ASSETS.commonHairShortUnderShadow,
    underTintMaskUrl: DEFAULT_AVATAR_ASSETS.commonHairShortUnderColor,
    underShadowImageUrl: DEFAULT_AVATAR_ASSETS.commonHairShortUnderShadow,
    upperTintMaskUrl: DEFAULT_AVATAR_ASSETS.commonHairShortUpperColor,
    upperShadowImageUrl: DEFAULT_AVATAR_ASSETS.commonHairShortUpperShadow,
    hairLayerMode: 'six',
    description: '처음부터 가지고 있는 평범한 숏컷 머리입니다.',
    rarity: 'common',
    acquiredAt,
  },

  {
    id: DEFAULT_AVATAR_ITEM_IDS.commonBobcut,
    name: '평범한 단발머리',
    type: 'avatar',
    slot: 'hair',
    icon: '💇',
    imageUrl: DEFAULT_AVATAR_ASSETS.commonBobcutUnderOutline,
    tintMaskUrl: DEFAULT_AVATAR_ASSETS.commonBobcutUnderColor,
    shadowImageUrl: DEFAULT_AVATAR_ASSETS.commonBobcutUnderShadow,
    outlineImageUrl: DEFAULT_AVATAR_ASSETS.commonBobcutUnderOutline,
    underTintMaskUrl: DEFAULT_AVATAR_ASSETS.commonBobcutUnderColor,
    underShadowImageUrl: DEFAULT_AVATAR_ASSETS.commonBobcutUnderShadow,
    underOutlineImageUrl: DEFAULT_AVATAR_ASSETS.commonBobcutUnderOutline,
    upperTintMaskUrl: DEFAULT_AVATAR_ASSETS.commonBobcutUpperColor,
    upperShadowImageUrl: DEFAULT_AVATAR_ASSETS.commonBobcutUpperShadow,
    upperOutlineImageUrl: DEFAULT_AVATAR_ASSETS.commonBobcutUpperOutline,
    hairLayerMode: 'six',
    description: '처음부터 가지고 있는 평범한 단발머리입니다.',
    rarity: 'common',
    acquiredAt,
  },
  {
    id: DEFAULT_AVATAR_ITEM_IDS.eyes,
    name: '기본 눈',
    type: 'avatar',
    slot: 'eyes',
    icon: '👀',
    imageUrl: DEFAULT_AVATAR_ASSETS.eyeBase,
    tintMaskUrl: DEFAULT_AVATAR_ASSETS.eyeIris,
    description: '처음부터 가지고 있는 기본 눈입니다.',
    rarity: 'common',
    acquiredAt,
  },
  {
    id: DEFAULT_AVATAR_ITEM_IDS.eyebrow,
    name: '기본 눈썹',
    type: 'avatar',
    slot: 'eyebrow',
    icon: '〰️',
    imageUrl: DEFAULT_AVATAR_ASSETS.eyebrow,
    description: '처음부터 가지고 있는 기본 눈썹입니다.',
    rarity: 'common',
    acquiredAt,
  },
  {
    id: DEFAULT_AVATAR_ITEM_IDS.mouth,
    name: '기본 입',
    type: 'avatar',
    slot: 'mouth',
    icon: '👄',
    imageUrl: DEFAULT_AVATAR_ASSETS.mouth,
    description: '처음부터 가지고 있는 기본 입입니다.',
    rarity: 'common',
    acquiredAt,
  },
];

export const DEFAULT_EQUIPPED_AVATAR_ITEMS: AvatarState['equipped'] = {
  hair: DEFAULT_AVATAR_ITEM_IDS.commonBobcut,
  eyes: DEFAULT_AVATAR_ITEM_IDS.eyes,
  eyebrow: DEFAULT_AVATAR_ITEM_IDS.eyebrow,
  mouth: DEFAULT_AVATAR_ITEM_IDS.mouth,
};

export function ensureDefaultAvatarItems(items: Item[] | undefined | null): Item[] {
  const existing = Array.isArray(items)
    ? items.filter(item => item.id !== DEFAULT_AVATAR_ITEM_IDS.hair)
    : [];
  const defaultById = new Map(DEFAULT_AVATAR_ITEMS.map(item => [item.id, item]));
  const seenIds = new Set<string>();

  // 기존 학생 데이터에 이미 default_eyes 등이 들어 있어도,
  // 새로 추가된 tintMaskUrl / imageUrl(base layer) 같은 필드는 최신 기본값으로 보정합니다.
  const normalizedExisting = existing.map(item => {
    seenIds.add(item.id);
    const defaultItem = defaultById.get(item.id);
    if (defaultItem) {
      return {
        ...item,
        ...defaultItem,
        // acquiredAt은 기존 값이 있으면 유지합니다.
        acquiredAt: item.acquiredAt || defaultItem.acquiredAt,
      };
    }

    // 이전 버전에서 보상 아이콘을 imageUrl로 저장한 학생 인벤토리 데이터 복구.
    // 카탈로그 아이템이면 iconUrl은 카드용 아이콘으로 유지하고, imageUrl은 실제 장착용 스프라이트 시트로 되돌립니다.
    const catalogItem = REWARD_FOLDER_ITEMS.find(catalog =>
      catalog.id === item.id ||
      catalog.id === (item as any).itemId ||
      catalog.id === (item as any).catalogItemId
    );
    if (!catalogItem || catalogItem.type !== 'avatar') return item;

    return {
      ...item,
      id: catalogItem.id,
      name: catalogItem.name,
      type: catalogItem.type,
      slot: catalogItem.slot,
      icon: catalogItem.icon || item.icon,
      iconUrl: catalogItem.iconUrl || item.iconUrl || item.imageUrl || catalogItem.imageUrl,
      imageUrl: catalogItem.imageUrl,
      tintMaskUrl: catalogItem.tintMaskUrl ?? item.tintMaskUrl,
      shadowImageUrl: catalogItem.shadowImageUrl ?? item.shadowImageUrl,
      outlineImageUrl: catalogItem.outlineImageUrl ?? item.outlineImageUrl,
      overlayImageUrl: catalogItem.overlayImageUrl ?? item.overlayImageUrl,
      eyeShadowImageUrl: catalogItem.eyeShadowImageUrl ?? item.eyeShadowImageUrl,
      occupiesSlots: catalogItem.occupiesSlots ?? item.occupiesSlots,
      hairLayerMode: catalogItem.hairLayerMode ?? item.hairLayerMode,
      underTintMaskUrl: catalogItem.underTintMaskUrl ?? item.underTintMaskUrl,
      underShadowImageUrl: catalogItem.underShadowImageUrl ?? item.underShadowImageUrl,
      underOutlineImageUrl: catalogItem.underOutlineImageUrl ?? item.underOutlineImageUrl,
      upperTintMaskUrl: catalogItem.upperTintMaskUrl ?? item.upperTintMaskUrl,
      upperShadowImageUrl: catalogItem.upperShadowImageUrl ?? item.upperShadowImageUrl,
      upperOutlineImageUrl: catalogItem.upperOutlineImageUrl ?? item.upperOutlineImageUrl,
    };
  });

  const missingDefaults = DEFAULT_AVATAR_ITEMS.filter(item => !seenIds.has(item.id));
  return [...missingDefaults, ...normalizedExisting];
}

export function ensureDefaultAvatarState(avatarState?: Partial<AvatarState> | null): AvatarState {
  const incoming = avatarState?.equipped || {};

  // eyes는 항상 기본값 보장 (해제 불가)
  // hair/eyebrow/mouth는 사용자가 명시적으로 null로 설정한 경우 제거 허용
  // 단, 기존 데이터에 해당 키가 아예 없으면 기본값 적용
  const equippedWithDefaults: AvatarState['equipped'] = {
    // 기본값 먼저 적용
    ...DEFAULT_EQUIPPED_AVATAR_ITEMS,
    // 사용자 데이터로 덮어쓰기
    ...incoming,
  };

  if (equippedWithDefaults.hair === DEFAULT_AVATAR_ITEM_IDS.hair) {
    equippedWithDefaults.hair = DEFAULT_AVATAR_ITEM_IDS.commonBobcut;
  }

  // eyes는 항상 보장
  if (!equippedWithDefaults.eyes) {
    equippedWithDefaults.eyes = DEFAULT_EQUIPPED_AVATAR_ITEMS.eyes;
  }

  // null은 "사용자가 의도적으로 해제함"이라는 뜻이므로 보존합니다.
  // undefined/키 없음은 기본값 보정 대상입니다.
  const cleanEquipped: AvatarState['equipped'] = {};
  for (const [key, value] of Object.entries(equippedWithDefaults)) {
    if (value !== undefined) {
      (cleanEquipped as any)[key] = value;
    }
  }
  // eyes는 반드시 포함
  if (!cleanEquipped.eyes) {
    cleanEquipped.eyes = DEFAULT_EQUIPPED_AVATAR_ITEMS.eyes;
  }

  return {
    skinColor: avatarState?.skinColor || DEFAULT_AVATAR_COLORS.skinColor,
    eyeColor: avatarState?.eyeColor || DEFAULT_AVATAR_COLORS.eyeColor,
    hairColor: avatarState?.hairColor || DEFAULT_AVATAR_COLORS.hairColor,
    equipped: cleanEquipped,
    baseParts: avatarState?.baseParts || {},
    animationState: avatarState?.animationState || 'idle',
    facing: avatarState?.facing || 'front',
  };
}
