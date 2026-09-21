import 'package:flutter_test/flutter_test.dart';
import 'package:ertaki_mobile/main.dart';

void main() {
  testWidgets('Ertaki boots to login', (tester) async {
    await tester.pumpWidget(const ErtakiApp());
    expect(find.text('ارتق'), findsWidgets);
    expect(find.text('دخول'), findsOneWidget);
  });
}
