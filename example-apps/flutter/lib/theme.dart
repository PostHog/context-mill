import 'package:flutter/material.dart';

/// Design tokens mirroring the web examples' globals.css so every burrito
/// consideration app looks identical.
abstract final class AppColors {
  static const text = Color(0xFF333333); // body color: #333
  static const background = Color(0xFFF5F5F5); // body background: #f5f5f5
  static const header = Color(0xFF333333); // .header background
  static const headerHover = Color(0xFF555555); // .header a:hover
  static const primary = Color(0xFF0070F3); // .btn-primary
  static const primaryHover = Color(0xFF0051CC);
  static const danger = Color(0xFFDC3545); // .btn-logout / .error
  static const dangerHover = Color(0xFFC82333);
  static const success = Color(0xFF28A745); // .btn-burrito / .success
  static const successHover = Color(0xFF218838);
  static const note = Color(0xFF666666); // .note
  static const statsBackground = Color(0xFFF8F9FA); // .stats
  static const inputBorder = Color(0xFFDDDDDD); // .form-group input border
}

/// Text styles matching the browser defaults the CSS relies on
/// (16px body, line-height 1.6, bold headings at 2em/1.5em/1.17em).
abstract final class AppTextStyles {
  static const body = TextStyle(
    fontSize: 16,
    height: 1.6,
    color: AppColors.text,
  );

  static const h1 = TextStyle(
    fontSize: 32,
    height: 1.6,
    fontWeight: FontWeight.bold,
    color: AppColors.text,
  );

  static const h2 = TextStyle(
    fontSize: 24,
    height: 1.6,
    fontWeight: FontWeight.bold,
    color: AppColors.text,
  );

  static const h3 = TextStyle(
    fontSize: 18.7,
    height: 1.6,
    fontWeight: FontWeight.bold,
    color: AppColors.text,
  );

  static const label = TextStyle(
    fontSize: 16,
    height: 1.6,
    fontWeight: FontWeight.w500,
    color: AppColors.text,
  );

  static const note = TextStyle(
    fontSize: 14,
    height: 1.6,
    color: AppColors.note,
  );

  static const error = TextStyle(
    fontSize: 16,
    height: 1.6,
    color: AppColors.danger,
  );

  static const success = TextStyle(
    fontSize: 16,
    height: 1.6,
    color: AppColors.success,
  );
}
