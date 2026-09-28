import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// JWT persistence: platform secure storage on mobile; SharedPreferences on web.
class TokenStore {
  TokenStore._();

  static const _key = 'token';
  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  static Future<String?> read() async {
    if (kIsWeb) {
      final prefs = await SharedPreferences.getInstance();
      return prefs.getString(_key);
    }
    final secure = await _storage.read(key: _key);
    if (secure != null && secure.isNotEmpty) return secure;
    // One-time migrate from older SharedPreferences installs.
    final prefs = await SharedPreferences.getInstance();
    final legacy = prefs.getString(_key);
    if (legacy != null && legacy.isNotEmpty) {
      await _storage.write(key: _key, value: legacy);
      await prefs.remove(_key);
      return legacy;
    }
    return null;
  }

  static Future<void> write(String token) async {
    if (kIsWeb) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_key, token);
      return;
    }
    await _storage.write(key: _key, value: token);
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_key);
  }

  static Future<void> clear() async {
    if (kIsWeb) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_key);
      return;
    }
    await _storage.delete(key: _key);
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_key);
  }
}
