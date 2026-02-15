# Resumate

AI-powered experience structuring tool for resume building.

Capture career experiences as casual diary entries, refine them through AI-guided conversations, and store them as structured, resume-ready data.

## Installation

### Prerequisites

- Node.js 18 or higher
- npm (Node.js와 함께 설치됨)
- [Claude Code](https://claude.ai/code) (AI 기반 리파인 기능 사용 시 필요)

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
# 0.1.0

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
├── .resumate/
│   ├── drafts/        # 자유 형식 경험 초안
│   ├── in-progress/   # AI Q&A 리파인 진행 중
│   └── archive/       # 최종 구조화 데이터
└── .claude/
    └── commands/      # Claude Code 스킬 정의
        ├── resumate.draft.md
        ├── resumate.refine.md
        └── resumate.archive.md
```

### 2단계: 경험 초안 작성

**CLI에서 직접 작성:**

```bash
resumate draft "# React 성능 최적화 프로젝트\n\n회사 대시보드의 로딩 속도를 개선했다. 기존에 5초 걸리던 초기 렌더링을 2초대로 줄였고, React.memo와 useMemo를 활용한 최적화를 진행했다."
```

**Claude Code에서 스킬로 작성:**

```
/resumate.draft
```

Claude Code 내에서 대화형으로 경험을 작성할 수 있습니다.

작성된 초안은 `.resumate/drafts/` 디렉토리에 `YYYY-MM-DD-slug.md` 형식으로 저장됩니다. 동일한 제목이 있으면 자동으로 `-1`, `-2` 등의 번호가 붙습니다.

### 3단계: AI Q&A로 리파인

```bash
resumate refine @2024-06-15-react-성능-최적화-프로젝트
```

또는 Claude Code에서:

```
/resumate.refine @2024-06-15-react-성능-최적화-프로젝트
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

1. 첫 실행 시 파일이 `drafts/` → `in-progress/`로 이동되고, 첫 번째 질문이 추가됩니다
2. 파일에서 답변을 작성한 뒤 다시 `resumate refine`을 실행하면 다음 질문이 추가됩니다
3. 모든 질문에 답하거나, 답변에 **완료 신호**를 입력하면 리파인이 종료됩니다

**완료 신호** (대소문자 무관):
- 한국어: `충분해`, `완료`, `끝`
- 영어: `done`, `sufficient`, `enough`, `finished`

**날짜 형식 지원:**
- ISO: `2024-01-15`
- 한국어: `2024년 1월 15일`
- 영어: `January 15, 2024`

### 4단계: 아카이브 (구조화)

```bash
resumate archive 2024-06-15-react-성능-최적화-프로젝트
```

또는 Claude Code에서:

```
/resumate.archive 2024-06-15-react-성능-최적화-프로젝트
```

아카이브 명령은 Q&A 답변에서 자동으로 데이터를 추출하여 YAML frontmatter가 포함된 구조화된 마크다운 파일을 생성합니다.

**아카이브 필수 조건:**
- 파일이 `in-progress/`에 있어야 함 (리파인을 먼저 실행)
- Q&A 섹션이 존재해야 함
- 제목, 날짜, 기간(시작일/종료일)이 있어야 함

## Commands

| 명령어 | 설명 | 사용법 |
|--------|------|--------|
| `resumate init <name>` | 프로젝트 초기화 | `resumate init my-career` |
| `resumate draft <text>` | 경험 초안 작성 | `resumate draft "# 제목\n\n내용"` |
| `resumate refine <file>` | AI Q&A로 경험 리파인 | `resumate refine @파일명` |
| `resumate archive <file>` | 구조화된 최종 포맷으로 변환 | `resumate archive 파일명` |

**파일명 참고:**
- `@` 접두사는 자동으로 제거됩니다
- `.md` 확장자가 없으면 자동으로 추가됩니다
- 예: `@2024-06-15-my-project` → `2024-06-15-my-project.md`

## Workflow

```
Draft (자유 형식) → Refine (AI Q&A) → Archive (구조화 YAML)
```

파일은 세 디렉토리를 거쳐 이동합니다:

```
.resumate/
├── drafts/        # 자유 형식 경험 초안
├── in-progress/   # AI Q&A 리파인 진행 중
└── archive/       # 최종 구조화 포맷
```

## Archived File Format

아카이브된 파일은 YAML frontmatter와 마크다운 본문으로 구성됩니다:

```yaml
---
title: "React Performance Optimization"
date: "2024-06-15"
duration:
  start: "2024-02-01"
  end: "2024-06-15"
project: "Company Dashboard"
technologies:
  - React
  - TypeScript
  - Redis
achievements:
  - "Reduced load time by 50%"
  - "Handled 1M daily requests"
learnings: "Learned the importance of memoization..."
reflections: "This was a transformative experience..."
tags:
  - frontend
  - typescript
  - database
---

# Detailed Context

Your original experience text...

## Achievements

- Reduced load time by 50%
- Handled 1M daily requests

## Key Learnings

Learned the importance of memoization...
```

**자동 태그 생성:** 기술 스택에서 태그가 자동으로 매핑됩니다:

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
│   ├── commands/          # CLI 명령어 구현
│   │   ├── init.ts        # 프로젝트 초기화
│   │   ├── draft.ts       # 초안 작성
│   │   ├── refine.ts      # AI Q&A 리파인
│   │   └── archive.ts     # 구조화 아카이브
│   ├── utils/
│   │   ├── validation.ts  # 파일명/날짜 검증 및 파싱
│   │   └── prompts.ts     # Q&A 포맷팅 유틸리티
│   └── index.ts           # CLI 엔트리포인트
├── models/
│   ├── config.ts          # 프로젝트 설정 인터페이스
│   └── experience.ts      # 경험 데이터 모델
├── services/
│   ├── file-manager.ts    # 파일 I/O 작업
│   ├── markdown-processor.ts  # 마크다운/frontmatter 파싱
│   ├── slug-generator.ts  # 파일명 슬러그 생성
│   └── workflow-manager.ts    # 파일 상태 전환 관리
└── templates/
    ├── ai-prompts.ts      # 질문 템플릿 및 완료 신호
    └── skills/            # Claude Code 스킬 템플릿
tests/
├── unit/                  # 단위 테스트
│   ├── services/
│   ├── utils/
│   └── templates/
└── integration/           # 통합 테스트
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
