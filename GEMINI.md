# Self-Correcting Rules Engine

This file contains a growing ruleset that improves over time. At session start, read the entire "Learned Rules" section before doing anything.

## How it works

- I for Command, L for Agent
1. When the user corrects you or you make a mistake, immediately append a new rule to the "Learned Rules" section at the bottom of this file.
2. Rules are numbered sequentially and written as clear, imperative instructions.
3. Format: `N. [CATEGORY] Never/Always do X because Y.`
4. Categories: `[STYLE]`, `[CODE]`, `[ARCH]`, `[TOOL]`, `[PROCESS]`, `[DATA]`, `[UX]`, `[OTHER]`
5. Before starting any task, scan all rules below for relevant constraints.
6. If two rules conflict, the higher-numbered (newer) rule wins.
7. Never delete rules. If a rule becomes obsolete, append a new rule that supersedes it.

## When to add a rule

- User explicitly corrects your output ("no, do it this way")
- User rejects a file, approach, or pattern
- You hit a bug caused by a wrong assumption about this codebase
- User states a preference ("always use X", "never do Y")

## Learned Rules

1. [CODE] Always prioritize code readability and established frameworks (like FastAPI) over low-level "zero-dependency" verbose scripts because code clarity and maintainability are paramount.
2. [ARCH] Never clutter the Expo project with raw native boilerplate files (custom Kotlin classes, manual Gradle scripts) that obscure standard Expo workflow and reduce readability.
3. [ARCH] Always include the native Chaquopy bridge (Kotlin module and Gradle configuration) required to embed and execute the Python engine directly on the mobile device, because running the server internally inside the app is a core project requirement.
4. [PROCESS] Never record one-time architectural setup steps or specific tech-stack details in Learned Rules; always limit rules to enduring coding styles, workflow practices, and developer preferences (superseding rules 2 and 3) because technical architecture must be inferred directly from the active codebase.
5. [PROCESS] Always prioritize direct porting and unification of the existing web frontend and API into a single mobile application before introducing new or exploratory features because achieving functional parity is the core project goal.
6. [ARCH] Always preserve the exact modular directory structure (such as utils/) and keep ported files line-for-line aligned with original code because minimizing comparison/diff discrepancies and facilitating direct side-by-side verification is essential.
7. [ARCH] Always keep the embedded mobile Python backend as a minimal pass-through bridge (delegating formatting, caching, and persistence to the frontend) because native Python compilation is fragile and rebuilding native APKs must be minimized.
8. [TOOL] Never run git commit or git push because version control, staging, committing, and branching are strictly managed by the user.
9. [TOOL] Always stage and commit changes incrementally per feature with clear descriptive commit messages, but NEVER execute git push, git reset, git squash, git merge, or git rebase (superseding rule 8) because atomic commits aid tracking while destructive or remote Git operations remain strictly reserved for the user.
10. [TOOL] Never stage or commit temporary files, scratch scripts, debug logs, or explanation markdown files (such as explanation*.md) into Git commits, and always clean up temporary development artifacts before committing because repository history must remain strictly focused on clean project code.
11. [CODE] Never add speculative UI loading states or redundant pre-flight ping checks before main API calls unless explicitly requested, because direct async/await on the primary endpoint keeps code clean and minimal.
12. [ARCH] Always design backend API responses to return standardized error codes instead of raw display strings, and enforce zero caching, zero rate limiting, and zero data processing on the Python server because all formatting, dictionaries, caching, and rate limiting belong strictly in the frontend.
13. [PROCESS] Always document each Git commit in changelog.md with its short commit ID, structural context, and key code diff explanations (what was removed/changed/added and why) immediately upon committing because commit messages alone lack diff context.
14. [ARCH] Never implement file-system inspection, validation, or existence-checking endpoints (such as /api/check-file) on the backend when the frontend can perform them directly, and always extract execution logic into modular helper functions in utils/ to keep main.py as a minimal, lightweight pass-through bridge because server-side bloat violates the pass-through architecture.
15. [PROCESS] Always stage and commit changelog.md documentation together in the same atomic commit as the corresponding code changes (superseding rule 13's separate post-commit step) and never separate changelog updates into their own standalone commit because feature changes and their documentation must remain unified per feature.
16. [ARCH] Always keep the backend server strictly minimal, modular, and 100% dynamic with zero hardcoding (all logic, values, paths, and configurations must be passed by the frontend), and never record micro-architectural decisions in Learned Rules (superseding rule 14) because any server modification requires rebuilding the native APK / dev mode, while frontend updates remain instant.
17. [PROCESS] Never modify or touch any project code files when the user's prompt begins with or contains an inquiry disclaimer like "ini saya bertanya ya" because explanatory queries must be answered analytically and conceptually without unintended code mutations.
18. [ARCH] Never perform file scanning, directory searching, or cache discovery on the Python backend server (such as searching for info.json files); always delegate all cache resolution, tiered scanning (in-memory and file system), and path decisions strictly to the frontend because the backend must remain a pure pass-through execution worker.
19. [ARCH] Never parse, classify, or filter error strings or inspect exception messages on the Python backend server (such as checking for rate limits or bot challenges); always return the raw, full error message directly to the frontend because all error analysis, categorization, and recovery logic belong strictly in the frontend.