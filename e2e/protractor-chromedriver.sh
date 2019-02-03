TMPDIR="/tmp"
NODE_MODULES="$(dirname $0)/../node_modules"
CHROMEDRIVER="${NODE_MODULES}/protractor/node_modules/webdriver-manager/selenium/chromedriver_2.45"
LOG="${TMPDIR}/chromedriver.$$.log"

fatal() {
    # Dump to stderr because that seems reasonable
    echo >&2 "$0: ERROR: $*"
    # Dump to a logfile because webdriver redirects stderr to /dev/null (?!)
    echo >"${LOG}" "$0: ERROR: $*"
    exit 11
}


[ ! -x "$CHROMEDRIVER" ] && fatal "Cannot find chromedriver: $CHROMEDRIVER"

exec "${CHROMEDRIVER}" --verbose --log-path="${LOG}" "$@"