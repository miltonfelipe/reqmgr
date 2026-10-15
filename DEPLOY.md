# Deploying REQMGR on AWS

This sets up REQMGR on a single EC2 instance running Ubuntu:

```
users ──HTTPS──▶ Caddy (:443, automatic certificate) ──▶ uvicorn (127.0.0.1:8000) ──▶ SQLite file
```

- **uvicorn** runs the app as a systemd service and serves both the API and the built web UI.
- **Caddy** is the public web server: it gets and renews the HTTPS certificate and forwards requests.
- **All data** (users, projects, members, in-app backups) is in one file: `/var/lib/reqmgr/reqmgr.db`.

The files used below are in [`deploy/`](deploy/):

| File | Installed to | Purpose |
|------|--------------|---------|
| `reqmgr.env.example`   | `/etc/reqmgr.env` | Settings (database path, first admin password, backups) |
| `reqmgr.service`       | `/etc/systemd/system/` | Runs the app |
| `Caddyfile`            | `/etc/caddy/Caddyfile` | HTTPS reverse proxy |
| `backup.sh`            | (run from the repo) | Backs up the database, optionally to S3 |
| `reqmgr-backup.service`, `reqmgr-backup.timer` | `/etc/systemd/system/` | Runs the backup nightly |
| `update.sh`            | (run from the repo) | Backs up, pulls the latest code, rebuilds, restarts |

## 1. Create the server in AWS

1. **EC2 → Launch instance**
   - Image: **Ubuntu Server 24.04 LTS**
   - Type: **t3.small** (plenty for a team; t3.micro also works for a few users)
   - Key pair: create or choose one for SSH
   - Storage: **20 GB gp3**
2. **Security group** (inbound rules):
   - SSH (22) — **your IP only**
   - HTTP (80) and HTTPS (443) — `0.0.0.0/0`, or only your office / VPN range if the tool
     should not be reachable from the internet. Port 80 is needed for Caddy to obtain the certificate.
   - Do **not** open port 8000.
3. **Elastic IP**: EC2 → Elastic IPs → Allocate, then associate it with the instance, so the
   address survives restarts.
4. **DNS**: create an `A` record such as `reqmgr.yourcompany.com` pointing to the Elastic IP
   (in Route 53 or your DNS provider). Caddy needs this name to issue the certificate.
5. *(Optional, for S3 backups)* create an S3 bucket and an IAM role for the instance — see
   [Backups](#6-backups).

## 2. Install the app

SSH in (`ssh -i your-key.pem ubuntu@reqmgr.yourcompany.com`) and run:

```bash
sudo apt update
sudo apt install -y git nodejs npm python3-venv caddy

# System user that owns and runs the app
sudo useradd --system --create-home --home-dir /opt/reqmgr --shell /usr/sbin/nologin reqmgr
sudo mkdir -p /var/lib/reqmgr && sudo chown reqmgr: /var/lib/reqmgr

# Code, frontend build and Python packages
sudo -u reqmgr git clone https://github.com/miltonfelipe/reqmgr.git /opt/reqmgr/app
cd /opt/reqmgr/app
sudo -u reqmgr npm ci
sudo -u reqmgr npm run build
sudo -u reqmgr python3 -m venv .venv
sudo -u reqmgr .venv/bin/pip install -r server/requirements.txt
```

> If the repository is private, add a [deploy key](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/managing-deploy-keys)
> for the `reqmgr` user and clone with `git@github.com:miltonfelipe/reqmgr.git`.

## 3. Configure

```bash
sudo cp deploy/reqmgr.env.example /etc/reqmgr.env
sudo chmod 600 /etc/reqmgr.env
sudo nano /etc/reqmgr.env      # set REQMGR_ADMIN_PASSWORD (and REQMGR_BACKUP_S3 if used)
```

## 4. Start the app

```bash
sudo cp deploy/reqmgr.service deploy/reqmgr-backup.service deploy/reqmgr-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now reqmgr reqmgr-backup.timer
systemctl status reqmgr        # should be "active (running)"
curl -s localhost:8000/api/me  # {"detail":"Not logged in"} means it works
```

## 5. Enable HTTPS

```bash
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
sudo sed -i 's/reqmgr.example.com/reqmgr.yourcompany.com/' /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Open **https://reqmgr.yourcompany.com** and log in as **`admin`** with the password from
`/etc/reqmgr.env`. Then:

1. Change the admin password (user menu → *Manage users* → *Change pwd*), and delete the
   `REQMGR_ADMIN_PASSWORD` line from `/etc/reqmgr.env` — it is only used on the very first start.
2. Create accounts for your team (*Manage users* → *Add user*).
3. Create a project, or import one, and add people under Overview → *Members & backups*.

## 6. Backups

The in-app backups (saved before every import) protect single projects. To protect **everything**,
including users and memberships, back up the database file. The nightly timer installed above runs
`deploy/backup.sh`, which keeps the last 14 copies in `/var/lib/reqmgr/backups/`.

```bash
sudo systemctl start reqmgr-backup     # run one now
journalctl -u reqmgr-backup -n 20      # see the result
systemctl list-timers reqmgr-backup    # next scheduled run
```

Local copies don't survive losing the instance, so also do at least one of:

- **EBS snapshots** (no setup on the server): EC2 → *Lifecycle Manager* → create a policy that
  snapshots the instance's volume daily and keeps, say, 7.
- **Copy to S3**:
  1. Create a bucket (block all public access).
  2. Create an IAM role for EC2 with this policy, and attach it to the instance
     (EC2 → instance → *Actions → Security → Modify IAM role*):
     ```json
     {
       "Version": "2012-10-17",
       "Statement": [{
         "Effect": "Allow",
         "Action": "s3:PutObject",
         "Resource": "arn:aws:s3:::your-bucket/reqmgr/*"
       }]
     }
     ```
  3. Install the AWS CLI: `sudo snap install aws-cli --classic`
  4. Set `REQMGR_BACKUP_S3=s3://your-bucket/reqmgr` in `/etc/reqmgr.env` and run a backup to test.
     An S3 lifecycle rule can delete old copies automatically.

### Restoring the database

```bash
sudo systemctl stop reqmgr
sudo -u reqmgr sh -c 'gunzip -c /var/lib/reqmgr/backups/reqmgr-<date>.db.gz > /var/lib/reqmgr/reqmgr.db'
sudo rm -f /var/lib/reqmgr/reqmgr.db-wal /var/lib/reqmgr/reqmgr.db-shm
sudo systemctl start reqmgr
```

(From S3, first `aws s3 cp s3://your-bucket/reqmgr/<file> /var/lib/reqmgr/backups/`.)

## 7. Updating

After pushing changes to GitHub:

```bash
sudo /opt/reqmgr/app/deploy/update.sh
```

It backs up the database, pulls, rebuilds the frontend, updates Python packages and restarts the
app. Users only see a brief interruption.

## Troubleshooting

| Symptom | Check |
|---------|-------|
| Site doesn't load | `systemctl status reqmgr caddy`; security group allows 80/443; DNS points to the Elastic IP |
| Certificate error | `journalctl -u caddy -n 50` — port 80 must be reachable and DNS correct |
| "Cannot reach the server" in the app | `journalctl -u reqmgr -n 50` |
| Login works but you're logged out immediately | You opened it over plain `http://` while `REQMGR_SECURE_COOKIES=1` — use `https://` |
| Forgot the admin password | Another administrator can reset it in *Manage users* — so create a second administrator account early |

## Costs (approximate, us-east-1)

t3.small ≈ US$15/month, 20 GB gp3 ≈ US$1.60/month, Elastic IP ≈ US$3.60/month, plus a few cents
for snapshots or S3. A t3.micro halves the instance cost.
