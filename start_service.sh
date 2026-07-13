#!/bin/bash
# ══════════════════════════════════════════════════════════════════════════════
#  TW MDM — Frontend Service Launcher (systemd)
#  Usage: ./start_service.sh [dev|prod]
#
#  Installs (or refreshes) a systemd service `mdm-frontend` that runs the Vite app,
#  restarts automatically on crash AND on Ubuntu reboot, then streams its logs.
#    dev  → vite dev server on :5173
#    prod → `npm run build` then `vite preview` on :4173
#
#  On a machine without systemd (e.g. a Mac dev box) it falls back to running the
#  app in the foreground with the same output.
# ══════════════════════════════════════════════════════════════════════════════

set -o pipefail

# ─────────────────────────────────────────────────────────────
# Output helpers (colors auto-disabled when not a TTY)
# ─────────────────────────────────────────────────────────────
if [ -t 1 ]; then
  C_RESET="\033[0m"; C_BOLD="\033[1m"; C_DIM="\033[2m"
  C_BLUE="\033[34m"; C_CYAN="\033[36m"; C_GREEN="\033[32m"
  C_YELLOW="\033[33m"; C_RED="\033[31m"; C_MAGENTA="\033[35m"; C_WHITE="\033[97m"
else
  C_RESET=""; C_BOLD=""; C_DIM=""; C_BLUE=""; C_CYAN=""
  C_GREEN=""; C_YELLOW=""; C_RED=""; C_MAGENTA=""; C_WHITE=""
fi

STEP_COUNT=0
SCRIPT_START=$(date +%s)

elapsed() { local n d; n=$(date +%s); d=$(( n - SCRIPT_START )); printf "%02d:%02d" $(( d / 60 )) $(( d % 60 )); }
ts() { echo -e "${C_DIM}[$(elapsed)]${C_RESET}"; }

step() {
  STEP_COUNT=$(( STEP_COUNT + 1 ))
  echo ""
  echo -e "${C_BOLD}${C_BLUE}┌──────────────────────────────────────────────────────────────┐${C_RESET}"
  echo -e "${C_BOLD}${C_BLUE}│  STEP ${STEP_COUNT}: ${C_WHITE}${1}${C_RESET}"
  echo -e "${C_BOLD}${C_BLUE}└──────────────────────────────────────────────────────────────┘${C_RESET}"
}

log()  { echo -e "$(ts)  ${C_CYAN}  ➤  ${C_RESET}${1}"; }
ok()   { echo -e "$(ts)  ${C_GREEN}  ✔  ${C_RESET}${1}"; }
warn() { echo -e "$(ts)  ${C_YELLOW}  ⚠  ${C_RESET}${1}"; }
fail() { echo -e "$(ts)  ${C_RED}  ✖  ${C_RESET}${1}"; }
info() { echo -e "$(ts)  ${C_DIM}     ${1}${C_RESET}"; }
divider() { echo -e "${C_DIM}     ──────────────────────────────────────────────────────${C_RESET}"; }
die() { fail "$1"; echo ""; exit 1; }

BOX_W=62
box_rule() { local l; l=$(printf '═%.0s' $(seq 1 $BOX_W)); echo -e "${C_BOLD}${1}${2}${l}${3}${C_RESET}"; }
box_line() { local c="$1" t="$2" len tot left right; len=${#t}; tot=$(( BOX_W - len )); [ "$tot" -lt 0 ] && tot=0; left=$(( tot / 2 )); right=$(( tot - left )); printf "${C_BOLD}${c}║%*s%s%*s║${C_RESET}\n" "$left" "" "$t" "$right" ""; }
box() { local c="$1"; shift; box_rule "$c" "╔" "╗"; local l; for l in "$@"; do box_line "$c" "$l"; done; box_rule "$c" "╚" "╝"; }

# ─────────────────────────────────────────────────────────────
# Banner + args
# ─────────────────────────────────────────────────────────────
echo ""
box "$C_MAGENTA" "TW MDM  -  Frontend Service Launcher"
echo -e "  Started at : ${C_WHITE}$(date '+%Y-%m-%d %H:%M:%S')${C_RESET}"

if [ "$#" -lt 1 ] || [ -z "${1// }" ]; then
  fail "No environment specified — an argument is required."
  echo ""
  echo -e "  ${C_BOLD}Usage:${C_RESET} $0 <dev|prod>"
  echo -e "  ${C_DIM}  dev  ${C_RESET}→ Vite dev server (hot reload)        http://localhost:5173"
  echo -e "  ${C_DIM}  prod ${C_RESET}→ production build + preview server    http://localhost:4173"
  echo ""
  echo -e "  ${C_DIM}Example:${C_RESET} $0 prod"
  echo ""
  exit 1
fi

PROFILE="$1"
if [[ "$PROFILE" != "dev" && "$PROFILE" != "prod" ]]; then
  fail "Invalid environment: '${PROFILE}'.  Usage: $0 <dev|prod>"
  exit 1
fi

SERVICE="mdm-frontend"
UNIT_PATH="/etc/systemd/system/${SERVICE}.service"
DEV_PORT=5173
PROD_PORT=4173
PORT=$([ "$PROFILE" = "prod" ] && echo "$PROD_PORT" || echo "$DEV_PORT")
NODE_ENV=$([ "$PROFILE" = "prod" ] && echo "production" || echo "development")

# Always operate from the script's own directory (the project root).
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR" || die "Could not enter project directory."

echo -e "  Profile    : ${C_BOLD}${C_WHITE}${PROFILE}${C_RESET}"
echo -e "  Project    : ${C_WHITE}${PROJECT_DIR}${C_RESET}"
echo -e "  Service    : ${C_WHITE}${SERVICE}.service${C_RESET}"
echo -e "  Port       : ${C_WHITE}${PORT}${C_RESET}"
echo ""

# ─────────────────────────────────────────────────────────────
# Environment resolution (OS, run-user, node/npm, sudo)
# ─────────────────────────────────────────────────────────────
OS="$(uname -s)"
HAVE_SYSTEMD=false
command -v systemctl >/dev/null 2>&1 && [ "$OS" = "Linux" ] && HAVE_SYSTEMD=true

# Who the service should run as, and how to reach root for systemd operations.
if [ "$EUID" -eq 0 ]; then
  SUDO=""
  RUN_USER="${SUDO_USER:-root}"
else
  SUDO="sudo"
  RUN_USER="$(id -un)"
fi

# Resolve node/npm as the run-user (handles nvm installs under sudo).
if [ "$RUN_USER" = "$(id -un)" ]; then
  NODE_BIN="$(command -v node 2>/dev/null)"
  NPM_BIN="$(command -v npm 2>/dev/null)"
else
  NODE_BIN="$(sudo -u "$RUN_USER" bash -lc 'command -v node' 2>/dev/null)"
  NPM_BIN="$(sudo -u "$RUN_USER" bash -lc 'command -v npm' 2>/dev/null)"
fi
NODE_BIN_DIR="$([ -n "$NODE_BIN" ] && dirname "$NODE_BIN" || echo "/usr/bin")"

# Run a command as the deploy user, from the project dir.
as_user() {
  if [ "$RUN_USER" = "$(id -un)" ]; then
    ( cd "$PROJECT_DIR" && bash -lc "$1" )
  else
    sudo -u "$RUN_USER" bash -lc "cd '$PROJECT_DIR' && $1"
  fi
}

# ── Port helpers (cross-platform) ─────────────────────────────
is_port_in_use() {
  local p="$1"
  case "$OS" in
    Linux)
      if command -v ss >/dev/null 2>&1; then
        ss -ltn "sport = :$p" 2>/dev/null | grep -q LISTEN
      else
        fuser "$p/tcp" >/dev/null 2>&1
      fi
      ;;
    Darwin) lsof -ti ":$p" >/dev/null 2>&1 ;;
    *) return 1 ;;
  esac
}

kill_port() {
  local p="$1" pids
  case "$OS" in
    Linux)
      if command -v fuser >/dev/null 2>&1; then
        $SUDO fuser -k "$p/tcp" >/dev/null 2>&1 || true
      else
        pids=$($SUDO ss -ltnp "sport = :$p" 2>/dev/null | grep -oE 'pid=[0-9]+' | grep -oE '[0-9]+' | sort -u)
        [ -n "$pids" ] && $SUDO kill -9 $pids >/dev/null 2>&1 || true
      fi
      ;;
    Darwin)
      pids=$(lsof -ti ":$p" 2>/dev/null)
      [ -n "$pids" ] && kill -9 $pids >/dev/null 2>&1 || true
      ;;
  esac
}

# Print the listener(s) currently bound to a port (indented).
show_port_holder() {
  local p="$1"
  if command -v ss >/dev/null 2>&1; then
    $SUDO ss -ltnp "sport = :$p" 2>/dev/null | sed 's/^/         /'
  elif command -v lsof >/dev/null 2>&1; then
    $SUDO lsof -iTCP:"$p" -sTCP:LISTEN 2>/dev/null | sed 's/^/         /'
  fi
}

# Aggressively release the app port; abort (with diagnosis) if a supervisor keeps re-binding it.
free_port() {
  local p="$1" tries=0 max=10 pids
  if ! is_port_in_use "$p"; then
    ok "Port ${p} is free."
    return 0
  fi

  warn "Port ${C_BOLD}${p}${C_RESET} is in use. Current listener(s):"
  show_port_holder "$p"

  while is_port_in_use "$p" && [ "$tries" -lt "$max" ]; do
    tries=$(( tries + 1 ))
    log "  Releasing port ${p} — attempt ${tries}/${max}..."
    command -v fuser >/dev/null 2>&1 && $SUDO fuser -k "${p}/tcp" >/dev/null 2>&1 || true
    pids=$($SUDO ss -ltnp "sport = :$p" 2>/dev/null | grep -oE 'pid=[0-9]+' | grep -oE '[0-9]+' | sort -u)
    [ -z "$pids" ] && command -v lsof >/dev/null 2>&1 && \
      pids=$($SUDO lsof -tiTCP:"$p" -sTCP:LISTEN 2>/dev/null | sort -u)
    [ -n "$pids" ] && $SUDO kill -9 $pids >/dev/null 2>&1 || true
    sleep 1
  done

  if is_port_in_use "$p"; then
    fail "Port ${p} is STILL occupied after ${max} attempts."
    warn "A supervisor keeps re-binding it (Docker, pm2/forever, or another systemd service)."
    echo -e "     ${C_DIM}Holder:${C_RESET}"
    show_port_holder "$p"
    echo -e "     ${C_DIM}• Docker :${C_RESET} docker ps            → docker stop <container>"
    echo -e "     ${C_DIM}• pm2    :${C_RESET} pm2 list             → pm2 delete <app>"
    echo -e "     ${C_DIM}• systemd:${C_RESET} sudo ss -ltnp 'sport = :${p}'  (find the .service and stop it)"
    echo -e "     ${C_DIM}• generic:${C_RESET} sudo lsof -i :${p}"
    die "Stop whatever owns port ${p} (shown above), then re-run — I won't start a service that can't bind."
  fi
  ok "Port ${p} released."
}

# Ensure the app port is open in the Ubuntu firewall (ufw). Only acts when ufw is active.
ensure_firewall_port() {
  local p="$1"
  if [ "$OS" != "Linux" ]; then
    info "Firewall check skipped (not Linux)."
    return
  fi
  if ! command -v ufw >/dev/null 2>&1; then
    info "ufw not installed — no host firewall to configure for port ${p}."
    return
  fi
  if ! $SUDO ufw status 2>/dev/null | head -1 | grep -qi "active"; then
    info "ufw is inactive — port ${p} is not firewall-blocked."
    return
  fi
  if $SUDO ufw status 2>/dev/null | grep -qE "(^|[[:space:]])${p}/tcp[[:space:]].*ALLOW"; then
    ok "Firewall: port ${p}/tcp is already open."
  else
    warn "Firewall: port ${p}/tcp is NOT open — opening it now..."
    if $SUDO ufw allow "${p}/tcp" >/dev/null 2>&1; then
      ok "Firewall: opened ${p}/tcp  (ufw allow ${p}/tcp)."
    else
      warn "Could not add ufw rule — run manually: ${C_DIM}sudo ufw allow ${p}/tcp${C_RESET}"
    fi
  fi
}

# ─────────────────────────────────────────────────────────────
# STEP: Preflight
# ─────────────────────────────────────────────────────────────
step "Preflight Checks"
log "Operating system : ${C_BOLD}${OS}${C_RESET}"
log "Run as user      : ${C_BOLD}${RUN_USER}${C_RESET}"
[ -n "$NODE_BIN" ] || die "Node.js not found for user '${RUN_USER}'. Install Node 18+ and re-run."
ok "Node : ${C_WHITE}$("$NODE_BIN" --version 2>/dev/null)${C_RESET}  (${NODE_BIN})"
[ -n "$NPM_BIN" ] || die "npm not found for user '${RUN_USER}'."
ok "npm  : ${C_WHITE}$("$NPM_BIN" --version 2>/dev/null)${C_RESET}"
[ -f "$PROJECT_DIR/package.json" ] || die "package.json not found — run this from the frontend project root."
ok "package.json found."

if $HAVE_SYSTEMD; then
  ok "systemd detected — will manage the '${SERVICE}' service."
else
  warn "systemd not available on this OS — falling back to foreground mode (no auto-restart on reboot)."
fi

# ─────────────────────────────────────────────────────────────
# STEP: Firewall (open the app port on Ubuntu)
# ─────────────────────────────────────────────────────────────
step "Firewall — Ensure Port ${PORT} Is Open"
ensure_firewall_port "$PORT"

# ─────────────────────────────────────────────────────────────
# STEP: Dependencies
# ─────────────────────────────────────────────────────────────
step "Install Dependencies"
if [ "$PROFILE" = "prod" ]; then
  # prod always refreshes deps so newly added packages are pulled in before the build.
  log "prod: installing / updating dependencies (npm install)..."
  as_user "'$NPM_BIN' install" || die "npm install failed."
  ok "Dependencies installed / up to date."
elif [ -d "$PROJECT_DIR/node_modules" ]; then
  ok "dev: node_modules already present — skipping install."
else
  log "dev: node_modules missing — installing (this can take a couple of minutes)..."
  if [ -f "$PROJECT_DIR/package-lock.json" ]; then
    as_user "'$NPM_BIN' ci" || die "npm ci failed."
  else
    as_user "'$NPM_BIN' install" || die "npm install failed."
  fi
  ok "Dependencies installed."
fi

# ─────────────────────────────────────────────────────────────
# STEP: Build (prod only)
# ─────────────────────────────────────────────────────────────
if [ "$PROFILE" = "prod" ]; then
  step "Build Production Bundle"
  warn "Compiling TypeScript + Vite production build — please wait..."
  log "Running: ${C_DIM}npm run build${C_RESET}"
  as_user "'$NPM_BIN' run build" || die "Production build failed."
  ok "Build complete → dist/"
fi

# ══════════════════════════════════════════════════════════════
#  Foreground fallback (no systemd)
# ══════════════════════════════════════════════════════════════
if ! $HAVE_SYSTEMD; then
  step "Free Application Port ${PORT}"
  free_port "$PORT"

  step "Start (Foreground — no systemd)"
  box "$C_GREEN" "TW MDM frontend starting [${PROFILE}]" "http://localhost:${PORT}"
  info "Press Ctrl+C to stop.  (For reboot-persistent service mode, run on Ubuntu.)"
  divider
  if [ "$PROFILE" = "prod" ]; then
    exec "$NPM_BIN" run preview -- --host 0.0.0.0 --port "$PROD_PORT"
  else
    exec "$NPM_BIN" run dev
  fi
fi

# ══════════════════════════════════════════════════════════════
#  systemd path
# ══════════════════════════════════════════════════════════════

# ExecStart per profile.
if [ "$PROFILE" = "prod" ]; then
  EXEC_START="${NPM_BIN} run preview -- --host 0.0.0.0 --port ${PROD_PORT}"
else
  EXEC_START="${NPM_BIN} run dev -- --port ${DEV_PORT}"
fi

# ── STEP: Detect existing service ─────────────────────────────
step "Detect Existing Service"
SERVICE_EXISTS=false
if $SUDO systemctl list-unit-files --type=service 2>/dev/null | grep -q "^${SERVICE}\.service"; then
  SERVICE_EXISTS=true
  ok "Service '${SERVICE}' already exists — it will be refreshed and restarted."
else
  info "Service '${SERVICE}' not found — it will be created, enabled and started."
fi

# ── STEP: Free the application port ───────────────────────────
step "Free Application Port ${PORT}"
if [ "$SERVICE_EXISTS" = true ] && $SUDO systemctl is-active --quiet "${SERVICE}.service"; then
  log "Stopping the running ${SERVICE} service so it releases port ${PORT}..."
  $SUDO systemctl stop "${SERVICE}.service" && ok "Service stopped." || warn "Could not stop ${SERVICE}."
fi
free_port "$PORT"

# ── STEP: Write unit file ─────────────────────────────────────
step "Write systemd Unit"
log "Writing ${C_BOLD}${UNIT_PATH}${C_RESET} (User=${RUN_USER}, profile=${PROFILE})"

UNIT_CONTENT="[Unit]
Description=TW MDM Frontend (${PROFILE}) — Vite
After=network.target

[Service]
Type=simple
User=${RUN_USER}
WorkingDirectory=${PROJECT_DIR}
Environment=NODE_ENV=${NODE_ENV}
Environment=PATH=${NODE_BIN_DIR}:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
ExecStart=${EXEC_START}
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${SERVICE}

[Install]
WantedBy=multi-user.target
"

if printf '%s' "$UNIT_CONTENT" | $SUDO tee "$UNIT_PATH" >/dev/null; then
  ok "Unit file written."
else
  die "Failed to write ${UNIT_PATH}. Re-run with sufficient privileges (sudo)."
fi

# ── STEP: (Re)load, enable, (re)start ─────────────────────────
step "Reload · Enable · $([ "$SERVICE_EXISTS" = true ] && echo Restart || echo Start)"

log "Reloading systemd daemon..."
$SUDO systemctl daemon-reload && ok "daemon-reloaded."

log "Enabling ${SERVICE} to start on boot (Ubuntu restart)..."
$SUDO systemctl enable "${SERVICE}.service" >/dev/null 2>&1 && ok "Enabled for boot."

if [ "$SERVICE_EXISTS" = true ]; then
  log "Restarting existing service to apply the ${PROFILE} configuration..."
  $SUDO systemctl restart "${SERVICE}.service" && ok "Service restarted." || die "Restart failed. See: journalctl -u ${SERVICE} -n 50"
else
  log "Starting the newly created service..."
  $SUDO systemctl start "${SERVICE}.service" && ok "Service started." || die "Start failed. See: journalctl -u ${SERVICE} -n 50"
fi

sleep 1

# ── STEP: Status ──────────────────────────────────────────────
step "Service Status"
$SUDO systemctl --no-pager --lines=0 status "${SERVICE}.service" || true

TOTAL_TIME=$(elapsed)
echo ""
box "$C_GREEN" "TW MDM frontend is running as a service" "profile: ${PROFILE}   |   setup: ${TOTAL_TIME}"
echo ""
echo -e "  ${C_BOLD}Access${C_RESET}"
echo -e "  ${C_DIM}────────────────────────────────────────────────────────${C_RESET}"
echo -e "  ${C_CYAN}App        ${C_RESET}: ${C_WHITE}http://localhost:${PORT}${C_RESET}"
echo ""
echo -e "  ${C_BOLD}Manage the service${C_RESET}"
echo -e "  ${C_DIM}────────────────────────────────────────────────────────${C_RESET}"
echo -e "  ${C_DIM}Live logs   :${C_RESET} journalctl -u ${SERVICE} -f"
echo -e "  ${C_DIM}Status      :${C_RESET} systemctl status ${SERVICE}"
echo -e "  ${C_DIM}Restart     :${C_RESET} sudo systemctl restart ${SERVICE}"
echo -e "  ${C_DIM}Stop        :${C_RESET} sudo systemctl stop ${SERVICE}"
echo -e "  ${C_DIM}Disable boot:${C_RESET} sudo systemctl disable ${SERVICE}"
echo ""
echo -e "  ${C_DIM}Total time: ${TOTAL_TIME}${C_RESET}"

# ── STEP: Follow logs ─────────────────────────────────────────
step "Live Service Logs  (Ctrl+C to stop following — the service keeps running)"
trap 'echo ""; echo ""; ok "Detached from logs — ${SERVICE} is still running (and will restart on reboot)."; echo -e "  ${C_DIM}Re-attach anytime with: journalctl -u ${SERVICE} -f${C_RESET}"; echo ""; exit 0' INT
divider
echo ""
$SUDO journalctl -u "${SERVICE}.service" -f -n 100
