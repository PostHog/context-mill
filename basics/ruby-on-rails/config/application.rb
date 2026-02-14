require_relative 'boot'
require 'rails/all'

Bundler.require(*Rails.groups)

module PosthogExample
  class Application < Rails::Application
    config.load_defaults 7.1

    # Use SQLite for all stores
    config.active_job.queue_adapter = :async
  end
end
