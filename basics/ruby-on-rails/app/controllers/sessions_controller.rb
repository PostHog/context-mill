class SessionsController < ApplicationController
  def new
    redirect_to dashboard_path if current_user
  end

  def create
    user = User.find_by(email: params[:email])

    if user&.authenticate(params[:password])
      session[:user_id] = user.id

      # PostHog: Identify the user and capture login event
      PostHog.identify(
        distinct_id: user.posthog_distinct_id,
        properties: user.posthog_properties
      )

      PostHog.capture(
        distinct_id: user.posthog_distinct_id,
        event: 'user_logged_in',
        properties: { login_method: 'email' }
      )

      redirect_to dashboard_path
    else
      flash[:error] = 'Invalid email or password'
      render :new, status: :unprocessable_entity
    end
  end

  def destroy
    if current_user
      # PostHog: Track logout before session ends
      PostHog.capture(
        distinct_id: current_user.posthog_distinct_id,
        event: 'user_logged_out'
      )
    end

    session.delete(:user_id)
    redirect_to login_path
  end
end
