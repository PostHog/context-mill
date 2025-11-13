curl -X POST https://us.posthog.com/api/environments/198052/endpoints/test/run \
  -H "Authorization: Bearer phx_ZlzpdDkd92DHfGH8n8rZ0xJFwySteo5viu9n4isVbjJItF8" \
  -H "Content-Type: application/json" \
  -d '{
    "variables_values": {
      "distinct_id": "posthog-pages-router-example-2025-11-11-test-user"
    }
  }'