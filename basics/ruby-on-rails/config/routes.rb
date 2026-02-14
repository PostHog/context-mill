Rails.application.routes.draw do
  # Auth
  get 'login', to: 'sessions#new'
  post 'login', to: 'sessions#create'
  delete 'logout', to: 'sessions#destroy'

  get 'signup', to: 'registrations#new'
  post 'signup', to: 'registrations#create'

  # App
  get 'dashboard', to: 'dashboard#show'
  get 'burrito', to: 'burritos#show'
  post 'api/burrito/consider', to: 'burritos#consider'
  get 'profile', to: 'profiles#show'

  # Error tracking demos
  post 'api/test-error', to: 'errors#test'
  post 'api/test-rails-error', to: 'errors#test_rails_error'

  # Background job demo
  post 'api/test-job', to: 'dashboard#enqueue_test_job'

  root 'sessions#new'
end
