#!/bin/sh
# Tests the access rules on a throwaway local Postgres, with stand-ins for
# Supabase's auth and storage. Needs Postgres's initdb, pg_ctl, and psql.
set -eu
cd "$(dirname "$0")/.."
data="$(mktemp -d)"
port="${TEST_PG_PORT:-54329}"
cleanup() {
  pg_ctl -D "$data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$data"
}
trap cleanup EXIT
initdb -D "$data" -U postgres -A trust >/dev/null
pg_ctl -D "$data" -o "-p $port -k $data -c listen_addresses=''" -w -l "$data/log" start >/dev/null
run() { psql -h "$data" -p "$port" -U postgres -d postgres -v ON_ERROR_STOP=1 -q "$@"; }
run -f tests/supabase_stubs.sql
run -f migrations/0001_reports_and_findings.sql
run -f tests/access.sql
