#!/usr/bin/env bash
# ===========================================================
#  System Health Monitor - one-click launcher (macOS / Linux)
#  First run: creates a virtual environment and downloads all
#  dependencies. Later runs: just starts the dashboard.
#  Usage:  ./start.sh   (run "chmod +x start.sh" once if needed)
# ===========================================================
set -e
cd "$(dirname "$0")"

echo "============================================"
echo "   System Health Monitor - launcher"
echo "============================================"
echo

# --- 1. Find a Python 3 interpreter ------------------------
if command -v python3 >/dev/null 2>&1; then
    PY=python3
elif command -v python >/dev/null 2>&1; then
    PY=python
else
    echo "[!] Python 3 was not found."
    echo "    macOS:  brew install python"
    echo "    Linux:  sudo apt install python3 python3-venv python3-pip   (or dnf/pacman)"
    exit 1
fi

# --- 2. Create the virtual environment if missing ----------
if [ ! -d venv ]; then
    echo "[*] Creating virtual environment..."
    "$PY" -m venv venv
fi

# --- 3. Install / update dependencies ----------------------
echo "[*] Installing dependencies (this can take a minute the first time)..."
# shellcheck disable=SC1091
source venv/bin/activate
python -m pip install --upgrade pip >/dev/null 2>&1 || true
pip install -r requirements.txt

# --- 4. Launch ---------------------------------------------
echo
echo "[OK] Ready. Starting the dashboard..."
echo "    Open http://localhost:5000   (default login: admin / admin)"
echo "    Press Ctrl+C to stop."
echo

# Best-effort: open the browser automatically
( command -v open    >/dev/null 2>&1 && open    http://localhost:5000 ) 2>/dev/null || \
( command -v xdg-open >/dev/null 2>&1 && xdg-open http://localhost:5000 ) 2>/dev/null || true

python app.py
