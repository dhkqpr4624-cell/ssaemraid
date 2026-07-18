import type { QuizExportData } from './types';

export interface BuiltInQuizTemplate {
  id: string;
  title: string;
  description: string;
  curriculum: { grade: string; semester: string; subject: string; unit: string };
  data: QuizExportData;
}

export const BUILTIN_QUIZ_TEMPLATES: BuiltInQuizTemplate[] = [
  {
    "id": "builtin-social-5-1-u2-population-distribution",
    "title": "(2단원 9차시)우리나라의 인구는 어떻게 분포하고 있을까요?",
    "description": "(동아) 5-1 사회 2단원 9차시 퀴즈입니다.",
    "curriculum": {
      "grade": "5",
      "semester": "1",
      "subject": "social",
      "unit": "2"
    },
    "data": {
      "metadata": {
        "title": "(2단원 9차시)우리나라의 인구는 어떻게 분포하고 있을까요?",
        "description": "(동아) 5-1 사회 2단원 9차시 퀴즈입니다.",
        "totalScore": 70,
        "totalQuestions": 7,
        "createdAt": "2026-06-01T07:09:54.885394+00:00",
        "exportedAt": "2026-06-01T07:28:38.164Z",
        "curriculum": {
          "grade": "5",
          "semester": "1",
          "subject": "social",
          "unit": "2"
        }
      },
      "settings": {
        "allowRetry": true,
        "retryQuestionMode": "same",
        "retryRewardMode": "same",
        "quizMode": "normal",
        "randomPickEnabled": true,
        "randomPickCount": 4,
        "shuffleQuestionsEnabled": false
      },
      "questions": [
        {
          "id": "38209de8-abbd-450a-a2d7-d220a2e244f7",
          "text": "한 나라 또는 일정한 지역에 사는 사람의 수를 ( ㅇㄱ ) 라고 한다.",
          "type": "short",
          "points": 10,
          "shortAnswers": [
            "인구"
          ],
          "options": [],
          "correctAnswers": []
        },
        {
          "id": "92f2764f-8e6f-44ae-b4a2-e57d7d7de6bf",
          "text": "사람들이 어디에 얼마나 모여 살고 있는지 나타낸 것을 ( ㅇㄱ ㅂㅍ)라고 한다.",
          "type": "short",
          "points": 10,
          "shortAnswers": [
            "인구 분포",
            "인구분포"
          ],
          "options": [],
          "correctAnswers": []
        },
        {
          "id": "52878623-b655-4b64-8f5c-a5d8cdea211a",
          "text": "우리나라의 수도인 서울을 중심으로 인천과 경기를 포함하는 대도시권을 의미하는 단어는?",
          "type": "short",
          "points": 10,
          "shortAnswers": [
            "수도권"
          ],
          "options": [],
          "correctAnswers": []
        },
        {
          "id": "49b58341-cfdf-4b30-90b6-62e12d006193",
          "text": "우리나라에서 가장 많은 인구가 모여 살고 있는 곳은?",
          "type": "single",
          "points": 10,
          "options": [
            "부산",
            "수도권",
            "울산",
            "대전"
          ],
          "correctAnswers": [
            1
          ],
          "shortAnswers": []
        },
        {
          "id": "353c3406-87c3-422b-9e2e-1fb48f2d3335",
          "text": "인구는 자연환경이나 인문환경의 영향을 받는다",
          "type": "single",
          "points": 10,
          "options": [
            "O",
            "X"
          ],
          "correctAnswers": [
            0
          ],
          "shortAnswers": []
        },
        {
          "id": "4b5970f4-c9df-41fe-9b53-e9faeb1bc21b",
          "text": "인구는 국토상에 고르게 분포한다",
          "type": "single",
          "points": 10,
          "options": [
            "O",
            "X"
          ],
          "correctAnswers": [
            1
          ],
          "shortAnswers": []
        },
        {
          "id": "a83e5560-400f-4a6f-ad56-bf6acb7ca4be",
          "text": "인구는 계속 변한다",
          "type": "single",
          "points": 10,
          "options": [
            "O",
            "X"
          ],
          "correctAnswers": [
            0
          ],
          "shortAnswers": []
        }
      ],
      "rewardOptions": [
        {
          "id": "6e9713a0-9dd1-4913-8482-b2aaa4dfb214",
          "unit": "5-1-social-2",
          "grade": "5",
          "itemId": "room_population_distribution_frame",
          "subject": "social",
          "itemIcon": "🖼️",
          "itemName": "인구분포 액자",
          "itemType": "room",
          "semester": "1",
          "footprint": {
            "h": 1,
            "w": 1
          },
          "itemImageUrl": "/reward-icons/5/1/social/u2/population-distribution-frame-icon.png",
          "itemSpriteUrl": "/assets/items/room/population-distribution-frame.png",
          "requiredScore": 20,
          "itemDescription": "5학년 1학기 사회 2단원 인구 분포 학습과 관련된 벽걸이 액자입니다.",
          "defaultDirection": "SE",
          "availableDirections": [
            "NW",
            "NE",
            "SW",
            "SE"
          ]
        },
        {
          "id": "edf410ec-266a-4f2d-96d4-73a92c619286",
          "unit": "5-1-social-2",
          "grade": "5",
          "itemId": "room_metropolitan_night_window",
          "subject": "social",
          "itemIcon": "🌃",
          "itemName": "수도권 야경 창문",
          "itemType": "room",
          "semester": "1",
          "footprint": {
            "h": 2,
            "w": 2
          },
          "itemImageUrl": "/reward-icons/5/1/social/u2/metropolitan-night-window-icon.png",
          "itemSpriteUrl": "/assets/items/room/metropolitan-night-window.png",
          "requiredScore": 30,
          "itemDescription": "5학년 1학기 사회 2단원 수도권 학습과 관련된 벽걸이 창문 아이템입니다.",
          "defaultDirection": "NW",
          "availableDirections": [
            "NW",
            "NE",
            "SW",
            "SE"
          ]
        }
      ],
      "retryRewardOptions": [],
      "version": "1.0",
      "curriculum": {
        "grade": "5",
        "semester": "1",
        "subject": "social",
        "unit": "2"
      }
    }
  },
  {
    "id": "builtin-social-5-1-u2-population-change-reasons",
    "title": "(2단원 10~11차시)인구가 오늘날처럼 분포하게 된 까닭을 알아볼까요",
    "description": "(동아) 5-1 사회 2단원 10~11차시 퀴즈입니다.",
    "curriculum": {
      "grade": "5",
      "semester": "1",
      "subject": "social",
      "unit": "2"
    },
    "data": {
      "metadata": {
        "title": "(2단원 10~11차시)인구가 오늘날처럼 분포하게 된 까닭을 알아볼까요",
        "description": "(동아) 5-1 사회 2단원 10~11차시 퀴즈입니다.",
        "totalScore": 90,
        "totalQuestions": 9,
        "createdAt": "2026-06-01T07:25:01.66685+00:00",
        "exportedAt": "2026-06-01T07:28:39.068Z",
        "curriculum": {
          "grade": "5",
          "semester": "1",
          "subject": "social",
          "unit": "2"
        }
      },
      "settings": {
        "allowRetry": true,
        "retryQuestionMode": "same",
        "retryRewardMode": "different",
        "quizMode": "normal",
        "randomPickEnabled": true,
        "randomPickCount": 5,
        "shuffleQuestionsEnabled": false
      },
      "questions": [
        {
          "id": "735ba3f1-8f4a-4913-bf03-3e90729bb2ed",
          "text": "일정한 면적 안에 살고 있는 사람의 수는 ( ㅇㄱ ㅁㄷ )이다.",
          "type": "short",
          "points": 10,
          "shortAnswers": [
            "인구 밀도",
            "인구밀도"
          ],
          "options": [],
          "correctAnswers": []
        },
        {
          "id": "f51a76a8-66f3-4534-9c90-ac7257b9d92f",
          "text": "1960년대 이전 우리나라의 사회에 대해 바르게 설명한 것을 고르시오.",
          "type": "single",
          "points": 10,
          "options": [
            "산업 기반 시설이 많이 갖추어졌다.",
            "대도시가 발달하였다.",
            "벼농사를 주로 하는 농업 사회였다.",
            "조선 산업이 발달하였다."
          ],
          "correctAnswers": [
            2
          ],
          "shortAnswers": []
        },
        {
          "id": "388a0661-ee3d-4843-8e19-5871105c5294",
          "text": "1960년대에는 기후가 온화하고 평야가 많은 (OO)쪽 지역에 많은 사람이 모여 살았다.",
          "type": "short",
          "points": 10,
          "shortAnswers": [
            "남서",
            "남 서"
          ],
          "options": [],
          "correctAnswers": []
        },
        {
          "id": "2571c3fd-143f-4560-8efe-52719d4eb321",
          "text": "1960년대에 주로 이루어진 산업에 해당하는 것을 모두 고르시오.",
          "type": "multiple",
          "points": 10,
          "options": [
            "신발",
            "섬유",
            "중화학 공업",
            "벼농사"
          ],
          "correctAnswers": [
            1,
            0
          ],
          "shortAnswers": []
        },
        {
          "id": "2b0e463b-0813-488f-8385-0725781b1c79",
          "text": "1970년대에 국가적으로 경제성장에 초점을 맞춰 국토를 개발하였다.",
          "type": "single",
          "points": 10,
          "options": [
            "O",
            "X"
          ],
          "correctAnswers": [
            0
          ],
          "shortAnswers": []
        },
        {
          "id": "aca23a58-7c53-4d88-8a44-95574f48d287",
          "text": "1970년대에는 ( ㅅㅇ ) 기반 시설이 잘 갖추어진 곳에 인구가 집중하였다.",
          "type": "short",
          "points": 10,
          "shortAnswers": [
            "산업"
          ],
          "options": [],
          "correctAnswers": []
        },
        {
          "id": "e117c875-fb4c-4516-89bc-f39f4f6d8a4d",
          "text": "1970년대에 인구가 집중된 곳으로 올바른 곳을 모두 고르시오.",
          "type": "multiple",
          "points": 10,
          "options": [
            "수도권",
            "남서쪽 평야 지역",
            "남동쪽 해안 지역",
            "북서쪽 산지 지역"
          ],
          "correctAnswers": [
            2,
            0
          ],
          "shortAnswers": []
        },
        {
          "id": "c94f8389-042a-414e-ae0f-13d84a39a8dc",
          "text": "인구가 집중하면서 발생한 여러 가지 문제로 1990년대 이후 서울 인구는 줄어들고 있지만, 주변 도시들의 인구가 늘어 수도권 전체 인구는 계속 늘어나고 있다.",
          "type": "single",
          "points": 10,
          "options": [
            "O",
            "X"
          ],
          "correctAnswers": [
            0
          ],
          "shortAnswers": []
        },
        {
          "id": "b9cf5814-3bff-415a-897f-24bae0f901b0",
          "text": "우리 나라 인구 불균형은 점차 심해지고 있다.",
          "type": "single",
          "points": 10,
          "options": [
            "O",
            "X"
          ],
          "correctAnswers": [
            0
          ],
          "shortAnswers": []
        }
      ],
      "rewardOptions": [
        {
          "id": "e308de2c-054a-46ee-8c4f-8e70649f5baa",
          "unit": "5-1-social-2",
          "grade": "5",
          "itemId": "g5-s1-social-u2-hat-rural-straw-hat",
          "subject": "social",
          "itemIcon": "👒",
          "itemName": "1960 촌락 벼농사 밀짚모자",
          "itemSlot": "hat",
          "itemType": "avatar",
          "semester": "1",
          "itemImageUrl": "/reward-icons/5/1/social/u2/rural-straw-hat-icon.png",
          "itemSpriteUrl": "/reward-items/5/1/social/hat/rural-straw-hat.png",
          "requiredScore": 0,
          "itemDescription": "5학년 1학기 사회 2단원 보상 모자 아이템입니다. 착용 시 hair_upper 레이어가 숨겨집니다."
        },
        {
          "id": "166f9949-d7ce-4b43-8ef4-0c241c3ea102",
          "unit": "5-1-social-2",
          "grade": "5",
          "itemId": "g5-s1-social-u2-shoes-rice-farming-boots",
          "subject": "social",
          "itemIcon": "🥾",
          "itemName": "1960 벼농사 장화",
          "itemSlot": "shoes",
          "itemType": "avatar",
          "semester": "1",
          "itemImageUrl": "/reward-icons/5/1/social/u2/rice-farming-boots-icon.png",
          "itemSpriteUrl": "/reward-items/5/1/social/shoes/rice-farming-boots.png",
          "requiredScore": 0,
          "itemDescription": "5학년 1학기 사회 2단원 보상 신발 아이템입니다."
        },
        {
          "id": "57cd458c-6f1a-4a89-b4b4-9ccddc3a88e5",
          "unit": "5-1-social-2",
          "grade": "5",
          "itemId": "g5-s1-social-u2-outfit-rural-overalls",
          "subject": "social",
          "itemIcon": "🧑‍🌾",
          "itemName": "1960 벼농사 멜빵바지",
          "itemSlot": "top",
          "itemType": "avatar",
          "semester": "1",
          "itemImageUrl": "/reward-icons/5/1/social/u2/rural-overalls-icon.png",
          "itemSpriteUrl": "/reward-items/5/1/social/top/rural-overalls.png",
          "requiredScore": 0,
          "itemDescription": "5학년 1학기 사회 2단원 보상 상하의 통합 아이템입니다. 착용 시 상의와 하의를 함께 차지합니다."
        }
      ],
      "retryRewardOptions": [
        {
          "id": "2854652f-3957-4db9-88e9-b66070797651",
          "unit": "5-1-social-2",
          "grade": "5",
          "itemId": "g5-s1-social-u2-top-heavy-chemical-industry-uniform-1970",
          "subject": "social",
          "itemIcon": "👕",
          "itemName": "1970 중화학 공업 유니폼",
          "itemSlot": "top",
          "itemType": "avatar",
          "semester": "1",
          "itemImageUrl": "/reward-icons/5/1/social/u2/heavy-chemical-industry-uniform-1970-icon.png",
          "itemSpriteUrl": "/reward-items/5/1/social/top/heavy-chemical-industry-uniform-1970.png",
          "requiredScore": 0,
          "itemDescription": "5학년 1학기 사회 2단원 보상 상의 아이템입니다."
        },
        {
          "id": "f84f40ec-9167-44ec-9609-7cca873714d2",
          "unit": "5-1-social-2",
          "grade": "5",
          "itemId": "g5-s1-social-u2-hat-industrial-safety-helmet",
          "subject": "social",
          "itemIcon": "⛑️",
          "itemName": "1970 중화학 공업 안전모",
          "itemSlot": "hat",
          "itemType": "avatar",
          "semester": "1",
          "itemImageUrl": "/reward-icons/5/1/social/u2/industrial-safety-helmet-icon.png",
          "itemSpriteUrl": "/reward-items/5/1/social/hat/industrial-safety-helmet.png",
          "requiredScore": 0,
          "itemDescription": "5학년 1학기 사회 2단원 보상 모자 아이템입니다. 착용 시 hair_upper 레이어가 숨겨집니다."
        },
        {
          "id": "e8020526-d287-43f7-99e5-e5a1269425ea",
          "unit": "5-1-social-2",
          "grade": "5",
          "itemId": "g5-s1-social-u2-shoes-rice-farming-boots",
          "subject": "social",
          "itemIcon": "🥾",
          "itemName": "1960 벼농사 장화",
          "itemSlot": "shoes",
          "itemType": "avatar",
          "semester": "1",
          "itemImageUrl": "/reward-icons/5/1/social/u2/rice-farming-boots-icon.png",
          "itemSpriteUrl": "/reward-items/5/1/social/shoes/rice-farming-boots.png",
          "requiredScore": 0,
          "itemDescription": "5학년 1학기 사회 2단원 보상 신발 아이템입니다."
        },
        {
          "id": "839f8ef6-9397-4ca2-9f21-88f33da5c76d",
          "unit": "5-1-social-2",
          "grade": "5",
          "itemId": "g5-s1-social-u2-outfit-rural-overalls",
          "subject": "social",
          "itemIcon": "🧑‍🌾",
          "itemName": "1960 벼농사 멜빵바지",
          "itemSlot": "top",
          "itemType": "avatar",
          "semester": "1",
          "itemImageUrl": "/reward-icons/5/1/social/u2/rural-overalls-icon.png",
          "itemSpriteUrl": "/reward-items/5/1/social/top/rural-overalls.png",
          "requiredScore": 0,
          "itemDescription": "5학년 1학기 사회 2단원 보상 상하의 통합 아이템입니다. 착용 시 상의와 하의를 함께 차지합니다."
        },
        {
          "id": "16a2c25f-100f-4a88-9c1e-e7fb6c90076a",
          "unit": "5-1-social-2",
          "grade": "5",
          "itemId": "g5-s1-social-u2-hat-rural-straw-hat",
          "subject": "social",
          "itemIcon": "👒",
          "itemName": "1960 촌락 벼농사 밀짚모자",
          "itemSlot": "hat",
          "itemType": "avatar",
          "semester": "1",
          "itemImageUrl": "/reward-icons/5/1/social/u2/rural-straw-hat-icon.png",
          "itemSpriteUrl": "/reward-items/5/1/social/hat/rural-straw-hat.png",
          "requiredScore": 0,
          "itemDescription": "5학년 1학기 사회 2단원 보상 모자 아이템입니다. 착용 시 hair_upper 레이어가 숨겨집니다."
        }
      ],
      "version": "1.0",
      "curriculum": {
        "grade": "5",
        "semester": "1",
        "subject": "social",
        "unit": "2"
      }
    }
  }
] as BuiltInQuizTemplate[];

export function cloneBuiltInQuizData(template: BuiltInQuizTemplate): QuizExportData {
  return JSON.parse(JSON.stringify(template.data));
}
