# 방 꾸미기 및 캐릭터 이동 시스템 구현 가이드

## 📋 개요

이 문서는 방 꾸미기, 그리드 배치, 캐릭터 이동 시스템의 구현 상태와 향후 확장 방법을 설명합니다.

---

## ✅ 구현 완료 사항

### 1. 데이터 타입 확장 (`lib/types.ts`)

#### 새로운 타입들:
- **`PlacedRoomItem`**: 방에 배치된 아이템의 위치, 방향, z-index 정보
- **`RoomPlayerPosition`**: 플레이어의 위치, 방향, 이동 상태
- **`RoomDirection`**: 'front' | 'back' | 'left' | 'right'

#### 확장된 타입들:
- **`Item`**: 
  - `directionImages`: 방향별 이미지 (front, back, left, right)
  - `avatarLayers`: 아바타 애니메이션 파츠 (idle, walk, armLeft, armRight, legLeft, legRight)
  - `stackable`: 중복 배치 가능 여부

- **`RoomState`**:
  - `placedItems`: 그리드 기반 배치 아이템 배열 (새로 추가)
  - 기존 `equipped` 필드는 유지 (슬롯 기반)

- **`AvatarState`**:
  - `baseParts`: 기본 신체 파츠 (body, head, leftArm, rightArm, leftLeg, rightLeg)
  - `animationState`: 'idle' | 'walk'
  - `facing`: 방향 정보

### 2. 유틸리티 함수 (`lib/item-utils.ts`)

```typescript
// 이미지 조회
getItemDisplayImage(item: Item): string
getDirectionalImage(item: Item, direction: RoomDirection): string
getAvatarLayerImage(item: Item, layerType: string): string | null

// 이미지 렌더링
isImageUrl(image: string): boolean
getImageRenderClass(image: string): string

// 마이그레이션
migrateItemData(item: any): Item
migrateRoomStateData(roomState: any): RoomState
migrateAvatarStateData(avatarState: any): AvatarState

// 경로 헬퍼 (나중에 실제 PNG로 교체)
getAvatarBasePath(part: string, direction: RoomDirection): string
getAvatarClothingPath(type: string, id: string, direction: RoomDirection): string
getRoomItemPath(category: string, id: string, direction: RoomDirection): string
getAvatarAnimationPath(animation: string, part: string, frame: number): string
```

### 3. 컴포넌트

#### `components/avatar/AvatarRenderer.tsx`
- 17단계 레이어 구조로 아바타 렌더링
- 방향별 좌우 반전 지원
- 애니메이션 상태 표시 (DEBUG용)
- TODO 주석으로 실제 PNG 파츠 교체 위치 표시

#### `components/room/MobileDPad.tsx`
- 모바일/태블릿용 원형 D-Pad
- 4방향 버튼 (위, 아래, 왼쪽, 오른쪽)
- 터치 및 마우스 이벤트 지원
- 간단한 버튼식 D-Pad 대안 제공

#### `components/room/RoomPlayer.tsx`
- 방 안에 플레이어 아바타 렌더링
- 위치 및 방향 반영
- 플레이어 이름 표시
- TODO: 나중에 다른 학생 캐릭터 표시

### 4. 훅

#### `hooks/useRoomMovement.ts`
- WASD 키 입력 처리
- 부드러운 픽셀 기반 이동 또는 그리드 스냅
- 방 경계 제한 (clamp)
- 이동 방향에 따른 facing 자동 업데이트
- 애니메이션 루프 (requestAnimationFrame)

### 5. 페이지

#### `/student/room`
- **편집 모드**: 아이템 배치, 방향 변경, 제거
  - 그리드 표시
  - 아이템 선택 및 조작
  - 방향 변경 버튼
  - 저장 기능

- **플레이 모드**: 캐릭터 이동
  - WASD 키 입력
  - 모바일 D-Pad (자동 감지)
  - 실시간 캐릭터 렌더링
  - 방 아이템 표시

---

## 🎨 이미지 및 PNG 파츠 추가 방법

### 방 꾸미기 아이템 이미지

#### 현재 상태
- Base64 또는 URL 기반 이미지 지원
- 방향별 이미지 자동 선택 (directionImages)
- 없으면 이모지 폴백

#### PNG 추가 방법

1. **아이템 생성 시 이미지 URL 지정**:
```typescript
const roomItem: Item = {
  id: 'desk-001',
  name: '나무 책상',
  type: 'room',
  icon: '🪑',
  imageUrl: '/assets/room/furniture/desk_001_front.png',
  directionImages: {
    front: '/assets/room/furniture/desk_001_front.png',
    back: '/assets/room/furniture/desk_001_back.png',
    left: '/assets/room/furniture/desk_001_left.png',
    right: '/assets/room/furniture/desk_001_right.png',
  },
};
```

2. **파일 구조 예시**:
```
public/
├── assets/
│   ├── room/
│   │   ├── furniture/
│   │   │   ├── desk_001_front.png
│   │   │   ├── desk_001_back.png
│   │   │   ├── desk_001_left.png
│   │   │   └── desk_001_right.png
│   │   ├── decoration/
│   │   │   └── ...
│   │   └── background/
│   │       └── ...
│   └── avatar/
│       ├── base/
│       │   ├── body_front.png
│       │   ├── body_left.png
│       │   ├── body_right.png
│       │   └── ...
│       ├── clothes/
│       │   ├── top_001_front.png
│       │   └── ...
│       ├── hair/
│       │   └── ...
│       └── animations/
│           ├── walk_left_leg_01.png
│           └── ...
```

### 아바타 파츠 이미지

#### 현재 상태
- 17단계 레이어 구조
- Placeholder 색상 및 이모지 표시
- 방향별 좌우 반전 (CSS scaleX)

#### PNG 추가 방법

1. **기본 파츠 (신체)**:
```typescript
// AvatarRenderer.tsx에서 TODO 주석 찾기
// /assets/avatar/base/{layer}_{facing}.png로 교체

// 예: body_front.png, body_left.png, head_front.png 등
```

2. **의류/액세서리**:
```typescript
// Item의 imageUrl 또는 directionImages 사용
// /assets/avatar/clothes/top_001_front.png 등
```

3. **애니메이션 프레임**:
```typescript
// Item.avatarLayers 사용
avatarLayers: {
  idle: '/assets/avatar/animations/idle_01.png',
  walk: '/assets/avatar/animations/walk_01.png',
  armLeft: '/assets/avatar/animations/arm_left_walk_01.png',
  // ...
}
```

---

## 🎮 사용 방법

### PC (크롬북 포함)
- **WASD 키**: 캐릭터 이동
- **화살표 키**: 캐릭터 이동 (대안)
- **편집 모드**: 마우스로 아이템 선택 및 조작

### 모바일/태블릿
- **D-Pad 버튼**: 캐릭터 이동 (좌하단)
- **터치**: 아이템 배치 및 조작

---

## 🔧 향후 확장 계획

### 즉시 가능
- [ ] 실제 PNG 파츠 이미지 추가
- [ ] 아이템 이미지 업로드 UI 개선
- [ ] 방 배경 이미지 추가

### 단기 (1-2주)
- [ ] 자유 드래그 배치 (현재: 그리드 스냅)
- [ ] 충돌 감지 (아이템/벽 충돌)
- [ ] 다른 학생 캐릭터 표시
- [ ] 아바타 걷기 애니메이션

### 중기 (1개월)
- [ ] 채팅 기능 (방 안에서)
- [ ] 아이템 거래 시스템
- [ ] 방 꾸미기 공유 기능
- [ ] 실시간 협력 플레이

### 장기 (DB 연결 후)
- [ ] 서버 기반 위치 동기화
- [ ] 멀티플레이어 상호작용
- [ ] 고급 물리 엔진
- [ ] 모바일 앱 (React Native)

---

## 📁 파일 목록

### 추가/수정된 파일

| 파일 | 변경사항 |
|------|--------|
| `lib/types.ts` | PlacedRoomItem, RoomPlayerPosition, RoomDirection 추가 |
| `lib/item-utils.ts` | NEW - 아이템 이미지 유틸리티 |
| `lib/class-storage.ts` | updateRoomState 함수 추가 |
| `components/avatar/AvatarRenderer.tsx` | 17단계 레이어, 방향 지원 추가 |
| `components/room/MobileDPad.tsx` | NEW - 모바일 D-Pad |
| `components/room/RoomPlayer.tsx` | NEW - 플레이어 렌더링 |
| `hooks/useRoomMovement.ts` | NEW - 이동 로직 |
| `app/student/room/page.tsx` | 완전 재구현 - 그리드 배치 + 캐릭터 이동 |
| `app/student/inventory/page.tsx` | 방 꾸미기 링크 추가 |

---

## 🐛 알려진 제한사항

1. **그리드 스냅만 지원**: 자유 드래그 배치는 아직 미구현
2. **충돌 감지 없음**: 아이템/벽 통과 가능
3. **애니메이션 없음**: 걷기 애니메이션은 구조만 준비됨
4. **싱글플레이어**: 다른 학생 캐릭터 표시 미구현
5. **로컬 저장소**: DB 연결 전까지 localStorage 사용

---

## 💡 개발 팁

### 디버그 모드
- AvatarRenderer에 `showAnimation` prop 추가하면 애니메이션 상태 표시
- 방 페이지에서 편집 모드로 전환하면 그리드 표시

### 성능 최적화
- 큰 이미지는 WebP 포맷 사용 권장
- 아이템 개수가 많으면 가상 스크롤 고려
- 애니메이션은 CSS 또는 Canvas 사용 권장

### 테스트 데이터
```typescript
// localStorage에 직접 주입하여 테스트
const testRoom: RoomState = {
  equipped: {},
  placedItems: [
    {
      inventoryItemId: 'item-1',
      itemId: 'desk-001',
      x: 0,
      y: 0,
      zIndex: 1,
      direction: 'front',
    }
  ]
};
```

---

## 📞 문의 및 피드백

- 이미지 경로 관련: `lib/item-utils.ts`의 경로 헬퍼 함수 참조
- PNG 파츠 추가: 해당 컴포넌트의 TODO 주석 찾기
- 기능 확장: 각 파일의 TODO 주석 참조

---

## 🎯 다음 단계

1. **실제 PNG 파츠 준비**
   - 아바타 기본 파츠 (body, head, arms, legs)
   - 방 꾸미기 아이템 (책상, 의자, 침대 등)
   - 방향별 이미지 (front, back, left, right)

2. **이미지 업로드 및 통합**
   - `public/assets/` 디렉토리에 PNG 파일 배치
   - Item 데이터에 imageUrl 및 directionImages 설정

3. **테스트 및 최적화**
   - 모바일 환경에서 D-Pad 테스트
   - PC에서 WASD 이동 테스트
   - 그리드 배치 및 방향 전환 테스트

4. **배포 및 모니터링**
   - Vercel/Netlify 배포
   - 사용자 피드백 수집
   - 성능 모니터링

---

**마지막 업데이트**: 2024년 4월 28일
**상태**: 구조 구현 완료, PNG 파츠 대기 중
