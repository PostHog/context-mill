# PostHog configuration. The posthog-rails gem wires the integration into Rails
# (middleware, Rails.error subscriber, ActiveJob hooks, shutdown); this file only
# chooses which of those are on and creates the single client.
# See the "What the integration sets up for you" section of the README.

PostHog::Rails.configure do |config|
  # Capture unhandled controller exceptions and Rails.error reports
  config.auto_capture_exceptions = true

  # Also capture exceptions Rails rescues and renders as error pages
  config.report_rescued_exceptions = true

  # Capture ActiveJob failures and carry the request's identity into jobs
  config.auto_instrument_active_job = true

  # Attach the signed-in user to captured exceptions. These are the defaults,
  # shown so the contract with the User model is visible.
  config.capture_user_context = true
  config.current_user_method = :current_user
  config.user_id_method = :posthog_distinct_id
end

project_token = ENV['POSTHOG_PROJECT_TOKEN'].to_s.strip

if project_token.empty?
  # Without PostHog.init the client stays disabled and every PostHog call is a no-op.
  if Rails.env.development?
    Rails.logger.warn('POSTHOG_PROJECT_TOKEN is not set; PostHog is disabled. Copy .env.example to .env and set it.')
  end
else
  PostHog.init do |config|
    config.api_key = project_token
    config.host = ENV.fetch('POSTHOG_HOST', 'https://us.i.posthog.com')
    config.test_mode = true if Rails.env.test?
    config.on_error = proc { |status, msg| Rails.logger.error("PostHog error (#{status}): #{msg}") }
  end
end
