#!/bin/sh
# The periodic job (retention, alerts, reminders, registry checks, payouts, e-mails), called inside the container so it
# does not depend on DNS. Installed in root's crontab every five minutes.
docker exec proofseen-web node -e 'fetch("http://localhost:3100/api/cron/notifications",{headers:{authorization:"Bearer "+process.env.CRON_SECRET}}).then(async r=>{const t=await r.text();console.log(new Date().toISOString(),r.status,t.slice(0,300));if(!r.ok)process.exit(1)}).catch(e=>{console.error(e);process.exit(1)})'
notifications=$?
# AI visibility measurements requested from the app: at most one per call, within the platform spending caps. The
# route answers at once (202 when it took a request) and measures after its answer, so this call never waits minutes.
docker exec proofseen-web node -e 'fetch("http://localhost:3100/api/cron/measurements",{headers:{authorization:"Bearer "+process.env.CRON_SECRET}}).then(async r=>{const t=await r.text();console.log(new Date().toISOString(),r.status,t.slice(0,300));if(!r.ok)process.exit(1)}).catch(e=>{console.error(e);process.exit(1)})'
measurements=$?
# One failing call does not skip the other; the job still reports the failure.
[ "$notifications" -eq 0 ] && [ "$measurements" -eq 0 ]
