// Port of the `t()` helper in app/lib/i18n.ts. Pull a value out of a
// locale dictionary by dotted path, optionally interpolating
// {placeholders}. Returns the raw path on a miss so a missing string is
// loud rather than silent.

final _placeholder = RegExp(r'\{(\w+)\}');

String t(Map<String, dynamic> dict, String path, [Map<String, Object>? vars]) {
  dynamic cur = dict;
  for (final p in path.split('.')) {
    if (cur is Map<String, dynamic> && cur.containsKey(p)) {
      cur = cur[p];
    } else {
      return path;
    }
  }
  if (cur is! String) return path;
  if (vars == null) return cur;
  return cur.replaceAllMapped(_placeholder, (m) {
    final v = vars[m.group(1)];
    return v == null ? '{${m.group(1)}}' : '$v';
  });
}
