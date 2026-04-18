# 'alchemy consult' Implementation Plan

> **For Gemini:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a command that provides a deep scientific briefing and explanation for a specific experiment ID.

**Architecture:** The command will read the `protocol.md` and database metadata for a given experiment ID and output a structured "Scientific Briefing" to the console.

**Tech Stack:** Node.js, TypeScript, YAML (for frontmatter parsing).

---

### Task 1: Protocol Parsing Logic

**Files:**
- Modify: `src/lib/protocols.ts`
- Test: `tests/lib/protocols.test.ts`

**Step 1: Write a function to read and parse a protocol file**
Implement `getExperimentContext(id: string)` which reads the protocol Markdown and extracts the YAML frontmatter and the procedure text.

**Step 2: Write failing test**
Verify that the parser correctly extracts the `hypothesis` and `title` from a mock protocol file.

**Step 3: Implement minimal code**
Use a regex or simple YAML parser to extract the metadata.

**Step 4: Commit**
```bash
git add src/lib/protocols.ts tests/lib/protocols.test.ts
git commit -m "feat: add protocol parsing logic"
```

### Task 2: The 'alchemy consult' Command

**Files:**
- Modify: `src/cli/index.ts`
- Create: `src/lib/consultant.ts`

**Step 1: Implement the briefing generator**
In `src/lib/consultant.ts`, write a function that takes the protocol context and formats a "Scientific Briefing" string.

**Step 2: Hook up the CLI command**
Add `alchemy consult <id>` to `src/cli/index.ts`.

**Step 3: Manual Verification**
Run `make run ARGS='consult EXP-001'` and verify the output is helpful and well-formatted.

**Step 4: Commit**
```bash
git add src/cli/index.ts src/lib/consultant.ts
git commit -m "feat: implement alchemy consult command"
```
