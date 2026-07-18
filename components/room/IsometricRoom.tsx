'use client';

import React from 'react';
import { gridToIso, getIsoZIndex, ISO_TILE_WIDTH, ISO_TILE_HEIGHT } from '@/lib/isometric';
import { SpriteAvatarRenderer } from '@/components/avatar/AvatarRenderer';
import type { Student, RoomPlayerPosition, PlacedRoomItem } from '@/lib/types';

interface IsometricRoomProps {
  student: Student;
  position: RoomPlayerPosition;
  placedItems: PlacedRoomItem[];
  showGrid?: boolean;
  onItemClick?: (itemId: string) => void;
  cameraOffset?: { x: number; y: number };
}

const ROOM_GRID_W = 10;
const ROOM_GRID_H = 8;

export function IsometricRoom({
  student,
  position,
  placedItems,
  showGrid = false,
  onItemClick,
  cameraOffset = { x: 400, y: 90 },
}: IsometricRoomProps) {
  const tiles = [];
  for (let y = 0; y < ROOM_GRID_H; y++) {
    for (let x = 0; x < ROOM_GRID_W; x++) {
      tiles.push({ x, y, iso: gridToIso(x, y), z: getIsoZIndex(x, y) });
    }
  }

  const sortedItems = [...placedItems].sort((a: any, b: any) => {
    const ax = a.gridX ?? Math.floor((a.x || 0) / 40);
    const ay = a.gridY ?? Math.floor((a.y || 0) / 40);
    const bx = b.gridX ?? Math.floor((b.x || 0) / 40);
    const by = b.gridY ?? Math.floor((b.y || 0) / 40);
    return getIsoZIndex(ax, ay) - getIsoZIndex(bx, by);
  });

  const playerGridX = Math.max(0, Math.min(ROOM_GRID_W - 1, Math.round(position.x / 80)));
  const playerGridY = Math.max(0, Math.min(ROOM_GRID_H - 1, Math.round(position.y / 70)));
  const playerIso = gridToIso(playerGridX, playerGridY);
  const playerZ = getIsoZIndex(playerGridX, playerGridY) + 1000;

  return (
    <div className="relative w-full h-full overflow-hidden bg-gradient-to-b from-sky-100 via-blue-50 to-slate-100">
      <div
        className="absolute"
        style={{ left: cameraOffset.x, top: cameraOffset.y, width: 1, height: 1 }}
      >
        {/* 왼쪽/오른쪽 벽: 임시 placeholder. 실제 픽셀 룸 배경은 추후 이미지로 교체 가능 */}
        <div
          className="absolute bg-amber-100/90 border-2 border-amber-300 shadow-sm"
          style={{
            left: -60,
            top: -132,
            width: ROOM_GRID_H * ISO_TILE_WIDTH / 2,
            height: 150,
            transform: 'skewY(26.5deg)',
            transformOrigin: 'bottom right',
          }}
        />
        <div
          className="absolute bg-orange-100/90 border-2 border-orange-300 shadow-sm"
          style={{
            left: 0,
            top: -132,
            width: ROOM_GRID_W * ISO_TILE_WIDTH / 2,
            height: 150,
            transform: 'skewY(-26.5deg)',
            transformOrigin: 'bottom left',
          }}
        />

        {/* 바닥 타일 */}
        {tiles.map(tile => (
          <div
            key={`tile-${tile.x}-${tile.y}`}
            className="absolute"
            style={{
              left: tile.iso.x,
              top: tile.iso.y,
              width: ISO_TILE_WIDTH,
              height: ISO_TILE_HEIGHT,
              zIndex: tile.z,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <div
              className={`w-full h-full ${showGrid ? 'border border-amber-500/40' : 'border border-amber-300/20'}`}
              style={{
                background: (tile.x + tile.y) % 2 === 0 ? '#f5d7a1' : '#f0c987',
                clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
              }}
            />
          </div>
        ))}

        {/* 배치 아이템 */}
        {sortedItems.map((item: any) => {
          const gx = item.gridX ?? Math.floor((item.x || 0) / 40);
          const gy = item.gridY ?? Math.floor((item.y || 0) / 40);
          const iso = gridToIso(gx, gy);
          const itemData = student.items.find(i => i.id === item.itemId);
          if (!itemData) return null;
          const src = itemData.imageUrl || itemData.iconUrl;
          return (
            <button
              key={item.id || `${item.itemId}-${gx}-${gy}`}
              type="button"
              onClick={() => onItemClick?.(item.id || item.itemId)}
              className="absolute -translate-x-1/2 -translate-y-full cursor-pointer group"
              style={{ left: iso.x, top: iso.y + 6, zIndex: getIsoZIndex(gx, gy) + 500 }}
            >
              {src ? (
                <img src={src} alt={itemData.name} className="w-20 h-20 object-contain drop-shadow-md" />
              ) : (
                <span className="text-4xl drop-shadow-md">{itemData.icon || '📦'}</span>
              )}
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-black/75 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap">
                {itemData.name}
              </span>
            </button>
          );
        })}

        {/* 플레이어 */}
        <div
          className="absolute -translate-x-1/2 -translate-y-full pointer-events-none"
          style={{ left: playerIso.x, top: playerIso.y + 8, zIndex: playerZ }}
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

      <div className="absolute top-4 left-4 bg-white/90 px-3 py-2 rounded-lg shadow-md text-xs font-semibold">
        🎮 아이소메트릭 방 모드
      </div>
    </div>
  );
}
