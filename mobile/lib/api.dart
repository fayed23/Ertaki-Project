import 'dart:convert';

import 'package:http/http.dart' as http;

const apiBase = String.fromEnvironment(
  'API_BASE',
  defaultValue: 'http://127.0.0.1:43124/api',
);

class ApiClient {
  ApiClient(this.token);
  String? token;

  Future<Map<String, dynamic>> post(String path, Map<String, dynamic> body) async {
    final res = await http.post(
      Uri.parse('$apiBase$path'),
      headers: _headers(),
      body: jsonEncode(body),
    );
    return _decode(res) as Map<String, dynamic>;
  }

  Future<dynamic> get(String path) async {
    final res = await http.get(Uri.parse('$apiBase$path'), headers: _headers());
    return _decode(res);
  }

  Future<Map<String, dynamic>> patch(String path, Map<String, dynamic> body) async {
    final res = await http.patch(
      Uri.parse('$apiBase$path'),
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
