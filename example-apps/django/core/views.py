"""Django views demonstrating PostHog integration patterns"""

from django.conf import settings
from django.contrib import messages
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.shortcuts import redirect, render
from django.views.decorators.http import require_POST


def home_view(request):
    """Home page with login functionality"""
    if request.user.is_authenticated:
        return redirect('dashboard')

    if request.method == 'POST':
        username = (request.POST.get('username') or '').strip()
        password = request.POST.get('password') or ''

        # Reject empty credentials before authentication and omit event capture when no user resolves.
        if not username or not password:
            messages.error(request, 'Username and password are required')
            return render(request, 'core/home.html')

        user = authenticate(request, username=username, password=password)

        if user is not None:
            login(request, user)

            # The user_logged_in signal (core/signals.py) already identified this request context,
            # so a plain capture on the configured client is attributed to user.pk without PII properties.
            client = settings.POSTHOG_MW_CLIENT
            if client:
                client.capture('user_logged_in', properties={
                    'login_method': 'username',
                })

            return redirect('dashboard')
        else:
            messages.error(request, 'Invalid username or password')

    return render(request, 'core/home.html')


def logout_view(request):
    """Logout the current user"""
    # Only capture logout when an authenticated session is active, and before logout() clears it.
    if request.user.is_authenticated:
        client = settings.POSTHOG_MW_CLIENT
        if client:
            client.capture('user_logged_out')

        logout(request)

    return redirect('home')


@login_required
def dashboard_view(request):
    """Dashboard page with feature flag example"""
    user_id = str(request.user.pk)
    client = settings.POSTHOG_MW_CLIENT

    # The middleware already identified this request context from the logged-in user.
    if client:
        client.capture('dashboard_viewed', properties={
            'is_staff': request.user.is_staff,
        })

        show_new_feature = client.feature_enabled(
            'new-dashboard-feature',
            distinct_id=user_id,
            person_properties={
                'email': request.user.email,
                'is_staff': request.user.is_staff,
            },
        )
        feature_config = client.get_feature_flag_payload(
            'new-dashboard-feature',
            distinct_id=user_id,
        )
    else:
        show_new_feature = False
        feature_config = None

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

    client = settings.POSTHOG_MW_CLIENT
    if client:
        client.capture('burrito_considered', properties={
            'total_considerations': count,
        })

    return JsonResponse({
        'success': True,
        'count': count,
    })


@login_required
def profile_view(request):
    """Profile page with error tracking demonstration"""
    client = settings.POSTHOG_MW_CLIENT
    if client:
        client.capture('profile_viewed')

    context = {
        'user': request.user,
    }

    return render(request, 'core/profile.html', context)


@login_required
@require_POST
def trigger_error_view(request):
    """API endpoint that demonstrates error tracking"""
    error_type = request.POST.get('error_type', 'generic')
    try:
        if error_type == 'value':
            raise ValueError("Invalid value provided by user")
        elif error_type == 'key':
            data = {}
            _ = data['nonexistent_key']
        else:
            raise Exception("Something went wrong!")

    except Exception as e:
        client = settings.POSTHOG_MW_CLIENT
        if client:
            client.capture_exception(e)
            client.capture('error_triggered', properties={
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
    client = settings.POSTHOG_MW_CLIENT
    if client:
        client.group_identify(
            group_type='company',
            group_key='acme-corp',
            properties={
                'name': 'Acme Corporation',
                'plan': 'enterprise',
                'employee_count': 150,
            },
        )
        client.capture(
            'feature_used',
            properties={
                'feature_name': 'group_analytics',
            },
            groups={
                'company': 'acme-corp',
            },
        )

    return JsonResponse({
        'success': True,
        'message': 'Group analytics event captured',
    })
