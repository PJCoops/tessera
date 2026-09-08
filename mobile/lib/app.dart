import 'package:flutter/material.dart';

import 'flavors.dart';

/// Root widget. Phase 1 is scaffolding only — the game screen lands in
/// Phase 2 (spec §22). For now this proves the app builds, runs, and
/// resolves its flavor.
class TesseraApp extends StatelessWidget {
  const TesseraApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: F.title,
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF7A9070)),
        useMaterial3: true,
      ),
      home: const _Placeholder(),
    );
  }
}

class _Placeholder extends StatelessWidget {
  const _Placeholder();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Tessera', style: TextStyle(fontSize: 32, fontWeight: FontWeight.w300)),
            const SizedBox(height: 8),
            Text('flavor: ${F.name}', style: Theme.of(context).textTheme.bodySmall),
          ],
        ),
      ),
    );
  }
}
