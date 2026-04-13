---
name: tdd
description: "Test-driven development with strict RED-GREEN-REFACTOR enforcement. Enforces: write failing test first, minimal implementation, then refactor. Use when adding new features or fixing bugs."
user-invocable: true
---

# Test-Driven Development

## Iron Law
`NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST`

## Cycle

### RED — Write a failing test
Write a test that defines the expected behavior BEFORE writing any production code.
- The test **MUST fail** before you write production code
- If the test passes without any changes, your test is wrong — rewrite it
- The test should describe behavior, not implementation
- Ask: does this test break if I rewrite the implementation with a completely different approach? If not, you're testing behavior correctly.

### GREEN — Write the minimum production code
Write the **minimum** production code to make the test pass.
- Do NOT write more than necessary
- Do NOT optimize
- Do NOT refactor
- Ugly code that passes is correct at this stage

### REFACTOR — Clean up without changing behavior
Improve the code while keeping all tests green.
- All tests must still pass after refactoring
- Improve naming, extract functions, remove duplication
- If any test fails after refactoring, your refactor changed behavior — revert

## Red Flags — If You Catch Yourself Thinking:

| Thought | Reality |
|---|---|
| "I'll write the implementation first, then add tests" | That's not TDD. Write the test FIRST. |
| "This is too simple to test" | If it's too simple to test, it's simple enough to test quickly. |
| "I'll write all the tests first, then implement" | One test at a time. RED-GREEN-REFACTOR. One cycle. |
| "The test is basically the same as the implementation" | Then you're testing implementation, not behavior. Rewrite the test. |
| "The code is already clean, REFACTOR isn't needed this cycle" | REFACTOR isn't just cleanup. It's where you spot naming issues, extract patterns, reduce duplication. Run it. 30 seconds minimum. |

## Rules
- ONE test at a time, ONE cycle at a time
- NEVER skip RED — if the test doesn't fail first, it proves nothing
- NEVER skip REFACTOR — clean code is part of the deliverable
- Commit after each GREEN (passing test + minimal implementation)
