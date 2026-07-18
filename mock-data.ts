/**
 * 아이템 이미지 처리 유틸리티
 * 
 * 기존 데이터와의 호환성을 유지하면서 새로운 이미지 구조를 지원합니다.
 */

import type { Item, RoomDirection } from './types';

// ============================================
// 아이템 이미지 조회
// ============================================

/**
 * 아이템의 표시할 이미지를 결정합니다.
 * 우선순위: iconUrl > imageUrl > icon (emoji)
 */
export function getItemDisplayImage(item: Item): string {
  if (item.iconUrl) return item.iconUrl;
  if (item.imageUrl) return item.imageUrl;
  return item.icon; // emoji fallback
}

/**
 * 방향별 이미지를 조회합니다.
 * 우선순위: directionImages[direction] > imageUrl > icon
 */
export function getDirectionalImage(item: Item, direction: RoomDirection): string {
  if (item.directionImages?.[direction]) {
    return item.directionImages[direction]!;
  }
  return getItemDisplayImage(item);
}

/**
 * 아바타 애니메이션 파츠 이미지를 조회합니다.
 * 나중에 실제 PNG 파츠로 교체 가능
 */
export function getAvatarLayerImage(item: Item, layerType: keyof NonNullable<Item['avatarLayers']>): string | null {
  if (item.avatarLayers?.[layerType]) {
    return item.avatarLayers[layerType]!;
  }
  return null;
}

// ============================================
// 이미지 렌더링 헬퍼
// ============================================

/**
 * 이미지 또는 이모지를 렌더링할 때 사용할 CSS 클래스를 반환합니다.
 */
export function getImageRenderClass(image: string): string {
  // Base64 또는 URL인 경우
  if (image.startsWith('data:') || image.startsWith('http')) {
    return 'object-contain';
  }
  // 이모지인 경우
  return 'text-center flex items-center justify-center';
}

/**
 * 이미지 또는 이모지를 렌더링합니다.
 * React 컴포넌트에서 직접 사용하지 말고, JSX에서 조건부 렌더링에 사용하세요.
 */
export function isImageUrl(image: string): boolean {
  return image.startsWith('data:') || image.startsWith('http');
}

// ============================================
// 레거시 데이터 마이그레이션
// ============================================

/**
 * 기존 Item 데이터를 새로운 구조로 마이그레이션합니다.
 * 기존 필드를 유지하면서 새 필드를 추가합니다.
 */
export function migrateItemData(item: any): Item {
  return {
    id: item.id,
    name: item.name,
    type: item.type || 'etc',
    slot: item.slot,
    icon: item.icon || '📦',
    iconUrl: item.iconUrl,
    imageUrl: item.imageUrl,
    layerImageUrl: item.layerImageUrl,
    tintMaskUrl: item.tintMaskUrl,
    overlayImageUrl: item.overlayImageUrl,
    hairLayerMode: item.hairLayerMode,
    shadowImageUrl: item.shadowImageUrl,
    outlineImageUrl: item.outlineImageUrl,
    eyeShadowImageUrl: item.eyeShadowImageUrl,
    underTintMaskUrl: item.underTintMaskUrl,
    underShadowImageUrl: item.underShadowImageUrl,
    underOutlineImageUrl: item.underOutlineImageUrl,
    upperTintMaskUrl: item.upperTintMaskUrl,
    upperShadowImageUrl: item.upperShadowImageUrl,
    upperOutlineImageUrl: item.upperOutlineImageUrl,
    occupiesSlots: item.occupiesSlots,
    description: item.description,
    rarity: item.rarity || 'common',
    stackable: item.stackable ?? false,
    directionImages: item.directionImages,
    avatarLayers: item.avatarLayers,
    acquiredAt: item.acquiredAt || new Date().toISOString(),
  };
}

/**
 * 기존 RoomState 데이터를 새로운 구조로 마이그레이션합니다.
 */
export function migrateRoomStateData(roomState: any): any {
  return {
    skinColor: roomState?.skinColor,
    equipped: roomState?.equipped || {},
    placedItems: roomState?.placedItems || [],
  };
}

/**
 * 기존 AvatarState 데이터를 새로운 구조로 마이그레이션합니다.
 */
export function migrateAvatarStateData(avatarState: any): any {
  return {
    skinColor: avatarState?.skinColor || '#FDB4B4',
    equipped: avatarState?.equipped || {},
    baseParts: avatarState?.baseParts,
    animationState: avatarState?.animationState || 'idle',
    facing: avatarState?.facing || 'front',
  };
}

// ============================================
// 이미지 경로 헬퍼 (나중에 PNG 파츠 추가용)
// ============================================

/**
 * 아바타 기본 파츠 이미지 경로를 생성합니다.
 * TODO: 나중에 실제 PNG 파츠로 교체
 * 
 * 예상 경로:
 * - /assets/avatar/base/body_front.png
 * - /assets/avatar/base/body_left.png
 * - /assets/avatar/base/body_right.png
 */
export function getAvatarBasePath(part: string, direction: RoomDirection): string {
  // TODO: 실제 PNG 파츠 경로로 교체
  return `/assets/avatar/base/${part}_${direction}.png`;
}

/**
 * 아바타 의류/액세서리 이미지 경로를 생성합니다.
 * TODO: 나중에 실제 PNG 파츠로 교체
 * 
 * 예상 경로:
 * - /assets/avatar/clothes/top_001_front.png
 * - /assets/avatar/hair/hair_001_front.png
 */
export function getAvatarClothingPath(type: string, id: string, direction: RoomDirection): string {
  // TODO: 실제 PNG 파츠 경로로 교체
  return `/assets/avatar/${type}/${id}_${direction}.png`;
}

/**
 * 방 꾸미기 아이템 이미지 경로를 생성합니다.
 * TODO: 나중에 실제 PNG 이미지로 교체
 * 
 * 예상 경로:
 * - /assets/room/furniture/desk_001_front.png
 * - /assets/room/furniture/desk_001_left.png
 */
export function getRoomItemPath(category: string, id: string, direction: RoomDirection): string {
  // TODO: 실제 PNG 이미지 경로로 교체
  return `/assets/room/${category}/${id}_${direction}.png`;
}

/**
 * 아바타 애니메이션 프레임 경로를 생성합니다.
 * TODO: 나중에 실제 PNG 애니메이션 프레임으로 교체
 * 
 * 예상 경로:
 * - /assets/avatar/animations/walk_left_leg_01.png
 * - /assets/avatar/animations/walk_right_leg_02.png
 */
export function getAvatarAnimationPath(animation: string, part: string, frame: number): string {
  // TODO: 실제 PNG 애니메이션 프레임 경로로 교체
  return `/assets/avatar/animations/${animation}_${part}_${String(frame).padStart(2, '0')}.png`;
}
