"""
URL configuration for PostHog example project
"""

from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    # Include the core app URLs for PostHog examples
    path('', include('core.urls')),
]
