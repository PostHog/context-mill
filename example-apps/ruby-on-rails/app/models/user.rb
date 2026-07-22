class User < ApplicationRecord
  has_secure_password

  validates :email, presence: true, uniqueness: true

  # Called by posthog-rails for automatic user association in error reports.
  # When auto_capture_exceptions and capture_user_context are enabled,
  # posthog-rails calls this method on current_user to get the distinct_id.
  # The primary key, not the email: an email can change, which would split one
  # person's history in two, and it is PII on every event's identity.
  def posthog_distinct_id
    id.to_s
  end

  # Helper used by controllers when calling PostHog.identify to set person properties.
  # These properties appear on the person profile in PostHog.
  def posthog_properties
    {
      email: email,
      is_staff: is_staff,
      date_joined: created_at&.iso8601
    }
  end
end
