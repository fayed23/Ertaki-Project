# Android releases

| File | Notes |
|---|---|
| `ertaki-android-release.apk` | Flutter **release** **1.0.14+14**, **lan** flavor, **debug-signed** for sideload (not Play Store) |
| `ertaki-android-release.apk.sha1` | `95492d27f8b501c9aa97070ecf9ead55372c67ad` |

**GitHub Release:** [v1.0.14-apk](https://github.com/fayed23/Ertaki-Project/releases/tag/v1.0.14-apk)

**Flavors:** `lan` (cleartext HTTP for LAN pilots) · `prod` (HTTPS-oriented, cleartext off).  
**Tokens:** `flutter_secure_storage` on device.  
**Store signing:** `mobile/android/key.properties.example` → local `key.properties` + upload keystore (gitignored).

**Default API (baked in):** `http://10.0.2.2:43124/api` (Android emulator → host).  
On a **physical phone**, open the login screen → **API base URL** → set `http://YOUR_PC_LAN_IP:43124/api` (or deployed HTTPS).

Rebuild:

```bash
cd mobile
flutter build apk --release --flavor lan --dart-define=API_BASE_URL=http://10.0.2.2:43124/api
cp build/app/outputs/flutter-apk/app-lan-release.apk ../releases/ertaki-android-release.apk
cp build/app/outputs/flutter-apk/app-lan-release.apk.sha1 ../releases/ertaki-android-release.apk.sha1
```
