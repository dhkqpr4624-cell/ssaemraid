'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SpriteAvatarRenderer } from '@/components/avatar/AvatarRenderer';
import {
  getRoomItemById,
  getRoomItemCatalogIdFromItem,
  getRoomItemFrameStyle,
} from '@/lib/room-items-registry';
import type { Student, RoomPlayerPosition, PlacedRoomItem, RoomDirection } from '@/lib/types';

interface IsometricRoomEnhancedProps {
  student: Student;
  position: RoomPlayerPosition;
  placedItems: PlacedRoomItem[];
  showGrid?: boolean;
  onItemClick?: (itemId: string) => void;
  cameraOffset?: { x: number; y: number };
}

const ROOM_GRID_W = 6;
const ROOM_GRID_H = 6;

const ROOM_IMAGE = '/assets/room/base/default_room.png';
const ROOM_IMAGE_WIDTH = 560;
const ROOM_IMAGE_HEIGHT = 430;

const FLOOR_TILE_W = 80;
const FLOOR_TILE_H = 48;
const FLOOR_TOP_LEFT_X = 240;
const FLOOR_TOP_LEFT_Y = 170;
const FLOOR_STEP_X = 37.5;
const FLOOR_STEP_Y = 21;
const FURNITURE_VISUAL_GRID_OFFSET = { x: 0.1, y: 0.2 };
// 2x2(4칸) 제작 가구는 시각적 중심이 살짝 위쪽에 보이므로,
// 실제 grid 좌표는 유지하고 화면에 그릴 때만 반 칸 정도 아래쪽으로 보정합니다.
const LARGE_FURNITURE_EXTRA_VISUAL_GRID_OFFSET = { x: 0.5, y: 0.5 };
// 2칸 제작 가구는 방향에 따라 발판 중심이 다르게 보이므로, grid 좌표는 그대로 두고 시각적 위치만 보정합니다.
// NW/SE(↖/↘): X축 양수 방향으로 약 0.5칸
// NE/SW(↗/↙): Y축 양수 방향으로 약 0.3칸
const TWO_CELL_FURNITURE_VISUAL_GRID_OFFSET_BY_AXIS = {
  x: { x: 0.7, y: 0 },
  y: { x: 0.2, y: 0.3 },
};

const FLOOR_CENTER_X = FLOOR_TOP_LEFT_X + FLOOR_TILE_W / 2;
const FLOOR_TOP_Y = FLOOR_TOP_LEFT_Y;
const FLOOR_BOTTOM_Y = FLOOR_TOP_LEFT_Y + FLOOR_TILE_H + FLOOR_STEP_Y * ((ROOM_GRID_W - 1) + (ROOM_GRID_H - 1));
const FLOOR_MID_Y = (FLOOR_TOP_Y + FLOOR_BOTTOM_Y) / 2;
const FLOOR_HALF_WIDTH = FLOOR_TILE_W / 2 + FLOOR_STEP_X * (ROOM_GRID_W - 1);

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeFootprint(raw: any, source?: any) {
  const roomSize = source?.roomSize;
  const fallback = roomSize === '320x320'
    ? { w: 2, h: 2 }
    : roomSize === '320x160'
      ? { w: 2, h: 1 }
      : { w: 1, h: 1 };
  const w = Number(raw?.w ?? raw?.width ?? fallback.w ?? 1);
  const h = Number(raw?.h ?? raw?.height ?? fallback.h ?? 1);
  return {
    w: Math.max(1, Math.min(2, Number.isFinite(w) ? w : 1)),
    h: Math.max(1, Math.min(2, Number.isFinite(h) ? h : 1)),
  };
}

function gridToTopLeft(gridX: number, gridY: number) {
  return {
    x: FLOOR_TOP_LEFT_X + (gridX - gridY) * FLOOR_STEP_X,
    y: FLOOR_TOP_LEFT_Y + (gridX + gridY) * FLOOR_STEP_Y,
  };
}

function gridToAnchor(gridX: number, gridY: number) {
  const topLeft = gridToTopLeft(gridX, gridY);
  return {
    x: topLeft.x + FLOOR_TILE_W / 2,
    y: topLeft.y + FLOOR_TILE_H * 0.72,
  };
}

function getFootprint(catalog: any, source?: any) {
  return catalog?.footprint ? normalizeFootprint(catalog.footprint, source) : normalizeFootprint(source?.footprint, source);
}

function getTwoCellAxis(direction: RoomDirection) {
  const normalized = normalizeRoomDirection(direction);
  return normalized === 'NE' || normalized === 'SW' ? 'y' : 'x';
}

function getPlacementBounds(catalog: any, direction: RoomDirection = 'SW', source?: any) {
  const footprint = getFootprint(catalog, source);
  const normalized = normalizeRoomDirection(direction);

  if (footprint.w === 2 && footprint.h === 1) {
    if (getTwoCellAxis(normalized) === 'y') {
      return { minX: 0, maxX: 5, minY: 1, maxY: 5, footprint };
    }
    return { minX: 1, maxX: 5, minY: 0, maxY: 5, footprint };
  }

  if (footprint.w >= 2 || footprint.h >= 2) {
    return { minX: 0, maxX: 4, minY: 0, maxY: 4, footprint };
  }

  return { minX: 0, maxX: 5, minY: 0, maxY: 5, footprint };
}

function getOccupiedCellsForRender(gridX: number, gridY: number, catalog: any, direction: RoomDirection = 'SW', source?: any) {
  const footprint = getFootprint(catalog, source);
  const normalized = normalizeRoomDirection(direction);

  if (footprint.w === 2 && footprint.h === 1) {
    return getTwoCellAxis(normalized) === 'y'
      ? [{ x: gridX, y: gridY }, { x: gridX, y: gridY - 1 }]
      : [{ x: gridX, y: gridY }, { x: gridX - 1, y: gridY }];
  }

  const cells: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < footprint.h; y++) {
    for (let x = 0; x < footprint.w; x++) {
      cells.push({ x: gridX + x, y: gridY + y });
    }
  }
  return cells;
}

function gridToFurnitureAnchor(gridX: number, gridY: number, catalog: any, direction: RoomDirection = 'SW', source?: any) {
  const footprint = getFootprint(catalog, source);
  const anchors = getOccupiedCellsForRender(gridX, gridY, catalog, direction, source).map(cell => gridToAnchor(cell.x, cell.y));
  if (!anchors.length) return gridToAnchor(gridX, gridY);
  const base = {
    x: anchors.reduce((sum, anchor) => sum + anchor.x, 0) / anchors.length,
    y: anchors.reduce((sum, anchor) => sum + anchor.y, 0) / anchors.length,
  };
  const twoCellExtraOffset = footprint.w === 2 && footprint.h === 1
    ? TWO_CELL_FURNITURE_VISUAL_GRID_OFFSET_BY_AXIS[getTwoCellAxis(direction)]
    : null;
  const extraOffset = twoCellExtraOffset || (footprint.w >= 2 && footprint.h >= 2
    ? LARGE_FURNITURE_EXTRA_VISUAL_GRID_OFFSET
    : { x: 0, y: 0 });
  const visualOffset = {
    x: FURNITURE_VISUAL_GRID_OFFSET.x + extraOffset.x,
    y: FURNITURE_VISUAL_GRID_OFFSET.y + extraOffset.y,
  };

  return {
    x: base.x + (visualOffset.x - visualOffset.y) * FLOOR_STEP_X,
    y: base.y + (visualOffset.x + visualOffset.y) * FLOOR_STEP_Y,
  };
}

function playerToImage(position: RoomPlayerPosition) {
  return {
    x: position.x,
    y: position.y,
  };
}

function getZByImageY(imageY: number, base = 100) {
  return base + Math.round(imageY * 10);
}

function findInventoryItem(student: Student, placed: PlacedRoomItem): any {
  if (placed.inventoryItemId) {
    const direct = student.items.find((item: any) => item.id === placed.inventoryItemId && item.type === 'room');
    if (direct) return direct;
  }

  const byCatalog = student.items.find((item: any) =>
    item.type === 'room' &&
    (item.catalogItemId === (placed as any).catalogItemId ||
      item.catalogItemId === placed.itemId ||
      item.itemId === placed.itemId ||
      item.id === placed.itemId)
  );
  if (byCatalog) return byCatalog;

  return student.items.find((item: any) => item.id === placed.itemId);
}

function getCatalogIdFromPlaced(student: Student, placed: PlacedRoomItem): string | undefined {
  const inventoryItem = findInventoryItem(student, placed);
  return (
    (placed as any).catalogItemId ||
    getRoomItemCatalogIdFromItem(inventoryItem) ||
    placed.itemId
  );
}

function mergeRoomItemSource(inventoryItem?: any, placed?: any) {
  const merged: any = {};
  // placed item에는 좌표/방향 같은 배치 정보가 있고, inventory item에는 roomSize/footprint 같은 원본 metadata가 있습니다.
  // 구조 metadata는 원본 inventory item이 이겨야 320x160/320x320 제작 가구가 1칸으로 축소되지 않습니다.
  for (const obj of [placed, inventoryItem]) {
    if (!obj || typeof obj !== 'object') continue;
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined && value !== null) merged[key] = value;
    }
  }
  return merged;
}

function normalizeRoomDirection(direction?: string): RoomDirection {
  const upper = String(direction || '').toUpperCase();
  if (upper === 'FRONT') return 'SW' as RoomDirection;
  if (upper === 'BACK') return 'NW' as RoomDirection;
  if (upper === 'LEFT') return 'NW' as RoomDirection;
  if (upper === 'RIGHT') return 'SE' as RoomDirection;
  if (['NW', 'NE', 'SW', 'SE'].includes(upper)) return upper as RoomDirection;
  return 'SW' as RoomDirection;
}

function getCustomDirectionImage(images: any, direction: RoomDirection) {
  if (!images) return undefined;
  const upper = String(direction).toUpperCase();
  const lower = String(direction).toLowerCase();
  const legacyMap: Record<string, string[]> = {
    NW: ['NW', 'back', 'left'],
    NE: ['NE', 'back', 'right'],
    SW: ['SW', 'front', 'left'],
    SE: ['SE', 'front', 'right'],
  };
  for (const key of [upper, lower, ...(legacyMap[upper] || [])]) {
    if (images[key]) return images[key];
  }
  const firstKey = Object.keys(images)[0];
  return firstKey ? images[firstKey] : undefined;
}


function getCustomDisplayMinimumWidth(source: any, footprint: { w: number; h: number }) {
  const roomSize = source?.roomSize;
  if (roomSize === '320x320') return 150;
  if (roomSize === '320x160') return 118;
  return footprint.w >= 2 || footprint.h >= 2 ? 118 : 72;
}

function CroppedCustomFurnitureImage({
  src,
  name,
  source,
  footprint,
}: {
  src: string;
  name: string;
  source: any;
  footprint: { w: number; h: number };
}) {
  // 제작 가구는 item-editor의 guide footprint와 같은 기준으로 표시해야 합니다.
  // alpha crop으로 매번 크기를 다시 계산하면 위치에 따라 가구가 작아 보이는 착시/불일치가 생깁니다.
  const roomSize = source?.roomSize;
  const frameW = source?.spriteConfig?.frameWidth || (roomSize === '320x160' || roomSize === '320x320' ? 320 : 160);
  const frameH = source?.spriteConfig?.frameHeight || (roomSize === '320x320' ? 320 : 160);
  const customSizeScale = footprint.w >= 2 && footprint.h >= 2
    ? 1.2
    : footprint.w === 2 && footprint.h === 1
      ? 1.2
      : 1;
  const displayWidth = footprint.w * 80 * customSizeScale;
  const displayHeight = footprint.h * 80 * customSizeScale;

  // <img>는 Tailwind preflight의 max-width: 100% / height:auto 영향으로
  // 부모 button의 자동 크기 계산 상황에서 특정 좌표의 제작 가구가 작아 보일 수 있습니다.
  // 제작 가구는 좌표와 무관하게 항상 footprint 기준의 고정 크기로 보여야 하므로
  // 고정 크기 div + background-image 방식으로 렌더링합니다.
  return (
    <div
      role="img"
      aria-label={name}
      className="drop-shadow-md pointer-events-none"
      style={{
        width: displayWidth,
        height: displayHeight,
        minWidth: displayWidth,
        minHeight: displayHeight,
        maxWidth: 'none',
        maxHeight: 'none',
        backgroundImage: `url('${src}')`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center bottom',
        backgroundSize: 'contain',
        imageRendering: 'pixelated',
      }}
    />
  );
}


export function IsometricRoomEnhanced({
  student,
  position,
  placedItems,
  showGrid = false,
  onItemClick,
  cameraOffset,
}: IsometricRoomEnhancedProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ active: boolean; startX: number; startY: number; baseX: number; baseY: number; pointerId?: number }>({
    active: false,
    startX: 0,
    startY: 0,
    baseX: 0,
    baseY: 0,
  });

  const [offset, setOffset] = useState(cameraOffset || { x: 80, y: 40 });

  const clampOffset = (next: { x: number; y: number }) => {
    const rect = containerRef.current?.getBoundingClientRect();
    const width = rect?.width || 800;
    const height = rect?.height || 600;
    const centerX = (width - ROOM_IMAGE_WIDTH) / 2;
    const centerY = (height - ROOM_IMAGE_HEIGHT) / 2;

    // 방 이미지가 viewport보다 작을 때 기존 min/max 계산이 역전되어 offset이 고정되는 문제가 있었습니다.
    // 중앙 기준으로 여유 이동 범위를 주어 마우스/터치 드래그가 항상 동작하게 합니다.
    const slackX = Math.max(180, Math.abs(width - ROOM_IMAGE_WIDTH) / 2 + 80);
    const slackY = Math.max(140, Math.abs(height - ROOM_IMAGE_HEIGHT) / 2 + 80);

    return {
      x: clamp(next.x, centerX - slackX, centerX + slackX),
      y: clamp(next.y, centerY - slackY, centerY + slackY),
    };
  };

  useEffect(() => {
    const centerRoom = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setOffset(
        clampOffset({
          x: (rect.width - ROOM_IMAGE_WIDTH) / 2,
          y: (rect.height - ROOM_IMAGE_HEIGHT) / 2,
        })
      );
    };
    centerRoom();
    window.addEventListener('resize', centerRoom);
    return () => window.removeEventListener('resize', centerRoom);
  }, []);

  const gridCells = useMemo(() => {
    const result: Array<{ x: number; y: number; topLeft: { x: number; y: number } }> = [];
    for (let y = 0; y < ROOM_GRID_H; y++) {
      for (let x = 0; x < ROOM_GRID_W; x++) {
        result.push({ x, y, topLeft: gridToTopLeft(x, y) });
      }
    }
    return result;
  }, []);

  const sortedItems = useMemo(() => {
    return [...(placedItems || [])].sort((a: any, b: any) => {
      const ay = gridToAnchor(Number(a.gridX ?? 3), Number(a.gridY ?? 4)).y;
      const by = gridToAnchor(Number(b.gridX ?? 3), Number(b.gridY ?? 4)).y;
      return ay - by;
    });
  }, [placedItems]);

  const beginDrag = (clientX: number, clientY: number, pointerId?: number) => {
    dragRef.current = { active: true, startX: clientX, startY: clientY, baseX: offset.x, baseY: offset.y, pointerId };
  };

  const moveDrag = (clientX: number, clientY: number, pointerId?: number) => {
    const drag = dragRef.current;
    if (!drag.active) return;
    if (drag.pointerId !== undefined && pointerId !== undefined && drag.pointerId !== pointerId) return;
    setOffset(clampOffset({ x: drag.baseX + clientX - drag.startX, y: drag.baseY + clientY - drag.startY }));
  };

  const endDrag = () => {
    dragRef.current.active = false;
    dragRef.current.pointerId = undefined;
  };

  const playerImage = playerToImage(position);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-gradient-to-b from-sky-100 via-blue-50 to-slate-100 touch-none cursor-grab active:cursor-grabbing select-none"
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest('button')) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture?.(e.pointerId);
        beginDrag(e.clientX, e.clientY, e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!dragRef.current.active) return;
        e.preventDefault();
        moveDrag(e.clientX, e.clientY, e.pointerId);
      }}
      onPointerUp={(e) => {
        e.currentTarget.releasePointerCapture?.(e.pointerId);
        endDrag();
      }}
      onPointerCancel={endDrag}
      onLostPointerCapture={endDrag}
    >
      <div
        className="absolute"
        style={{ left: offset.x, top: offset.y, width: ROOM_IMAGE_WIDTH, height: ROOM_IMAGE_HEIGHT }}
      >
        <img
          src={ROOM_IMAGE}
          alt="아이소메트릭 방"
          draggable={false}
          className="absolute inset-0 select-none pointer-events-none"
          style={{
            width: ROOM_IMAGE_WIDTH,
            height: ROOM_IMAGE_HEIGHT,
            imageRendering: 'pixelated',
            zIndex: 10,
          }}
        />

        {showGrid &&
          gridCells.map((cell) => (
            <div
              key={`grid-${cell.x}-${cell.y}`}
              className="absolute pointer-events-none"
              style={{
                left: cell.topLeft.x,
                top: cell.topLeft.y,
                width: FLOOR_TILE_W,
                height: FLOOR_TILE_H,
                clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0 50%)',
                boxShadow: 'inset 0 0 0 1px rgba(245, 158, 11, 0.28)',
                background: 'rgba(245, 158, 11, 0.04)',
                zIndex: 20,
              }}
            />
          ))}

        {sortedItems.map((item: any) => {
          const inventoryItem = findInventoryItem(student, item);
          const source = mergeRoomItemSource(inventoryItem, item);
          const catalogId = getCatalogIdFromPlaced(student, item);
          const catalog = getRoomItemById(catalogId);
          const direction = normalizeRoomDirection((item.direction || catalog?.defaultDirection || (source as any)?.defaultDirection || (source as any)?.availableDirections?.[0] || 'SW') as string);
          const footprint = getFootprint(catalog, source);
          const bounds = getPlacementBounds(catalog, direction, source);
          const gx = clamp(Number(item.gridX ?? 3), bounds.minX, bounds.maxX);
          const gy = clamp(Number(item.gridY ?? 4), bounds.minY, bounds.maxY);
          const anchor = gridToFurnitureAnchor(gx, gy, catalog, direction, source);
          const customSprite = (source as any)?.spriteConfig;
          const customRoomSize = (source as any)?.roomSize;
          const customDirectionImages = (source as any)?.directionImages;
          const customImageUrl = getCustomDirectionImage(customDirectionImages, direction) || source?.imageUrl;
          const customFrameW = customSprite?.frameWidth || (customRoomSize === '320x160' || customRoomSize === '320x320' ? 320 : 160);
          const customFrameH = customSprite?.frameHeight || (customRoomSize === '320x320' ? 320 : 160);
          // 제작 가구는 캔버스 전체를 80px 박스로 줄이면 실제 그림이 지나치게 작아집니다.
          // editor의 1px을 room에서도 거의 1px로 보이게 표시해 투명 여백이 있어도 실제 그림 크기가 유지되도록 합니다.
          const customDisplayWidth = customFrameW;
          const customDisplayHeight = customFrameH;
          const displayWidth = catalog?.renderWidth || (catalog?.id.includes('bed') ? 118 : 80);

          if (!catalog && inventoryItem?.type !== 'room') return null;

          return (
            <button
              key={item.id || `${catalogId}-${gx}-${gy}`}
              type="button"
              onClick={() => onItemClick?.(item.id || item.itemId)}
              className="absolute -translate-x-1/2 -translate-y-full cursor-pointer group bg-transparent border-0 p-0"
              style={{
                left: anchor.x,
                top: anchor.y,
                zIndex: getZByImageY(anchor.y, 900),
              }}
            >
              {catalog ? (
                <div className="drop-shadow-md" style={getRoomItemFrameStyle(catalog.id, direction, displayWidth)} />
              ) : customImageUrl ? (
                <CroppedCustomFurnitureImage
                  src={customImageUrl}
                  name={source?.name || '가구'}
                  source={source}
                  footprint={footprint}
                />
              ) : (
                <span className="text-4xl drop-shadow-md">{source?.icon || '📦'}</span>
              )}
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-black/75 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap">
                {source?.name || catalog?.name || '아이템'}
              </span>
            </button>
          );
        })}

        <div
          className="absolute -translate-x-1/2 -translate-y-full pointer-events-none"
          style={{
            left: playerImage.x,
            top: playerImage.y,
            zIndex: getZByImageY(playerImage.y, 1500),
          }}
        >
          <div className="flex flex-col items-center">
            <div className="scale-[0.55] origin-bottom">
              <SpriteAvatarRenderer
                avatarState={{
                  ...(student.avatarState || { skinColor: '#E8B9A0', equipped: {} }),
                  facing: position.facing,
                  animationState: position.isMoving ? 'walk' : 'idle',
                }}
                inventory={student.items}
                facing={position.facing}
              />
            </div>
            <div className="-mt-4 text-[10px] font-bold text-center bg-white/90 px-2 py-0.5 rounded shadow-sm whitespace-nowrap">
              {student.nickname}
            </div>
          </div>
        </div>
      </div>

      <div className="absolute top-4 left-4 bg-white/90 px-3 py-2 rounded-lg shadow-md text-xs font-semibold pointer-events-none">
        🎮 아이소메트릭 방
      </div>
      <div className="absolute top-4 right-4 bg-black/50 text-white px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-sm pointer-events-none">
        WASD 이동 · 드래그로 화면 이동
      </div>
    </div>
  );
}
