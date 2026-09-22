import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

/// Build-time default. Prefer `API_BASE_URL`; `API_BASE` kept for older scripts.
const String kDefaultApiBase = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: String.fromEnvironment(
    'API_BASE',
    defaultValue: 'http://10.0.2.2:43124/api',
  ),
);

const _prefsKey = 'api_base_url';

class AppConfig {
  static String apiBase = kDefaultApiBase;

  static Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString(_prefsKey);
    if (saved != null && saved.trim().isNotEmpty) {
      apiBase = normalizeApiBase(saved);
    } else {
      apiBase = normalizeApiBase(kDefaultApiBase);
    }
  }

  static Future<void> setApiBase(String value) async {
    apiBase = normalizeApiBase(value);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_prefsKey, apiBase);
  }

  static String normalizeApiBase(String raw) {
    var v = raw.trim();
    if (v.isEmpty) return kDefaultApiBase;
    if (!v.startsWith('http://') && !v.startsWith('https://')) {
      v = 'http://$v';
    }
    while (v.endsWith('/')) {
      v = v.substring(0, v.length - 1);
    }
    if (!v.endsWith('/api')) {
      v = '$v/api';
    }
    return v;
  }
}

class ApiClient {
  ApiClient(this.token);
  String? token;

  String get _base => AppConfig.apiBase;

  Future<Map<String, dynamic>> post(String path, Map<String, dynamic> body) async {
    final res = await http.post(
      Uri.parse('$_base$path'),
      headers: _headers(),
      body: jsonEncode(body),
    );
    return _decode(res) as Map<String, dynamic>;
  }

  Future<dynamic> get(String path) async {
    final res = await http.get(Uri.parse('$_base$path'), headers: _headers());
    return _decode(res);
  }

  Future<Map<String, dynamic>> patch(String path, Map<String, dynamic> body) async {
    final res = await http.patch(
      Uri.parse('$_base$path'),
      headers: _headers(),
      body: jsonEncode(body),
    );
    return _decode(res) as Map<String, dynamic>;
  }

  Map<String, String> _headers() => {
        'Content-Type': 'application/json',
        if (token != null) 'Authorization': 'Bearer $token',
      };

  dynamic _decode(http.Response res) {
    final body = res.body.isEmpty ? {} : jsonDecode(res.body);
    if (res.statusCode >= 400) {
      final msg = body is Map && body['message'] != null
          ? (body['message'] is List
              ? (body['message'] as List).join(', ')
              : body['message'].toString())
          : 'خطأ ${res.statusCode}';
      throw Exception(msg);
    }
    return body;
  }
}

String todayIso() => DateTime.now().toIso8601String().substring(0, 10);
