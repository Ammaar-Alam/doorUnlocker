# Hosting

Door Unlocker runs on the existing MineBench host with separate users, paths, credentials, services, logs, and resource limits.

## Current State

- Host: `minebench-generations-4gb` through `ssh minebench-generations`.
- Public IP: `3.220.240.206`.
- Public domain: `door.ammaaralam.com`.
- DNS: authoritative Cloudflare DoH resolves `door.ammaaralam.com` to A `3.220.240.206`. Some local resolvers may temporarily return the old Heroku CNAME while caches expire.
- Public ingress: TCP 22, 80, and 443 are open; SSH ingress is preserved.
- Runtime observed on host: Node `v22.23.2`, npm `10.9.8`.
- Caddy: `v2.11.4`, official SHA-512 verified, installed at `/usr/local/bin/caddy`.
- HTTPS: verified with normal certificate validation through Caddy by resolving `door.ammaaralam.com` to `3.220.240.206`.
- App status: HTTP 200 through Caddy; app reports the controller offline and the door closed.
- Status polling: the app uses a 1-second real-status cache to avoid multiplying Arduino Cloud requests across multiple clients.
- MineBench impact: no MineBench services were restarted; Alpha and production generation workers remained active.
- Heroku state before cutover: one Eco web dyno and no add-ons. Removing this app may not remove a shared Eco subscription while other Eco apps remain.

## Installed Files

- App user and group: `doorunlocker:doorunlocker`.
- Proxy user and group: `doorproxy:doorproxy`.
- App code: `/opt/doorunlocker`.
- App environment: `/etc/doorunlocker/doorunlocker.env`, owned by root, mode `0600`.
- App unit: `/etc/systemd/system/doorunlocker.service`.
- App listener: `127.0.0.1:3107`.
- Proxy config: `/etc/doorproxy/Caddyfile`, owned by root, mode `0644`.
- Proxy unit: `/etc/systemd/system/doorproxy.service`.
- Proxy certificate and state directory: `/var/lib/doorproxy/caddy`, owned by `doorproxy:doorproxy`, mode `0700`.

## Resource Limits

- `doorunlocker.service`: `MemoryHigh=192M`, `MemoryMax=256M`, `CPUQuota=25%`, `TasksMax=64`.
- `doorproxy.service`: `MemoryHigh=128M`, `MemoryMax=192M`, `CPUQuota=20%`, `TasksMax=64`.

Pre-deploy host capacity observed on 2026-09-09 01:08 UTC: 3.7 GiB RAM total, 3.1 GiB available, 1.0 GiB swap configured, 0 B swap used, load `0.00, 0.01, 0.00`. MineBench Alpha was about 149 MiB RSS and production about 156 MiB RSS at that check.

Post-deploy pre-Arduino-SDK-push-subscription check: 20 simultaneous SSE clients measured `doorunlocker.service` at `MemoryCurrent=30289920`, about 29 MiB service-accounted memory; `doorproxy.service` was about 10 MiB. Re-measure after the Arduino SDK push subscription path lands.

## Verify

```bash
ssh minebench-generations
systemctl status doorunlocker.service doorproxy.service --no-pager
curl -fsS http://127.0.0.1:3107/api/auth-status
curl -fsS https://door.ammaaralam.com/api/auth-status
systemctl show doorunlocker.service doorproxy.service -p ActiveState -p MemoryCurrent -p MemoryHigh -p MemoryMax -p CPUQuotaPerSecUSec -p TasksCurrent
free -h
swapon --show
```

## Rollback

For resource pressure or a service fault, fail closed by stopping the new services:

```bash
sudo systemctl disable --now doorproxy.service
sudo systemctl disable --now doorunlocker.service
```

Close TCP 80 and 443 in Lightsail if the public path should become unreachable. Leave TCP 22 open.

Do not restore `door.ammaaralam.com` to the old Heroku CNAME without first confirming the Heroku app and firmware both use the current command protocol. The old Heroku code may speak the old command protocol, so DNS rollback alone can break door control.

Keep `/etc/doorunlocker/doorunlocker.env` until the rollback is confirmed, then remove it through a root shell.

## RSS Check

Measure memory after any service, dependency, or firmware integration change:

```bash
ps -eo pid,user,pmem,rss,vsz,comm,args | awk 'NR == 1 || /doorunlocker|doorproxy|caddy/'
systemctl show doorunlocker.service doorproxy.service -p MemoryCurrent -p MemoryHigh -p MemoryMax -p TasksCurrent
free -h
swapon --show
```

Keep `doorunlocker.service` at `MemoryMax=256M` unless normal use proves it needs more. If swap becomes nonzero or MineBench needs the host for a large generation, stop `doorproxy.service` and `doorunlocker.service` first.
