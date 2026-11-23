---
name: tv-detox
description: "Clean up a slow Android/Google TV over adb; optionally add TV Detox launcher. Use for debloating or ad removal. Not for non-Android TVs or TV.app (apple-tv)."
version: 1.1.0
license: MIT
metadata:
  upstream:
    repo: https://github.com/Ansub/tv-detox
    license: MIT
    reviewed_commit: 9e546c2480e1538346dc37f0ed15424d342ff6e3
    reviewed_release: v1.3.0
  agentskills:
    tags: [android-tv, google-tv, adb, debloat, launcher]
---

# TV Detox

Makes an old Android TV fast again: turn off bloat and ad rows, then (optionally) install
TV Detox, a tiny ad-free home screen showing the user's apps, HDMI inputs and a clock.
Upstream: <https://github.com/Ansub/tv-detox> (MIT). This skill wraps its documented
workflow; it does not vendor the upstream scripts or APK.

## Requirements

- `adb` on this machine (macOS: `brew install android-platform-tools`).
- The TV on the same network (Wi-Fi or Ethernet), with Developer options and USB debugging
  on (Settings > Device Preferences/System > About > press Build 7 times; then Developer
  options > USB debugging, plus Network/Wireless debugging if shown).
- The user at the TV to press "Allow debugging?" (tick "Always allow") on first connect.

Works on Android TV 9, 11, 12 and Google TV 14 per upstream. Fire TV: cleanup only, the home
screen cannot be replaced. Roku, Samsung Tizen and LG webOS are not Android: stop and say so.

## Rules

1. Read the device first. Before changing anything, list every installed app in plain
   language in three groups: safe to turn off, needed by the TV, apps the user uses. Record
   free memory (`adb shell cat /proc/meminfo` or `dumpsys meminfo`).
2. Ask the user before every change. Turn apps off with
   `pm disable-user --user 0 <pkg>`; never `pm uninstall`. Keep a list of every change and
   its undo command (`pm enable <pkg>`), and give it to the user at the end.
3. Never turn off: Google Play services (`com.google.android.gms`), Google Play, Settings,
   System UI, setup/provisioning apps, the keyboard, Bluetooth, HDMI inputs, the TV input and
   tuner framework, or anything else the TV needs to boot. When unsure, leave it on. Only
   exception: if `install.sh` offers to turn off Google TV's setup app
   (`com.google.android.tungsten.setupwraith`) because it took over Home, ask first.
4. If the user casts or uses the remote's YouTube button (Chromecast with Google TV), keep
   the related apps on.

## Steps

1. Connect: `adb connect <TV_IP>:5555`, then `adb -s <TV_IP>:5555 get-state` must print
   `device` (`unauthorized` means the user must press Allow on the TV).
2. Inventory and free memory (rule 1); present the three groups and wait for choices.
3. Apply only the approved disables, one confirmed change at a time (rule 2).
4. Home screen (skip if the user wants to keep their TV's own): clone the upstream repo into
   a new empty directory, check out the reviewed commit, and run its installer with the TV
   and the user's apps:

   ```sh
   git clone https://github.com/Ansub/tv-detox "$DIR" && git -C "$DIR" checkout 9e546c2480e1538346dc37f0ed15424d342ff6e3
   sh "$DIR/install.sh" <TV_IP> "com.netflix.ninja,com.google.android.youtube.tv"
   ```

   Optional third argument adds settings shortcuts by the clock, e.g. `"bluetooth,sound,picture"`.
   `install.sh` downloads the latest release `tvhome.apk` unless `out/tvhome.apk` exists, makes
   it the default Home, and only turns off known launchers, saving each to
   `/data/local/tmp/tvhome-disabled.txt` for undo. `YES=1` skips its prompts; `YES_SETUP=1` is
   needed to turn off the setup app, and must only be used after the user agreed (rule 3).
   If the checked-out commit is not the latest upstream, read the new diff of `install.sh` and
   `undo.sh` before running a newer one.
5. Turn off animations and the screensaver, and make the TV sleep after 5 minutes:
   `settings put global window_animation_scale 0`, same for `transition_animation_scale` and
   `animator_duration_scale`; screensaver and sleep through the TV's settings provider
   (`settings put secure screensaver_enabled 0`, `settings put system screen_off_timeout 300000`),
   reading each value back.
6. Wait 30 seconds after the last change (Android persists package state a few seconds
   later), then restart once (`adb reboot`), reconnect, and confirm the TV boots to the
   expected home screen. Report free memory before and after, and the change list with undo
   commands.

## Undo

- Everything: `sh "$DIR/undo.sh" <TV_IP>` turns back on what `install.sh` disabled and
  removes the home screen.
- Single app: `adb shell pm enable <pkg>`.
- Setup screen loop on Google TV: `pm enable com.google.android.tungsten.setupwraith` and
  `pm enable com.google.android.apps.tv.launcherx` first.

## Troubleshooting

- TV still opens Live TV or an HDMI input at power-on: that is a TV setting, not the home
  screen; find and turn off the startup-input setting.
- A remote button stopped working: the app that handled it was turned off; find it with
  `adb shell dumpsys activity recents` or by re-enabling recent disables one at a time.
- Hosted chat apps cannot reach the TV; this must run on a machine on the TV's network.

Upstream notes the workflow is provided as-is; tell the user changes are at their own risk
before the first change.
