# Fellowship Mode — Firebase setup

The existing solo app uses the same browser storage key as before. Fellowship miles are **separate** from solo miles, and do not import existing logs automatically (prevents accidentally counting old walks twice).

## 1. Create a Firebase project
1. Go to https://console.firebase.google.com/ and **Add project**.
2. In **Project settings > Your apps**, add a **Web app**. You do **not** need Firebase Hosting; GitHub Pages continues to serve the app.
3. Copy the Web app settings into `firebase-config.js` (replace the four placeholders). The web API key is a public client-side identifier; **never** commit a service account key, admin credential or other secret.
4. Go to **Build > Authentication > Sign-in method**. Enable **Email/Password** (not anonymous; accounts should work across browsers/devices). Consider configuring account email-verification and password-recovery flows before wider release.
5. Under Authentication **Settings > Authorized domains**, ensure `bedlambrigade.github.io` is listed if Firebase asks for it. Email/password authentication does not require an OAuth redirect.
6. Go to **Build > Firestore Database** and create a database. Choose a region close to users. Do not leave permissive test rules active.
7. Open **Firestore > Rules**, paste the entire `firestore.rules` file, and click **Publish**.
8. Merge your GitHub PR to `main`. Wait for GitHub Pages deployment, then open https://bedlambrigade.github.io/middle-earth-adventure/ .

## 2. Use it
1. Open **Fellowship** tab and create an account or sign in.
2. Enter a Fellowship name, select **Shared journey** or **Race to Mount Doom**, and choose **Create Fellowship**.
3. Use **Copy invite link**, and send that unique URL to a friend. They sign up and press **Join Fellowship**.
4. Log steps *inside Fellowship Mode* to add to group stats. Solo "Add steps" logs only in your individual local journey.
5. The Fellowship and its entries appear on other devices when you sign in with the same account.

## 3. Important security/product limitations
- The invitation URL contains an unguessable Firestore group ID. **Anyone with the link and a signed-in account can join**, and forwarding the link grants access. This is invite-by-link, not owner-approved access. Keep links private.
- Members can see fellow member names and step submissions. No GPS/location data is collected by this feature.
- The founder can remove non-owner members, but entries already submitted remain in the group history.
- Steps are self-reported; there is no fitness-device verification, anti-cheat system, or per-day aggregate limit. Use for friendly challenges, not prize competitions.
- The browser must have internet access to submit Fellowship steps. The app reports failures instead of claiming an unsaved submission succeeded.
- The app uses Firebase's client-side SDK from Google's public CDN. Firebase Authentication and Firestore can incur usage charges if you later outgrow free allowances; set billing alerts before scaling.
- The founder currently cannot delete a Fellowship. Group mode is fixed at creation. Members cannot edit prior logged entries. Account password reset and account deletion flows are not yet included.
- No automatic migration from solo localStorage to the cloud. Back up existing solo progress via **Hero & Data > Export save file** before making changes.
- For production, consider Firebase App Check, email verification, abuse controls, and server-side rate limiting. Firestore rules enforce ownership and membership but cannot verify walking activity.

## 4. Test checklist
- Solo steps/history remain after the update, refresh, and browser restart.
- Create a cooperative group, invite another account, have both log steps, check the combined mileage.
- Create a race group, have each account log steps, verify individual totals and rankings.
- Check a nonmember cannot read the members/entries collections; a member cannot impersonate another UID or change/delete existing entries (Firebase Rules Playground/Emulator).
- Check invalid steps (zero, fractions, >100000) are rejected.
- Log out, sign in on another browser with the same account, and verify group membership persists.
- Try changing the URL to a random group ID; no unrelated group list is exposed.
