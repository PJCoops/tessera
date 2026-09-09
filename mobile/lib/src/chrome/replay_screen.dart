import 'package:flutter/material.dart';

import '../mode.dart';

/// Placeholder — the isolated past-puzzle replay board lands in the next
/// Phase 3 slice.
class ReplayScreen extends StatelessWidget {
  const ReplayScreen({super.key, required this.date, required this.modeId});

  final String date;
  final ModeId modeId;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(),
      body: Center(child: Text('Replay $date')),
    );
  }
}
