class ErrorsController < ApplicationController
  before_action :require_login

  def test
    # Manual exception capture — catch the error and report it explicitly
    begin
      raise StandardError, 'Test exception from critical operation'
    rescue StandardError => e
      # PostHog: Manually capture the exception
      PostHog.capture_exception(e, current_user.posthog_distinct_id)

      PostHog.capture(
        distinct_id: current_user.posthog_distinct_id,
        event: 'error_triggered',
        properties: {
          error_type: e.class.name,
          error_message: e.message
        }
      )

      render json: {
        success: false,
        error: e.message,
        message: 'Error has been captured by PostHog'
      }, status: :internal_server_error
    end
  end

  def test_rails_error
    # Rails.error.handle — Rails 7+ error reporting integration.
    # posthog-rails subscribes to Rails.error, so exceptions reported
    # via Rails.error.handle are automatically captured in PostHog.
    Rails.error.handle(context: { user_id: current_user.id }) do
      raise StandardError, 'Test error via Rails.error.handle — captured automatically by posthog-rails'
    end

    render json: {
      success: true,
      message: 'Error was handled via Rails.error.handle and captured by posthog-rails'
    }
  end
end
