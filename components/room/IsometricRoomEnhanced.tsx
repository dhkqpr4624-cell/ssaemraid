"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { SpriteAvatarRenderer } from "@/components/avatar/AvatarRenderer";
import { SPRITE_CONFIG } from "@/lib/avatar-assets";
import {
  getRoomItemById,
  getRoomItemCatalogIdFromItem,
  getRoomItemFrameStyle,
  getRoomItemFrame,
} from "@/lib/room-items-registry";
import type {
  Student,
  RoomPlayerPosition,
  PlacedRoomItem,
  RoomDirection,
} from "@/lib/types";

interface IsometricRoomEnhancedProps {
  student: Student;
  position: RoomPlayerPosition;
  placedItems: PlacedRoomItem[];
  showGrid?: boolean;
  onItemClick?: (itemId: string) => void;
  selectedItemId?: string | null;
  editMode?: boolean;
  onItemMoveTo?: (itemId: string, gridX: number, gridY: number) => void;
  onItemMoveBy?: (itemId: string, dx: number, dy: number) => void;
  onItemRotate?: (itemId: string) => void;
  onItemResize?: (itemId: string, delta: number) => void;
  onItemRemove?: (itemId: string) => void;
  onItemConfirm?: (itemId: string) => void;
  cameraOffset?: { x: number; y: number };
}

const ROOM_GRID_W = 6;
const ROOM_GRID_H = 6;

const ROOM_IMAGE = "/assets/room/base/default_room.png";
const ROOM_IMAGE_WIDTH = 560;
const ROOM_IMAGE_HEIGHT = 430;

const FLOOR_TILE_W = 80;
const FLOOR_TILE_H = 48;
const FLOOR_TOP_LEFT_X = 240;
const FLOOR_TOP_LEFT_Y = 170;
const FLOOR_STEP_X = 37.5;
const FLOOR_STEP_Y = 21;
const FURNITURE_VISUAL_GRID_OFFSET = { x: 0.35, y: 0.45 };
// image editor 제작 가구는 좌표값 자체는 유지하고, 화면 표시 위치만 추가 보정합니다.
// 기본 보정값은 유지하되, 1칸/2칸 제작 가구는 실제 타일 기준에 더 잘 맞도록 추가 보정합니다.
const EDITOR_FURNITURE_EXTRA_VISUAL_GRID_OFFSET = { x: 0.15, y: 0.25 };
const ONE_CELL_EDITOR_FURNITURE_ADDITIONAL_VISUAL_GRID_OFFSET = {
  x: 0.23,
  y: 0.05,
};
const TWO_CELL_EDITOR_FURNITURE_ADDITIONAL_VISUAL_GRID_OFFSET_BY_AXIS = {
  // NW/SE(↖/↘) 방향: 기존 최종 보정에서 Y -0.05 추가 이동
  x: { x: -0.02, y: 0.1 },
  // NE/SW(↗/↙) 방향: 기존 최종 보정 유지
  y: { x: 0.05, y: 0.23 },
};
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
const FLOOR_BOTTOM_Y =
  FLOOR_TOP_LEFT_Y +
  FLOOR_TILE_H +
  FLOOR_STEP_Y * (ROOM_GRID_W - 1 + (ROOM_GRID_H - 1));
const FLOOR_MID_Y = (FLOOR_TOP_Y + FLOOR_BOTTOM_Y) / 2;
const FLOOR_HALF_WIDTH = FLOOR_TILE_W / 2 + FLOOR_STEP_X * (ROOM_GRID_W - 1);

const WALL_GRID_W = 6;
const WALL_GRID_H = 5;
const WALL_Z_MIN = 1;
const WALL_Z_MAX = 4;
const WALL_Z_DEFAULT = 4;
const WALL_AXIS_VERSION = 2;
const WALL_START_X = 135;
const WALL_START_Y = 62;
const WALL_STEP_X = 58;
const WALL_STEP_Y = 35;
const WALL_LEFT_LARGE_VISUAL_GRID_Y_OFFSET = 0.2;

const PET_DISPLAY_SCALE = 0.55;
const PET_MOVE_PROGRESS_PER_TICK = 0.08;
const PET_IDLE_MIN_MS = 6_700;
const PET_IDLE_MAX_MS = 13_300;
const PET_SLEEP_INTERVAL_MIN_MS = 10 * 60_000;
const PET_SLEEP_INTERVAL_MAX_MS = 15 * 60_000;
const PET_SLEEP_DURATION_MS = 5 * 60_000;
const HAETAE_ROOM_SPRITE_URL =
  "/reward-items/5/1/social/u3/pet/law-judge-haetae-room.png";

type RoomPetMode = "idle" | "walk" | "sleep";
type RoomPetDirection = "front" | "left" | "right" | "back";

interface RoomPetRuntimeState {
  gridX: number;
  gridY: number;
  targetGridX: number;
  targetGridY: number;
  progress: number;
  mode: RoomPetMode;
  direction: RoomPetDirection;
  nextActionAt: number;
  nextSleepAt: number;
  sleepUntil: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getFootprintByRoomSize(roomSize?: string) {
  if (roomSize === "640x640") return { w: 4, h: 4 };
  if (roomSize === "480x480") return { w: 3, h: 3 };
  if (roomSize === "320x320") return { w: 2, h: 2 };
  if (roomSize === "640x160") return { w: 4, h: 1 };
  if (roomSize === "480x160") return { w: 3, h: 1 };
  if (roomSize === "320x160") return { w: 2, h: 1 };
  return { w: 1, h: 1 };
}

function getFrameSizeByRoomSize(roomSize?: string) {
  if (roomSize === "640x640") return { w: 640, h: 640 };
  if (roomSize === "480x480") return { w: 480, h: 480 };
  if (roomSize === "320x320") return { w: 320, h: 320 };
  if (roomSize === "640x160") return { w: 640, h: 160 };
  if (roomSize === "480x160") return { w: 480, h: 160 };
  if (roomSize === "320x160") return { w: 320, h: 160 };
  return { w: 160, h: 160 };
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

function isWallItem(catalog: any, source?: any) {
  return (
    catalog?.category === "wall" ||
    source?.category === "wall" ||
    source?.placement === "wall"
  );
}

function getWallSide(direction: RoomDirection = "SW") {
  const normalized = normalizeRoomDirection(direction);
  // NE/SW는 우측 벽, NW/SE는 좌측 벽에 붙습니다.
  return normalized === "NE" || normalized === "SW" ? "right" : "left";
}

function clampWallZ(value: number) {
  const numeric = Number.isFinite(value) ? value : WALL_Z_DEFAULT;
  return Math.max(WALL_Z_MIN, Math.min(WALL_Z_MAX, numeric));
}

function getPlacedWallZ(item: any, direction: RoomDirection = "SW") {
  const side = getWallSide(direction);
  const raw = Number(item?.wallZ ?? WALL_Z_DEFAULT);
  if (item?.wallAxisVersion !== WALL_AXIS_VERSION) {
    if (side === "left" && raw === 3) return WALL_Z_MAX;
    if (side === "right" && raw <= 1) return WALL_Z_MAX;
  }
  return clampWallZ(raw);
}

function wallGridToAnchor(
  gridX: number,
  gridY: number,
  wallZ: number,
  direction: RoomDirection = "SW",
) {
  const side = getWallSide(direction);
  const baseX = side === "left" ? 92 : 292;
  const baseY = 126;
  const gx = Math.max(0, Math.min(WALL_GRID_W - 1, Number(gridX) || 0));
  const gy = Math.max(0, Math.min(WALL_GRID_H - 1, Number(gridY) || 0));
  const z = clampWallZ(wallZ);
  // X/Y는 벽면 위의 위치, Z는 높이입니다.
  // 좌측 벽(NW/SE)은 기존 이동감을 유지하고, 우측 벽(NE/SW)은 반대 기울기로 이동합니다.
  const along = side === "right" ? gx : gy;
  const wallSlopeY = side === "right" ? along * 24 : -along * 24;
  const verticalY =
    side === "right"
      ? (WALL_Z_MAX - z) * WALL_STEP_Y - 70
      : (WALL_Z_MAX - z) * WALL_STEP_Y + 35;
  return {
    x: baseX + along * 42,
    y: baseY + wallSlopeY + verticalY,
  };
}

function getWallDisplayAnchor(
  anchor: { x: number; y: number },
  catalog: any,
  direction: RoomDirection = "SW",
  source?: any,
) {
  const isLargeWallItem =
    isWallItem(catalog, source) &&
    (source?.roomSize === "320x320" || catalog?.frameWidth === 320);
  if (!isLargeWallItem || getWallSide(direction) !== "left") return anchor;
  // 좌표값은 그대로 두고, 대형 벽걸이 아이템이 좌측 벽에서 벽 밖으로 삐져나오지 않도록
  // 화면 표시 위치만 벽면 Y+ 방향(우상향)으로 약 0.2칸 보정합니다.
  return {
    x: anchor.x + WALL_LEFT_LARGE_VISUAL_GRID_Y_OFFSET * 42,
    y: anchor.y - WALL_LEFT_LARGE_VISUAL_GRID_Y_OFFSET * 24,
  };
}

function getCatalogSizeVariant(catalog: any, source?: any) {
  if (!catalog?.sizeVariants) return undefined;
  const defaultSize = catalog?.resizable?.defaultSize ?? 2;
  const rawSize = Number(
    source?.carpetSize ?? source?.sizeLevel ?? defaultSize,
  );
  const size = Math.max(
    catalog?.resizable?.min ?? 2,
    Math.min(
      catalog?.resizable?.max ?? 4,
      Number.isFinite(rawSize) ? rawSize : defaultSize,
    ),
  );
  return (
    catalog.sizeVariants[String(size)] ||
    catalog.sizeVariants[String(defaultSize)] ||
    catalog.sizeVariants[Object.keys(catalog.sizeVariants)[0]]
  );
}

function getEffectiveRoomItemSource(catalog: any, source?: any) {
  const variant = getCatalogSizeVariant(catalog, source);
  if (!variant) return source || {};
  const directionImages = variant.directionImages || source?.directionImages;
  return {
    ...(source || {}),
    roomSize: variant.roomSize || source?.roomSize,
    footprint: variant.footprint || source?.footprint,
    directionImages,
    imageUrl:
      getCustomDirectionImage(
        directionImages,
        normalizeRoomDirection(
          source?.direction || catalog?.defaultDirection || "SE",
        ),
      ) || source?.imageUrl,
    carpetSize: Number(
      source?.carpetSize ?? catalog?.resizable?.defaultSize ?? 2,
    ),
    nonBlocking: true,
  };
}

function isNonBlockingRoomItem(catalog: any, source?: any) {
  return Boolean(
    catalog?.nonBlocking ||
    source?.nonBlocking ||
    catalog?.category === "floor" ||
    source?.category === "floor",
  );
}

function getFootprint(catalog: any, source?: any) {
  const variant = getCatalogSizeVariant(catalog, source);
  if (variant?.footprint) return normalizeFootprint(variant.footprint, variant);
  return catalog?.footprint
    ? normalizeFootprint(catalog.footprint, source)
    : normalizeFootprint(source?.footprint, source);
}

function getTwoCellAxis(direction: RoomDirection) {
  const normalized = normalizeRoomDirection(direction);
  return normalized === "NE" || normalized === "SW" ? "y" : "x";
}

function getPlacementBounds(
  catalog: any,
  direction: RoomDirection = "SW",
  source?: any,
) {
  if (isWallItem(catalog, source)) {
    const wallSide = getWallSide(direction);
    // 우측 벽(NE/SW)은 X=5까지 가면 벽 바깥으로 삐져나오므로 X=4까지만 허용합니다.
    return {
      minX: 0,
      maxX: wallSide === "right" ? 4 : WALL_GRID_W - 1,
      minY: 0,
      maxY: WALL_GRID_H - 1,
      footprint: getFootprint(catalog, source),
    };
  }
  const footprint = getFootprint(catalog, source);
  const normalized = normalizeRoomDirection(direction);

  if (footprint.h === 1 && footprint.w > 1) {
    if (getTwoCellAxis(normalized) === "y") {
      return {
        minX: 0,
        maxX: ROOM_GRID_W - 1,
        minY: footprint.w - 1,
        maxY: ROOM_GRID_H - 1,
        footprint,
      };
    }
    return {
      minX: footprint.w - 1,
      maxX: ROOM_GRID_W - 1,
      minY: 0,
      maxY: ROOM_GRID_H - 1,
      footprint,
    };
  }

  if (footprint.w >= 2 || footprint.h >= 2) {
    return {
      minX: 0,
      maxX: Math.max(0, ROOM_GRID_W - footprint.w),
      minY: 0,
      maxY: Math.max(0, ROOM_GRID_H - footprint.h),
      footprint,
    };
  }

  return {
    minX: 0,
    maxX: ROOM_GRID_W - 1,
    minY: 0,
    maxY: ROOM_GRID_H - 1,
    footprint,
  };
}

function getOccupiedCellsForRender(
  gridX: number,
  gridY: number,
  catalog: any,
  direction: RoomDirection = "SW",
  source?: any,
) {
  if (isWallItem(catalog, source)) return [{ x: gridX, y: gridY }];
  const footprint = getFootprint(catalog, source);
  const normalized = normalizeRoomDirection(direction);

  if (footprint.h === 1 && footprint.w > 1) {
    return Array.from({ length: footprint.w }, (_, i) =>
      getTwoCellAxis(normalized) === "y"
        ? { x: gridX, y: gridY - i }
        : { x: gridX - i, y: gridY },
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

function doRenderCellsOverlap(
  a: Array<{ x: number; y: number }>,
  b: Array<{ x: number; y: number }>,
) {
  const set = new Set(a.map((cell) => `${cell.x},${cell.y}`));
  return b.some((cell) => set.has(`${cell.x},${cell.y}`));
}

function isPlacementAvailableForRender(
  placedItems: PlacedRoomItem[] = [],
  targetItem: any,
  gridX: number,
  gridY: number,
  student: Student,
) {
  const inventoryItem = findInventoryItem(student, targetItem);
  const catalog = getRoomItemById(getCatalogIdFromPlaced(student, targetItem));
  const source = getEffectiveRoomItemSource(
    catalog,
    mergeRoomItemSource(inventoryItem, targetItem),
  );
  const direction = normalizeRoomDirection(
    (targetItem.direction ||
      catalog?.defaultDirection ||
      source?.defaultDirection ||
      "SW") as string,
  );
  const bounds = getPlacementBounds(catalog, direction, source);
  const isWall = isWallItem(catalog, source);
  const gx = Math.round(Number(gridX));
  const gy = Math.round(Number(gridY));
  if (
    gx < bounds.minX ||
    gx > bounds.maxX ||
    gy < bounds.minY ||
    gy > bounds.maxY
  )
    return false;
  if (isNonBlockingRoomItem(catalog, source)) return true;

  const targetCells = getOccupiedCellsForRender(
    gx,
    gy,
    catalog,
    direction,
    source,
  );
  const targetWallSide = isWall ? getWallSide(direction) : null;
  return !(placedItems || []).some((existing: any) => {
    if (existing.id === targetItem.id) return false;
    const existingInventory = findInventoryItem(student, existing);
    const existingCatalog = getRoomItemById(
      getCatalogIdFromPlaced(student, existing),
    );
    const existingSource = getEffectiveRoomItemSource(
      existingCatalog,
      mergeRoomItemSource(existingInventory, existing),
    );
    if (isNonBlockingRoomItem(existingCatalog, existingSource)) return false;
    const existingIsWall = isWallItem(existingCatalog, existingSource);
    if (isWall !== existingIsWall) return false;
    const existingDirection = normalizeRoomDirection(
      (existing.direction ||
        existingCatalog?.defaultDirection ||
        existingSource?.defaultDirection ||
        "SW") as string,
    );
    if (isWall && targetWallSide !== getWallSide(existingDirection))
      return false;
    const existingCells = getOccupiedCellsForRender(
      Number(existing.gridX ?? 0),
      Number(existing.gridY ?? 0),
      existingCatalog,
      existingDirection,
      existingSource,
    );
    return doRenderCellsOverlap(targetCells, existingCells);
  });
}

function clientToRoomImagePoint(
  clientX: number,
  clientY: number,
  container: HTMLDivElement | null,
  offset: { x: number; y: number },
  zoom: number,
) {
  const rect = container?.getBoundingClientRect();
  if (!rect) return null;
  return {
    x: (clientX - rect.left - offset.x) / Math.max(0.1, zoom),
    y: (clientY - rect.top - offset.y) / Math.max(0.1, zoom),
  };
}

function findNearestFloorGridFromImagePoint(
  point: { x: number; y: number },
  catalog: any,
  direction: RoomDirection,
  source: any,
) {
  const bounds = getPlacementBounds(catalog, direction, source);
  let best = {
    x: bounds.minX,
    y: bounds.minY,
    distance: Number.POSITIVE_INFINITY,
  };
  for (let y = bounds.minY; y <= bounds.maxY; y++) {
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      const anchor = gridToFurnitureAnchor(x, y, catalog, direction, source);
      const distance = Math.hypot(anchor.x - point.x, anchor.y - point.y);
      if (distance < best.distance) best = { x, y, distance };
    }
  }
  return best;
}

function getEditorFurnitureExtraVisualGridOffset(
  footprint: { w: number; h: number },
  direction: RoomDirection = "SW",
) {
  const base = EDITOR_FURNITURE_EXTRA_VISUAL_GRID_OFFSET;
  if (footprint.w === 1 && footprint.h === 1) {
    return {
      x: base.x + ONE_CELL_EDITOR_FURNITURE_ADDITIONAL_VISUAL_GRID_OFFSET.x,
      y: base.y + ONE_CELL_EDITOR_FURNITURE_ADDITIONAL_VISUAL_GRID_OFFSET.y,
    };
  }
  if (footprint.w === 2 && footprint.h === 1) {
    const byAxis =
      TWO_CELL_EDITOR_FURNITURE_ADDITIONAL_VISUAL_GRID_OFFSET_BY_AXIS[
        getTwoCellAxis(direction)
      ];
    return {
      x: base.x + byAxis.x,
      y: base.y + byAxis.y,
    };
  }
  if (footprint.w === 3 && footprint.h === 1) {
    const axis = getTwoCellAxis(direction);
    return {
      x: base.x + (axis === "x" ? 0.6 : 0),
      y: base.y + (axis === "y" ? 0.75 : 0),
    };
  }
  if (footprint.w === 4 && footprint.h === 1) {
    const axis = getTwoCellAxis(direction);
    return {
      x: base.x + (axis === "x" ? 1 : 0),
      y: base.y + (axis === "y" ? 1 : 0),
    };
  }
  if (footprint.w === 3 && footprint.h === 3) {
    return {
      x: base.x + 0.8,
      y: base.y + 0.73,
    };
  }
  if (footprint.w === 4 && footprint.h === 4) {
    return {
      x: base.x + 1.3,
      y: base.y + 1.12,
    };
  }
  return base;
}

function gridToFurnitureAnchor(
  gridX: number,
  gridY: number,
  catalog: any,
  direction: RoomDirection = "SW",
  source?: any,
  wallZ?: number,
) {
  if (isWallItem(catalog, source))
    return wallGridToAnchor(
      gridX,
      gridY,
      clampWallZ(Number(wallZ ?? WALL_Z_DEFAULT)),
      direction,
    );
  const footprint = getFootprint(catalog, source);
  const anchors = getOccupiedCellsForRender(
    gridX,
    gridY,
    catalog,
    direction,
    source,
  ).map((cell) => gridToAnchor(cell.x, cell.y));
  if (!anchors.length) return gridToAnchor(gridX, gridY);
  const base = {
    x: anchors.reduce((sum, anchor) => sum + anchor.x, 0) / anchors.length,
    y: anchors.reduce((sum, anchor) => sum + anchor.y, 0) / anchors.length,
  };
  const twoCellExtraOffset =
    footprint.h === 1 && footprint.w > 1
      ? TWO_CELL_FURNITURE_VISUAL_GRID_OFFSET_BY_AXIS[getTwoCellAxis(direction)]
      : null;
  const extraOffset =
    twoCellExtraOffset ||
    (footprint.w >= 2 && footprint.h >= 2
      ? LARGE_FURNITURE_EXTRA_VISUAL_GRID_OFFSET
      : { x: 0, y: 0 });
  const isEditorSizedFurniture = Boolean(source?.roomSize || catalog?.roomSize);
  const editorExtraOffset = isEditorSizedFurniture
    ? getEditorFurnitureExtraVisualGridOffset(footprint, direction)
    : { x: 0, y: 0 };
  const visualOffset = {
    x: FURNITURE_VISUAL_GRID_OFFSET.x + extraOffset.x + editorExtraOffset.x,
    y: FURNITURE_VISUAL_GRID_OFFSET.y + extraOffset.y + editorExtraOffset.y,
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
    const direct = student.items.find(
      (item: any) => item.id === placed.inventoryItemId && item.type === "room",
    );
    if (direct) return direct;
  }

  const byCatalog = student.items.find(
    (item: any) =>
      item.type === "room" &&
      (item.catalogItemId === (placed as any).catalogItemId ||
        item.catalogItemId === placed.itemId ||
        item.itemId === placed.itemId ||
        item.id === placed.itemId),
  );
  if (byCatalog) return byCatalog;

  return student.items.find((item: any) => item.id === placed.itemId);
}

function getCatalogIdFromPlaced(
  student: Student,
  placed: PlacedRoomItem,
): string | undefined {
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
    if (!obj || typeof obj !== "object") continue;
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined && value !== null) merged[key] = value;
    }
  }
  return merged;
}

function normalizeRoomDirection(direction?: string): RoomDirection {
  const upper = String(direction || "").toUpperCase();
  if (upper === "FRONT") return "SW" as RoomDirection;
  if (upper === "BACK") return "NW" as RoomDirection;
  if (upper === "LEFT") return "NW" as RoomDirection;
  if (upper === "RIGHT") return "SE" as RoomDirection;
  if (["NW", "NE", "SW", "SE"].includes(upper)) return upper as RoomDirection;
  return "SW" as RoomDirection;
}

function getCustomDirectionImage(images: any, direction: RoomDirection) {
  if (!images) return undefined;
  const upper = String(direction).toUpperCase();
  const lower = String(direction).toLowerCase();
  const legacyMap: Record<string, string[]> = {
    NW: ["NW", "back", "left"],
    NE: ["NE", "back", "right"],
    SW: ["SW", "front", "left"],
    SE: ["SE", "front", "right"],
  };
  for (const key of [upper, lower, ...(legacyMap[upper] || [])]) {
    if (images[key]) return images[key];
  }
  const firstKey = Object.keys(images)[0];
  return firstKey ? images[firstKey] : undefined;
}

function getCustomDisplayMinimumWidth(
  source: any,
  footprint: { w: number; h: number },
) {
  const roomSize = source?.roomSize;
  if (roomSize === "640x640") return 300;
  if (roomSize === "480x480") return 225;
  if (roomSize === "320x320") return 150;
  if (roomSize === "640x160") return 236;
  if (roomSize === "480x160") return 177;
  if (roomSize === "320x160") return 118;
  return footprint.w >= 2 || footprint.h >= 2 ? 118 : 72;
}

function getEditorFurnitureDisplayScale(
  source: any,
  footprint: { w: number; h: number },
) {
  const roomSize = source?.roomSize;
  const isWallLargeItem =
    (source?.category === "wall" || source?.placement === "wall") &&
    roomSize === "320x320";

  // item-editor의 캔버스/가이드/기준점은 건드리지 않고,
  // 방에 표시되는 크기만 보정합니다.
  // 기존 1칸/2칸 제작 가구가 실제 타일보다 작아 보였으므로 바닥 제작 가구는
  // 직전 조정값이 다소 크게 보였으므로 현재 기준의 약 0.9배인 1.62로 낮춥니다.
  if (isWallLargeItem) return 1.62;
  if (roomSize === "480x480") return 1.62 * 1.1;
  if (roomSize === "640x640") return 1.62 * 1.2 * 0.9;
  return 1.62;
}

function getEditorFurnitureDisplayWidth(
  source: any,
  footprint: { w: number; h: number },
) {
  return footprint.w * 80 * getEditorFurnitureDisplayScale(source, footprint);
}

type AlphaHitCanvas = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
};
const alphaHitCanvasCache = new Map<string, AlphaHitCanvas>();
const alphaHitLoadingCache = new Set<string>();

function getCachedAlphaCanvas(src: string): AlphaHitCanvas | undefined {
  if (typeof window === "undefined") return undefined;
  const cached = alphaHitCanvasCache.get(src);
  if (cached) return cached;
  if (alphaHitLoadingCache.has(src)) return undefined;
  alphaHitLoadingCache.add(src);
  const image = new window.Image();
  image.crossOrigin = "anonymous";
  image.onload = () => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth || image.width;
      canvas.height = image.naturalHeight || image.height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx || !canvas.width || !canvas.height) return;
      ctx.drawImage(image, 0, 0);
      alphaHitCanvasCache.set(src, {
        canvas,
        ctx,
        width: canvas.width,
        height: canvas.height,
      });
    } finally {
      alphaHitLoadingCache.delete(src);
    }
  };
  image.onerror = () => alphaHitLoadingCache.delete(src);
  image.src = src;
  return undefined;
}

function isPaintedPixelClick(
  event: React.MouseEvent<HTMLElement>,
  alphaSrc?: string,
) {
  if (!alphaSrc || typeof window === "undefined") return true;

  const img = Array.from(
    event.currentTarget.querySelectorAll("img[data-alpha-src]"),
  ).find(
    (element) => (element as HTMLImageElement).dataset.alphaSrc === alphaSrc,
  ) as HTMLImageElement | undefined;

  const cached = getCachedAlphaCanvas(alphaSrc);
  // 아직 alpha map이 준비되지 않은 경우에는 넓은 투명 박스가 앞 가구 선택을 가로막지 않도록
  // 우선 '칠해진 픽셀이 아님'으로 처리합니다. 각 이미지 onLoad에서 캐시가 만들어지면 즉시 정상 클릭됩니다.
  if (!cached) return false;

  let rect: DOMRect;
  let x = 0;
  let y = 0;

  if (img) {
    rect = img.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
      return false;
    x = Math.floor(((event.clientX - rect.left) / rect.width) * cached.width);
    y = Math.floor(((event.clientY - rect.top) / rect.height) * cached.height);
  } else {
    // CSS background sprite로 표시되는 기본/카탈로그 가구도 실제 칠해진 픽셀만 클릭되도록 검사합니다.
    const target = event.currentTarget as HTMLElement;
    rect = target.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
      return false;

    const frameCol = Number(target.dataset.frameCol || 0);
    const frameRow = Number(target.dataset.frameRow || 0);
    const frameWidth = Number(target.dataset.frameWidth || cached.width);
    const frameHeight = Number(target.dataset.frameHeight || cached.height);
    const localX =
      ((event.clientX - rect.left) / Math.max(1, rect.width)) * frameWidth;
    const localY =
      ((event.clientY - rect.top) / Math.max(1, rect.height)) * frameHeight;
    x = Math.floor(frameCol * frameWidth + localX);
    y = Math.floor(frameRow * frameHeight + localY);
  }

  if (x < 0 || y < 0 || x >= cached.width || y >= cached.height) return false;
  try {
    const alpha = cached.ctx.getImageData(x, y, 1, 1).data[3];
    return alpha > 24;
  } catch {
    return true;
  }
}

function passClickThroughTransparentPixel(
  event: React.MouseEvent<HTMLElement>,
) {
  const target = event.currentTarget as HTMLElement;
  const previousPointerEvents = target.style.pointerEvents;
  target.style.pointerEvents = "none";
  const next = document.elementFromPoint(
    event.clientX,
    event.clientY,
  ) as HTMLElement | null;
  target.style.pointerEvents = previousPointerEvents;
  if (next && next !== target) {
    next.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        clientX: event.clientX,
        clientY: event.clientY,
        screenX: event.screenX,
        screenY: event.screenY,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
        button: event.button,
      }),
    );
  }
}

function CroppedCustomFurnitureImage({
  src,
  name,
  source,
  footprint,
  overlayTone,
}: {
  src: string;
  name: string;
  source: any;
  footprint: { w: number; h: number };
  overlayTone?: "valid" | "invalid";
}) {
  // 제작 가구는 item-editor의 guide footprint와 같은 기준으로 표시해야 합니다.
  // alpha crop으로 매번 크기를 다시 계산하면 위치에 따라 가구가 작아 보이는 착시/불일치가 생깁니다.
  const customSizeScale = getEditorFurnitureDisplayScale(source, footprint);

  // 핵심: 방에서의 실제 크기는 확장된 canvasSize가 아니라 원래 guideSize 기준으로 계산합니다.
  // 예) 480x160 가로형 3칸을 480x480 캔버스로 위쪽 확장해도,
  // 바닥 점유/렌더 크기는 480x160 기준 그대로 두고 위쪽 여백만 추가로 표시합니다.
  const guideDisplayWidth = footprint.w * 80 * customSizeScale;

  // 핵심: 표시 폭은 기존 guideSize/footprint 기준으로 고정하되,
  // 높이는 실제 PNG의 비율에 맡깁니다.
  // 이전처럼 canvasSize/guideSize로 높이를 직접 계산하면, 저장 과정에서 canvasSize 메타데이터가
  // 누락된 아이템이 480x480 실제 PNG임에도 480x160으로 눌려 보일 수 있습니다.
  // <img width 고정 + height:auto> 방식이면 기존 480x160 가로형도, 위로 확장된 480x480 가로형도
  // 같은 가로 배율을 유지하면서 세로 비율이 깨지지 않습니다.
  return (
    <img
      src={src}
      alt={name}
      draggable={false}
      data-alpha-src={src}
      onLoad={() => getCachedAlphaCanvas(src)}
      className={`${overlayTone ? "" : "drop-shadow-md"} pointer-events-none select-none`}
      style={{
        width: guideDisplayWidth,
        minWidth: guideDisplayWidth,
        height: "auto",
        maxWidth: "none",
        maxHeight: "none",
        imageRendering: "pixelated",
        ...(overlayTone
          ? {
              position: "absolute" as const,
              left: 0,
              top: 0,
              opacity: overlayTone === "invalid" ? 0.62 : 0.55,
              filter:
                overlayTone === "invalid"
                  ? "brightness(0) saturate(100%) invert(26%) sepia(94%) saturate(3900%) hue-rotate(344deg) brightness(101%) contrast(96%)"
                  : "brightness(0) invert(1)",
              mixBlendMode:
                overlayTone === "invalid"
                  ? ("normal" as const)
                  : ("screen" as const),
            }
          : {}),
      }}
    />
  );
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function makePetIdleDelay() {
  return randomBetween(PET_IDLE_MIN_MS, PET_IDLE_MAX_MS);
}

function makePetSleepDelay() {
  return randomBetween(PET_SLEEP_INTERVAL_MIN_MS, PET_SLEEP_INTERVAL_MAX_MS);
}

function getRoomPetSpriteUrl(source?: any, inventoryItem?: any) {
  const explicit =
    source?.roomPetImageUrl ||
    inventoryItem?.roomPetImageUrl ||
    source?.petRoomImageUrl ||
    inventoryItem?.petRoomImageUrl;
  if (explicit) return explicit;
  const idText = `${source?.id || ""} ${source?.itemId || ""} ${inventoryItem?.id || ""} ${inventoryItem?.itemId || ""} ${source?.name || ""} ${inventoryItem?.name || ""}`;
  if (idText.includes("law-judge-haetae") || idText.includes("법 심판자 해태"))
    return HAETAE_ROOM_SPRITE_URL;
  return source?.imageUrl || inventoryItem?.imageUrl;
}

function createInitialPetRuntimeState(
  gridX: number,
  gridY: number,
  now = Date.now(),
): RoomPetRuntimeState {
  return {
    gridX,
    gridY,
    targetGridX: gridX,
    targetGridY: gridY,
    progress: 0,
    mode: "idle",
    direction: "front",
    nextActionAt: now + makePetIdleDelay(),
    nextSleepAt: now + makePetSleepDelay(),
    sleepUntil: 0,
  };
}

function getPetDirectionFromDelta(dx: number, dy: number): RoomPetDirection {
  // 펫은 방 grid 축이 아니라, 화면 기준 상/하/좌/우로 움직이도록 합니다.
  // isometric 좌표에서는 (1,1)=아래, (-1,-1)=위, (1,-1)=오른쪽, (-1,1)=왼쪽입니다.
  if (dx === dy) return dx > 0 ? "front" : "back";
  if (dx === -dy) return dx > 0 ? "right" : "left";
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? "left" : "right";
  return dy < 0 ? "back" : "front";
}

function getPetVisualGridPosition(
  runtime?: RoomPetRuntimeState,
  fallbackX = 3,
  fallbackY = 3,
) {
  if (!runtime) return { gridX: fallbackX, gridY: fallbackY };
  return {
    gridX:
      runtime.gridX + (runtime.targetGridX - runtime.gridX) * runtime.progress,
    gridY:
      runtime.gridY + (runtime.targetGridY - runtime.gridY) * runtime.progress,
  };
}

function getPetSpriteRow(mode: RoomPetMode, direction: RoomPetDirection) {
  if (mode === "sleep") return 5;
  if (mode === "idle") return 4;
  if (direction === "front") return 0;
  if (direction === "left") return 1;
  if (direction === "right") return 2;
  return 3;
}

function RoomPetSprite({
  src,
  name,
  mode = "idle",
  direction = "front",
  frame = 0,
}: {
  src?: string;
  name: string;
  mode?: RoomPetMode;
  direction?: RoomPetDirection;
  frame?: number;
}) {
  if (!src) {
    return (
      <span className="text-3xl drop-shadow-md pointer-events-none select-none">
        🐾
      </span>
    );
  }

  const scaledFrame = Math.round(SPRITE_CONFIG.FRAME_SIZE * PET_DISPLAY_SCALE);
  const row = getPetSpriteRow(mode, direction);
  const col = frame % SPRITE_CONFIG.FRAMES_PER_ROW;

  return (
    <div
      role="img"
      aria-label={name}
      className="drop-shadow-md pointer-events-none select-none"
      style={{
        width: scaledFrame,
        height: scaledFrame,
        backgroundImage: `url(${src})`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: `-${col * scaledFrame}px -${row * scaledFrame}px`,
        backgroundSize: `${Math.round(SPRITE_CONFIG.TOTAL_WIDTH * PET_DISPLAY_SCALE)}px ${Math.round(SPRITE_CONFIG.FRAME_SIZE * 6 * PET_DISPLAY_SCALE)}px`,
        imageRendering: "pixelated",
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
  selectedItemId,
  editMode = false,
  onItemMoveTo,
  onItemMoveBy,
  onItemRotate,
  onItemResize,
  onItemRemove,
  onItemConfirm,
  cameraOffset,
}: IsometricRoomEnhancedProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
    pointerId?: number;
  }>({
    active: false,
    startX: 0,
    startY: 0,
    baseX: 0,
    baseY: 0,
  });

  const [offset, setOffset] = useState(cameraOffset || { x: 80, y: 40 });
  const [roomZoom, setRoomZoom] = useState(1);
  const [itemDrag, setItemDrag] = useState<{
    id: string;
    gridX: number;
    gridY: number;
    valid: boolean;
  } | null>(null);
  const itemDragStateRef = useRef<{
    id: string;
    gridX: number;
    gridY: number;
    valid: boolean;
  } | null>(null);
  const itemDragRef = useRef<{
    id: string;
    pointerId: number;
    started: boolean;
  } | null>(null);
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(
    new Map(),
  );
  const pinchRef = useRef<{
    active: boolean;
    startDistance: number;
    startZoom: number;
  }>({
    active: false,
    startDistance: 0,
    startZoom: 1,
  });

  const clampZoom = (value: number) => clamp(value, 0.6, 2.4);
  const getPointerDistance = () => {
    const points = Array.from(activePointersRef.current.values());
    if (points.length < 2) return 0;
    return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  };

  const applyZoom = (nextZoom: number) => {
    const zoom = clampZoom(nextZoom);
    setRoomZoom(zoom);
  };

  const clampOffset = (next: { x: number; y: number }, zoom = roomZoom) => {
    const rect = containerRef.current?.getBoundingClientRect();
    const width = rect?.width || 800;
    const height = rect?.height || 600;
    const scaledWidth = ROOM_IMAGE_WIDTH * zoom;
    const scaledHeight = ROOM_IMAGE_HEIGHT * zoom;
    const centerX = (width - scaledWidth) / 2;
    const centerY = (height - scaledHeight) / 2;

    // 방 이미지가 viewport보다 작을 때 기존 min/max 계산이 역전되어 offset이 고정되는 문제가 있었습니다.
    // 중앙 기준으로 여유 이동 범위를 주어 마우스/터치 드래그가 항상 동작하게 합니다.
    const slackX = Math.max(180, Math.abs(width - scaledWidth) / 2 + 80 * zoom);
    const slackY = Math.max(
      140,
      Math.abs(height - scaledHeight) / 2 + 80 * zoom,
    );

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
          x: (rect.width - ROOM_IMAGE_WIDTH * roomZoom) / 2,
          y: (rect.height - ROOM_IMAGE_HEIGHT * roomZoom) / 2,
        }),
      );
    };
    centerRoom();
    window.addEventListener("resize", centerRoom);
    return () => window.removeEventListener("resize", centerRoom);
  }, [roomZoom]);

  const gridCells = useMemo(() => {
    const result: Array<{
      x: number;
      y: number;
      topLeft: { x: number; y: number };
    }> = [];
    for (let y = 0; y < ROOM_GRID_H; y++) {
      for (let x = 0; x < ROOM_GRID_W; x++) {
        result.push({ x, y, topLeft: gridToTopLeft(x, y) });
      }
    }
    return result;
  }, []);

  const sortedItems = useMemo(() => {
    return [...(placedItems || [])].sort((a: any, b: any) => {
      const aItem = findInventoryItem(student, a);
      const bItem = findInventoryItem(student, b);
      const aCatalog = getRoomItemById(getCatalogIdFromPlaced(student, a));
      const bCatalog = getRoomItemById(getCatalogIdFromPlaced(student, b));
      const aSource = getEffectiveRoomItemSource(
        aCatalog,
        mergeRoomItemSource(aItem, a),
      );
      const bSource = getEffectiveRoomItemSource(
        bCatalog,
        mergeRoomItemSource(bItem, b),
      );
      const aDirection = normalizeRoomDirection(
        (a.direction ||
          aCatalog?.defaultDirection ||
          aItem?.defaultDirection ||
          "SW") as string,
      );
      const bDirection = normalizeRoomDirection(
        (b.direction ||
          bCatalog?.defaultDirection ||
          bItem?.defaultDirection ||
          "SW") as string,
      );
      const ay = isNonBlockingRoomItem(aCatalog, aSource)
        ? -10000
        : isWallItem(aCatalog, aSource)
          ? wallGridToAnchor(
              Number(a.gridX ?? 3),
              Number(a.gridY ?? 0),
              getPlacedWallZ(a, aDirection),
              aDirection,
            ).y - 100
          : gridToAnchor(Number(a.gridX ?? 3), Number(a.gridY ?? 4)).y;
      const by = isNonBlockingRoomItem(bCatalog, bSource)
        ? -10000
        : isWallItem(bCatalog, bSource)
          ? wallGridToAnchor(
              Number(b.gridX ?? 3),
              Number(b.gridY ?? 0),
              getPlacedWallZ(b, bDirection),
              bDirection,
            ).y - 100
          : gridToAnchor(Number(b.gridX ?? 3), Number(b.gridY ?? 4)).y;
      return ay - by;
    });
  }, [placedItems, student]);

  const placedRoomPetIds = useMemo(() => {
    const ids = new Set<string>();
    (placedItems || []).forEach((placed: any) => {
      const inventoryItem = findInventoryItem(student, placed);
      if (inventoryItem?.slot === "pet") {
        if (inventoryItem.id) ids.add(inventoryItem.id);
        if (inventoryItem.itemId) ids.add(inventoryItem.itemId);
        if (placed.inventoryItemId) ids.add(placed.inventoryItemId);
        if (placed.itemId) ids.add(placed.itemId);
      }
    });
    return ids;
  }, [placedItems, student]);

  const avatarStateForRoom = useMemo(() => {
    const baseState = student.avatarState || {
      skinColor: "#E8B9A0",
      equipped: {},
    };
    const equippedPetId = baseState.equipped?.pet;
    if (!equippedPetId || !placedRoomPetIds.has(equippedPetId))
      return baseState;
    return {
      ...baseState,
      equipped: {
        ...baseState.equipped,
        pet: null,
      },
    };
  }, [student.avatarState, placedRoomPetIds]);

  const [petAnimationFrame, setPetAnimationFrame] = useState(0);
  const [roomPetStates, setRoomPetStates] = useState<
    Record<string, RoomPetRuntimeState>
  >({});

  const petPlacedItems = useMemo(() => {
    return (placedItems || []).filter((placed: any) => {
      const inventoryItem = findInventoryItem(student, placed);
      return inventoryItem?.slot === "pet" || placed?.category === "pet";
    });
  }, [placedItems, student]);

  const blockingCellsForPets = useMemo(() => {
    const cells = new Set<string>();
    (placedItems || []).forEach((placed: any) => {
      const inventoryItem = findInventoryItem(student, placed);
      const catalog = getRoomItemById(getCatalogIdFromPlaced(student, placed));
      const source = getEffectiveRoomItemSource(
        catalog,
        mergeRoomItemSource(inventoryItem, placed),
      );
      const isPet = inventoryItem?.slot === "pet" || placed?.category === "pet";
      if (
        isPet ||
        isWallItem(catalog, source) ||
        isNonBlockingRoomItem(catalog, source)
      )
        return;
      const direction = normalizeRoomDirection(
        (placed.direction ||
          catalog?.defaultDirection ||
          source?.defaultDirection ||
          "SW") as string,
      );
      getOccupiedCellsForRender(
        Number(placed.gridX ?? 0),
        Number(placed.gridY ?? 0),
        catalog,
        direction,
        source,
      ).forEach((cell) => {
        if (
          cell.x >= 0 &&
          cell.x < ROOM_GRID_W &&
          cell.y >= 0 &&
          cell.y < ROOM_GRID_H
        )
          cells.add(`${cell.x},${cell.y}`);
      });
    });
    return cells;
  }, [placedItems, student]);

  const isPetCellAvailable = useCallback(
    (x: number, y: number) => {
      if (x < 0 || x >= ROOM_GRID_W || y < 0 || y >= ROOM_GRID_H) return false;
      return !blockingCellsForPets.has(`${x},${y}`);
    },
    [blockingCellsForPets],
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setPetAnimationFrame((prev) => (prev + 1) % SPRITE_CONFIG.FRAMES_PER_ROW);
      const now = Date.now();
      setRoomPetStates((prev) => {
        const next: Record<string, RoomPetRuntimeState> = {};
        const activePetIds = new Set<string>();

        petPlacedItems.forEach((placed: any) => {
          const key = String(
            placed.id || placed.inventoryItemId || placed.itemId,
          );
          activePetIds.add(key);
          const startX = clamp(Number(placed.gridX ?? 3), 0, ROOM_GRID_W - 1);
          const startY = clamp(Number(placed.gridY ?? 3), 0, ROOM_GRID_H - 1);
          const current =
            prev[key] || createInitialPetRuntimeState(startX, startY, now);

          if (current.mode === "sleep") {
            if (now < current.sleepUntil) {
              next[key] = current;
              return;
            }
            next[key] = {
              ...current,
              mode: "idle",
              nextActionAt: now + makePetIdleDelay(),
              nextSleepAt: now + makePetSleepDelay(),
              sleepUntil: 0,
            };
            return;
          }

          if (current.mode === "walk") {
            const progress = current.progress + PET_MOVE_PROGRESS_PER_TICK;
            if (progress >= 1) {
              next[key] = {
                ...current,
                gridX: current.targetGridX,
                gridY: current.targetGridY,
                progress: 0,
                mode: "idle",
                nextActionAt: now + makePetIdleDelay(),
              };
              return;
            }
            next[key] = { ...current, progress };
            return;
          }

          if (now >= current.nextSleepAt) {
            next[key] = {
              ...current,
              mode: "sleep",
              progress: 0,
              sleepUntil: now + PET_SLEEP_DURATION_MS,
            };
            return;
          }

          if (now >= current.nextActionAt) {
            const candidates = [
              // 화면 기준 아래/왼쪽/오른쪽/위 이동
              { dx: 1, dy: 1 },
              { dx: -1, dy: 1 },
              { dx: 1, dy: -1 },
              { dx: -1, dy: -1 },
            ]
              .map((delta) => ({
                x: current.gridX + delta.dx,
                y: current.gridY + delta.dy,
                dx: delta.dx,
                dy: delta.dy,
              }))
              .filter((cell) => isPetCellAvailable(cell.x, cell.y));

            if (candidates.length > 0) {
              const picked =
                candidates[Math.floor(Math.random() * candidates.length)];
              next[key] = {
                ...current,
                targetGridX: picked.x,
                targetGridY: picked.y,
                progress: 0,
                mode: "walk",
                direction: getPetDirectionFromDelta(picked.dx, picked.dy),
              };
              return;
            }

            next[key] = { ...current, nextActionAt: now + makePetIdleDelay() };
            return;
          }

          next[key] = current;
        });

        Object.keys(prev).forEach((key) => {
          if (activePetIds.has(key) && !next[key]) next[key] = prev[key];
        });

        return next;
      });
    }, SPRITE_CONFIG.ANIMATION_SPEED);

    return () => clearInterval(interval);
  }, [petPlacedItems, isPetCellAvailable]);

  const updateItemDrag = (item: any, clientX: number, clientY: number) => {
    const inventoryItem = findInventoryItem(student, item);
    const catalog = getRoomItemById(getCatalogIdFromPlaced(student, item));
    const source = getEffectiveRoomItemSource(
      catalog,
      mergeRoomItemSource(inventoryItem, item),
    );
    const direction = normalizeRoomDirection(
      (item.direction ||
        catalog?.defaultDirection ||
        source?.defaultDirection ||
        "SW") as string,
    );
    if (isWallItem(catalog, source)) return;
    const point = clientToRoomImagePoint(
      clientX,
      clientY,
      containerRef.current,
      offset,
      roomZoom,
    );
    if (!point) return;
    const nearest = findNearestFloorGridFromImagePoint(
      point,
      catalog,
      direction,
      source,
    );
    const valid = isPlacementAvailableForRender(
      placedItems || [],
      item,
      nearest.x,
      nearest.y,
      student,
    );
    const nextDrag = {
      id: String(item.id || item.itemId),
      gridX: nearest.x,
      gridY: nearest.y,
      valid,
    };
    itemDragStateRef.current = nextDrag;
    setItemDrag(nextDrag);
  };

  const finishItemDrag = () => {
    const active = itemDragRef.current;
    const latest = itemDragStateRef.current;
    if (active && latest && active.id === latest.id && latest.valid) {
      onItemMoveTo?.(active.id, latest.gridX, latest.gridY);
    }
    itemDragRef.current = null;
    itemDragStateRef.current = null;
    setItemDrag(null);
  };

  const beginDrag = (clientX: number, clientY: number, pointerId?: number) => {
    dragRef.current = {
      active: true,
      startX: clientX,
      startY: clientY,
      baseX: offset.x,
      baseY: offset.y,
      pointerId,
    };
  };

  const moveDrag = (clientX: number, clientY: number, pointerId?: number) => {
    const drag = dragRef.current;
    if (!drag.active) return;
    if (
      drag.pointerId !== undefined &&
      pointerId !== undefined &&
      drag.pointerId !== pointerId
    )
      return;
    setOffset(
      clampOffset({
        x: drag.baseX + clientX - drag.startX,
        y: drag.baseY + clientY - drag.startY,
      }),
    );
  };

  const endDrag = () => {
    dragRef.current.active = false;
    dragRef.current.pointerId = undefined;
  };

  const handleRoomWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    applyZoom(roomZoom * (e.deltaY > 0 ? 0.9 : 1.1));
  };

  const removePointer = (pointerId: number) => {
    activePointersRef.current.delete(pointerId);
    if (activePointersRef.current.size < 2) {
      pinchRef.current.active = false;
    }
  };

  const playerImage = playerToImage(position);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-gradient-to-b from-sky-100 via-blue-50 to-slate-100 touch-none cursor-grab active:cursor-grabbing select-none"
      onWheel={handleRoomWheel}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest("button")) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture?.(e.pointerId);
        activePointersRef.current.set(e.pointerId, {
          x: e.clientX,
          y: e.clientY,
        });
        if (activePointersRef.current.size >= 2) {
          dragRef.current.active = false;
          pinchRef.current = {
            active: true,
            startDistance: getPointerDistance(),
            startZoom: roomZoom,
          };
          return;
        }
        beginDrag(e.clientX, e.clientY, e.pointerId);
      }}
      onPointerMove={(e) => {
        if (
          !activePointersRef.current.has(e.pointerId) &&
          !dragRef.current.active
        )
          return;
        e.preventDefault();
        if (activePointersRef.current.has(e.pointerId)) {
          activePointersRef.current.set(e.pointerId, {
            x: e.clientX,
            y: e.clientY,
          });
        }
        if (pinchRef.current.active && activePointersRef.current.size >= 2) {
          const distance = getPointerDistance();
          if (pinchRef.current.startDistance > 0 && distance > 0) {
            applyZoom(
              pinchRef.current.startZoom *
                (distance / pinchRef.current.startDistance),
            );
          }
          return;
        }
        if (itemDragRef.current) return;
        if (!dragRef.current.active) return;
        moveDrag(e.clientX, e.clientY, e.pointerId);
      }}
      onPointerUp={(e) => {
        e.currentTarget.releasePointerCapture?.(e.pointerId);
        removePointer(e.pointerId);
        finishItemDrag();
        endDrag();
      }}
      onPointerCancel={(e) => {
        removePointer(e.pointerId);
        finishItemDrag();
        endDrag();
      }}
      onLostPointerCapture={(e) => {
        removePointer(e.pointerId);
        finishItemDrag();
        endDrag();
      }}
    >
      <div
        className="absolute"
        style={{
          left: offset.x,
          top: offset.y,
          width: ROOM_IMAGE_WIDTH,
          height: ROOM_IMAGE_HEIGHT,
          transform: `scale(${roomZoom})`,
          transformOrigin: "top left",
        }}
      >
        <img
          src={ROOM_IMAGE}
          alt="아이소메트릭 방"
          draggable={false}
          className="absolute inset-0 select-none pointer-events-none"
          style={{
            width: ROOM_IMAGE_WIDTH,
            height: ROOM_IMAGE_HEIGHT,
            imageRendering: "pixelated",
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
                clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0 50%)",
                boxShadow: "inset 0 0 0 1px rgba(245, 158, 11, 0.28)",
                background: "rgba(245, 158, 11, 0.04)",
                zIndex: 20,
              }}
            />
          ))}

        {sortedItems.map((item: any) => {
          const inventoryItem = findInventoryItem(student, item);
          const rawSource = mergeRoomItemSource(inventoryItem, item);
          const catalogId = getCatalogIdFromPlaced(student, item);
          const catalog = getRoomItemById(catalogId);
          const source = getEffectiveRoomItemSource(catalog, rawSource);
          const isPetItem =
            inventoryItem?.slot === "pet" ||
            source?.slot === "pet" ||
            item.category === "pet";
          const direction = normalizeRoomDirection(
            (item.direction ||
              catalog?.defaultDirection ||
              (source as any)?.defaultDirection ||
              (source as any)?.availableDirections?.[0] ||
              "SW") as string,
          );
          const footprint = isPetItem
            ? { w: 1, h: 1 }
            : getFootprint(catalog, source);
          const bounds = getPlacementBounds(catalog, direction, source);
          const wallItem = isWallItem(catalog, source);
          const isSelected =
            editMode &&
            selectedItemId &&
            String(item.id || item.itemId) === String(selectedItemId);
          const dragPreview =
            isSelected && itemDrag?.id === String(item.id || item.itemId)
              ? itemDrag
              : null;
          const selectedOverlayTone: "valid" | "invalid" =
            dragPreview && !dragPreview.valid ? "invalid" : "valid";
          const gx = dragPreview
            ? dragPreview.gridX
            : clamp(Number(item.gridX ?? 3), bounds.minX, bounds.maxX);
          const gy = dragPreview
            ? dragPreview.gridY
            : clamp(Number(item.gridY ?? 0), bounds.minY, bounds.maxY);
          const wz = wallItem ? getPlacedWallZ(item, direction) : undefined;
          const runtimeKey = String(
            item.id || item.inventoryItemId || item.itemId,
          );
          const petRuntime = isPetItem ? roomPetStates[runtimeKey] : undefined;
          const petVisualGrid = isPetItem
            ? getPetVisualGridPosition(petRuntime, gx, gy)
            : undefined;
          const anchor = isPetItem
            ? gridToAnchor(
                petVisualGrid?.gridX ?? gx,
                petVisualGrid?.gridY ?? gy,
              )
            : gridToFurnitureAnchor(
                gx,
                gy,
                catalog,
                direction,
                source,
                wallItem ? wz : undefined,
              );
          const displayAnchor = wallItem
            ? getWallDisplayAnchor(anchor, catalog, direction, source)
            : anchor;
          const customSprite = (source as any)?.spriteConfig;
          const customRoomSize = (source as any)?.roomSize;
          const customDirectionImages =
            (catalog as any)?.directionImages ||
            (source as any)?.directionImages;
          const directionImageUrl = getCustomDirectionImage(
            customDirectionImages,
            direction,
          );
          const customImageUrl =
            directionImageUrl || catalog?.imageUrl || source?.imageUrl;
          const customFrameSize = getFrameSizeByRoomSize(customRoomSize);
          const customFrameW = customSprite?.frameWidth || customFrameSize.w;
          const customFrameH = customSprite?.frameHeight || customFrameSize.h;
          // 제작 가구는 캔버스 전체를 80px 박스로 줄이면 실제 그림이 지나치게 작아집니다.
          // editor의 1px을 room에서도 거의 1px로 보이게 표시해 투명 여백이 있어도 실제 그림 크기가 유지되도록 합니다.
          const customDisplayWidth = customFrameW;
          const customDisplayHeight = customFrameH;
          const editorSizedCatalog = catalog && (catalog as any).roomSize;
          const displayWidth = editorSizedCatalog
            ? getEditorFurnitureDisplayWidth(catalog, footprint)
            : catalog?.renderWidth || (catalog?.id.includes("bed") ? 118 : 80);

          if (!catalog && inventoryItem?.type !== "room" && !isPetItem)
            return null;
          const itemInteractive = Boolean(onItemClick);
          const frameForHit = catalog
            ? getRoomItemFrame(catalog.id, direction)
            : undefined;
          const alphaHitSrc =
            customImageUrl || catalog?.spriteSheet || undefined;

          return (
            <button
              key={item.id || `${catalogId}-${gx}-${gy}`}
              type="button"
              onClick={(event) => {
                if (itemDragRef.current?.started) {
                  event.preventDefault();
                  event.stopPropagation();
                  return;
                }
                if (!itemInteractive) return;
                const alphaSrc = alphaHitSrc;
                if (!isPaintedPixelClick(event, alphaSrc)) {
                  event.preventDefault();
                  event.stopPropagation();
                  passClickThroughTransparentPixel(event);
                  return;
                }
                onItemClick?.(item.id || item.itemId);
              }}
              onPointerDown={(event) => {
                if (!editMode || !itemInteractive) return;
                const alphaSrc = alphaHitSrc;
                if (!isPaintedPixelClick(event as any, alphaSrc)) return;
                event.stopPropagation();
                (event.currentTarget as HTMLElement).setPointerCapture?.(
                  event.pointerId,
                );
                onItemClick?.(item.id || item.itemId);
                itemDragRef.current = {
                  id: String(item.id || item.itemId),
                  pointerId: event.pointerId,
                  started: false,
                };
                updateItemDrag(item, event.clientX, event.clientY);
              }}
              onPointerMove={(event) => {
                if (
                  !editMode ||
                  !itemDragRef.current ||
                  itemDragRef.current.pointerId !== event.pointerId
                )
                  return;
                event.stopPropagation();
                itemDragRef.current.started = true;
                updateItemDrag(item, event.clientX, event.clientY);
              }}
              onPointerUp={(event) => {
                if (
                  !editMode ||
                  !itemDragRef.current ||
                  itemDragRef.current.pointerId !== event.pointerId
                )
                  return;
                event.stopPropagation();
                (event.currentTarget as HTMLElement).releasePointerCapture?.(
                  event.pointerId,
                );
                finishItemDrag();
              }}
              disabled={!itemInteractive}
              data-alpha-src={alphaHitSrc}
              data-frame-col={frameForHit?.col ?? 0}
              data-frame-row={frameForHit?.row ?? 0}
              data-frame-width={catalog?.frameWidth}
              data-frame-height={catalog?.frameHeight}
              className={`absolute -translate-x-1/2 ${wallItem ? "-translate-y-1/2" : "-translate-y-full"} ${itemInteractive ? "cursor-pointer group" : "cursor-grab pointer-events-none"} bg-transparent border-0 p-0`}
              style={{
                left: displayAnchor.x,
                top: displayAnchor.y,
                transition:
                  isPetItem && petRuntime?.mode === "walk"
                    ? `left ${SPRITE_CONFIG.ANIMATION_SPEED}ms linear, top ${SPRITE_CONFIG.ANIMATION_SPEED}ms linear`
                    : undefined,
                zIndex: isSelected
                  ? 5000
                  : isNonBlockingRoomItem(catalog, source)
                    ? 30
                    : wallItem
                      ? 780 + (wz ?? 0)
                      : getZByImageY(anchor.y, isPetItem ? 1200 : 900),
                filter: isSelected
                  ? dragPreview && !dragPreview.valid
                    ? "drop-shadow(0 0 0.75rem rgba(239,68,68,0.9))"
                    : "drop-shadow(0 0 0.75rem rgba(255,255,255,0.95))"
                  : undefined,
              }}
            >
              {isPetItem ? (
                <RoomPetSprite
                  src={getRoomPetSpriteUrl(source, inventoryItem)}
                  name={source?.name || inventoryItem?.name || "펫"}
                  mode={petRuntime?.mode || "idle"}
                  direction={petRuntime?.direction || "front"}
                  frame={petAnimationFrame}
                />
              ) : directionImageUrl && editorSizedCatalog ? (
                <CroppedCustomFurnitureImage
                  src={directionImageUrl}
                  name={source?.name || catalog?.name || "가구"}
                  source={{ ...(catalog || {}), ...(source || {}) }}
                  footprint={footprint}
                />
              ) : catalog && !(catalog as any).sizeVariants ? (
                <>
                  <img
                    src={catalog.spriteSheet}
                    alt=""
                    className="hidden"
                    onLoad={() => getCachedAlphaCanvas(catalog.spriteSheet)}
                  />
                  <div
                    className="drop-shadow-md"
                    style={getRoomItemFrameStyle(
                      catalog.id,
                      direction,
                      displayWidth,
                    )}
                  />
                </>
              ) : customImageUrl ? (
                <CroppedCustomFurnitureImage
                  src={customImageUrl}
                  name={source?.name || "가구"}
                  source={source}
                  footprint={footprint}
                />
              ) : (
                <span className="text-4xl drop-shadow-md">
                  {source?.icon || "📦"}
                </span>
              )}
              {isSelected && !isPetItem && (
                <>
                  {directionImageUrl && editorSizedCatalog ? (
                    <CroppedCustomFurnitureImage
                      src={directionImageUrl}
                      name={source?.name || catalog?.name || "가구 선택 표시"}
                      source={{ ...(catalog || {}), ...(source || {}) }}
                      footprint={footprint}
                      overlayTone={selectedOverlayTone}
                    />
                  ) : catalog && !(catalog as any).sizeVariants ? (
                    <div
                      className="pointer-events-none"
                      style={{
                        ...getRoomItemFrameStyle(
                          catalog.id,
                          direction,
                          displayWidth,
                        ),
                        position: "absolute",
                        left: 0,
                        top: 0,
                        opacity:
                          selectedOverlayTone === "invalid" ? 0.62 : 0.55,
                        filter:
                          selectedOverlayTone === "invalid"
                            ? "brightness(0) saturate(100%) invert(26%) sepia(94%) saturate(3900%) hue-rotate(344deg) brightness(101%) contrast(96%)"
                            : "brightness(0) invert(1)",
                        mixBlendMode:
                          selectedOverlayTone === "invalid"
                            ? "normal"
                            : "screen",
                      }}
                    />
                  ) : customImageUrl ? (
                    <CroppedCustomFurnitureImage
                      src={customImageUrl}
                      name={source?.name || "가구 선택 표시"}
                      source={source}
                      footprint={footprint}
                      overlayTone={selectedOverlayTone}
                    />
                  ) : null}
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto">
                    {wallItem ? (
                      <>
                        <button
                          type="button"
                          aria-label="위로 이동"
                          className="absolute left-1/2 -translate-x-1/2 -top-16 h-8 w-8 rounded-full bg-white/95 shadow font-bold text-slate-700"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onItemMoveBy?.(
                              String(item.id || item.itemId),
                              0,
                              -1,
                            );
                          }}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          aria-label="아래로 이동"
                          className="absolute left-1/2 -translate-x-1/2 top-8 h-8 w-8 rounded-full bg-white/95 shadow font-bold text-slate-700"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onItemMoveBy?.(
                              String(item.id || item.itemId),
                              0,
                              1,
                            );
                          }}
                        >
                          ↓
                        </button>
                        {getWallSide(direction) === "left" ? (
                          <>
                            <button
                              type="button"
                              aria-label="벽 왼쪽으로 이동"
                              className="absolute -left-14 top-0 h-8 w-8 rounded-full bg-white/95 shadow font-bold text-slate-700"
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onItemMoveBy?.(
                                  String(item.id || item.itemId),
                                  -1,
                                  0,
                                );
                              }}
                            >
                              ↙
                            </button>
                            <button
                              type="button"
                              aria-label="벽 오른쪽으로 이동"
                              className="absolute left-8 -top-8 h-8 w-8 rounded-full bg-white/95 shadow font-bold text-slate-700"
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onItemMoveBy?.(
                                  String(item.id || item.itemId),
                                  1,
                                  0,
                                );
                              }}
                            >
                              ↗
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              aria-label="벽 왼쪽으로 이동"
                              className="absolute -left-14 -top-8 h-8 w-8 rounded-full bg-white/95 shadow font-bold text-slate-700"
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onItemMoveBy?.(
                                  String(item.id || item.itemId),
                                  -1,
                                  0,
                                );
                              }}
                            >
                              ↖
                            </button>
                            <button
                              type="button"
                              aria-label="벽 오른쪽으로 이동"
                              className="absolute left-8 top-0 h-8 w-8 rounded-full bg-white/95 shadow font-bold text-slate-700"
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onItemMoveBy?.(
                                  String(item.id || item.itemId),
                                  1,
                                  0,
                                );
                              }}
                            >
                              ↘
                            </button>
                          </>
                        )}
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          aria-label="왼쪽 위로 이동"
                          className="absolute -left-16 -top-11 h-8 w-8 rounded-full bg-white/95 shadow font-bold text-slate-700"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onItemMoveBy?.(
                              String(item.id || item.itemId),
                              -1,
                              0,
                            );
                          }}
                        >
                          ↖
                        </button>
                        <button
                          type="button"
                          aria-label="오른쪽 위로 이동"
                          className="absolute left-8 -top-11 h-8 w-8 rounded-full bg-white/95 shadow font-bold text-slate-700"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onItemMoveBy?.(
                              String(item.id || item.itemId),
                              0,
                              -1,
                            );
                          }}
                        >
                          ↗
                        </button>
                        <button
                          type="button"
                          aria-label="왼쪽 아래로 이동"
                          className="absolute -left-16 top-8 h-8 w-8 rounded-full bg-white/95 shadow font-bold text-slate-700"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onItemMoveBy?.(
                              String(item.id || item.itemId),
                              0,
                              1,
                            );
                          }}
                        >
                          ↙
                        </button>
                        <button
                          type="button"
                          aria-label="오른쪽 아래로 이동"
                          className="absolute left-8 top-8 h-8 w-8 rounded-full bg-white/95 shadow font-bold text-slate-700"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onItemMoveBy?.(
                              String(item.id || item.itemId),
                              1,
                              0,
                            );
                          }}
                        >
                          ↘
                        </button>
                      </>
                    )}
                    <div className="absolute -top-24 left-1/2 -translate-x-1/2 flex gap-1">
                      {catalog?.resizable && catalog?.sizeVariants && (
                        <>
                          <button
                            type="button"
                            className="h-7 w-7 rounded bg-white/95 shadow text-xs font-bold"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              onItemResize?.(
                                String(item.id || item.itemId),
                                -1,
                              );
                            }}
                          >
                            −
                          </button>
                          <button
                            type="button"
                            className="h-7 w-7 rounded bg-white/95 shadow text-xs font-bold"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              onItemResize?.(String(item.id || item.itemId), 1);
                            }}
                          >
                            ＋
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        aria-label="배치 확인"
                        className="h-7 w-7 rounded bg-emerald-500 text-white shadow text-xs font-bold"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onItemConfirm?.(String(item.id || item.itemId));
                        }}
                      >
                        ✓
                      </button>
                      <button
                        type="button"
                        className="h-7 w-7 rounded bg-white/95 shadow text-xs font-bold"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onItemRotate?.(String(item.id || item.itemId));
                        }}
                      >
                        ↻
                      </button>
                      <button
                        type="button"
                        className="h-7 w-7 rounded bg-red-500 text-white shadow text-xs font-bold"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onItemRemove?.(String(item.id || item.itemId));
                        }}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                </>
              )}
              {itemInteractive && (
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-black/75 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap">
                  {source?.name || catalog?.name || "아이템"}
                </span>
              )}
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
                  ...avatarStateForRoom,
                  facing: position.facing,
                  animationState: position.isMoving ? "walk" : "idle",
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
        🎮 아이소메트릭 방 · {Math.round(roomZoom * 100)}%
      </div>
      <div className="absolute top-4 right-4 bg-black/50 text-white px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-sm pointer-events-none">
        WASD 이동 · 휠/두 손가락 확대 · 드래그 이동
      </div>
    </div>
  );
}
