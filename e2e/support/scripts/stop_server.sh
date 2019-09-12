#/bin/bash -e

kill -s 9 `cat /tmp/rails-test.pid` || true
rm /tmp/rails-test.pid || true
mv /tmp/test.sqlite3 /srv/expiry_sync_server/db/test.sqlite3 || true