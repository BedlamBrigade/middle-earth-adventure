import SwiftUI
import FirebaseCore

@main
struct MiddleEarthAdventureApp: App {
    init() {
        // Register the iOS app in the existing Firebase project and add
        // its GoogleService-Info.plist to this target before building.
        FirebaseApp.configure()
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
