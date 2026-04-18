# Auto Commit Push Checklist

## 1. Before commit

- Confirm the current branch with `git branch --show-current`
- Inspect the working tree with `git status --short`
- Ensure the branch is not `main`
- Review the diff summary before generating a message
- Generate a concise English commit subject from the real changes

## 2. Commit attempt

- Stage only the files that belong to the current task
- Run `git commit -m "<message>"`
- Capture hook or validation failures if the commit is rejected

## 3. Failure recovery

- Read the exact failing command
- Fix the root cause instead of bypassing the hook
- Re-run the smallest validation that proves the fix
- Re-stage changed files
- Retry the commit
- Stop only after three unsuccessful repair attempts for the same blocker

## 4. Push

- Push the current branch to `origin`
- If the branch is new, prefer `git push -u origin <branch>`
- If rejected because the remote moved ahead:
  - `git fetch origin`
  - `git rebase origin/<branch>`
  - resolve conflicts
  - validate
  - `git push --force-with-lease origin <branch>` when rebase rewrote history

## 5. Final report

- Final English commit message
- Branch pushed to remote
- Hook failures encountered and fixed
- Remaining risks or blockers
