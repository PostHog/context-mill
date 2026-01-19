"""
URL configuration for the core app.

This module defines all the URL patterns for the PostHog example views.
"""

from django.urls import path
from . import views

urlpatterns = [
    # Home login page
    path('', views.home_view, name='home'),

    # Authentication
    path('logout/', views.logout_view, name='logout'),

    # Dashboard with feature flags
    path('dashboard/', views.dashboard_view, name='dashboard'),

    # Burrito example for event tracking
    path('burrito/', views.burrito_view, name='burrito'),
    path('api/burrito/consider/', views.consider_burrito_view, name='consider_burrito'),

    # Profile with error tracking
    path('profile/', views.profile_view, name='profile'),
    path('api/trigger-error/', views.trigger_error_view, name='trigger_error'),

    # Group analytics example
    path('api/group-analytics/', views.group_analytics_view, name='group_analytics'),
]
