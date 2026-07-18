import type { ItemType, AvatarSlot } from './types';
import type { RewardCategoryMeta } from './reward-categories';

export interface RewardFolderItem extends RewardCategoryMeta {
  id: string;
  name: string;
  type: ItemType;
  slot?: AvatarSlot;
  icon?: string;
  iconUrl?: string;
  imageUrl: string;
  description?: string;
  tintMaskUrl?: string;
  shadowImageUrl?: string;
  outlineImageUrl?: string;
  overlayImageUrl?: string;
  eyeShadowImageUrl?: string;
  topBodyImageUrl?: string;
  topLeftArmDefaultImageUrl?: string;
  topRightArmDefaultImageUrl?: string;
  topRightArmOneHandedImageUrl?: string;
  topLeftArmTwoHandedImageUrl?: string;
  topRightArmTwoHandedImageUrl?: string;
  occupiesSlots?: AvatarSlot[];
  hairLayerMode?: 'singleColorMask' | 'triple' | 'six';
  underTintMaskUrl?: string;
  underShadowImageUrl?: string;
  underOutlineImageUrl?: string;
  upperTintMaskUrl?: string;
  upperShadowImageUrl?: string;
  upperOutlineImageUrl?: string;
  hashtags?: string[];
}

// Vercel/브라우저 환경에서는 public 폴더를 런타임에 자동 스캔할 수 없으므로,
// 새 스프라이트 파일을 public/reward-items/... 경로에 넣은 뒤 아래 배열에 한 줄만 추가하면
// 퀴즈 보상 검색 목록과 학년/학기/과목/단원 필터에 연결됩니다.
// 예:
// { id: 'g5-s1-math-u1-top-basic', name: '약수와 배수 상의', type: 'avatar', slot: 'top', imageUrl: '/reward-items/5/1/math/1-divisor-multiple/top/basic.png', grade: '5', semester: '1', subject: 'math', unit: '5-1-math-1' },
export const REWARD_FOLDER_ITEMS: RewardFolderItem[] = [

  {
    id: 'g5-s2-social-u1-hair-goguryeo-jumong',
    name: '고구려 주몽 헤어',
    type: 'avatar',
    slot: 'hair',
    icon: '💇',
    iconUrl: '/reward-icons/5/2/social/u1/goguryeo-jumong-hair-icon.png',
    imageUrl: '/reward-items/5/2/social/hair/goguryeo-jumong-hair-under-shadow.png',
    shadowImageUrl: '/reward-items/5/2/social/hair/goguryeo-jumong-hair-under-shadow.png',
    outlineImageUrl: '/reward-items/5/2/social/hair/goguryeo-jumong-hair-under-outline.png',
    underShadowImageUrl: '/reward-items/5/2/social/hair/goguryeo-jumong-hair-under-shadow.png',
    underOutlineImageUrl: '/reward-items/5/2/social/hair/goguryeo-jumong-hair-under-outline.png',
    upperShadowImageUrl: '/reward-items/5/2/social/hair/goguryeo-jumong-hair-upper-shadow.png',
    upperOutlineImageUrl: '/reward-items/5/2/social/hair/goguryeo-jumong-hair-upper-outline.png',
    hairLayerMode: 'six',
    hashtags: ['삼국', '고구려'],
    description: '5학년 2학기 사회 1단원 삼국 시대와 고구려 학습과 관련된 주몽 헤어 아이템입니다. 모자 착용 시 upper hair 레이어가 숨겨집니다.',
    grade: '5',
    semester: '2',
    subject: 'social',
    unit: '5-2-social-1',
  },
  {
    id: 'g5-s2-social-u1-top-goguryeo-gwanggaeto-armor',
    name: '고구려 광개토대왕 갑옷',
    type: 'avatar',
    slot: 'top',
    icon: '🛡️',
    iconUrl: '/reward-icons/5/2/social/u1/goguryeo-gwanggaeto-armor-icon.png',
    imageUrl: '/reward-items/5/2/social/top/goguryeo-gwanggaeto-armor-body.png',
    topBodyImageUrl: '/reward-items/5/2/social/top/goguryeo-gwanggaeto-armor-body.png',
    topLeftArmDefaultImageUrl: '/reward-items/5/2/social/top/goguryeo-gwanggaeto-armor-left-arm-default.png',
    topRightArmDefaultImageUrl: '/reward-items/5/2/social/top/goguryeo-gwanggaeto-armor-right-arm-default.png',
    topRightArmOneHandedImageUrl: '/reward-items/5/2/social/top/goguryeo-gwanggaeto-armor-right-arm-one-handed.png',
    topLeftArmTwoHandedImageUrl: '/reward-items/5/2/social/top/goguryeo-gwanggaeto-armor-left-arm-two-handed.png',
    topRightArmTwoHandedImageUrl: '/reward-items/5/2/social/top/goguryeo-gwanggaeto-armor-right-arm-two-handed.png',
    hashtags: ['고구려', '삼국'],
    description: '5학년 2학기 사회 1단원 삼국 시대와 고구려 학습과 관련된 광개토대왕 갑옷 상의 아이템입니다.',
    grade: '5',
    semester: '2',
    subject: 'social',
    unit: '5-2-social-1',
  },


  {
    id: 'g5-s1-social-u2-top-heavy-chemical-industry-uniform-1970',
    name: '1970 중화학 공업 유니폼',
    type: 'avatar', slot: 'top', icon: '👕',
    iconUrl: '/reward-icons/5/1/social/u2/heavy-chemical-industry-uniform-1970-icon.png',
    imageUrl: '/reward-items/5/1/social/top/heavy-chemical-industry-uniform-1970-body.png',
    topBodyImageUrl: '/reward-items/5/1/social/top/heavy-chemical-industry-uniform-1970-body.png',
    topLeftArmDefaultImageUrl: '/reward-items/5/1/social/top/heavy-chemical-industry-uniform-1970-left-arm-default.png',
    topRightArmDefaultImageUrl: '/reward-items/5/1/social/top/heavy-chemical-industry-uniform-1970-right-arm-default.png',
    topRightArmOneHandedImageUrl: '/reward-items/5/1/social/top/heavy-chemical-industry-uniform-1970-right-arm-one-handed.png',
    topLeftArmTwoHandedImageUrl: '/reward-items/5/1/social/top/heavy-chemical-industry-uniform-1970-left-arm-two-handed.png',
    topRightArmTwoHandedImageUrl: '/reward-items/5/1/social/top/heavy-chemical-industry-uniform-1970-right-arm-two-handed.png',
    hashtags: ['인구', '인구 분포', '1970', '대도시'],
    description: '5학년 1학기 사회 2단원 보상 상의 아이템입니다.',
    grade: '5', semester: '1', subject: 'social', unit: '5-1-social-2',
  },

    {
    id: 'g5-s1-social-top-citydev-hood',
    name: '도시 개발 후드티',
    type: 'avatar',
    slot: 'top',
    icon: '👕',
    imageUrl: '/reward-items/5/1/social/top/citydev-hood-body.png',
    topBodyImageUrl: '/reward-items/5/1/social/top/citydev-hood-body.png',
    topLeftArmDefaultImageUrl: '/reward-items/5/1/social/top/citydev-hood-left-arm-default.png',
    topRightArmDefaultImageUrl: '/reward-items/5/1/social/top/citydev-hood-right-arm-default.png',
    topRightArmOneHandedImageUrl: '/reward-items/5/1/social/top/citydev-hood-right-arm-one-handed.png',
    topLeftArmTwoHandedImageUrl: '/reward-items/5/1/social/top/citydev-hood-left-arm-two-handed.png',
    topRightArmTwoHandedImageUrl: '/reward-items/5/1/social/top/citydev-hood-right-arm-two-handed.png',
    iconUrl: '/reward-icons/5/1/social/u2/citydev-hood-icon.png',
    hashtags: ['인구 분포', '수도권'],
    description: '5학년 1학기 사회 2단원 보상 상의 아이템입니다.',
    grade: '5', semester: '1', subject: 'social', unit: '5-1-social-2',
  },
  {
    id: 'g5-s1-social-u2-shoes-rice-farming-boots',
    name: '1960 벼농사 장화',
    type: 'avatar',
    slot: 'shoes',
    icon: '🥾',
    imageUrl: '/reward-items/5/1/social/shoes/rice-farming-boots.png',
    iconUrl: '/reward-icons/5/1/social/u2/rice-farming-boots-icon.png',
    description: '5학년 1학기 사회 2단원 보상 신발 아이템입니다.',
    grade: '5',
    semester: '1',
    subject: 'social',
    unit: '5-1-social-2',
  },
  {
    id: 'g5-s1-social-u2-hat-rural-straw-hat',
    name: '1960 촌락 벼농사 밀짚모자',
    type: 'avatar',
    slot: 'hat',
    icon: '👒',
    imageUrl: '/reward-items/5/1/social/hat/rural-straw-hat.png',
    iconUrl: '/reward-icons/5/1/social/u2/rural-straw-hat-icon.png',
    description: '5학년 1학기 사회 2단원 보상 모자 아이템입니다. 착용 시 hair_upper 레이어가 숨겨집니다.',
    grade: '5',
    semester: '1',
    subject: 'social',
    unit: '5-1-social-2',
  },
  {
    id: 'g5-s1-social-u2-hat-industrial-safety-helmet',
    name: '1970 중화학 공업 안전모',
    type: 'avatar',
    slot: 'hat',
    icon: '⛑️',
    imageUrl: '/reward-items/5/1/social/hat/industrial-safety-helmet.png',
    iconUrl: '/reward-icons/5/1/social/u2/industrial-safety-helmet-icon.png',
    description: '5학년 1학기 사회 2단원 보상 모자 아이템입니다. 착용 시 hair_upper 레이어가 숨겨집니다.',
    grade: '5',
    semester: '1',
    subject: 'social',
    unit: '5-1-social-2',
  },
  {
    id: 'g5-s1-social-u2-hat-balanced-development-purple-flower-cap',
    name: '균형발전 보라꽃 모자',
    type: 'avatar',
    slot: 'hat',
    icon: '🧢',
    imageUrl: '/reward-items/5/1/social/hat/balanced-development-purple-flower-cap.png',
    iconUrl: '/reward-icons/5/1/social/u2/balanced-development-purple-flower-cap-icon.png',
    description: '5학년 1학기 사회 2단원 보상 모자 아이템입니다. 착용 시 hair_upper 레이어가 숨겨집니다.',
    grade: '5',
    semester: '1',
    subject: 'social',
    unit: '5-1-social-2',
  },
  {
    id: 'g5-s1-social-u2-eyes-city-neon-eyes',
    name: '도시 네온 눈',
    type: 'avatar',
    slot: 'eyes',
    icon: '👀',
    imageUrl: '/reward-items/5/1/social/eyes/city-neon-eyes-eyelash.png',
    iconUrl: '/reward-icons/5/1/social/u2/city-neon-eyes-icon.png',
    tintMaskUrl: '/reward-items/5/1/social/eyes/city-neon-eyes-iris.png',
    eyeShadowImageUrl: '/reward-items/5/1/social/eyes/city-neon-eyes-shadow.png',
    description: '5학년 1학기 사회 2단원 보상 눈 아이템입니다. iris 색상 변경과 shadow multiply 레이어를 지원합니다.',
    grade: '5',
    semester: '1',
    subject: 'social',
    unit: '5-1-social-2',
  },
  {
    id: 'g5-s1-social-u2-shoes-city-running-shoes',
    name: '도시 런닝화',
    type: 'avatar',
    slot: 'shoes',
    icon: '👟',
    iconUrl: '/reward-icons/5/1/social/u2/city-running-shoes-icon.png',
    imageUrl: '/reward-items/5/1/social/shoes/city-running-shoes.png',
    description: '5학년 1학기 사회 2단원 보상 신발 아이템입니다.',
    grade: '5',
    semester: '1',
    subject: 'social',
    unit: '5-1-social-2',
  },

  {
    id: 'g5-s1-social-u2-face-urban-pollution-mask',
    name: '도시 환경 오염 마스크',
    type: 'avatar',
    slot: 'face',
    icon: '😷',
    iconUrl: '/reward-icons/5/1/social/u2/urban-pollution-mask-icon.png',
    imageUrl: '/reward-items/5/1/social/face/urban-pollution-mask.png',
    description: '5학년 1학기 사회 2단원 보상 얼굴 장식 아이템입니다.',
    grade: '5',
    semester: '1',
    subject: 'social',
    unit: '5-1-social-2',
  },
  {
    id: 'g5-s1-social-u2-bottom-balanced-development-official-slacks',
    name: '균형발전 공무원 슬렉스',
    type: 'avatar',
    slot: 'bottom',
    icon: '👖',
    iconUrl: '/reward-icons/5/1/social/u2/balanced-development-official-slacks-icon.png',
    imageUrl: '/reward-items/5/1/social/bottom/balanced-development-official-slacks.png',
    description: '5학년 1학기 사회 2단원 보상 바지 아이템입니다.',
    grade: '5',
    semester: '1',
    subject: 'social',
    unit: '5-1-social-2',
  },
  {
    id: 'g5-s1-social-u2-top-balanced-development-official-uniform',
    name: '국가인권위원회 제복 상의',
    type: 'avatar',
    slot: 'top',
    icon: '👔',
    iconUrl: '/reward-icons/5/1/social/u2/balanced-development-official-uniform-icon.png',
    imageUrl: '/reward-items/5/1/social/u3/top/human-rights-commission-uniform-body.png',
    topBodyImageUrl: '/reward-items/5/1/social/u3/top/human-rights-commission-uniform-body.png',
    topLeftArmDefaultImageUrl: '/reward-items/5/1/social/u3/top/human-rights-commission-uniform-left-arm-default.png',
    topRightArmDefaultImageUrl: '/reward-items/5/1/social/u3/top/human-rights-commission-uniform-right-arm-default.png',
    topRightArmOneHandedImageUrl: '/reward-items/5/1/social/u3/top/human-rights-commission-uniform-right-arm-one-handed.png',
    topLeftArmTwoHandedImageUrl: '/reward-items/5/1/social/u3/top/human-rights-commission-uniform-left-arm-two-handed.png',
    topRightArmTwoHandedImageUrl: '/reward-items/5/1/social/u3/top/human-rights-commission-uniform-right-arm-two-handed.png',
    description: '5학년 1학기 사회 3단원 보상 상의 아이템입니다. body/팔 파츠가 분리되어 팔 자세에 맞게 표시됩니다.',
    grade: '5',
    semester: '1',
    subject: 'social',
    unit: '5-1-social-3',
  },
  {
    id: 'g5-s1-social-u2-bottom-urban-rush-hour-jeans',
    name: '도시 출근길 러시아워 청바지',
    type: 'avatar',
    slot: 'bottom',
    icon: '👖',
    iconUrl: '/reward-icons/5/1/social/u2/urban-rush-hour-jeans-icon.png',
    imageUrl: '/reward-items/5/1/social/bottom/urban-rush-hour-jeans.png',
    description: '5학년 1학기 사회 2단원 보상 바지 아이템입니다.',
    grade: '5',
    semester: '1',
    subject: 'social',
    unit: '5-1-social-2',
  },
    {
    id: 'g5-s1-social-u2-outfit-rural-overalls',
    name: '1960 벼농사 멜빵바지',
    type: 'avatar', slot: 'top', occupiesSlots: ['top', 'bottom'], icon: '🧑‍🌾',
    iconUrl: '/reward-icons/5/1/social/u2/rural-overalls-icon.png',
    imageUrl: '/reward-items/5/1/social/top/rural-overalls-body.png',
    topBodyImageUrl: '/reward-items/5/1/social/top/rural-overalls-body.png',
    topLeftArmDefaultImageUrl: '/reward-items/5/1/social/top/rural-overalls-left-arm-default.png',
    topRightArmDefaultImageUrl: '/reward-items/5/1/social/top/rural-overalls-right-arm-default.png',
    topRightArmOneHandedImageUrl: '/reward-items/5/1/social/top/rural-overalls-right-arm-one-handed.png',
    topLeftArmTwoHandedImageUrl: '/reward-items/5/1/social/top/rural-overalls-left-arm-two-handed.png',
    topRightArmTwoHandedImageUrl: '/reward-items/5/1/social/top/rural-overalls-right-arm-two-handed.png',
    hashtags: ['인구', '인구 분포', '1960', '농사'],
    description: '5학년 1학기 사회 2단원 보상 상하의 통합 아이템입니다. 착용 시 상의와 하의를 함께 차지합니다.',
    grade: '5', semester: '1', subject: 'social', unit: '5-1-social-2',
  },
  {
    id: 'g5-s1-social-u2-hair-rural-stylish-bob',
    name: '촌락 스타일리쉬 단발헤어',
    type: 'avatar',
    slot: 'hair',
    icon: '💇',
    iconUrl: '/reward-icons/5/1/social/u2/rural-stylish-bob-icon.png',
    imageUrl: '/reward-items/5/1/social/hair/rural-stylish-bob-under-color.png',
    tintMaskUrl: '/reward-items/5/1/social/hair/rural-stylish-bob-under-color.png',
    shadowImageUrl: '/reward-items/5/1/social/hair/rural-stylish-bob-under-shadow.png',
    underTintMaskUrl: '/reward-items/5/1/social/hair/rural-stylish-bob-under-color.png',
    underShadowImageUrl: '/reward-items/5/1/social/hair/rural-stylish-bob-under-shadow.png',
    upperTintMaskUrl: '/reward-items/5/1/social/hair/rural-stylish-bob-upper-color.png',
    upperShadowImageUrl: '/reward-items/5/1/social/hair/rural-stylish-bob-upper-shadow.png',
    hairLayerMode: 'six',
    description: '5학년 1학기 사회 2단원 보상 머리 아이템입니다. 모자 착용 시 upper hair 레이어가 숨겨집니다.',
    grade: '5',
    semester: '1',
    subject: 'social',
    unit: '5-1-social-2',
  },
];

export function getRewardFolderItems(): RewardFolderItem[] {
  return REWARD_FOLDER_ITEMS.map(item => ({
    icon: '🎁',
    iconUrl: item.imageUrl,
    description: item.description || `${item.name} (교육과정 보상 아이템)`,
    ...item,
  }));
}
