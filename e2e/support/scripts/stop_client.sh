#/bin/bash -e

kill -s 9 `cat /tmp/ionic-run.pid` || true
rm /tmp/ionic-run.pid || true