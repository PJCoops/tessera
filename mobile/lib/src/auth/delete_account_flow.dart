import 'package:flutter/material.dart';

/// Placeholder — the in-app account-deletion flow (fresh re-auth + 48h
/// grace + restore, spec §6.3) lands in a later Phase 4 slice.
Future<void> showDeleteAccountFlow(BuildContext context) async {
  ScaffoldMessenger.of(context).showSnackBar(
    const SnackBar(content: Text('Account deletion arrives in a later update.')),
  );
}
