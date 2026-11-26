# PostHog configuration. The posthog-rails gem wires the integration into Rails
# (middleware, Rails.error subscriber, ActiveJob hooks, shutdown). This file
# chooses which features are active and creates the single client when configured.
# See the "What the integration sets up for you" section of the README.

PostHog::Rails.configure do |config|
  # Capture unhandled controller exceptions and Rails.error reports
  config.auto_capture_exceptions = true

  # Also capture exceptions Rails rescues and renders as error pages
  config.report_rescued_exceptions = true

  # Capture ActiveJob failures and carry the request identity into jobs
  config.auto_instrument_active_job = true

  # Attach the signed-in user to captured exceptions. These are the defaults,
  # shown so the contract with the User model is visible.
  config.capture_user_context = true
  config.current_user_method = :current_user
  config.user_id_method = :posthog_distinct_id
end

# Leave the SDK uninitialized when POSTHOG_PROJECT_TOKEN is missing or blank instead of passing
# an empty or placeholder key, so unconfigured apps stay a safe no-op.
token = ENV['POSTHOG_PROJECT_TOKEN']&.strip

if token.nil? || token.empty?
  unless Rails.env.production? || Rails.env.test?
    Rails.logger.warn('POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once POSTHOG_PROJECT_TOKEN is configured')
  end
else
  PostHog.init do |config|
    config.api_key = token
    config.host = ENV['POSTHOG_HOST'].presence || 'https://us.i.posthog.com'
    config.test_mode = true if Rails.env.test?
    config.on_error = proc { |status, msg| Rails.logger.error("PostHog error (#{status}): #{msg}") }
  end
end
