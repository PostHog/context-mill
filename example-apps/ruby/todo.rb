#!/usr/bin/env ruby
# frozen_string_literal: true

# Simple CLI Todo App with PostHog Analytics
#
# A minimal plain Ruby CLI application demonstrating PostHog integration
# for non-framework Ruby projects (CLIs, scripts, data pipelines, etc.).

require 'json'
require 'securerandom'
require 'time'
require 'dotenv/load'
require 'posthog'

# Data file location
DATA_FILE = File.join(Dir.home, '.todo_app.json')

def initialize_posthog
  # In Ruby an empty string is truthy, so check both nil? and empty? and return nil
  # rather than passing a blank or placeholder key to PostHog::Client.new.
  project_token = ENV['POSTHOG_PROJECT_TOKEN']&.strip

  if project_token.nil? || project_token.empty?
    env = ENV.fetch('RUBY_ENV', ENV.fetch('RAILS_ENV', 'development'))
    unless env == 'production'
      $stderr.puts 'POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once POSTHOG_PROJECT_TOKEN is configured'
    end
    return nil
  end

  host = ENV['POSTHOG_HOST']&.strip
  host = 'https://us.i.posthog.com' if host.nil? || host.empty?

  PostHog::Client.new(
    api_key: project_token,
    host: host,
    on_error: proc { |status, msg| $stderr.puts "PostHog error: #{status} - #{msg}" }
  )
end

def get_user_id
  data = { 'todos' => [] }
  if File.exist?(DATA_FILE)
    data = JSON.parse(File.read(DATA_FILE))
    existing_id = data['user_id']&.to_s&.strip
    return existing_id unless existing_id.nil? || existing_id.empty?
  end

  # Persist the generated UUID immediately on first creation so read-only commands
  # and error handlers reuse one stable distinct_id instead of splitting across calls.
  user_id = SecureRandom.uuid
  data['user_id'] = user_id
  data['todos'] ||= []
  save_todos(data)
  user_id
end

def load_todos
  user_id = get_user_id
  data = JSON.parse(File.read(DATA_FILE))
  data['user_id'] = user_id
  data['todos'] ||= []
  data
end

def save_todos(data)
  File.write(DATA_FILE, JSON.pretty_generate(data))
end

def track_event(posthog, event_name, properties = {})
  return unless posthog

  posthog.capture(
    distinct_id: get_user_id,
    event: event_name,
    properties: properties
  )
end

def cmd_add(text, posthog)
  data = load_todos

  todo = {
    'id' => data['todos'].length + 1,
    'text' => text,
    'completed' => false,
    'created_at' => Time.now.iso8601
  }

  data['todos'] << todo
  save_todos(data)

  puts "Added todo ##{todo['id']}: #{todo['text']}"

  track_event(posthog, 'todo_added', {
    'todo_id' => todo['id'],
    'todo_length' => todo['text'].length,
    'total_todos' => data['todos'].length
  })
end

def cmd_list(posthog)
  data = load_todos

  if data['todos'].empty?
    puts "No todos yet! Add one with: ruby todo.rb add 'Your task'"
    return
  end

  puts "\nYour Todos (#{data['todos'].length} total):\n\n"

  data['todos'].each do |todo|
    status = todo['completed'] ? 'X' : ' '
    puts "  [#{status}] ##{todo['id']}: #{todo['text']}"
  end

  puts

  track_event(posthog, 'todos_viewed', {
    'total_todos' => data['todos'].length,
    'completed_todos' => data['todos'].count { |t| t['completed'] }
  })
end

def cmd_complete(id, posthog)
  data = load_todos

  todo = data['todos'].find { |t| t['id'] == id }

  unless todo
    puts "ERROR: Todo ##{id} not found"
    return
  end

  if todo['completed']
    puts "Todo ##{id} is already completed"
    return
  end

  todo['completed'] = true
  todo['completed_at'] = Time.now.iso8601
  save_todos(data)

  puts "Completed todo ##{todo['id']}: #{todo['text']}"

  time_to_complete = (Time.parse(todo['completed_at']) - Time.parse(todo['created_at'])) / 3600.0

  track_event(posthog, 'todo_completed', {
    'todo_id' => todo['id'],
    'time_to_complete_hours' => time_to_complete
  })
end

def cmd_delete(id, posthog)
  data = load_todos

  todo = data['todos'].find { |t| t['id'] == id }

  unless todo
    puts "ERROR: Todo ##{id} not found"
    return
  end

  data['todos'].delete(todo)
  save_todos(data)

  puts "Deleted todo ##{id}"

  track_event(posthog, 'todo_deleted', {
    'todo_id' => todo['id'],
    'was_completed' => todo['completed']
  })
end

def cmd_stats(posthog)
  data = load_todos

  total = data['todos'].length
  completed = data['todos'].count { |t| t['completed'] }
  pending = total - completed

  puts "\nStats:\n\n"
  puts "  Total todos:     #{total}"
  puts "  Completed:       #{completed}"
  puts "  Pending:         #{pending}"
  puts "  Completion rate: #{total > 0 ? format('%.1f', completed.to_f / total * 100) : '0.0'}%"
  puts

  track_event(posthog, 'stats_viewed', {
    'total_todos' => total,
    'completed_todos' => completed,
    'pending_todos' => pending
  })
end

def print_usage
  puts <<~USAGE
    Simple todo app with PostHog analytics

    Usage:
      ruby todo.rb add "Todo text"    Add a new todo
      ruby todo.rb list               List all todos
      ruby todo.rb complete <id>      Mark todo as completed
      ruby todo.rb delete <id>        Delete a todo
      ruby todo.rb stats              Show statistics
  USAGE
end

# Main entry point
command = ARGV[0]
unless command
  print_usage
  exit 0
end

posthog = nil

begin
  posthog = initialize_posthog

  case command
  when 'add'
    text = ARGV[1]
    unless text
      puts 'ERROR: Please provide todo text'
      puts 'Usage: ruby todo.rb add "Your task"'
      exit 1
    end
    cmd_add(text, posthog)
  when 'list'
    cmd_list(posthog)
  when 'complete'
    id = ARGV[1]&.to_i
    unless id && id > 0
      puts 'ERROR: Please provide a valid todo ID'
      puts 'Usage: ruby todo.rb complete <id>'
      exit 1
    end
    cmd_complete(id, posthog)
  when 'delete'
    id = ARGV[1]&.to_i
    unless id && id > 0
      puts 'ERROR: Please provide a valid todo ID'
      puts 'Usage: ruby todo.rb delete <id>'
      exit 1
    end
    cmd_delete(id, posthog)
  when 'stats'
    cmd_stats(posthog)
  else
    puts "ERROR: Unknown command '#{command}'"
    print_usage
    exit 1
  end
rescue StandardError => e
  $stderr.puts "ERROR: #{e.message}"

  posthog&.capture_exception(e, get_user_id)

  exit 1
ensure
  # Flush queued events before exit without failing if PostHog is unreachable.
  begin
    posthog&.shutdown
  rescue StandardError
    nil
  end
end
