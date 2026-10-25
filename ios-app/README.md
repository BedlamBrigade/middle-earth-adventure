# Middle-earth Adventure — iPhone companion (initial foundation)

This is **source code**, not a downloadable iPhone app yet. It is intentionally on a GitHub feature branch. The existing live GitHub Pages site and Firebase database are unchanged.

## What works in this first version (after building on an actual iPhone)
- Native SwiftUI screen and optional Firebase email/password sign-in using **the same Firebase project and account** as the website.
- Apple's native HealthKit permission request for step-count reading.
- A read-only preview of today's HealthKit aggregate using `HKStatisticsQuery(.cumulativeSum)` (not the sum of individual shortcut samples).
- A link to the existing Fellowship website.

## Not yet implemented
- Automatic Firestore uploads, daily total corrections, background scheduling or HealthKit observer delivery.
- iOS native multi-Fellowship screens. The existing website continues to show/manage Fellowship progress.
- Reconciliation of native HealthKit totals against the Apple Health display and the existing manually-entered append-only logs.
- iOS production testing, code signing, App Store distribution and Android support.

**Do not assume the HealthKit aggregate is identical to Apple's Steps UI. Compare the values on your devices before building automatic syncing.**

## Build prerequisites
1. Access to a **Mac with Xcode**, plus an Apple account for signing and testing on an iPhone.
2. Install [XcodeGen](https://github.com/yonaskolb/XcodeGen) to generate the `.xcodeproj` from the committed `project.yml` (or create an iOS App project in Xcode and add the Swift source files manually).
3. In the existing Firebase Console project, **Add app > iOS**. Use Bundle ID `com.bedlambrigade.middleearthadventure` (or update the Bundle ID consistently in both locations).
4. Download **GoogleService-Info.plist** for this iOS app, place in `ios-app/Sources` and ensure it is included in the Xcode target. **Do not commit it until you've reviewed its contents** (it normally contains public client identifiers, but never commit service-account files/private keys).
5. On your Mac, in `ios-app`, run `xcodegen generate` then open `MiddleEarthAdventure.xcodeproj`. Firebase packages resolve through Swift Package Manager.
6. In Xcode, choose your Apple signing Team under Signing & Capabilities; check that **HealthKit** is enabled for the application target.
7. Build to a physical iPhone (HealthKit permissions and actual Health data are not meaningfully testable in this environment).

## Correct long-term sync design
- HealthKit's **cumulative statistics query** is the data source, not Shortcuts' raw sample sum.
- Firebase Authentication binds each update to the authorized user.
- Maintain a canonical `userId + localDate` daily step total with a device-specific sync date and last-read timestamp.
- Backend validates and **reconciles** the daily value; never append the full daily total multiple times.
- Daily totals can go down after data is corrected, so group accounting needs a per-user/per-day projection that supports **replacement** and transactional recalculation.
- Prevent credit for both automatic total and manually entered steps for the same day. Decide a clear migration/precedence policy.
- Use an `HKObserverQuery` with background delivery and optionally a daily refresh, understanding that iOS does not guarantee an exact 11:59 PM execution.
- Request only HealthKit *step count read* access. Don't request unrelated health data.

## Sharing
Friends can keep using the existing website and Fellowship links. Later, App Store/TestFlight distribution and Universal Links can open invitations in the iPhone app. No new link is required for existing web users.
