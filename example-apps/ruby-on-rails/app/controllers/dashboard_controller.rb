class DashboardController < ApplicationController
  before_action :require_login

  def show
    user = current_user

    # PostHog: Track dashboard view
    PostHog.capture(
      distinct_id: user.posthog_distinct_id,
      event: 'dashboard_viewed',
      properties: { is_staff: user.is_staff }
    )

    # PostHog: Evaluate all flags once for this user, then read from the snapshot
    flags = PostHog.evaluate_flags(
      user.posthog_distinct_id,
      person_properties: user.posthog_properties
    )
    @show_new_feature = flags.enabled?('new-dashboard-feature')
    @feature_config = flags.get_flag_payload('new-dashboard-feature')
  end

  def enqueue_test_job
    # Enqueue a job that will fail — posthog-rails captures the error automatically.
    # The distinct_id is passed so the posthog_distinct_id DSL can associate the error with this user.
    ExampleJob.perform_later(current_user.posthog_distinct_id, should_fail: true)

    render json: {
      success: true,
      message: 'Job enqueued. The job will fail and posthog-rails will capture the error automatically.'
    }
  end
end
