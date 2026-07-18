'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  RotateCw,
  Trash2,
  Play,
  Pause,
} from 'lucide-react';
import { getStudentSession } from '@/lib/class-storage';
import { findStudent, saveStudentRoomState } from '@/lib/db-wrapper';
import { MobileDPad } from '@/components/room/MobileDPad';
import { useRoomMovement } from '@/hooks/useRoomMovement';
import { IsometricRoomEnhanced } from '@/components/room/IsometricRoomEnhanced';
import { getRoomItemById, getRoomItemCatalogIdFromItem, getRoomItemFrameStyle } from '@/lib/room-items-registry';
import type { Student, RoomState, PlacedRoomItem, RoomDirection } from '@/lib/types';

// 그리드 설정
const GRID_SIZE = 40;
const ROOM_WIDTH = 800;
const ROOM_HEIGHT = 600;
const ROOM_GRID_SIZE = 6;
const FLOOR_TILE_W = 80;
const FLOOR_TILE_H = 48;
const FLOOR_TOP_LEFT_X = 240;
const FLOOR_TOP_LEFT_Y = 170;
const FLOOR_STEP_X = 37.5;
const FLOOR_STEP_Y = 21;
const PLAYER_MIN_X = 45;
const PLAYER_MAX_X = 515;
const PLAYER_MIN_Y = 155;
const PLAYER_MAX_Y = 428;

const FLOOR_CENTER_X = FLOOR_TOP_LEFT_X + FLOOR_TILE_W / 2;
const FLOOR_CENTER_Y = FLOOR_TOP_LEFT_Y + (FLOOR_TILE_H + FLOOR_STEP_Y * ((ROOM_GRID_SIZE - 1) * 2)) / 2;
const FLOOR_HALF_W = FLOOR_TILE_W / 2 + FLOOR_STEP_X * (ROOM_GRID_SIZE - 1);
const FLOOR_HALF_H = (FLOOR_TILE_H + FLOOR_STEP_Y * ((ROOM_GRID_SIZE - 1) * 2)) / 2;

// 벽걸이 아이템은 X/Y 벽면 위치와 Z 높이를 함께 관리합니다.
const WALL_GRID_W = 6;
const WALL_GRID_H = 5;
// wallZ는 양쪽 벽에서 같은 방식으로 동작하는 '높이 축'입니다.
const WALL_Z_MIN = 1;
const WALL_Z_MAX = 4;
const WALL_Z_DEFAULT = 4;
const WALL_AXIS_VERSION = 2;
const WALL_START_X = 135;
const WALL_START_Y = 62;
const WALL_STEP_X = 58;
const WALL_STEP_Y = 35;

function isPointInsideFloor(x: number, y: number, margin = 18) {
  const halfW = FLOOR_HALF_W - margin;
  const halfH = FLOOR_HALF_H - margin;
  if (halfW <= 0 || halfH <= 0) return false;
  return Math.abs(x - FLOOR_CENTER_X) / halfW + Math.abs(y - FLOOR_CENTER_Y) / halfH <= 1;
}

function roomGridToAnchor(gridX: number, gridY: number) {
  return {
    x: FLOOR_TOP_LEFT_X + (gridX - gridY) * FLOOR_STEP_X + FLOOR_TILE_W / 2,
    y: FLOOR_TOP_LEFT_Y + (gridX + gridY) * FLOOR_STEP_Y + FLOOR_TILE_H * 0.72,
  };
}

function isWallItem(catalogId?: string, source?: any) {
  const catalog = getRoomItemById(catalogId);
  return catalog?.category === 'wall' || source?.category === 'wall' || source?.placement === 'wall';
}

function getCatalogSizeVariant(catalogId?: string, source?: any) {
  const catalog: any = getRoomItemById(catalogId);
  if (!catalog?.sizeVariants) return undefined;
  const defaultSize = catalog?.resizable?.defaultSize ?? 2;
  const rawSize = Number(source?.carpetSize ?? source?.sizeLevel ?? defaultSize);
  const size = Math.max(catalog?.resizable?.min ?? 2, Math.min(catalog?.resizable?.max ?? 4, Number.isFinite(rawSize) ? rawSize : defaultSize));
  return catalog.sizeVariants[String(size)] || catalog.sizeVariants[String(defaultSize)] || catalog.sizeVariants[Object.keys(catalog.sizeVariants)[0]];
}

function getEffectiveRoomSource(catalogId?: string, source?: any) {
  const variant = getCatalogSizeVariant(catalogId, source);
  if (!variant) return source || {};
  const catalog: any = getRoomItemById(catalogId);
  const defaultSize = catalog?.resizable?.defaultSize ?? 2;
  const rawSize = Number(source?.carpetSize ?? source?.sizeLevel ?? defaultSize);
  const size = Math.max(catalog?.resizable?.min ?? 2, Math.min(catalog?.resizable?.max ?? 4, Number.isFinite(rawSize) ? rawSize : defaultSize));
  return {
    ...(source || {}),
    roomSize: variant.roomSize || source?.roomSize,
    footprint: variant.footprint || source?.footprint,
    directionImages: variant.directionImages || source?.directionImages,
    carpetSize: size,
    nonBlocking: true,
  };
}

function isNonBlockingRoomItem(catalogId?: string, source?: any) {
  const catalog: any = getRoomItemById(catalogId);
  return Boolean(catalog?.nonBlocking || source?.nonBlocking || catalog?.category === 'floor' || source?.category === 'floor');
}

function getWallSide(direction: RoomDirection = 'SW') {
  const normalized = normalizeRoomDirection(direction);
  // 사용자 기준: NE/SW는 우측 벽, NW/SE는 좌측 벽에 붙습니다.
  return normalized === 'NE' || normalized === 'SW' ? 'right' : 'left';
}

function clampWallZ(value: number) {
  const numeric = Number.isFinite(value) ? value : WALL_Z_DEFAULT;
  return Math.max(WALL_Z_MIN, Math.min(WALL_Z_MAX, numeric));
}

function getPlacedWallZ(item: any, direction: RoomDirection = 'SW') {
  const side = getWallSide(direction);
  const raw = Number(item?.wallZ ?? WALL_Z_DEFAULT);
  // 이전 저장 데이터 보정: 좌측 벽의 기존 최상단(Z:3), 우측 벽의 기존 최상단(Z:0)을 새 기준 Z:4로 해석합니다.
  if (item?.wallAxisVersion !== WALL_AXIS_VERSION) {
    if (side === 'left' && raw === 3) return WALL_Z_MAX;
    if (side === 'right' && raw <= 1) return WALL_Z_MAX;
  }
  return clampWallZ(raw);
}

function wallGridToAnchor(gridX: number, gridY: number, wallZ: number, direction: RoomDirection = 'SW') {
  const side = getWallSide(direction);
  const baseX = side === 'left' ? 92 : 292;
  const baseY = 126;
  const gx = Math.max(0, Math.min(WALL_GRID_W - 1, Number(gridX) || 0));
  const gy = Math.max(0, Math.min(WALL_GRID_H - 1, Number(gridY) || 0));
  const z = clampWallZ(wallZ);
  // X/Y는 벽면 위의 위치, Z는 높이입니다.
  // 좌측 벽(NW/SE)은 기존 이동감을 유지하고, 우측 벽(NE/SW)은 반대 기울기로 이동합니다.
  const along = side === 'right' ? gx : gy;
  const wallSlopeY = side === 'right' ? along * 24 : -along * 24;
  const verticalY = side === 'right'
    ? (WALL_Z_MAX - z) * WALL_STEP_Y - 70
    : (WALL_Z_MAX - z) * WALL_STEP_Y + 35;
  return {
    x: baseX + along * 42,
    y: baseY + wallSlopeY + verticalY,
  };
}

function roomGridToFurnitureAnchor(gridX: number, gridY: number, catalogId?: string, direction: RoomDirection = 'front', source?: any, wallZ?: number) {
  if (isWallItem(catalogId, source)) return wallGridToAnchor(gridX, gridY, clampWallZ(Number(wallZ ?? WALL_Z_DEFAULT)), direction);
  const cells = getOccupiedCells(gridX, gridY, catalogId, direction, source);
  if (!cells.length) return roomGridToAnchor(gridX, gridY);
  const anchors = cells.map(cell => roomGridToAnchor(cell.x, cell.y));
  return {
    x: anchors.reduce((sum, anchor) => sum + anchor.x, 0) / anchors.length,
    y: anchors.reduce((sum, anchor) => sum + anchor.y, 0) / anchors.length,
  };
}

function clampGrid(value: number) {
  return Math.max(0, Math.min(ROOM_GRID_SIZE - 1, value));
}

function getFootprintByRoomSize(roomSize?: string) {
  if (roomSize === '640x640') return { w: 4, h: 4 };
  if (roomSize === '480x480') return { w: 3, h: 3 };
  if (roomSize === '320x320') return { w: 2, h: 2 };
  if (roomSize === '640x160') return { w: 4, h: 1 };
  if (roomSize === '480x160') return { w: 3, h: 1 };
  if (roomSize === '320x160') return { w: 2, h: 1 };
  return { w: 1, h: 1 };
}

function normalizeFootprint(raw: any, source?: any) {
  const fallback = getFootprintByRoomSize(source?.roomSize);
  const w = Number(raw?.w ?? raw?.width ?? fallback.w ?? 1);
  const h = Number(raw?.h ?? raw?.height ?? fallback.h ?? 1);
  return {
    w: Math.max(1, Math.min(4, Number.isFinite(w) ? w : 1)),
    h: Math.max(1, Math.min(4, Number.isFinite(h) ? h : 1)),
  };
}

function getSourceFootprint(source?: any) {
  return normalizeFootprint(source?.footprint, source);
}

function mergeRoomItemSource(source?: any, placed?: any) {
  const merged: any = {};
  // placed보다 학생 inventory의 원본 item metadata가 우선입니다.
  // placed에 예전 fallback footprint(1x1)가 남아 있으면 2칸/4칸 가구가 계속 1칸으로 취급됩니다.
  for (const obj of [placed, source]) {
    if (!obj || typeof obj !== 'object') continue;
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined && value !== null) merged[key] = value;
    }
  }
  if (!merged.footprint) {
    merged.footprint = getSourceFootprint(merged);
  }
  return merged;
}

function getPlacedSourceFromItems(placed: any, inventory: any[] = []) {
  const inventoryItem = inventory.find((item: any) =>
    item.id === placed?.inventoryItemId ||
    item.id === placed?.itemId ||
    item.itemId === placed?.itemId ||
    item.catalogItemId === placed?.itemId
  );
  return getEffectiveRoomSource(getPlacedCatalogId(placed), mergeRoomItemSource(inventoryItem, placed));
}

function getEffectiveFootprint(catalogId?: string, direction: RoomDirection = 'front', source?: any) {
  const catalog = getRoomItemById(catalogId);
  const variant = getCatalogSizeVariant(catalogId, source);
  if (variant?.footprint) return normalizeFootprint(variant.footprint, variant);
  return catalog?.footprint ? normalizeFootprint(catalog.footprint, source) : getSourceFootprint(source);
}

function getTwoCellAxis(direction: RoomDirection) {
  const normalized = normalizeRoomDirection(direction);
  // ↗/↙ 방향의 2칸 가구는 y축 방향으로 한 칸을 같이 차지합니다.
  // ↖/↘ 방향의 2칸 가구는 x축 방향으로 한 칸을 같이 차지합니다.
  return normalized === 'NE' || normalized === 'SW' ? 'y' : 'x';
}

function getPlacementBounds(catalogId?: string, direction: RoomDirection = 'front', source?: any) {
  if (isWallItem(catalogId, source)) {
    const wallSide = getWallSide(direction);
    // 우측 벽(NE/SW)은 X=5까지 가면 벽 바깥으로 삐져나오므로 X=4까지만 허용합니다.
    return { minX: 0, maxX: wallSide === 'right' ? 4 : WALL_GRID_W - 1, minY: 0, maxY: WALL_GRID_H - 1, footprint: getEffectiveFootprint(catalogId, direction, source) };
  }
  const footprint = getEffectiveFootprint(catalogId, direction, source);
  const normalized = normalizeRoomDirection(direction);

  if (footprint.h === 1 && footprint.w > 1) {
    if (getTwoCellAxis(normalized) === 'y') {
      return { minX: 0, maxX: ROOM_GRID_SIZE - 1, minY: footprint.w - 1, maxY: ROOM_GRID_SIZE - 1, footprint };
    }
    return { minX: footprint.w - 1, maxX: ROOM_GRID_SIZE - 1, minY: 0, maxY: ROOM_GRID_SIZE - 1, footprint };
  }

  if (footprint.w >= 2 || footprint.h >= 2) {
    return { minX: 0, maxX: Math.max(0, ROOM_GRID_SIZE - footprint.w), minY: 0, maxY: Math.max(0, ROOM_GRID_SIZE - footprint.h), footprint };
  }

  return { minX: 0, maxX: ROOM_GRID_SIZE - 1, minY: 0, maxY: ROOM_GRID_SIZE - 1, footprint };
}

function getOccupiedCells(gridX: number, gridY: number, catalogId?: string, direction: RoomDirection = 'front', source?: any) {
  if (isWallItem(catalogId, source)) return [{ x: gridX, y: gridY }];
  const footprint = getEffectiveFootprint(catalogId, direction, source);
  const normalized = normalizeRoomDirection(direction);

  if (footprint.h === 1 && footprint.w > 1) {
    return Array.from({ length: footprint.w }, (_, i) => getTwoCellAxis(normalized) === 'y'
      ? { x: gridX, y: gridY - i }
      : { x: gridX - i, y: gridY }
    );
  }

  const cells: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < footprint.h; y++) {
    for (let x = 0; x < footprint.w; x++) {
      cells.push({ x: gridX + x, y: gridY + y });
    }
  }
  return cells;
}

function isPlacementInsideRoom(gridX: number, gridY: number, catalogId?: string, direction: RoomDirection = 'front', source?: any) {
  const bounds = getPlacementBounds(catalogId, direction, source);
  if (gridX < bounds.minX || gridY < bounds.minY || gridX > bounds.maxX || gridY > bounds.maxY) return false;
  if (isWallItem(catalogId, source)) return true;
  return getOccupiedCells(gridX, gridY, catalogId, direction, source).every(cell =>
    cell.x >= 0 && cell.x < ROOM_GRID_SIZE && cell.y >= 0 && cell.y < ROOM_GRID_SIZE
  );
}

function getPlacedCatalogId(item: any): string | undefined {
  return (item?.catalogItemId || item?.itemId) as string | undefined;
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

function getItemDirections(catalogId?: string, source?: any): RoomDirection[] {
  const catalog = getRoomItemById(catalogId);
  const directionImageKeys = source?.directionImages ? Object.keys(source.directionImages) : [];
  const rawDirections = catalog?.availableDirections || source?.availableDirections || directionImageKeys || ['SW', 'NE', 'NW', 'SE'];
  const normalized = rawDirections
    .map((dir: any) => String(dir || '').toUpperCase())
    .map((dir: string) => {
      if (dir === 'FRONT') return 'SW';
      if (dir === 'BACK') return 'NW';
      if (dir === 'LEFT') return 'NW';
      if (dir === 'RIGHT') return 'SE';
      if (['NW', 'NE', 'SW', 'SE'].includes(dir)) return dir;
      return dir;
    })
    .filter((dir: string) => ['NW', 'NE', 'SW', 'SE'].includes(dir)) as RoomDirection[];
  return normalized.length ? Array.from(new Set(normalized)) : ['SW', 'NE', 'NW', 'SE'];
}

function getDefaultDirection(catalogId?: string, source?: any): RoomDirection {
  const catalog = getRoomItemById(catalogId);
  const raw = (catalog?.defaultDirection || source?.defaultDirection || source?.availableDirections?.[0] || 'SW') as string;
  const normalized = raw.toUpperCase();
  if (normalized === 'FRONT') return 'SW';
  if (normalized === 'BACK') return 'NW';
  if (normalized === 'LEFT') return 'NW';
  if (normalized === 'RIGHT') return 'SE';
  return (['NW', 'NE', 'SW', 'SE'].includes(normalized) ? normalized : 'SW') as RoomDirection;
}

function doCellsOverlap(a: Array<{ x: number; y: number }>, b: Array<{ x: number; y: number }>) {
  const keySet = new Set(a.map(cell => `${cell.x},${cell.y}`));
  return b.some(cell => keySet.has(`${cell.x},${cell.y}`));
}

function isPlacementAvailable(
  placedItems: PlacedRoomItem[] = [],
  gridX: number,
  gridY: number,
  catalogId?: string,
  direction: RoomDirection = 'front',
  excludePlacedId?: string,
  source?: any
) {
  if (!isPlacementInsideRoom(gridX, gridY, catalogId, direction, source)) return false;
  if (isNonBlockingRoomItem(catalogId, source)) return true;

  const targetIsWall = isWallItem(catalogId, source);
  const targetCells = getOccupiedCells(gridX, gridY, catalogId, direction, source);
  const targetWallSide = targetIsWall ? getWallSide(direction) : null;
  return !placedItems.some((existing: any) => {
    if (excludePlacedId && existing.id === excludePlacedId) return false;
    const existingCatalogId = getPlacedCatalogId(existing);
    if (isNonBlockingRoomItem(existingCatalogId, existing)) return false;
    const existingIsWall = isWallItem(existingCatalogId, existing);
    if (targetIsWall !== existingIsWall) return false;
    const existingDirection = normalizeRoomDirection((existing.direction || getDefaultDirection(existingCatalogId, existing)) as string);
    if (targetIsWall && targetWallSide !== getWallSide(existingDirection)) return false;
    const existingCells = getOccupiedCells(
      existingIsWall ? Math.max(0, Math.min(WALL_GRID_W - 1, Number(existing.gridX ?? 0))) : clampGrid(Number(existing.gridX ?? 0)),
      existingIsWall ? Math.max(0, Math.min(WALL_GRID_H - 1, Number(existing.gridY ?? 0))) : clampGrid(Number(existing.gridY ?? 0)),
      existingCatalogId,
      existingDirection,
      existing
    );
    return doCellsOverlap(targetCells, existingCells);
  });
}

function findAvailablePlacement(placedItems: PlacedRoomItem[] = [], catalogId?: string, direction: RoomDirection = 'front', source?: any) {
  const candidates: Array<{ x: number; y: number; score: number }> = [];
  const isWall = isWallItem(catalogId, source);
  const maxX = isWall ? WALL_GRID_W - 1 : ROOM_GRID_SIZE - 1;
  const minY = 0;
  const maxY = isWall ? WALL_GRID_H - 1 : ROOM_GRID_SIZE - 1;
  const centerX = maxX / 2;
  const centerY = (minY + maxY) / 2;
  for (let y = minY; y <= maxY; y++) {
    for (let x = 0; x <= maxX; x++) {
      candidates.push({ x, y, score: Math.abs(x - centerX) + Math.abs(y - centerY) });
    }
  }

  candidates.sort((a, b) => a.score - b.score || a.y - b.y || a.x - b.x);
  return candidates.find(candidate => isPlacementAvailable(placedItems, candidate.x, candidate.y, catalogId, direction, undefined, source));
}

function isPlayerInsidePlacedItem(x: number, y: number, item: any) {
  const catalogId = getPlacedCatalogId(item);
  if (isWallItem(catalogId, item) || isNonBlockingRoomItem(catalogId, item)) return false;
  const direction = (item.direction || 'front') as RoomDirection;
  const gx = clampGrid(Number(item.gridX ?? 0));
  const gy = clampGrid(Number(item.gridY ?? 0));
  const anchor = roomGridToFurnitureAnchor(gx, gy, catalogId, direction, item);

  // alpha 0 영역이 collision처럼 느껴지지 않도록,
  // registry에 정의된 실제 바닥 접촉 영역에 가까운 작은 충돌 박스를 사용합니다.
  const catalog = getRoomItemById(catalogId);
  const collision = catalog?.collision || (catalogId?.includes('bed')
    ? { halfW: 38, halfH: 12, offsetY: -5 }
    : { halfW: 22, halfH: 18, offsetY: -8 });
  const centerY = anchor.y + collision.offsetY;

  return x >= anchor.x - collision.halfW && x <= anchor.x + collision.halfW && y >= centerY - collision.halfH && y <= centerY + collision.halfH;
}

function isPointBlockedByItems(x: number, y: number, placedItems: PlacedRoomItem[] = []) {
  if (!isPointInsideFloor(x, y)) return true;
  return placedItems.some((item: any) => isPlayerInsidePlacedItem(x, y, item));
}

function findSafePlayerSpawn(placedItems: PlacedRoomItem[] = []) {
  const candidates = [
    { x: FLOOR_CENTER_X, y: FLOOR_CENTER_Y + 48, facing: 'front' as RoomDirection },
    { x: FLOOR_CENTER_X + 70, y: FLOOR_CENTER_Y + 42, facing: 'front' as RoomDirection },
    { x: FLOOR_CENTER_X - 70, y: FLOOR_CENTER_Y + 42, facing: 'front' as RoomDirection },
    { x: FLOOR_CENTER_X, y: FLOOR_CENTER_Y + 88, facing: 'front' as RoomDirection },
    { x: FLOOR_CENTER_X + 105, y: FLOOR_CENTER_Y + 72, facing: 'front' as RoomDirection },
    { x: FLOOR_CENTER_X - 105, y: FLOOR_CENTER_Y + 72, facing: 'front' as RoomDirection },
  ];

  return candidates.find(pos => !isPointBlockedByItems(pos.x, pos.y, placedItems)) || candidates[0];
}

function RoomContent() {
  const router = useRouter();
  const [student, setStudent] = useState<Student | null>(null);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [showDPad, setShowDPad] = useState(false);

  const isPlayerBlocked = useCallback((x: number, y: number) => {
    if (!isPointInsideFloor(x, y)) return true;

    const placedItems = roomState?.placedItems || [];
    return placedItems.some((item: any) => isPlayerInsidePlacedItem(x, y, item));
  }, [roomState?.placedItems]);

  // 캐릭터 이동
  const { position, movePlayer, setPlayerPosition } = useRoomMovement({
    initialX: FLOOR_CENTER_X,
    initialY: FLOOR_CENTER_Y + 48,
    gridBased: false,
    minX: PLAYER_MIN_X,
    maxX: PLAYER_MAX_X,
    minY: PLAYER_MIN_Y,
    maxY: PLAYER_MAX_Y,
    isBlocked: isPlayerBlocked,
  });

  // 초기 로드
  useEffect(() => {
    const loadStudent = async () => {
      const session = getStudentSession();
      if (!session) {
        router.push('/student');
        return;
      }

      try {
        const result = await findStudent(session.classCode, session.attendanceNumber);
        if (result.success && result.student) {
          setStudent(result.student);
          const initialRoomState = result.student.roomState ?? { skinColor: '#FFF8DC', equipped: {}, placedItems: [] };
          setRoomState(initialRoomState);
          
          // 저장된 위치가 floor 밖이거나 가구와 겹치면 안전한 스폰 위치로 보정합니다.
          const placedItems = initialRoomState.placedItems || [];
          if (
            initialRoomState.playerPosition &&
            !isPointBlockedByItems(initialRoomState.playerPosition.x, initialRoomState.playerPosition.y, placedItems)
          ) {
            setPlayerPosition(initialRoomState.playerPosition.x, initialRoomState.playerPosition.y, initialRoomState.playerPosition.facing);
          } else {
            const safeSpawn = findSafePlayerSpawn(placedItems);
            setPlayerPosition(safeSpawn.x, safeSpawn.y, safeSpawn.facing);
          }
        } else {
          router.push('/student');
        }
      } catch (err) {
        console.error('학생 정보 로드 오류:', err);
        router.push('/student');
      } finally {
        setLoading(false);
      }
    };

    loadStudent();

    const updateTouchControls = () => {
      if (typeof window === 'undefined') return;
      const hasTouch = navigator.maxTouchPoints > 0 || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
      const isSmallScreen = window.innerWidth < 768;
      // 태블릿은 화면 폭이 768px보다 커도 터치 기반이므로 Virtual Joystick을 보여줍니다.
      setShowDPad(Boolean(hasTouch || isSmallScreen));
    };

    updateTouchControls();
    window.addEventListener('resize', updateTouchControls);
    window.addEventListener('orientationchange', updateTouchControls);
    return () => {
      window.removeEventListener('resize', updateTouchControls);
      window.removeEventListener('orientationchange', updateTouchControls);
    };
  }, [router, setPlayerPosition]);

  // 방 상태 저장
  const handleSave = useCallback(async () => {
    if (!student || !roomState) return;

    setSaving(true);
    try {
      const session = getStudentSession();
      if (session) {
        // 현재 플레이어 위치도 함께 저장
        const finalRoomState = {
          ...roomState,
          playerPosition: {
            x: position.x,
            y: position.y,
            facing: position.facing
          }
        };
        saveStudentRoomState(session.classCode, session.attendanceNumber, finalRoomState);
        setTimeout(() => {
          setSaving(false);
          setEditMode(false);
          alert('방 정보가 저장되었습니다.');
        }, 500);
      }
    } catch (err) {
      console.error('저장 오류:', err);
      setSaving(false);
    }
  }, [student, roomState, position, router]);

  // 아이템 추가
  const handleAddItem = useCallback((item: PlacedRoomItem) => {
    setRoomState(prev => {
      if (!prev) return prev;
      const alreadyPlaced = (prev.placedItems || []).some(existing =>
        (item.inventoryItemId && existing.inventoryItemId === item.inventoryItemId) ||
        (item.id && existing.id === item.id)
      );
      if (alreadyPlaced) return prev;
      return {
        ...prev,
        placedItems: [...(prev.placedItems || []), item]
      };
    });
    setSelectedItemId(item.id || null);
  }, []);

  // 아이템 제거
  const handleRemoveItem = useCallback((itemId: string) => {
    setRoomState(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        placedItems: (prev.placedItems || []).filter(item => item.id !== itemId)
      };
    });
    setSelectedItemId(null);
  }, []);

  // 아이템 회전
  const handleRotateItem = useCallback((itemId: string) => {
    setRoomState(prev => {
      if (!prev) return prev;
      const placedItems = prev.placedItems || [];
      return {
        ...prev,
        placedItems: placedItems.map(item => {
          if (item.id === itemId) {
            const catalogId = getPlacedCatalogId(item);
            const source = getPlacedSourceFromItems(item, student?.items || []);
            const directions = getItemDirections(catalogId, source).map(dir => normalizeRoomDirection(dir));
            const currentDirection = normalizeRoomDirection((item.direction || getDefaultDirection(catalogId, source)) as string);
            const currentIndex = directions.indexOf(currentDirection);
            const baseIndex = currentIndex >= 0 ? currentIndex : 0;
            const nextDirection = directions[(baseIndex + 1) % directions.length];
            const nextBounds = getPlacementBounds(catalogId, nextDirection, source);
            const nextGridX = Math.max(nextBounds.minX, Math.min(nextBounds.maxX, Number(item.gridX ?? 0)));
            const isWall = isWallItem(catalogId, source);
            const currentWallZ = getPlacedWallZ(item, currentDirection);
            const nextGridY = Math.max(nextBounds.minY, Math.min(nextBounds.maxY, Number(item.gridY ?? 0)));
            const nextWallZ = isWall ? currentWallZ : undefined;

            if (!isPlacementAvailable(placedItems, nextGridX, nextGridY, catalogId, nextDirection, item.id, source)) {
              return item;
            }

            const anchor = roomGridToFurnitureAnchor(nextGridX, nextGridY, catalogId, nextDirection, source, isWall ? nextWallZ : undefined);
            return {
              ...item,
              direction: nextDirection,
              x: anchor.x,
              y: anchor.y,
              ...(isWall ? { gridY: nextGridY, wallZ: nextWallZ, wallAxisVersion: WALL_AXIS_VERSION } : { gridY: nextGridY }),
              roomSize: item.roomSize || source.roomSize,
              spriteConfig: item.spriteConfig || source.spriteConfig,
              directionImages: item.directionImages || source.directionImages,
              availableDirections: item.availableDirections || source.availableDirections,
              defaultDirection: item.defaultDirection || source.defaultDirection,
              footprint: item.footprint || source.footprint || getSourceFootprint(source),
              category: item.category || source.category,
            };
          }
          return item;
        })
      };
    });
  }, [student]);

  // 아이템 위치 이동 (가구는 grid 기반으로 이동하며, 다른 가구와 겹치거나 방 밖으로 나갈 수 없습니다.)
  const handleMoveItem = (itemId: string, dx: number, dy: number) => {
    setRoomState(prev => {
      if (!prev) return prev;
      const placedItems = prev.placedItems || [];
      return {
        ...prev,
        placedItems: placedItems.map(item => {
          if (item.id === itemId) {
            const catalogId = getPlacedCatalogId(item);
            const source = getPlacedSourceFromItems(item, student?.items || []);
            const direction = (item.direction || getDefaultDirection(catalogId, source)) as RoomDirection;
            const deltaX = Math.sign(dx);
            const deltaY = Math.sign(dy);
            const wallItem = isWallItem(catalogId, source);
            const bounds = getPlacementBounds(catalogId, direction, source);
            const wallSide = wallItem ? getWallSide(direction) : undefined;
            const currentGridX = Number(item.gridX ?? 0);
            const currentGridY = Number(item.gridY ?? 0);
            const nextGridX = wallItem
              ? Math.max(bounds.minX, Math.min(bounds.maxX, currentGridX + (wallSide === 'right' ? deltaX : 0)))
              : Math.max(bounds.minX, Math.min(bounds.maxX, currentGridX + deltaX));
            const nextGridY = wallItem
              ? Math.max(bounds.minY, Math.min(bounds.maxY, currentGridY + (wallSide === 'left' ? deltaX : 0)))
              : Math.max(bounds.minY, Math.min(bounds.maxY, currentGridY + deltaY));
            const nextWallZ = wallItem ? clampWallZ(getPlacedWallZ(item, direction) - deltaY) : undefined;

            if (!isPlacementAvailable(placedItems, nextGridX, nextGridY, catalogId, direction, item.id, source)) {
              return item;
            }

            const anchor = roomGridToFurnitureAnchor(nextGridX, nextGridY, catalogId, direction, source, wallItem ? nextWallZ : undefined);
            return {
              ...item,
              x: anchor.x,
              y: anchor.y,
              gridX: nextGridX,
              ...(wallItem ? { gridY: nextGridY, wallZ: nextWallZ, wallAxisVersion: WALL_AXIS_VERSION } : { gridY: nextGridY }),
              roomSize: item.roomSize || source.roomSize,
              spriteConfig: item.spriteConfig || source.spriteConfig,
              directionImages: item.directionImages || source.directionImages,
              availableDirections: item.availableDirections || source.availableDirections,
              defaultDirection: item.defaultDirection || source.defaultDirection,
              footprint: item.footprint || source.footprint || getSourceFootprint(source),
              category: item.category || source.category,
            };
          }
          return item;
        })
      };
    });
  };


  const handleMoveItemTo = (itemId: string, gridX: number, gridY: number) => {
    setRoomState(prev => {
      if (!prev) return prev;
      const placedItems = prev.placedItems || [];
      return {
        ...prev,
        placedItems: placedItems.map(item => {
          if (item.id !== itemId) return item;
          const catalogId = getPlacedCatalogId(item);
          const source = getPlacedSourceFromItems(item, student?.items || []);
          const direction = (item.direction || getDefaultDirection(catalogId, source)) as RoomDirection;
          if (isWallItem(catalogId, source)) return item;
          const bounds = getPlacementBounds(catalogId, direction, source);
          const nextGridX = Math.max(bounds.minX, Math.min(bounds.maxX, Math.round(gridX)));
          const nextGridY = Math.max(bounds.minY, Math.min(bounds.maxY, Math.round(gridY)));
          if (!isPlacementAvailable(placedItems, nextGridX, nextGridY, catalogId, direction, item.id, source)) return item;
          const anchor = roomGridToFurnitureAnchor(nextGridX, nextGridY, catalogId, direction, source);
          return {
            ...item,
            x: anchor.x,
            y: anchor.y,
            gridX: nextGridX,
            gridY: nextGridY,
            roomSize: item.roomSize || source.roomSize,
            spriteConfig: item.spriteConfig || source.spriteConfig,
            directionImages: item.directionImages || source.directionImages,
            availableDirections: item.availableDirections || source.availableDirections,
            defaultDirection: item.defaultDirection || source.defaultDirection,
            footprint: item.footprint || source.footprint || getSourceFootprint(source),
            category: item.category || source.category,
          };
        })
      };
    });
  };

  const handleResizeRoomItem = (itemId: string, delta: number) => {
    setRoomState(prev => {
      if (!prev) return prev;
      const placedItems = prev.placedItems || [];
      return {
        ...prev,
        placedItems: placedItems.map(item => {
          if (item.id !== itemId) return item;
          const catalogId = getPlacedCatalogId(item);
          const catalog: any = getRoomItemById(catalogId);
          if (!catalog?.resizable || !catalog?.sizeVariants) return item;
          const source = getPlacedSourceFromItems(item, student?.items || []);
          const currentSize = Number(item.carpetSize ?? source.carpetSize ?? catalog.resizable.defaultSize ?? 2);
          const nextSize = Math.max(catalog.resizable.min, Math.min(catalog.resizable.max, currentSize + delta));
          if (nextSize === currentSize) return item;
          const variant = catalog.sizeVariants[String(nextSize)];
          if (!variant) return item;
          const direction = normalizeRoomDirection((item.direction || getDefaultDirection(catalogId, source)) as string);
          const nextSource = getEffectiveRoomSource(catalogId, { ...source, carpetSize: nextSize });
          const bounds = getPlacementBounds(catalogId, direction, nextSource);
          const nextGridX = Math.max(bounds.minX, Math.min(bounds.maxX, Number(item.gridX ?? 0)));
          const nextGridY = Math.max(bounds.minY, Math.min(bounds.maxY, Number(item.gridY ?? 0)));
          const anchor = roomGridToFurnitureAnchor(nextGridX, nextGridY, catalogId, direction, nextSource);
          return {
            ...item,
            carpetSize: nextSize,
            roomSize: variant.roomSize,
            footprint: variant.footprint,
            directionImages: variant.directionImages,
            gridX: nextGridX,
            gridY: nextGridY,
            x: anchor.x,
            y: anchor.y,
            category: catalog.category || item.category,
          };
        }),
      };
    });
  };

  if (loading) {
    return (
      <main className="min-h-screen p-4 md:p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-bounce mb-4 text-4xl">🏠</div>
          <p className="text-muted-foreground">로딩 중...</p>
        </div>
      </main>
    );
  }

  if (!student || !roomState) {
    return (
      <main className="min-h-screen p-4 md:p-8 flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">방 정보를 찾을 수 없습니다.</p>
          <Button onClick={() => router.push('/student/dashboard')}>돌아가기</Button>
        </div>
      </main>
    );
  }

  const roomItems = student.items.filter(item => item.type === 'room');
  const petItems = student.items.filter(item => item.slot === 'pet');
  const placedInventoryItemIds = new Set((roomState.placedItems || []).map(item => item.inventoryItemId).filter(Boolean));
  const findInventoryItem = (placed: PlacedRoomItem): any => student.items.find((item: any) =>
    item.id === placed.inventoryItemId ||
    item.id === placed.itemId ||
    item.itemId === placed.itemId ||
    item.catalogItemId === placed.itemId
  );
  const selectedPlacedItem = roomState.placedItems.find(i => i.id === selectedItemId);
  const selectedInventoryItem = selectedPlacedItem ? findInventoryItem(selectedPlacedItem) : undefined;
  const selectedCatalogId = selectedPlacedItem ? getPlacedCatalogId(selectedPlacedItem) : undefined;
  const selectedCatalog: any = selectedCatalogId ? getRoomItemById(selectedCatalogId) : undefined;
  const selectedResizable = Boolean(selectedCatalog?.resizable && selectedCatalog?.sizeVariants);
  const selectedCarpetSize = selectedResizable ? Number((selectedPlacedItem as any)?.carpetSize ?? selectedCatalog?.resizable?.defaultSize ?? 2) : undefined;

  return (
    <main className="min-h-screen p-4 md:p-8 bg-slate-50">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/student/dashboard">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                대시보드
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">내 방 꾸미기</h1>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant={editMode ? 'default' : 'outline'}
              onClick={() => {
                if (editMode) {
                  setSelectedItemId(null);
                  handleSave();
                  return;
                }
                setEditMode(true);
              }}
              disabled={saving}
              size="sm"
              className="gap-2"
            >
              {editMode ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {editMode ? (saving ? '저장 중...' : '편집 완료') : '방 편집하기'}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* 방 뷰어 */}
          <div className="lg:col-span-3 space-y-4">
            <Card className="overflow-hidden shadow-xl border-none">
              <CardContent className="p-0 relative bg-slate-200">
                <div 
                  className="relative mx-auto" 
                  style={{ width: ROOM_WIDTH, height: ROOM_HEIGHT }}
                >
                  <IsometricRoomEnhanced
                    student={student}
                    position={position}
                    placedItems={roomState.placedItems}
                    showGrid={editMode}
                    editMode={editMode}
                    selectedItemId={selectedItemId}
                    onItemClick={editMode ? ((itemId) => setSelectedItemId(itemId)) : undefined}
                    onItemMoveTo={handleMoveItemTo}
                    onItemMoveBy={(itemId, dx, dy) => handleMoveItem(itemId, dx * GRID_SIZE, dy * GRID_SIZE)}
                    onItemRotate={handleRotateItem}
                    onItemResize={handleResizeRoomItem}
                    onItemRemove={handleRemoveItem}
                    onItemConfirm={() => setSelectedItemId(null)}
                  />
                </div>

                {/* 모바일 컨트롤 */}
                {showDPad && !editMode && (
                  <div className="absolute bottom-6 left-6 z-50">
                    <MobileDPad onMove={movePlayer} />
                  </div>
                )}
                
                {!editMode && (
                  <div className="absolute top-4 right-4 bg-black/50 text-white px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-sm">
                    WASD 키로 이동하세요
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 선택된 아이템 컨트롤 (편집 모드) */}
            {editMode && selectedPlacedItem && (
              <Card className="border-primary/20 bg-primary/5 shadow-sm">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center text-2xl shadow-sm">
                      {findInventoryItem(selectedPlacedItem)?.icon || '📦'}
                    </div>
                    <div>
                      <p className="font-bold">{findInventoryItem(selectedPlacedItem)?.name}</p>
                      <p className="text-xs text-muted-foreground">{isWallItem(getPlacedCatalogId(selectedPlacedItem), findInventoryItem(selectedPlacedItem)) ? `X: ${selectedPlacedItem.gridX}, Y: ${selectedPlacedItem.gridY}, Z: ${getPlacedWallZ(selectedPlacedItem, (selectedPlacedItem.direction || getDefaultDirection(getPlacedCatalogId(selectedPlacedItem), findInventoryItem(selectedPlacedItem))) as RoomDirection)}` : `X: ${selectedPlacedItem.gridX}, Y: ${selectedPlacedItem.gridY}`}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="grid grid-cols-3 gap-1 mr-4">
                      <div />
                      <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => handleMoveItem(selectedPlacedItem.id, 0, -GRID_SIZE)}>↑</Button>
                      <div />
                      <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => handleMoveItem(selectedPlacedItem.id, -GRID_SIZE, 0)}>←</Button>
                      <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => handleMoveItem(selectedPlacedItem.id, 0, GRID_SIZE)}>↓</Button>
                      <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => handleMoveItem(selectedPlacedItem.id, GRID_SIZE, 0)}>→</Button>
                    </div>
                    {selectedResizable && (
                      <div className="flex items-center gap-1 mr-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 text-lg font-bold"
                          onClick={() => handleResizeRoomItem(selectedPlacedItem.id, -1)}
                          disabled={(selectedCarpetSize ?? 2) <= (selectedCatalog?.resizable?.min ?? 2)}
                          title="카펫 크기 줄이기"
                        >
                          -
                        </Button>
                        <span className="min-w-10 text-center text-xs font-semibold">{selectedCarpetSize}×{selectedCarpetSize}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 text-lg font-bold"
                          onClick={() => handleResizeRoomItem(selectedPlacedItem.id, 1)}
                          disabled={(selectedCarpetSize ?? 4) >= (selectedCatalog?.resizable?.max ?? 4)}
                          title="카펫 크기 늘리기"
                        >
                          +
                        </Button>
                      </div>
                    )}
                    <Button variant="outline" size="icon" onClick={() => handleRotateItem(selectedPlacedItem.id)} title="회전">
                      <RotateCw className="w-4 h-4" />
                    </Button>
                    <Button variant="destructive" size="icon" onClick={() => handleRemoveItem(selectedPlacedItem.id)} title="제거">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* 아이템 목록 */}
          <div className="lg:col-span-1">
            <Card className="h-full border-none shadow-lg">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="w-5 h-5 text-blue-500" />
                  보유 아이템
                </CardTitle>
                <CardDescription>가구와 펫을 방에 배치해보세요</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <section>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-bold">보유 가구</h3>
                    <Badge variant="secondary" className="text-[10px]">{roomItems.length}개</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3 overflow-y-auto max-h-[320px] pr-2">
                    {roomItems.length === 0 ? (
                      <div className="col-span-2 py-10 text-center text-muted-foreground">
                        <p className="text-4xl mb-2">📭</p>
                        <p className="text-sm">보유한 가구가 없습니다</p>
                      </div>
                    ) : (
                      roomItems.map(item => {
                        const isPlaced = placedInventoryItemIds.has(item.id);
                        const catalogId = getRoomItemCatalogIdFromItem(item) || item.id;
                        const catalog = getRoomItemById(catalogId);
                        return (
                          <button
                            key={item.id}
                            disabled={!editMode || isPlaced}
                            onClick={() => {
                              if (isPlaced) return;
                              const direction = getDefaultDirection(catalogId, item);
                              const placement = findAvailablePlacement(roomState.placedItems || [], catalogId, direction, item);
                              if (!placement) {
                                alert('방 안에 배치할 수 있는 빈 공간이 없습니다.');
                                return;
                              }
                              const wallItem = isWallItem(catalogId, item);
                              const anchor = roomGridToFurnitureAnchor(placement.x, placement.y, catalogId, direction, item, wallItem ? WALL_Z_DEFAULT : undefined);
                              handleAddItem({
                                id: `placed-${Date.now()}`,
                                inventoryItemId: item.id,
                                itemId: catalogId,
                                x: anchor.x,
                                y: anchor.y,
                                gridX: placement.x,
                                gridY: placement.y,
                                ...(wallItem ? { wallZ: WALL_Z_DEFAULT, wallAxisVersion: WALL_AXIS_VERSION } : {}),
                                direction,
                                ...((catalog as any)?.resizable ? { carpetSize: (catalog as any).resizable.defaultSize } : {}),
                                roomSize: (item as any).roomSize,
                                spriteConfig: (item as any).spriteConfig,
                                directionImages: (item as any).directionImages,
                                availableDirections: (item as any).availableDirections,
                                footprint: getSourceFootprint(item),
                                category: catalog?.category || (item as any).category,
                              } as any);
                            }}
                            className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-2 group ${
                              isPlaced
                                ? 'border-emerald-200 bg-emerald-50 opacity-70 cursor-not-allowed'
                                : editMode
                                  ? 'border-slate-100 hover:border-primary hover:bg-primary/5 cursor-pointer'
                                  : 'border-slate-50 opacity-60 cursor-not-allowed'
                            }`}
                          >
                            <div className="w-16 h-14 flex items-center justify-center group-hover:scale-110 transition-transform overflow-hidden">
                              {catalog?.iconUrl ? (
                                <img src={catalog.iconUrl} alt={item.name} className="w-full h-full object-contain" />
                              ) : catalog ? (
                                <div style={getRoomItemFrameStyle(catalogId, catalog.defaultDirection, 58)} />
                              ) : item.iconUrl || item.imageUrl ? (
                                <img src={item.iconUrl || item.imageUrl} alt={item.name} className="w-full h-full object-contain" />
                              ) : (
                                <span className="text-3xl">{item.icon || '📦'}</span>
                              )}
                            </div>
                            <span className="text-[10px] font-bold truncate w-full text-center">{item.name}</span>
                            {isPlaced && <Badge variant="secondary" className="text-[10px]">배치됨</Badge>}
                          </button>
                        );
                      })
                    )}
                  </div>
                </section>

                <section>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-bold">보유 펫</h3>
                    <Badge variant="secondary" className="text-[10px]">{petItems.length}개</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3 overflow-y-auto max-h-[220px] pr-2">
                    {petItems.length === 0 ? (
                      <div className="col-span-2 py-8 text-center text-muted-foreground">
                        <p className="text-4xl mb-2">🐾</p>
                        <p className="text-sm">보유한 펫이 없습니다</p>
                      </div>
                    ) : (
                      petItems.map(item => {
                        const isPlaced = placedInventoryItemIds.has(item.id);
                        return (
                          <button
                            key={item.id}
                            disabled={!editMode || isPlaced}
                            onClick={() => {
                              if (isPlaced) return;
                              const direction = 'SW' as RoomDirection;
                              const placement = findAvailablePlacement(roomState.placedItems || [], item.id, direction, {
                                ...item,
                                footprint: { w: 1, h: 1 },
                                category: 'pet',
                              });
                              if (!placement) {
                                alert('펫을 배치할 수 있는 빈 공간이 없습니다.');
                                return;
                              }
                              const anchor = roomGridToFurnitureAnchor(placement.x, placement.y, item.id, direction, {
                                ...item,
                                footprint: { w: 1, h: 1 },
                                category: 'pet',
                              });
                              handleAddItem({
                                id: `placed-pet-${Date.now()}`,
                                inventoryItemId: item.id,
                                itemId: item.id,
                                x: anchor.x,
                                y: anchor.y,
                                gridX: placement.x,
                                gridY: placement.y,
                                direction,
                                footprint: { w: 1, h: 1 },
                                category: 'pet',
                                roomPetImageUrl: (item as any).roomPetImageUrl,
                                spriteConfig: { frameWidth: 200, frameHeight: 200 },
                              } as any);
                            }}
                            className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-2 group ${
                              isPlaced
                                ? 'border-emerald-200 bg-emerald-50 opacity-70 cursor-not-allowed'
                                : editMode
                                  ? 'border-slate-100 hover:border-primary hover:bg-primary/5 cursor-pointer'
                                  : 'border-slate-50 opacity-60 cursor-not-allowed'
                            }`}
                          >
                            <div className="w-16 h-14 flex items-center justify-center group-hover:scale-110 transition-transform overflow-hidden">
                              {item.iconUrl || item.imageUrl ? (
                                <img src={item.iconUrl || item.imageUrl} alt={item.name} className="w-full h-full object-contain" />
                              ) : (
                                <span className="text-3xl">{item.icon || '🐾'}</span>
                              )}
                            </div>
                            <span className="text-[10px] font-bold truncate w-full text-center">{item.name}</span>
                            {isPlaced && <Badge variant="secondary" className="text-[10px]">배치됨</Badge>}
                          </button>
                        );
                      })
                    )}
                  </div>
                </section>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}

// 아이콘 컴포넌트 (없을 경우 대비)
function Package(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16.5 9.4 7.5 4.21" />
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.29 7 12 12 20.71 7" />
      <line x1="12" y1="22" x2="12" y2="12" />
    </svg>
  );
}

export default function RoomPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">로딩 중...</div>}>
      <RoomContent />
    </Suspense>
  );
}
