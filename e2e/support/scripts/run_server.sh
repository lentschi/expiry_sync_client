#!/bin/bash -e

source /home/web/.rvm/scripts/rvm

set -v
cd /srv/expiry_sync_server
bundle install --without heroku_production_server heroku_production_db docker_production_db production

rm /srv/expiry_sync_server/config/database.yml || true
ln -s /srv/config/rails/database.yml /srv/expiry_sync_server/config/database.yml
rm /srv/expiry_sync_server/config/initializers/mail.rb || true
ln -s /srv/config/rails/mail.rb /srv/expiry_sync_server/config/initializers/mail.rb

RAILS_ENV=test bundle exec rake db:migrate || RAILS_ENV=test bundle exec rake db:setup && bundle exec rake db:migrate

EMAIL_LINK_HOST="expiry-sync-web.local" authbind --deep bundle exec thin start \
--ssl --ssl-cert-file /srv/config/cert/expirysync_server.crt \
--ssl-key-file /srv/config/cert/expirysync_server.cert.key --port 443 \
-e test