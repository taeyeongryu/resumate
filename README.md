# Resumate

커리어 경험을 자유롭게 기록하고, AI와의 대화를 통해 이력서에 바로 쓸 수 있는 구조화된 데이터로 변환합니다.

## Installation

```bash
npm install -g resumate
```

**필수 요건:** Node.js 18+, [Claude Code](https://claude.ai/code)

## 사용법

### 1. 프로젝트 만들기

```bash
resumate init my-career
cd my-career
```

이 폴더에서 Claude Code를 실행하면 Resumate 스킬을 사용할 수 있습니다.

### 2. 경험 기록하기

Claude Code에서 `/resumate.draft`를 실행하면 AI가 제목, 회사명, 직책을 물어보고 초안 파일을 만들어줍니다.

파일을 열어 경험을 자유롭게 작성합니다. 형식에 구애받지 않고 편하게 쓰면 됩니다:

```markdown
회사에서 대시보드 프로젝트의 로딩 속도가 너무 느려서 최적화 작업을 했다.
React.memo랑 useMemo를 적극적으로 활용하고, 번들 사이즈도 줄였다.
결과적으로 로딩 시간을 반으로 줄였다. 사용한 기술은 react, ts, 레디스.
```

### 3. AI Q&A로 다듬기

Claude Code에서 `/resumate.refine react-optimization`을 실행하면 AI가 초안을 분석하고 부족한 정보를 질문합니다:

> "작업 기간은 어떻게 되나요?"
> "구체적인 성과 지표가 있나요?"

질문에 답변을 작성하고 다시 `/resumate.refine`을 실행하면 다음 질문이 이어집니다. 충분하면 `완료` 또는 `done`을 입력합니다.

### 4. 이력서용 데이터로 변환하기

Claude Code에서 `/resumate.archive react-optimization`을 실행하면 AI가 최종 구조화를 수행합니다:

- **기술명 정규화** — "ts" → "TypeScript", "레디스" → "Redis"
- **성과 변환** — "로딩 시간 반으로 줄임" → "페이지 로딩 시간 50% 개선"
- **날짜 해석** — "3월 말부터 상반기까지" → 2024-03-31 ~ 2024-06-30
- **완성도 평가** — 0-100% 점수와 개선 제안

## 결과물 예시

```yaml
---
title: "React 성능 최적화"
date: "2024-06-15"
duration:
  original: "3월 말부터 상반기까지"
  start: "2024-03-31"
  end: "2024-06-30"
  interpretation: "2024년 3월 말 ~ 6월 말 (약 3개월)"
project: "TechCorp Dashboard"
technologies:
  - original: "react"
    normalized: "React"
  - original: "ts"
    normalized: "TypeScript"
achievements:
  - original: "로딩 시간 반으로 줄임"
    resumeReady: "페이지 로딩 시간 50% 개선"
completeness:
  score: 85
  suggestions:
    - "개인적인 소감을 추가하면 더 좋습니다"
tags:
  - frontend
  - typescript
---
```

## 스킬 요약

| 스킬 | 설명 |
|------|------|
| `/resumate.draft` | 새 경험 초안 생성 |
| `/resumate.refine <검색어>` | AI Q&A로 경험 다듬기 |
| `/resumate.archive <검색어>` | 이력서용 구조화 데이터 생성 |

검색어는 슬러그(`react-optimization`), 날짜(`2024-06`), 키워드(`react performance`) 등 유연하게 사용할 수 있습니다.

스킬 정의를 최신 버전으로 업데이트하려면 `resumate update`를 실행합니다.

## License

MIT
