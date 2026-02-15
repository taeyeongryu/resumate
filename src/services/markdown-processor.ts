import matter from 'gray-matter';

export interface ParsedMarkdown {
  data: Record<string, unknown>;
  content: string;
}

export function parseMarkdown(raw: string): ParsedMarkdown {
  const { data, content } = matter(raw);
  return { data, content };
}

export function stringifyMarkdown(content: string, frontmatter: Record<string, unknown>): string {
  return matter.stringify(content, frontmatter);
}

export function extractTitle(content: string): string {
  const lines = content.trim().split('\n');
  for (const line of lines) {
    const match = line.match(/^#\s+(.+)$/);
    if (match) {
      return match[1].trim();
    }
  }
  const firstLine = lines[0]?.trim() || '';
  return firstLine.length > 50 ? firstLine.substring(0, 50) : firstLine;
}

export function extractQASection(
  content: string,
): { originalContent: string; qaSection: string } | null {
  const separator = '\n---\n';
  const qaHeader = '## AI Refinement Questions';
  const separatorIdx = content.indexOf(separator);

  if (separatorIdx === -1) {
    return null;
  }

  const afterSeparator = content.substring(separatorIdx + separator.length);
  if (!afterSeparator.includes(qaHeader)) {
    return null;
  }

  return {
    originalContent: content.substring(0, separatorIdx).trim(),
    qaSection: afterSeparator.trim(),
  };
}

export interface QAPair {
  question: string;
  answer: string | undefined;
}

export function parseQAPairs(qaSection: string): QAPair[] {
  const pairs: QAPair[] = [];
  const questionRegex = /### Q:\s*(.+)/g;
  const matches = [...qaSection.matchAll(questionRegex)];

  for (let i = 0; i < matches.length; i++) {
    const question = matches[i][1].trim();
    const startIdx = matches[i].index! + matches[i][0].length;
    const endIdx = i + 1 < matches.length ? matches[i + 1].index! : qaSection.length;
    const answerBlock = qaSection.substring(startIdx, endIdx).trim();

    const answerMatch = answerBlock.match(/\*\*A\*\*:\s*([\s\S]*)/);
    let answer: string | undefined;
    if (answerMatch) {
      const raw = answerMatch[1].trim();
      if (raw && raw !== '_[Please provide your answer]_') {
        answer = raw;
      }
    }

    pairs.push({ question, answer });
  }

  return pairs;
}
