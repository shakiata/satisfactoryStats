---
description: "Systematic refactoring guide - process suggestions.md items one by one with testing, no error hiding, and documentation updates"
applyTo: "**/*.{ts,js,py,java,go,rb,php,cs,cpp,h,hpp,rs,swift,kt,scala,r,m}"
---

# Refactor Instructions

## Core Principles

### 1. Methodology

- Process items from `suggestions.md` **one at a time, sequentially**
- For each item, create a complete implementation plan before writing code
- Follow industry best practices for the specific technology/framework in use
- Make corrections that solve the root cause, not symptoms

### 2. Testing Requirements

- Test after EVERY single correction
- Write new tests when existing test coverage is insufficient
- Tests must validate the fix AND ensure no regressions
- Run the full test suite after each change
- If tests fail, fix the issue immediately before proceeding

### 3. Error Handling

- **NEVER create fallbacks to hide errors**
- If an error occurs, expose it completely
- Fix the actual error, don't mask it
- Log errors with full context for debugging
- No silent error suppression
- No try-catch blocks that swallow exceptions without proper handling

### 4. Code Quality

- Write concise, clear logic
- Avoid unnecessary abstractions
- Remove dead code and redundant operations
- Use meaningful variable and function names
- Follow DRY (Don't Repeat Yourself) principles

### 5. Documentation

- Keep all documentation up to date
- If documentation is missing, create it
- Document complex logic and business rules
- Update README files, API docs, and inline comments as needed
- After changes, verify documentation reflects current state

## Process Per Item

### Step 1: Analysis

- Read the item from `suggestions.md`
- Understand the current implementation
- Identify all affected files and dependencies
- Ask clarification questions if anything is ambiguous

### Step 2: Planning

- Draft implementation approach
- List files to be modified/created
- Identify tests needed
- Consider edge cases and potential side effects
- Plan rollback strategy if applicable

### Step 3: Implementation

- Make minimal, targeted changes
- Follow existing code conventions (unless they violate best practices)
- Write new tests if needed
- Run existing tests to catch regressions

### Step 4: Verification

- Run full test suite
- Verify the fix resolves the original issue
- Check for unintended consequences
- Manual verification if automated tests don't cover the scenario

### Step 5: Documentation Update

- Update relevant documentation
- Add comments explaining non-obvious decisions
- Update changelog if applicable

## Self-Check Protocol

After EVERY completed item:

1. Re-read this instructions file
2. Re-read `suggestions.md` to confirm next item
3. Verify all tests pass
4. Confirm no fallback error handling was introduced
5. Check that documentation is current

## Questions to Ask Before Starting Each Item

- What is the exact problem described?
- What is the expected behavior?
- Are there dependencies on other items in `suggestions.md`?
- What testing strategy will validate this fix?
- Are there performance implications?
- Will this change affect other functionality?

## Prohibited Patterns

❌ Try-catch blocks that log and continue without proper handling
❌ Default fallback values that mask missing data
❌ Silent returns when errors occur
❌ Commenting out failing code instead of fixing it
❌ Adding "TODO" comments without corresponding tracking issues
❌ Overly defensive programming that obscures real problems

## Success Criteria

For each item, confirm:

- [ ] Root cause is addressed
- [ ] All tests pass (existing and new)
- [ ] No error hiding or fallback patterns
- [ ] Code is concise and readable
- [ ] Documentation is updated
- [ ] No regressions introduced
- [ ] Instructions file has been re-read before proceeding to next item
