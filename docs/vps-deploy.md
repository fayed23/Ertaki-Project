# Ertaki on a real VPS — complete beginner guide

This guide assumes **zero** prior experience with servers, domains, Docker, or JWT.  
By the end you will have:

| What | Where you open it |
|---|---|
| Supervisor admin website | `https://YOUR-DOMAIN/` |
| API (used by admin + phone) | `https://YOUR-DOMAIN/api` |
| Health check | `https://YOUR-DOMAIN/api/health` → `{"status":"ok","db":"up"}` |
| Phone app | APK pointed at `https://YOUR-DOMAIN/api` |

**Practice first (free, no VPS):** same Docker stack on your home PC Wi‑Fi → [`lan-home-pilot.md`](./lan-home-pilot.md)  
(Use `docker compose -f docker-compose.yml -f docker-compose.lan.yml up -d --build` so Caddy answers `localhost` and your LAN IP on HTTP, with port **8080** as a Windows fallback.)

**On a real VPS:** use only `docker compose up -d --build` (production `deploy/Caddyfile` + HTTPS). Do **not** pass `-f docker-compose.lan.yml` on the VPS — that overlay turns off automatic HTTPS and is for home Wi‑Fi only.

### Do home/LAN fixes break VPS?

**No.** LAN files are opt‑in overlays. The VPS command never loads them.

| Change | On VPS (`docker compose up`) | Risk |
|---|---|---|
| `deploy/Caddyfile.lan` + `docker-compose.lan.yml` | **Not used** | None unless you add `-f docker-compose.lan.yml` (don’t) |
| Windows firewall `.bat` | Irrelevant on Linux VPS | None |
| `NEXT_PUBLIC_API_URL=/api` | **Correct** for admin+API behind the same domain | Improves reliability; phone still uses `https://YOUR-DOMAIN/api` |
| Production `deploy/Caddyfile` | Still HTTPS + `DOMAIN` | Unchanged behavior |

Before first boot on a VPS you can self-check:

```bash
chmod +x deploy/scripts/*.sh
./deploy/scripts/check-vps-safe.sh
```

---

## Table of contents

1. [What you are building (plain English)](#1-what-you-are-building-plain-english)
2. [Words you need (glossary)](#2-words-you-need-glossary)
3. [Shopping list — what to buy / create](#3-shopping-list--what-to-buy--create)
4. [Buy a domain name](#4-buy-a-domain-name)
5. [Buy a VPS (a small cloud computer)](#5-buy-a-vps-a-small-cloud-computer)
6. [Point the domain at the VPS (DNS)](#6-point-the-domain-at-the-vps-dns)
7. [Log into the VPS (SSH)](#7-log-into-the-vps-ssh)
8. [Install Docker on the VPS](#8-install-docker-on-the-vps)
9. [Put the Ertaki project on the VPS](#9-put-the-ertaki-project-on-the-vps)
10. [Create `.env` — secrets explained one by one](#10-create-env--secrets-explained-one-by-one)
11. [Open firewall ports 80 and 443](#11-open-firewall-ports-80-and-443)
12. [Start Ertaki](#12-start-ertaki)
13. [Check that it works](#13-check-that-it-works)
14. [First login — demo seed vs real accounts](#14-first-login--demo-seed-vs-real-accounts)
15. [Connect the phone APK](#15-connect-the-phone-apk)
16. [Backups (so you do not lose data)](#16-backups-so-you-do-not-lose-data)
17. [Updates, stop, start](#17-updates-stop-start)
18. [Common problems](#18-common-problems)
19. [Appendix — staging, local DB modes, APK flavors](#19-appendix--staging-local-db-modes-apk-flavors)

---

## 1) What you are building (plain English)

On one rented computer (the **VPS**) you run four “boxes” with Docker:

```text
Internet  →  Caddy (door + HTTPS lock)
                ├─ /api…     →  API (NestJS)  →  Postgres (database)
                └─ everything else →  Admin website (Next.js)
```

- **Caddy** is the front door. It gets a free HTTPS certificate and routes traffic.
- **API** is the brain. Phone + admin talk only to the API.
- **Admin** is the supervisor website in the browser.
- **Postgres** stores users, groups, reports, etc.

Your phone never talks to Postgres directly. It only talks to `https://YOUR-DOMAIN/api`.

---

## 2) Words you need (glossary)

| Word | Plain meaning |
|---|---|
| **VPS** | A small computer you rent in a data center. Always on. Has a public IP like `203.0.113.10`. |
| **Domain** | A name people type, e.g. `ertaki.example.com`. You buy it once/year. |
| **DNS** | The phonebook that maps `ertaki.example.com` → your VPS IP. |
| **SSH** | A secure remote terminal so you type commands on the VPS from your PC. |
| **Docker** | Runs Ertaki in isolated containers so you do not install Node/Postgres by hand. |
| **Compose** | One command (`docker compose up`) that starts all containers together. |
| **`.env`** | A private settings file on the server. Passwords live here. Never put it on GitHub. |
| **JWT** | A signed login token the API gives after password login. The phone/admin store it and send it on each request. |
| **JWT_SECRET** | A long random password **only the server knows**. It signs/verifies JWTs. If leaked, attackers can forge logins. |
| **CORS** | Browser security rule: which websites may call the API. Your admin site’s URL must be listed. |
| **HTTPS / TLS** | Encrypted `https://…` traffic. Caddy + Let’s Encrypt do this for free when DNS is correct. |
| **Let’s Encrypt / ACME** | Free automatic HTTPS certificates. Needs a real domain pointing at the VPS. |
| **ACME_EMAIL** | Email Let’s Encrypt can use for certificate expiry notices. |
| **Seed** | Optional demo users (`0500000001` / `password123`). OK for learning; **turn off** on a real public school server. |
| **Migration** | Scripts that create/update database tables. Production uses these (not auto-sync). |

---

## 3) Shopping list — what to buy / create

| Item | Do you buy it? | Typical cost (order of magnitude) | Notes |
|---|---|---|---|
| Domain name | Yes | ~$10–15 / year | Namecheap, Cloudflare Registrar, Google Domains successor, etc. |
| VPS | Yes | ~$5–12 / month | 1 vCPU, 1–2 GB RAM, Ubuntu 22.04 or 24.04 is enough to start |
| Docker | No | Free | You install it on the VPS |
| HTTPS certificate | No | Free | Caddy + Let’s Encrypt |
| GitHub account | Optional | Free | To clone the project; or download ZIP |
| Email address | You already have one | Free | Used as `ACME_EMAIL` |

You do **not** need to buy SSL certificates, a separate database host, or Kubernetes.

**Minimum VPS shape that usually works:** Ubuntu LTS, 1 GB RAM (2 GB more comfortable), 20+ GB disk, public IPv4, ports 22/80/443 reachable.

Providers people commonly use: DigitalOcean, Hetzner, Linode/Akamai, Vultr, Contabo, Oracle free tier (more setup friction). Pick any reputable one in a region close to your users.

---

## 4) Buy a domain name

1. Go to a registrar (example: Namecheap or Cloudflare).
2. Search a name you like, e.g. `ertaki-app.com` or a subdomain plan like `ertaki.yourfamily.com` if you already own a domain.
3. Buy the cheapest **.com / .net / country TLD** you are happy with. Enable auto-renew if you want.
4. Write down the exact hostname you will use for Ertaki. Examples:
   - whole site on the root: `ertaki.example.com`
   - or `app.example.com`

Below we call that hostname **`YOUR-DOMAIN`**.

You do **not** need email hosting for Ertaki to work. You only need DNS control.

---

## 5) Buy a VPS (a small cloud computer)

1. Create an account at a VPS provider.
2. Create a new server:
   - **Image / OS:** Ubuntu 22.04 or 24.04 LTS
   - **Size:** at least 1 GB RAM
   - **Region:** closest to your users
3. Choose how you log in:
   - **SSH key** (recommended): generate a key on your PC and paste the public key into the provider panel.
   - Or **password** login (simpler for absolute beginners; change it immediately).
4. Create the droplet/server. Wait until it is “running”.
5. Copy the **public IPv4 address**. Example: `203.0.113.10`.  
   Below we call it **`YOUR-VPS-IP`**.

### Generate an SSH key on Windows (recommended)

1. Open **Command Prompt** or **PowerShell**.
2. Run:

```bat
ssh-keygen -t ed25519 -C "ertaki-vps"
```

3. Press Enter to accept the default file location.
4. Optionally set a passphrase (a password for the key itself).
5. Open the **public** key file (ends in `.pub`), usually:

```text
C:\Users\YOUR-WINDOWS-USER\.ssh\id_ed25519.pub
```

6. Copy its one line of text into the VPS provider’s “SSH keys” field when creating the server.

Never share the file **without** `.pub` — that is the private key.

---

## 6) Point the domain at the VPS (DNS)

In your domain registrar’s DNS panel:

1. Add an **A record**:

| Type | Name / Host | Value | TTL |
|---|---|---|---|
| A | `@` (or `ertaki` / `app` if using a subdomain) | `YOUR-VPS-IP` | Auto / 300 |

Examples:

- Domain is `example.com` and you want `https://example.com` → Name `@`, Value `YOUR-VPS-IP`
- You want `https://ertaki.example.com` → Name `ertaki`, Value `YOUR-VPS-IP`

2. Save. DNS can take **5 minutes to a few hours**.
3. From your PC, test when ready:

```bat
nslookup YOUR-DOMAIN
```

You want the answer to show `YOUR-VPS-IP`.

**Do not continue to HTTPS until this matches.** Let’s Encrypt will fail if DNS still points elsewhere.

Optional: if the provider shows an IPv6 address and you use it, also add an **AAAA** record. If you are unsure, IPv4 **A** record alone is enough.

---

## 7) Log into the VPS (SSH)

From Windows Command Prompt (replace user/IP — many images use `root`):

```bat
ssh root@YOUR-VPS-IP
```

Or if you created a user `ubuntu`:

```bat
ssh ubuntu@YOUR-VPS-IP
```

First time it asks “Are you sure you want to continue connecting?” → type `yes`.

If it asks for a password, paste the one from the provider email/panel.

You are now typing commands **on the VPS**, not on your PC. Prompt often looks like `root@ertaki:~#`.

Update the OS once:

```bash
apt update && apt upgrade -y
```

---

## 8) Install Docker on the VPS

Still on the VPS (Ubuntu):

```bash
apt install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo \"$VERSION_CODENAME\") stable" \
  > /etc/apt/sources.list.d/docker.list

apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Check:

```bash
docker --version
docker compose version
```

Both should print a version number.

If you log in as a non-root user, either use `sudo` before Docker commands or:

```bash
usermod -aG docker YOUR-USERNAME
```

then log out and SSH back in.

---

## 9) Put the Ertaki project on the VPS

### Option A — git clone (cleanest)

```bash
apt install -y git
cd /opt
git clone https://github.com/fayed23/Ertaki-Project.git ertaki
cd /opt/ertaki
```

### Option B — upload a ZIP from your PC

1. On GitHub: **Code → Download ZIP**.
2. Unzip on the PC.
3. Use an SFTP tool (WinSCP, FileZilla) to upload the folder to `/opt/ertaki` on the VPS.

Then:

```bash
cd /opt/ertaki
```

---

## 10) Create `.env` — secrets explained one by one

The file `.env` tells Docker your passwords and public URLs.  
It must **not** be committed to GitHub.

```bash
cd /opt/ertaki
cp .env.example .env
nano .env
```

(`nano` is a simple editor: edit text, then `Ctrl+O` Enter to save, `Ctrl+X` to exit.)

### 10.1 Generate strong secrets (do this on the VPS)

```bash
# JWT signing secret (≥32 random characters)
openssl rand -base64 48

# Database password
openssl rand -base64 24
```

Copy each output somewhere safe (password manager). You will paste them into `.env`.

### 10.2 What each setting means

#### `NODE_ENV=production`

Tells the API “this is real”. Weak demo secrets are **rejected**. Leave as `production`.

#### `JWT_SECRET=…`

- **What:** private key material used to **sign login tokens** (JWTs).
- **How to make it:** `openssl rand -base64 48` (see above).
- **Rules:** at least **32 characters**; must **not** contain `change-me` or known demo strings.
- **If someone steals it:** they can forge “logged in as supervisor” tokens. Treat it like a master password.
- **If you lose it / change it:** every existing phone/admin session becomes invalid (users log in again). Data in the database is fine.

#### `POSTGRES_USER=ertaki`

Database username inside Docker. `ertaki` is fine. Rarely needs changing.

#### `POSTGRES_PASSWORD=…`

- **What:** password for the Postgres database.
- **How:** `openssl rand -base64 24`.
- **Rules:** do **not** use `ertaki`, `password`, or `change-me…`. Production will refuse demo passwords.
- Only containers on this VPS need it; you do not type it daily.

#### `POSTGRES_DB=ertaki`

Database name. Leave as `ertaki` unless you know you need another.

#### `DOMAIN=YOUR-DOMAIN`

- **What:** the hostname Caddy listens for and requests an HTTPS certificate for.
- **Example:** `ertaki.example.com` (no `https://`, no trailing slash).
- Must match the DNS A record from section 6.
- `localhost` is only for local smoke tests (no real public HTTPS).

#### `ACME_EMAIL=you@example.com`

- **What:** contact email for Let’s Encrypt certificate notices.
- Use a real inbox you check. Not shown to app users.

#### `NEXT_PUBLIC_API_URL=/api` (recommended behind Caddy)

- **What:** the API path the **admin website** (browser JavaScript) calls.
- **Best value on LAN and on VPS when Caddy serves admin + API together:** `/api`  
  Same origin as the page → no Host/port mismatch → avoids browser **Failed to fetch**.
- Absolute URL only if you deliberately open admin on a different host, e.g. `https://ertaki.example.com/api`.
- This value is baked at **Docker build** time — change it → `docker compose up -d --build`.

#### `CORS_ORIGINS=https://YOUR-DOMAIN`

- **What:** list of browser origins allowed to call the API when the page origin ≠ API origin.
- With `NEXT_PUBLIC_API_URL=/api` (same origin), admin login does not need CORS; still set your public site origin for safety: `https://YOUR-DOMAIN`
- Multiple values: comma-separated.
- Example LAN: `http://192.168.1.23,http://192.168.1.23:8080,http://localhost,http://127.0.0.1`
- If empty in production, **cross-origin** browser calls are blocked.

#### `JWT_EXPIRES_IN=12h`

- **What:** how long a login token stays valid before the user must log in again.
- `12h` = twelve hours. You can use `24h`, `7d`, etc.
- Shorter = safer if a phone is stolen; longer = less re-login annoyance.

#### `SEED_ON_EMPTY` and `ALLOW_DEMO_SEED`

| Goal | Settings |
|---|---|
| **Real public school server** | `SEED_ON_EMPTY=false` and `ALLOW_DEMO_SEED=false` |
| **First boot learning only** | both `true` (creates demo phones with `password123`) |

Demo accounts (only if both are true on an empty DB):

| Role | Phone | Password |
|---|---|---|
| Supervisor | `0500000001` | `password123` |
| Teacher | `0500000002` | `password123` |
| Student | `0500000003` | `password123` |

Turn seeding **off** after you create real users, or never enable it on a public VPS.

### 10.3 Example filled `.env` (fake secrets — generate your own)

```env
NODE_ENV=production

JWT_SECRET=PASTE_OUTPUT_OF_openssl_rand_base64_48_HERE
POSTGRES_USER=ertaki
POSTGRES_PASSWORD=PASTE_OUTPUT_OF_openssl_rand_base64_24_HERE
POSTGRES_DB=ertaki

DOMAIN=ertaki.example.com
ACME_EMAIL=you@example.com

NEXT_PUBLIC_API_URL=/api
CORS_ORIGINS=https://ertaki.example.com

JWT_EXPIRES_IN=12h

SEED_ON_EMPTY=false
ALLOW_DEMO_SEED=false
```

Save the file. Restrict permissions:

```bash
chmod 600 .env
```

---

## 11) Open firewall ports 80 and 443

The internet must reach Caddy.

### On the VPS (UFW example)

```bash
apt install -y ufw
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
ufw status
```

Keep **OpenSSH** allowed or you can lock yourself out.

### In the cloud provider panel

Many providers have a separate “Firewall / Security Group”. Allow inbound:

| Port | Protocol | Why |
|---|---|---|
| 22 | TCP | SSH |
| 80 | TCP | HTTP (Let’s Encrypt + redirect) |
| 443 | TCP | HTTPS |

---

## 12) Start Ertaki

Optional safety check (confirms you are **not** on the LAN overlay):

```bash
chmod +x deploy/scripts/*.sh
./deploy/scripts/check-vps-safe.sh
```

```bash
cd /opt/ertaki
docker compose up -d --build
```

First run downloads base images and builds API + admin — can take several minutes.

Watch progress:

```bash
docker compose ps
docker compose logs -f
```

(`Ctrl+C` stops following logs; containers keep running.)

You want `postgres`, `api`, `admin`, and `caddy` **running** / healthy.

If `api` keeps restarting, secrets are usually wrong:

```bash
docker compose logs api --tail 80
```

---

## 13) Check that it works

From **your PC browser** (not only from the VPS):

1. Open `https://YOUR-DOMAIN/api/health`  
   Expect something like: `{"status":"ok","db":"up"}`
2. Open `https://YOUR-DOMAIN/`  
   Expect the **ارتق** supervisor login page (padlock in the address bar = HTTPS OK).

From the VPS itself:

```bash
curl -fsS https://YOUR-DOMAIN/api/health
```

If HTTPS fails but DNS is correct, wait a few minutes and check Caddy logs:

```bash
docker compose logs caddy --tail 100
```

Common certificate failures: DNS not pointing here yet, port 80 blocked, or `DOMAIN` typo in `.env`.

---

## 14) First login — demo seed vs real accounts

### Path A — temporary demo (learning VPS only)

In `.env`:

```env
SEED_ON_EMPTY=true
ALLOW_DEMO_SEED=true
```

Rebuild/recreate API so it picks up env (empty DB only seeds once):

```bash
cd /opt/ertaki
docker compose up -d --build
```

Log into admin with `0500000001` / `password123`.  
**Then** create real users, change passwords, and set both seed flags back to `false`, then:

```bash
docker compose up -d --build
```

### Path B — production (recommended)

Keep seed flags `false`. Use the admin UI / mobile flows to register and approve real supervisors, teachers, and students according to your program process. There is no magic default password on a clean production database.

---

## 15) Connect the phone APK

1. Install the sideload APK from the GitHub Release:  
   [v1.0.15-apk](https://github.com/fayed23/Ertaki-Project/releases/tag/v1.0.15-apk)  
   (`ertaki-android-release.apk`, **lan** flavor allows cleartext for home pilots; for a real HTTPS VPS this still works because you use `https://…`).
2. On first login, set **API base URL** to:

```text
https://YOUR-DOMAIN/api
```

Example: `https://ertaki.example.com/api`

3. No trailing junk, no `:43124` (Caddy is on 443).
4. Log in with a real (or demo) account.

For a store / HTTPS-only build later, rebuild with `--flavor prod` and the same HTTPS URL (see appendix).

---

## 16) Backups (so you do not lose data)

On the VPS:

```bash
cd /opt/ertaki
chmod +x deploy/scripts/*.sh
./deploy/scripts/backup-postgres.sh
```

This writes a compressed SQL dump under `deploy/backups/` and refreshes `ertaki-latest.sql.gz`.

Optional encryption if you have a GPG key:

```bash
GPG_RECIPIENT=you@example.com ./deploy/scripts/backup-postgres.sh
```

Nightly cron (2:00 server time):

```bash
crontab -e
```

Add:

```cron
0 2 * * * cd /opt/ertaki && ./deploy/scripts/backup-postgres.sh >>deploy/backups/backup.log 2>&1
```

**3-2-1 idea:** keep copies somewhere else too (download weekly to your PC / object storage). Retention default is **14 days** (`BACKUP_KEEP_DAYS`).

Restore (destructive — overwrites DB):

```bash
./deploy/scripts/restore-postgres.sh deploy/backups/ertaki-YYYYMMDDT….sql.gz
```

Prove restore tooling on a disposable Postgres:

```bash
./deploy/scripts/prove-restore.sh
# writes deploy/backups/RESTORE-PROOF.md
```

---

## 17) Updates, stop, start

### Pull new code and rebuild

```bash
cd /opt/ertaki
git pull
docker compose up -d --build
```

### Stop without deleting data

```bash
docker compose stop
```

### Start again

```bash
docker compose start
```

### Full wipe (destroys the database volume — dangerous)

```bash
docker compose down -v
```

---

## 18) Common problems

### Browser says “site can’t be reached”

- DNS A record still wrong? `nslookup YOUR-DOMAIN`
- VPS running? Provider panel
- Firewall blocking 80/443?
- Containers up? `docker compose ps`

### Certificate / HTTPS error

- DNS must already point to this VPS before Caddy can succeed
- Port **80** must be open (Let’s Encrypt HTTP challenge)
- `DOMAIN` in `.env` must match the name you type in the browser
- Check: `docker compose logs caddy --tail 100`

### Admin page loads but login fails

- **Failed to fetch:** set `NEXT_PUBLIC_API_URL=/api` and rebuild (`docker compose up -d --build`). Absolute `https://YOUR-DOMAIN/api` also works if it exactly matches the browser host.
- `CORS_ORIGINS` must include `https://YOUR-DOMAIN` when using a cross-origin absolute API URL.
- After changing those, rebuild admin: `docker compose up -d --build`
- API logs: `docker compose logs api --tail 80`

### API exits immediately complaining about JWT / password

- `JWT_SECRET` too short or contains `change-me`
- `POSTGRES_PASSWORD` is a demo/placeholder value
- Fix `.env`, then `docker compose up -d --build`

### Phone cannot connect

- URL must be `https://YOUR-DOMAIN/api` (not `localhost`, not the VPS IP with HTTP unless you intentionally configured that)
- Phone has internet
- Health URL works in the phone’s browser first

### Ran out of disk / memory

```bash
df -h
free -h
docker system prune
```

Consider upgrading the VPS to 2 GB RAM if builds or Postgres get OOM-killed.

---

## 19) Appendix — staging, local DB modes, APK flavors

### What production Compose includes

Services: **postgres + api + admin + caddy**.

- Nest is **not** published on the host — only Caddy on `:80` / `:443`.
- Healthchecks: Postgres, `GET /api/health`, admin `/`.
- `TYPEORM_SYNC` forced off; schema from **SQL migrations** (`RUN_MIGRATIONS=true`).

### Staging overlay (second stack on same machine)

```bash
cp .env.example .env.staging
# different DOMAIN, JWT_SECRET, POSTGRES_PASSWORD, CORS_ORIGINS

docker compose -f docker-compose.yml -f docker-compose.staging.yml \
  --env-file .env.staging -p ertaki-staging up -d --build
```

### Local developer DB modes (not the VPS path)

| Mode | How | Schema |
|---|---|---|
| Local SQLite | `cd api && npm run start:dev` | `synchronize: true` (dev only) |
| Local Postgres | `docker compose -f docker-compose.dev.yml up -d` + host Nest | migrations preferred |
| Production Compose | `docker compose up -d --build` | migrations |

### Auth hardening (already in the app)

- Production refuses weak JWT / demo DB passwords and forbids `TYPEORM_SYNC=true`
- CORS deny-by-default unless `CORS_ORIGINS` is set
- Rate limits on login/register and join-requests
- Default access-token TTL **12h**

### Mobile / APK flavors

| Flavor | Cleartext HTTP | Use |
|---|---|---|
| `lan` | allowed | Home Wi‑Fi pilots |
| `prod` | disabled | HTTPS production API |

```bash
cd mobile
flutter build apk --release --flavor prod \
  --dart-define=API_BASE_URL=https://YOUR-DOMAIN/api
```

Sideload artifact in the repo/releases: `releases/ertaki-android-release.apk`.  
Tokens on device use **flutter_secure_storage**.

### Observability

- Structured JSON HTTP logs from the API
- Point an uptime checker at `GET /api/health`
- `restart: unless-stopped` + healthchecks

### CI

GitHub Actions: API lint/build/e2e, admin build, Flutter analyze + tests.

---

## Related docs

- Home LAN practice (before buying): [`lan-home-pilot.md`](./lan-home-pilot.md)
- Student requests & excuses: [`student-requests.md`](./student-requests.md)
- Gap analysis: [`structure-gap-analysis.md`](./structure-gap-analysis.md)
- Ship review: [`p0-p2-ship-review.md`](./p0-p2-ship-review.md)
- Product map: [`../workflow.md`](../workflow.md)
