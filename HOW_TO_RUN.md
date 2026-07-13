# TW MDM — Frontend: How to Run

The frontend is a Vite + React app. `start_service.sh` runs it as a **systemd service** on
Ubuntu/Linux so it survives crashes and machine reboots, then streams the logs. On a non‑systemd
machine (e.g. a Mac dev box) the same script runs the app in the foreground.

- **dev**  → Vite dev server (hot reload) on **:5173**
- **prod** → `npm run build` then `vite preview` (serves the built bundle) on **:4173**

---

## 1. Run it

From the frontend project root:

```bash
# Development (hot reload)
./start_service.sh dev

# Production (build + preview)
./start_service.sh prod
```

If the script isn't executable yet:

```bash
chmod +x start_service.sh
```

> **Privileges:** creating/updating a systemd service needs root. Run the script as your normal
> user (recommended — the service then runs as *you* with your Node) and it will call `sudo` only
> for the systemd steps, **or** run the whole thing with `sudo ./start_service.sh prod`.

### What the script does, in order
1. **Preflight** — detects OS, the run‑user, and Node/npm; verifies `package.json`.
2. **Dependencies** — `prod` **always** runs `npm install` (so newly added packages are pulled in before the build); `dev` installs only if `node_modules` is missing.
3. **Build** — `prod` only: `npm run build` → `dist/`. `build` runs **Vite** (esbuild type-strips, so
   the production bundle is not blocked by strict type errors). For a strict type check run
   `npm run typecheck` (`tsc --noEmit`), or `npm run build:strict` to gate the build on it.
4. **Service** — checks whether the `mdm-frontend` service already exists:
   - **exists** → refreshes the unit and **restarts** it;
   - **missing** → **creates**, `enable`s (so it starts on boot), and **starts** it.
5. **Status + logs** — prints service status, the access URL, management commands, then follows the
   live logs.

Re‑running with the other profile (e.g. `dev` → `prod`) rewrites the unit and restarts — no manual
cleanup needed.

---

## 2. See / enter the log stream

The service logs go to the systemd journal under the identifier `mdm-frontend`.

```bash
# Follow live logs (this is also what the script does at the end)
journalctl -u mdm-frontend -f

# Last 200 lines, no follow
journalctl -u mdm-frontend -n 200 --no-pager

# Only since the last boot
journalctl -u mdm-frontend -b

# Filter by time
journalctl -u mdm-frontend --since "10 min ago"
```

Detaching from the log stream with **Ctrl+C** stops *following* only — the service keeps running.

---

## 3. Manage the service

```bash
systemctl status mdm-frontend            # current state
sudo systemctl restart mdm-frontend      # restart
sudo systemctl stop mdm-frontend         # stop (until next boot / start)
sudo systemctl start mdm-frontend        # start
sudo systemctl disable mdm-frontend      # don't start on boot
sudo systemctl enable  mdm-frontend      # start on boot (default)
```

**Reboot behaviour:** because the service is `enable`d with `Restart=always` and
`WantedBy=multi-user.target`, it starts automatically when Ubuntu boots and is restarted if it ever
crashes.

The unit file lives at `/etc/systemd/system/mdm-frontend.service`.

---

## 4. Ports & config

| Profile | Command served            | Port |
|---------|---------------------------|------|
| `dev`   | `vite` dev server         | 5173 |
| `prod`  | `vite preview` over `dist`| 4173 |

Environment values (API base URL, MQTT broker, etc.) come from the Vite env files
(`.env`, `.env.production`, …) via `import.meta.env`. Make sure the correct env file is present
before building for `prod`.
