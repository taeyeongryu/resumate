import { extractTitle, extractQASection, parseQAPairs, parseMarkdown } from './markdown-processor.js';
import { detectLanguage, detectExperienceType } from './draft-analyzer.js';
import type { ArchiveAnalysis, CompletenessAssessment, FieldCompleteness } from '../models/experience.js';

export function analyzeRefined(
  refinedContent: string,
  dateStr: string,
): ArchiveAnalysis {
  // Parse frontmatter from the full content first
  const parsed = parseMarkdown(refinedContent);
  const contentWithoutFrontmatter = parsed.content;

  // Extract Q&A section from the content without frontmatter
  const qaResult = extractQASection(contentWithoutFrontmatter);

  const originalContent = qaResult ? qaResult.originalContent : contentWithoutFrontmatter;
  const qaPairs = qaResult ? parseQAPairs(qaResult.qaSection) : [];
  const title = (parsed.data.title as string) || extractTitle(originalContent);
  const language = detectLanguage(originalContent);
  const experienceType = detectExperienceType(originalContent);

  return {
    title,
    dateStr,
    originalContent,
    qaPairs,
    language,
    experienceType,
  };
}

const FIELD_WEIGHTS: Record<string, number> = {
  title: 10,
  duration: 20,
  achievements: 25,
  technologies: 15,
  learnings: 15,
  project: 10,
  reflections: 5,
};

const TOTAL_WEIGHT = Object.values(FIELD_WEIGHTS).reduce((a, b) => a + b, 0);

export interface CompletenessInput {
  title?: string;
  duration?: unknown;
  achievements?: string[] | unknown[];
  technologies?: string[] | unknown[];
  learnings?: string;
  project?: string;
  reflections?: string;
}

export function calculateCompleteness(data: CompletenessInput): CompletenessAssessment {
  const breakdown: Record<string, FieldCompleteness> = {};
  const suggestions: string[] = [];
  let weightedScore = 0;

  // Title
  const hasTitle = !!data.title && data.title.trim().length > 0;
  breakdown.title = { present: hasTitle, weight: FIELD_WEIGHTS.title, qualityScore: hasTitle ? 1 : 0 };
  if (hasTitle) weightedScore += FIELD_WEIGHTS.title;

  // Duration
  const hasDuration = !!data.duration;
  let durationQuality = hasDuration ? 0.7 : 0;
  if (hasDuration && typeof data.duration === 'object' && data.duration !== null) {
    const d = data.duration as Record<string, unknown>;
    if (d.start && d.end) durationQuality = 1;
  }
  breakdown.duration = { present: hasDuration, weight: FIELD_WEIGHTS.duration, qualityScore: durationQuality };
  if (hasDuration) weightedScore += FIELD_WEIGHTS.duration * durationQuality;
  if (!hasDuration) suggestions.push('기간 정보를 추가하면 이력서에서 경험의 맥락을 명확히 전달할 수 있습니다');

  // Achievements
  const hasAchievements = !!data.achievements && data.achievements.length > 0;
  let achievementQuality = hasAchievements ? 0.7 : 0;
  if (hasAchievements) {
    const texts = data.achievements!.map(a => typeof a === 'string' ? a : JSON.stringify(a));
    const hasQuantitative = texts.some(a => /\d+\s*%|\d+배|\d+\s*times/i.test(a));
    if (hasQuantitative) achievementQuality = 1;
    else suggestions.push('성과에 구체적인 수치를 추가하면 이력서 작성 시 더 효과적입니다 (예: "50% 개선", "3배 증가")');
  }
  breakdown.achievements = { present: hasAchievements, weight: FIELD_WEIGHTS.achievements, qualityScore: achievementQuality };
  if (hasAchievements) weightedScore += FIELD_WEIGHTS.achievements * achievementQuality;
  if (!hasAchievements) suggestions.push('주요 성과나 결과를 추가하면 이력서의 설득력이 높아집니다');

  // Technologies
  const hasTech = !!data.technologies && data.technologies.length > 0;
  let techQuality = hasTech ? 0.7 : 0;
  if (hasTech && data.technologies!.length > 3) techQuality = 1;
  breakdown.technologies = { present: hasTech, weight: FIELD_WEIGHTS.technologies, qualityScore: techQuality };
  if (hasTech) weightedScore += FIELD_WEIGHTS.technologies * techQuality;
  if (!hasTech) suggestions.push('사용한 기술 스택을 명시하면 기술 역량을 효과적으로 어필할 수 있습니다');

  // Learnings
  const hasLearnings = !!data.learnings && data.learnings.trim().length > 0;
  let learningsQuality = hasLearnings ? 0.7 : 0;
  if (hasLearnings && data.learnings!.trim().length > 50) learningsQuality = 1;
  breakdown.learnings = { present: hasLearnings, weight: FIELD_WEIGHTS.learnings, qualityScore: learningsQuality };
  if (hasLearnings) weightedScore += FIELD_WEIGHTS.learnings * learningsQuality;
  if (!hasLearnings) suggestions.push('배운 점을 기록하면 성장 과정을 보여줄 수 있습니다');

  // Project
  const hasProject = !!data.project && data.project.trim().length > 0;
  breakdown.project = { present: hasProject, weight: FIELD_WEIGHTS.project, qualityScore: hasProject ? 1 : 0 };
  if (hasProject) weightedScore += FIELD_WEIGHTS.project;
  if (!hasProject) suggestions.push('프로젝트나 회사 정보를 추가하면 경험의 맥락이 명확해집니다');

  // Reflections
  const hasReflections = !!data.reflections && data.reflections.trim().length > 0;
  breakdown.reflections = { present: hasReflections, weight: FIELD_WEIGHTS.reflections, qualityScore: hasReflections ? 1 : 0 };
  if (hasReflections) weightedScore += FIELD_WEIGHTS.reflections;

  const score = Math.round((weightedScore / TOTAL_WEIGHT) * 100);

  return { score, breakdown, suggestions };
}
