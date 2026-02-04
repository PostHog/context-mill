# HogQL queries for PostHog

This skill helps you write HogQL queries for PostHog analytics. HogQL is PostHog's SQL dialect, a wrapper around ClickHouse SQL with simplified property access and PostHog-specific functions.

## Reference files

{references}

Consult the documentation for SQL syntax, available functions, and query patterns.

## Key principles

- **Property access**: Use `properties.$property_name` for event properties and `person.properties.$property_name` for person properties
- **Null handling**: HogQL has simplified null handling compared to raw ClickHouse SQL
- **Filters placeholder**: Use `{filters}` in queries to allow UI-based filtering in PostHog dashboards
- **Aggregations**: Prefer ClickHouse aggregation functions like `count()`, `uniq()`, `avg()`, `sum()`

## Common patterns

### Event queries
```sql
SELECT event, count()
FROM events
WHERE {filters}
GROUP BY event
ORDER BY count() DESC
```

### Property breakdowns
```sql
SELECT properties.$browser AS browser, count()
FROM events
WHERE event = '$pageview' AND {filters}
GROUP BY browser
```

### Person properties
```sql
SELECT person.properties.email, count()
FROM events
WHERE {filters}
GROUP BY person.properties.email
```

## Framework guidelines

{commandments}
