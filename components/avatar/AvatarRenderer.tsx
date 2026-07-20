'use client';

import React, { CSSProperties, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import type { AvatarState, Item, RoomDirection } from '@/lib/types';
import {
  AVATAR_LAYER_ORDER,
  DEFAULT_AVATAR_ASSETS,
  DEFAULT_AVATAR_COLORS,
  SPRITE_CONFIG,
  getAnimationFrame,
} from '@/lib/avatar-assets';

interface AvatarRendererProps {
  avatarState?: AvatarState;
  inventory?: Item[];
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'sprite';
  className?: string;
  facing?: RoomDirection;
  showAnimation?: boolean;
  useSprite?: boolean;
  skinColor?: string;
  eyeColor?: string;
  hairColor?: string;
  showDebugOverlay?: boolean;
}

function normalizeFacing(facing?: RoomDirection | string): 'front' | 'left' | 'right' | 'back' {
  if (facing === 'left' || facing === 'right' || facing === 'back') return facing;
  return 'front';
}

function isUnset(value: unknown) {
  return value === undefined || value === null || value === '';
}

function isOneHandWeaponItem(item: Item | null) {
  if (!item) return false;
  const values = [
    item.id,
    (item as any).itemId,
    (item as any).catalogItemId,
    item.name,
    item.imageUrl,
    (item as any).rightArmPose,
  ].map(value => String(value || '').toLowerCase());

  return values.some(value =>
    value.includes('holdonehandweapon') ||
    value.includes('one-hand-weapon') ||
    value.includes('bipa-bronze-dagger') ||
    value.includes('비파형 동검')
  );
}

function isTwoHandedAccessoryItem(item: Item | null) {
  if (!item) return false;
  // 법전은 손에 드는 장신구이지만 기본 팔 자세를 유지합니다.
  if (item.id === 'g5-s1-social-u3-accessory-law-book' || item.name === '법전') return false;
  const values = [
    item.id,
    (item as any).itemId,
    (item as any).catalogItemId,
    item.name,
    item.imageUrl,
    (item as any).rightArmPose,
    (item as any).leftArmPose,
  ].map(value => String(value || '').toLowerCase());

  return values.some(value =>
    value.includes('twohanded') ||
    value.includes('two-handed') ||
    value.includes('two_handed')
  );
}


function deriveOptionalHairLayerUrl(url: string | null | undefined, fromToken: string, toToken: string) {
  if (!url || !url.includes(fromToken)) return null;
  return url.replace(fromToken, toToken);
}

function normalizeSixLayerHairAssets(item: Item | null) {
  const baseAsset = item?.imageUrl || null;
  const tintMaskAsset = item?.tintMaskUrl || null;
  const shadowAsset = item?.shadowImageUrl || null;
  const outlineAsset = item?.outlineImageUrl || null;
  const rawHairLayerMode = item?.hairLayerMode || null;

  let underTintMaskAsset = item?.underTintMaskUrl || null;
  let underShadowAsset = item?.underShadowImageUrl || null;
  let underOutlineAsset = item?.underOutlineImageUrl || null;
  let upperTintMaskAsset = item?.upperTintMaskUrl || null;
  let upperShadowAsset = item?.upperShadowImageUrl || null;
  let upperOutlineAsset = item?.upperOutlineImageUrl || null;

  const looksLikeSixLayerHair = rawHairLayerMode === 'six'
    || Boolean(underTintMaskAsset || underShadowAsset || underOutlineAsset || upperTintMaskAsset || upperShadowAsset || upperOutlineAsset)
    || Boolean(baseAsset?.includes('-under-') || baseAsset?.includes('-upper-') || tintMaskAsset?.includes('-under-') || tintMaskAsset?.includes('-upper-'));

  if (looksLikeSixLayerHair) {
    // 일부 기존 학생 인벤토리에는 6레이어 헤어의 under/upper 필드가 저장되지 않고
    // imageUrl/tintMaskUrl/shadowImageUrl만 남아 있을 수 있습니다. 이 경우 파일명 규칙으로 복구합니다.
    const candidateColor = underTintMaskAsset || upperTintMaskAsset || tintMaskAsset || baseAsset;
    const candidateShadow = underShadowAsset || upperShadowAsset || shadowAsset;
    const candidateOutline = underOutlineAsset || upperOutlineAsset || outlineAsset;

    underTintMaskAsset ||= deriveOptionalHairLayerUrl(candidateColor, '-upper-color', '-under-color') || (candidateColor?.includes('-under-color') ? candidateColor : null);
    upperTintMaskAsset ||= deriveOptionalHairLayerUrl(candidateColor, '-under-color', '-upper-color') || (candidateColor?.includes('-upper-color') ? candidateColor : null);

    underShadowAsset ||= deriveOptionalHairLayerUrl(candidateShadow, '-upper-shadow', '-under-shadow') || (candidateShadow?.includes('-under-shadow') ? candidateShadow : null);
    upperShadowAsset ||= deriveOptionalHairLayerUrl(candidateShadow, '-under-shadow', '-upper-shadow') || (candidateShadow?.includes('-upper-shadow') ? candidateShadow : null);

    underOutlineAsset ||= deriveOptionalHairLayerUrl(candidateOutline, '-upper-outline', '-under-outline') || (candidateOutline?.includes('-under-outline') ? candidateOutline : null);
    upperOutlineAsset ||= deriveOptionalHairLayerUrl(candidateOutline, '-under-outline', '-upper-outline') || (candidateOutline?.includes('-upper-outline') ? candidateOutline : null);

    // base color 파일이 없는 헤어는 shadow 파일을 color mask로도 사용합니다.
    // outline만 없거나 color만 없는 아이템도 렌더 오류 없이 표시되도록 합니다.
    underTintMaskAsset ||= underShadowAsset;
    upperTintMaskAsset ||= upperShadowAsset;
  }

  return {
    baseAsset,
    tintMaskAsset,
    overlayAsset: item?.overlayImageUrl || null,
    hairLayerMode: looksLikeSixLayerHair ? 'six' : rawHairLayerMode,
    shadowAsset,
    outlineAsset,
    eyeShadowAsset: item?.eyeShadowImageUrl || item?.shadowImageUrl || null,
    underTintMaskAsset,
    underShadowAsset,
    underOutlineAsset,
    upperTintMaskAsset,
    upperShadowAsset,
    upperOutlineAsset,
  };
}

function hexToRgba(hex: string, alpha: number) {
  const value = (hex || '').replace('#', '');
  if (value.length !== 6) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function AvatarRenderer({
  avatarState,
  inventory = [],
  size = 'md',
  className,
  facing = 'front',
  showAnimation = false,
  useSprite = true,
  skinColor,
  eyeColor,
  hairColor,
  showDebugOverlay = true,
}: AvatarRendererProps) {
  const [animationFrame, setAnimationFrame] = useState(0);

  const state: AvatarState = avatarState || {
    skinColor: skinColor || DEFAULT_AVATAR_COLORS.skinColor,
    eyeColor: eyeColor || DEFAULT_AVATAR_COLORS.eyeColor,
    hairColor: hairColor || DEFAULT_AVATAR_COLORS.hairColor,
    equipped: {},
    animationState: 'idle',
    facing: 'front',
  };

  const currentSkinColor = skinColor || state.skinColor || DEFAULT_AVATAR_COLORS.skinColor;
  const currentEyeColor = eyeColor || state.eyeColor || DEFAULT_AVATAR_COLORS.eyeColor;
  const currentHairColor = hairColor || state.hairColor || DEFAULT_AVATAR_COLORS.hairColor;
  const currentFacing = normalizeFacing(facing || state.facing);
  const isMoving = state.animationState === 'walk';

  useEffect(() => {
    if (!useSprite) return;
    const interval = setInterval(() => {
      setAnimationFrame((prev) => (prev + 1) % SPRITE_CONFIG.FRAMES_PER_ROW);
    }, SPRITE_CONFIG.ANIMATION_SPEED);
    return () => clearInterval(interval);
  }, [useSprite]);

  const getEquippedItem = (slot: keyof AvatarState['equipped']) => {
    const itemId = state.equipped?.[slot];
    if (isUnset(itemId)) return null;
    return inventory.find((item) => item.id === itemId) || null;
  };

  const getLayerAssets = (slot: keyof AvatarState['equipped']) => {
    const item = getEquippedItem(slot);
    if (slot === 'hair') return normalizeSixLayerHairAssets(item);

    // 눈 아이템은 eyelash(imageUrl) + iris/base color(tintMaskUrl) + shadow(eyeShadowImageUrl) 구조입니다.
    // 새 눈 아이템에 iris/base color 파일이 따로 제공되지 않은 경우에는 shadow 파일을
    // 색상 변경용 마스크로도 사용해 렌더링이 비어 보이지 않도록 합니다.
    const eyeShadowAsset = item?.eyeShadowImageUrl || item?.shadowImageUrl || null;
    const eyeTintMaskAsset = slot === 'eyes'
      ? (item?.tintMaskUrl || eyeShadowAsset || null)
      : (item?.tintMaskUrl || null);

    return {
      baseAsset: item?.imageUrl || null,
      tintMaskAsset: eyeTintMaskAsset,
      overlayAsset: item?.overlayImageUrl || null,
      hairLayerMode: item?.hairLayerMode || null,
      shadowAsset: item?.shadowImageUrl || null,
      outlineAsset: item?.outlineImageUrl || null,
      eyeShadowAsset,
      underTintMaskAsset: item?.underTintMaskUrl || null,
      underShadowAsset: item?.underShadowImageUrl || null,
      underOutlineAsset: item?.underOutlineImageUrl || null,
      upperTintMaskAsset: item?.upperTintMaskUrl || null,
      upperShadowAsset: item?.upperShadowImageUrl || null,
      upperOutlineAsset: item?.upperOutlineImageUrl || null,
    };
  };

  if (useSprite && size === 'sprite') {
    const framePos = getAnimationFrame(currentFacing, isMoving, animationFrame);
    const baseSpriteStyle: CSSProperties = {
      width: SPRITE_CONFIG.FRAME_SIZE,
      height: SPRITE_CONFIG.FRAME_SIZE,
      backgroundPosition: `-${framePos.x}px -${framePos.y}px`,
      backgroundSize: `${SPRITE_CONFIG.TOTAL_WIDTH}px ${SPRITE_CONFIG.TOTAL_HEIGHT}px`,
      backgroundRepeat: 'no-repeat',
      imageRendering: 'pixelated',
    };

    const layerStyle = (url: string, zIndex: number, extra?: CSSProperties): CSSProperties => ({
      ...baseSpriteStyle,
      position: 'absolute',
      inset: 0,
      zIndex,
      backgroundImage: `url('${url}')`,
      ...extra,
    });

    const tintOverlayStyle = (url: string, color: string, zIndex: number, alpha = 0.55, blendMode: CSSProperties['mixBlendMode'] = 'multiply'): CSSProperties => ({
      ...baseSpriteStyle,
      position: 'absolute',
      inset: 0,
      zIndex,
      backgroundImage: 'none',
      backgroundColor: hexToRgba(color, alpha),
      WebkitMaskImage: `url('${url}')`,
      maskImage: `url('${url}')`,
      WebkitMaskPosition: baseSpriteStyle.backgroundPosition as string,
      maskPosition: baseSpriteStyle.backgroundPosition as string,
      WebkitMaskSize: baseSpriteStyle.backgroundSize as string,
      maskSize: baseSpriteStyle.backgroundSize as string,
      WebkitMaskRepeat: 'no-repeat',
      maskRepeat: 'no-repeat',
      pointerEvents: 'none',
      mixBlendMode: blendMode,
    });

    const capeItem = getEquippedItem('cape');
    const { baseAsset: capeAsset } = getLayerAssets('cape');
    const isLawGuardianCape = capeItem?.id === 'g5-s1-social-u3-cape-right-protection-law-guardian-cape'
      || capeItem?.name === '권리 보호! 법 수호자 망토';
    const capeFrontAsset = (capeItem as any)?.capeFrontImageUrl || (isLawGuardianCape ? '/reward-items/5/1/social/u3/cape/right-protection-law-guardian-cape-front.png' : null);
    const capeBackAsset = (capeItem as any)?.capeBackImageUrl || (isLawGuardianCape ? '/reward-items/5/1/social/u3/cape/right-protection-law-guardian-cape-back.png' : null);
    const capeMediumAsset = (capeItem as any)?.capeMediumImageUrl || (isLawGuardianCape ? '/reward-items/5/1/social/u3/cape/right-protection-law-guardian-cape-medium.png' : null);
    // 기존에 이미 학생 인벤토리에 저장된 아이템은 reward-folder-items.ts의
    // capeLayerPosition 값이 localStorage 쪽 아이템 데이터에 없을 수 있습니다.
    // 그래서 해당 망토는 id/name 기준으로도 front 레이어를 강제 인식합니다.
    const isCapeFrontLayer = capeItem?.capeLayerPosition === 'front'
      || capeItem?.id === 'g5-s1-social-u3-cape-freedom-rights-wings'
      || capeItem?.name === '자유권 날개';
    const { baseAsset: hairAsset, tintMaskAsset: hairTintMask, hairLayerMode, shadowAsset: hairShadowAsset, outlineAsset: hairOutlineAsset, underTintMaskAsset: hairUnderTintMask, underShadowAsset: hairUnderShadowAsset, underOutlineAsset: hairUnderOutlineAsset, upperTintMaskAsset: hairUpperTintMask, upperShadowAsset: hairUpperShadowAsset, upperOutlineAsset: hairUpperOutlineAsset } = getLayerAssets('hair');
    // outline 레이어가 없거나, 예전 데이터에 hairLayerMode가 저장되지 않은 경우도
    // upper/under color·shadow 레이어만으로 6레이어 헤어가 정상 렌더링되도록 보정합니다.
    const resolvedHairLayerMode = hairLayerMode || ((hairUnderTintMask || hairUnderShadowAsset || hairUnderOutlineAsset || hairUpperTintMask || hairUpperShadowAsset || hairUpperOutlineAsset) ? 'six' : null);
    const { baseAsset: eyesAsset, tintMaskAsset: eyesTintMask, overlayAsset: eyesOverlayAsset, eyeShadowAsset: eyesShadowAsset } = getLayerAssets('eyes');
    const { baseAsset: eyebrowAsset } = getLayerAssets('eyebrow');
    const { baseAsset: mouthAsset } = getLayerAssets('mouth');
    const { baseAsset: faceAsset } = getLayerAssets('face');
    const topItem = getEquippedItem('top');
    const bottomItem = getEquippedItem('bottom');
    const { baseAsset: topAsset } = getLayerAssets('top');
    const { baseAsset: bottomAsset } = getLayerAssets('bottom');
    const shouldRenderBottomAsset = Boolean(bottomAsset && bottomItem?.id !== topItem?.id);
    const { baseAsset: shoesAsset } = getLayerAssets('shoes');
    const { baseAsset: hatAsset } = getLayerAssets('hat');
    const { baseAsset: headAccessoryAsset } = getLayerAssets('headAccessory');
    const accessoryItem = getEquippedItem('accessory');
    const { baseAsset: accessoryAsset } = getLayerAssets('accessory');
    const { baseAsset: petAsset } = getLayerAssets('pet');
    const bodyBaseAsset = state.baseParts?.body || DEFAULT_AVATAR_ASSETS.bodyBase;
    const bodyInnerAsset = state.baseParts?.inner || DEFAULT_AVATAR_ASSETS.bodyInner;
    const isTwoHandedAccessory = isTwoHandedAccessoryItem(accessoryItem);
    const isOneHandedAccessory = !isTwoHandedAccessory && isOneHandWeaponItem(accessoryItem);
    const bodyLeftArmAsset = isTwoHandedAccessory
      ? ((accessoryItem as any)?.leftArmImageUrl || DEFAULT_AVATAR_ASSETS.bodyLeftArmTwoHanded)
      : (state.baseParts?.leftArm || DEFAULT_AVATAR_ASSETS.bodyLeftArmDefault);
    const bodyRightArmAsset = isTwoHandedAccessory
      ? ((accessoryItem as any)?.rightArmImageUrl || DEFAULT_AVATAR_ASSETS.bodyRightArmTwoHanded)
      : isOneHandedAccessory
        ? ((accessoryItem as any)?.rightArmImageUrl || DEFAULT_AVATAR_ASSETS.bodyRightArmHoldOneHandWeapon)
        : (state.baseParts?.rightArm || DEFAULT_AVATAR_ASSETS.bodyRightArmDefault);
    const topBodyAsset = (topItem as any)?.topBodyImageUrl || topAsset || null;
    const topLeftArmAsset = isTwoHandedAccessory
      ? (topItem as any)?.topLeftArmTwoHandedImageUrl
      : (topItem as any)?.topLeftArmDefaultImageUrl;
    const topRightArmAsset = isTwoHandedAccessory
      ? (topItem as any)?.topRightArmTwoHandedImageUrl
      : isOneHandedAccessory
        ? ((topItem as any)?.topRightArmOneHandedImageUrl || (topItem as any)?.topRightArmDefaultImageUrl)
        : (topItem as any)?.topRightArmDefaultImageUrl;
    const isSplitTop = Boolean((topItem as any)?.topBodyImageUrl || (topItem as any)?.topLeftArmDefaultImageUrl || (topItem as any)?.topRightArmDefaultImageUrl);

    // 카테고리 기본 레이어 순서입니다. capeLayerPosition 등 아이템별 고유 규칙은 아래에서 별도로 유지합니다.
    const LAYER = {
      body: 10,
      bottom: 20,
      shoes: 22,
      capeBack: 30,
      topBody: 40,
      baseRightArm: 50,
      baseLeftArm: 54,
      topLeftArm: 60,
      topRightArm: 64,
      facialParts: 70,
      faceAccessory: 80,
      hair: 90,
      accessory: 100,
      headAccessory: 110,
      pet: 120,
    } as const;

    return (
      <div className="relative inline-block" style={{ width: SPRITE_CONFIG.FRAME_SIZE, height: SPRITE_CONFIG.FRAME_SIZE }}>
        <div style={layerStyle(bodyBaseAsset, LAYER.body)} />
        <div style={tintOverlayStyle(bodyBaseAsset, currentSkinColor, LAYER.body + 1, 0.65)} />
        <div style={layerStyle(bodyInnerAsset, LAYER.body + 2)} />

        {shouldRenderBottomAsset && bottomAsset && <div style={layerStyle(bottomAsset, LAYER.bottom)} />}
        {shoesAsset && <div style={layerStyle(shoesAsset, LAYER.shoes)} />}

        {capeBackAsset && <div style={layerStyle(capeBackAsset, LAYER.capeBack)} />}
        {capeAsset && !isCapeFrontLayer && !isLawGuardianCape && <div style={layerStyle(capeAsset, LAYER.capeBack)} />}

        {isSplitTop && topBodyAsset && <div style={layerStyle(topBodyAsset, LAYER.topBody)} />}
        {!isSplitTop && topAsset && <div style={layerStyle(topAsset, LAYER.topBody)} />}
        {/* 법 수호자 망토 medium 파츠의 기존 고유 위치(상의 몸통과 같은 단계)는 유지합니다. */}
        {capeMediumAsset && <div style={layerStyle(capeMediumAsset, LAYER.topBody + 1)} />}

        <div style={layerStyle(bodyRightArmAsset, LAYER.baseRightArm)} />
        <div style={tintOverlayStyle(bodyRightArmAsset, currentSkinColor, LAYER.baseRightArm + 1, 0.65)} />
        <div style={layerStyle(bodyLeftArmAsset, LAYER.baseLeftArm)} />
        <div style={tintOverlayStyle(bodyLeftArmAsset, currentSkinColor, LAYER.baseLeftArm + 1, 0.65)} />
        {isSplitTop && topLeftArmAsset && <div style={layerStyle(topLeftArmAsset, LAYER.topLeftArm)} />}
        {isSplitTop && topRightArmAsset && <div style={layerStyle(topRightArmAsset, LAYER.topRightArm)} />}

        {mouthAsset && <div style={layerStyle(mouthAsset, LAYER.facialParts)} />}
        {eyebrowAsset && <div style={layerStyle(eyebrowAsset, LAYER.facialParts + 1)} />}

        {eyesAsset && (
          <>
            {eyesTintMask ? (
              <div style={tintOverlayStyle(eyesTintMask, currentEyeColor, LAYER.facialParts + 2, 0.85, 'normal')} />
            ) : (
              <div style={layerStyle(eyesAsset, LAYER.facialParts + 2)} />
            )}
            {eyesShadowAsset && <div style={layerStyle(eyesShadowAsset, LAYER.facialParts + 3, { mixBlendMode: 'multiply' })} />}
            <div style={layerStyle(eyesAsset, LAYER.facialParts + 4)} />
            {eyesOverlayAsset && <div style={layerStyle(eyesOverlayAsset, LAYER.facialParts + 5)} />}
          </>
        )}

        {faceAsset && <div style={layerStyle(faceAsset, LAYER.faceAccessory)} />}

        {(hairAsset || hairTintMask || hairUnderTintMask || hairUpperTintMask) && (
          resolvedHairLayerMode === 'six' ? (
            <>
              {hairUnderTintMask && <div style={tintOverlayStyle(hairUnderTintMask, currentHairColor, LAYER.hair, 1, 'normal')} />}
              {hairUnderShadowAsset && <div style={layerStyle(hairUnderShadowAsset, LAYER.hair + 1, { mixBlendMode: 'multiply' })} />}
              {hairUnderOutlineAsset && <div style={layerStyle(hairUnderOutlineAsset, LAYER.hair + 2)} />}
              {!hatAsset && hairUpperTintMask && <div style={tintOverlayStyle(hairUpperTintMask, currentHairColor, LAYER.hair + 3, 1, 'normal')} />}
              {!hatAsset && hairUpperShadowAsset && <div style={layerStyle(hairUpperShadowAsset, LAYER.hair + 4, { mixBlendMode: 'multiply' })} />}
              {!hatAsset && hairUpperOutlineAsset && <div style={layerStyle(hairUpperOutlineAsset, LAYER.hair + 5)} />}
            </>
          ) : resolvedHairLayerMode === 'triple' ? (
            <>
              {hairTintMask && <div style={tintOverlayStyle(hairTintMask, currentHairColor, LAYER.hair, 1, 'normal')} />}
              {hairShadowAsset && <div style={layerStyle(hairShadowAsset, LAYER.hair + 1, { mixBlendMode: 'multiply' })} />}
              {(hairOutlineAsset || hairAsset) && <div style={layerStyle(hairOutlineAsset || hairAsset!, LAYER.hair + 2)} />}
            </>
          ) : resolvedHairLayerMode === 'singleColorMask' ? (
            <>{(hairTintMask || hairAsset) && <div style={tintOverlayStyle(hairTintMask || hairAsset!, currentHairColor, LAYER.hair, 1, 'normal')} />}</>
          ) : (
            <>
              {hairAsset && <div style={layerStyle(hairAsset, LAYER.hair)} />}
              {hairAsset && <div style={tintOverlayStyle(hairAsset, currentHairColor, LAYER.hair + 1, 0.55)} />}
            </>
          )
        )}

        {accessoryAsset && <div style={layerStyle(accessoryAsset, LAYER.accessory)} />}
        {/* 모자(hat)는 머리카락을 가리는 기존 아이템 고유 동작을 유지합니다. */}
        {hatAsset && <div style={layerStyle(hatAsset, LAYER.headAccessory)} />}
        {headAccessoryAsset && <div style={layerStyle(headAccessoryAsset, LAYER.headAccessory + 1)} />}
        {petAsset && <div style={layerStyle(petAsset, LAYER.pet)} />}

        {/* front 지정 망토는 기존 고유 레이어 규칙대로 전면에 표시합니다. */}
        {capeAsset && isCapeFrontLayer && <div style={layerStyle(capeAsset, LAYER.accessory + 1)} />}
        {capeFrontAsset && <div style={layerStyle(capeFrontAsset, LAYER.accessory + 1)} />}

        {showAnimation && showDebugOverlay && (
          <div className="absolute bottom-0 left-0 right-0 text-[8px] bg-black/50 text-white p-1 text-center" style={{ zIndex: 100 }}>
            <div>Frame: {animationFrame}</div>
            <div>Dir: {currentFacing}</div>
            <div>State: {isMoving ? 'walk' : 'idle'}</div>
          </div>
        )}
      </div>
    );
  }

  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-32 h-32',
    lg: 'w-48 h-48',
    xl: 'w-64 h-64',
    sprite: 'w-40 h-40',
  };

  const scaleX = currentFacing === 'left' ? -1 : 1;
  const hairItem = getEquippedItem('hair');
  const headAccessoryItem = getEquippedItem('headAccessory');
  const eyeItem = getEquippedItem('eyes');
  const eyebrowItem = getEquippedItem('eyebrow');
  const mouthItem = getEquippedItem('mouth');

  return (
    <div className={cn('relative bg-gradient-to-b from-sky-100 to-blue-50 rounded-xl overflow-hidden border-2 border-muted shadow-inner', sizeClasses[size], className)}>
      <div className="absolute inset-0 flex items-center justify-center" style={{ transform: `scaleX(${scaleX})` }}>
        <div className="absolute bottom-1 w-3/4 h-1 bg-black/10 rounded-full blur-sm" />
        <div className="absolute bottom-0 w-1/6 h-1/3 rounded-sm border border-black/5" style={{ left: '22%', backgroundColor: currentSkinColor }} />
        <div className="absolute bottom-0 w-1/6 h-1/3 rounded-sm border border-black/5" style={{ right: '22%', backgroundColor: currentSkinColor }} />
        <div className="absolute top-1/3 w-1/2 h-1/3 rounded-sm border border-black/5 bg-white" />
        <div className="absolute top-[22%] w-[34%] h-[34%] rounded-full border border-black/5" style={{ backgroundColor: currentSkinColor }} />
        {hairItem?.imageUrl && <SpriteItemIcon imageUrl={hairItem.imageUrl} tintMaskUrl={hairItem.tintMaskUrl} hairLayerMode={hairItem.hairLayerMode} shadowImageUrl={hairItem.shadowImageUrl} outlineImageUrl={hairItem.outlineImageUrl} underTintMaskUrl={hairItem.underTintMaskUrl} underShadowImageUrl={hairItem.underShadowImageUrl} underOutlineImageUrl={hairItem.underOutlineImageUrl} upperTintMaskUrl={hairItem.upperTintMaskUrl} upperShadowImageUrl={hairItem.upperShadowImageUrl} upperOutlineImageUrl={hairItem.upperOutlineImageUrl} size={64} className="absolute top-[10%]" tintColor={currentHairColor} />}
        {headAccessoryItem?.imageUrl && <SpriteItemIcon imageUrl={headAccessoryItem.imageUrl} size={64} className="absolute top-[10%]" />}
        {eyeItem?.imageUrl && (
          <SpriteItemIcon
            imageUrl={eyeItem.imageUrl}
            overlayImageUrl={eyeItem.overlayImageUrl}
            eyeShadowImageUrl={eyeItem.eyeShadowImageUrl || eyeItem.shadowImageUrl}
            tintMaskUrl={eyeItem.tintMaskUrl || eyeItem.eyeShadowImageUrl || eyeItem.shadowImageUrl}
            tintColor={currentEyeColor}
            size={64}
            className="absolute top-[19%]"
          />
        )}
        {eyebrowItem?.imageUrl && <SpriteItemIcon imageUrl={eyebrowItem.imageUrl} size={64} className="absolute top-[15%]" />}
        {mouthItem?.imageUrl && <SpriteItemIcon imageUrl={mouthItem.imageUrl} size={64} className="absolute top-[24%]" />}
      </div>

      {showAnimation && (
        <div className="absolute bottom-1 right-1 text-[10px] bg-black/50 text-white px-1 py-0.5 rounded">
          {state.animationState || 'idle'} • {currentFacing}
        </div>
      )}
    </div>
  );
}

/**
 * 스프라이트 시트에서 첫 번째 프레임(160x160)만 아이콘으로 표시
 * - imageUrl: 기본 레이어
 * - tintMaskUrl: tint 적용용 마스크 레이어 (예: iris)
 * - overlayImageUrl: 추가 보이는 레이어 (선택)
 */
export function SpriteItemIcon({
  imageUrl,
  size = 48,
  className,
  tintMaskUrl,
  overlayImageUrl,
  hairLayerMode,
  shadowImageUrl,
  outlineImageUrl,
  eyeShadowImageUrl,
  underTintMaskUrl,
  underShadowImageUrl,
  underOutlineImageUrl,
  upperTintMaskUrl,
  upperShadowImageUrl,
  upperOutlineImageUrl,
  tintColor,
}: {
  imageUrl: string;
  size?: number;
  className?: string;
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
  tintColor?: string;
}) {
  const scale = size / SPRITE_CONFIG.FRAME_SIZE;
  const bgSize = `${SPRITE_CONFIG.TOTAL_WIDTH * scale}px ${SPRITE_CONFIG.TOTAL_HEIGHT * scale}px`;
  const bgPos = '0px 0px';

  const looksLikeSixLayerHair = hairLayerMode === 'six'
    || Boolean(underTintMaskUrl || underShadowImageUrl || underOutlineImageUrl || upperTintMaskUrl || upperShadowImageUrl || upperOutlineImageUrl)
    || Boolean(imageUrl?.includes('-under-') || imageUrl?.includes('-upper-') || tintMaskUrl?.includes('-under-') || tintMaskUrl?.includes('-upper-'));

  if (looksLikeSixLayerHair) {
    const candidateColor = underTintMaskUrl || upperTintMaskUrl || tintMaskUrl || imageUrl;
    const candidateShadow = underShadowImageUrl || upperShadowImageUrl || shadowImageUrl;
    const candidateOutline = underOutlineImageUrl || upperOutlineImageUrl || outlineImageUrl;

    underTintMaskUrl ||= deriveOptionalHairLayerUrl(candidateColor, '-upper-color', '-under-color') || (candidateColor?.includes('-under-color') ? candidateColor : undefined);
    upperTintMaskUrl ||= deriveOptionalHairLayerUrl(candidateColor, '-under-color', '-upper-color') || (candidateColor?.includes('-upper-color') ? candidateColor : undefined);
    underShadowImageUrl ||= deriveOptionalHairLayerUrl(candidateShadow, '-upper-shadow', '-under-shadow') || (candidateShadow?.includes('-under-shadow') ? candidateShadow : undefined);
    upperShadowImageUrl ||= deriveOptionalHairLayerUrl(candidateShadow, '-under-shadow', '-upper-shadow') || (candidateShadow?.includes('-upper-shadow') ? candidateShadow : undefined);
    underOutlineImageUrl ||= deriveOptionalHairLayerUrl(candidateOutline, '-upper-outline', '-under-outline') || (candidateOutline?.includes('-under-outline') ? candidateOutline : undefined);
    upperOutlineImageUrl ||= deriveOptionalHairLayerUrl(candidateOutline, '-under-outline', '-upper-outline') || (candidateOutline?.includes('-upper-outline') ? candidateOutline : undefined);

    // base color 파일이 없는 헤어 아이콘/미리보기는 shadow 파일을 color mask로도 사용합니다.
    underTintMaskUrl ||= underShadowImageUrl;
    upperTintMaskUrl ||= upperShadowImageUrl;
  }

  const resolvedHairLayerMode = hairLayerMode || (looksLikeSixLayerHair ? 'six' : undefined);

  return (
    <div className={cn('relative inline-block overflow-hidden shrink-0', className)} style={{ width: size, height: size }}>
      {resolvedHairLayerMode !== 'singleColorMask' && resolvedHairLayerMode !== 'triple' && resolvedHairLayerMode !== 'six' && (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url('${imageUrl}')`,
            backgroundPosition: bgPos,
            backgroundSize: bgSize,
            backgroundRepeat: 'no-repeat',
            imageRendering: 'pixelated',
          }}
        />
      )}
      {tintMaskUrl && tintColor && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundColor: hexToRgba(tintColor, resolvedHairLayerMode ? 1 : 0.85),
            WebkitMaskImage: `url('${tintMaskUrl}')`,
            maskImage: `url('${tintMaskUrl}')`,
            WebkitMaskPosition: bgPos,
            maskPosition: bgPos,
            WebkitMaskSize: bgSize,
            maskSize: bgSize,
            WebkitMaskRepeat: 'no-repeat',
            maskRepeat: 'no-repeat',
            mixBlendMode: resolvedHairLayerMode ? 'normal' : 'multiply',
          }}
        />
      )}
      {resolvedHairLayerMode === 'triple' && shadowImageUrl && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `url('${shadowImageUrl}')`,
            backgroundPosition: bgPos,
            backgroundSize: bgSize,
            backgroundRepeat: 'no-repeat',
            imageRendering: 'pixelated',
            mixBlendMode: 'multiply',
          }}
        />
      )}
      {resolvedHairLayerMode === 'triple' && (outlineImageUrl || imageUrl) && (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url('${outlineImageUrl || imageUrl}')`,
            backgroundPosition: bgPos,
            backgroundSize: bgSize,
            backgroundRepeat: 'no-repeat',
            imageRendering: 'pixelated',
          }}
        />
      )}
      {resolvedHairLayerMode === 'six' && (
        <>
          {underTintMaskUrl && tintColor && <div className="absolute inset-0 pointer-events-none" style={{ backgroundColor: hexToRgba(tintColor, 1), WebkitMaskImage: `url('${underTintMaskUrl}')`, maskImage: `url('${underTintMaskUrl}')`, WebkitMaskPosition: bgPos, maskPosition: bgPos, WebkitMaskSize: bgSize, maskSize: bgSize, WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat' }} />}
          {underShadowImageUrl && <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: `url('${underShadowImageUrl}')`, backgroundPosition: bgPos, backgroundSize: bgSize, backgroundRepeat: 'no-repeat', imageRendering: 'pixelated', mixBlendMode: 'multiply' }} />}
          {underOutlineImageUrl && <div className="absolute inset-0" style={{ backgroundImage: `url('${underOutlineImageUrl}')`, backgroundPosition: bgPos, backgroundSize: bgSize, backgroundRepeat: 'no-repeat', imageRendering: 'pixelated' }} />}
          {upperTintMaskUrl && tintColor && <div className="absolute inset-0 pointer-events-none" style={{ backgroundColor: hexToRgba(tintColor, 1), WebkitMaskImage: `url('${upperTintMaskUrl}')`, maskImage: `url('${upperTintMaskUrl}')`, WebkitMaskPosition: bgPos, maskPosition: bgPos, WebkitMaskSize: bgSize, maskSize: bgSize, WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat' }} />}
          {upperShadowImageUrl && <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: `url('${upperShadowImageUrl}')`, backgroundPosition: bgPos, backgroundSize: bgSize, backgroundRepeat: 'no-repeat', imageRendering: 'pixelated', mixBlendMode: 'multiply' }} />}
          {upperOutlineImageUrl && <div className="absolute inset-0" style={{ backgroundImage: `url('${upperOutlineImageUrl}')`, backgroundPosition: bgPos, backgroundSize: bgSize, backgroundRepeat: 'no-repeat', imageRendering: 'pixelated' }} />}
        </>
      )}
      {eyeShadowImageUrl && !resolvedHairLayerMode && (
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: `url('${eyeShadowImageUrl}')`, backgroundPosition: bgPos, backgroundSize: bgSize, backgroundRepeat: 'no-repeat', imageRendering: 'pixelated', mixBlendMode: 'multiply' }} />
      )}
      {overlayImageUrl && (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url('${overlayImageUrl}')`,
            backgroundPosition: bgPos,
            backgroundSize: bgSize,
            backgroundRepeat: 'no-repeat',
            imageRendering: 'pixelated',
          }}
        />
      )}
    </div>
  );
}

export function AvatarPreview({
  avatarState,
  inventory,
  useSprite = true,
  skinColor,
  eyeColor,
  hairColor,
}: Omit<AvatarRendererProps, 'size'>) {
  return (
    <AvatarRenderer
      avatarState={avatarState}
      inventory={inventory}
      size="sm"
      useSprite={useSprite}
      skinColor={skinColor}
      eyeColor={eyeColor}
      hairColor={hairColor}
    />
  );
}

export function SpriteAvatarRenderer({
  avatarState,
  inventory = [],
  facing,
  showAnimation = false,
  skinColor,
  eyeColor,
  hairColor,
}: Omit<AvatarRendererProps, 'size' | 'useSprite'>) {
  return (
    <AvatarRenderer
      avatarState={avatarState}
      inventory={inventory}
      size="sprite"
      useSprite={true}
      facing={facing}
      showAnimation={showAnimation}
      skinColor={skinColor}
      eyeColor={eyeColor}
      hairColor={hairColor}
    />
  );
}

export function AvatarDisplay({
  avatarState,
  inventory,
  facing,
}: {
  avatarState: AvatarState;
  inventory?: Item[];
  facing?: RoomDirection;
}) {
  return <AvatarRenderer avatarState={avatarState} inventory={inventory} size="md" facing={facing} useSprite={false} />;
}

export function AvatarFullView({
  avatarState,
  inventory,
  facing,
  showAnimation,
}: {
  avatarState: AvatarState;
  inventory?: Item[];
  facing?: RoomDirection;
  showAnimation?: boolean;
}) {
  return (
    <AvatarRenderer
      avatarState={avatarState}
      inventory={inventory}
      size="lg"
      facing={facing}
      showAnimation={showAnimation}
      useSprite={false}
    />
  );
}
