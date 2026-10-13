#!/bin/sh
# The periodic job (retention, alerts, reminders, registry checks, payouts, e-mails), called inside the container so it
# does not depend on DNS. Installed in root's crontab every five minutes.
docker exec proofseen-web node -e 'fetch("http://localhost:3100/api/cron/notifications",{headers:{authorization:"Bearer "+process.env.CRON_SECRET}}).then(async r=>{const t=await r.text();console.log(new Date().toISOString(),r.status,t.slice(0,300));if(!r.ok)process.exit(1)}).catch(e=>{console.error(e);process.exit(1)})'
