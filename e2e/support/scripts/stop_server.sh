#/bin/bash -e

kill -s 9 `cat /tmp/rails-test.pid` || true
rm /tmp/rails-test.pid || true