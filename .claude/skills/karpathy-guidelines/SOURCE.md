# Source

`SKILL.md` is vendored from
https://github.com/forrestchang/andrej-karpathy-skills/blob/main/skills/karpathy-guidelines/SKILL.md

Pinned commit: `2c606141936f1eeef17fa3043a72095b4765b9c2` (2026-04 snapshot).
License: MIT (see upstream repo).

To refresh:

```bash
COMMIT=$(curl -s https://api.github.com/repos/forrestchang/andrej-karpathy-skills/commits/main \
  | python3 -c "import json, sys; print(json.load(sys.stdin)['sha'])")
curl -sL "https://raw.githubusercontent.com/forrestchang/andrej-karpathy-skills/${COMMIT}/skills/karpathy-guidelines/SKILL.md" \
  -o .claude/skills/karpathy-guidelines/SKILL.md
# Then update the pinned commit hash above.
```
