---
name: verify
description: Verifies a change to a mod in claude-mods. Runs claude plugin validate on the marketplace and on each changed mod, runs that mod's tests and checks that its version went up in plugin.json. Use it before calling a mod change done and before each commit. Do not use it for changes that touch only the root README or LICENSE.
---

# Verifying a claude-mods change

## When to use

- **Use** after changing anything inside a mod's folder (its `plugin.json`, hooks, tests, README) or `.claude-plugin/marketplace.json`, before calling the work done and before each commit.
- **Do not use** for changes to the root `README.md` or `LICENSE` only: nothing here depends on them.

`claude` is not on the PATH in the app's sessions, so the script uses the newest Claude Code the desktop app installed, under `~/Library/Application Support/Claude/claude-code/<version>/<hash>/`.

## Steps

From the repository root. By default the changed mods are the folders that differ from `origin/main` (committed or not, new files included) and have a `.claude-plugin/plugin.json`; `MODS="a b"` names them instead, and `BASE=<commit>` changes what the version is compared with.

```bash
set -o pipefail; cd "$(git rev-parse --show-toplevel)" && falhou=0
CLAUDE=$(ls -d "$HOME/Library/Application Support/Claude/claude-code"/*/*/claude.app/Contents/MacOS/claude | sort -V | tail -1)
BASE=${BASE:-origin/main}
echo "Claude Code: $("$CLAUDE" --version) · base: $BASE"
if [ -z "$MODS" ]; then
  MODS=$( { git diff --name-only "$BASE"; git ls-files --others --exclude-standard; } | cut -d/ -f1 | sort -u |
          while read -r d; do [ -f "$d/.claude-plugin/plugin.json" ] && echo "$d"; done )
fi
echo "mods: ${MODS:-none}"
"$CLAUDE" plugin validate . 2>&1 | grep -q '✔ Validation passed' && echo 'marketplace: validation passed' || { falhou=1; echo 'marketplace: VALIDATION FAILED'; }
for m in $(echo $MODS); do
  out=$("$CLAUDE" plugin validate "./$m" 2>&1)
  echo "$out" | grep -q '✔ Validation passed' && echo "$m: validation passed" || { falhou=1; echo "$m: VALIDATION FAILED"; }
  # The four gating hooks of savvy-progress stay without .catch on purpose.
  gating=$(echo "$out" | grep 'gating hook without .catch' | sed 's/.*without \.catch: //')
  [ "$m" = savvy-progress ] && gating=$(echo "$gating" | grep -vxF -e 'tool.call{tool=mcp__savvy-progress__progress}' \
    -e 'tool.call{tool=mcp__savvy-progress__step}' -e 'tool.call{tool=Agent}' -e 'agent.spawn')
  [ -n "$gating" ] && { falhou=1; echo "$m: unexpected gating hooks without .catch: $(echo $gating)"; }
  if [ -d "$m/tests" ]; then
    t=$("$CLAUDE" plugin test "./$m" 2>&1); echo "$t" | grep -E '^ *[0-9]+ (pass|fail)$' | sed "s/^/$m tests: /"
    echo "$t" | grep -qE '^ *0 fail$' || { falhou=1; echo "$t" | grep '(fail)'; }
  fi
  novo=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["version"])' "$m/.claude-plugin/plugin.json")
  antigo=$(git show "$BASE:$m/.claude-plugin/plugin.json" 2>/dev/null | python3 -c 'import json,sys; print(json.load(sys.stdin)["version"])' 2>/dev/null)
  if [ -z "$antigo" ]; then echo "$m: new mod, version $novo"
  elif [ "$novo" != "$antigo" ] && [ "$(printf '%s\n%s\n' "$antigo" "$novo" | sort -V | tail -1)" = "$novo" ]; then echo "$m: version $antigo -> $novo"
  else falhou=1; echo "$m: VERSION DID NOT GO UP ($antigo -> $novo)"; fi
done
echo "result: $([ $falhou = 0 ] && echo 'all good' || echo 'something failed')"
```

## Expected result

- `marketplace: validation passed`
- For each changed mod: `validation passed`, its tests with `0 fail`, and `version <old> -> <new>` with the new one higher.
- For savvy-progress, the four `gating hook without .catch` notices (`tool.call` for `mcp__savvy-progress__progress`, `mcp__savvy-progress__step` and `Agent`, and `agent.spawn`) are known and stay on purpose; any other gating notice counts as a failure.
- The plugin directory warnings that `validate` prints (no icon, `.DS_Store` on disk) do not change its verdict and are not checked here.
- `result: all good`

## If something fails

- **A test fails:** first find out whether it already failed before the change. Unpack the base commit's copy of the mod into a scratch folder and run its tests with the same binary, without touching the working tree: `git archive "$BASE" <mod> | tar -x -C <scratch>` and then `"$CLAUDE" plugin test <scratch>/<mod>`. If it failed there too, say so in the report as a known failure; if not, fix the code. Do not change a test to make it pass unless the request is to change it. After three failed attempts at a fix, stop and say what fails and what you tried.
- **The version did not go up:** raise `version` in the mod's `.claude-plugin/plugin.json`, and add the new version to its README's change notes if it keeps them.
- **Validation fails:** read the full `validate` output for that mod and fix what it names.

In the report, say which steps ran and the result of each.
