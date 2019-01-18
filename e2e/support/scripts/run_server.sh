#!/bin/bash -e

source /home/web/.rvm/scripts/rvm

set -v
kill -s 9 `cat /tmp/rails-test.pid` || true
cd /srv/expiry_sync_server
bundle install --without heroku production local_docker_compose

rm /srv/config/rails || true
ln -s /srv/web_config/rails /srv/config/rails

bundle exec rake db:migrate RAILS_ENV=test || bundle exec rake db:setup && bundle exec rake db:migrate RAILS_ENV=test

EMAIL_LINK_HOST="expiry-sync-web.local" authbind --deep bundle exec thin start \
--ssl --ssl-cert-file /srv/web_config/cert/expirysync_server.crt \
--ssl-key-file /srv/web_config/cert/expirysync_server.cert.key --port 9001 \
-e test -P /tmp/rails-test.pid -d