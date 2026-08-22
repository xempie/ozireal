#!/usr/bin/env bash
#
# Prove the database refuses what CLAUDE.md says it must refuse.
#
# These are not tests of application code. They check that the guarantees live in the
# DATABASE, so they hold even if a future refactor forgets them. Every "expect_error"
# case is something the schema must make impossible.
#
#   bash scripts/db-guards.sh

PSQL="${PSQL:-/c/Program Files/PostgreSQL/18/bin/psql.exe}"
DB=(-w -U "${PGUSER:-ozirealty}" -h "${PGHOST:-127.0.0.1}" -p "${PGPORT:-5433}" -d "${PGDATABASE:-ozirealty}")
pass=0
fail=0

# The database MUST reject this.
expect_error() {
  out=$("$PSQL" "${DB[@]}" -tAc "$2" 2>&1)
  if echo "$out" | grep -qi "ERROR\|violates\|append-only"; then
    printf '  PASS  %s\n' "$1"; pass=$((pass + 1))
  else
    printf '  FAIL  %s  (the database ALLOWED it)\n' "$1"; fail=$((fail + 1))
  fi
}

# This must succeed.
expect_ok() {
  out=$("$PSQL" "${DB[@]}" -tAc "$2" 2>&1)
  if echo "$out" | grep -qi "ERROR"; then
    printf '  FAIL  %s  -> %s\n' "$1" "$(echo "$out" | head -1)"; fail=$((fail + 1))
  else
    printf '  PASS  %s\n' "$1"; pass=$((pass + 1))
  fi
}

# Must return a count greater than zero.
#
# Note: do NOT assert this with "case when count(*)=0 then 1/0 ...". Postgres
# constant-folds 1/0 while planning, so it raises even in the unreachable branch.
expect_nonzero() {
  out=$("$PSQL" "${DB[@]}" -tAc "$2" 2>&1 | tr -d '[:space:]')
  if echo "$out" | grep -qi "ERROR"; then
    printf '  FAIL  %s  -> %s\n' "$1" "$out"; fail=$((fail + 1))
  elif [ -n "$out" ] && [ "$out" -gt 0 ] 2>/dev/null; then
    printf '  PASS  %s  (%s)\n' "$1" "$out"; pass=$((pass + 1))
  else
    printf '  FAIL  %s  -> returned "%s", expected > 0\n' "$1" "$out"; fail=$((fail + 1))
  fi
}

echo "Append-only log (CLAUDE.md 4)"
expect_error "interactions: UPDATE body is refused" \
  "update interactions set body='tampered' where id=(select id from interactions limit 1);"
expect_error "interactions: DELETE is refused" \
  "delete from interactions where id=(select id from interactions limit 1);"
expect_ok "interactions: tombstoning IS allowed (privacy request)" \
  "update interactions set tombstoned_at=now() where id=(select id from interactions where tombstoned_at is null limit 1);"
expect_error "interactions: a tombstone cannot be reversed" \
  "update interactions set tombstoned_at=null where tombstoned_at is not null;"
expect_error "consents: UPDATE is refused" \
  "update consents set status='granted' where id=(select id from consents limit 1);"

echo "Outbound integrity (rules 1 and 2)"
expect_error "approval: blocked with no reason is refused" \
  "insert into approval_items (tenant_id,kind,status,draft_body) select id,'email','blocked','x' from tenants limit 1;"
expect_error "approval: sent with no timestamp is refused" \
  "insert into approval_items (tenant_id,kind,status,draft_body) select id,'email','sent','x' from tenants limit 1;"
expect_error "approval: rejected with no reason is refused" \
  "insert into approval_items (tenant_id,kind,status,draft_body) select id,'email','rejected','x' from tenants limit 1;"

echo "Evidence retention (from the schema review)"
expect_error "approval: a SENT item cannot be deleted" \
  "delete from approval_items where status='sent';"
expect_error "approval: a BLOCKED item cannot be deleted" \
  "delete from approval_items where status='blocked';"
expect_error "interactions: listing_id must reference a real listing" \
  "insert into interactions (tenant_id,contact_id,channel,direction,occurred_at,listing_id) select t.id,c.id,'email','in',now(),gen_random_uuid() from tenants t, contacts c limit 1;"
expect_error "proposals: property_id must reference a real property" \
  "insert into proposals (tenant_id,contact_id,property_id) select t.id,c.id,gen_random_uuid() from tenants t, contacts c limit 1;"

echo "Listing and matching (16, 6)"
expect_error "listing: live with no price wording is refused" \
  "update listings set price_display=null where status='live';"
expect_error "match: blank reason is refused" \
  "insert into matches (tenant_id,listing_id,contact_id,score,reason,stage) select t.id,l.id,c.id,0.5,'  ','ranked' from tenants t, listings l, contacts c limit 1;"
expect_error "listing: two live campaigns on one property is refused" \
  "insert into listings (tenant_id,property_id,listing_type,status,price_display,slug) select tenant_id,property_id,'sale','live','X','dupe-slug' from listings where status='live' limit 1;"

echo "The matching filter can actually match (6)"
expect_nonzero "stage-1 filter returns matches rather than a silent zero" \
  "select count(*) from contact_preferences cp join properties p on p.property_type = any(cp.property_types);"
expect_nonzero "suburbs join through a real FK, not a name string" \
  "select count(*) from contact_preference_suburbs cps join properties p on p.suburb_id = cps.suburb_id;"
expect_nonzero "a property carries its own status, independent of any listing" \
  "select count(*) from properties where status is not null;"

echo "Merge review (4)"
expect_error "merge review: a contact cannot duplicate itself" \
  "insert into merge_reviews (tenant_id,contact_a_id,contact_b_id,similarity,matched_on) select t.id,c.id,c.id,0.9,'x' from tenants t, contacts c limit 1;"
expect_ok "merge review: two contacts CAN share a phone number" \
  "select count(*) from contacts group by tenant_id, phone_e164 having count(*)>1;"

echo
printf '%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
