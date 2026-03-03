class ProfilesController < ApplicationController
  before_action :require_login

  def show
    # PostHog: Track profile view
    PostHog.capture(
      distinct_id: current_user.posthog_distinct_id,
      event: 'profile_viewed'
    )
  end
end
