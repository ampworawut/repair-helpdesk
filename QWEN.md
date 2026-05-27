# Superpowers Methodology for Qwen Code

Adapted from https://github.com/obra/superpowers

## Core Rules

### 1. Brainstorming Before Implementation
- Before ANY feature, bug fix, or behavior change: explore context, ask clarifying questions, propose approaches, present design, get approval
- NEVER write code before presenting a design
- "Simple" projects still need design — unexamined assumptions cause wasted work

### 2. Test-Driven Development (TDD)
- NO production code without a failing test first
- Red → Green → Refactor cycle
- Watch every test fail before implementing
- Write minimal code to pass
- Tests use real code, not mocks unless unavoidable

### 3. Writing Plans Before Coding
- After design approval, create implementation plan with TodoWrite
- Break into small, independent tasks
- One task in_progress at a time

### 4. Verification Before Completion
- Run tests after every change
- Run build/lint/type-check before marking complete
- Verify against original requirements

### 5. Systematic Debugging
- Bug found → write failing test reproducing it → fix → verify
- Never fix bugs without a test

### 6. Code Review
- Review all changes before committing
- Check for: correctness, security, performance, code quality

## Red Flags — STOP and Re-evaluate

| Thought | Reality |
|---------|---------|
| "This is too simple to need a design" | Simple things hide assumptions |
| "I'll test after" | Tests passing immediately prove nothing |
| "Just this once" | That's rationalization |
| "I already manually tested it" | Ad-hoc ≠ systematic |
| "This doesn't need a test" | All behavior changes need tests |

## Skill Priority
1. Process skills first (brainstorming, debugging)
2. Implementation skills second

## User Instructions
Instructions say WHAT, not HOW. "Add X" or "Fix Y" doesn't mean skip workflows.
