"""Django settings for PostHog example project"""

import atexit
import logging
import os
from pathlib import Path

from posthog import Posthog

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'django-insecure-example-key-change-in-production')

DEBUG = os.environ.get('DEBUG', 'True').lower() == 'true'

ALLOWED_HOSTS = ['localhost', '127.0.0.1', 'testserver']


# Leave the token as None when unset rather than defaulting to a placeholder or empty key,
# which would either send events to a bogus token or raise ValueError during client setup.
POSTHOG_PROJECT_TOKEN = os.environ.get('POSTHOG_PROJECT_TOKEN')
POSTHOG_HOST = os.environ.get('POSTHOG_HOST', 'https://us.i.posthog.com')
POSTHOG_DISABLED = os.environ.get('POSTHOG_DISABLED', 'False').lower() == 'true'

_posthog_token = (POSTHOG_PROJECT_TOKEN or '').strip()
if not POSTHOG_DISABLED and _posthog_token:
    POSTHOG_MW_CLIENT = Posthog(
        _posthog_token,
        host=POSTHOG_HOST,
        enable_exception_autocapture=True,
        debug=DEBUG,
    )
    atexit.register(POSTHOG_MW_CLIENT.shutdown)
else:
    POSTHOG_MW_CLIENT = None
    if DEBUG and not POSTHOG_DISABLED:
        logger.warning(
            'POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, '
            'this causes events to be silently missed. This error stops appearing once POSTHOG_PROJECT_TOKEN is configured'
        )


INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'core.apps.CoreConfig',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# Only install PosthogContextMiddleware when a configured client exists because
# process_exception falls back to module-level posthog and raises ValueError when unconfigured.
if POSTHOG_MW_CLIENT is not None:
    MIDDLEWARE.append('posthog.integrations.django.PosthogContextMiddleware')

ROOT_URLCONF = 'posthog_example.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'posthog_example.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
