#!/usr/bin/env bash
#
# deploy-skills.sh — install this collection into a host skills directory.
#
# skills/ in this repository is the single source of truth. Every host
# directory is a generated artifact: this script mirrors the source into the
# target and deletes anything the source no longer contains, so a stale copy
# can never become a second source of truth.
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

# The nine skill directories this collection owns. Anything else in DEST is
# left untouched, because a host skills directory legitimately holds skills
# from other sources.
mapfile -t OWNED < <(cd "$SOURCE_DIR" && find . -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort)
[[ ${#OWNED[@]} -gt 0 ]] || die "no skill directories found in '$SOURCE_DIR'"

echo "Source: $SOURCE_DIR"
echo "Target: $DEST"
echo "Owned skills: ${#OWNED[@]}"
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

echo ""
if [[ $DRY_RUN -eq 1 ]]; then
  echo "Dry run complete. Nothing was written."
else
  echo "Deployed ${#OWNED[@]} skills to $DEST"
  echo "Reminder: $DEST is a generated artifact. Edit $SOURCE_DIR instead."
fi
