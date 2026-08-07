# Sideload signing keystore

`myexchanges.keystore` is the stable debug/sideload key used by CI so APK updates can install over previous builds.

- alias: `myexchanges`
- store/key password: `android`

Do not rotate this file casually — a new key forces users to uninstall the app first.
