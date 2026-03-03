# Create a default admin user for testing
User.find_or_create_by!(email: 'admin@example.com') do |user|
  user.password = 'admin'
  user.password_confirmation = 'admin'
  user.is_staff = true
end

puts 'Seed data created: admin@example.com / admin'
