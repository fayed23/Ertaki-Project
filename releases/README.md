# Android releases

| File | Notes |
|---|---|
| `ertaki-android-release.apk` | Flutter **release** build **1.0.12+13**, **debug-signed** for sideload (not Play Store) |
| `ertaki-android-release.apk.sha1` | Content hash from Flutter build |

**GitHub Release:** [v1.0.12-apk](https://github.com/fayed23/Ertaki-Project/releases/tag/v1.0.12-apk)

**Default API (baked in):** `http://10.0.2.2:43124/api` (Android emulator → host).  
On a **physical phone**, open the login screen → **API base URL** → set `http://YOUR_PC_LAN_IP:43124/api` (or ngrok/deployed HTTPS).

Rebuild:

```bash
cd mobile
flutter build apk --release --dart-define=API_BASE_URL=http://10.0.2.2:43124/api
cp build/app/outputs/flutter-apk/app-release.apk ../releases/ertaki-android-release.apk
cp build/app/outputs/flutter-apk/app-release.apk.sha1 ../releases/ertaki-android-release.apk.sha1
```
