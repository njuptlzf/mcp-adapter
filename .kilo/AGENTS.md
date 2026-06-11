# Kilo Agent Instructions


## 回复语言
使用中文思考和回答问题。

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## 5. search_replace Safety (Empirical 2026-06-05)

**Iron Law**: `original_text` MUST include **right-side context** (at least 1 line after the change point) when replacing near critical HTML/XML tags. Critical tags: `</head>`, `</body>`, `</script>`, `</style>`, closing tags of paired wrappers.

**The 4 principles**:
1. **Right-side context**: When the change point is in the middle of a multi-line block (e.g. CSS inside `<style>`), include at least 1 line AFTER the change in `original_text`. The tool matches literally — if you only match up to the change point, you may inadvertently delete the trailing context.
2. **Length check**: After `new_text`, verify the line count is `>=` the count of unchanged portions. If `new_text` is shorter than `original_text` minus unchanged lines, you've likely lost something.
3. **Critical tag awareness**: For `</head>`, `</body>`, etc. — these are the LAST line before `<body>`/`<html>`. If `original_text` ends with `</style>` and `new_text` doesn't end with `</head>`, you've deleted the closing tag.
4. **read_file before retry**: If first `search_replace` goes wrong, run `read_file` to confirm current state before retrying. Do NOT assume file is in pre-replacement state.

**Anti-pattern** (caused `</head>` deletion in calculator integration test 2026-06-05):
```js
// ❌ DANGEROUS — only one-side context, no tag check
original_text: "    </style>\n</head>"
new_text:      "    </style>\n    [new CSS]"
//                 ↑ Result: </head> is GONE
```

**Correct pattern**:
```js
// ✅ Right-side context included
original_text: "    }\n    </style>\n</head>\n<body>"
new_text:      "    }\n    [new CSS]\n    </style>\n</head>\n<body>"
//                 ↑ Result: </head> preserved
```

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.