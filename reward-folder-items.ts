import { Quiz, QuizExportData, QuizQuestion, QuizRewardOption } from './types';

/**
 * 퀴즈를 JSON으로 내보내기
 */
export function exportQuizToJSON(quiz: Quiz): QuizExportData {
  return {
    metadata: {
      title: quiz.title,
      description: quiz.description,
      totalScore: quiz.totalScore,
      totalQuestions: quiz.questions.length,
      createdAt: quiz.createdAt,
      exportedAt: new Date().toISOString(),
    },
    settings: {
      allowRetry: quiz.allowRetry || false,
      retryQuestionMode: quiz.retryQuestionMode,
      retryRewardMode: quiz.retryRewardMode,
      quizMode: quiz.quizMode || 'normal',
      randomPickEnabled: quiz.randomPickEnabled || false,
      randomPickCount: quiz.randomPickCount,
      shuffleQuestionsEnabled: quiz.shuffleQuestionsEnabled || false,
    },
    questions: quiz.questions,
    rewardOptions: quiz.rewardOptions,
    retryRewardOptions: quiz.retryRewardOptions || [],
    version: '1.0',
  };
}

/**
 * 퀴즈 JSON을 파일로 다운로드
 */
export function downloadQuizJSON(quiz: Quiz): void {
  const exportData = exportQuizToJSON(quiz);
  const jsonString = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${quiz.title.replace(/\s+/g, '_')}_${new Date().getTime()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * JSON 파일에서 퀴즈 데이터 로드 (검증 포함)
 */
export async function importQuizFromJSON(file: File): Promise<QuizExportData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content) as QuizExportData;

        // 필수 필드 검증
        if (!data.metadata || !data.settings || !Array.isArray(data.questions) || !Array.isArray(data.rewardOptions)) {
          throw new Error('필수 필드가 누락되었습니다. (metadata, settings, questions, rewardOptions)');
        }

        if (!data.metadata.title || !data.metadata.totalScore) {
          throw new Error('퀴즈 제목과 총점은 필수입니다.');
        }

        if (data.questions.length === 0) {
          throw new Error('최소 1개 이상의 문제가 필요합니다.');
        }

        resolve(data);
      } catch (error) {
        reject(new Error(`JSON 파일 읽기 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`));
      }
    };
    reader.onerror = () => {
      reject(new Error('파일 읽기 실패'));
    };
    reader.readAsText(file);
  });
}

/**
 * 퀴즈 미리보기 생성
 */
export function generateQuizPreview(data: QuizExportData): string {
  return `
📋 퀴즈 미리보기
━━━━━━━━━━━━━━━━━━━━━━━━
제목: ${data.metadata.title}
설명: ${data.metadata.description || '(없음)'}
총점: ${data.metadata.totalScore}점
문제 수: ${data.metadata.totalQuestions}개

⚙️ 설정
━━━━━━━━━━━━━━━━━━━━━━━━
모드: ${data.settings.quizMode === 'live' ? '함께 풀기' : '일반'}
재도전: ${data.settings.allowRetry ? '허용' : '불허'}
랜덤 출제: ${data.settings.randomPickEnabled ? `허용 (${data.settings.randomPickCount}문제)` : '불허'}
문제 순서 섞기: ${data.settings.shuffleQuestionsEnabled ? '예' : '아니오'}

🎁 보상 옵션
━━━━━━━━━━━━━━━━━━━━━━━━
${data.rewardOptions.map(r => `• ${r.requiredScore}점 이상: ${r.itemName}`).join('\n')}

🔁 재도전 전용 보상
━━━━━━━━━━━━━━━━━━━━━━━━
${(data.retryRewardOptions || []).length > 0 ? (data.retryRewardOptions || []).map(r => `• ${r.requiredScore}점 이상: ${r.itemName}`).join('\n') : '없음'}
  `.trim();
}
