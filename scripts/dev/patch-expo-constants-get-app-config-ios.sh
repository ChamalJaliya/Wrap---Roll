#!/usr/bin/env bash
# expo-constants iOS: paths with spaces break `basename $PROJECT_DIR` so app.config is never
# embedded → expo-linking throws (Constants.expoConfig empty). Default BUNDLE_FORMAT if unset.
# Re-apply after npm install.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
python3 - "$ROOT" <<'PY'
from pathlib import Path
import sys
root = Path(sys.argv[1])
f = root / "node_modules/expo-constants/scripts/get-app-config-ios.sh"
if not f.is_file():
    sys.exit(0)
text = f.read_text()
text = text.replace(
    "PROJECT_DIR_BASENAME=$(basename $PROJECT_DIR)",
    'PROJECT_DIR_BASENAME=$(basename "$PROJECT_DIR")',
)
marker = "BUNDLE_FORMAT=${BUNDLE_FORMAT:-shallow}"
if marker not in text:
    needle = 'cd "$PROJECT_ROOT" || exit\n\nif [ "$BUNDLE_FORMAT" == "shallow" ]; then'
    insert = (
        'cd "$PROJECT_ROOT" || exit\n\n'
        "# Xcode/CocoaPods often omit this; shallow matches EXConstants.resource_bundles layout.\n"
        f"{marker}\n\n"
        'if [ "$BUNDLE_FORMAT" == "shallow" ]; then'
    )
    if needle in text:
        text = text.replace(needle, insert, 1)
    else:
        sys.stderr.write("patch-expo-constants: unexpected get-app-config-ios.sh layout; skip BUNDLE_FORMAT insert\n")
f.write_text(text)
PY
