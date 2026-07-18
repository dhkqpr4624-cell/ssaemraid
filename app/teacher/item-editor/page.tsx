'use client';
/**
 * 아이템 제작 도구 (Item Editor) - 3차 개선
 *
 * A. 레이어 시스템: 다중 레이어 추가/삭제/순서변경/visible/opacity, export 합성
 * B. Transform 모드 (Ctrl+T): bounding box + handle, 드래그 이동/크기/회전, Enter 적용/Esc 취소
 * C. 자유 올가미 선택 툴: 드래그 경로 → 닫힌 mask, mask 내부만 이동/복사/변형
 * D. 기존 기능 유지: 브러시/지우개/선택/이동/복사/붙여넣기/좌우반전/가운데정렬/프레임초기화/가이드/줌/팬
 */
import { useState, useRef, useEffect, Suspense, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ArrowLeft, Download, Upload, Palette, Eraser,
  MousePointer2, Move, Eye, EyeOff, Undo2, Trash2,
  FlipHorizontal, AlignCenter, Copy, Clipboard, FileJson,
  Layers, Plus, ChevronUp, ChevronDown,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { saveCustomItem } from '@/lib/custom-items';
import {
  REWARD_GRADE_OPTIONS,
  REWARD_SEMESTER_OPTIONS,
  getRewardSubjectsForGrade,
  getRewardUnits,
} from '@/lib/reward-categories';

// ─── 타입 ─────────────────────────────────────────────────────────────────────
type ItemType = 'avatar' | 'room' | 'badge';
type AvatarSlot = 'cape' | 'hair' | 'eyes' | 'eyebrow' | 'mouth' | 'face' | 'top' | 'bottom' | 'shoes' | 'hat' | 'headAccessory' | 'accessory' | 'pet' | 'background';
type Tool = 'brush' | 'eraser' | 'select' | 'lasso' | 'move';
type RoomDirection = 'NW' | 'NE' | 'SW' | 'SE';
type RoomSize = '160x160' | '320x160' | '480x160' | '640x160' | '320x320' | '480x480' | '640x640';
type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
type GuideOpacity = 0 | 0.2 | 0.4 | 0.6;
type CurriculumMode = 'general' | 'curriculum';

interface Layer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  blendMode?: GlobalCompositeOperation;
  role?: 'color' | 'shadow' | 'outline' | 'upperColor' | 'upperShadow' | 'upperOutline' | 'underColor' | 'underShadow' | 'underOutline';
}

interface RoomSpriteConfig {
  enabled: boolean;
  columns: number;
  rows: number;
  frameWidth: number;
  frameHeight: number;
  selectedFrame: number;
}

interface EditorState {
  itemType: ItemType;
  itemName: string;
  itemSlot: AvatarSlot;
  rarity: Rarity;
  selectedFrame: number;
  showGuide: boolean;
  guideOpacity: GuideOpacity;
  curriculumMode: CurriculumMode;
  curriculumGrade: string;
  curriculumSemester: string;
  curriculumSubject: string;
  curriculumUnit: string;
  roomDirection: RoomDirection;
  roomSize: RoomSize;
  roomSprite: RoomSpriteConfig;
  brushColor: string;
  brushSize: number;
  tool: Tool;
}

interface SelectionRect { x: number; y: number; w: number; h: number; }
interface ClipboardData { imageData: ImageData; offsetX: number; offsetY: number; }

interface DirectionSnapshot {
  layers: Array<Layer & { dataUrl: string }>;
  activeId: string;
  compositeDataUrl?: string;
}

interface TransformState {
  active: boolean;
  originalImageData: ImageData | null;
  srcX: number; srcY: number; srcW: number; srcH: number;
  tx: number; ty: number;
  scaleX: number; scaleY: number;
  rotation: number;
  draggingHandle: string | null;
  dragStart: { mx: number; my: number; tx: number; ty: number; scaleX: number; scaleY: number; rotation: number } | null;
}

// ─── 상수 ─────────────────────────────────────────────────────────────────────
const FRAME_SIZE = 200;
const AVATAR_FRAMES_PER_ROW = 4;
const AVATAR_ROWS = 5;
const TOTAL_FRAMES = AVATAR_FRAMES_PER_ROW * AVATAR_ROWS;
const AVATAR_CANVAS_W = FRAME_SIZE * AVATAR_FRAMES_PER_ROW;
const AVATAR_CANVAS_H = FRAME_SIZE * AVATAR_ROWS;
const AVATAR_ROW_LABELS = ['아래/앞 이동', '왼쪽 이동', '오른쪽 이동', '위/뒤 이동', 'Idle'] as const;

// 실제 작업 캔버스 크기입니다.
// 가로형 2/3/4칸은 기존 바닥 기준(2x1/3x1/4x1)을 유지하면서
// 위쪽으로만 더 그릴 수 있도록 캔버스 높이를 정사각형으로 확장합니다.
const ROOM_SIZES: Record<RoomSize, { w: number; h: number }> = {
  '160x160': { w: 160, h: 160 },
  '320x160': { w: 320, h: 320 },
  '480x160': { w: 480, h: 480 },
  '640x160': { w: 640, h: 640 },
  '320x320': { w: 320, h: 320 },
  '480x480': { w: 480, h: 480 },
  '640x640': { w: 640, h: 640 },
};

// 방 렌더링/피벗/가이드 기준이 되는 원래 footprint 프레임 크기입니다.
// 이 값은 절대 바꾸지 않습니다.
const ROOM_GUIDE_SIZES: Record<RoomSize, { w: number; h: number }> = {
  '160x160': { w: 160, h: 160 },
  '320x160': { w: 320, h: 160 },
  '480x160': { w: 480, h: 160 },
  '640x160': { w: 640, h: 160 },
  '320x320': { w: 320, h: 320 },
  '480x480': { w: 480, h: 480 },
  '640x640': { w: 640, h: 640 },
};

const ROOM_SIZE_FOOTPRINT: Record<RoomSize, { w: number; h: number }> = {
  '160x160': { w: 1, h: 1 },
  '320x160': { w: 2, h: 1 },
  '480x160': { w: 3, h: 1 },
  '640x160': { w: 4, h: 1 },
  '320x320': { w: 2, h: 2 },
  '480x480': { w: 3, h: 3 },
  '640x640': { w: 4, h: 4 },
};

const ROOM_DIR_UI: { id: RoomDirection; arrow: string; label: string }[] = [
  { id: 'NW', arrow: '↖', label: '↖ NW' },
  { id: 'NE', arrow: '↗', label: '↗ NE' },
  { id: 'SW', arrow: '↙', label: '↙ SW' },
  { id: 'SE', arrow: '↘', label: '↘ SE' },
];

const LEGACY_DIR_MAP: Record<string, RoomDirection> = {
  front: 'SW', back: 'NW', left: 'NW', right: 'SE',
};

const BRUSH_SIZES = [1, 2, 4, 8, 12, 16];

const PRESET_COLORS = [
  '#000000','#ffffff','#ff0000','#00cc00','#0000ff',
  '#ffff00','#ff00ff','#00ffff','#ffa500','#8b4513',
  '#ff6b6b','#4ecdc4','#45b7d1','#96ceb4','#ffeaa7',
  '#dda0dd','#98d8c8','#f7dc6f','#bb8fce','#85c1e9',
];

const GUIDE_OPACITY_OPTIONS: { value: GuideOpacity; label: string }[] = [
  { value: 0, label: '숨김' },
  { value: 0.2, label: '20%' },
  { value: 0.4, label: '40%' },
  { value: 0.6, label: '60%' },
];

// ─── 유틸 ─────────────────────────────────────────────────────────────────────
function makeLayerId(prefix = 'layer') { return prefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7); }

function createHairLayerSet(): Layer[] {
  return [
    { id: makeLayerId('hair_under_color'), name: 'under color', visible: true, opacity: 1, role: 'underColor' },
    { id: makeLayerId('hair_under_shadow'), name: 'under shadow (multiply)', visible: true, opacity: 1, blendMode: 'multiply', role: 'underShadow' },
    { id: makeLayerId('hair_under_outline'), name: 'under outline', visible: true, opacity: 1, role: 'underOutline' },
    { id: makeLayerId('hair_upper_color'), name: 'upper color', visible: true, opacity: 1, role: 'upperColor' },
    { id: makeLayerId('hair_upper_shadow'), name: 'upper shadow (multiply)', visible: true, opacity: 1, blendMode: 'multiply', role: 'upperShadow' },
    { id: makeLayerId('hair_upper_outline'), name: 'upper outline', visible: true, opacity: 1, role: 'upperOutline' },
  ];
}

function isCanvasBlank(canvas?: HTMLCanvasElement | null): boolean {
  if (!canvas) return true;
  const ctx = canvas.getContext('2d');
  if (!ctx) return true;
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] > 0) return false;
  }
  return true;
}

function getCanvasSize(type: ItemType, roomSize: RoomSize, roomSprite: RoomSpriteConfig): { w: number; h: number } {
  if (type === 'avatar') return { w: AVATAR_CANVAS_W, h: AVATAR_CANVAS_H };
  if (type === 'badge') return { w: FRAME_SIZE, h: FRAME_SIZE };
  if (roomSprite.enabled) return { w: roomSprite.columns * roomSprite.frameWidth, h: roomSprite.rows * roomSprite.frameHeight };
  return ROOM_SIZES[roomSize];
}

function getAvatarFrameOffset(frame: number): { fx: number; fy: number } {
  return { fx: (frame % AVATAR_FRAMES_PER_ROW) * FRAME_SIZE, fy: Math.floor(frame / AVATAR_FRAMES_PER_ROW) * FRAME_SIZE };
}

function getRoomFrameOffset(frame: number, cfg: RoomSpriteConfig): { fx: number; fy: number } {
  return { fx: (frame % cfg.columns) * cfg.frameWidth, fy: Math.floor(frame / cfg.columns) * cfg.frameHeight };
}

function flipHorizontalFn(imageData: ImageData, w: number, h: number): ImageData {
  const src = imageData.data;
  const result = new ImageData(w, h);
  const dst = result.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const si = (y * w + x) * 4;
      const di = (y * w + (w - 1 - x)) * 4;
      dst[di] = src[si]; dst[di+1] = src[si+1]; dst[di+2] = src[si+2]; dst[di+3] = src[si+3];
    }
  }
  return result;
}

function getBoundingBox(data: Uint8ClampedArray, w: number, h: number) {
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 0) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  return { minX, minY, maxX, maxY };
}

function drawIsoFloorTile(ctx: CanvasRenderingContext2D, cx: number, cy: number, label?: string) {
  const tileW = 80; const tileH = 48;
  const left = cx - tileW / 2; const top = cy - tileH / 2;
  ctx.beginPath();
  ctx.moveTo(cx, top); ctx.lineTo(left + tileW, cy); ctx.lineTo(cx, top + tileH); ctx.lineTo(left, cy);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  if (label) { ctx.font = '9px sans-serif'; ctx.fillStyle = 'rgba(120,70,20,0.75)'; ctx.fillText(label, left + 2, top + tileH - 4); }
}

function drawFurnitureFloorGuide(ctx: CanvasRenderingContext2D, frameX: number, frameY: number, frameW: number, frameH: number) {
  const tileStepX = 40; const tileStepY = 24;
  // 안내 타일은 export용 좌표가 아니라 제작자가 “가구의 발/바닥 접점”을 맞추기 위한 guide입니다.
  // 따라서 큰 캔버스에서도 frame 밖으로 내려가지 않도록 frame 내부 하단에서 위쪽으로 확장합니다.
  const footprint = {
    w: Math.max(1, Math.round(frameW / 160)),
    h: Math.max(1, Math.round(frameH / 160)),
  };

  const bottomPadding = 54;
  const cx = frameX + frameW / 2;
  const cy = frameY + frameH - bottomPadding;

  const offsets: Array<{ x: number; y: number; label?: string }> = [];
  const label = 'floor guide 80x48';
  if (footprint.h === 1 && footprint.w > 1) {
    // 가로형 가구: 기존 2칸 가로형 guide 기준은 그대로 유지하고,
    // 3칸/4칸은 같은 tileStep만 추가로 확장합니다.
    offsets.push({ x: 0, y: 0, label });
    for (let i = 1; i < footprint.w; i++) {
      offsets.push({ x: -tileStepX * i, y: -tileStepY * i });
      offsets.push({ x: tileStepX * i, y: -tileStepY * i });
    }
  } else if (footprint.w > 1 || footprint.h > 1) {
    // 정사각형 대형 가구: 기존 2x2 guide를 변경하지 않고,
    // 3x3/4x4는 동일한 마름모 타일 간격으로 확장합니다.
    const seen = new Set<string>();
    for (let y = 0; y < footprint.h; y++) {
      for (let x = 0; x < footprint.w; x++) {
        const ox = (x - y) * tileStepX;
        const oy = -(x + y) * tileStepY;
        const key = `${ox},${oy}`;
        if (seen.has(key)) continue;
        seen.add(key);
        offsets.push({ x: ox, y: oy, label: offsets.length === 0 ? label : undefined });
      }
    }
  } else {
    offsets.push({ x: 0, y: 0, label });
  }


  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = 'rgba(245,158,11,0.06)';
  ctx.strokeStyle = 'rgba(245,158,11,0.75)';
  ctx.lineWidth = 1.5;
  offsets.forEach((offset, index) => { drawIsoFloorTile(ctx, cx + offset.x, cy + offset.y, index === 0 ? offset.label : undefined); });
  ctx.fillStyle = 'rgba(239,68,68,0.85)';
  ctx.fillRect(Math.round(cx) - 2, Math.round(cy) - 2, 4, 4);
  ctx.restore();
}

// ─── 레이어 캔버스 맵 (모듈 레벨) ────────────────────────────────────────────
const layerCanvasMap = new Map<string, HTMLCanvasElement>();

function getLayerCanvas(layerId: string, w: number, h: number): HTMLCanvasElement {
  let c = layerCanvasMap.get(layerId);
  if (!c) {
    c = document.createElement('canvas');
    c.width = w; c.height = h;
    layerCanvasMap.set(layerId, c);
  }
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  return c;
}

function removeLayerCanvas(layerId: string) { layerCanvasMap.delete(layerId); }

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────
function ItemEditorContent() {
  const router = useRouter();
  useSearchParams();

  // ── 레이어 상태 ──
  const initialHairLayers = useRef<Layer[]>(createHairLayerSet());
  const [layers, setLayers] = useState<Layer[]>(() => initialHairLayers.current);
  const [activeLayerId, setActiveLayerId] = useState<string>(initialHairLayers.current[0].id);
  const activeLayerIdRef = useRef<string>(initialHairLayers.current[0].id);
  const wasHairLayerModeRef = useRef(true);

  useEffect(() => { activeLayerIdRef.current = activeLayerId; }, [activeLayerId]);

  // ── 캔버스 refs ──
  const compositeCanvasRef = useRef<HTMLCanvasElement>(null);
  const guideCanvasRef = useRef<HTMLCanvasElement>(null);
  const bodyGuideCanvasRef = useRef<HTMLCanvasElement>(null);
  const selectionCanvasRef = useRef<HTMLCanvasElement>(null);
  const transformCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const canvasWheelAreaRef = useRef<HTMLDivElement>(null);

  const [canvasFocused, setCanvasFocused] = useState(false);
  const [editorZoom, setEditorZoom] = useState(1);
  const [editorPan, setEditorPan] = useState({ x: 0, y: 0 });
  const [isSpaceDown, setIsSpaceDown] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number; baseX: number; baseY: number } | null>(null);

  const [state, setState] = useState<EditorState>({
    itemType: 'avatar', itemName: '', itemSlot: 'hair', rarity: 'common',
    selectedFrame: 0, showGuide: true, guideOpacity: 0.4,
    curriculumMode: 'general', curriculumGrade: '', curriculumSemester: '', curriculumSubject: '', curriculumUnit: '',
    roomDirection: 'SW', roomSize: '160x160',
    roomSprite: { enabled: false, columns: 2, rows: 2, frameWidth: 160, frameHeight: 160, selectedFrame: 0 },
    brushColor: '#000000', brushSize: 4, tool: 'brush',
  });

  const [isDrawing, setIsDrawing] = useState(false);
  const [history, setHistory] = useState<{ layerId: string; dataUrl: string }[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [selection, setSelection] = useState<SelectionRect | null>(null);
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);
  const [lassoPath, setLassoPath] = useState<{ x: number; y: number }[]>([]);
  const [lassoMask, setLassoMask] = useState<ImageData | null>(null);
  const [clipboard, setClipboard] = useState<ClipboardData | null>(null);
  const [moveStart, setMoveStart] = useState<{ x: number; y: number } | null>(null);
  const [moveSnapshot, setMoveSnapshot] = useState<ImageData | null>(null);
  const [roomDirData, setRoomDirData] = useState<Record<RoomDirection, DirectionSnapshot | null>>({
    NW: null, NE: null, SW: null, SE: null,
  });
  const roomDirDataRef = useRef<Record<RoomDirection, DirectionSnapshot | null>>({
    NW: null, NE: null, SW: null, SE: null,
  });

  const [transform, setTransform] = useState<TransformState>({
    active: false, originalImageData: null,
    srcX: 0, srcY: 0, srcW: 0, srcH: 0,
    tx: 0, ty: 0, scaleX: 1, scaleY: 1, rotation: 0,
    draggingHandle: null, dragStart: null,
  });

  // ── 캔버스 크기 ──
  const { w: canvasW, h: canvasH } = getCanvasSize(state.itemType, state.roomSize, state.roomSprite);
  const maxDisplay = 640;
  const scale = Math.min(maxDisplay / canvasW, maxDisplay / canvasH, 1);
  const displayW = Math.round(canvasW * scale);
  const displayH = Math.round(canvasH * scale);
  const totalRoomFrames = state.roomSprite.columns * state.roomSprite.rows;
  const curriculumSubjects = getRewardSubjectsForGrade(state.curriculumGrade);
  const curriculumUnits = getRewardUnits({
    grade: state.curriculumGrade || undefined,
    semester: state.curriculumSemester || undefined,
    subject: state.curriculumSubject || undefined,
  });
  const canSelectCurriculumUnit = Boolean(state.curriculumGrade && state.curriculumSemester && state.curriculumSubject);
  const isHairLayerMode = state.itemType === 'avatar' && state.itemSlot === 'hair';

  useEffect(() => {
    const isHair = state.itemType === 'avatar' && state.itemSlot === 'hair';
    if (isHair && !wasHairLayerModeRef.current) {
      layers.forEach(layer => removeLayerCanvas(layer.id));
      const next = createHairLayerSet();
      next.forEach(layer => getLayerCanvas(layer.id, canvasW, canvasH));
      setLayers(next);
      setActiveLayerId(next[0].id);
      activeLayerIdRef.current = next[0].id;
      wasHairLayerModeRef.current = true;
      setTimeout(() => renderComposite(), 0);
    } else if (!isHair && wasHairLayerModeRef.current) {
      layers.forEach(layer => removeLayerCanvas(layer.id));
      const newId = makeLayerId();
      getLayerCanvas(newId, canvasW, canvasH);
      const next = [{ id: newId, name: '레이어 1', visible: true, opacity: 1 }];
      setLayers(next);
      setActiveLayerId(newId);
      activeLayerIdRef.current = newId;
      wasHairLayerModeRef.current = false;
      setTimeout(() => renderComposite(), 0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.itemType, state.itemSlot]);

  // ── 합성 렌더링 ──
  const renderComposite = useCallback(() => {
    const composite = compositeCanvasRef.current;
    if (!composite) return;
    if (composite.width !== canvasW || composite.height !== canvasH) {
      composite.width = canvasW; composite.height = canvasH;
    }
    const ctx = composite.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvasW, canvasH);
    for (const layer of layers) {
      if (!layer.visible) continue;
      const lc = layerCanvasMap.get(layer.id);
      if (!lc) continue;
      ctx.save(); ctx.globalAlpha = layer.opacity; ctx.globalCompositeOperation = layer.blendMode || 'source-over'; ctx.drawImage(lc, 0, 0); ctx.restore();
    }
    // 미리보기 업데이트
    const preview = previewCanvasRef.current;
    if (preview) {
      preview.width = FRAME_SIZE; preview.height = FRAME_SIZE;
      const pCtx = preview.getContext('2d');
      if (pCtx) {
        pCtx.imageSmoothingEnabled = false;
        pCtx.clearRect(0, 0, FRAME_SIZE, FRAME_SIZE);
        if (state.itemType === 'avatar') {
          const { fx, fy } = getAvatarFrameOffset(state.selectedFrame);
          pCtx.drawImage(composite, fx, fy, FRAME_SIZE, FRAME_SIZE, 0, 0, FRAME_SIZE, FRAME_SIZE);
        } else if (state.itemType === 'room' && state.roomSprite.enabled) {
          const { fx, fy } = getRoomFrameOffset(state.roomSprite.selectedFrame, state.roomSprite);
          pCtx.drawImage(composite, fx, fy, state.roomSprite.frameWidth, state.roomSprite.frameHeight, 0, 0, FRAME_SIZE, FRAME_SIZE);
        } else {
          pCtx.drawImage(composite, 0, 0, canvasW, canvasH, 0, 0, FRAME_SIZE, FRAME_SIZE);
        }
      }
    }
  }, [layers, canvasW, canvasH, state.itemType, state.selectedFrame, state.roomSprite]);


  const renderCompositeFromLayers = useCallback((layerList: Layer[]) => {
    const composite = compositeCanvasRef.current;
    if (!composite) return;
    if (composite.width !== canvasW || composite.height !== canvasH) {
      composite.width = canvasW;
      composite.height = canvasH;
    }
    const ctx = composite.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvasW, canvasH);
    for (const layer of layerList) {
      if (!layer.visible) continue;
      const lc = layerCanvasMap.get(layer.id);
      if (!lc) continue;
      ctx.save();
      ctx.globalAlpha = layer.opacity;
      ctx.globalCompositeOperation = layer.blendMode || 'source-over';
      ctx.drawImage(lc, 0, 0);
      ctx.restore();
    }

    const preview = previewCanvasRef.current;
    if (preview) {
      preview.width = FRAME_SIZE;
      preview.height = FRAME_SIZE;
      const pCtx = preview.getContext('2d');
      if (pCtx) {
        pCtx.imageSmoothingEnabled = false;
        pCtx.clearRect(0, 0, FRAME_SIZE, FRAME_SIZE);
        if (state.itemType === 'avatar') {
          const { fx, fy } = getAvatarFrameOffset(state.selectedFrame);
          pCtx.drawImage(composite, fx, fy, FRAME_SIZE, FRAME_SIZE, 0, 0, FRAME_SIZE, FRAME_SIZE);
        } else if (state.itemType === 'room' && state.roomSprite.enabled) {
          const { fx, fy } = getRoomFrameOffset(state.roomSprite.selectedFrame, state.roomSprite);
          pCtx.drawImage(composite, fx, fy, state.roomSprite.frameWidth, state.roomSprite.frameHeight, 0, 0, FRAME_SIZE, FRAME_SIZE);
        } else {
          pCtx.drawImage(composite, 0, 0, canvasW, canvasH, 0, 0, FRAME_SIZE, FRAME_SIZE);
        }
      }
    }
  }, [canvasW, canvasH, state.itemType, state.selectedFrame, state.roomSprite]);

  const drawCompositeDataUrl = useCallback((dataUrl?: string) => {
    if (!dataUrl) return;
    const composite = compositeCanvasRef.current;
    if (!composite) return;
    const img = new Image();
    img.onload = () => {
      if (composite.width !== canvasW || composite.height !== canvasH) {
        composite.width = canvasW;
        composite.height = canvasH;
      }
      const ctx = composite.getContext('2d');
      if (!ctx) return;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvasW, canvasH);
      ctx.drawImage(img, 0, 0);
    };
    img.src = dataUrl;
  }, [canvasW, canvasH]);

  // ── 캔버스 크기 변경 시 레이어 재초기화 ──
  useEffect(() => {
    for (const layer of layers) {
      const lc = layerCanvasMap.get(layer.id);
      if (lc && (lc.width !== canvasW || lc.height !== canvasH)) {
        lc.width = canvasW; lc.height = canvasH;
      }
    }
    renderComposite();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasW, canvasH]);

  useEffect(() => { renderComposite(); }, [renderComposite]);

  // ── avatar guide 로드: body + eyelash + iris를 합쳐서 표시 ──
  useEffect(() => {
    if (state.itemType !== 'avatar') return;
    const bodyGuide = bodyGuideCanvasRef.current;
    if (!bodyGuide) return;
    bodyGuide.width = AVATAR_CANVAS_W; bodyGuide.height = AVATAR_CANVAS_H;
    const ctx = bodyGuide.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, AVATAR_CANVAS_W, AVATAR_CANVAS_H);

    const guideSources = [
      '/assets/avatar/base/body_base.png',
      '/assets/avatar/base/body_inner.png',
      '/assets/avatar/base/body_left_arm_default.png',
      '/assets/avatar/base/body_right_arm_default.png',
      '/assets/avatar/base/eyelash.png',
      '/assets/avatar/base/eye_iris.png',
    ];

    let cancelled = false;
    Promise.all(guideSources.map(src => new Promise<HTMLImageElement | null>(resolve => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    }))).then(images => {
      if (cancelled) return;
      ctx.clearRect(0, 0, AVATAR_CANVAS_W, AVATAR_CANVAS_H);
      images.forEach(img => {
        if (img) ctx.drawImage(img, 0, 0, AVATAR_CANVAS_W, AVATAR_CANVAS_H);
      });
    });

    return () => { cancelled = true; };
  }, [state.itemType]);

  // ── 가이드 레이어 ──
  const drawGuide = useCallback(() => {
    const guide = guideCanvasRef.current;
    if (!guide) return;
    guide.width = canvasW; guide.height = canvasH;
    const ctx = guide.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvasW, canvasH);
    if (state.itemType === 'avatar') {
      ctx.strokeStyle = 'rgba(100,100,200,0.15)'; ctx.lineWidth = 1;
      for (let c = 0; c <= AVATAR_FRAMES_PER_ROW; c++) {
        ctx.beginPath(); ctx.moveTo(c * FRAME_SIZE, 0); ctx.lineTo(c * FRAME_SIZE, AVATAR_CANVAS_H); ctx.stroke();
      }
      for (let r = 0; r <= AVATAR_ROWS; r++) {
        ctx.beginPath(); ctx.moveTo(0, r * FRAME_SIZE); ctx.lineTo(AVATAR_CANVAS_W, r * FRAME_SIZE); ctx.stroke();
      }
      ctx.font = 'bold 11px sans-serif'; ctx.fillStyle = 'rgba(80,80,180,0.5)';
      AVATAR_ROW_LABELS.forEach((lbl, row) => ctx.fillText(lbl, 4, row * FRAME_SIZE + 14));
      ctx.font = '9px sans-serif'; ctx.fillStyle = 'rgba(120,120,120,0.4)';
      for (let i = 0; i < TOTAL_FRAMES; i++) {
        const { fx, fy } = getAvatarFrameOffset(i);
        ctx.fillText(`F${(i % AVATAR_FRAMES_PER_ROW) + 1}`, fx + 4, fy + FRAME_SIZE - 4);
      }
      const { fx, fy } = getAvatarFrameOffset(state.selectedFrame);
      ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 2.5;
      ctx.strokeRect(fx + 1, fy + 1, FRAME_SIZE - 2, FRAME_SIZE - 2);
    } else if (state.itemType === 'room') {
      if (state.roomSprite.enabled) {
        const { columns, rows, frameWidth, frameHeight, selectedFrame } = state.roomSprite;
        ctx.strokeStyle = 'rgba(100,100,200,0.15)'; ctx.lineWidth = 1;
        for (let c = 0; c <= columns; c++) { ctx.beginPath(); ctx.moveTo(c * frameWidth, 0); ctx.lineTo(c * frameWidth, rows * frameHeight); ctx.stroke(); }
        for (let r = 0; r <= rows; r++) { ctx.beginPath(); ctx.moveTo(0, r * frameHeight); ctx.lineTo(columns * frameWidth, r * frameHeight); ctx.stroke(); }
        const { fx, fy } = getRoomFrameOffset(selectedFrame, state.roomSprite);
        ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 2.5;
        ctx.strokeRect(fx + 1, fy + 1, frameWidth - 2, frameHeight - 2);
        ctx.font = '9px sans-serif'; ctx.fillStyle = 'rgba(120,120,120,0.4)';
        for (let i = 0; i < columns * rows; i++) {
          const { fx: gx, fy: gy } = getRoomFrameOffset(i, state.roomSprite);
          drawFurnitureFloorGuide(ctx, gx, gy, frameWidth, frameHeight);
          ctx.fillText(`F${i + 1}`, gx + 4, gy + frameHeight - 4);
        }
      } else {
        const { w: cw, h: ch } = ROOM_SIZES[state.roomSize];
        const { w: rw, h: rh } = ROOM_GUIDE_SIZES[state.roomSize];
        const guideY = Math.max(0, ch - rh);
        ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, cw - 2, ch - 2);
        const dirInfo = ROOM_DIR_UI.find(d => d.id === state.roomDirection);
        ctx.font = 'bold 13px sans-serif'; ctx.fillStyle = 'rgba(59,130,246,0.6)';
        ctx.fillText(dirInfo?.label ?? state.roomDirection, 8, 20);
        // 기존 160px 높이 기준 가이드/피벗은 캔버스 하단에 그대로 고정합니다.
        // 늘어난 공간은 오직 위쪽 여백으로만 사용합니다.
        drawFurnitureFloorGuide(ctx, 0, guideY, rw, rh);
        ctx.font = '10px sans-serif'; ctx.fillStyle = 'rgba(100,100,100,0.5)';
        ctx.fillText(`${rw}x${rh}`, 8, ch - 6);
      }
    } else {
      ctx.strokeStyle = '#8b5cf6'; ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, FRAME_SIZE - 2, FRAME_SIZE - 2);
      ctx.font = 'bold 11px sans-serif'; ctx.fillStyle = 'rgba(139,92,246,0.5)';
      ctx.fillText('배지 160x160', 8, 18);
    }
  }, [state.itemType, state.roomSize, state.roomSprite, state.roomDirection, state.selectedFrame, state.showGuide, state.guideOpacity, canvasW, canvasH]);

  useEffect(() => { drawGuide(); }, [drawGuide]);

  // ── 선택 영역 시각화 ──
  const drawSelectionOverlay = useCallback(() => {
    const selCanvas = selectionCanvasRef.current;
    if (!selCanvas) return;
    selCanvas.width = canvasW; selCanvas.height = canvasH;
    const ctx = selCanvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvasW, canvasH);
    // 올가미 경로 표시
    if (state.tool === 'lasso' && lassoPath.length > 1) {
      ctx.beginPath();
      ctx.moveTo(lassoPath[0].x, lassoPath[0].y);
      for (let i = 1; i < lassoPath.length; i++) ctx.lineTo(lassoPath[i].x, lassoPath[i].y);
      ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 1;
      ctx.setLineDash([3, 2]); ctx.stroke(); ctx.setLineDash([]);
    }
    // 직사각형 선택 표시
    if (selection && selection.w !== 0 && selection.h !== 0) {
      const { x, y, w: sw, h: sh } = selection;
      ctx.strokeStyle = lassoMask ? '#f59e0b' : '#3b82f6'; ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]); ctx.strokeRect(x, y, sw, sh); ctx.setLineDash([]);
      ctx.fillStyle = lassoMask ? 'rgba(245,158,11,0.06)' : 'rgba(59,130,246,0.08)';
      ctx.fillRect(x, y, sw, sh);
    }
  }, [selection, lassoPath, lassoMask, state.tool, canvasW, canvasH]);

  useEffect(() => { drawSelectionOverlay(); }, [drawSelectionOverlay]);

  // ── Transform overlay ──
  const drawTransformOverlay = useCallback(() => {
    const tc = transformCanvasRef.current;
    if (!tc) return;
    tc.width = canvasW; tc.height = canvasH;
    const ctx = tc.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvasW, canvasH);
    if (!transform.active || !transform.originalImageData) return;
    const { tx, ty, srcW, srcH, scaleX, scaleY, rotation } = transform;
    const dw = srcW * scaleX; const dh = srcH * scaleY;
    const cx = tx + dw / 2; const cy = ty + dh / 2;
    const tmp = document.createElement('canvas'); tmp.width = srcW; tmp.height = srcH;
    const tmpCtx = tmp.getContext('2d');
    if (tmpCtx) { tmpCtx.imageSmoothingEnabled = false; tmpCtx.putImageData(transform.originalImageData, 0, 0); }
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(cx, cy); ctx.rotate(rotation);
    ctx.drawImage(tmp, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
    // Bounding box
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(rotation);
    ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]); ctx.strokeRect(-dw/2, -dh/2, dw, dh); ctx.setLineDash([]);
    const handles = [
      { id: 'tl', x: -dw/2, y: -dh/2 }, { id: 'tr', x: dw/2, y: -dh/2 },
      { id: 'bl', x: -dw/2, y: dh/2 }, { id: 'br', x: dw/2, y: dh/2 },
    ];
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 1.5;
    for (const h of handles) { ctx.beginPath(); ctx.arc(h.x, h.y, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(0, -dh/2 - 16, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#f59e0b'; ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.font = '10px sans-serif'; ctx.fillStyle = 'rgba(59,130,246,0.8)';
    ctx.fillText('Enter: 적용  Esc: 취소  핸들: 크기/회전', 4, canvasH - 4);
  }, [transform, canvasW, canvasH]);

  useEffect(() => { drawTransformOverlay(); }, [drawTransformOverlay]);

  // ── 히스토리 ──
  const saveHistory = useCallback(() => {
    const snapshot = layers.map(layer => {
      const lc = layerCanvasMap.get(layer.id);
      return { layerId: layer.id, dataUrl: lc ? lc.toDataURL() : '' };
    });
    setHistory(prev => [...prev.slice(0, historyIndex + 1).slice(-29), snapshot]);
    setHistoryIndex(prev => Math.min(prev + 1, 29));
    renderComposite();
  }, [historyIndex, layers, renderComposite]);

  const restoreFromSnapshot = useCallback((snapshot: { layerId: string; dataUrl: string }[]) => {
    const promises = snapshot.map(({ layerId, dataUrl }) => new Promise<void>(resolve => {
      if (!dataUrl) { resolve(); return; }
      const img = new Image();
      img.onload = () => {
        const lc = getLayerCanvas(layerId, canvasW, canvasH);
        const ctx = lc.getContext('2d');
        if (ctx) { ctx.imageSmoothingEnabled = false; ctx.clearRect(0, 0, canvasW, canvasH); ctx.drawImage(img, 0, 0); }
        resolve();
      };
      img.onerror = () => resolve();
      img.src = dataUrl;
    }));
    Promise.all(promises).then(() => renderComposite());
  }, [canvasW, canvasH, renderComposite]);

  const handleUndo = useCallback(() => {
    if (historyIndex <= 0) return;
    const ni = historyIndex - 1;
    restoreFromSnapshot(history[ni]);
    setHistoryIndex(ni);
  }, [historyIndex, history, restoreFromSnapshot]);

  const handleRedo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    const ni = historyIndex + 1;
    restoreFromSnapshot(history[ni]);
    setHistoryIndex(ni);
  }, [historyIndex, history, restoreFromSnapshot]);

  // ── 좌표 변환 ──
  const getCanvasPos = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const composite = compositeCanvasRef.current;
    if (!composite) return { x: 0, y: 0 };
    const rect = composite.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return {
      x: Math.floor((clientX - rect.left) * (canvasW / rect.width)),
      y: Math.floor((clientY - rect.top) * (canvasH / rect.height)),
    };
  }, [canvasW, canvasH]);

  const getPointerPoint = (e: React.MouseEvent | React.TouchEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return { x: clientX, y: clientY };
  };

  const getClipRect = useCallback(() => {
    if (state.itemType === 'avatar') {
      const { fx, fy } = getAvatarFrameOffset(state.selectedFrame);
      return { cx: fx, cy: fy, cw: FRAME_SIZE, ch: FRAME_SIZE };
    }
    if (state.itemType === 'room' && state.roomSprite.enabled) {
      const { fx, fy } = getRoomFrameOffset(state.roomSprite.selectedFrame, state.roomSprite);
      return { cx: fx, cy: fy, cw: state.roomSprite.frameWidth, ch: state.roomSprite.frameHeight };
    }
    return { cx: 0, cy: 0, cw: canvasW, ch: canvasH };
  }, [state.itemType, state.selectedFrame, state.roomSprite, canvasW, canvasH]);

  // ── 활성 레이어 ctx ──
  const getActiveLayerCtx = useCallback(() => {
    const layerId = activeLayerIdRef.current;
    if (!layerId) return null;
    const lc = getLayerCanvas(layerId, canvasW, canvasH);
    const ctx = lc.getContext('2d');
    if (ctx) ctx.imageSmoothingEnabled = false;
    return ctx;
  }, [canvasW, canvasH]);

  // ── 도트 브러시 ──
  const applyBrush = useCallback((x: number, y: number) => {
    const ctx = getActiveLayerCtx();
    if (!ctx) return;
    const { cx, cy, cw, ch } = getClipRect();
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.beginPath(); ctx.rect(cx, cy, cw, ch); ctx.clip();
    const half = Math.floor(state.brushSize / 2);
    if (state.tool === 'brush') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = state.brushColor;
      ctx.fillRect(x - half, y - half, state.brushSize, state.brushSize);
    } else if (state.tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillRect(x - half, y - half, state.brushSize, state.brushSize);
    }
    ctx.restore();
    renderComposite();
  }, [getActiveLayerCtx, getClipRect, state.tool, state.brushColor, state.brushSize, renderComposite]);

  // ── 팬 ──
  const updateCanvasPan = (e: React.MouseEvent | React.TouchEvent) => {
    if (!panStart) return;
    const pt = getPointerPoint(e);
    setEditorPan({ x: panStart.baseX + (pt.x - panStart.x), y: panStart.baseY + (pt.y - panStart.y) });
  };
  const endCanvasPan = () => { setIsPanning(false); setPanStart(null); };

  // ── Transform 핸들 히트 테스트 ──
  const getTransformHandle = useCallback((mx: number, my: number): string | null => {
    if (!transform.active) return null;
    const { tx, ty, srcW, srcH, scaleX, scaleY, rotation } = transform;
    const dw = srcW * scaleX; const dh = srcH * scaleY;
    const cx = tx + dw / 2; const cy = ty + dh / 2;
    const cos = Math.cos(-rotation); const sin = Math.sin(-rotation);
    const lx = mx - cx; const ly = my - cy;
    const rx = lx * cos - ly * sin; const ry = lx * sin + ly * cos;
    const handles = [
      { id: 'tl', x: -dw/2, y: -dh/2 }, { id: 'tr', x: dw/2, y: -dh/2 },
      { id: 'bl', x: -dw/2, y: dh/2 }, { id: 'br', x: dw/2, y: dh/2 },
      { id: 'rotate', x: 0, y: -dh/2 - 16 },
    ];
    for (const h of handles) { if (Math.hypot(rx - h.x, ry - h.y) < 8) return h.id; }
    if (rx > -dw/2 && rx < dw/2 && ry > -dh/2 && ry < dh/2) return 'body';
    return null;
  }, [transform]);

  // ── 마우스 이벤트 ──
  const startAction = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setCanvasFocused(true);
    if (isSpaceDown) {
      setIsPanning(true);
      const pt = getPointerPoint(e);
      setPanStart({ x: pt.x, y: pt.y, baseX: editorPan.x, baseY: editorPan.y });
      return;
    }
    if (transform.active) {
      const pos = getCanvasPos(e);
      const handle = getTransformHandle(pos.x, pos.y);
      if (handle) {
        setTransform(prev => ({
          ...prev, draggingHandle: handle,
          dragStart: { mx: pos.x, my: pos.y, tx: prev.tx, ty: prev.ty, scaleX: prev.scaleX, scaleY: prev.scaleY, rotation: prev.rotation },
        }));
        setIsDrawing(true);
      }
      return;
    }
    const pos = getCanvasPos(e);
    setIsDrawing(true);
    if (state.tool === 'brush' || state.tool === 'eraser') {
      applyBrush(pos.x, pos.y);
    } else if (state.tool === 'select') {
      setLassoMask(null); setSelectionStart({ x: pos.x, y: pos.y }); setSelection({ x: pos.x, y: pos.y, w: 0, h: 0 });
    } else if (state.tool === 'lasso') {
      setLassoMask(null); setSelection(null); setLassoPath([{ x: pos.x, y: pos.y }]);
    } else if (state.tool === 'move') {
      setMoveStart({ x: pos.x, y: pos.y });
      const ctx = getActiveLayerCtx();
      if (ctx && selection && selection.w !== 0 && selection.h !== 0) {
        const sx = Math.min(selection.x, selection.x + selection.w);
        const sy = Math.min(selection.y, selection.y + selection.h);
        setMoveSnapshot(ctx.getImageData(sx, sy, Math.abs(selection.w), Math.abs(selection.h)));
      }
    }
  }, [isSpaceDown, transform, state.tool, editorPan, getCanvasPos, getTransformHandle, applyBrush, getActiveLayerCtx, selection]);

  const doAction = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (isPanning) { e.preventDefault(); updateCanvasPan(e); return; }
    if (!isDrawing) return;
    const pos = getCanvasPos(e);
    if (transform.active && transform.draggingHandle && transform.dragStart) {
      const ds = transform.dragStart;
      const dx = pos.x - ds.mx; const dy = pos.y - ds.my;
      if (transform.draggingHandle === 'body') {
        setTransform(prev => ({ ...prev, tx: ds.tx + dx, ty: ds.ty + dy }));
      } else if (transform.draggingHandle === 'rotate') {
        const { srcW, srcH, tx, ty, scaleX, scaleY } = transform;
        const dw = srcW * scaleX; const dh = srcH * scaleY;
        const cx = tx + dw / 2; const cy = ty + dh / 2;
        const angle = Math.atan2(pos.y - cy, pos.x - cx) + Math.PI / 2;
        setTransform(prev => ({ ...prev, rotation: angle }));
      } else {
        const { srcW, srcH } = transform;
        const newScaleX = Math.max(0.1, ds.scaleX + dx / srcW);
        const newScaleY = Math.max(0.1, ds.scaleY + dy / srcH);
        setTransform(prev => ({ ...prev, scaleX: newScaleX, scaleY: newScaleY }));
      }
      return;
    }
    if (state.tool === 'brush' || state.tool === 'eraser') {
      applyBrush(pos.x, pos.y);
    } else if (state.tool === 'select' && selectionStart) {
      const { cx, cy, cw, ch } = getClipRect();
      const rawX = Math.min(selectionStart.x, pos.x); const rawY = Math.min(selectionStart.y, pos.y);
      const rawW = Math.abs(pos.x - selectionStart.x); const rawH = Math.abs(pos.y - selectionStart.y);
      const clX = Math.max(cx, rawX); const clY = Math.max(cy, rawY);
      const clW = Math.min(cx + cw, rawX + rawW) - clX; const clH = Math.min(cy + ch, rawY + rawH) - clY;
      setSelection({ x: clX, y: clY, w: Math.max(0, clW), h: Math.max(0, clH) });
    } else if (state.tool === 'lasso') {
      setLassoPath(prev => [...prev, { x: pos.x, y: pos.y }]);
    } else if (state.tool === 'move' && moveStart && moveSnapshot && selection) {
      const rawDx = pos.x - moveStart.x; const rawDy = pos.y - moveStart.y;
      const ctx = getActiveLayerCtx();
      if (!ctx) return;
      const { cx, cy, cw, ch } = getClipRect();
      const sx = Math.min(selection.x, selection.x + selection.w);
      const sy = Math.min(selection.y, selection.y + selection.h);
      const sw = Math.abs(selection.w); const sh = Math.abs(selection.h);
      const nextX = Math.max(cx, Math.min(cx + cw - sw, sx + rawDx));
      const nextY = Math.max(cy, Math.min(cy + ch - sh, sy + rawDy));
      const dx = nextX - sx; const dy = nextY - sy;
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.beginPath(); ctx.rect(cx, cy, cw, ch); ctx.clip();
      ctx.clearRect(sx, sy, sw, sh);
      const tmp = document.createElement('canvas'); tmp.width = sw; tmp.height = sh;
      const tmpCtx = tmp.getContext('2d');
      if (tmpCtx) { tmpCtx.imageSmoothingEnabled = false; tmpCtx.putImageData(moveSnapshot, 0, 0); }
      ctx.drawImage(tmp, nextX, nextY);
      ctx.restore();
      setSelection(prev => prev ? { ...prev, x: sx + dx, y: sy + dy, w: sw, h: sh } : null);
      setMoveStart({ x: pos.x, y: pos.y });
      renderComposite();
    }
  }, [isPanning, isDrawing, transform, state.tool, selectionStart, moveStart, moveSnapshot, selection, getCanvasPos, applyBrush, getClipRect, getActiveLayerCtx, renderComposite]);

  // ── 올가미 마스크 생성 ──
  const finalizeLasso = useCallback(() => {
    if (lassoPath.length < 3) return;
    const { cx, cy, cw, ch } = getClipRect();
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = canvasW; maskCanvas.height = canvasH;
    const mCtx = maskCanvas.getContext('2d');
    if (!mCtx) return;
    mCtx.clearRect(0, 0, canvasW, canvasH);
    mCtx.save();
    mCtx.beginPath(); mCtx.rect(cx, cy, cw, ch); mCtx.clip();
    mCtx.fillStyle = 'rgba(255,255,255,1)';
    mCtx.beginPath();
    mCtx.moveTo(lassoPath[0].x, lassoPath[0].y);
    for (let i = 1; i < lassoPath.length; i++) mCtx.lineTo(lassoPath[i].x, lassoPath[i].y);
    mCtx.closePath(); mCtx.fill();
    mCtx.restore();
    setLassoMask(mCtx.getImageData(0, 0, canvasW, canvasH));
    let minX = canvasW, minY = canvasH, maxX = 0, maxY = 0;
    for (const p of lassoPath) {
      if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    }
    setSelection({ x: minX, y: minY, w: maxX - minX, h: maxY - minY });
    setLassoPath([]);
  }, [lassoPath, getClipRect, canvasW, canvasH]);

  const endAction = useCallback(() => {
    if (transform.active && transform.draggingHandle) {
      setTransform(prev => ({ ...prev, draggingHandle: null, dragStart: null }));
      setIsDrawing(false);
      return;
    }
    if (state.tool === 'lasso' && isDrawing && lassoPath.length > 2) finalizeLasso();
    if (isDrawing && (state.tool === 'brush' || state.tool === 'eraser' || state.tool === 'move')) saveHistory();
    setIsDrawing(false);
    setSelectionStart(null);
    setMoveStart(null);
    setMoveSnapshot(null);
  }, [transform, state.tool, isDrawing, lassoPath, finalizeLasso, saveHistory]);

  // ── Transform 진입/적용/취소 ──
  const enterTransformMode = useCallback(() => {
    if (!selection || selection.w === 0 || selection.h === 0) return;
    const ctx = getActiveLayerCtx();
    if (!ctx) return;
    const sx = Math.min(selection.x, selection.x + selection.w);
    const sy = Math.min(selection.y, selection.y + selection.h);
    const sw = Math.abs(selection.w); const sh = Math.abs(selection.h);
    setTransform({
      active: true, originalImageData: ctx.getImageData(sx, sy, sw, sh),
      srcX: sx, srcY: sy, srcW: sw, srcH: sh,
      tx: sx, ty: sy, scaleX: 1, scaleY: 1, rotation: 0,
      draggingHandle: null, dragStart: null,
    });
  }, [selection, getActiveLayerCtx]);

  const applyTransform = useCallback(() => {
    if (!transform.active || !transform.originalImageData) return;
    const ctx = getActiveLayerCtx();
    if (!ctx) return;
    const { cx, cy, cw, ch } = getClipRect();
    const { srcX, srcY, srcW, srcH, tx, ty, scaleX, scaleY, rotation, originalImageData } = transform;
    const dw = srcW * scaleX; const dh = srcH * scaleY;
    const centerX = tx + dw / 2; const centerY = ty + dh / 2;
    const tmp = document.createElement('canvas'); tmp.width = srcW; tmp.height = srcH;
    const tmpCtx = tmp.getContext('2d');
    if (tmpCtx) { tmpCtx.imageSmoothingEnabled = false; tmpCtx.putImageData(originalImageData, 0, 0); }
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.beginPath(); ctx.rect(cx, cy, cw, ch); ctx.clip();
    ctx.clearRect(srcX, srcY, srcW, srcH);
    ctx.translate(centerX, centerY); ctx.rotate(rotation);
    ctx.drawImage(tmp, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
    setTransform({ active: false, originalImageData: null, srcX: 0, srcY: 0, srcW: 0, srcH: 0, tx: 0, ty: 0, scaleX: 1, scaleY: 1, rotation: 0, draggingHandle: null, dragStart: null });
    saveHistory(); renderComposite();
  }, [transform, getActiveLayerCtx, getClipRect, saveHistory, renderComposite]);

  const cancelTransform = useCallback(() => {
    setTransform({ active: false, originalImageData: null, srcX: 0, srcY: 0, srcW: 0, srcH: 0, tx: 0, ty: 0, scaleX: 1, scaleY: 1, rotation: 0, draggingHandle: null, dragStart: null });
  }, []);

  // ── 복사/붙여넣기 ──
  const handleCopy = useCallback(() => {
    if (!selection || selection.w === 0 || selection.h === 0) return;
    const ctx = getActiveLayerCtx();
    if (!ctx) return;
    const { cx, cy } = getClipRect();
    const sx = Math.min(selection.x, selection.x + selection.w);
    const sy = Math.min(selection.y, selection.y + selection.h);
    let imageData = ctx.getImageData(sx, sy, Math.abs(selection.w), Math.abs(selection.h));
    if (lassoMask) {
      const masked = new ImageData(imageData.width, imageData.height);
      for (let py = 0; py < imageData.height; py++) {
        for (let px = 0; px < imageData.width; px++) {
          const gi = ((sy + py) * canvasW + (sx + px)) * 4;
          const li = (py * imageData.width + px) * 4;
          if (lassoMask.data[gi + 3] > 0) {
            masked.data[li] = imageData.data[li]; masked.data[li+1] = imageData.data[li+1];
            masked.data[li+2] = imageData.data[li+2]; masked.data[li+3] = imageData.data[li+3];
          }
        }
      }
      imageData = masked;
    }
    setClipboard({ imageData, offsetX: sx - cx, offsetY: sy - cy });
  }, [selection, lassoMask, getActiveLayerCtx, getClipRect, canvasW]);

  const handlePaste = useCallback(() => {
    if (!clipboard) return;
    const ctx = getActiveLayerCtx();
    if (!ctx) return;
    const { cx, cy, cw, ch } = getClipRect();
    const { imageData, offsetX, offsetY } = clipboard;
    const tmp = document.createElement('canvas'); tmp.width = imageData.width; tmp.height = imageData.height;
    const tmpCtx = tmp.getContext('2d');
    if (tmpCtx) { tmpCtx.imageSmoothingEnabled = false; tmpCtx.putImageData(imageData, 0, 0); }
    const pasteW = Math.min(imageData.width, cw); const pasteH = Math.min(imageData.height, ch);
    const desiredX = cx + offsetX;
    const desiredY = cy + offsetY;
    const pasteX = Math.max(cx, Math.min(cx + cw - pasteW, desiredX));
    const pasteY = Math.max(cy, Math.min(cy + ch - pasteH, desiredY));
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.beginPath(); ctx.rect(cx, cy, cw, ch); ctx.clip();
    ctx.drawImage(tmp, 0, 0, pasteW, pasteH, pasteX, pasteY, pasteW, pasteH);
    ctx.restore();
    setSelection({ x: pasteX, y: pasteY, w: pasteW, h: pasteH });
    saveHistory(); renderComposite();
  }, [clipboard, getActiveLayerCtx, getClipRect, saveHistory, renderComposite]);

  // ── 키보드 단축키 ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.code === 'Space') { e.preventDefault(); setIsSpaceDown(true); return; }
      if (transform.active) {
        if (e.key === 'Enter') { e.preventDefault(); applyTransform(); return; }
        if (e.key === 'Escape') { e.preventDefault(); cancelTransform(); return; }
        return;
      }
      if (!canvasFocused && !selection) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 't') { e.preventDefault(); enterTransformMode(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') { e.preventDefault(); handleCopy(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') { e.preventDefault(); handlePaste(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); handleUndo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); handleRedo(); }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') { setIsSpaceDown(false); endCanvasPan(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); };
  }, [canvasFocused, selection, transform, applyTransform, cancelTransform, enterTransformMode, handleCopy, handlePaste, handleUndo, handleRedo]);

  // ── 편집 작업 ──
  const handleClearFrame = () => {
    const ctx = getActiveLayerCtx();
    if (!ctx) return;
    const { cx, cy, cw, ch } = getClipRect();
    ctx.clearRect(cx, cy, cw, ch);
    saveHistory(); setSelection(null); setLassoMask(null); renderComposite();
  };

  const handleFlipHorizontal = () => {
    const ctx = getActiveLayerCtx();
    if (!ctx) return;
    const { cx, cy, cw, ch } = getClipRect();
    ctx.putImageData(flipHorizontalFn(ctx.getImageData(cx, cy, cw, ch), cw, ch), cx, cy);
    saveHistory(); renderComposite();
  };

  const handleCenterContent = () => {
    const ctx = getActiveLayerCtx();
    if (!ctx) return;
    const { cx, cy, cw, ch } = getClipRect();
    const imageData = ctx.getImageData(cx, cy, cw, ch);
    const { minX, minY, maxX, maxY } = getBoundingBox(imageData.data, cw, ch);
    if (minX > maxX || minY > maxY) return;
    const contentW = maxX - minX + 1; const contentH = maxY - minY + 1;
    const offX = Math.floor((cw - contentW) / 2) - minX;
    const offY = Math.floor((ch - contentH) / 2) - minY;
    const tmp = document.createElement('canvas'); tmp.width = cw; tmp.height = ch;
    const tmpCtx = tmp.getContext('2d');
    if (tmpCtx) { tmpCtx.imageSmoothingEnabled = false; tmpCtx.putImageData(imageData, 0, 0); }
    ctx.clearRect(cx, cy, cw, ch);
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.beginPath(); ctx.rect(cx, cy, cw, ch); ctx.clip();
    ctx.drawImage(tmp, cx + offX, cy + offY);
    ctx.restore(); saveHistory(); renderComposite();
  };

  // ── 레이어 관리 ──
  const addLayer = () => {
    const newId = makeLayerId();
    getLayerCanvas(newId, canvasW, canvasH);
    const newLayer: Layer = { id: newId, name: `레이어 ${layers.length + 1}`, visible: true, opacity: 1 };

    if (isHairLayerMode) {
      // 머리 아이템의 color/shadow/outline 3개 핵심 레이어는 고정하되,
      // 작업용 추가 레이어는 color 위·shadow 아래에 자유롭게 쌓을 수 있게 한다.
      setLayers(prev => {
        const shadowIdx = prev.findIndex(l => l.role === 'shadow');
        if (shadowIdx < 0) return [...prev, newLayer];
        return [...prev.slice(0, shadowIdx), newLayer, ...prev.slice(shadowIdx)];
      });
    } else {
      setLayers(prev => [...prev, newLayer]);
    }

    setActiveLayerId(newId);
    activeLayerIdRef.current = newId;
  };

  const deleteLayer = (id: string) => {
    const targetLayer = layers.find(l => l.id === id);
    if (isHairLayerMode && targetLayer?.role) {
      alert('머리 아이템의 color / shadow / outline 기본 레이어는 삭제할 수 없습니다.');
      return;
    }
    if (layers.length <= 1) { alert('최소 1개의 레이어가 필요합니다.'); return; }
    removeLayerCanvas(id);
    setLayers(prev => {
      const next = prev.filter(l => l.id !== id);
      if (activeLayerIdRef.current === id) {
        const newActive = next[next.length - 1]?.id || '';
        setActiveLayerId(newActive);
        activeLayerIdRef.current = newActive;
      }
      return next;
    });
    setTimeout(() => renderComposite(), 0);
  };

  const moveLayerUp = (idx: number) => {
    if (idx >= layers.length - 1) return;
    if (isHairLayerMode) {
      const current = layers[idx];
      const next = layers[idx + 1];
      if (current.role || next.role) return;
    }
    setLayers(prev => { const a = [...prev]; [a[idx], a[idx+1]] = [a[idx+1], a[idx]]; return a; });
  };

  const moveLayerDown = (idx: number) => {
    if (idx <= 0) return;
    if (isHairLayerMode) {
      const current = layers[idx];
      const prevLayer = layers[idx - 1];
      if (current.role || prevLayer.role) return;
    }
    setLayers(prev => { const a = [...prev]; [a[idx], a[idx-1]] = [a[idx-1], a[idx]]; return a; });
  };

  const updateLayer = (id: string, updates: Partial<Layer>) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
  };

  // ── room 방향 전환 ──
  const snapshotLayers = useCallback((): DirectionSnapshot => {
    const compositeDataUrl = compositeCanvasRef.current?.toDataURL() || '';
    return {
      layers: layers.map(layer => {
        const lc = layerCanvasMap.get(layer.id);
        return { ...layer, dataUrl: lc ? lc.toDataURL() : '' };
      }),
      activeId: activeLayerIdRef.current,
      compositeDataUrl,
    };
  }, [layers]);

  const restoreLayersFromSnapshot = useCallback((snapshot: DirectionSnapshot, fallbackActiveId?: string) => {
    for (const layer of layers) removeLayerCanvas(layer.id);
    const restoredLayers = snapshot.layers.map(layer => ({
      id: layer.id,
      name: layer.name,
      visible: layer.visible,
      opacity: layer.opacity,
    }));

    if (restoredLayers.length === 0) {
      const newId = makeLayerId();
      getLayerCanvas(newId, canvasW, canvasH);
      setLayers([{ id: newId, name: '레이어 1', visible: true, opacity: 1 }]);
      setActiveLayerId(newId);
      activeLayerIdRef.current = newId;
      setTimeout(() => renderCompositeFromLayers([{ id: newId, name: '레이어 1', visible: true, opacity: 1 }]), 0);
      return;
    }

    setLayers(restoredLayers);
    const nextActiveId = fallbackActiveId && restoredLayers.some(layer => layer.id === fallbackActiveId)
      ? fallbackActiveId
      : restoredLayers[0].id;
    setActiveLayerId(nextActiveId);
    activeLayerIdRef.current = nextActiveId;

    Promise.all(snapshot.layers.map(layer => new Promise<void>(resolve => {
      const lc = getLayerCanvas(layer.id, canvasW, canvasH);
      const ctx = lc.getContext('2d');
      if (!ctx || !layer.dataUrl) {
        if (ctx) ctx.clearRect(0, 0, canvasW, canvasH);
        resolve();
        return;
      }
      const img = new Image();
      img.onload = () => {
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, canvasW, canvasH);
        ctx.drawImage(img, 0, 0);
        resolve();
      };
      img.onerror = () => resolve();
      img.src = layer.dataUrl;
    }))).then(() => {
      renderCompositeFromLayers(restoredLayers);
      setTimeout(() => renderCompositeFromLayers(restoredLayers), 0);
      setTimeout(() => drawCompositeDataUrl(snapshot.compositeDataUrl), 20);
    });
  }, [layers, canvasW, canvasH, renderCompositeFromLayers, drawCompositeDataUrl]);

  const handleRoomDirectionChange = (dir: RoomDirection) => {
    if (dir === state.roomDirection) return;

    const currentDir = state.roomDirection;
    const currentSnapshot = snapshotLayers();
    const nextDirData = {
      ...roomDirDataRef.current,
      [currentDir]: currentSnapshot,
    };
    roomDirDataRef.current = nextDirData;
    const savedTarget = nextDirData[dir];

    setRoomDirData(nextDirData);

    setState(s => ({ ...s, roomDirection: dir }));
    setSelection(null);
    setLassoMask(null);
    setLassoPath([]);
    setTransform({
      active: false, originalImageData: null,
      srcX: 0, srcY: 0, srcW: 0, srcH: 0,
      tx: 0, ty: 0, scaleX: 1, scaleY: 1, rotation: 0,
      draggingHandle: null, dragStart: null,
    });

    if (savedTarget) {
      restoreLayersFromSnapshot(savedTarget, savedTarget.activeId);
    } else {
      const newId = makeLayerId();
      for (const layer of layers) removeLayerCanvas(layer.id);
      getLayerCanvas(newId, canvasW, canvasH);
      setLayers([{ id: newId, name: '레이어 1', visible: true, opacity: 1 }]);
      setActiveLayerId(newId);
      activeLayerIdRef.current = newId;
      setTimeout(() => renderCompositeFromLayers([{ id: newId, name: '레이어 1', visible: true, opacity: 1 }]), 0);
    }
  };

  const handleRoomSpriteChange = (updates: Partial<RoomSpriteConfig>) => {
    setState(s => ({ ...s, roomSprite: { ...s.roomSprite, ...updates } }));
  };

  const handleRoomSizeChange = (size: RoomSize) => {
    if (!confirm(`크기를 ${size}로 변경하면 현재 작업이 초기화됩니다. 계속하시겠습니까?`)) return;
    setState(s => ({ ...s, roomSize: size }));
  };

  // ── 줌 ──
  const handleCanvasWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setEditorZoom(prev => Math.max(0.25, Math.min(8, prev * delta)));
  };


  useEffect(() => {
    const el = canvasWheelAreaRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const delta = event.deltaY > 0 ? 0.9 : 1.1;
      setEditorZoom(prev => Math.max(0.25, Math.min(8, prev * delta)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel as EventListener);
  }, []);

  // ── Import ──
  const handleImportImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const ctx = getActiveLayerCtx();
        if (!ctx) return;
        if (state.itemType === 'avatar') {
          if (img.width === AVATAR_CANVAS_W && img.height === AVATAR_CANVAS_H) { ctx.clearRect(0, 0, AVATAR_CANVAS_W, AVATAR_CANVAS_H); ctx.drawImage(img, 0, 0); }
          else { const { fx, fy } = getAvatarFrameOffset(state.selectedFrame); ctx.drawImage(img, fx, fy, FRAME_SIZE, FRAME_SIZE); }
        } else { ctx.clearRect(0, 0, canvasW, canvasH); ctx.drawImage(img, 0, 0, canvasW, canvasH); }
        saveHistory(); renderComposite();
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file); e.target.value = '';
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        if (!json || typeof json !== 'object') throw new Error('유효하지 않은 JSON');
        let roomDir: RoomDirection = 'SW';
        if (json.direction) roomDir = (LEGACY_DIR_MAP[json.direction] ?? json.direction) as RoomDirection;
        setState(s => ({
          ...s, itemName: json.name || s.itemName,
          itemType: (['avatar','room','badge'].includes(json.type) ? json.type : s.itemType) as ItemType,
          itemSlot: json.slot || s.itemSlot,
          rarity: (['common','rare','epic','legendary'].includes(json.rarity) ? json.rarity : s.rarity) as Rarity,
          roomDirection: roomDir,
          curriculumMode: json.curriculum || json.grade || json.rewardCategory || json.categoryMeta ? 'curriculum' : s.curriculumMode,
          curriculumGrade: json.grade || json.curriculum?.grade || json.rewardCategory?.grade || json.categoryMeta?.grade || s.curriculumGrade,
          curriculumSemester: json.semester || json.curriculum?.semester || json.rewardCategory?.semester || json.categoryMeta?.semester || s.curriculumSemester,
          curriculumSubject: json.subject || json.curriculum?.subject || json.rewardCategory?.subject || json.categoryMeta?.subject || s.curriculumSubject,
          curriculumUnit: json.unit || json.curriculum?.unit || json.rewardCategory?.unit || json.categoryMeta?.unit || s.curriculumUnit,
        }));
        const imageUrl = json.imageUrl || json.spriteUrl;
        if (imageUrl) {
          const img = new Image();
          img.onload = () => {
            const ctx = getActiveLayerCtx();
            if (!ctx) return;
            ctx.imageSmoothingEnabled = false; ctx.clearRect(0, 0, canvasW, canvasH); ctx.drawImage(img, 0, 0);
            saveHistory(); renderComposite();
          };
          img.src = imageUrl;
        }
        try {
          saveCustomItem(json);
          alert(`"${json.name || '아이템'}" 불러오기 완료 및 보상 아이템 목록에 저장되었습니다.`);
        } catch {
          alert(`"${json.name || '아이템'}" 불러오기 완료`);
        }
      } catch (err) { alert('JSON 오류: ' + (err as Error).message); }
    };
    reader.readAsText(file); e.target.value = '';
  };

  // ── Export / Save (visible 레이어 합성) ──
  const createMergedCanvas = useCallback(() => {
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvasW;
    exportCanvas.height = canvasH;
    const exportCtx = exportCanvas.getContext('2d');
    if (!exportCtx) return null;
    exportCtx.imageSmoothingEnabled = false;
    for (const layer of layers) {
      if (!layer.visible) continue;
      const lc = layerCanvasMap.get(layer.id);
      if (!lc) continue;
      exportCtx.save();
      exportCtx.globalAlpha = layer.opacity;
      exportCtx.globalCompositeOperation = layer.blendMode || 'source-over';
      exportCtx.drawImage(lc, 0, 0);
      exportCtx.restore();
    }
    return exportCanvas;
  }, [canvasW, canvasH, layers]);

  const createHairColorMaskCanvas = useCallback(() => {
    const colorMaskCanvas = document.createElement('canvas');
    colorMaskCanvas.width = canvasW;
    colorMaskCanvas.height = canvasH;
    const colorMaskCtx = colorMaskCanvas.getContext('2d');
    if (!colorMaskCtx) return null;
    colorMaskCtx.imageSmoothingEnabled = false;

    // 머리 전용 추가 레이어는 colorMask에 함께 합성한다.
    // shadow/outline은 별도 기능 레이어로 저장하므로 여기서는 제외한다.
    for (const layer of layers) {
      if (!layer.visible) continue;
      if (layer.role === 'shadow' || layer.role === 'outline' || layer.role === 'underShadow' || layer.role === 'underOutline' || layer.role === 'upperShadow' || layer.role === 'upperOutline') continue;
      const lc = layerCanvasMap.get(layer.id);
      if (!lc) continue;
      colorMaskCtx.save();
      colorMaskCtx.globalAlpha = layer.opacity;
      colorMaskCtx.globalCompositeOperation = 'source-over';
      colorMaskCtx.drawImage(lc, 0, 0);
      colorMaskCtx.restore();
    }

    return colorMaskCanvas;
  }, [canvasW, canvasH, layers]);

  const buildItemPayload = useCallback(() => {
    const name = state.itemName.trim() || '새 아이템';
    const exportCanvas = createMergedCanvas();
    if (!exportCanvas) return null;

    const curriculum = state.curriculumMode === 'general'
      ? { grade: 'general', semester: undefined, subject: undefined, unit: undefined }
      : {
          grade: state.curriculumGrade || undefined,
          semester: state.curriculumSemester || undefined,
          subject: state.curriculumSubject || undefined,
          unit: state.curriculumUnit || undefined,
        };

    if (state.itemType === 'avatar') {
      const imageUrl = exportCanvas.toDataURL('image/png');
      const iconC = document.createElement('canvas');
      iconC.width = FRAME_SIZE;
      iconC.height = FRAME_SIZE;
      const iconCtx = iconC.getContext('2d');
      if (iconCtx) {
        iconCtx.imageSmoothingEnabled = false;
        iconCtx.drawImage(exportCanvas, 0, 0, FRAME_SIZE, FRAME_SIZE, 0, 0, FRAME_SIZE, FRAME_SIZE);
      }

      const baseItem: any = {
        id: `custom_avatar_${Date.now()}`,
        name,
        type: 'avatar',
        slot: state.itemSlot,
        rarity: state.rarity,
        icon: '🎨',
        iconUrl: iconC.toDataURL('image/png'),
        imageUrl,
        description: `${name} (아바타 아이템)`,
        curriculum,
        grade: curriculum.grade,
        semester: curriculum.semester,
        subject: curriculum.subject,
        unit: curriculum.unit,
        acquiredAt: new Date().toISOString(),
      };

      if (state.itemSlot === 'hair') {
        const findLayerCanvas = (role: Layer['role']) => {
          const layer = layers.find(l => l.role === role);
          return layer ? layerCanvasMap.get(layer.id) : null;
        };
        const underColorCanvas = findLayerCanvas('underColor');
        const underShadowCanvas = findLayerCanvas('underShadow');
        const underOutlineCanvas = findLayerCanvas('underOutline');
        const upperColorCanvas = findLayerCanvas('upperColor');
        const upperShadowCanvas = findLayerCanvas('upperShadow');
        const upperOutlineCanvas = findLayerCanvas('upperOutline');

        const hasUnderColor = !!underColorCanvas && !isCanvasBlank(underColorCanvas);
        const hasUpperColor = !!upperColorCanvas && !isCanvasBlank(upperColorCanvas);
        const hasUnderOutline = !!underOutlineCanvas && !isCanvasBlank(underOutlineCanvas);
        const hasUpperOutline = !!upperOutlineCanvas && !isCanvasBlank(upperOutlineCanvas);

        // 6레이어 헤어는 outline이 선택 사항입니다.
        // color 레이어만 있어도 저장하고, shadow/outline은 비어 있지 않을 때만 포함합니다.
        if ((hasUnderColor || hasUpperColor) && (underColorCanvas || upperColorCanvas)) {
          baseItem.hairLayerMode = 'six';
          if (hasUnderColor && underColorCanvas) baseItem.underTintMaskUrl = underColorCanvas.toDataURL('image/png');
          if (underShadowCanvas && !isCanvasBlank(underShadowCanvas)) baseItem.underShadowImageUrl = underShadowCanvas.toDataURL('image/png');
          if (hasUnderOutline && underOutlineCanvas) baseItem.underOutlineImageUrl = underOutlineCanvas.toDataURL('image/png');
          if (hasUpperColor && upperColorCanvas) baseItem.upperTintMaskUrl = upperColorCanvas.toDataURL('image/png');
          if (upperShadowCanvas && !isCanvasBlank(upperShadowCanvas)) baseItem.upperShadowImageUrl = upperShadowCanvas.toDataURL('image/png');
          if (hasUpperOutline && upperOutlineCanvas) baseItem.upperOutlineImageUrl = upperOutlineCanvas.toDataURL('image/png');
          baseItem.tintMaskUrl = baseItem.underTintMaskUrl || baseItem.upperTintMaskUrl;
          baseItem.shadowImageUrl = baseItem.underShadowImageUrl || baseItem.upperShadowImageUrl;
          baseItem.outlineImageUrl = baseItem.underOutlineImageUrl || baseItem.upperOutlineImageUrl;
          baseItem.imageUrl = baseItem.underOutlineImageUrl || baseItem.upperOutlineImageUrl || baseItem.underTintMaskUrl || baseItem.upperTintMaskUrl || imageUrl;
        } else {
          const shadowLayer = layers.find(l => l.role === 'shadow');
          const outlineLayer = layers.find(l => l.role === 'outline');
          const colorCanvas = createHairColorMaskCanvas();
          const shadowCanvas = shadowLayer ? layerCanvasMap.get(shadowLayer.id) : null;
          const outlineCanvas = outlineLayer ? layerCanvasMap.get(outlineLayer.id) : null;
          const hasColor = !isCanvasBlank(colorCanvas);
          const hasShadow = !isCanvasBlank(shadowCanvas);
          const hasOutline = !isCanvasBlank(outlineCanvas);

          if (hasColor && hasShadow && hasOutline && colorCanvas && shadowCanvas && outlineCanvas) {
            baseItem.hairLayerMode = 'triple';
            baseItem.tintMaskUrl = colorCanvas.toDataURL('image/png');
            baseItem.shadowImageUrl = shadowCanvas.toDataURL('image/png');
            baseItem.outlineImageUrl = outlineCanvas.toDataURL('image/png');
            baseItem.imageUrl = outlineCanvas.toDataURL('image/png');
          } else {
            baseItem.hairLayerMode = 'singleColorMask';
            baseItem.tintMaskUrl = imageUrl;
            baseItem.imageUrl = imageUrl;
          }
        }
      }

      return baseItem;
    }

    if (state.itemType === 'room') {
      const currentData = exportCanvas.toDataURL('image/png');
      const allDirData: Record<string, string> = { [state.roomDirection]: currentData };
      (Object.keys(roomDirDataRef.current) as RoomDirection[]).forEach(dir => {
        const saved = roomDirDataRef.current[dir];
        if (!saved || dir === state.roomDirection) return;
        if (saved.compositeDataUrl) allDirData[dir] = saved.compositeDataUrl;
      });
      const preferredImage = allDirData.SW || allDirData.NW || currentData;
      return {
        id: `custom_room_${Date.now()}`,
        name,
        type: 'room',
        category: 'furniture',
        rarity: state.rarity,
        icon: '🪑',
        iconUrl: preferredImage,
        imageUrl: preferredImage,
        directionImages: allDirData,
        availableDirections: Object.keys(allDirData),
        isAnimated: state.roomSprite.enabled,
        roomSize: state.roomSize,
        footprint: ROOM_SIZE_FOOTPRINT[state.roomSize] || { w: 1, h: 1 },
        canvasSize: { w: canvasW, h: canvasH },
        guideSize: ROOM_GUIDE_SIZES[state.roomSize] || { w: canvasW, h: canvasH },
        spriteConfig: state.roomSprite.enabled ? {
          columns: state.roomSprite.columns,
          rows: state.roomSprite.rows,
          frameWidth: state.roomSprite.frameWidth,
          frameHeight: state.roomSprite.frameHeight,
        } : undefined,
        description: `${name} (방 가구)`,
        curriculum,
        grade: curriculum.grade,
        semester: curriculum.semester,
        subject: curriculum.subject,
        unit: curriculum.unit,
        acquiredAt: new Date().toISOString(),
      };
    }

    const imageUrl = exportCanvas.toDataURL('image/png');
    return {
      id: `custom_badge_${Date.now()}`,
      name,
      type: 'badge',
      rarity: state.rarity,
      icon: '🏅',
      iconUrl: imageUrl,
      imageUrl,
      description: `${name} (배지)`,
      curriculum,
      grade: curriculum.grade,
      semester: curriculum.semester,
      subject: curriculum.subject,
      unit: curriculum.unit,
      acquiredAt: new Date().toISOString(),
    };
  }, [createMergedCanvas, createHairColorMaskCanvas, state, roomDirData]);

  const handleSaveItem = () => {
    const item = buildItemPayload();
    if (!item) return;
    try {
      const saved = saveCustomItem(item);
      alert(`저장 완료: ${saved.name}\n이제 퀴즈 보상 아이템 검색 목록에서 사용할 수 있습니다.`);
    } catch (err) {
      alert('저장 실패: ' + (err as Error).message);
    }
  };

  const handleExport = () => {
    const item = buildItemPayload();
    if (!item) return;
    downloadJson(item, state.itemName.trim() || '새 아이템');
  };

  function downloadJson(data: object, name: string) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${name}.json`; a.click(); URL.revokeObjectURL(url);
  }

  const cursorStyle = isSpaceDown ? (isPanning ? 'grabbing' : 'grab') : transform.active ? 'default' : 'crosshair';

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-6" onClick={() => setCanvasFocused(false)}>
      <div className="max-w-7xl mx-auto space-y-4">

        {/* 상단 바 */}
        <div className="flex items-center justify-between bg-white p-3 rounded-xl shadow-sm flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft className="w-5 h-5" /></Button>
            <div>
              <h1 className="text-lg font-bold">아이템 제작 도구</h1>
              <p className="text-xs text-muted-foreground">레이어 · Transform(Ctrl+T) · 올가미 · Ctrl+C/V/Z</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={handleUndo} disabled={historyIndex <= 0}><Undo2 className="w-4 h-4 mr-1" /> 취소</Button>
            <Button variant="outline" size="sm" onClick={handleRedo} disabled={historyIndex >= history.length - 1}><Undo2 className="w-4 h-4 mr-1 scale-x-[-1]" /> 다시</Button>
            <label className="relative cursor-pointer">
              <input type="file" accept="image/*" onChange={handleImportImage} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
              <Button variant="outline" size="sm" asChild><span><Upload className="w-4 h-4 mr-1" /> PNG</span></Button>
            </label>
            <label className="relative cursor-pointer">
              <input type="file" accept=".json" onChange={handleImportJson} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
              <Button variant="outline" size="sm" asChild><span><FileJson className="w-4 h-4 mr-1" /> JSON 불러오기</span></Button>
            </label>
            <Button size="sm" onClick={handleSaveItem} className="bg-emerald-600 hover:bg-emerald-700 text-white"><Download className="w-4 h-4 mr-1" /> 아이템 저장</Button>
            <Button size="sm" onClick={handleExport} className="bg-purple-600 hover:bg-purple-700 text-white"><Download className="w-4 h-4 mr-1" /> JSON 내보내기</Button>
          </div>
        </div>

        {/* Transform 모드 배너 */}
        {transform.active && (
          <div className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center justify-between">
            <span className="text-sm font-medium">🔄 Transform 모드 — 드래그: 이동 · 모서리 핸들: 크기 · 상단 핸들(주황): 회전</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="text-white border-white hover:bg-blue-700" onClick={cancelTransform}>Esc 취소</Button>
              <Button size="sm" className="bg-white text-blue-600 hover:bg-blue-50" onClick={applyTransform}>Enter 적용</Button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

          {/* 도구 모음 */}
          <div className="lg:col-span-1 space-y-2">
            <Card className="p-2">
              <div className="flex flex-col gap-1.5">
                {([
                  { id: 'brush' as Tool, icon: Palette, label: '브러시' },
                  { id: 'eraser' as Tool, icon: Eraser, label: '지우개' },
                  { id: 'select' as Tool, icon: MousePointer2, label: '사각 선택' },
                  { id: 'lasso' as Tool, label: '올가미' },
                  { id: 'move' as Tool, icon: Move, label: '이동' },
                ] as Array<{ id: Tool; icon?: React.ElementType; label: string }>).map(tool => (
                  <Button key={tool.id} variant={state.tool === tool.id ? 'default' : 'ghost'} size="icon"
                    onClick={() => setState(s => ({ ...s, tool: tool.id }))} title={tool.label} className="w-9 h-9">
                    {tool.icon ? <tool.icon className="w-4 h-4" /> : <span className="text-[10px] font-bold">올가미</span>}
                  </Button>
                ))}
                <div className="h-px bg-slate-200 my-1" />
                <Button variant="ghost" size="icon" onClick={handleFlipHorizontal} title="좌우반전" className="w-9 h-9"><FlipHorizontal className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" onClick={handleCenterContent} title="가운데 정렬" className="w-9 h-9"><AlignCenter className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" onClick={handleCopy} title="복사 (Ctrl+C)" disabled={!selection || selection.w === 0} className="w-9 h-9"><Copy className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" onClick={handlePaste} title="붙여넣기 (Ctrl+V)" disabled={!clipboard} className="w-9 h-9"><Clipboard className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" onClick={enterTransformMode} title="Transform (Ctrl+T)" disabled={!selection || selection.w === 0} className="w-9 h-9 text-blue-500">
                  <span className="text-[9px] font-bold">T</span>
                </Button>
                <div className="h-px bg-slate-200 my-1" />
                <Button variant="ghost" size="icon" onClick={() => setState(s => ({ ...s, showGuide: !s.showGuide }))} title="가이드 켜기/끄기" className="w-9 h-9">
                  {state.showGuide ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={handleClearFrame} title="현재 프레임 초기화" className="w-9 h-9 text-red-500"><Trash2 className="w-4 h-4" /></Button>
              </div>
            </Card>

            {/* 색상 */}
            <Card className="p-2">
              <div className="space-y-1.5">
                <input type="color" value={state.brushColor}
                  onChange={e => setState(s => ({ ...s, brushColor: e.target.value }))}
                  className="w-full h-8 p-0 border-none rounded cursor-pointer" />
                <div className="grid grid-cols-4 gap-0.5">
                  {PRESET_COLORS.map(c => (
                    <button key={c}
                      className={`w-full aspect-square rounded-sm border transition-all ${state.brushColor === c ? 'border-blue-500 scale-110' : 'border-slate-200'}`}
                      style={{ backgroundColor: c }} onClick={() => setState(s => ({ ...s, brushColor: c }))} />
                  ))}
                </div>
              </div>
            </Card>

            {/* 브러시 크기 */}
            <Card className="p-2">
              <p className="text-[9px] font-bold uppercase text-slate-400 mb-1.5">브러시 크기</p>
              <div className="grid grid-cols-3 gap-1">
                {BRUSH_SIZES.map(sz => (
                  <button key={sz}
                    className={`text-[10px] font-bold py-1 rounded border transition-all ${state.brushSize === sz ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'}`}
                    onClick={() => setState(s => ({ ...s, brushSize: sz }))}>
                    {sz}px
                  </button>
                ))}
              </div>
              <div className="mt-2">
                <input type="range" min="1" max="32" value={state.brushSize}
                  onChange={e => setState(s => ({ ...s, brushSize: parseInt(e.target.value) }))}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                <p className="text-[9px] text-center text-slate-400 mt-0.5">{state.brushSize}px</p>
              </div>
            </Card>
          </div>

          {/* 메인 캔버스 */}
          <div className="lg:col-span-7 space-y-3">
            {state.itemType === 'room' && (
              <div className="flex gap-2 flex-wrap items-center">
                {ROOM_DIR_UI.map(dir => (
                  <Button key={dir.id} variant={state.roomDirection === dir.id ? 'default' : 'outline'}
                    size="sm" onClick={() => handleRoomDirectionChange(dir.id)} className="text-sm font-bold min-w-[64px]">
                    {dir.label}
                    {roomDirData[dir.id] && dir.id !== state.roomDirection && (
                      <span className="ml-1 w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                    )}
                  </Button>
                ))}
              </div>
            )}
            {state.itemType === 'avatar' && (
              <div className="flex gap-1 text-[10px] text-muted-foreground flex-wrap">
                {Array.from({ length: AVATAR_ROWS }).map((_, row) => (
                  <span key={row} className="bg-white px-2 py-0.5 rounded border">
                    행{row+1}: {AVATAR_ROW_LABELS[row]}
                  </span>
                ))}
                <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-200 font-medium">
                  선택: F{state.selectedFrame+1} ({AVATAR_ROW_LABELS[Math.floor(state.selectedFrame/AVATAR_FRAMES_PER_ROW)]}{(state.selectedFrame%AVATAR_FRAMES_PER_ROW)+1})
                </span>
              </div>
            )}

            <Card className="overflow-hidden bg-slate-300 border-none shadow-inner">
              <div ref={canvasWheelAreaRef} className="relative w-full min-h-[520px] overflow-hidden flex items-center justify-center"
                onWheel={handleCanvasWheel} onClick={e => e.stopPropagation()}>
                <div className="absolute top-2 right-2 z-40 bg-white/85 text-[10px] px-2 py-1 rounded shadow-sm text-slate-600">
                  {Math.round(editorZoom * 100)}% · Space+드래그
                </div>
                <div ref={canvasContainerRef} className="relative"
                  style={{ width: displayW, height: displayH, transform: `translate(${editorPan.x}px, ${editorPan.y}px) scale(${editorZoom})`, transformOrigin: 'center center', backgroundImage: 'linear-gradient(45deg,#ccc 25%,transparent 25%,transparent 75%,#ccc 75%,#ccc),linear-gradient(45deg,#ccc 25%,transparent 25%,transparent 75%,#ccc 75%,#ccc)', backgroundSize: '16px 16px', backgroundPosition: '0 0,8px 8px', backgroundColor: '#e5e5e5' }}>
                  {/* avatar body + eyelash + iris guide */}
                  {state.itemType === 'avatar' && (
                    <canvas ref={bodyGuideCanvasRef}
                      style={{ width: displayW, height: displayH, imageRendering: 'pixelated', opacity: state.showGuide ? state.guideOpacity : 0, position: 'absolute', inset: 0, zIndex: 5, pointerEvents: 'none' }} />
                  )}
                  {/* 합성 캔버스 (이벤트 수신) */}
                  <canvas ref={compositeCanvasRef}
                    style={{ width: displayW, height: displayH, imageRendering: 'pixelated', position: 'absolute', inset: 0, zIndex: 10, cursor: cursorStyle }}
                    onMouseDown={startAction} onMouseMove={doAction} onMouseUp={endAction} onMouseLeave={endAction} />
                  {/* 가이드: 숨김 상태에서도 canvas를 유지해야 다시 켰을 때 즉시 다시 그려집니다. */}
                  <canvas ref={guideCanvasRef}
                    style={{ width: displayW, height: displayH, imageRendering: 'pixelated', opacity: state.showGuide ? state.guideOpacity : 0, position: 'absolute', inset: 0, zIndex: 20, pointerEvents: 'none' }} />
                  {/* 선택 영역 */}
                  <canvas ref={selectionCanvasRef}
                    style={{ width: displayW, height: displayH, imageRendering: 'pixelated', position: 'absolute', inset: 0, zIndex: 30, pointerEvents: 'none' }} />
                  {/* Transform overlay */}
                  {transform.active && (
                    <canvas ref={transformCanvasRef}
                      style={{ width: displayW, height: displayH, imageRendering: 'pixelated', position: 'absolute', inset: 0, zIndex: 40, pointerEvents: 'none' }} />
                  )}
                </div>
              </div>
            </Card>

            {/* avatar 프레임 선택 바 */}
            {state.itemType === 'avatar' && (
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground">프레임 선택</p>
                <div className="grid grid-cols-8 gap-1">
                  {Array.from({ length: TOTAL_FRAMES }).map((_, i) => {
                    const row = Math.floor(i / AVATAR_FRAMES_PER_ROW); const col = i % AVATAR_FRAMES_PER_ROW;
                    return (
                      <button key={i} onClick={() => setState(s => ({ ...s, selectedFrame: i }))}
                        className={`h-10 rounded border-2 transition-all flex flex-col items-center justify-center text-[9px] font-bold leading-tight ${state.selectedFrame === i ? 'border-blue-500 bg-blue-50 text-blue-600 ring-2 ring-blue-200' : 'border-white bg-white/60 hover:border-blue-200 text-slate-500'}`}>
                        <span>{i+1}</span>
                        <span className="opacity-60">{AVATAR_ROW_LABELS[row]}{col+1}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* room sprite 프레임 선택 바 */}
            {state.itemType === 'room' && state.roomSprite.enabled && (
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground">스프라이트 프레임 선택</p>
                <div className="flex gap-1 flex-wrap">
                  {Array.from({ length: totalRoomFrames }).map((_, i) => (
                    <button key={i} onClick={() => handleRoomSpriteChange({ selectedFrame: i })}
                      className={`w-10 h-10 rounded border-2 text-[10px] font-bold transition-all ${state.roomSprite.selectedFrame === i ? 'border-amber-500 bg-amber-50 text-amber-700 ring-2 ring-amber-200' : 'border-white bg-white/60 hover:border-amber-200 text-slate-500'}`}>
                      F{i+1}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 우측 패널 */}
          <div className="lg:col-span-4 space-y-3">

            {/* 레이어 패널 */}
            <Card>
              <CardHeader className="py-2 px-4 flex flex-row items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-1"><Layers className="w-4 h-4" /> 레이어</CardTitle>
                <Button size="icon" variant="ghost" className="w-7 h-7" onClick={addLayer} title="레이어 추가"><Plus className="w-4 h-4" /></Button>
              </CardHeader>
              <CardContent className="p-2 space-y-1 max-h-56 overflow-y-auto">
                {[...layers].reverse().map((layer, revIdx) => {
                  const idx = layers.length - 1 - revIdx;
                  const isActive = layer.id === activeLayerId;
                  return (
                    <div key={layer.id}
                      className={`flex items-center gap-1.5 p-1.5 rounded-lg border cursor-pointer transition-all ${isActive ? 'bg-blue-50 border-blue-300' : 'bg-white border-slate-200 hover:border-slate-300'}`}
                      onClick={() => { setActiveLayerId(layer.id); activeLayerIdRef.current = layer.id; }}>
                      <button className="shrink-0" onClick={e => { e.stopPropagation(); updateLayer(layer.id, { visible: !layer.visible }); setTimeout(() => renderComposite(), 0); }}>
                        {layer.visible ? <Eye className="w-3.5 h-3.5 text-slate-500" /> : <EyeOff className="w-3.5 h-3.5 text-slate-300" />}
                      </button>
                      <input
                        className="flex-1 text-[11px] bg-transparent outline-none min-w-0 truncate"
                        value={layer.name}
                        onChange={e => { e.stopPropagation(); updateLayer(layer.id, { name: e.target.value }); }}
                        onClick={e => e.stopPropagation()} />
                      <input type="range" min="0" max="1" step="0.05" value={layer.opacity}
                        onChange={e => { updateLayer(layer.id, { opacity: parseFloat(e.target.value) }); setTimeout(() => renderComposite(), 0); }}
                        onClick={e => e.stopPropagation()}
                        className="w-12 h-1 accent-blue-500 shrink-0" title={`불투명도: ${Math.round(layer.opacity * 100)}%`} />
                      <span className="text-[9px] text-slate-400 w-6 shrink-0">{Math.round(layer.opacity * 100)}%</span>
                      <div className="flex flex-col shrink-0" onClick={e => e.stopPropagation()}>
                        <button onClick={() => { moveLayerUp(idx); setTimeout(() => renderComposite(), 0); }} className="hover:text-blue-500"><ChevronUp className="w-3 h-3" /></button>
                        <button onClick={() => { moveLayerDown(idx); setTimeout(() => renderComposite(), 0); }} className="hover:text-blue-500"><ChevronDown className="w-3 h-3" /></button>
                      </div>
                      <button onClick={e => { e.stopPropagation(); deleteLayer(layer.id); }} className="shrink-0">
                        <Trash2 className="w-3.5 h-3.5 text-slate-300 hover:text-red-400" />
                      </button>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* 아이템 설정 */}
            <Card>
              <CardHeader className="py-2 px-4"><CardTitle className="text-sm">아이템 설정</CardTitle></CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500">이름</label>
                  <input type="text" value={state.itemName}
                    onChange={e => setState(s => ({ ...s, itemName: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border rounded-md text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                    placeholder="아이템 이름 입력" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500">타입</label>
                  <div className="grid grid-cols-3 gap-1">
                    {(['avatar','room','badge'] as ItemType[]).map(t => (
                      <Button key={t} variant={state.itemType === t ? 'default' : 'outline'} size="sm" className="text-[10px] h-7"
                        onClick={() => setState(s => ({ ...s, itemType: t }))}>
                        {t === 'avatar' ? '아바타' : t === 'room' ? '가구' : '배지'}
                      </Button>
                    ))}
                  </div>
                </div>
                {state.itemType === 'avatar' && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-slate-500">부위</label>
                    <select value={state.itemSlot} onChange={e => setState(s => ({ ...s, itemSlot: e.target.value as AvatarSlot }))} className="w-full px-3 py-2 bg-slate-50 border rounded-md text-sm">
                      <option value="cape">망토</option><option value="hair">머리</option><option value="eyes">눈</option><option value="eyebrow">눈썹</option>
                      <option value="mouth">입</option><option value="face">얼굴</option><option value="top">상의</option>
                      <option value="bottom">하의</option><option value="shoes">신발</option><option value="hat">모자</option>
                      <option value="headAccessory">머리 장식</option><option value="accessory">장신구</option><option value="pet">펫</option>
                    </select>
                  </div>
                )}
                {state.itemType === 'avatar' && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-slate-500">가이드 투명도</label>
                    <div className="flex gap-1">
                      {GUIDE_OPACITY_OPTIONS.map(opt => (
                        <button key={String(opt.value)}
                          className={`flex-1 text-[9px] py-1 rounded border transition-all ${state.guideOpacity === opt.value ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'}`}
                          onClick={() => setState(s => ({ ...s, guideOpacity: opt.value, showGuide: opt.value > 0 }))}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-[9px] text-slate-400">body + eyelash + iris 가이드 (export 미포함)</p>
                  </div>
                )}
                {state.itemType === 'room' && !state.roomSprite.enabled && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-slate-500">캔버스 크기</label>
                    <div className="grid grid-cols-1 gap-1">
                      {(['160x160','320x160','480x160','640x160','320x320','480x480','640x640'] as RoomSize[]).map(size => (
                        <Button key={size} variant={state.roomSize === size ? 'default' : 'outline'} size="sm"
                          className={`text-xs h-8 w-full justify-start ${state.roomSize === size ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
                          onClick={() => handleRoomSizeChange(size)}>
                          {state.roomSize === size && <span className="mr-1.5 text-[10px]">✓</span>}
                          {size}
                          {size === '160x160' && <span className="ml-1 text-[9px] opacity-70">기본</span>}
                          {size === '320x160' && <span className="ml-1 text-[9px] opacity-70">가로형 2칸</span>}
                          {size === '480x160' && <span className="ml-1 text-[9px] opacity-70">가로형 3칸</span>}
                          {size === '640x160' && <span className="ml-1 text-[9px] opacity-70">가로형 4칸</span>}
                          {size === '320x320' && <span className="ml-1 text-[9px] opacity-70">대형 2×2</span>}
                          {size === '480x480' && <span className="ml-1 text-[9px] opacity-70">대형 3×3</span>}
                          {size === '640x640' && <span className="ml-1 text-[9px] opacity-70">대형 4×4</span>}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
                {state.itemType === 'room' && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase text-slate-500">가구 옵션</label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={state.roomSprite.enabled}
                        onChange={e => handleRoomSpriteChange({ enabled: e.target.checked })} className="rounded" />
                      스프라이트 시트 사용
                    </label>
                    {state.roomSprite.enabled && (
                      <div className="bg-amber-50 border border-amber-200 rounded p-2 space-y-2">
                        <div className="grid grid-cols-2 gap-1.5">
                          <div><label className="text-[9px] text-slate-500">Columns</label>
                            <input type="number" min="1" max="8" value={state.roomSprite.columns}
                              onChange={e => handleRoomSpriteChange({ columns: Math.max(1, parseInt(e.target.value) || 1) })}
                              className="w-full px-2 py-1 bg-white border rounded text-xs" /></div>
                          <div><label className="text-[9px] text-slate-500">Rows</label>
                            <input type="number" min="1" max="8" value={state.roomSprite.rows}
                              onChange={e => handleRoomSpriteChange({ rows: Math.max(1, parseInt(e.target.value) || 1) })}
                              className="w-full px-2 py-1 bg-white border rounded text-xs" /></div>
                          <div><label className="text-[9px] text-slate-500">Frame W</label>
                            <input type="number" min="32" max="512" step="32" value={state.roomSprite.frameWidth}
                              onChange={e => handleRoomSpriteChange({ frameWidth: Math.max(32, parseInt(e.target.value) || 160) })}
                              className="w-full px-2 py-1 bg-white border rounded text-xs" /></div>
                          <div><label className="text-[9px] text-slate-500">Frame H</label>
                            <input type="number" min="32" max="512" step="32" value={state.roomSprite.frameHeight}
                              onChange={e => handleRoomSpriteChange({ frameHeight: Math.max(32, parseInt(e.target.value) || 160) })}
                              className="w-full px-2 py-1 bg-white border rounded text-xs" /></div>
                        </div>
                        <p className="text-[9px] text-amber-600">총 {totalRoomFrames}프레임 · {state.roomSprite.columns * state.roomSprite.frameWidth}x{state.roomSprite.rows * state.roomSprite.frameHeight}px</p>
                      </div>
                    )}
                  </div>
                )}
                <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-[10px] font-bold uppercase text-slate-500">교육과정 분류</label>
                    <select value={state.curriculumMode}
                      onChange={e => setState(s => ({ ...s, curriculumMode: e.target.value as CurriculumMode }))}
                      className="px-2 py-1 bg-white border rounded-md text-xs">
                      <option value="general">공통</option>
                      <option value="curriculum">학년/학기/과목/단원</option>
                    </select>
                  </div>
                  {state.curriculumMode === 'general' ? (
                    <p className="text-[10px] text-slate-500 leading-relaxed">특정 학년·단원에 속하지 않는 공통 아이템으로 저장됩니다.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[9px] text-slate-500">학년</label>
                        <select value={state.curriculumGrade}
                          onChange={e => setState(s => ({ ...s, curriculumGrade: e.target.value, curriculumSubject: '', curriculumUnit: '' }))}
                          className="w-full px-2 py-1.5 bg-white border rounded-md text-xs">
                          <option value="">전체/미지정</option>
                          {REWARD_GRADE_OPTIONS.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] text-slate-500">학기</label>
                        <select value={state.curriculumSemester}
                          onChange={e => setState(s => ({ ...s, curriculumSemester: e.target.value, curriculumUnit: '' }))}
                          className="w-full px-2 py-1.5 bg-white border rounded-md text-xs">
                          <option value="">전체/미지정</option>
                          {REWARD_SEMESTER_OPTIONS.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] text-slate-500">과목</label>
                        <select value={state.curriculumSubject}
                          onChange={e => setState(s => ({ ...s, curriculumSubject: e.target.value, curriculumUnit: '' }))}
                          className="w-full px-2 py-1.5 bg-white border rounded-md text-xs">
                          <option value="">전체/미지정</option>
                          {curriculumSubjects.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] text-slate-500">단원</label>
                        <select value={state.curriculumUnit}
                          disabled={!canSelectCurriculumUnit}
                          onChange={e => setState(s => ({ ...s, curriculumUnit: e.target.value }))}
                          className={`w-full px-2 py-1.5 border rounded-md text-xs ${canSelectCurriculumUnit ? 'bg-white' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
                          <option value="">{canSelectCurriculumUnit ? '전체/미지정' : '학년/학기/과목 선택 후 선택'}</option>
                          {canSelectCurriculumUnit && curriculumUnits.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                        </select>
                      </div>
                    </div>
                  )}
                  <p className="text-[9px] text-slate-400 leading-relaxed">단원 목록은 lib/reward-categories.ts의 REWARD_UNIT_CATEGORIES에 한 줄씩 추가합니다.</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500">희귀도</label>
                  <select value={state.rarity} onChange={e => setState(s => ({ ...s, rarity: e.target.value as Rarity }))} className="w-full px-3 py-2 bg-slate-50 border rounded-md text-sm">
                    <option value="common">일반 (Common)</option><option value="rare">희귀 (Rare)</option>
                    <option value="epic">에픽 (Epic)</option><option value="legendary">전설 (Legendary)</option>
                  </select>
                </div>
              </CardContent>
            </Card>

            {/* 미리보기 */}
            <Card className="bg-slate-900 text-white">
              <CardHeader className="py-2 px-4 border-b border-white/10">
                <CardTitle className="text-xs font-bold uppercase tracking-wider opacity-60">미리보기</CardTitle>
              </CardHeader>
              <CardContent className="p-4 flex flex-col items-center gap-3">
                <div className="w-32 h-32 rounded-lg overflow-hidden border border-white/10"
                  style={{ backgroundImage: 'linear-gradient(45deg,#333 25%,transparent 25%,transparent 75%,#333 75%,#333),linear-gradient(45deg,#333 25%,transparent 25%,transparent 75%,#333 75%,#333)', backgroundSize: '8px 8px', backgroundPosition: '0 0,4px 4px', backgroundColor: '#222' }}>
                  <canvas ref={previewCanvasRef} style={{ width: 128, height: 128, imageRendering: 'pixelated' }} />
                </div>
                <div className="text-center space-y-0.5">
                  <p className="text-[10px] opacity-50">
                    {state.itemType === 'avatar' ? `F${state.selectedFrame+1} (${AVATAR_ROW_LABELS[Math.floor(state.selectedFrame/AVATAR_FRAMES_PER_ROW)]}) · 첫 프레임=아이콘` : state.itemType === 'room' ? state.roomSprite.enabled ? `스프라이트 F${state.roomSprite.selectedFrame+1}` : `${ROOM_DIR_UI.find(d => d.id === state.roomDirection)?.arrow} · ${state.roomSize}` : '배지 160x160'}
                  </p>
                  {state.itemName && <p className="text-xs font-medium text-white/80">{state.itemName}</p>}
                  <p className="text-[9px] opacity-40">{layers.filter(l => l.visible).length}/{layers.length} 레이어</p>
                </div>
              </CardContent>
            </Card>

            {/* 단축키 안내 */}
            <Card className="bg-slate-50 border-slate-200">
              <CardContent className="p-3 text-[10px] text-slate-600 space-y-0.5">
                <p className="font-bold text-slate-700">단축키</p>
                <p>Ctrl+T: Transform 모드</p>
                <p>Ctrl+C/V: 복사/붙여넣기</p>
                <p>Ctrl+Z/Y: 실행 취소/다시</p>
                <p>Space+드래그: 캔버스 이동</p>
                <p>휠: 확대/축소</p>
                <p className="font-bold text-slate-700 pt-1">레이어</p>
                <p>+ 버튼: 레이어 추가</p>
                <p>눈 아이콘: 표시/숨김</p>
                <p>슬라이더: 불투명도</p>
                <p>▲▼: 순서 변경</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function ItemEditorPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">로딩 중...</div>}>
      <ItemEditorContent />
    </Suspense>
  );
}
