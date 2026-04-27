# Auto Commit Push Checklist

## 1. Before Commit

- Confirm the current branch with `git branch --show-current`
- Inspect the working tree with `git status --short`
- Ensure the branch is not `main`
- Review the diff summary before generating a message
- Generate a concise English commit subject from the current changes
- Keep the message aligned with `docs/conventions/github-flow.md`
- Run `git add .`

## 2. Commit Attempt

- Run `git commit -m "<message>"`
- Capture hook or validation failures if the commit is rejected

## 3. Failure Recovery

- Read the exact failing command
- Fix the root cause instead of bypassing the hook
- Re-run `git add .`
- Retry `git commit -m "<message>"`
- Stop only after three unsuccessful repair attempts for the same blocker

## 4. Pre-push Code Review Gate

- Review the committed diff before any remote push
- Use a code-review stance: prioritize bugs, regressions, missing validation, compatibility breaks, security/data risks, and repository policy violations
- If any confirmed risk or defect is found:
  - fix every confirmed blocking issue
  - re-run required validation
  - re-run `git add .`
  - create a follow-up commit or amend only when the user explicitly allows it
  - repeat the review gate until no blocking risks remain
- Do not push while confirmed blocking risks remain

## 5. Push

- Push the current branch to `origin`
- If the branch is new, prefer `git push -u origin <branch>`
- If rejected because the remote moved ahead:
  - `git fetch origin`
  - `git rebase origin/<branch>`
  - resolve conflicts
  - validate
  - `git push --force-with-lease origin <branch>` when rebase rewrote history

## 6. Final Report

- Final English commit message
- Branch pushed to remote
- Hook failures encountered and fixed
- Whether the local commit needed retries before succeeding
- Pre-push code-review result, including fixed risks if any
- Remaining risks or blockers
