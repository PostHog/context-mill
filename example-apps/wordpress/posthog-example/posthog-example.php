<?php
/**
 * Plugin Name: PostHog Example
 * Description: Minimal WordPress plugin demonstrating client-side autocapture plus one server-side PostHog PHP SDK capture.
 * Version: 0.1.0
 * License: MIT
 */

declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

require __DIR__ . '/vendor/autoload.php';

use PostHog\PostHog;

/**
 * Configuration comes from wp-config.php constants, the same file that
 * already holds DB_PASSWORD and the auth salts.
 *
 * A distributable plugin would offer a settings screen backed by
 * get_option() instead.
 */
function posthog_example_token(): string
{
    // Return an empty string when POSTHOG_PROJECT_TOKEN is undefined or blank rather than
    // defaulting to a placeholder token, so unconfigured sites stay uninitialized cleanly.
    return defined('POSTHOG_PROJECT_TOKEN') ? trim((string) POSTHOG_PROJECT_TOKEN) : '';
}

function posthog_example_host(): string
{
    $host = defined('POSTHOG_HOST') ? trim((string) POSTHOG_HOST) : '';
    return $host !== '' ? $host : 'https://us.i.posthog.com';
}

function posthog_example_is_custom_proxy(string $host): bool
{
    $parsedHost = strtolower((string) parse_url($host, PHP_URL_HOST));
    return $parsedHost !== '' && !str_ends_with($parsedHost, '.posthog.com') && $parsedHost !== 'posthog.com';
}

function posthog_example_ui_host(): string
{
    if (defined('POSTHOG_UI_HOST')) {
        $uiHost = trim((string) POSTHOG_UI_HOST);
        if ($uiHost !== '') {
            return $uiHost;
        }
    }

    return 'https://us.posthog.com';
}

function posthog_example_init(): void
{
    // Guard PostHog::init behind a non-empty token so missing configuration never breaks WordPress.
    $token = posthog_example_token();
    if ($token === '') {
        if (wp_get_environment_type() !== 'production') {
            error_log('POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once POSTHOG_PROJECT_TOKEN is configured');
        }
        return;
    }

    PostHog::init($token, [
        'host' => posthog_example_host(),
        'timeout' => 2000,
        'error_tracking' => [
            'enabled' => true,
        ],
    ]);
}
add_action('plugins_loaded', 'posthog_example_init');

/**
 * Client-side autocapture injected on wp_head at priority 999, sourced from
 * wp-config.php constants and escaped with esc_js() instead of hardcoded.
 */
function posthog_example_client_snippet(): void
{
    $raw_token = posthog_example_token();
    if ($raw_token === '') {
        if (wp_get_environment_type() === 'development') {
            echo '<script>console.error("POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once POSTHOG_PROJECT_TOKEN is configured");</script>' . "\n";
        }
        return;
    }

    $raw_host = posthog_example_host();
    $token = esc_js($raw_token);
    $host = esc_js($raw_host);
    $use_ui_host = posthog_example_is_custom_proxy($raw_host);
    $ui_host = $use_ui_host ? esc_js(posthog_example_ui_host()) : '';
    ?>
    <script>
      // POSTHOG_BROWSER_SNIPPET_START
      !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],Object.defineProperty(u,"toString",{configurable:!0,enumerable:!0,writable:!0,value:function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e}}),Object.defineProperty(u.people,"toString",{configurable:!0,enumerable:!0,writable:!0,value:function(){return u.toString(1)+".people (stub)"}}),o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagResult isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
      // POSTHOG_BROWSER_SNIPPET_END
      posthog.init('<?php echo $token; ?>', {
        api_host: '<?php echo $host; ?>',
        <?php if ($use_ui_host) : ?>
        ui_host: '<?php echo $ui_host; ?>',
        <?php endif; ?>
        defaults: '2026-08-30',
        person_profiles: 'identified_only',
        tracing_headers: [window.location.hostname]
      });
      <?php
      // Identify signed-in WordPress users by stable numeric user ID, keeping email in person properties.
      if (is_user_logged_in()) :
          $current_user = wp_get_current_user();
          if ($current_user && $current_user->ID > 0) :
              ?>
      posthog.identify('<?php echo esc_js((string) $current_user->ID); ?>', {
        email: '<?php echo esc_js((string) $current_user->user_email); ?>'
      });
              <?php
          endif;
      endif;
      ?>
    </script>
    <?php
}
add_action('wp_head', 'posthog_example_client_snippet', 999);

/**
 * Capture a real server-side WordPress action (a new comment) with PostHog::capture(...)
 * and flush immediately because a PHP-FPM or mod_php request has no single exit point.
 */
function posthog_example_track_comment(int $comment_id, $comment_approved, array $comment_data): void
{
    if (posthog_example_token() === '') {
        return;
    }

    // WordPress sets user_id to 0 for logged-out commenters, so never fall back with ?? on user_id,
    // never share a literal ID like '0' or 'anonymous', and never hash comment_author_email.
    // Signed-in users get their numeric ID, while guest comments use X-POSTHOG-DISTINCT-ID or a
    // fresh UUID with $process_person_profile set to false.
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
}
add_action('comment_post', 'posthog_example_track_comment', 10, 3);
