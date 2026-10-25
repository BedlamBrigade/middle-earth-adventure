# Multi-journey upgrade and Apple Health roadmap

## Features in this upgrade
- The **Journey** page shows personal progress and every joined Fellowship.
- A signed-in player can participate in **up to five active Fellowships** (cooperative or race). Their account's active-group list is stored in Firestore.
- Logging steps from either the Journey or Fellowship tab records one local personal log and queues the same steps for every currently joined Fellowship. Entries submitted **before joining** a group do not get copied retroactively.
- A unique log ID is reused for retries so network retries do not create duplicate Fellowship entries. Queued uploads survive a reload **in the same browser**. Stay signed in to complete uploads.
- The Fellowship tab lets users switch between joined groups and view up to 100 individual entries (date, member, steps) from the selected group.
- The old `middleEarthAdventure.v02` local save format is unchanged. The last-used Fellowship stored by the earlier version will be migrated to the cloud group list when possible.

## REQUIRED FIREBASE STEP before deployment
**Publish the updated `firestore.rules` manually in Firebase Console > Firestore Database > Rules.** These rules add the per-user `profiles/{uid}` group list and enforce at most five IDs in that list. The application cannot create/join groups using the new profile index until these rules are published. Do not merge this PR and tell players it works until this step is done.

## Important limits
- One manual submission of, for example, 7,000 steps counts 7,000 toward solo and toward **each of the player's currently joined groups** (not 35,000 toward one group). All activity must represent real steps.
- Solo saves are local browser storage. Changing browsers may hide those original solo entries. Export the solo backup before changing devices.
- Changes between different devices are synchronized for **Fellowship** group activity and membership, but **solo local history is not cloud-synced** yet.
- Offline uploads are queued locally and retried when the device is online and signed in. If the queue cannot be saved or membership has been revoked, some uploads require manual review. No app can guarantee delivery without network and server confirmation.
- Five is a limit on the active-group list. Full abuse-resistant enforcement of five historical membership records requires a trusted server transaction, which this static GitHub Pages app does not have.
- Already joined users should sign in using the same Firebase account to migrate their previously remembered group.
- All entries remain append-only and self-reported. The server does not independently verify physical step counts.

## Apple Health — NOT automatically connected
A GitHub Pages website does not have direct access to the iPhone's HealthKit store. ChatGPT's connected Apple Health information is not a background data feed that this separate website can query. This PR **does not** implement the requested 11:59 PM Apple Health upload.

For a subsequent integration choose one:
1. **iOS Shortcuts + authenticated backend:** Create a personal Time of Day automation for 11:59 PM, with Health steps for the **current date** and a secure, individually authenticated HTTPS upload endpoint (Firebase Cloud Functions / Cloud Run). It must be idempotent per account/day and reconcile changes if steps are revised or manually logged. Check iOS automation permissions and whether phone/network conditions allow execution. This requires backend design and may require Firebase Blaze billing.
2. **iOS companion app using HealthKit:** Request read access to Step Count, send daily aggregate deltas to the authenticated Firebase account with a background-capable scheduler subject to iOS restrictions. It also needs deduplication so manually logged steps aren't double-counted.

Do not create a public webhook with an embedded database administrator key. Never expose a reusable shared secret or service-account key in the GitHub Pages repository or a shareable Shortcut.

## Tests to perform after rules are published
1. On the same browser, export the solo save. Enter 123 steps and check personal totals.
2. Create a cooperative Fellowship and a race Fellowship. Check both in the Journey dashboard, alongside your personal miles.
3. Log 1,000 steps once. Check exactly one new 1,000-step entry in EACH Fellowship and personal history.
4. Refresh, switch Fellowships, confirm both individual activity logs remain and no duplicate steps appear.
5. Sign in from a second browser; confirm both Fellowship memberships and logs are visible. The original solo journal will not necessarily appear there.
6. Join three more Fellowships, then verify the fifth is selectable and a sixth cannot be added through the UI.
7. Disconnect the network, log 200 steps, reconnect while signed in, and confirm each Fellowship receives the queued entry once. Do not clear browser data while pending.
8. Test that another account cannot submit steps for another UID, edit prior logs, or read a Fellowship's members/entries before joining.
