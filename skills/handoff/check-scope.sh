#!/usr/bin/env bash
# Checks that a finished run changed only the files its plan allowed.
#   bash ~/.claude/skills/handoff/check-scope.sh <run dir>
# Reads "## Files to touch" from <run dir>/.handoff/plan.md and every changed, added, deleted or
# untracked file in the run dir (ignoring .handoff/). Fails (exit 1) if any changed file is not
# listed. Also lists entries that were not changed, for information only (some are conditional).
set -uo pipefail
RUN=${1:?usage: check-scope.sh <run dir>}
PLAN="$RUN/.handoff/plan.md"
[ -f "$PLAN" ] || { echo "check-scope: no plan at $PLAN"; exit 1; }

declare -A LISTED=()
while IFS= read -r line; do
  path=$(printf '%s' "$line" | grep -oE '`[^`]+`' | head -1 | tr -d '`')
  [ -n "$path" ] && LISTED[$path]=1
done < <(awk '/^## Files to touch/{f=1;next} /^## /{f=0} f' "$PLAN" | grep -E '^\s*- ')

fail=0
declare -A CHANGED=()
while IFS= read -r path; do
  [ -n "$path" ] || continue
  case "$path" in .handoff/*) continue ;; esac
  CHANGED[$path]=1
  if [ -n "${LISTED[$path]:-}" ]; then echo "ok        $path"
  else echo "OUTSIDE   $path  (not in Files to touch)"; fail=1; fi
done < <(git -C "$RUN" status --porcelain -uall | sed -E 's/^...//; s/^.* -> //' | sort -u)

for path in "${!LISTED[@]}"; do
  case "$path" in .handoff/*) continue ;; esac
  [ -z "${CHANGED[$path]:-}" ] && echo "unchanged $path  (listed, not changed)"
done

[ ${#CHANGED[@]} -eq 0 ] && echo "check-scope: the run changed no files"
if [ "$fail" -ne 0 ]; then echo "check-scope: FAILED - the run changed files outside its plan; do not apply until the user decides"; exit 1; fi
echo "check-scope: passed (${#CHANGED[@]} changed, all listed)"
