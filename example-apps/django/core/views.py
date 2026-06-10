"""Django views demonstrating PostHog integration patterns"""

import posthog
from posthog import new_context, identify_context, tag, capture
from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.http import JsonResponse
from django.views.decorators.http import require_POST


def home_view(request):
    """Home page with login functionality"""
    if request.user.is_authenticated:
        return redirect('dashboard')

    if request.method == 'POST':
        username = request.POST.get('username')
        password = request.POST.get('password')

        user = authenticate(request, username=username, password=password)

        if user is not None:
            login(request, user)

            # PostHog: Identify user and capture login event
            with new_context():
                identify_context(str(user.id))

                # Set person properties (PII goes in tag, not capture)
                tag('email', user.email)
                tag('username', user.username)
                tag('name', user.get_full_name() or user.username)
                tag('is_staff', user.is_staff)
                tag('date_joined', user.date_joined.isoformat())

                capture('user_logged_in', properties={
                    'login_method': 'email',
                })

            return redirect('dashboard')
        else:
            messages.error(request, 'Invalid username or password')

    return render(request, 'core/home.html')


def logout_view(request):
    """Logout the current user"""
    if request.user.is_authenticated:
        user_id = str(request.user.id)

        # PostHog: Track logout before session ends
        with new_context():
            identify_context(user_id)
            capture('user_logged_out')

        logout(request)

    return redirect('home')


@login_required
def dashboard_view(request):
    """Dashboard page with feature flag example"""
    user_id = str(request.user.id)

    # PostHog: Track dashboard view
    with new_context():
        identify_context(user_id)
        capture('dashboard_viewed', properties={
            'is_staff': request.user.is_staff,
        })

    # PostHog: Check feature flag
    show_new_feature = posthog.feature_enabled(
        'new-dashboard-feature',
        distinct_id=user_id,
        person_properties={
            'email': request.user.email,
            'is_staff': request.user.is_staff,
        }
    )

    # PostHog: Get feature flag payload
    feature_config = posthog.get_feature_flag_payload(
        'new-dashboard-feature',
        distinct_id=user_id,
    )

    context = {
        'show_new_feature': show_new_feature,
        'feature_config': feature_config,
    }

    return render(request, 'core/dashboard.html', context)


@login_required
def burrito_view(request):
    """Example page demonstrating event tracking"""
    count = request.session.get('burrito_count', 0)

    context = {
        'burrito_count': count,
    }

    return render(request, 'core/burrito.html', context)


@login_required
@require_POST
def consider_burrito_view(request):
    """API endpoint for tracking burrito considerations"""
    count = request.session.get('burrito_count', 0) + 1
    request.session['burrito_count'] = count

    user_id = str(request.user.id)

    # PostHog: Track custom event
    with new_context():
        identify_context(user_id)
        capture('burrito_considered', properties={
            'total_considerations': count,
        })

    return JsonResponse({
        'success': True,
        'count': count,
    })


@login_required
def profile_view(request):
    """Profile page with error tracking demonstration"""
    user_id = str(request.user.id)

    # PostHog: Track profile view
    with new_context():
        identify_context(user_id)
        capture('profile_viewed')

    context = {
        'user': request.user,
    }

    return render(request, 'core/profile.html', context)


@login_required
@require_POST
def trigger_error_view(request):
    """API endpoint that demonstrates error tracking"""
    try:
        error_type = request.POST.get('error_type', 'generic')

        if error_type == 'value':
            raise ValueError("Invalid value provided by user")
        elif error_type == 'key':
            data = {}
            _ = data['nonexistent_key']
        else:
            raise Exception("Something went wrong!")

    except Exception as e:
        # PostHog: Capture exception
        posthog.capture_exception(e)

        # PostHog: Track error trigger event
        with new_context():
            identify_context(str(request.user.id))
            capture('error_triggered', properties={
                'error_type': error_type,
                'error_message': str(e),
            })

        return JsonResponse({
            'success': False,
            'error': str(e),
            'message': 'Error has been captured by PostHog',
        }, status=400)

    return JsonResponse({'success': True})


@login_required
def group_analytics_view(request):
    """Example demonstrating group analytics"""
    user_id = str(request.user.id)

    # PostHog: Identify group
    posthog.group_identify(
        group_type='company',
        group_key='acme-corp',
        properties={
            'name': 'Acme Corporation',
            'plan': 'enterprise',
            'employee_count': 150,
        }
    )

    # PostHog: Capture event with group
    with new_context():
        identify_context(user_id)
        capture(
            'feature_used',
            properties={
                'feature_name': 'group_analytics',
            },
            groups={
                'company': 'acme-corp',
            }
        )

    return JsonResponse({
        'success': True,
        'message': 'Group analytics event captured',
    })
