# Local Postgres check for migrations 044-046

No live database is touched. Needs a local PostgreSQL on socket `/tmp`, port 55432
(e.g. `npm i embedded-postgres pg` in a scratch dir, `initdb -U postgres -A trust`, `pg_ctl -o "-p 55432 -k /tmp" start`)
and `pg` resolvable by node (`NODE_PATH=<scratch>/node_modules`).

    ./apply.sh wgfull          # fresh DB: Supabase auth/storage stubs + every repo migration (retried to a fixpoint)
    node vis-test.cjs wgfull   # seeds a Vis-shaped project (mirrors the live battle-test data) and asserts, per user:
                               #   wg_link_rates read/write, wg_invoices read, wg_get_scoped_graph parties

Known: 003 (syntax error in the repo file) and 015 (depends on 002 seed data) do not apply; nothing later depends on them.
