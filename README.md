# Resumate

AI-powered experience structuring tool for resume building.

Capture career experiences as casual diary entries, refine them through AI-guided conversations, and store them as structured, resume-ready data.

## Installation

### Prerequisites

- Node.js 18 or higher
- Claude Code (for AI-guided refinement)

### Install

```bash
npm install -g resumate
```

## Quick Start

### 1. Initialize a project

```bash
resumate init my-career
cd my-career
```

### 2. Create a draft (in Claude Code)

```
/resumate draft
```

Write about your experience naturally - like a diary entry.

### 3. Refine with AI

```
/resumate refine @2024-02-15-your-experience
```

Answer AI-guided questions to extract structured information.

### 4. Archive

```
/resumate archive 2024-02-15-your-experience
```

Your experience is converted to structured format with YAML frontmatter.

## Commands

| Command | Description |
|---------|-------------|
| `resumate init <name>` | Initialize project structure |
| `resumate draft <text>` | Create a new experience draft |
| `resumate refine <file>` | Refine a draft through AI Q&A |
| `resumate archive <file>` | Convert to final structured format |

## Workflow

```
Draft (free-form) → Refine (AI Q&A) → Archive (structured YAML)
```

Files move through three directories:

```
.resumate/
├── drafts/        # Free-form experiences
├── in-progress/   # Being refined with AI
└── archive/       # Final structured format
```

## Archived File Format

```yaml
---
title: "React Performance Optimization"
date: 2024-02-15
duration:
  start: 2024-02-01
  end: 2024-02-15
project: "Company Dashboard"
technologies:
  - React
  - TypeScript
achievements:
  - "Reduced load time by 50%"
tags:
  - frontend
  - optimization
---

# Detailed Context

Your original experience text...
```

## License

MIT
