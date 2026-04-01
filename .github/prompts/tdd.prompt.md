---
name: 'tdd'
description: 'Test-driven development with strict RED-GREEN-REFACTOR enforcement.'
agent: 'agent'
tools:
  - 'read_file'
  - 'edit_file'
  - 'run_in_terminal'
  - 'run_tests'
argument-hint: '<feature or behavior to implement>'
---

# Test-Driven Development

Implement ${input} using strict TDD.

## Iron Law
`NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST`

## Cycle

### RED — Write a failing test
Write a test that defines the expected behavior BEFORE writing any production code.
- The test **MUST fail** before you write production code
- If the test passes without changes, your test is wrong — rewrite it

### GREEN — Write the minimum production code
Write the **minimum** production code to make the test pass.
- Do NOT write more than necessary
- Do NOT optimize
- Do NOT refactor

### REFACTOR — Clean up without changing behavior
Improve the code while keeping all tests green.
- All tests must still pass after refactoring
- If any test fails, your refactor changed behavior — revert

## Red Flags — If You Catch Yourself Thinking:

| Thought | Reality |
|---|---|
| "I'll write the implementation first, then add tests" | That's not TDD. Write the test FIRST. |
| "This is too simple to test" | If it's too simple to test, it's simple enough to test quickly. |
| "I'll write all the tests first, then implement" | One test at a time. RED-GREEN-REFACTOR. One cycle. |
| "The test is basically the same as the implementation" | Then you're testing implementation, not behavior. Rewrite the test. |

## Rules
- ONE test at a time, ONE cycle at a time
- NEVER skip RED — if the test doesn't fail first, it proves nothing
- NEVER skip REFACTOR — clean code is part of the deliverable
- Commit after each GREEN (passing test + minimal implementation)
