import 'package:flutter_test/flutter_test.dart';
import 'package:ertaki_mobile/main.dart';

void main() {
  testWidgets('Ertaki app boots to login', (WidgetTester tester) async {
    await tester.pumpWidget(const ErtakiApp());
    expect(find.text('ارتق'), findsOneWidget);
    expect(find.text('دخول'), findsOneWidget);
  });
}
