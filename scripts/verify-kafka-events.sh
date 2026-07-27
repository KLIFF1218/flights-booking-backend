#!/usr/bin/env bash
# End-to-end verification: Outbox → Kafka → consumers → DomainEvent / analytics.
# Usage:
#   ./scripts/verify-kafka-events.sh           # audit only
#   ./scripts/verify-kafka-events.sh --reset # wipe event ledger (keeps bookings)
#   ./scripts/verify-kafka-events.sh --smoke # audit + live booking.created test

set -euo pipefail

API_BASE="${API_BASE:-http://localhost:3001/api/v1}"
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5433}"
PGUSER="${PGUSER:-admin}"
PGPASSWORD="${PGPASSWORD:-}"
PGDATABASE="${PGDATABASE:-maxairline}"

RESET=false
SMOKE=false
for arg in "$@"; do
  case "$arg" in
    --reset) RESET=true ;;
    --smoke) SMOKE=true ;;
  esac
done

export PGPASSWORD

pass=0
fail=0
warn=0

ok() { echo "  ✅ $1"; pass=$((pass + 1)); }
bad() { echo "  ❌ $1"; fail=$((fail + 1)); }
note() { echo "  ⚠️  $1"; warn=$((warn + 1)); }

psql_q() {
  psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -tA -c "$1"
}

section() {
  echo ""
  echo "=== $1 ==="
}

section "1. Infrastructure"
if curl -sf "http://localhost:3001/health/ready" | grep -q '"status"'; then
  ok "API /health/ready"
else
  bad "API /health/ready unreachable"
fi

if docker exec redpanda-dev rpk cluster health 2>/dev/null | grep -q "Healthy"; then
  ok "Redpanda cluster healthy"
else
  note "Redpanda health check skipped or unhealthy (is redpanda-dev running?)"
fi

for group in booking-analytics booking-audit booking-notifications; do
  if docker exec redpanda-dev rpk group list 2>/dev/null | grep -q "$group"; then
    ok "Kafka consumer group: $group"
  else
    bad "Missing Kafka consumer group: $group"
  fi
done

if docker exec rabbitmq-dev rabbitmq-diagnostics ping 2>/dev/null | grep -q "Ping succeeded"; then
  ok "RabbitMQ ping"
else
  note "RabbitMQ ping skipped"
fi

section "2. Outbox (transactional outbox)"
outbox_failed=$(psql_q "SELECT COUNT(*) FROM \"OutboxMessage\" WHERE status = 'FAILED';")
outbox_pending=$(psql_q "SELECT COUNT(*) FROM \"OutboxMessage\" WHERE status IN ('PENDING','PROCESSING');")
if [ "$outbox_failed" = "0" ]; then
  ok "No FAILED outbox messages"
else
  bad "$outbox_failed FAILED outbox messages — check OutboxMessage.lastError"
fi
if [ "$outbox_pending" = "0" ]; then
  ok "No stuck PENDING/PROCESSING outbox messages"
else
  note "$outbox_pending outbox messages still pending (may clear within 5s)"
fi

echo "  Outbox by transport/topic (top):"
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -c \
  "SELECT transport, topic, status, COUNT(*) FROM \"OutboxMessage\" GROUP BY transport, topic, status ORDER BY count DESC LIMIT 12;"

section "3. Domain event log (audit consumer)"
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -c \
  "SELECT \"eventType\", COUNT(*) FROM \"DomainEvent\" GROUP BY \"eventType\" ORDER BY count DESC;"

domain_count=$(psql_q "SELECT COUNT(*) FROM \"DomainEvent\";")
if [ "$domain_count" -gt 0 ]; then
  ok "DomainEvent log has $domain_count events"
else
  note "DomainEvent log is empty (run --smoke or complete a booking flow)"
fi

section "4. Analytics projection"
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -c \
  "SELECT date, \"bookingsCreated\", \"paymentsSucceeded\", \"paymentVolume\", \"bookingsCanceled\", \"bookingsExpired\", \"ticketingFailed\" FROM \"BookingAnalyticsDaily\" ORDER BY date;"

processed=$(psql_q "SELECT COUNT(*) FROM \"ProcessedAnalyticsEvent\";")
last_proc=$(psql_q "SELECT COALESCE(MAX(\"processedAt\")::text, 'never') FROM \"ProcessedAnalyticsEvent\";")
ok "ProcessedAnalyticsEvent: $processed (last: $last_proc)"

bookings=$(psql_q "SELECT COUNT(*) FROM \"Booking\";")
paid_events=$(psql_q "SELECT COUNT(*) FROM \"DomainEvent\" WHERE \"eventType\" = 'booking.paid';")
created_events=$(psql_q "SELECT COUNT(*) FROM \"DomainEvent\" WHERE \"eventType\" = 'booking.created';")
revenue=$(psql_q "SELECT COALESCE(SUM(\"paymentVolume\")::text, '0') FROM \"BookingAnalyticsDaily\";")

if [ "$bookings" = "0" ] && [ "$paid_events" -gt 0 ]; then
  bad "Data drift: $paid_events booking.paid in log but 0 bookings (old seed wiped bookings)"
elif [ "$bookings" -gt 0 ] && [ "$paid_events" -gt "$bookings" ]; then
  note "More paid events than current bookings — historical events in log"
else
  ok "Bookings ($bookings) vs domain events look consistent"
fi

if [ "$paid_events" -gt 0 ] && [ "$revenue" = "0" ]; then
  bad "paymentVolume is 0 but $paid_events booking.paid events exist (bookings missing totalPrice?)"
elif [ "$paid_events" -gt 0 ]; then
  ok "paymentVolume total: $revenue"
fi

if [ "$RESET" = true ]; then
  section "RESET event ledger"
  psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" <<'SQL'
DELETE FROM "ProcessedAnalyticsEvent";
DELETE FROM "BookingAnalyticsDaily";
DELETE FROM "DomainEvent";
SQL
  ok "Cleared DomainEvent + BookingAnalyticsDaily + ProcessedAnalyticsEvent (bookings/outbox kept)"
fi

if [ "$SMOKE" = true ]; then
  section "5. Live smoke: booking.created → Kafka → consumers"
  TS=$(date +%s)
  EMAIL="kafka-verify-${TS}@test.local"
  PASS="Password123!"
  TOMORROW=$(date -u -d '+2 day' +%F 2>/dev/null || date -u -v+2d +%F)

  echo "  Registering $EMAIL ..."
  REG=$(curl -sf -X POST "$API_BASE/auth/register" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"firstName\":\"Kafka\",\"lastName\":\"Verify\"}")
  TOKEN=$(echo "$REG" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).accessToken));")

  echo "  Searching JFK → SFO ($TOMORROW) ..."
  SEARCH=$(curl -sf -X POST "$API_BASE/flights/search" \
    -H 'Content-Type: application/json' \
    -d "{\"directions\":[{\"origin\":\"JFK\",\"destination\":\"SFO\",\"dateFrom\":\"$TOMORROW\"}],\"passengers\":{\"adults\":1},\"travelClass\":\"ECONOMY\",\"currencyCode\":\"USD\"}")
  SEARCH_ID=$(echo "$SEARCH" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).searchId));")
  OFFER_ID=$(echo "$SEARCH" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const j=JSON.parse(d);const o=j.data?.[0];console.log(o?.offerId||o?.id||'');});")

  if [ -z "$OFFER_ID" ] || [ "$OFFER_ID" = "undefined" ]; then
    bad "No offers in search — run: docker exec max-airline-app-dev pnpm seed:demo"
  else
    IDEM="kafka-smoke-${TS}"
    echo "  Creating booking (offer $OFFER_ID) ..."
    BOOK=$(curl -sf -X POST "$API_BASE/booking" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Idempotency-Key: $IDEM" \
      -H 'Content-Type: application/json' \
      -d "{\"searchId\":\"$SEARCH_ID\",\"offerId\":\"$OFFER_ID\"}")
    BOOKING_ID=$(echo "$BOOK" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).id||JSON.parse(d).bookingId||''));")
    ok "Booking created: $BOOKING_ID"

    echo "  Waiting 12s for outbox + Kafka consumers ..."
    sleep 12

    outbox_sent=$(psql_q "SELECT COUNT(*) FROM \"OutboxMessage\" WHERE topic = 'booking.created' AND \"aggregateId\" = '$BOOKING_ID' AND status = 'SENT';")
  kafka_domain=$(psql_q "SELECT COUNT(*) FROM \"DomainEvent\" WHERE \"eventType\" = 'booking.created' AND \"aggregateId\" = '$BOOKING_ID';")
    analytics=$(psql_q "SELECT COUNT(*) FROM \"ProcessedAnalyticsEvent\" pe JOIN \"DomainEvent\" de ON de.\"eventId\" = pe.\"eventId\" WHERE de.\"aggregateId\" = '$BOOKING_ID' AND de.\"eventType\" = 'booking.created';")
    notif=$(psql_q "SELECT COUNT(*) FROM \"UserNotification\" WHERE \"bookingId\" = '$BOOKING_ID' AND type = 'BOOKING_CREATED';")

    if [ "$outbox_sent" -ge 1 ]; then ok "Outbox booking.created SENT"; else bad "Outbox booking.created not SENT for $BOOKING_ID"; fi
    if [ "$kafka_domain" -ge 1 ]; then ok "DomainEvent booking.created persisted (audit consumer)"; else bad "DomainEvent missing for $BOOKING_ID"; fi
    if [ "$analytics" -ge 1 ]; then ok "Analytics consumer processed booking.created"; else bad "Analytics did not process booking.created"; fi
    if [ "$notif" -eq 0 ]; then ok "No in-app BOOKING_CREATED (phase 1: booking.created is not a notification trigger)"; else bad "Unexpected BOOKING_CREATED notification for $BOOKING_ID"; fi
  fi
fi

section "6. In-app notifications (Kafka → UserNotification)"
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -c \
  "SELECT type, COUNT(*) FROM \"UserNotification\" GROUP BY type ORDER BY count DESC;"

notif_total=$(psql_q "SELECT COUNT(*) FROM \"UserNotification\";")
dup_source=$(psql_q "SELECT COUNT(*) - COUNT(DISTINCT \"sourceEventId\") FROM \"UserNotification\" WHERE \"sourceEventId\" IS NOT NULL;")

if [ "$notif_total" -gt 0 ]; then
  ok "UserNotification rows: $notif_total"
else
  note "No in-app notifications yet (run --smoke or complete booking flow)"
fi

if [ "$dup_source" = "0" ]; then
  ok "No duplicate sourceEventId in notifications (idempotent consumer)"
else
  bad "Duplicate sourceEventId detected: $dup_source"
fi

if docker logs max-airline-app-dev 2>&1 | tail -500 | grep -q "Connected Kafka notifications consumer"; then
  ok "Notifications consumer connected in app logs"
else
  note "Could not confirm notifications consumer in recent logs"
fi

section "7. Unit tests (outbox + analytics + notifications)"
if (cd "$(dirname "$0")/.." && pnpm exec jest src/infra/analytics src/infra/notifications src/infra/outbox/outbox.service.spec.ts --silent 2>/dev/null); then
  ok "Jest: analytics + notifications + outbox tests passed"
else
  bad "Jest tests failed"
fi

section "SUMMARY"
echo "  Passed: $pass | Failed: $fail | Warnings: $warn"
if [ "$fail" -gt 0 ]; then
  echo ""
  echo "Fix failures, then for resume demo:"
  echo "  1. SEED_DEMO=false in .env"
  echo "  2. docker exec max-airline-app-dev pnpm seed:demo  (once)"
  echo "  3. Full Stripe flow → admin Rebuild analytics"
  exit 1
fi
echo ""
echo "Resume demo checklist:"
echo "  • Show admin dashboard: Event counts + health badge"
echo "  • Show OutboxMessage: KAFKA domain + RABBIT booking.paid + INTERNAL handlers"
echo "  • Show DomainEvent log per booking"
echo "  • Full flow: Stripe test card → booking.paid → Rabbit ticketing → ticket.issued"
exit 0
