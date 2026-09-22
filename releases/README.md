# Android releases

Sideload APKs for phone testing live here.

- `ertaki-android-release.apk` — Flutter release build (debug-signed for sideload)
- Build locally: `cd mobile && flutter build apk --release --dart-define=API_BASE_URL=http://10.0.2.2:43124/api`
- On a physical phone, change the in-app **API base URL** to your PC LAN IP (see root README).
