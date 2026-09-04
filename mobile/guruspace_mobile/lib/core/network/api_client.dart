import 'dart:io';

import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:dio_cookie_manager/dio_cookie_manager.dart';
import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';
import 'package:guruspace_mobile/core/config/app_config.dart';
import 'package:guruspace_mobile/core/network/api_exception.dart';
import 'package:guruspace_mobile/core/network/secure_cookie_storage.dart';

class ApiClient {
  ApiClient._(this.dio, this._cookieJar);

  final Dio dio;
  final PersistCookieJar _cookieJar;
  static const maxEbookBytes = 90 * 1024 * 1024;

  static Future<ApiClient> create() async {
    final cookieJar = PersistCookieJar(
      ignoreExpires: false,
      storage: SecureCookieStorage(),
    );
    final baseUri = validatedAppBaseUri();
    try {
      final directory = await getApplicationSupportDirectory();
      await _migrateLegacyCookies(
        cookieJar,
        FileStorage('${directory.path}/auth_cookies'),
        baseUri,
      );
    } catch (error, stackTrace) {
      debugPrint('Legacy cookie migration skipped: $error');
      debugPrintStack(stackTrace: stackTrace);
    }
    final dio = Dio(
      BaseOptions(
        baseUrl: baseUri.toString(),
        connectTimeout: const Duration(seconds: 20),
        sendTimeout: const Duration(seconds: 30),
        receiveTimeout: const Duration(seconds: 30),
        followRedirects: false,
        headers: const {
          'Accept': 'application/json',
          'User-Agent': 'UkhuwahMobile/1.0',
        },
        validateStatus: (status) => status != null && status < 500,
      ),
    );
    dio.interceptors.add(CookieManager(cookieJar));
    return ApiClient._(dio, cookieJar);
  }

  static Future<void> _migrateLegacyCookies(
    PersistCookieJar secureJar,
    FileStorage legacyStorage,
    Uri baseUri,
  ) async {
    final legacyDirectory = Directory('${legacyStorage.dir}/ie0_ps0');
    if (!await legacyDirectory.exists()) return;
    final legacyJar = PersistCookieJar(
      ignoreExpires: false,
      storage: legacyStorage,
    );
    final cookies = await legacyJar.loadForRequest(baseUri);
    if (cookies.isNotEmpty) {
      // Delete plaintext only after the encrypted copy is safely committed.
      // A KeyStore failure therefore never destroys a still-usable session.
      await secureJar.saveFromResponse(baseUri, cookies);
    }
    await legacyJar.deleteAll();
  }

  Future<Map<String, dynamic>> getJson(
    String path, {
    Map<String, dynamic>? query,
  }) async {
    try {
      final response = await dio.get<dynamic>(path, queryParameters: query);
      return _asJson(response);
    } on DioException catch (error) {
      throw _fromDio(error);
    }
  }

  Future<Map<String, dynamic>> postJson(
    String path, {
    Object? data,
    Map<String, dynamic>? query,
    Duration? receiveTimeout,
  }) async {
    try {
      final response = await dio.post<dynamic>(
        path,
        data: data,
        queryParameters: query,
        options: Options(
          contentType: Headers.jsonContentType,
          receiveTimeout: receiveTimeout,
        ),
      );
      return _asJson(response);
    } on DioException catch (error) {
      throw _fromDio(error);
    }
  }

  Future<Map<String, dynamic>> patchJson(String path, Object data) async {
    try {
      final response = await dio.patch<dynamic>(
        path,
        data: data,
        options: Options(contentType: Headers.jsonContentType),
      );
      return _asJson(response);
    } on DioException catch (error) {
      throw _fromDio(error);
    }
  }

  Future<Map<String, dynamic>> deleteJson(String path, {Object? data}) async {
    try {
      final response = await dio.delete<dynamic>(
        path,
        data: data,
        options: data == null
            ? null
            : Options(contentType: Headers.jsonContentType),
      );
      return _asJson(response);
    } on DioException catch (error) {
      throw _fromDio(error);
    }
  }

  Future<void> downloadToFile(
    String path,
    String targetPath, {
    ProgressCallback? onReceiveProgress,
  }) async {
    final cancelToken = CancelToken();
    var completed = false;
    try {
      final response = await dio.download(
        path,
        targetPath,
        cancelToken: cancelToken,
        deleteOnError: true,
        options: Options(
          headers: const {'Accept': 'application/pdf,application/octet-stream'},
          receiveTimeout: const Duration(minutes: 3),
        ),
        onReceiveProgress: (received, total) {
          if (received > maxEbookBytes || total > maxEbookBytes) {
            cancelToken.cancel('ebook_too_large');
            return;
          }
          onReceiveProgress?.call(received, total);
        },
      );
      final status = response.statusCode ?? 500;
      if (status >= 400) {
        throw ApiException(
          'Berkas ebook tidak dapat diunduh.',
          statusCode: status,
        );
      }
      final file = File(targetPath);
      if (!await file.exists() || await file.length() > maxEbookBytes) {
        throw const ApiException('Ukuran ebook melebihi batas 90 MB.');
      }
      completed = true;
    } on DioException catch (error) {
      if (CancelToken.isCancel(error)) {
        throw const ApiException('Ukuran ebook melebihi batas 90 MB.');
      }
      throw _fromDio(error);
    } finally {
      if (!completed) {
        final partial = File(targetPath);
        if (await partial.exists()) await partial.delete();
      }
    }
  }

  Future<Map<String, dynamic>> postForm(
    String path,
    Map<String, dynamic> data, {
    Map<String, dynamic>? headers,
  }) async {
    try {
      final response = await dio.post<dynamic>(
        path,
        data: data,
        options: Options(
          contentType: Headers.formUrlEncodedContentType,
          headers: headers,
        ),
      );
      return _asJson(response);
    } on DioException catch (error) {
      throw _fromDio(error);
    }
  }

  Future<Map<String, dynamic>> postMultipartFile(
    String path, {
    required String fieldName,
    required String filePath,
    required String fileName,
    ProgressCallback? onSendProgress,
  }) async {
    try {
      final form = FormData.fromMap({
        fieldName: await MultipartFile.fromFile(filePath, filename: fileName),
      });
      final response = await dio.post<dynamic>(
        path,
        data: form,
        onSendProgress: onSendProgress,
        options: Options(
          contentType: Headers.multipartFormDataContentType,
          sendTimeout: const Duration(minutes: 3),
          receiveTimeout: const Duration(minutes: 2),
        ),
      );
      return _asJson(response);
    } on DioException catch (error) {
      throw _fromDio(error);
    }
  }

  Future<void> clearSession() => _cookieJar.deleteAll();

  Map<String, dynamic> _asJson(Response<dynamic> response) {
    final data = response.data;
    final json = data is Map
        ? Map<String, dynamic>.from(data)
        : <String, dynamic>{};
    final status = response.statusCode ?? 500;
    if (status >= 400) {
      throw ApiException(
        json['error']?.toString() ?? 'Layanan GuruSpace sedang bermasalah.',
        statusCode: status,
        code: json['code']?.toString(),
      );
    }
    return json;
  }

  ApiException _fromDio(DioException error) {
    return ApiException(
      error.type == DioExceptionType.connectionTimeout
          ? 'Koneksi ke GuruSpace terlalu lama.'
          : 'Tidak dapat terhubung ke server GuruSpace.',
      statusCode: error.response?.statusCode,
    );
  }
}
