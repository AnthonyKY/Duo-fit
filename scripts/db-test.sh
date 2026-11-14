#!/usr/bin/env bash
# CollabFit database tests on a throw-away PostgreSQL (nothing to install on Supabase, no key needed):
#   1. a stand-in for what Supabase provides (roles, auth.uid(), storage)   supabase/tests/00_supabase_stub.sql
#   2. the real migrations                                                  supabase/migrations/*.sql
#   3. attack tests with five users                                         supabase/tests/10_security.sql
#   4. two people accepting an invitation to the same couple at the same instant, several rounds: exactly one gets in
set -euo pipefail
cd "$(dirname "$0")/.."
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
[ -x "$PGBIN/initdb" ] || { echo "PostgreSQL server binaries not found (set PGBIN)"; exit 2; }
WORK="$(mktemp -d /tmp/collabfit-db.XXXXXX)"; PORT="${PGPORT:-54333}"
AS=(); if [ "$(id -u)" = 0 ]; then AS=(runuser -u postgres --); chown -R postgres "$WORK"; fi
"${AS[@]}" "$PGBIN/initdb" -D "$WORK/data" -A trust -U postgres >/dev/null
"${AS[@]}" "$PGBIN/pg_ctl" -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses='' -c wal_level=logical" -l "$WORK/log" -w start >/dev/null
trap '"${AS[@]}" "$PGBIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$WORK"' EXIT
PSQL=(psql -h "$WORK" -p "$PORT" -U postgres -d postgres -X -q -t -A -v ON_ERROR_STOP=1)

"${PSQL[@]}" -f supabase/tests/00_supabase_stub.sql >/dev/null
for m in supabase/migrations/*.sql; do "${PSQL[@]}" -f "$m" >/dev/null; echo "applied $(basename "$m")"; done

fails=0
# every test file supabase/tests/[1-9]*.sql, in order (10_security.sql, then e.g. 20_review.sql); a FAIL stops that file
for f in supabase/tests/[1-9]*.sql; do
  echo "--- $(basename "$f")"
  if out=$("${PSQL[@]}" -f "$f" 2>&1); then :; else fails=1; fi
  printf '%s\n' "$out" | sed -n 's/^.*NOTICE:  \(PASS .*\)$/\1/p'
  printf '%s\n' "$out" | grep -E 'FAIL|ERROR' | sed 's/^psql:[^ ]* //' || true
done

# ---- simultaneous joins
as() { "${PSQL[@]}" -c "set role authenticated" -c "select set_config('request.jwt.claim.sub','$1',false)" -c "$2" | tail -1; }
user() { "${PSQL[@]}" -c "insert into auth.users (email) values ('$1@race.invalid') returning id" | head -1; }
for round in 1 2 3 4 5; do
  O=$(user "o$round"); X=$(user "x$round"); Y=$(user "y$round")
  WS=$(as "$O" "select public.create_workspace('Course $round', 'couple')")
  T1=$(as "$O" "select public.create_invitation('$WS')"); T2=$(as "$O" "select public.create_invitation('$WS')")
  # a gate session holds a lock; both racers wait on it, then go at the same instant
  "${PSQL[@]}" -c "select pg_advisory_lock(4242)" -c "select pg_sleep(1)" >/dev/null &
  GATE=$!; sleep 0.3
  race() { "${PSQL[@]}" -v ON_ERROR_STOP=0 -c "set role authenticated" -c "select set_config('request.jwt.claim.sub','$1',false)" \
    -c "select pg_advisory_lock_shared(4242)" -c "select public.accept_invitation('$2')" >"$WORK/race-$3" 2>&1 || true; }
  race "$X" "$T1" x & RX=$!; race "$Y" "$T2" y & RY=$!
  wait $GATE $RX $RY || true
  n=$("${PSQL[@]}" -c "select count(*) from public.workspace_members where workspace_id = '$WS' and status = 'active'")
  ok=0; for r in x y; do grep -q 'ERROR' "$WORK/race-$r" || ok=$((ok+1)); done
  full=$(cat "$WORK/race-x" "$WORK/race-y" | grep -c 'this space is full' || true)
  if [ "$n" = 2 ] && [ "$ok" = 1 ] && [ "$full" = 1 ]; then
    echo "PASS round $round: two people accept at the same instant → exactly one joins, the other is told the space is full"
  else echo "FAIL round $round: active=$n successes=$ok refused-full=$full"; fails=1; fi
done

echo; if [ "$fails" = 0 ]; then echo "database tests: all passed"; else echo "database tests: FAILED"; exit 1; fi
