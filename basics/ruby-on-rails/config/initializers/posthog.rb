# PostHog configuration with posthog-rails auto-instrumentation
#
# The posthog-rails gem provides:
# - Automatic exception capture for unhandled controller errors
# - ActiveJob instrumentation for background job failures
# - User context detection from current_user
# - Rails.error integration for rescued exceptions 
PostHog.init do |config|
  config.api_key = ENV.fetch('POSTHOG_API_KEY', nil)
  config.host = ENV.fetch('POSTHOG_HOST', 'https://us.i.posthog.com')
end

PostHog::Rails.configure do |config|
  # Auto-capture unhandled exceptions in controllers
  config.auto_capture_exceptions = true

  # Also capture exceptions that Rails rescues (e.g. ActiveRecord::RecordNotFound)
  config.report_rescued_exceptions = true

  # Auto-instrument ActiveJob failures
  config.auto_instrument_active_job = true

  # Automatically associate errors with the current user
  config.capture_user_context = true
  config.current_user_method = :current_user
  config.user_id_method = :posthog_distinct_id
end

