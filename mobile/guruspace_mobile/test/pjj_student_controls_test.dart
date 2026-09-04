import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:guruspace_mobile/features/shared/presentation/live_class_screen.dart';

void main() {
  test('room control data rejects moderator commands from students', () {
    expect(
      pjjRoomControlMessageAllowed(
        'participant:publish',
        fromServer: false,
        senderIsModerator: false,
      ),
      isFalse,
    );
    expect(
      pjjRoomControlMessageAllowed(
        'quiz:launch',
        fromServer: false,
        senderIsModerator: true,
      ),
      isTrue,
    );
    expect(
      pjjRoomControlMessageAllowed(
        'participant:publish',
        fromServer: true,
        senderIsModerator: false,
      ),
      isTrue,
    );
    expect(
      pjjRoomControlMessageAllowed(
        'q:new',
        fromServer: false,
        senderIsModerator: false,
      ),
      isTrue,
    );
  });

  Widget buildPanel({
    bool handBusy = false,
    int unreadChat = 0,
    VoidCallback? onHand,
  }) {
    void noop() {}

    return MaterialApp(
      home: Scaffold(
        backgroundColor: Colors.black,
        body: Align(
          alignment: Alignment.bottomCenter,
          child: PjjStudentControlPanel(
            microphoneOn: true,
            cameraOn: false,
            handRaised: false,
            speakerOn: true,
            handBusy: handBusy,
            unreadChat: unreadChat,
            connected: true,
            canPublishMedia: true,
            onMicrophone: noop,
            onCamera: noop,
            onRaiseHand: onHand ?? noop,
            onChat: noop,
            onLeave: noop,
            onParticipants: noop,
            onSpeaker: noop,
            onFlipCamera: noop,
            onWhiteboard: noop,
            onAttendance: noop,
            onQuiz: noop,
          ),
        ),
      ),
    );
  }

  testWidgets('student PJJ controls render on a narrow Android viewport', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 640);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(buildPanel(unreadChat: 3));
    await tester.pump();

    expect(find.byKey(const Key('pjj-student-control-panel')), findsOneWidget);
    expect(find.byKey(const Key('pjj-control-microphone')), findsOneWidget);
    expect(find.byKey(const Key('pjj-control-camera')), findsOneWidget);
    expect(find.byKey(const Key('pjj-control-hand')), findsOneWidget);
    expect(find.byKey(const Key('pjj-control-chat')), findsOneWidget);
    expect(find.byKey(const Key('pjj-control-leave')), findsOneWidget);
    expect(find.text('3'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('raise hand is single-flight disabled while request is busy', (
    tester,
  ) async {
    var taps = 0;
    await tester.pumpWidget(
      buildPanel(handBusy: true, onHand: () => taps += 1),
    );

    await tester.tap(find.byKey(const Key('pjj-control-hand')));
    await tester.pump();

    expect(taps, 0);
  });

  testWidgets('secondary PJJ controls remain reachable by horizontal scroll', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 640);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(buildPanel());
    final scrollable = find.byType(Scrollable).last;
    await tester.drag(scrollable, const Offset(-350, 0));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('pjj-control-board')), findsOneWidget);
    expect(find.byKey(const Key('pjj-control-attendance')), findsOneWidget);
    expect(find.byKey(const Key('pjj-control-quiz')), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
