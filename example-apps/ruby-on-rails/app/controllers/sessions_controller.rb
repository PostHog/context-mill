class SessionsController < ApplicationController
  def new
    redirect_to dashboard_path if current_user
  end

  def create
    email = params[:email].to_s.strip
    password = params[:password].to_s

    # Reject empty credentials before authentication and omit analytics calls when login fails.
    if email.empty? || password.empty?
      flash[:error] = 'Email and password are required'
      render :new, status: :unprocessable_entity
      return
    end

    user = User.find_by(email: email)

    if user&.authenticate(password)
      session[:user_id] = user.id

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
    # Only capture logout and trigger browser posthog.reset() when signing out an authenticated user.
    if current_user
      PostHog.capture(
        distinct_id: current_user.posthog_distinct_id,
        event: 'user_logged_out'
      )
      flash[:posthog_reset] = true
    end

    session.delete(:user_id)
    redirect_to login_path
  end
end
