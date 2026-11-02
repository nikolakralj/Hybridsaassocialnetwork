#!/bin/bash
# apply.sh <db> [extra files...]: fresh db, supabase stubs, repo migrations retried until fixpoint
HERE=$(cd "$(dirname "$0")" && pwd)
DB=${1:-wgtest}; shift
echo "DROP DATABASE IF EXISTS $DB WITH (FORCE)" > /tmp/d.sql; node "$HERE/psql.cjs" /tmp/d.sql >/dev/null
echo "CREATE DATABASE $DB" > /tmp/d.sql; node "$HERE/psql.cjs" /tmp/d.sql
node "$HERE/psql.cjs" "$HERE/stubs.sql" $DB 2>&1 | grep ERR
# Order as applied live: 20260424 (fix_rls_recursion) right after 013; the
# July remote snapshots after 024/025/027 as their timestamps imply.
ordered() { ls "$HERE/../../migrations"/*.sql | grep -v 002_seed | sort | awk '
  /20260424000000/ {next} /20260715023036/ {next} /20260715024126/ {next} /20260720012640/ {next}
  {print} /013_graph_node_id/ {print d"/20260424000000_fix_rls_recursion.sql"}
  /024_trust_core/ {print d"/20260715023036_remote_trust_core_review_fixes.sql"}
  /025_scoped_graph/ {print d"/20260715024126_remote_scoped_graph_projection.sql"}
  /027_party_approver/ {print d"/20260720012640_remote_party_approver_delegation.sql"}' d="$HERE/../../migrations"; }
pending=$(ordered; for x in "$@"; do echo $x; done)
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
