class RegistrationsController < ApplicationController
  def new
    redirect_to dashboard_path if current_user
  end

  def create
    user = User.new(
      email: params[:email],
      password: params[:password],
      password_confirmation: params[:password_confirmation]
    )

    if user.save
      session[:user_id] = user.id

      # PostHog: Identify the new user and capture signup event
      PostHog.identify(
        distinct_id: user.posthog_distinct_id,
        properties: user.posthog_properties
      )

      PostHog.capture(
        distinct_id: user.posthog_distinct_id,
        event: 'user_signed_up',
        properties: { signup_method: 'form' }
      )

      redirect_to dashboard_path
    else
      flash[:error] = user.errors.full_messages.join(', ')
      render :new, status: :unprocessable_entity
    end
  end
end
