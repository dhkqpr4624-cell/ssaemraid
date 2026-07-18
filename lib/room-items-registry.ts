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
  POPULATION_DISTRIBUTION_FRAME: 'room_population_distribution_frame',
  METROPOLITAN_NIGHT_WINDOW: 'room_metropolitan_night_window',
  JUSTICE_STATUE: 'room_justice_statue',
  EQUALITY_SOFA: 'room_equality_sofa',
  CONSTITUTION_CARPET: 'room_constitution_carpet',
  CLIMATE_CHANGE_RECYCLING_BINS: 'room_climate_change_recycling_bins',
  CARBON_NEUTRAL_BED: 'room_carbon_neutral_bed',
  TERRAIN_DOCTOR_DESK: 'room_terrain_doctor_desk',
  EAST_HIGH_WEST_LOW_BOOKSHELF: 'room_east_high_west_low_bookshelf',
  DOLMEN_DESK: 'room_dolmen_desk',
  DANGUN_BED: 'room_dangun_bed',
} as const;


const ROOM_ITEM_ALIASES: Record<string, string> = {
  // image editor에서 생성된 원본 JSON id로 저장된 기존 보상/인벤토리도
  // 현재 카탈로그 id의 가구로 렌더링되도록 보정합니다.
  custom_room_1782579142862: 'room_terrain_doctor_desk',
  custom_room_1782824097783: 'room_east_high_west_low_bookshelf',
  custom_room_1783492095232: 'room_dolmen_desk',
  custom_room_1783489333279: 'room_dangun_bed',
};

function resolveRoomItemId(itemId?: string | null) {
  if (!itemId) return undefined;
  return ROOM_ITEM_ALIASES[itemId] || itemId;
}

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
  nonBlocking?: boolean;
  resizable?: { min: number; max: number; defaultSize: number };
  sizeVariants?: Record<string, { roomSize: string; footprint: { w: number; h: number }; directionImages: Record<string, string> }>;
  directionFrames: Partial<Record<RoomDirection, { col: number; row: number }>>;
  roomSize?: string;
  spriteConfig?: { columns: number; rows: number; frameWidth: number; frameHeight: number };
  directionImages?: Record<string, string>;
  grade?: string;
  semester?: string;
  subject?: string;
  unit?: string;
  curriculum?: { grade?: string; semester?: string; subject?: string; unit?: string };
  hashtags?: string[];
}


export const ROOM_ITEMS_REGISTRY: RoomItemCatalogEntry[] = [
  {
    id: ROOM_ITEM_IDS.COMMON_BED,
    name: '평범한 침대',
    type: 'room',
    category: 'furniture',
    icon: '🛏️',
    iconUrl: '/assets/items/room/common_bed_icon.png',
    imageUrl: '/assets/items/room/common_bed.png',
    spriteSheet: '/assets/items/room/common_bed.png',
    description: '편안한 휴식을 위한 평범한 침대입니다.',
    rarity: 'common',
    stackable: false,
    acquiredAt: 'system',
    rewardSelectable: true,
    naturalWidth: 640,
    naturalHeight: 320,
    frameWidth: 320,
    frameHeight: 160,
    columns: 2,
    rows: 2,
    availableDirections: ['NW', 'NE', 'SW', 'SE'],
    defaultDirection: 'NW',
    footprint: { w: 2, h: 1 },
    renderWidth: 192,
    roomSize: '320x160',
    spriteConfig: { columns: 2, rows: 2, frameWidth: 320, frameHeight: 160 },
    grade: 'general',
    collision: { halfW: 38, halfH: 12, offsetY: -5 },
    directionFrames: {
      NW: { col: 0, row: 0 },
      NE: { col: 1, row: 0 },
      SW: { col: 0, row: 1 },
      SE: { col: 1, row: 1 },
      left: { col: 0, row: 0 },
      right: { col: 1, row: 0 },
      front: { col: 0, row: 1 },
      back: { col: 0, row: 0 },
    },
  },
  {
    id: ROOM_ITEM_IDS.COMMON_CHAIR,
    name: '평범한 의자',
    type: 'room',
    category: 'furniture',
    icon: '🪑',
    iconUrl: '/assets/items/room/CommonChair_icon.png',
    imageUrl: '/assets/items/room/CommonChair.png',
    spriteSheet: '/assets/items/room/CommonChair.png',
    description: '평범한 의자 (방 가구)',
    rarity: 'common',
    stackable: false,
    acquiredAt: 'system',
    rewardSelectable: true,
    naturalWidth: 320,
    naturalHeight: 320,
    frameWidth: 160,
    frameHeight: 160,
    columns: 2,
    rows: 2,
    availableDirections: ['SE', 'NW', 'NE', 'SW'],
    defaultDirection: 'SE',
    footprint: { w: 1, h: 1 },
    renderWidth: 80,
    roomSize: '160x160',
    spriteConfig: { columns: 2, rows: 2, frameWidth: 160, frameHeight: 160 },
    grade: 'general',
    curriculum: { grade: 'general' },
    collision: { halfW: 22, halfH: 18, offsetY: -8 },
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
  {
    id: ROOM_ITEM_IDS.POPULATION_DISTRIBUTION_FRAME,
    name: '인구분포 액자',
    type: 'room',
    category: 'wall',
    icon: '🖼️',
    iconUrl: '/reward-icons/5/1/social/u2/population-distribution-frame-icon.png',
    imageUrl: '/assets/items/room/population-distribution-frame.png',
    spriteSheet: '/assets/items/room/population-distribution-frame.png',
    description: '5학년 1학기 사회 2단원 인구 분포 학습과 관련된 벽걸이 액자입니다.',
    rarity: 'common',
    stackable: false,
    acquiredAt: 'system',
    rewardSelectable: true,
    naturalWidth: 320,
    naturalHeight: 320,
    frameWidth: 160,
    frameHeight: 160,
    columns: 2,
    rows: 2,
    availableDirections: ['NW', 'NE', 'SW', 'SE'],
    defaultDirection: 'SE',
    footprint: { w: 1, h: 1 },
    renderWidth: 96,
    collision: { halfW: 0, halfH: 0, offsetY: 0 },
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
    grade: '5',
    semester: '1',
    subject: 'social',
    unit: '5-1-social-2',
  },
  {
    id: ROOM_ITEM_IDS.METROPOLITAN_NIGHT_WINDOW,
    name: '수도권 야경 창문',
    type: 'room',
    category: 'wall',
    icon: '🌃',
    iconUrl: '/reward-icons/5/1/social/u2/metropolitan-night-window-icon.png',
    imageUrl: '/assets/items/room/metropolitan-night-window.png',
    spriteSheet: '/assets/items/room/metropolitan-night-window.png',
    description: '5학년 1학기 사회 2단원 수도권 학습과 관련된 벽걸이 창문 아이템입니다.',
    rarity: 'common',
    stackable: false,
    acquiredAt: 'system',
    rewardSelectable: true,
    naturalWidth: 640,
    naturalHeight: 640,
    frameWidth: 320,
    frameHeight: 320,
    columns: 2,
    rows: 2,
    availableDirections: ['NW', 'NE', 'SW', 'SE'],
    defaultDirection: 'NW',
    footprint: { w: 2, h: 2 },
    renderWidth: 192,
    collision: { halfW: 0, halfH: 0, offsetY: 0 },
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
    grade: '5',
    semester: '1',
    subject: 'social',
    unit: '5-1-social-2',
  },

  {
    id: ROOM_ITEM_IDS.JUSTICE_STATUE,
    name: '정의의 여신상',
    type: 'room',
    category: 'furniture',
    icon: '⚖️',
    iconUrl: '/reward-icons/5/1/social/u3/justice-statue-icon.png',
    imageUrl: '/assets/items/room/justice-statue.png',
    spriteSheet: '/assets/items/room/justice-statue.png',
    description: '5학년 1학기 사회 3단원 법과 정의 학습과 관련된 정의의 여신상 가구 아이템입니다.',
    rarity: 'common',
    stackable: false,
    acquiredAt: 'system',
    rewardSelectable: true,
    naturalWidth: 320,
    naturalHeight: 320,
    frameWidth: 160,
    frameHeight: 160,
    columns: 2,
    rows: 2,
    availableDirections: ['NW', 'NE', 'SW', 'SE'],
    defaultDirection: 'SE',
    footprint: { w: 1, h: 1 },
    renderWidth: 160,
    roomSize: '160x160',
    spriteConfig: { columns: 2, rows: 2, frameWidth: 160, frameHeight: 160 },
    collision: { halfW: 22, halfH: 18, offsetY: -8 },
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
    grade: '5',
    semester: '1',
    subject: 'social',
    unit: '5-1-social-3',
  },
  {
    id: ROOM_ITEM_IDS.EQUALITY_SOFA,
    name: '평등 저울 소파',
    type: 'room',
    category: 'furniture',
    icon: '⚖️',
    iconUrl: '/reward-icons/5/1/social/u3/equality-sofa-icon.png',
    imageUrl: '/assets/items/room/equality-sofa.png',
    spriteSheet: '/assets/items/room/equality-sofa.png',
    description: '평등 저울 소파 (방 가구)',
    rarity: 'common',
    stackable: false,
    acquiredAt: 'system',
    rewardSelectable: true,
    naturalWidth: 640,
    naturalHeight: 640,
    frameWidth: 320,
    frameHeight: 320,
    columns: 2,
    rows: 2,
    availableDirections: ['NW', 'NE', 'SW', 'SE'],
    defaultDirection: 'SE',
    footprint: { w: 2, h: 1 },
    renderWidth: 320,
    roomSize: '320x160',
    spriteConfig: { columns: 2, rows: 2, frameWidth: 320, frameHeight: 320 },
    collision: { halfW: 38, halfH: 12, offsetY: -5 },
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
    grade: '5',
    semester: '1',
    subject: 'social',
    unit: '5-1-social-3',
    curriculum: { grade: '5', semester: '1', subject: 'social', unit: '5-1-social-3' },
  },
  {
    id: ROOM_ITEM_IDS.CONSTITUTION_CARPET,
    name: '헌법 카펫',
    type: 'room',
    category: 'floor',
    icon: '📜',
    iconUrl: '/reward-icons/5/1/social/u3/constitution-carpet-icon.png',
    imageUrl: '/assets/items/room/constitution-carpet/constitution-carpet-2x2-SE.png',
    spriteSheet: '/assets/items/room/constitution-carpet/constitution-carpet-2x2-SE.png',
    description: '5학년 1학기 사회 3단원 헌법 학습과 관련된 크기 조절형 카펫 아이템입니다. 카펫 위에 캐릭터와 가구를 배치할 수 있습니다.',
    rarity: 'common',
    stackable: false,
    acquiredAt: 'system',
    rewardSelectable: true,
    naturalWidth: 320,
    naturalHeight: 320,
    frameWidth: 320,
    frameHeight: 320,
    columns: 1,
    rows: 1,
    availableDirections: ['NW', 'NE', 'SW', 'SE'],
    defaultDirection: 'SE',
    footprint: { w: 2, h: 2 },
    renderWidth: 160,
    roomSize: '320x320',
    spriteConfig: { columns: 1, rows: 1, frameWidth: 320, frameHeight: 320 },
    collision: { halfW: 0, halfH: 0, offsetY: 0 },
    nonBlocking: true,
    resizable: { min: 2, max: 4, defaultSize: 2 },
    sizeVariants: {
      '2': {
        roomSize: '320x320',
        footprint: { w: 2, h: 2 },
        directionImages: {
          NW: '/assets/items/room/constitution-carpet/constitution-carpet-2x2-NW.png',
          NE: '/assets/items/room/constitution-carpet/constitution-carpet-2x2-NE.png',
          SW: '/assets/items/room/constitution-carpet/constitution-carpet-2x2-SW.png',
          SE: '/assets/items/room/constitution-carpet/constitution-carpet-2x2-SE.png',
        },
      },
      '3': {
        roomSize: '480x480',
        footprint: { w: 3, h: 3 },
        directionImages: {
          NW: '/assets/items/room/constitution-carpet/constitution-carpet-3x3-NW.png',
          NE: '/assets/items/room/constitution-carpet/constitution-carpet-3x3-NE.png',
          SW: '/assets/items/room/constitution-carpet/constitution-carpet-3x3-SW.png',
          SE: '/assets/items/room/constitution-carpet/constitution-carpet-3x3-SE.png',
        },
      },
      '4': {
        roomSize: '640x640',
        footprint: { w: 4, h: 4 },
        directionImages: {
          NW: '/assets/items/room/constitution-carpet/constitution-carpet-4x4-NW.png',
          NE: '/assets/items/room/constitution-carpet/constitution-carpet-4x4-NE.png',
          SW: '/assets/items/room/constitution-carpet/constitution-carpet-4x4-SW.png',
          SE: '/assets/items/room/constitution-carpet/constitution-carpet-4x4-SE.png',
        },
      },
    },
    directionFrames: {
      NW: { col: 0, row: 0 },
      NE: { col: 0, row: 0 },
      SW: { col: 0, row: 0 },
      SE: { col: 0, row: 0 },
      back: { col: 0, row: 0 },
      right: { col: 0, row: 0 },
      left: { col: 0, row: 0 },
      front: { col: 0, row: 0 },
    },
    grade: '5',
    semester: '1',
    subject: 'social',
    unit: '5-1-social-3',
    curriculum: { grade: '5', semester: '1', subject: 'social', unit: '5-1-social-3' },
  },

  {
    id: ROOM_ITEM_IDS.CLIMATE_CHANGE_RECYCLING_BINS,
    name: '기후변화 분리수거함',
    type: 'room',
    category: 'furniture',
    icon: '♻️',
    iconUrl: '/reward-icons/5/1/social/u2/climate-change-recycling-bins-icon.png',
    imageUrl: '/assets/items/room/climate-change-recycling-bins.png',
    spriteSheet: '/assets/items/room/climate-change-recycling-bins.png',
    description: '5학년 1학기 사회 2단원 기후변화와 분리배출 학습과 관련된 분리수거함 가구 아이템입니다.',
    rarity: 'common',
    stackable: false,
    acquiredAt: 'system',
    rewardSelectable: true,
    naturalWidth: 960,
    naturalHeight: 960,
    frameWidth: 480,
    frameHeight: 480,
    columns: 2,
    rows: 2,
    availableDirections: ['NW', 'NE', 'SW', 'SE'],
    defaultDirection: 'SE',
    footprint: { w: 3, h: 1 },
    renderWidth: 389,
    roomSize: '480x160',
    spriteConfig: { columns: 2, rows: 2, frameWidth: 480, frameHeight: 480 },
    collision: { halfW: 58, halfH: 12, offsetY: -5 },
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
    grade: '5',
    semester: '1',
    subject: 'social',
    unit: '5-1-social-2',
    curriculum: { grade: '5', semester: '1', subject: 'social', unit: '5-1-social-2' },
  },
  {
    id: ROOM_ITEM_IDS.CARBON_NEUTRAL_BED,
    name: '탄소중립 침대',
    type: 'room',
    category: 'furniture',
    icon: '🛏️',
    iconUrl: '/reward-icons/5/1/social/u2/carbon-neutral-bed-icon.png',
    imageUrl: '/assets/items/room/carbon-neutral-bed.png',
    spriteSheet: '/assets/items/room/carbon-neutral-bed.png',
    description: '5학년 1학기 사회 2단원 탄소중립 학습과 관련된 침대 가구 아이템입니다.',
    rarity: 'common',
    stackable: false,
    acquiredAt: 'system',
    rewardSelectable: true,
    naturalWidth: 640,
    naturalHeight: 640,
    frameWidth: 320,
    frameHeight: 320,
    columns: 2,
    rows: 2,
    availableDirections: ['NW', 'NE', 'SW', 'SE'],
    defaultDirection: 'NW',
    footprint: { w: 2, h: 1 },
    renderWidth: 259,
    roomSize: '320x160',
    spriteConfig: { columns: 2, rows: 2, frameWidth: 320, frameHeight: 320 },
    collision: { halfW: 38, halfH: 12, offsetY: -5 },
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
    grade: '5',
    semester: '1',
    subject: 'social',
    unit: '5-1-social-2',
    curriculum: { grade: '5', semester: '1', subject: 'social', unit: '5-1-social-2' },
  },


  {
    id: ROOM_ITEM_IDS.EAST_HIGH_WEST_LOW_BOOKSHELF,
    name: '동고서저 책장',
    type: 'room',
    category: 'furniture',
    icon: '🪑',
    iconUrl: '/reward-icons/5/1/social/u1/east-high-west-low-bookshelf-icon.png',
    imageUrl: '/assets/items/room/east-high-west-low-bookshelf.png',
    spriteSheet: '/assets/items/room/east-high-west-low-bookshelf.png',
    description: '5학년 1학기 사회 1단원 동고서저 지형 학습과 관련된 책장 가구 아이템입니다.',
    rarity: 'common',
    stackable: false,
    acquiredAt: 'system',
    rewardSelectable: true,
    naturalWidth: 480,
    naturalHeight: 480,
    frameWidth: 480,
    frameHeight: 480,
    columns: 1,
    rows: 1,
    availableDirections: ['SE', 'NW', 'NE', 'SW'],
    defaultDirection: 'SE',
    footprint: { w: 3, h: 1 },
    renderWidth: 389,
    roomSize: '480x160',
    spriteConfig: { columns: 1, rows: 1, frameWidth: 480, frameHeight: 480 },
    directionImages: {
      SE: '/assets/items/room/east-high-west-low-bookshelf/east-high-west-low-bookshelf-SE.png',
      NW: '/assets/items/room/east-high-west-low-bookshelf/east-high-west-low-bookshelf-NW.png',
      NE: '/assets/items/room/east-high-west-low-bookshelf/east-high-west-low-bookshelf-NE.png',
      SW: '/assets/items/room/east-high-west-low-bookshelf/east-high-west-low-bookshelf-SW.png',
    },
    collision: { halfW: 58, halfH: 12, offsetY: -5 },
    directionFrames: {
      NW: { col: 0, row: 0 },
      NE: { col: 0, row: 0 },
      SW: { col: 0, row: 0 },
      SE: { col: 0, row: 0 },
      back: { col: 0, row: 0 },
      right: { col: 0, row: 0 },
      left: { col: 0, row: 0 },
      front: { col: 0, row: 0 },
    },
    grade: '5',
    semester: '1',
    subject: 'social',
    unit: '5-1-social-1',
    curriculum: { grade: '5', semester: '1', subject: 'social', unit: '5-1-social-1' },
  },

  {
    id: ROOM_ITEM_IDS.TERRAIN_DOCTOR_DESK,
    name: '지형 박사 책상',
    type: 'room',
    category: 'furniture',
    icon: '🪑',
    iconUrl: '/reward-icons/5/1/social/u1/terrain-doctor-desk-icon.png',
    imageUrl: '/assets/items/room/terrain-doctor-desk.png',
    spriteSheet: '/assets/items/room/terrain-doctor-desk.png',
    description: '5학년 1학기 사회 1단원 우리나라의 지형 학습과 관련된 책상 가구 아이템입니다.',
    rarity: 'common',
    stackable: false,
    acquiredAt: 'system',
    rewardSelectable: true,
    naturalWidth: 320,
    naturalHeight: 320,
    frameWidth: 320,
    frameHeight: 320,
    columns: 1,
    rows: 1,
    availableDirections: ['NW', 'NE', 'SW', 'SE'],
    defaultDirection: 'SE',
    footprint: { w: 2, h: 1 },
    renderWidth: 259,
    roomSize: '320x160',
    spriteConfig: { columns: 1, rows: 1, frameWidth: 320, frameHeight: 320 },
    directionImages: {
      NW: '/assets/items/room/terrain-doctor-desk/terrain-doctor-desk-NW.png',
      NE: '/assets/items/room/terrain-doctor-desk/terrain-doctor-desk-NE.png',
      SW: '/assets/items/room/terrain-doctor-desk/terrain-doctor-desk-SW.png',
      SE: '/assets/items/room/terrain-doctor-desk/terrain-doctor-desk-SE.png',
    },
    collision: { halfW: 38, halfH: 12, offsetY: -5 },
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
    grade: '5',
    semester: '1',
    subject: 'social',
    unit: '5-1-social-1',
    curriculum: { grade: '5', semester: '1', subject: 'social', unit: '5-1-social-1' },
  },


  {
    id: ROOM_ITEM_IDS.DOLMEN_DESK,
    name: '고인돌 책상',
    type: 'room',
    category: 'furniture',
    icon: '🪨',
    iconUrl: '/reward-icons/5/2/social/u1/dolmen-desk-icon.png',
    imageUrl: '/assets/items/room/dolmen-desk.png',
    spriteSheet: '/assets/items/room/dolmen-desk.png',
    description: '5학년 2학기 사회 1단원 고조선과 청동기 시대 학습과 관련된 고인돌 책상 가구 아이템입니다.',
    rarity: 'common',
    stackable: false,
    acquiredAt: 'system',
    rewardSelectable: true,
    naturalWidth: 320,
    naturalHeight: 320,
    frameWidth: 320,
    frameHeight: 320,
    columns: 1,
    rows: 1,
    availableDirections: ['SE', 'NW', 'NE', 'SW'],
    defaultDirection: 'SE',
    footprint: { w: 2, h: 1 },
    renderWidth: 259,
    roomSize: '320x160',
    spriteConfig: { columns: 1, rows: 1, frameWidth: 320, frameHeight: 320 },
    directionImages: {
      SE: '/assets/items/room/dolmen-desk/dolmen-desk-SE.png',
      NW: '/assets/items/room/dolmen-desk/dolmen-desk-NW.png',
      NE: '/assets/items/room/dolmen-desk/dolmen-desk-NE.png',
      SW: '/assets/items/room/dolmen-desk/dolmen-desk-SW.png',
    },
    collision: { halfW: 38, halfH: 12, offsetY: -5 },
    directionFrames: {
      NW: { col: 0, row: 0 },
      NE: { col: 0, row: 0 },
      SW: { col: 0, row: 0 },
      SE: { col: 0, row: 0 },
      back: { col: 0, row: 0 },
      right: { col: 0, row: 0 },
      left: { col: 0, row: 0 },
      front: { col: 0, row: 0 },
    },
    grade: '5',
    semester: '2',
    subject: 'social',
    unit: '5-2-social-1',
    curriculum: { grade: '5', semester: '2', subject: 'social', unit: '5-2-social-1' },
    hashtags: ['고조선', '청동기'],
  },

  {
    id: ROOM_ITEM_IDS.DANGUN_BED,
    name: '단군왕검 침대',
    type: 'room',
    category: 'furniture',
    icon: '🛏️',
    iconUrl: '/reward-icons/5/2/social/u1/dangun-bed-icon.png',
    imageUrl: '/assets/items/room/dangun-bed.png',
    spriteSheet: '/assets/items/room/dangun-bed.png',
    description: '5학년 2학기 사회 1단원 고조선과 청동기 시대 학습과 관련된 단군왕검 침대 가구 아이템입니다.',
    rarity: 'common',
    stackable: false,
    acquiredAt: 'system',
    rewardSelectable: true,
    naturalWidth: 320,
    naturalHeight: 320,
    frameWidth: 320,
    frameHeight: 320,
    columns: 1,
    rows: 1,
    availableDirections: ['NE', 'NW', 'SW', 'SE'],
    defaultDirection: 'NE',
    footprint: { w: 2, h: 2 },
    renderWidth: 259,
    roomSize: '320x320',
    spriteConfig: { columns: 1, rows: 1, frameWidth: 320, frameHeight: 320 },
    directionImages: {
      NE: '/assets/items/room/dangun-bed/dangun-bed-NE.png',
      NW: '/assets/items/room/dangun-bed/dangun-bed-NW.png',
      SW: '/assets/items/room/dangun-bed/dangun-bed-SW.png',
      SE: '/assets/items/room/dangun-bed/dangun-bed-SE.png',
    },
    collision: { halfW: 38, halfH: 20, offsetY: -5 },
    directionFrames: {
      NW: { col: 0, row: 0 },
      NE: { col: 0, row: 0 },
      SW: { col: 0, row: 0 },
      SE: { col: 0, row: 0 },
      back: { col: 0, row: 0 },
      right: { col: 0, row: 0 },
      left: { col: 0, row: 0 },
      front: { col: 0, row: 0 },
    },
    grade: '5',
    semester: '2',
    subject: 'social',
    unit: '5-2-social-1',
    curriculum: { grade: '5', semester: '2', subject: 'social', unit: '5-2-social-1' },
    hashtags: ['고조선', '청동기'],
  },

];

export function getRoomItemById(itemId?: string | null): RoomItemCatalogEntry | undefined {
  const resolvedId = resolveRoomItemId(itemId);
  if (!resolvedId) return undefined;
  return ROOM_ITEMS_REGISTRY.find(item => item.id === resolvedId || item.name === itemId);
}

export function getAllRoomItems(): RoomItemCatalogEntry[] {
  return ROOM_ITEMS_REGISTRY;
}

export function searchRoomItems(query: string): RoomItemCatalogEntry[] {
  const lowerQuery = query.toLowerCase().trim();
  if (!lowerQuery) return ROOM_ITEMS_REGISTRY;
  return ROOM_ITEMS_REGISTRY.filter(item =>
    item.name.toLowerCase().includes(lowerQuery) ||
    (item.description || '').toLowerCase().includes(lowerQuery) ||
    (item.hashtags || []).some(tag => tag.toLowerCase().includes(lowerQuery))
  );
}

export function filterRoomItemsByRarity(rarity: string): RoomItemCatalogEntry[] {
  return ROOM_ITEMS_REGISTRY.filter(item => item.rarity === rarity);
}

export function getRoomItemCatalogIdFromItem(item: any): string | undefined {
  const rawId = item?.catalogItemId || item?.itemId || item?.id;
  const resolvedId = resolveRoomItemId(rawId);
  if (resolvedId) return resolvedId;
  if (item?.name === '지형 박사 책상') return ROOM_ITEM_IDS.TERRAIN_DOCTOR_DESK;
  if (item?.name === '동고서저 책장') return ROOM_ITEM_IDS.EAST_HIGH_WEST_LOW_BOOKSHELF;
  if (item?.name === '고인돌 책상') return ROOM_ITEM_IDS.DOLMEN_DESK;
  if (item?.name === '단군왕검 침대') return ROOM_ITEM_IDS.DANGUN_BED;
  return rawId;
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
  const fallback = roomSize === '640x640'
    ? { w: 4, h: 4 }
    : roomSize === '480x480'
      ? { w: 3, h: 3 }
      : roomSize === '320x320'
        ? { w: 2, h: 2 }
        : roomSize === '640x160'
          ? { w: 4, h: 1 }
          : roomSize === '480x160'
            ? { w: 3, h: 1 }
            : roomSize === '320x160'
              ? { w: 2, h: 1 }
              : undefined;
  if (!raw && !fallback) return undefined;
  const w = Number(raw?.w ?? raw?.width ?? fallback?.w ?? 1);
  const h = Number(raw?.h ?? raw?.height ?? fallback?.h ?? 1);
  return {
    w: Math.max(1, Math.min(4, Number.isFinite(w) ? w : 1)),
    h: Math.max(1, Math.min(4, Number.isFinite(h) ? h : 1)),
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
    imageUrl: reward?.itemSpriteUrl || catalog?.imageUrl || reward?.itemImageUrl,
    description: reward?.itemDescription || catalog?.description,
    rarity: 'common',
    acquiredAt: new Date().toISOString(),
    category: reward?.category || catalog?.category,
    // item-editor 제작 room item metadata 보존
    roomSize,
    spriteConfig: reward?.spriteConfig || catalog?.spriteConfig,
    directionImages: reward?.directionImages,
    availableDirections: reward?.availableDirections || catalog?.availableDirections,
    defaultDirection: reward?.defaultDirection || catalog?.defaultDirection || reward?.availableDirections?.[0],
    footprint: normalizedFootprint,
  };
}
