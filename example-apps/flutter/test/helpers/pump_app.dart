import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

extension PumpApp on WidgetTester {
  /// Pumps [widget] wrapped in a [MaterialApp], like the real app does.
  Future<void> pumpApp(Widget widget) {
    return pumpWidget(MaterialApp(home: widget));
  }
}
