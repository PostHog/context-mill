# PostHog WordPress Example

A minimal WordPress plugin demonstrating PostHog integration for self-hosted WordPress sites: client-side autocapture plus one server-side capture call via the PHP SDK.

## Purpose

This example serves as:
- **Verification** that the context-mill wizard works for self-hosted WordPress projects
- **Reference implementation** of PostHog best practices for WordPress plugin code
- **Working example** you can drop into a real WordPress install and modify

## Why a plugin, not `functions.php`

The existing PostHog WordPress docs teach editing a theme's `functions.php` for the client snippet, which is theme-coupled and has no path to server-side capture. This example uses a small standalone plugin instead — the same approach a real integration on self-hosted WordPress (VIP, WP Engine, Pantheon, or any host with file access) would take.

## Features Demonstrated

- **Client-side autocapture** — the same `wp_head` JS-snippet pattern as the PostHog WordPress docs, sourced from a `wp-config.php` constant instead of hardcoded
- **One server-side event** — captures a real WordPress action (`comment_post`) with `PostHog::capture(...)`, then flushes immediately since a PHP-FPM/mod_php request has no single explicit exit point
- **Error tracking** — enabled in `PostHog::init(...)` so unhandled PHP errors reach PostHog

## Quick Start

```bash
cd posthog-example
composer install
```

Add your PostHog project token to the site's `wp-config.php` — the same file that holds `DB_PASSWORD`:

```php
define('POSTHOG_PROJECT_TOKEN', 'phc_your_project_token_here');
define('POSTHOG_HOST', 'https://us.i.posthog.com'); // optional, this is the default
```

Then drop `posthog-example/` into the install's `wp-content/plugins/` directory and activate it.

## What Gets Tracked

| Event | Trigger | Properties |
|-------|---------|------------|
| `$pageview` (autocapture) | Any page load | Standard PostHog JS autocapture |
| `comment_posted` | `comment_post` action | `comment_id`, `post_id`, `comment_approved` |
| `$exception` | Unhandled PHP errors | Exception details from the PHP SDK |

## Code Structure

```
example-apps/wordpress/
├── README.md                       # This file
└── posthog-example/                # The plugin — copy this into wp-content/plugins/
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

Every plugin file must refuse to run outside WordPress.

### 2. Initialize once, on `plugins_loaded`

```php
PostHog::init($token, [
    'host' => $host,
    'error_tracking' => ['enabled' => true],
]);
add_action('plugins_loaded', 'posthog_example_init');
```

### 3. Config from `wp-config.php`, snippet on `wp_head`, token escaped

```php
$token = esc_js(posthog_example_token()); // reads the POSTHOG_PROJECT_TOKEN constant
add_action('wp_head', 'posthog_example_client_snippet', 999);
```

The token lives in `wp-config.php`, never in plugin source. Never echo a raw token into markup. Priority 999 keeps the snippet late in `<head>`.

### 4. Server-side capture on a real WordPress action

```php
PostHog::capture([
    'distinctId' => (string) $distinct_id,
    'event' => 'comment_posted',
    'properties' => ['comment_id' => $comment_id],
]);
```

Use the client SDK for pageviews. Reserve the PHP SDK for actions that only exist server-side (`comment_post`, `woocommerce_thankyou`, `user_register`).

### 5. Flush after capture

```php
PostHog::flush();
```

A web request has no single exit point like a CLI script does, so flush where you capture.

## Reverse proxy

Ad blockers often drop browser requests sent to PostHog's own domain, so the client-side snippet loses events. Point `POSTHOG_HOST` at a reverse proxy to keep them. The quickest option is PostHog's [managed reverse proxy](https://posthog.com/docs/advanced/proxy/managed-reverse-proxy.md). You can also proxy through your host or CDN, such as [Cloudflare](https://posthog.com/docs/advanced/proxy/cloudflare.md) or [nginx](https://posthog.com/docs/advanced/proxy/nginx.md). Server-side calls from PHP aren't affected by ad blockers and don't need the proxy.

## Running Without PostHog

The plugin works fine without PostHog configured. If the `POSTHOG_PROJECT_TOKEN` constant is undefined — or still holds the `phc_your_...` placeholder — the plugin skips initialization, prints no snippet, and captures nothing. WordPress is unaffected.

## Next Steps

- Track another WordPress action: `user_register`, `publish_post`, or `woocommerce_thankyou`
- Identify logged-in users with `PostHog::identify(...)` instead of the hashed anonymous id
- Move the token to a WordPress option with a settings screen if the plugin should be configurable from wp-admin
- Add feature flags — evaluate them client-side if the site sits behind full-page caching

## Learn More

- [PostHog WordPress docs](https://posthog.com/docs/libraries/wordpress)
- [PostHog PHP SDK docs](https://posthog.com/docs/libraries/php)
- [PostHog PHP error tracking](https://posthog.com/docs/error-tracking/installation/php)
