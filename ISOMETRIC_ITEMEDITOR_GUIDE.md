# 아이소메트릭 방 및 아이템 제작 도구 구현 가이드

## 📋 개요

이 문서는 아이소메트릭 방 시스템과 교사용 아이템 제작 도구의 구현 내용을 설명합니다.

---

## 🎮 1. 아이소메트릭 방 시스템

### 1.1 좌표 변환 원리

**그리드 좌표 → 아이소메트릭 화면 좌표 변환:**

```
x' = (gridX - gridY) * (tileWidth / 2)
y' = (gridX + gridY) * (tileHeight / 2)
```

**상수:**
- `ISO_TILE_WIDTH = 64px`
- `ISO_TILE_HEIGHT = 32px`

**파일:** `lib/isometric.ts`

```typescript
import { gridToIso, isoToGrid, getIsoZIndex } from '@/lib/isometric';

// 그리드 좌표 (3, 2)를 화면 좌표로 변환
const screenPos = gridToIso(3, 2); // { x: 32, y: 160 }

// z-index 계산 (뒤쪽 객체부터 렌더링)
const zIndex = getIsoZIndex(3, 2); // 5
```

### 1.2 렌더링 순서 (Z-Index)

아이소메트릭 뷰에서는 **뒤쪽 객체가 먼저 렌더링**되어야 앞쪽 객체가 자연스럽게 보입니다.

```typescript
// z-index = gridX + gridY
// (0,0) → z=0 (맨 뒤)
// (5,5) → z=10 (맨 앞)
```

### 1.3 페이지 구조

**경로:** `/student/room`

**구성:**
- `IsometricRoom` 컴포넌트: 아이소메트릭 렌더링
- `useRoomMovement` 훅: WASD/모바일 D-Pad 이동
- `RoomPlayer` 컴포넌트: 캐릭터 표시

**기능:**
- ✅ WASD 키보드 이동
- ✅ 모바일 D-Pad 이동
- ✅ 방향 자동 변경
- ✅ 가구 배치 (고정 슬롯)
- ✅ 자연스러운 겹침 (z-index 기반)

### 1.4 방 구조

**크기:** 10x8 그리드 (가로x세로)

**가구 배치 슬롯:**
- `background`: 배경 (벽)
- `floor`: 바닥
- `furniture1~5`: 가구 5개

**TODO:**
- [ ] PNG 배경 이미지 추가
- [ ] 자유 배치 모드 (드래그)
- [ ] 충돌 처리

---

## 🎨 2. 아이템 제작 도구

### 2.1 페이지 위치

**경로:** `/teacher/item-editor`

**접근:** 교사 대시보드 → "아이템 제작 도구" (추가 필요)

### 2.2 기능

#### A. 아이템 타입 선택

| 타입 | 규격 | 설명 |
|------|------|------|
| **avatar** | 160x160, 4x4 (16 프레임) | 아바타 파츠 (머리, 눈, 옷 등) |
| **room** | 160x160, 4x4 (16 프레임) | 방 가구 |
| **badge** | 단일 이미지 | 배지 (정사각형) |

#### B. 캔버스 편집

**640x640 캔버스:**
- 160x160 프레임 16개 (4x4 배열)
- 선택된 프레임은 빨간 테두리로 강조
- **선택된 프레임 내부에서만 그리기 가능** (clipping)

**브러시:**
- 색상 선택 (컬러피커)
- 크기 조절 (1~20px)
- 지우개 (흰색으로 칠하기)

#### C. 프레임 관리

```typescript
// 16개 프레임 (0~15)
// 행: 0-3 (상하 이동)
// 열: 0-3 (좌우 이동)

const frameRow = Math.floor(frameIndex / 4);
const frameCol = frameIndex % 4;
const frameX = frameCol * 160;
const frameY = frameRow * 160;
```

**기능:**
- ✅ 프레임 선택 (1~16 버튼)
- ✅ 프레임 초기화 (흰색으로 채우기)
- ✅ 프레임 내부만 그리기 (자동 clipping)

**TODO:**
- [ ] 복사/붙여넣기
- [ ] 좌우반전
- [ ] 가운데 정렬

#### D. 아이템 정보

```typescript
interface ItemMetadata {
  name: string;           // 아이템 이름
  type: 'avatar' | 'room' | 'badge';
  slot?: AvatarSlot;      // avatar만 필요
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  spriteSheet: string;    // Base64 PNG (640x640)
  icon: string;           // Base64 PNG (대표 이미지)
  createdAt: string;      // ISO 날짜
}
```

### 2.3 내보내기 (Export)

**버튼:** "내보내기"

**동작:**
1. 캔버스를 PNG로 변환 (Base64)
2. 메타데이터와 함께 JSON 생성
3. `{itemName}.json` 다운로드

**JSON 구조:**
```json
{
  "name": "파란 머리",
  "type": "avatar",
  "slot": "hair",
  "rarity": "rare",
  "spriteSheet": "data:image/png;base64,...",
  "icon": "data:image/png;base64,...",
  "createdAt": "2024-01-15T10:30:00Z"
}
```

### 2.4 가져오기 (Import)

**TODO:** 구현 예정

**기능:**
- JSON 파일 선택
- 메타데이터 검증
- 미리보기 표시
- 새로운 ID로 저장

---

## 🖼️ 3. 이미지 추가 방법

### 3.1 아이소메트릭 방 배경

**경로:** `/public/assets/room/base/`

**파일:**
- `background.png`: 방 배경 (아이소메트릭)
- `floor.png`: 바닥 (아이소메트릭)

**규격:** 권장 1024x1024 이상

**사용 코드:**
```typescript
// IsometricRoom.tsx에 추가
<img
  src="/assets/room/base/background.png"
  alt="room background"
  style={{
    position: 'absolute',
    left: 0,
    top: 0,
    width: '100%',
    height: '100%',
    zIndex: -1,
  }}
/>
```

### 3.2 가구 이미지

**경로:** `/public/assets/room/furniture/`

**파일 명명:**
```
{furnitureName}.png          // 단일 방향
{furnitureName}_front.png    // 정면
{furnitureName}_left.png     // 좌측
{furnitureName}_right.png    // 우측
{furnitureName}_back.png     // 후면
```

**규격:** 160x160 (아이소메트릭 타일 크기)

### 3.3 아바타 기본 파츠

**경로:** `/public/assets/avatar/base/`

**파일:**
- `body.png`: 신체 (640x640, 4x4 스프라이트)
- `hair_default.png`: 기본 머리 (640x640)
- `eye.png`: 눈 (640x640)
- `eyebrow.png`: 눈썹 (640x640)
- `mouth.png`: 입 (640x640)

**규격:** 모두 640x640, 4x4 배열 (각 프레임 160x160)

---

## 🔧 4. 데이터 구조

### 4.1 PlacedRoomItem

```typescript
interface PlacedRoomItem {
  itemId: string;        // 아이템 고유 ID
  gridX: number;         // 그리드 X 좌표
  gridY: number;         // 그리드 Y 좌표
  slot: string;          // 슬롯 이름 (background, floor, furniture1 등)
  
  // TODO: 자유 배치 확장
  // x?: number;          // 픽셀 X 좌표
  // y?: number;          // 픽셀 Y 좌표
  // zIndex?: number;     // 수동 z-index
}
```

### 4.2 Item (확장)

```typescript
interface Item {
  id: string;
  name: string;
  type: 'avatar' | 'room' | 'badge' | 'decoration' | 'etc';
  slot?: AvatarSlot;
  
  // 이미지
  icon?: string;              // 이모지 또는 이미지 URL
  imageUrl?: string;          // Base64 또는 URL
  spriteSheetUrl?: string;    // 스프라이트 시트 URL
  directionImages?: {         // 방향별 이미지 (room용)
    front?: string;
    left?: string;
    right?: string;
    back?: string;
  };
  
  // 메타데이터
  rarity?: 'common' | 'rare' | 'epic' | 'legendary';
  stackable?: boolean;
  description?: string;
  
  // 시스템
  obtainedAt?: string;
  obtainedFrom?: string;      // 'quiz-{quizId}' 등
}
```

---

## 📂 5. 파일 구조

```
project_analysis/
├── lib/
│   ├── isometric.ts              # 아이소메트릭 유틸리티
│   ├── types.ts                  # 타입 정의 (확장)
│   └── class-storage.ts          # localStorage 함수
├── components/
│   ├── room/
│   │   ├── IsometricRoom.tsx     # 아이소메트릭 렌더러
│   │   ├── RoomPlayer.tsx        # 캐릭터 표시
│   │   └── MobileDPad.tsx        # 모바일 조이스틱
│   └── avatar/
│       └── AvatarRenderer.tsx    # 스프라이트 렌더러
├── hooks/
│   └── useRoomMovement.ts        # WASD/모바일 이동 훅
├── app/
│   ├── student/
│   │   └── room/
│   │       └── page.tsx          # 방 꾸미기 페이지
│   └── teacher/
│       └── item-editor/
│           └── page.tsx          # 아이템 제작 도구
└── public/
    └── assets/
        ├── avatar/
        │   └── base/             # 기본 아바타 파츠
        └── room/
            ├── base/             # 방 배경
            └── furniture/        # 가구 이미지
```

---

## 🚀 6. 사용 흐름

### 학생 입장

1. **학생 대시보드** → "내 방 가기"
2. **방 꾸미기 페이지** (`/student/room`)
   - 아이소메트릭 뷰로 방 확인
   - WASD 또는 D-Pad로 이동
   - 인벤토리에서 가구 배치
3. **아바타 커스터마이징** (`/student/avatar`)
   - 피부색, 눈 색상 선택
   - 아이템 장착

### 교사 입장

1. **교사 대시보드** → "아이템 제작 도구" (추가 필요)
2. **아이템 제작 도구** (`/teacher/item-editor`)
   - 아이템 타입 선택
   - 캔버스에서 도트 그리기
   - 프레임별로 작업
   - 내보내기 (JSON)
3. **아이템 추가**
   - JSON 가져오기 (TODO)
   - 또는 직접 localStorage에 저장

---

## ⚙️ 7. 구현 상태

### ✅ 완료

- [x] 아이소메트릭 좌표 변환 유틸리티
- [x] IsometricRoom 컴포넌트
- [x] 방 이동 시스템 (WASD + D-Pad)
- [x] 가구 배치 (고정 슬롯)
- [x] 자연스러운 z-index 정렬
- [x] 아이템 제작 도구 (기본)
- [x] 캔버스 편집 (브러시, 색상)
- [x] 프레임 선택 및 제한
- [x] 내보내기 (JSON)

### 🔄 진행 중

- [ ] 교사 대시보드에 "아이템 제작 도구" 링크 추가
- [ ] 가져오기 (Import) 기능
- [ ] 프레임 복사/붙여넣기
- [ ] 좌우반전 기능

### 📋 TODO

- [ ] PNG 배경 이미지 추가
- [ ] 자유 배치 모드 (드래그)
- [ ] 충돌 처리
- [ ] 아이템 공유 게시판 (서버)
- [ ] Supabase Storage 연동
- [ ] 모바일 터치 최적화

---

## 🐛 알려진 문제

1. **아이소메트릭 카메라**: 현재 고정 오프셋 사용, 스크롤 미지원
2. **가구 이미지**: 방향별 이미지 없으면 좌우반전 미지원
3. **프레임 편집**: 실행 취소(Undo) 미지원

---

## 📝 참고

### 아이소메트릭 좌표 변환 공식

```
그리드 → 화면:
x' = (x - y) * tileW / 2
y' = (x + y) * tileH / 2

화면 → 그리드 (역변환):
x = (x' / (tileW/2) + y' / (tileH/2)) / 2
y = (y' / (tileH/2) - x' / (tileW/2)) / 2
```

### Z-Index 정렬

```
z-index = gridX + gridY

예시:
(0,0) → z=0   (맨 뒤)
(1,0) → z=1
(0,1) → z=1
(1,1) → z=2
(5,5) → z=10  (맨 앞)
```

---

**마지막 업데이트:** 2024년
**버전:** 1.0
