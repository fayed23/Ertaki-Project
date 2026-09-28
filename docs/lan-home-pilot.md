# Practice Ertaki on your home Wi‑Fi (before buying a VPS)

This guide is for learning. You will run the **same Docker setup** a small VPS would use — but on **your PC**. Your phone (with the APK) and your PC stay on the **same Wi‑Fi**.

You do **not** need to buy a server yet.

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

## 5) Allow Windows Firewall (so the phone can reach the PC)

1. Windows search → **Windows Defender Firewall**.
2. Click **Allow an app or feature through Windows Firewall**.
3. Or easier for learning: when Docker/Caddy first uses port 80, Windows may pop up — tick **Private networks** → Allow.

If the phone cannot connect later, temporarily allow inbound **TCP port 80** on Private networks, or turn the firewall off only while testing on home Wi‑Fi.

---

## 6) Start Ertaki (the “VPS-like” stack)

1. Open **Command Prompt**.
2. Go into the project folder (change the path if yours is different):

```bat
cd C:\Ertaki-Project
```

3. Start everything (first time downloads images — can take several minutes):

```bat
docker compose up -d --build
```

4. Wait until it finishes without red errors.
5. Check that containers are up:

```bat
docker compose ps
```

You want `postgres`, `api`, `admin`, and `caddy` looking **running** / healthy.

6. Test from the PC browser. Open:

```text
http://YOUR-PC-IP/api/health
```

You should see something like: `{"status":"ok","db":"up"}`.

Also open the admin site:

```text
http://YOUR-PC-IP/
```

You should see the **ارتق** supervisor login page.

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
2. Set it exactly to:

```text
http://YOUR-PC-IP/api
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
- [ ] `docker compose ps` shows 4 services up  
- [ ] PC browser: `http://YOUR-PC-IP/api/health` → ok  
- [ ] PC browser: `http://YOUR-PC-IP/` → admin login works  
- [ ] Phone Wi‑Fi = same as PC  
- [ ] Phone API URL = `http://YOUR-PC-IP/api`  
- [ ] Student/teacher can log in on the phone  

---

## 11) Stop / start later

Stop (keeps your data):

```bat
cd C:\Ertaki-Project
docker compose stop
```

Start again later:

```bat
cd C:\Ertaki-Project
docker compose start
```

Full reset (deletes the practice database — careful):

```bat
docker compose down -v
```

---

## Common problems

### Phone says network / connection error

1. PC and phone on same Wi‑Fi?  
2. API URL on phone is `http://YOUR-PC-IP/api` (not `localhost`, not `127.0.0.1`)?  
3. PC IP changed (router reboot)? Run `ipconfig` again and update `.env` + phone URL, then:

```bat
docker compose up -d --build
```

4. Windows Firewall blocking port 80?

### Admin page loads but login fails

- Confirm seeding: in `.env`, `SEED_ON_EMPTY=true` and `ALLOW_DEMO_SEED=true`, then rebuild:

```bat
docker compose down
docker compose up -d --build
```

### `docker compose` command not found

- Open **Docker Desktop** first, then open a **new** Command Prompt window.

### Port 80 already in use

Something else (IIS, Skype, another web server) is using port 80. Stop that program, or ask for help changing Caddy’s published ports.

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
