# Practice Ertaki on your home Wi‑Fi (before buying a VPS)

This guide is for learning. You will run the **same Docker setup** a small VPS would use — but on **your PC**. Your phone (with the APK) and your PC stay on the **same Wi‑Fi**.

You do **not** need to buy a server yet.

### Critical: “has internet” is not enough

| Situation | Can phone / other PC reach your Docker? |
|---|---|
| Phone + PC on the **same home Wi‑Fi** (same SSID), firewall open | **Yes** (this guide) |
| Phone on **mobile data** (4G/5G) or another house’s Wi‑Fi | **No** — your PC’s `192.168.x.x` address is private and invisible from the public internet |
| Phone on Wi‑Fi, PC on cable, but **different networks** / guest Wi‑Fi / AP isolation | **No** until both are on the same LAN without client isolation |
| You already bought a **VPS** with a public domain | Use [`vps-deploy.md`](./vps-deploy.md) instead |

The Caddy LAN fix (catch‑all Host + port 8080) only helps devices that can already route to your PC on the LAN. It does **not** publish your home PC to the whole internet.

---

## What you will have at the end

| Thing | Where |
|---|---|
| App backend (API + database + admin site) | Running on your PC |
| Admin login (browser) | `http://YOUR-PC-IP/` |
| Phone app | Installed APK, talking to `http://YOUR-PC-IP/api` |

`YOUR-PC-IP` is a number like `192.168.1.23` — we find it below.

---

## 0) Words in plain English

- **Docker** = a free program that runs Ertaki in little “boxes” so you don’t install Node/Postgres by hand.
- **Compose** = one command that starts all the boxes together.
- **APK** = the Android app file you install on the phone.
- **LAN / Wi‑Fi IP** = your PC’s address on home Wi‑Fi (not `127.0.0.1` — that only means “this device”).

---

## 1) Install Docker Desktop (once)

1. On the PC, open: [https://www.docker.com/products/docker-desktop/](https://www.docker.com/products/docker-desktop/)
2. Download **Docker Desktop for Windows**.
3. Install it (accept defaults).
4. Restart the PC if it asks.
5. Open **Docker Desktop** and wait until it says it is running (green / “Engine running”).

If Windows asks about **WSL 2**, say yes and finish that install, then open Docker Desktop again.

---

## 2) Get the Ertaki project folder

### Option A — you already cloned the GitHub repo

Open **File Explorer** and go to that folder (example: `C:\Users\...\Ertaki-Project`).

### Option B — download ZIP

1. Open [https://github.com/fayed23/Ertaki-Project](https://github.com/fayed23/Ertaki-Project)
2. Click the green **Code** → **Download ZIP**
3. Unzip it somewhere simple, e.g. `C:\Ertaki-Project`
4. Remember that folder path.

---

## 3) Find your PC’s Wi‑Fi IP address

1. On the PC, press `Windows` key, type `cmd`, open **Command Prompt**.
2. Type this and press Enter:

```bat
ipconfig
```

3. Find the section for **Wireless LAN adapter Wi‑Fi** (or Ethernet if you use a cable).
4. Copy **IPv4 Address**. Example: `192.168.1.23`

Write it down. Below we call it `YOUR-PC-IP`.

**Important:** Phone and PC must be on the **same Wi‑Fi**. Guest Wi‑Fi / phone hotspot often blocks this.

---

## 4) Create the settings file (`.env`)

1. In File Explorer, open the Ertaki project folder.
2. Find the file named `.env.example`.
3. Copy it and rename the copy to `.env`  
   (If Windows hides the name: View → show file name extensions.)

4. Open `.env` with Notepad.
5. Replace the contents with this (then change the three places that say `YOUR-PC-IP` and invent two secrets):

```env
NODE_ENV=production

JWT_SECRET=local-practice-secret-at-least-32-characters-long
POSTGRES_USER=ertaki
POSTGRES_PASSWORD=local-practice-db-password-99
POSTGRES_DB=ertaki

DOMAIN=YOUR-PC-IP
ACME_EMAIL=practice@example.com

NEXT_PUBLIC_API_URL=http://YOUR-PC-IP/api
CORS_ORIGINS=http://YOUR-PC-IP,http://localhost,http://127.0.0.1

JWT_EXPIRES_IN=12h

SEED_ON_EMPTY=true
ALLOW_DEMO_SEED=true
```

Example if your IP is `192.168.1.23`:

```env
DOMAIN=192.168.1.23
NEXT_PUBLIC_API_URL=http://192.168.1.23/api
CORS_ORIGINS=http://192.168.1.23,http://localhost,http://127.0.0.1
```

6. Save the file.

This turns on **demo accounts** so you can log in immediately. That is OK for home practice — do **not** use these passwords on a real public VPS later.

---

## 5) Allow Windows Firewall (required for phone + other PC)

`localhost` on the Docker PC can work while the phone and another PC still fail — Windows Firewall often blocks **inbound** LAN traffic.

Do this on the PC that runs Docker (Command Prompt **as Administrator**):

```bat
netsh advfirewall firewall add rule name="Ertaki LAN 80" dir=in action=allow protocol=TCP localport=80
netsh advfirewall firewall add rule name="Ertaki LAN 8080" dir=in action=allow protocol=TCP localport=8080
```

Also:

1. Click the network icon → make sure this Wi‑Fi is **Private** (not Public).
2. Turn **off** VPN on the phone and on both PCs while testing.
3. Do **not** use Guest Wi‑Fi.

Quick proof from the **other PC** or **phone browser** (not the Docker PC):

```text
http://YOUR-PC-IP/api/health
http://YOUR-PC-IP:8080/api/health
```

If neither opens, the problem is still network/firewall — not the app. Fix that before testing the APK.

Optional nuclear test (home only, turn back on after):

```bat
netsh advfirewall set allprofiles state off
```

When done testing:

```bat
netsh advfirewall set allprofiles state on
```

---

## 6) Start Ertaki (the “VPS-like” stack)

1. Open **Command Prompt**.
2. Go into the project folder (change the path if yours is different):

```bat
cd C:\Ertaki-Project
```

3. Start with the **LAN overlay** (important on Windows / home Wi‑Fi).  
   This makes Caddy answer **any** address (`localhost`, `127.0.0.1`, and your LAN IP) on plain HTTP, and also opens port **8080** if Windows blocks 80:

```bat
docker compose -f docker-compose.yml -f docker-compose.lan.yml up -d --build
```

Do **not** use plain `docker compose up` for this home test. That production Caddyfile only answers the exact `DOMAIN` name and may fight HTTPS certificates.

4. Wait until it finishes without red errors.
5. Check that containers are up:

```bat
docker compose -f docker-compose.yml -f docker-compose.lan.yml ps
```

You want `postgres`, `api`, `admin`, and `caddy` looking **running** / healthy.

6. Test from the **same PC** browser. Try these **in order**:

```text
http://127.0.0.1/api/health
http://localhost/api/health
http://127.0.0.1:8080/api/health
http://YOUR-PC-IP/api/health
http://YOUR-PC-IP:8080/api/health
```

You should see something like: `{"status":"ok","db":"up"}`.

Admin site (same host/port that worked above):

```text
http://127.0.0.1/
http://127.0.0.1:8080/
http://YOUR-PC-IP/
```

You should see the **ارتق** supervisor login page.

**If nothing opens:** jump to [Common problems](#common-problems) — especially “Containers healthy but browser cannot connect”.

---

## 7) Log into the admin (on the PC)

Demo supervisor account (only because we enabled seeding):

| Field | Value |
|---|---|
| Phone | `0500000001` |
| Password | `password123` |

If login fails, wait 30 seconds (first boot still creating data) and try again. Check:

```bat
docker compose logs api --tail 50
```

---

## 8) Install the app on your phone

1. On the PC, download the APK from the GitHub Release:  
   [v1.0.15-apk](https://github.com/fayed23/Ertaki-Project/releases/tag/v1.0.15-apk)  
   File name: `ertaki-android-release.apk`
2. Copy it to the phone (USB, Google Drive, WhatsApp to yourself, etc.).
3. On the phone: open the file → Allow install from this source if asked → Install.
4. Open **ارتق**.

---

## 9) Point the phone at your PC

The APK’s built-in default is for an emulator (`10.0.2.2`). Your real phone needs your **PC Wi‑Fi IP**.

1. On the login screen, find the **API base URL** field (shown on first login / settings).
2. Set it exactly to whichever URL worked in the PC browser:

```text
http://YOUR-PC-IP/api
```

If only port **8080** worked on the PC:

```text
http://YOUR-PC-IP:8080/api
```

Example:

```text
http://192.168.1.23/api
```

3. No spaces. Use `http` (not `https`) for this home practice.
4. Save / continue.

### Try a student login

| Field | Value |
|---|---|
| Phone | `0500000003` |
| Password | `password123` |

Teacher demo: `0500000002` / `password123`.

---

## 10) Quick “did it work?” checklist

- [ ] Docker Desktop is running  
- [ ] Started with `docker compose -f docker-compose.yml -f docker-compose.lan.yml up -d --build`  
- [ ] `docker compose … ps` shows 4 services up  
- [ ] PC browser: `http://127.0.0.1/api/health` **or** `http://127.0.0.1:8080/api/health` → ok  
- [ ] PC browser: admin login works on the same host/port  
- [ ] Phone Wi‑Fi = same as PC  
- [ ] Phone API URL = `http://YOUR-PC-IP/api` (or `:8080/api` if that is what worked)  
- [ ] Student/teacher can log in on the phone  

---

## 11) Stop / start later

Stop (keeps your data):

```bat
cd C:\Ertaki-Project
docker compose -f docker-compose.yml -f docker-compose.lan.yml stop
```

Start again later:

```bat
cd C:\Ertaki-Project
docker compose -f docker-compose.yml -f docker-compose.lan.yml start
```

Full reset (deletes the practice database — careful):

```bat
docker compose -f docker-compose.yml -f docker-compose.lan.yml down -v
```

---

## Common problems

### Containers healthy but browser cannot connect (localhost / IP / phone)

This is the most common Windows + Docker Desktop failure. Containers can be healthy **inside** Docker while your browser still cannot reach them.

Do these checks **on the PC that runs Docker**, in order.

#### A) Restart with the LAN overlay

```bat
cd C:\Ertaki-Project
docker compose -f docker-compose.yml -f docker-compose.lan.yml down
docker compose -f docker-compose.yml -f docker-compose.lan.yml up -d --build
```

#### B) Ask Windows which process owns port 80

```bat
netstat -ano | findstr :80
```

If something other than Docker / `com.docker` owns `:80`, that program is stealing the door. Common thieves: **IIS**, **World Wide Web Publishing Service**, **Skype**, another local web server.

Stop IIS (if present):

```bat
net stop w3svc
```

Or switch to port **8080** (already published by the LAN overlay):

```text
http://127.0.0.1:8080/api/health
```

#### C) Curl from Command Prompt (more honest than the browser)

```bat
curl http://127.0.0.1/api/health
curl http://127.0.0.1:8080/api/health
```

- If curl works but the browser does not: try another browser, or clear HSTS / do not force `https://`.
- If curl fails on both: Caddy is not reachable on the host yet — continue.

#### D) Read Caddy logs

```bat
docker compose -f docker-compose.yml -f docker-compose.lan.yml logs caddy --tail 100
```

You want reverse-proxy activity, not endless certificate / ACME errors. The LAN overlay turns `auto_https` **off** on purpose.

#### E) Confirm published ports

```bat
docker compose -f docker-compose.yml -f docker-compose.lan.yml ps
```

Under PORTS for `caddy` you should see something like `0.0.0.0:80->80` and `0.0.0.0:8080->80`.

#### F) Windows Firewall (needed for phone / other PC)

1. Windows search → **Windows Defender Firewall** → **Advanced settings**.
2. **Inbound Rules** → **New Rule** → Port → TCP → `80, 8080` → Allow → Private → name it `Ertaki LAN`.
3. Keep the network profile **Private** (not Public guest Wi‑Fi).

#### G) Same Wi‑Fi rules (phone / other PC)

- Phone and other PC must use the **same Wi‑Fi name** as the Docker PC.
- **Mobile data does not work** for `http://192.168.x.x` — turn Wi‑Fi on and mobile data off while testing.
- Avoid **Guest** Wi‑Fi / client isolation (AP/client isolation blocks phone→PC).
- On the other device open the health URL in a **browser first**. If the browser fails, the app will fail too.
- Prefer `http://YOUR-PC-IP/...` (or `:8080`) — never `localhost` on the phone/other PC (`localhost` means that device itself).
- Firewall rules from [section 5](#5-allow-windows-firewall-required-for-phone--other-pc) must be in place.

#### H) Docker Desktop reset (last resort)

Docker Desktop → **Troubleshoot** → **Restart Docker Desktop**. Then repeat step A.

### Phone says network / connection error

1. First prove `http://YOUR-PC-IP/api/health` (or `:8080`) works in the **phone’s own browser**. If the phone browser fails, the app will fail too.
2. API URL on phone must match what worked (`http://YOUR-PC-IP/api` or `http://YOUR-PC-IP:8080/api`).
3. PC IP changed after router reboot? Run `ipconfig` again and update `.env` + phone URL, then recreate with the LAN compose command above.
4. Windows Firewall — see step F.

### Admin page loads but login fails

- Confirm seeding: in `.env`, `SEED_ON_EMPTY=true` and `ALLOW_DEMO_SEED=true`, then:

```bat
docker compose -f docker-compose.yml -f docker-compose.lan.yml down
docker compose -f docker-compose.yml -f docker-compose.lan.yml up -d --build
```

- `NEXT_PUBLIC_API_URL` and `CORS_ORIGINS` must use the same host/port you open in the browser (include `:8080` if you use that port).

### `docker compose` command not found

- Open **Docker Desktop** first, then open a **new** Command Prompt window.

### Port 80 already in use

Use the LAN overlay’s **8080** URLs everywhere (browser, `.env` `NEXT_PUBLIC_API_URL` / `CORS_ORIGINS`, phone API field), e.g.:

```env
NEXT_PUBLIC_API_URL=http://192.168.1.23:8080/api
CORS_ORIGINS=http://192.168.1.23:8080,http://localhost:8080,http://127.0.0.1:8080
```

Then recreate:

```bat
docker compose -f docker-compose.yml -f docker-compose.lan.yml up -d --build
```

---

## What this teaches you (before buying a VPS)

You practiced the real shape:

1. One machine runs Docker Compose (postgres + api + admin + Caddy).  
2. Clients (phone + browser) only talk to the API URL over the network.  
3. Secrets live in `.env`, not in the app.  

When you buy a VPS later, the steps are almost the same — you will:

- put the project on the VPS  
- set `DOMAIN` to your real domain name  
- use strong unique passwords  
- turn **off** demo seeding (`SEED_ON_EMPTY=false`)  
- use HTTPS (Caddy + Let’s Encrypt)  

Full operator notes: [`vps-deploy.md`](./vps-deploy.md)

---

## Demo accounts (home practice only)

| Role | Phone | Password |
|---|---|---|
| Supervisor | `0500000001` | `password123` |
| Teacher | `0500000002` | `password123` |
| Student | `0500000003` | `password123` |

Never keep these on a public server.
