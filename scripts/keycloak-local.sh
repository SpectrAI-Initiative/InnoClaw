#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
python3 deploy/keycloak/init.py
docker compose --env-file deploy/keycloak/runtime/local.env -f deploy/keycloak/compose.yml up -d --build
python3 - <<'PYREADY'
import time, urllib.request
opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
for attempt in range(120):
    try:
        with opener.open('http://localhost:8280/realms/innoscale/.well-known/openid-configuration', timeout=2) as response:
            assert response.status == 200
        with opener.open('http://localhost:3200/api/auth/oidc/config', timeout=2) as response:
            assert response.status == 200
        print('Ready: app http://localhost:3200 | inbox http://localhost:8025 | identity http://localhost:8280')
        break
    except Exception:
        time.sleep(1)
else:
    raise SystemExit('Local services did not become ready. Inspect docker compose logs.')
PYREADY
