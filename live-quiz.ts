/**
 * 아이소메트릭 좌표 변환 유틸리티
 * 
 * 그리드 좌표(x, y)를 화면의 아이소메트릭 좌표로 변환합니다.
 * 
 * 변환 공식:
 * x' = (x - y) * tileW / 2
 * y' = (x + y) * tileH / 2
 */

// 타일 크기 (픽셀)
export const ISO_TILE_WIDTH = 64;
export const ISO_TILE_HEIGHT = 32;

/**
 * 그리드 좌표를 아이소메트릭 화면 좌표로 변환
 */
export function gridToIso(gridX: number, gridY: number): { x: number; y: number } {
  const x = (gridX - gridY) * (ISO_TILE_WIDTH / 2);
  const y = (gridX + gridY) * (ISO_TILE_HEIGHT / 2);
  return { x, y };
}

/**
 * 아이소메트릭 화면 좌표를 그리드 좌표로 변환 (역변환)
 */
export function isoToGrid(screenX: number, screenY: number): { x: number; y: number } {
  const x = (screenX / (ISO_TILE_WIDTH / 2) + screenY / (ISO_TILE_HEIGHT / 2)) / 2;
  const y = (screenY / (ISO_TILE_HEIGHT / 2) - screenX / (ISO_TILE_WIDTH / 2)) / 2;
  return { x: Math.round(x), y: Math.round(y) };
}

/**
 * 아이소메트릭 렌더링 순서 계산 (z-index)
 * 뒤쪽 객체가 먼저 렌더링되도록 하기 위해 x+y 값이 작을수록 먼저 렌더링
 */
export function getIsoZIndex(gridX: number, gridY: number): number {
  return gridX + gridY;
}

/**
 * 아이소메트릭 뷰의 카메라 오프셋 계산
 * 방의 중심을 화면 중앙에 배치
 */
export function getCameraOffset(
  roomWidth: number,
  roomHeight: number,
  screenWidth: number,
  screenHeight: number
): { x: number; y: number } {
  // 방의 우측 상단 모서리 좌표
  const topRightIso = gridToIso(roomWidth - 1, 0);
  // 방의 좌측 하단 모서리 좌표
  const bottomLeftIso = gridToIso(0, roomHeight - 1);
  
  // 방의 중심 계산
  const centerX = (topRightIso.x + bottomLeftIso.x) / 2;
  const centerY = (topRightIso.y + bottomLeftIso.y) / 2;
  
  // 화면 중앙에 맞추기 위한 오프셋
  return {
    x: screenWidth / 2 - centerX,
    y: screenHeight / 2 - centerY,
  };
}
