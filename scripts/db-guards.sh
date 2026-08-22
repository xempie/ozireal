#!/usr/bin/env bash
# Prove the database refuses what CLAUDE.md says it must refuse. Each case should FAIL.
PSQL="/c/Program Files/PostgreSQL/18/bin/psql.exe"
DB=(-w -U ozirealty -h 127.0.0.1 -p 5433 -d ozirealty)
pass=0; fail=0

expect_error () { # name, sql
  out=$("$PSQL" "${DB[@]}" -tAc "$2" 2>&1)
  if echo "$out" | grep -qi "ERROR\|violates\|append-only"; then
    printf "  PASS  %s\n" "$1"; pass=$((pass+1))
  else
    printf "  FAIL  %s  (the database allowed it)\n" "$1"; fail=$((fail+1))
  fi
}
expect_ok () {
  out=$("$PSQL" "${DB[@]}" -tAc "$2" 2>&1)
  if echo "$out" | grep -qi "ERROR"; then
    printf "  FAIL  %s  -> %s\n" "$1" "$(echo "$out" | head -1)"; fail=$((fail+1))
  else printf "  PASS  %s\n" "$1"; pass=$((pass+1)); fi
}

echo "Append-only log (CLAUDE.md 4)"
expect_error "interactions: UPDATE body is refused" \
  "update interactions set body='tampered' where id=(select id from interactions limit 1);"
expect_error "interactions: DELETE is refused" \
  "delete from interactions where id=(select id from interactions limit 1);"
expect_ok    "interactions: tombstoning IS allowed (privacy request)" \
  "update interactions set tombstoned_at=now() where id=(select id from interactions limit 1);"
expect_error "consents: UPDATE is refused" \
  "update consents set status='granted' where id=(select id from consents limit 1);"

echo "Outbound integrity (rules 1 and 2)"
expect_error "approval: blocked with no reason is refused" \
  "insert into approval_items (tenant_id,kind,status,draft_body) select id,'email','blocked','x' from tenants limit 1;"
expect_error "approval: sent with no timestamp is refused" \
  "insert into approval_items (tenant_id,kind,status,draft_body) select id,'email','sent','x' from tenants limit 1;"
expect_error "approval: rejected with no reason is refused" \
  "insert into approval_items (tenant_id,kind,status,draft_body) select id,'email','rejected','x' from tenants limit 1;"

echo "Listing and matching (16, 6)"
expect_error "listing: live with no price wording is refused" \
  "update listings set price_display=null where status='live';"
expect_error "match: blank reason is refused" \
  "insert into matches (tenant_id,listing_id,contact_id,score,reason,stage) select t.id,l.id,c.id,0.5,'  ','ranked' from tenants t, listings l, contacts c limit 1;"
expect_error "listing: two live campaigns on one property is refused" \
  "insert into listings (tenant_id,property_id,listing_type,status,price_display,slug) select tenant_id,property_id,'sale','live','X','dupe-slug' from listings where status='live' limit 1;"

echo "Merge review (4)"
expect_error "merge review: a contact cannot duplicate itself" \
  "insert into merge_reviews (tenant_id,contact_a_id,contact_b_id,similarity,matched_on) select t.id,c.id,c.id,0.9,'x' from tenants t, contacts c limit 1;"
expect_ok    "merge review: two contacts CAN share a phone number" \
  "select count(*) from contacts group by tenant_id, phone_e164 having count(*)>1;"

echo
printf "%d passed, %d failed\n" "$pass" "$fail"
[ "$fail" -eq 0 ]
