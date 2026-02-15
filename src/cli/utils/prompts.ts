import { questionTemplates, type QuestionTemplate } from '../../templates/ai-prompts.js';
import type { QAPair } from '../../services/markdown-processor.js';

export function getAnsweredFields(qaPairs: QAPair[]): string[] {
  const answered: string[] = [];
  for (const pair of qaPairs) {
    if (pair.answer) {
      const template = findTemplateByQuestion(pair.question);
      if (template) {
        answered.push(template.field);
      }
    }
  }
  return answered;
}

function findTemplateByQuestion(question: string): QuestionTemplate | null {
  const normalized = question.trim().toLowerCase();
  for (const template of questionTemplates) {
    if (
      normalized.includes(template.korean.toLowerCase().substring(0, 20)) ||
      normalized.includes(template.english.toLowerCase().substring(0, 20))
    ) {
      return template;
    }
  }
  return null;
}

export function getNextUnansweredQuestion(qaPairs: QAPair[]): QuestionTemplate | null {
  const answeredFields = getAnsweredFields(qaPairs);
  for (const template of questionTemplates) {
    if (!answeredFields.includes(template.field)) {
      return template;
    }
  }
  return null;
}

export function formatQASection(qaPairs: QAPair[], nextQuestion?: QuestionTemplate): string {
  let section = '## AI Refinement Questions\n';

  for (const pair of qaPairs) {
    section += `\n### Q: ${pair.question}\n`;
    if (pair.answer) {
      section += `**A**: ${pair.answer}\n`;
    } else {
      section += '**A**: _[Please provide your answer]_\n';
    }
  }

  if (nextQuestion) {
    section += `\n### Q: ${nextQuestion.korean}\n`;
    section += '**A**: _[Please provide your answer]_\n';
  }

  return section;
}

export function buildInitialQASection(firstQuestion: QuestionTemplate): string {
  let section = '\n---\n\n## AI Refinement Questions\n';
  section += `\n### Q: ${firstQuestion.korean}\n`;
  section += '**A**: _[Please provide your answer]_\n';
  return section;
}
