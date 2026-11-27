# PostHog WordPress Example

A minimal WordPress plugin demonstrating PostHog integration for self-hosted WordPress sites: client-side autocapture plus one server-side capture call via the PHP SDK.

## Purpose

This example serves as:
- **Verification** that the context-mill wizard works for self-hosted WordPress projects
- **Reference implementation** of PostHog best practices for WordPress plugin code
- **Working example** you can drop into a real WordPress install and modify

## Why a plugin, not `functions.php`

Editing a theme `functions.php` file couples analytics to the active theme (lost on theme switch or theme update) and offers no clean home for Composer dependencies. This example ships a standalone plugin in `wp-content/plugins/` instead, matching real integrations on self-hosted WordPress hosts.

## Features Demonstrated

- **Client-side autocapture**: Injects the `posthog-js` snippet on `wp_head` with `esc_js()` escaping, `tracing_headers`, optional reverse proxy `ui_host`, and `posthog.identify` for signed-in WordPress users
- **One server-side event**: Captures a real WordPress action (`comment_post`) with `PostHog::capture(...)` and flushes inside `try / catch`
- **Safe guest attribution**: Attributes logged-in commenters by numeric `user_id` and guest commenters via `X-POSTHOG-DISTINCT-ID` or `wp_generate_uuid4()` with `$process_person_profile: false` (never shared `'0'`, `'anonymous'`, or hashed email)
- **Error tracking**: Enables error tracking in `PostHog::init(...)` with bounded `timeout => 2000`

## Quick Start

```bash
cd posthog-example
composer install
```

Configure your PostHog project token in the site `wp-config.php` file (the same file that holds `DB_PASSWORD`):

```php
define('POSTHOG_PROJECT_TOKEN', getenv('POSTHOG_PROJECT_TOKEN') ?: '');
define('POSTHOG_HOST', 'https://us.i.posthog.com'); // optional, defaults to US Cloud
```

Set `POSTHOG_PROJECT_TOKEN` in your server environment (or paste your real project token from PostHog project settings), drop `posthog-example/` into `wp-content/plugins/`, and activate the plugin.

## What Gets Tracked

| Event | Trigger | Properties |
|-------|---------|------------|
| `$pageview` (autocapture) | Any page load | Standard PostHog JS autocapture |
| `comment_posted` | `comment_post` action | `comment_id`, `post_id`, `comment_approved` (plus `$process_person_profile: false` for guests) |
| `$exception` | Handled or unhandled PHP errors | Exception details from the PHP SDK |

## Code Structure

```
example-apps/wordpress/
├── README.md                       # This file
└── posthog-example/                # Copy this plugin folder into wp-content/plugins/
    ├── posthog-example.php         # Plugin entry: init, client snippet, server capture
    ├── composer.json               # Pulls in posthog/posthog-php
    └── .gitignore                  # Ignores vendor/, composer.lock
```

## Key Implementation Patterns

### 1. Guard the entry file

```php
if (!defined('ABSPATH')) {
    exit;
}
```

Every plugin entry file must refuse to run outside WordPress.

### 2. Initialize once on `plugins_loaded`

```php
$token = posthog_example_token();
if ($token !== '') {
    PostHog::init($token, [
        'host' => posthog_example_host(),
        'timeout' => 2000,
        'error_tracking' => ['enabled' => true],
    ]);
}
add_action('plugins_loaded', 'posthog_example_init');
```

### 3. Config from `wp-config.php`, snippet on `wp_head`, token escaped

```php
$token = esc_js(posthog_example_token());
add_action('wp_head', 'posthog_example_client_snippet', 999);
```

The token lives in `wp-config.php` or a WordPress option, never hardcoded in plugin source. Escape interpolated values with `esc_js()`. When `is_user_logged_in()` is true, the snippet calls `posthog.identify` with `(string) $current_user->ID` and passes `email` as a person property.

### 4. Server-side capture on a real WordPress action

```php
$user_id = (int) ($comment_data['user_id'] ?? 0);
if ($user_id > 0) {
    $distinct_id = (string) $user_id;
    $anonymous = false;
} else {
    $header_distinct_id = isset($_SERVER['HTTP_X_POSTHOG_DISTINCT_ID'])
        ? trim((string) wp_unslash($_SERVER['HTTP_X_POSTHOG_DISTINCT_ID']))
        : '';
    $distinct_id = $header_distinct_id !== '' ? $header_distinct_id : wp_generate_uuid4();
    $anonymous = true;
}

$properties = [
    'comment_id' => $comment_id,
    'post_id' => $comment_data['comment_post_ID'] ?? null,
    'comment_approved' => $comment_approved,
];
if ($anonymous) {
    $properties['$process_person_profile'] = false;
}

try {
    PostHog::capture([
        'distinctId' => $distinct_id,
        'event' => 'comment_posted',
        'properties' => $properties,
    ]);
    PostHog::flush();
} catch (\Throwable $e) {
    // Analytics errors must never fail WordPress comment creation.
}
```

Use the client SDK for pageviews and reserve `PostHog::capture` for actions that only run server-side (`comment_post`, `woocommerce_thankyou`, `user_register`). Wrap `PostHog::capture` and `PostHog::flush()` in `try / catch` because a web request has no single exit point like a CLI script and analytics outages must not break site actions.

### 5. Explicit error capture and `WP_Fatal_Error_Handler`

WordPress catches fatal errors with its own `WP_Fatal_Error_Handler` and renders the recovery-mode screen, which can swallow a fatal before a generic PHP handler reports it. Wrap risky plugin operations in `try / catch` and report exceptions explicitly with `PostHog::captureException($e)` followed by `PostHog::flush()`, and do not rely on `WP_DEBUG` being enabled in production to surface errors:

```php
try {
    run_risky_plugin_operation();
} catch (\Throwable $e) {
    try {
        PostHog::captureException($e);
        PostHog::flush();
    } catch (\Throwable $ignored) {
    }
    throw $e;
}
```

## Reverse proxy and full-page caching

Ad blockers often drop browser requests sent to PostHog domains. Point `POSTHOG_HOST` at a [managed reverse proxy](https://posthog.com/docs/advanced/proxy/managed-reverse-proxy.md) or CDN proxy ([Cloudflare](https://posthog.com/docs/advanced/proxy/cloudflare.md), [nginx](https://posthog.com/docs/advanced/proxy/nginx.md)). When `POSTHOG_HOST` points at a custom proxy domain, the snippet sets `ui_host` (`POSTHOG_UI_HOST`, defaulting to `https://us.posthog.com`) so the PostHog toolbar and session replay player keep working.

If your WordPress site sits behind full-page caching (Varnish, Batcache, WP Super Cache), evaluate feature flags client-side with `posthog-js` because server-side flag checks would be baked into cached HTML served to every visitor.

## Running Without PostHog

When `POSTHOG_PROJECT_TOKEN` is undefined or blank, the plugin skips `PostHog::init`, logs a warning via `error_log` outside production, logs a `console.error` in the browser in `development`, and leaves WordPress behavior untouched.

## Next Steps

- Track another WordPress action such as `user_register` or `woocommerce_thankyou`
- Move the token to a WordPress option with a settings screen if you want `wp-admin` configuration
- Evaluate feature flags client-side on cached pages

## Learn More

- [PostHog WordPress docs](https://posthog.com/docs/libraries/wordpress)
- [PostHog PHP SDK docs](https://posthog.com/docs/libraries/php)
- [PostHog PHP error tracking](https://posthog.com/docs/error-tracking/installation/php)
