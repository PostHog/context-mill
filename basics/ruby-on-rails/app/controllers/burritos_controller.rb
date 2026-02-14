class BurritosController < ApplicationController
  before_action :require_login

  def show
    @burrito_count = session[:burrito_count] || 0
  end

  def consider
    count = (session[:burrito_count] || 0) + 1
    session[:burrito_count] = count

    user = current_user

    # PostHog: Track custom event
    PostHog.identify(
      distinct_id: user.posthog_distinct_id,
      properties: user.posthog_properties
    )

    PostHog.capture(
      distinct_id: user.posthog_distinct_id,
      event: 'burrito_considered',
      properties: { total_considerations: count }
    )

    render json: { success: true, count: count }
  end
end
