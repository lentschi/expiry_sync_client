#!/bin/bash -ve
cd /srv/project
if [ ! -f /tmp/ionic-run.pid ]; then
    /srv/config/ionic/prepare.sh
    export N_PREFIX="$HOME/n"; [[ :$PATH: == *":$N_PREFIX/bin:"* ]] || PATH+=":$N_PREFIX/bin"
    cd /
    cd /srv/project
    #ionic serve --no-interactive --no-open --port 80
    nohup ./node_modules/.bin/ng serve --no-open --host "0.0.0.0" --port 9002 \
    --disable-host-check --ssl --ssl-cert /srv/config/cert/expirysync_client.crt \
    --ssl-key /srv/config/cert/expirysync_client.cert.key -c testing 2>&1 >> ~/ng-test.log & echo $! > /tmp/ionic-run.pid
fi

