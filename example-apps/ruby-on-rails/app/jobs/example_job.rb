# Example ActiveJob demonstrating posthog-rails auto-instrumentation.
#
# When auto_instrument_active_job is enabled in the PostHog config,
# posthog-rails automatically captures exceptions from failed jobs.
# The job class name, queue, and arguments are included as properties
# on the error event.
#
# Use the posthog_distinct_id DSL to associate job errors with a user.
# The proc receives the same arguments as perform and should return
# the distinct_id string. Without this, job errors have no user context.
class ExampleJob < ApplicationJob
  queue_as :default

  # Extract distinct_id from the first argument so posthog-rails
  # can associate the error with the user who triggered the job.
  posthog_distinct_id ->(distinct_id, *) { distinct_id }

  def perform(distinct_id, should_fail: false)
    if should_fail
      raise StandardError, 'Example job failure - this error is automatically captured by posthog-rails'
    end

    Rails.logger.info "ExampleJob completed successfully for #{distinct_id}"
  end
end
