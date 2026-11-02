#!/bin/bash
# apply.sh <db> [extra files...]: fresh db, supabase stubs, repo migrations retried until fixpoint
HERE=$(cd "$(dirname "$0")" && pwd)
DB=${1:-wgtest}; shift
echo "DROP DATABASE IF EXISTS $DB WITH (FORCE)" > /tmp/d.sql; node "$HERE/psql.cjs" /tmp/d.sql >/dev/null
echo "CREATE DATABASE $DB" > /tmp/d.sql; node "$HERE/psql.cjs" /tmp/d.sql
node "$HERE/psql.cjs" "$HERE/stubs.sql" $DB 2>&1 | grep ERR
pending=$(ls $HERE/../../migrations/*.sql | grep -v 002_seed | sort; for x in "$@"; do echo $x; done)
for round in 1 2 3 4 5 6; do
  next=""
  for f in $pending; do
    out=$(node "$HERE/psql.cjs" $f $DB 2>&1 | grep ERR)
    if [ -n "$out" ]; then next="$next $f"; echo "r$round $(basename $f): $out" >> /tmp/apply-$DB.log; fi
  done
  [ "$next" == "$(echo $pending)" ] && break
  pending=$next
  [ -z "$pending" ] && break
done
echo "UNAPPLIED:"; for f in $pending; do echo " $(basename $f): $(grep "$(basename $f)" /tmp/apply-$DB.log | tail -1 | cut -d: -f2-)"; done
