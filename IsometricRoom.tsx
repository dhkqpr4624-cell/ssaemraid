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
}

function normalizeFacing(facing?: RoomDirection | string): 'front' | 'left' | 'right' | 'back' {
  if (facing === 'left' || facing === 'right' || facing === 'back') return facing;
  return 'front';
}

function isUnset(value: unknown) {
  return value === undefined || value === null || value === '';
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
    return {
      baseAsset: item?.imageUrl || null,
      tintMaskAsset: item?.tintMaskUrl || null,
      overlayAsset: item?.overlayImageUrl || null,
      hairLayerMode: item?.hairLayerMode || null,
      shadowAsset: item?.shadowImageUrl || null,
      outlineAsset: item?.outlineImageUrl || null,
      eyeShadowAsset: item?.eyeShadowImageUrl || item?.shadowImageUrl || null,
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

    const { baseAsset: capeAsset } = getLayerAssets('cape');
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
    const { baseAsset: accessoryAsset } = getLayerAssets('accessory');
    const { baseAsset: petAsset } = getLayerAssets('pet');

    return (
      <div className="relative inline-block" style={{ width: SPRITE_CONFIG.FRAME_SIZE, height: SPRITE_CONFIG.FRAME_SIZE }}>
        {capeAsset && <div style={layerStyle(capeAsset, AVATAR_LAYER_ORDER.cape)} />}

        <div style={layerStyle(DEFAULT_AVATAR_ASSETS.body, AVATAR_LAYER_ORDER.body)} />
        <div style={tintOverlayStyle(DEFAULT_AVATAR_ASSETS.body, currentSkinColor, AVATAR_LAYER_ORDER.body + 1, 0.65)} />
        <div style={layerStyle(DEFAULT_AVATAR_ASSETS.innerWear, AVATAR_LAYER_ORDER.body + 2)} />

        {mouthAsset && <div style={layerStyle(mouthAsset, AVATAR_LAYER_ORDER.mouth)} />}
        {eyebrowAsset && <div style={layerStyle(eyebrowAsset, AVATAR_LAYER_ORDER.eyebrow)} />}

        {eyesAsset && (
          <>
            {eyesTintMask ? (
              <div style={tintOverlayStyle(eyesTintMask, currentEyeColor, AVATAR_LAYER_ORDER.eye, 0.85, 'normal')} />
            ) : (
              <div style={layerStyle(eyesAsset, AVATAR_LAYER_ORDER.eye)} />
            )}
            {eyesShadowAsset && <div style={layerStyle(eyesShadowAsset, AVATAR_LAYER_ORDER.eye + 1, { mixBlendMode: 'multiply' })} />}
            <div style={layerStyle(eyesAsset, AVATAR_LAYER_ORDER.eye + 2)} />
            {eyesOverlayAsset && <div style={layerStyle(eyesOverlayAsset, AVATAR_LAYER_ORDER.eye + 3)} />}
          </>
        )}

        {(hairAsset || hairTintMask || hairUnderTintMask || hairUpperTintMask) && (
          resolvedHairLayerMode === 'six' ? (
            <>
              {hairUnderTintMask && <div style={tintOverlayStyle(hairUnderTintMask, currentHairColor, AVATAR_LAYER_ORDER.hair, 1, 'normal')} />}
              {hairUnderShadowAsset && <div style={layerStyle(hairUnderShadowAsset, AVATAR_LAYER_ORDER.hair + 1, { mixBlendMode: 'multiply' })} />}
              {hairUnderOutlineAsset && <div style={layerStyle(hairUnderOutlineAsset, AVATAR_LAYER_ORDER.hair + 2)} />}
              {!hatAsset && hairUpperTintMask && <div style={tintOverlayStyle(hairUpperTintMask, currentHairColor, AVATAR_LAYER_ORDER.hair + 3, 1, 'normal')} />}
              {!hatAsset && hairUpperShadowAsset && <div style={layerStyle(hairUpperShadowAsset, AVATAR_LAYER_ORDER.hair + 4, { mixBlendMode: 'multiply' })} />}
              {!hatAsset && hairUpperOutlineAsset && <div style={layerStyle(hairUpperOutlineAsset, AVATAR_LAYER_ORDER.hair + 5)} />}
            </>
          ) : resolvedHairLayerMode === 'triple' ? (
            <>
              {hairTintMask && <div style={tintOverlayStyle(hairTintMask, currentHairColor, AVATAR_LAYER_ORDER.hair, 1, 'normal')} />}
              {hairShadowAsset && <div style={layerStyle(hairShadowAsset, AVATAR_LAYER_ORDER.hair + 1, { mixBlendMode: 'multiply' })} />}
              {(hairOutlineAsset || hairAsset) && <div style={layerStyle(hairOutlineAsset || hairAsset!, AVATAR_LAYER_ORDER.hair + 2)} />}
            </>
          ) : resolvedHairLayerMode === 'singleColorMask' ? (
            <>{(hairTintMask || hairAsset) && <div style={tintOverlayStyle(hairTintMask || hairAsset!, currentHairColor, AVATAR_LAYER_ORDER.hair, 1, 'normal')} />}</>
          ) : (
            <>
              {hairAsset && <div style={layerStyle(hairAsset, AVATAR_LAYER_ORDER.hair)} />}
              {hairAsset && <div style={tintOverlayStyle(hairAsset, currentHairColor, AVATAR_LAYER_ORDER.hair + 1, 0.55)} />}
            </>
          )
        )}

        {faceAsset && <div style={layerStyle(faceAsset, AVATAR_LAYER_ORDER.face)} />}
        {shoesAsset && <div style={layerStyle(shoesAsset, AVATAR_LAYER_ORDER.clothing)} />}
        {shouldRenderBottomAsset && bottomAsset && <div style={layerStyle(bottomAsset, AVATAR_LAYER_ORDER.clothing + 1)} />}
        {topAsset && <div style={layerStyle(topAsset, AVATAR_LAYER_ORDER.clothing + 2)} />}
        {hatAsset && <div style={layerStyle(hatAsset, AVATAR_LAYER_ORDER.clothing + 3)} />}
        {accessoryAsset && <div style={layerStyle(accessoryAsset, AVATAR_LAYER_ORDER.accessory)} />}
        {petAsset && <div style={layerStyle(petAsset, AVATAR_LAYER_ORDER.pet)} />}

        {showAnimation && (
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
        {eyeItem?.imageUrl && (
          <SpriteItemIcon
            imageUrl={eyeItem.imageUrl}
            overlayImageUrl={eyeItem.overlayImageUrl}
            eyeShadowImageUrl={eyeItem.eyeShadowImageUrl}
            tintMaskUrl={eyeItem.tintMaskUrl}
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
