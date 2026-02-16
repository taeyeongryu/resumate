# Resumate

AI-powered experience structuring tool for resume building.

Capture career experiences as casual diary entries, refine them through AI-guided conversations, and store them as structured, resume-ready data.

## Installation

### Prerequisites

- Node.js 18 or higher
- npm (Node.js와 함께 설치됨)
- [Claude Code](https://claude.ai/code) (AI 기반 리파인/아카이브 기능 사용 시 필요)

### npm 글로벌 설치

```bash
npm install -g resumate
```

설치 후 `resumate` 명령어를 터미널에서 바로 사용할 수 있습니다.

### 소스에서 직접 빌드

```bash
# 저장소 클론
git clone https://github.com/your-username/resumate.git
cd resumate

# 의존성 설치
npm install

# 빌드
npm run build

# 글로벌 링크 (개발용)
npm link
```

### 설치 확인

```bash
resumate --version
# 1.0.0

resumate --help
```

## Quick Start

### 1단계: 프로젝트 초기화

```bash
resumate init my-career
cd my-career
```

이 명령은 다음 디렉토리 구조를 생성합니다:

```
my-career/
├── .resumate/           # 메타정보 (설정, 내부 데이터)
├── experiences/         # 경험별 디렉토리 (모든 버전 포함)
└── .claude/
    └── commands/        # Claude Code 스킬 정의
        ├── resumate.draft.md
        ├── resumate.refine.md
        └── resumate.archive.md
```

### 2단계: 경험 초안 작성

```bash
resumate add -t "React 성능 최적화" -c "회사명" -r "프론트엔드 개발자"
```

옵션:
- `-t, --title` - 경험 제목 (필수)
- `-c, --company` - 회사명 (필수)
- `-r, --role` - 직책 (필수)
- `-d, --date` - 날짜 (YYYY-MM-DD, 기본값: 오늘)
- `--slug` - 커스텀 슬러그 (기본값: 제목에서 자동 생성)

생성되는 구조:

```
experiences/
└── 2024-06-15-react-performance-optimization/
    └── draft.md      # 초안 (frontmatter + 마크다운)
```

**Claude Code에서 스킬로 작성:**

```
/resumate.draft
```

### 3단계: AI Q&A로 리파인

```bash
resumate refine react-optimization
```

유연한 쿼리를 지원합니다:
- 정확한 날짜: `2024-06-15`
- 부분 날짜: `2024-06` 또는 `2024`
- 슬러그 키워드: `react-optimization`
- 텍스트 검색: `react performance`

또는 Claude Code에서:

```
/resumate.refine react-optimization
```

리파인 과정에서 AI가 다음 질문들을 순서대로 안내합니다:

| 순서 | 질문 항목 | 필수 여부 |
|------|----------|----------|
| 1 | 작업 기간 (시작일/종료일) | **필수** |
| 2 | 성과 및 정량적 지표 | 선택 |
| 3 | 배운 점 | 선택 |
| 4 | 관련 프로젝트/회사 | 선택 |
| 5 | 사용 기술/도구 | 선택 |
| 6 | 개인 소감/향후 계획 | 선택 |

**리파인 워크플로우:**

1. 실행 시 `draft.md`에 첫 번째 질문이 추가됩니다
2. 파일에서 답변을 작성한 뒤 다시 `resumate refine`을 실행하면 다음 질문이 추가됩니다
3. 모든 질문에 답하거나, 답변에 **완료 신호**를 입력하면 `refined.md`가 생성됩니다

**완료 신호** (대소문자 무관):
- 한국어: `충분해`, `완료`, `끝`
- 영어: `done`, `sufficient`, `enough`, `finished`

### 4단계: 아카이브 (AI 구조화)

```bash
resumate archive react-optimization
```

또는 Claude Code에서:

```
/resumate.archive react-optimization
```

아카이브 명령은 두 가지 모드로 동작합니다:

#### AI 모드 (Claude Code 연동)

AI가 Q&A 답변을 분석하여 다음을 수행합니다:
- 자연어 날짜 해석 (예: "3월 말부터 상반기까지" → 구체적 기간 추정)
- 기술명 정규화 (예: "ts" → "TypeScript", "레디스" → "Redis")
- 성과의 이력서용 버전 생성 (예: "반으로 줄임" → "50% 개선")
- Q&A 요약 및 AI 해석 추가
- 완성도 점수 (0-100%) 및 개선 제안

```bash
# Step 1: 구조화 프롬프트 생성
resumate archive --prompt react-optimization

# Step 2: AI가 처리한 결과를 전달
resumate archive --content '<structured-json>' react-optimization
```

#### 독립 실행 모드 (폴백)

Claude Code 없이도 동작합니다. 기존 키워드 매칭으로 데이터를 추출하되, **절대 실패하지 않습니다.** 파싱할 수 없는 필드는 생략하고 가능한 데이터만으로 아카이브를 생성합니다.

```bash
resumate archive react-optimization
```

**최종 경험 디렉토리 구조:**

```
experiences/
└── 2024-06-15-react-optimization/
    ├── draft.md       # 원본 초안 (보존)
    ├── refined.md     # Q&A 리파인 결과 (보존)
    └── archived.md    # 최종 구조화 데이터
```

## Commands

| 명령어 | 설명 | 사용법 |
|--------|------|--------|
| `resumate init <name>` | 프로젝트 초기화 | `resumate init my-career` |
| `resumate update` | Claude Code 스킬 정의 업데이트 | `resumate update` |
| `resumate add` | 새 경험 디렉토리 생성 (draft.md 포함) | `resumate add -t "제목" -c "회사" -r "직책"` |
| `resumate refine <query>` | AI Q&A로 경험 리파인 | `resumate refine react-optimization` |
| `resumate archive <query>` | AI 구조화 아카이브 생성 | `resumate archive react-optimization` |

### archive 옵션

| 옵션 | 설명 |
|------|------|
| `--prompt` | AI 구조화 프롬프트를 JSON으로 출력 (Claude Code 연동용) |
| `--content <json>` | AI가 생성한 구조화 JSON을 받아 archived.md 생성 |
| *(옵션 없음)* | 독립 실행 모드 — 키워드 매칭 기반 best-effort 아카이브 |

### 검색 쿼리

`refine`과 `archive` 명령에서 경험을 찾는 데 사용하는 쿼리 형식:

| 쿼리 형식 | 예시 | 설명 |
|-----------|------|------|
| 정확한 날짜 | `2024-06-15` | ISO 날짜로 정확히 매칭 |
| 부분 날짜 | `2024-06` 또는 `2024` | 년/월로 필터링 |
| 슬러그 키워드 | `react-optimization` | 디렉토리 슬러그로 매칭 |
| 텍스트 검색 | `react performance` | 키워드 기반 텍스트 검색 |
| 디렉토리명 | `2024-06-15-react-optimization` | 정확한 디렉토리명 매칭 |

## Workflow

```
Add (경험 생성) → Edit (사용자 작성) → Refine (AI Q&A) → Archive (AI 구조화)
```

모든 버전이 하나의 경험 디렉토리 안에 보존됩니다:

```
experiences/
└── YYYY-MM-DD-slug/
    ├── draft.md       # 자유 형식 초안
    ├── refined.md     # AI Q&A 리파인 결과
    └── archived.md    # 최종 구조화 포맷
```

## Archived File Format

AI 모드에서 생성되는 아카이브 파일은 YAML frontmatter와 마크다운 본문으로 구성됩니다:

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
  - original: "레디스"
    normalized: "Redis"
achievements:
  - original: "로딩 시간 반으로 줄임"
    resumeReady: "페이지 로딩 시간 50% 개선"
learnings: "성능 최적화의 중요성을 깨달았습니다"
completeness:
  score: 85
  suggestions:
    - "개인적인 소감을 추가하면 경험의 의미를 더 잘 전달할 수 있습니다"
tags:
  - frontend
  - typescript
---

# Detailed Context

TechCorp에서 React 프로젝트의 성능을 최적화하는 작업을 진행했습니다.

## Achievements

- 로딩 시간 반으로 줄임
  → 이력서 작성 시: "페이지 로딩 시간 50% 개선"

## Key Learnings

성능 최적화의 중요성을 깨달았습니다

## Q&A Summary

### Q: 이 작업의 구체적인 기간이 어떻게 되나요?
**A**: 3월 말부터 상반기까지
**해석**: 2024년 3월 말 ~ 6월 말경으로 추정

## AI Comments

기술적 성과가 명확하고 정량적입니다.
```

### 완성도 점수

아카이브 생성 시 경험의 완성도를 0-100%로 평가합니다:

| 필드 | 가중치 | 품질 보너스 |
|------|--------|------------|
| 성과 (achievements) | 25 | 정량적 수치 포함 시 +5 |
| 기간 (duration) | 20 | 구체적 날짜 포함 시 +5 |
| 기술 (technologies) | 15 | 3개 초과 시 +3 |
| 배운 점 (learnings) | 15 | 상세 기술 시 +3 |
| 제목 (title) | 10 | - |
| 프로젝트 (project) | 10 | - |
| 소감 (reflections) | 5 | - |

### 자동 태그 생성

기술 스택에서 태그가 자동으로 매핑됩니다:

| 기술 | 태그 |
|------|------|
| React, Vue, Angular | `frontend` |
| Next.js | `frontend`, `fullstack` |
| Node.js, Express, Python, Django | `backend` |
| Docker, Kubernetes | `devops` |
| PostgreSQL, MongoDB | `database` |
| Redis | `database`, `caching` |
| TypeScript | `typescript` |

## Development

### 개발 환경 설정

```bash
git clone https://github.com/your-username/resumate.git
cd resumate
npm install
```

### 주요 스크립트

```bash
# 빌드
npm run build

# 개발 모드 (TypeScript 감시)
npm run dev

# 테스트 실행
npm test

# 테스트 감시 모드
npm run test:watch

# 린트
npm run lint

# 포맷팅
npm run format
```

### 프로젝트 구조

```
src/
├── cli/
│   ├── commands/              # CLI 명령어 구현
│   │   ├── init.ts            # 프로젝트 초기화
│   │   ├── add.ts             # 경험 디렉토리 생성
│   │   ├── refine.ts          # AI Q&A 리파인
│   │   └── archive.ts         # AI 구조화 아카이브
│   ├── utils/
│   │   ├── validation.ts      # 검증, 파싱, AI 응답 검증
│   │   └── prompts.ts         # Q&A 포맷팅 유틸리티
│   └── index.ts               # CLI 엔트리포인트
├── models/
│   ├── config.ts              # 프로젝트 설정 인터페이스
│   └── experience.ts          # 경험 데이터 모델 및 AI 구조화 타입
├── services/
│   ├── experience-manager.ts  # 경험 디렉토리 CRUD
│   ├── experience-locator.ts  # 경험 검색 및 매칭
│   ├── archive-analyzer.ts    # 아카이브 분석 및 완성도 평가
│   ├── draft-analyzer.ts      # 초안 분석 (필드 감지, 언어/유형 판별)
│   ├── file-manager.ts        # 파일 I/O 작업
│   ├── markdown-processor.ts  # 마크다운/frontmatter 파싱
│   └── slug-generator.ts      # 파일명 슬러그 생성
└── templates/
    ├── ai-prompts.ts          # 리파인/아카이브 AI 프롬프트 생성
    └── skills/                # Claude Code 스킬 템플릿
tests/
├── unit/                      # 단위 테스트
│   ├── commands/
│   ├── models/
│   ├── services/
│   ├── utils/
│   └── templates/
└── integration/               # 통합 테스트
    ├── commands/
    └── search-scenarios.test.ts
```

### 기술 스택

- **Language:** TypeScript (ES2022, Node16 모듈)
- **CLI Framework:** Commander.js
- **File Operations:** fs-extra
- **Markdown Parsing:** gray-matter
- **Slug Generation:** slugify
- **Date Handling:** date-fns
- **Test Framework:** Vitest

## License

MIT
