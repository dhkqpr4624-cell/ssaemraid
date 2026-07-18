/**
 * 학급 게임화 앱 타입 정의
 *
 * 이 파일은 앱 전체에서 사용되는 타입들을 정의합니다.
 * DB 연결 시에도 이 타입들을 그대로 사용할 수 있습니다.
 */

// ============================================
// 아이템 관련 타입
// ============================================

export type ItemType = 'avatar' | 'room' | 'badge' | 'decoration' | 'etc';
export type AvatarSlot = 'cape' | 'hair' | 'hairBack' | 'eyes' | 'eyebrow' | 'mouth' | 'face' | 'top' | 'bottom' | 'shoes' | 'hat' | 'headAccessory' | 'accessory' | 'pet' | 'background';
export type CurriculumSubject = 'math' | 'science' | 'social' | 'practical';
export interface CurriculumMeta {
  grade?: string;
  semester?: string;
  subject?: CurriculumSubject | string;
  unit?: string;
}

export type RoomDirection = 'front' | 'back' | 'left' | 'right' | 'NW' | 'NE' | 'SW' | 'SE';

export interface Item {
  id: string;
  name: string;
  type: ItemType;
  slot?: AvatarSlot;
  icon: string; // emoji (fallback)
  iconUrl?: string;
  imageUrl?: string;
  /** base visible sprite sheet layer (e.g. eyelash / outline) */
  layerImageUrl?: string;
  /** tint mask sprite sheet layer (e.g. iris only) */
  tintMaskUrl?: string;
  /** optional second visible overlay layer */
  overlayImageUrl?: string;
  /** hair-only recolor layer mode */
  hairLayerMode?: 'singleColorMask' | 'triple' | 'six';
  /** shadow layer rendered with multiply */
  shadowImageUrl?: string;
  /** outline layer rendered normally on top */
  outlineImageUrl?: string;
  /** eye-only optional shadow layer rendered with multiply above iris */
  eyeShadowImageUrl?: string;
  /** cape-only layer position. Default is 'back'; 'front' renders above top/bottom clothing. */
  capeLayerPosition?: 'back' | 'front';
  /** cape-only split layers rendered at different avatar depths. */
  capeFrontImageUrl?: string;
  capeBackImageUrl?: string;
  capeMediumImageUrl?: string;
  /** avatar body arm pose override used by equipped items, e.g. one-hand weapon accessory. */
  rightArmPose?: 'default' | 'holdOneHandWeapon' | 'twoHanded';
  leftArmPose?: 'default' | 'twoHanded';
  rightArmImageUrl?: string;
  leftArmImageUrl?: string;
  topBodyImageUrl?: string;
  topLeftArmDefaultImageUrl?: string;
  topRightArmDefaultImageUrl?: string;
  topRightArmOneHandedImageUrl?: string;
  topLeftArmTwoHandedImageUrl?: string;
  topRightArmTwoHandedImageUrl?: string;
  /** one item can occupy multiple avatar slots, e.g. overalls = top + bottom */
  occupiesSlots?: AvatarSlot[];
  /** six-layer hair: under layers stay visible when a hat is equipped */
  underTintMaskUrl?: string;
  underShadowImageUrl?: string;
  underOutlineImageUrl?: string;
  /** six-layer hair: upper layers are hidden when a hat is equipped */
  upperTintMaskUrl?: string;
  upperShadowImageUrl?: string;
  upperOutlineImageUrl?: string;
  description?: string;
  rarity?: 'common' | 'rare' | 'epic' | 'legendary';
  stackable?: boolean;
  
  // 방향별 이미지 (방 꾸미기 아이템용)
  directionImages?: {
    front?: string;
    back?: string;
    left?: string;
    right?: string;
    NW?: string;
    NE?: string;
    SW?: string;
    SE?: string;
    [key: string]: string | undefined;
  };
  
  // 아바타 애니메이션 파츠 (나중에 PNG로 교체 가능)
  avatarLayers?: {
    idle?: string;
    walk?: string;
    armLeft?: string;
    armRight?: string;
    legLeft?: string;
    legRight?: string;
  };
  
  acquiredAt: string;
}

// ============================================
// 방 꾸미기 관련 타입
// ============================================

export interface PlacedRoomItem {
  id?: string;
  inventoryItemId?: string; // 학생 인벤토리의 아이템 ID
  itemId: string; // 실제 Item의 ID
  slot?: string; // 선택사항 (나중에 슬롯 기반 배치로 확장 가능)
  x: number; // 화면 또는 그리드 X 좌표
  y: number; // 화면 또는 그리드 Y 좌표
  gridX?: number;
  gridY?: number;
  wallZ?: number; // 벽걸이 아이템 전용 높이 축
  wallAxisVersion?: number; // 벽걸이 아이템 좌표 체계 버전
  zIndex?: number; // 겹침 순서
  direction: RoomDirection; // 방향 (front/back/left/right)
  rotationVariant?: string; // 나중에 회전 각도 지원
}

export interface RoomState {
  skinColor?: string;
  equipped: {
    background?: string | null; // itemId (기존 슬롯 방식)
    floor?: string;
    desk?: string;
    chair?: string;
    decoration?: string;
  };
  placedItems?: PlacedRoomItem[]; // 그리드 기반 배치 아이템 (새로 추가)
  playerPosition?: RoomPlayerPosition;
}

// 방 안 플레이어 위치 및 상태
export interface RoomPlayerPosition {
  x: number;
  y: number;
  facing: RoomDirection;
  isMoving: boolean;
}

// ============================================
// 학생 관련 타입
// ============================================

export interface AvatarState {
  // 색상 커스터마이징
  skinColor: string;
  eyeColor?: string; // 눈 색상 (기본값: #6B4423)
  hairColor?: string; // 머리색 (기본값: #3A2A22)
  
  equipped: {
    cape?: string | null;
    hair?: string | null; // itemId
    hairBack?: string | null;
    eyes?: string | null;
    eyebrow?: string | null;
    mouth?: string | null;
    face?: string | null;
    top?: string | null;
    bottom?: string | null;
    shoes?: string | null;
    hat?: string | null;
    headAccessory?: string | null;
    accessory?: string | null;
    pet?: string | null;
    background?: string | null;
  };
  
  // 기본 신체 파츠 (나중에 커스터마이징 가능)
  baseParts?: {
    body?: string;
    inner?: string;
    head?: string;
    leftArm?: string;
    rightArm?: string;
    leftLeg?: string;
    rightLeg?: string;
  };
  
  // 애니메이션 상태
  animationState?: 'idle' | 'walk';
  facing?: RoomDirection;
  
  // 스프라이트 애니메이션 프레임 (0-3)
  animationFrame?: number;
  
  // 마지막 업데이트 시간 (애니메이션 타이밍용)
  lastFrameUpdate?: number;
}

export interface Student {
  id: string;
  classId: string;
  attendanceNumber: number; // 출석번호
  nickname: string;
  score: number;
  coins: number;
  items: Item[];
  avatarId: string; // Legacy field
  avatarState?: AvatarState; // New field
  roomState?: RoomState; // New field (확장됨)
  roomDecorations: string[]; // Legacy field
}

// 학생 세션 정보 (sessionStorage에 저장)
export interface StudentSession {
  classCode: string;
  classId: string;
  className: string;
  attendanceNumber: number;
  studentId: string;
  nickname: string;
}

// ============================================
// 클래스 관련 타입
// ============================================

export interface ClassRoom {
  id: string;
  name: string;
  code: string; // 6자리 클래스 코드 (영문대문자 + 숫자)
  teacherPassword: string;
  studentCount: number;
  createdAt: string; // ISO string for JSON serialization
  lastAccessedAt: string; // ISO string for JSON serialization
}

// 교사 세션 (최근 접속한 클래스 기록)
export interface TeacherClassSession {
  classId: string;
  classCode: string;
  className: string;
  lastAccessedAt: string;
}

export interface SessionRecord {
  id: string;
  classId: string;
  sessionNumber: number;
  date: string;
  summary: string;
  totalPointsAwarded: number;
}

// ============================================
// 퀴즈 문항 관련 타입 (실제 문제 풀이 시스템)
// ============================================

export type QuestionType = 'single' | 'multiple' | 'short' | 'essay';

export interface QuizQuestion {
  id: string;
  quizId: string;
  order: number;
  type: QuestionType;
  text: string;
  points: number;
  options?: string[];
  correctAnswers?: number[];
  shortAnswers?: string[];
  hint?: string;
}

export interface StudentAnswer {
  questionId: string;
  selectedOptions?: number[];
  textAnswer?: string;
  isAutoGraded: boolean;
  earnedPoints: number;
  needsReview: boolean;
  teacherScore?: number;
  teacherComment?: string;
}

// ============================================
// 퀴즈 관련 타입
// ============================================

export type ReviewMode = 'same' | 'edited' | 'randomFromBank';
export type RetryQuestionMode = 'same' | 'modified' | 'random' | 'extended';
export type RetryRewardMode = 'same' | 'different' | 'none';

export interface Quiz {
  id: string;
  quiz_id?: string; // Supabase에서 사용하는 quiz_id 별칭
  classId: string;
  classCode: string;
  title: string;
  description: string;
  totalScore: number;
  isActive: boolean;
  isReviewEnabled: boolean;
  reviewMode: ReviewMode;
  createdAt: string;
  rewardOptions: QuizRewardOption[];
  questions: QuizQuestion[];
  
  // 재도전 옵션 (새로 추가)
  allowRetry: boolean; // 재도전 허용 여부
  retryQuestionMode?: RetryQuestionMode; // 재도전 시 문제 구성 방식
  retryRewardMode?: RetryRewardMode; // 재도전 시 보상 방식
  retryRewardOptions?: QuizRewardOption[]; // retryRewardMode = 'different'일 때 사용
  maxRetryAttempts?: number; // 허용할 최대 재도전 횟수(첫 시도 제외)

  // 랜덤/라이브 퀴즈 설정(Supabase settings JSON에서 복원)
  randomPickEnabled?: boolean;
  randomPickCount?: number;
  shuffleQuestionsEnabled?: boolean;
  quizMode?: 'normal' | 'live';
  curriculum?: CurriculumMeta;
  grade?: string;
  semester?: string;
  subject?: string;
  unit?: string;

  // 예전 코드 호환용
  retryOptions?: {
    enabled?: boolean;
    questionMode?: RetryQuestionMode;
    rewardMode?: RetryRewardMode;
    maxAttempts?: number;
  };
}

// 퀴즈 보상 옵션 (점수 조건별 아이템)
export interface QuizRewardOption {
  id: string;
  itemId: string;
  requiredScore: number;
  itemName: string; // emoji
  itemIcon: string;
  itemImageUrl?: string; // 보상/인벤토리 카드에서 보여줄 아이콘 이미지(Base64 또는 URL)
  itemSpriteUrl?: string; // 아바타에 실제로 장착할 스프라이트 시트 URL
  itemType: ItemType;
  itemSlot?: AvatarSlot;
  itemDescription?: string;
  occupiesSlots?: AvatarSlot[];

  // item-editor 제작 room item metadata
  roomSize?: '160x160' | '320x160' | '480x160' | '640x160' | '320x320' | '480x480' | '640x640' | string;
  spriteConfig?: { columns: number; rows: number; frameWidth: number; frameHeight: number };
  directionImages?: Record<string, string>;
  availableDirections?: string[];
  defaultDirection?: string;
  footprint?: { w?: number; h?: number; width?: number; height?: number };

  // item-editor 제작 avatar hair item metadata
  hairLayerMode?: 'singleColorMask' | 'triple' | 'six';
  tintMaskUrl?: string;
  shadowImageUrl?: string;
  outlineImageUrl?: string;
  overlayImageUrl?: string;
  eyeShadowImageUrl?: string;
  rightArmPose?: 'default' | 'holdOneHandWeapon' | 'twoHanded';
  leftArmPose?: 'default' | 'twoHanded';
  rightArmImageUrl?: string;
  leftArmImageUrl?: string;
  topBodyImageUrl?: string;
  topLeftArmDefaultImageUrl?: string;
  topRightArmDefaultImageUrl?: string;
  topRightArmOneHandedImageUrl?: string;
  topLeftArmTwoHandedImageUrl?: string;
  topRightArmTwoHandedImageUrl?: string;
  underTintMaskUrl?: string;
  underShadowImageUrl?: string;
  underOutlineImageUrl?: string;
  upperTintMaskUrl?: string;
  upperShadowImageUrl?: string;
  upperOutlineImageUrl?: string;

  // 보상 검색용 교육과정 분류 metadata
  curriculum?: { grade?: string; semester?: string; subject?: string; unit?: string };
  grade?: string;
  semester?: string;
  subject?: string;
  unit?: string;
}

export interface StudentQuizResult {
  id: string;
  quizId: string;
  classId: string;
  classCode: string;
  attendanceNumber: number;
  studentId: string;
  score: number;
  autoScore: number;
  pendingScore: number;
  answers: StudentAnswer[];
  eligibleRewardOptionIds: string[];
  selectedRewardOptionId?: string;
  submittedAt: string;
  rewardClaimedAt?: string;
  gradingStatus: 'auto_complete' | 'pending_review' | 'fully_graded';

  // Supabase/화면 표시용 보조 필드
  totalScore?: number;
  isCompleted?: boolean;
  correctCount?: number;
  totalCount?: number;
  questionSnapshot?: string[];
  
  // 재도전 지원 (새로 추가)
  attemptNumber: number; // 1, 2, 3... (기본값: 1)
  isRetryAttempt: boolean; // 재도전 여부 (기본값: false)
  rewardClaimedPerAttempt?: Record<number, boolean>; // attemptNumber별 보상 수령 여부
}

export interface QuizInput {
  title: string;
  description: string;
  isActive: boolean;
  isReviewEnabled: boolean;
  reviewMode: ReviewMode;
  rewardOptions: Omit<QuizRewardOption, 'id' | 'itemId'>[];
  questions: Omit<QuizQuestion, 'id' | 'quizId'>[];
  
  // 재도전 옵션 (새로 추가)
  allowRetry?: boolean;
  retryQuestionMode?: RetryQuestionMode;
  retryRewardMode?: RetryRewardMode;
  retryRewardOptions?: Omit<QuizRewardOption, 'id' | 'itemId'>[];
  maxRetryAttempts?: number;
  curriculum?: CurriculumMeta;
  grade?: string;
  semester?: string;
  subject?: string;
  unit?: string;
}

// ============================================
// 활동 로그 관련 타입
// ============================================

export interface ActivityLog {
  id: string;
  classId: string;
  studentId: string;
  attendanceNumber: number;
  studentNickname: string;
  type: 'points' | 'coins' | 'both';
  deltaPoints: number;
  deltaCoins: number;
  reason: string;
  createdAt: string;
}

// ============================================
// API 응답 타입
// ============================================

export interface CreateClassResult {
  success: boolean;
  classroom?: ClassRoom;
  students?: Student[];
  error?: string;
}

export interface AuthenticateResult {
  success: boolean;
  classroom?: ClassRoom;
  error?: string;
}

// ============================================
// 함께 풀기 (Live Quiz) 관련 타입
// ============================================
export interface LiveQuizSession {
  id: string; // sessionId (uuid)
  quizId: string;
  classCode: string;
  status: 'waiting' | 'started' | 'question_active' | 'answers_submitted' | 'showing_answer' | 'ended';
  currentQuestionIndex: number;
  selectedQuestionIds: string[]; // 실제 출제할 문제 ID 목록 (랜덤 선택 후)
  participatingStudents: string[]; // attendanceNumber 목록
  submittedStudents: string[]; // 현재 문제에 제출한 학생 목록
  startedAt: string; // ISO datetime
  questionStartedAt?: string; // 현재 문제 시작 시간
  timeLimitSeconds?: number; // 문제별 제한시간 (초)
  createdAt: string;
}

export interface LiveQuizAnswer {
  sessionId: string;
  questionId: string;
  attendanceNumber: string; // 학생 출석번호
  answer: StudentAnswer; // 실제 답안
  submittedAt: string;
}

// ============================================
// 퀴즈 Export/Import 타입
// ============================================
export interface QuizExportData {
  metadata: {
    title: string;
    description: string;
    totalScore: number;
    totalQuestions: number;
    createdAt: string;
    exportedAt: string;
    curriculum?: CurriculumMeta;
  };
  curriculum?: CurriculumMeta;
  settings: {
    allowRetry: boolean;
    retryQuestionMode?: RetryQuestionMode;
    retryRewardMode?: RetryRewardMode;
    maxRetryAttempts?: number;
    quizMode?: 'normal' | 'live';
    randomPickEnabled?: boolean;
    randomPickCount?: number;
    shuffleQuestionsEnabled?: boolean;
  };
  questions: QuizQuestion[];
  rewardOptions: QuizRewardOption[];
  retryRewardOptions?: QuizRewardOption[];
  version: string; // '1.0'
}

// ============================================
// 퀴즈 설정 (UI용)
// ============================================
export interface QuizSettings {
  allowRetry: boolean;
  retryQuestionMode: RetryQuestionMode;
  retryRewardMode: RetryRewardMode;
  maxRetryAttempts: number;
  quizMode: 'normal' | 'live';
  randomPickEnabled: boolean;
  randomPickCount: number;
  shuffleQuestionsEnabled: boolean;
}
