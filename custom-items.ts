/**
 * 기본 아바타 애셋 상수
 * 
 * 스프라이트 시트 규격:
 * - 프레임 크기: 200x200px
 * - 가로: 4프레임
 * - 세로: 5행 (이동 4방향 + idle)
 * - 전체 크기: 800x1000px
 * 
 * 행 순서:
 * 0: front/down (아래로 이동)
 * 1: left (왼쪽 이동)
 * 2: right (오른쪽 이동)
 * 3: back/up (위로 이동)
 * 4: idle (정지)
 */

export const SPRITE_CONFIG = {
  FRAME_SIZE: 200,
  FRAMES_PER_ROW: 4,
  ROWS: 5,
  IDLE_ROW: 4,
  TOTAL_WIDTH: 800,
  TOTAL_HEIGHT: 1000,
  // 기존 코드 호환용: 정사각형 시트만 쓰던 부분에서 참조할 수 있습니다.
  TOTAL_SIZE: 800,
  ANIMATION_SPEED: 200, // ms per frame (기존 120ms 대비 약 0.6배 프레임 레이트)
} as const;

export const DIRECTION_MAP = {
  front: 0,
  left: 1,
  right: 2,
  back: 3,
} as const;

export const DEFAULT_AVATAR_ASSETS = {
  body: '/assets/avatar/base/body.png',
  hair: '/assets/avatar/base/hair_default.png',
  commonHairShortUnderColor: '/assets/avatar/base/CommonShortHair_under_shadow.png',
  commonHairShortUnderShadow: '/assets/avatar/base/CommonShortHair_under_shadow.png',
  commonHairShortUpperColor: '/assets/avatar/base/CommonShortHair_upper_shadow.png',
  commonHairShortUpperShadow: '/assets/avatar/base/CommonShortHair_upper_shadow.png',
  // 구버전 호환용: 새 숏컷은 outline 없이 upper/down shadow를 color mask로도 사용합니다.
  commonHairShortColor: '/assets/avatar/base/CommonShortHair_under_shadow.png',
  commonHairShortShadow: '/assets/avatar/base/CommonShortHair_under_shadow.png',
  commonHairShortOutline: '',
  commonBobcutColor: '/assets/avatar/base/Commonbobcut_color.png',
  commonBobcutShadow: '/assets/avatar/base/Commonbobcut_shadow.png',
  commonBobcutOutline: '/assets/avatar/base/Commonbobcut_outline.png',
  commonBobcutUnderColor: '/assets/avatar/base/CommonBob_under_Color.png',
  commonBobcutUnderShadow: '/assets/avatar/base/CommonBob_under_Shadow.png',
  commonBobcutUnderOutline: '/assets/avatar/base/CommonBob_under_Outline.png',
  commonBobcutUpperColor: '/assets/avatar/base/CommonBob_upper_Color.png',
  commonBobcutUpperShadow: '/assets/avatar/base/CommonBob_upper_shadow.png',
  commonBobcutUpperOutline: '/assets/avatar/base/CommonBob_upper_outline.png',
  eye: '/assets/avatar/base/eye.png',
  eyeBase: '/assets/avatar/base/eyelash.png',
  eyelash: '/assets/avatar/base/eyelash.png',
  eyeIris: '/assets/avatar/base/eye_iris.png',
  eyebrow: '/assets/avatar/base/eyebrow.png',
  mouth: '/assets/avatar/base/mouth.png',
} as const;

export const DEFAULT_AVATAR_COLORS = {
  skinColor: '#E8B9A0', // 기본 피부색
  eyeColor: '#6B4423', // 기본 눈 색상
  hairColor: '#3A2A22', // 기본 머리색
} as const;

/**
 * 스프라이트 시트에서 프레임 위치 계산
 * @param direction - 방향 (front, left, right, back)
 * @param frame - 프레임 번호 (0-3)
 * @returns { x, y } 픽셀 좌표
 */
export function getFramePosition(
  direction: 'front' | 'left' | 'right' | 'back',
  frame: number
) {
  const directionRow = DIRECTION_MAP[direction];
  const x = (frame % SPRITE_CONFIG.FRAMES_PER_ROW) * SPRITE_CONFIG.FRAME_SIZE;
  const y = directionRow * SPRITE_CONFIG.FRAME_SIZE;
  return { x, y };
}

/**
 * 현재 방향과 애니메이션 상태에 따른 프레임 계산
 * @param direction - 방향
 * @param isMoving - 이동 중 여부
 * @param animationFrame - 애니메이션 프레임 인덱스 (0-3)
 * @returns 스프라이트 시트 프레임 번호
 */
export function getAnimationFrame(
  direction: 'front' | 'left' | 'right' | 'back',
  isMoving: boolean,
  animationFrame: number
): { x: number; y: number } {
  if (!isMoving) {
    // 새 베이스 시트에서는 정지 상태가 5번째 행에 별도로 있습니다.
    const idleFrame = animationFrame % SPRITE_CONFIG.FRAMES_PER_ROW;
    return {
      x: idleFrame * SPRITE_CONFIG.FRAME_SIZE,
      y: SPRITE_CONFIG.IDLE_ROW * SPRITE_CONFIG.FRAME_SIZE,
    };
  }

  // 이동 중: 해당 방향 행의 4프레임 반복
  const movingFrame = animationFrame % SPRITE_CONFIG.FRAMES_PER_ROW;
  return getFramePosition(direction, movingFrame);
}

/**
 * 눈 색상 tint 적용 안내
 *
 * 현재 기본 눈 아이템은 다음 두 레이어로 동작합니다.
 * - eyeBase: 흰자/속눈썹/아웃라인
 * - eyeIris: 눈동자 tint 전용 마스크
 *
 * 앞으로 eye 아이템을 추가할 때도 하나의 Item 안에서
 * imageUrl(기본 레이어) + tintMaskUrl(iris 레이어) 구조를 사용하면
 * 눈동자만 색을 바꾸고 나머지는 그대로 유지할 수 있습니다.
 */
export const EYE_TINT_WARNING = `
  eye item은 하나의 아이템으로 동작하지만
  내부적으로는 base layer + iris tint mask 2개 레이어를 사용합니다.
`;

/**
 * 레이어 렌더링 순서 (z-index)
 * 아바타를 구성하는 각 파츠의 렌더링 순서
 */
export const AVATAR_LAYER_ORDER = {
  cape: 1,
  body: 10,
  mouth: 20,
  eyebrow: 30,
  eye: 40,
  hair: 50,
  face: 60,
  clothing: 70,
  accessory: 80,
  pet: 90,
} as const;

/**
 * 아바타 커스터마이징 옵션
 */
export const AVATAR_CUSTOMIZATION_OPTIONS = {
  skinColors: [
    '#E8B9A0', // 밝은 피부
    '#D4A574', // 중간 피부
    '#C4885F', // 어두운 피부
    '#F0D5B8', // 매우 밝은 피부
  ],
  eyeColors: [
    '#6B4423', // 갈색
    '#2C3E50', // 검은색
    '#3498DB', // 파란색
    '#27AE60', // 초록색
    '#8E44AD', // 보라색
  ],
} as const;
