#!/usr/bin/env bash
#
# deploy-skills.sh — install this collection into a host skills directory.
#
# skills/ in this repository is the single source of truth. Every host
# directory is a generated artifact: this script mirrors the owned skills into
# the target and prunes the skills it deployed previously but no longer ships,
# so a retired skill cannot keep loading from a stale copy and become a second
# source of truth.
#
# Pruning is scoped to names recorded in the deploy state file (see
# STATE_FILE below). Skill directories from other collections are never
# touched, and a first run has no record, so it cannot prune anything.
#
# Usage:
#   ./scripts/deploy-skills.sh --target claude            # ~/.claude/skills
#   ./scripts/deploy-skills.sh --target codex             # ~/.codex/skills
#   ./scripts/deploy-skills.sh --target agents            # ~/.agents/skills
#   ./scripts/deploy-skills.sh --target DIR               # explicit directory
#   ./scripts/deploy-skills.sh --target claude --dry-run  # preview only
#
# Prefer a real plugin install over this script when the host supports one:
#   Claude Code:  /plugin marketplace add <this repo>  then  /plugin install zhanggui
#   Codex:        codex plugin install (see README)
# Use this script for hosts that only read a plain skills directory.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SOURCE_DIR="$PROJECT_ROOT/skills"

TARGET=""
DRY_RUN=0

die() { echo "ERROR: $*" >&2; exit 1; }

usage() {
  sed -n '/^# Usage:/,/^# Use this script/s/^# \{0,1\}//p' "$0"
  exit "${1:-0}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)   TARGET="${2:-}"; shift 2 ;;
    -n|--dry-run) DRY_RUN=1; shift ;;
    -h|--help)  usage 0 ;;
    *)          echo "Unknown arg: $1" >&2; usage 2 ;;
  esac
done

[[ -n "$TARGET" ]] || usage 2
[[ -d "$SOURCE_DIR" ]] || die "source '$SOURCE_DIR' not found"

case "$TARGET" in
  claude) DEST="$HOME/.claude/skills" ;;
  codex)  DEST="$HOME/.codex/skills" ;;
  agents) DEST="$HOME/.agents/skills" ;;
  *)      DEST="$TARGET" ;;
esac

# Deploy state lives next to DEST, not inside it: a host scanning the skills
# directory must never mistake bookkeeping for a skill.
STATE_FILE="$(dirname "$DEST")/.zhanggui-deployed-$(basename "$DEST").txt"

# The skill directories this collection owns, discovered from the source tree.
# Anything else in DEST is left untouched, because a host skills directory
# legitimately holds skills from other sources.
mapfile -t OWNED < <(cd "$SOURCE_DIR" && find . -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort)
[[ ${#OWNED[@]} -gt 0 ]] || die "no skill directories found in '$SOURCE_DIR'"

# Previously deployed names that the source no longer contains. Only these are
# prune candidates; without a state file the set is empty and nothing is removed.
RETIRED=()
if [[ -f "$STATE_FILE" ]]; then
  # The record may have been written on Windows with CRLF. A trailing CR makes
  # every name look retired while matching no directory, which would report a
  # prune that never happened, so strip it before comparing.
  while IFS= read -r previous || [[ -n "$previous" ]]; do
    previous="${previous%$'\r'}"
    [[ -n "$previous" ]] || continue
    for kept in "${OWNED[@]}"; do
      [[ "$kept" == "$previous" ]] && continue 2
    done
    RETIRED+=("$previous")
  done < "$STATE_FILE"
fi

echo "Source: $SOURCE_DIR"
echo "Target: $DEST"
echo "Owned skills: ${#OWNED[@]}"
if [[ ${#RETIRED[@]} -gt 0 ]]; then
  echo "Retired since last deploy: ${#RETIRED[@]} (${RETIRED[*]})"
fi
[[ $DRY_RUN -eq 1 ]] && echo "Mode:   DRY RUN (nothing is written)"
echo ""

if command -v rsync >/dev/null 2>&1; then
  SYNC() {
    local src="$1" dst="$2"
    local args=(-a --delete)
    [[ $DRY_RUN -eq 1 ]] && args+=(--dry-run --itemize-changes)
    rsync "${args[@]}" "$src/" "$dst/"
  }
else
  # rsync is absent on stock Windows shells. Replace the destination
  # directory outright so removals in the source still propagate.
  SYNC() {
    local src="$1" dst="$2"
    if [[ $DRY_RUN -eq 1 ]]; then
      echo "would replace $dst with $src"
      return 0
    fi
    rm -rf "$dst"
    mkdir -p "$(dirname "$dst")"
    cp -R "$src" "$dst"
  }
fi

[[ $DRY_RUN -eq 1 ]] || mkdir -p "$DEST"

for name in "${OWNED[@]}"; do
  echo "-> $name"
  SYNC "$SOURCE_DIR/$name" "$DEST/$name"
done

PRUNED=0
for name in ${RETIRED[@]+"${RETIRED[@]}"}; do
  [[ -n "$name" ]] || continue
  echo "-> $name (retired)"
  if [[ ! -d "$DEST/$name" ]]; then
    echo "   already absent from $DEST"
  elif [[ $DRY_RUN -eq 1 ]]; then
    echo "   would remove $DEST/$name (no longer in source)"
  else
    rm -rf "$DEST/$name"
    echo "   removed $DEST/$name"
    PRUNED=$((PRUNED + 1))
  fi
done

echo ""
if [[ $DRY_RUN -eq 1 ]]; then
  echo "Dry run complete. Nothing was written."
else
  printf '%s\n' "${OWNED[@]}" > "$STATE_FILE"
  echo "Deployed ${#OWNED[@]} skills to $DEST"
  echo "Pruned ${PRUNED} skill(s) that a previous deploy installed."
  echo "Deploy record: $STATE_FILE"
  echo "Reminder: $DEST is a generated artifact. Edit $SOURCE_DIR instead."
fi
