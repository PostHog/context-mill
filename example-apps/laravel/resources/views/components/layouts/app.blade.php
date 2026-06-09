<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">

    <title>{{ $title ?? 'PostHog Laravel Example' }}</title>

    <style>
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            line-height: 1.6;
            background-color: #f5f5f5;
            color: #333;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }
        nav {
            background: #1d4ed8;
            padding: 15px 20px;
            margin-bottom: 30px;
        }
        nav a {
            color: white;
            text-decoration: none;
            margin-right: 20px;
        }
        nav a:hover {
            text-decoration: underline;
        }
        .nav-right {
            float: right;
        }
        .card {
            background: white;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1, h2, h3 {
            margin-bottom: 15px;
            color: #1d4ed8;
        }
        button, .btn {
            background: #1d4ed8;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            display: inline-block;
            text-decoration: none;
        }
        button:hover, .btn:hover {
            background: #1e40af;
        }
        button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        button.danger, .btn-danger {
            background: #dc2626;
        }
        button.danger:hover, .btn-danger:hover {
            background: #b91c1c;
        }
        input {
            width: 100%;
            padding: 10px;
            margin-bottom: 15px;
            border: 1px solid #ddd;
            border-radius: 5px;
            font-size: 14px;
        }
        .message-error {
            background: #fee2e2;
            color: #dc2626;
            padding: 10px 15px;
            border-radius: 5px;
            margin-bottom: 15px;
        }
        .message-success {
            background: #d1fae5;
            color: #059669;
            padding: 10px 15px;
            border-radius: 5px;
            margin-bottom: 15px;
        }
        .feature-flag {
            background: #fef3c7;
            border: 2px dashed #f59e0b;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
        }
        code {
            background: #f3f4f6;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: monospace;
        }
        pre {
            background: #1e293b;
            color: #e2e8f0;
            padding: 16px;
            border-radius: 8px;
            overflow-x: auto;
            font-size: 13px;
        }
        .count {
            font-size: 48px;
            font-weight: bold;
            color: #1d4ed8;
            text-align: center;
            padding: 20px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 16px 0;
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #eee;
        }
        th {
            background: #f8fafc;
            font-weight: 600;
        }
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: 500;
        }
        .text-sm {
            font-size: 14px;
        }
        .text-gray {
            color: #666;
        }
        .mb-4 {
            margin-bottom: 16px;
        }
    </style>
    @livewireStyles
</head>
<body>
    @auth
    <nav>
        <a href="{{ route('dashboard') }}">Dashboard</a>
        <a href="{{ route('burrito') }}">Burrito</a>
        <a href="{{ route('profile') }}">Profile</a>
        <span class="nav-right">
            <span style="margin-right: 15px;">{{ auth()->user()->email }}</span>
            <form method="POST" action="{{ route('logout') }}" style="display: inline;">
                @csrf
                <button type="submit" style="background: none; padding: 0; color: white; text-decoration: underline;">Logout</button>
            </form>
        </span>
    </nav>
    @endauth

    <div class="container">
        @if (session('success'))
            <div class="message-success">
                {{ session('success') }}
            </div>
        @endif

        @if (session('error'))
            <div class="message-error">
                {{ session('error') }}
            </div>
        @endif

        {{ $slot }}
    </div>

    @livewireScripts
</body>
</html>
