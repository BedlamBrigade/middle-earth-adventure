import SwiftUI
import FirebaseAuth

struct ContentView: View {
    @StateObject private var steps = StepReader()
    @State private var email = ""
    @State private var password = ""
    @State private var user: User?
    @State private var authError = ""
    @State private var handle: AuthStateDidChangeListenerHandle?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    Text("THE FELLOWSHIP CHRONICLES")
                        .font(.caption).tracking(2)
                    Text("Middle-earth Adventure")
                        .font(.largeTitle.bold())
                        .multilineTextAlignment(.center)
                    Text("Walk from the Shire to Mount Doom.")
                        .foregroundStyle(.secondary)

                    if let user {
                        Text("Signed in as \(user.email ?? "Adventurer")")
                            .font(.footnote)
                        Button("Sign out") {
                            do { try Auth.auth().signOut() }
                            catch { authError = error.localizedDescription }
                        }
                    } else {
                        Group {
                            TextField("Email", text: $email)
                                .textInputAutocapitalization(.never)
                                .keyboardType(.emailAddress)
                                .textContentType(.username)
                            SecureField("Password", text: $password)
                                .textContentType(.password)
                            HStack {
                                Button("Sign in") { authenticate(create: false) }
                                Spacer()
                                Button("Create account") { authenticate(create: true) }
                            }
                        }
                        .textFieldStyle(.roundedBorder)
                        if !authError.isEmpty {
                            Text(authError).foregroundStyle(.red).font(.footnote)
                        }
                    }

                    Divider()
                    Image(systemName: "heart.text.square")
                        .font(.system(size: 50))
                        .foregroundStyle(.red)
                    Text("Apple Health")
                        .font(.title2.bold())
                    if let count = steps.todaySteps {
                        Text(count.formatted())
                            .font(.system(size: 48, weight: .bold, design: .rounded))
                        Text("Today's steps")
                        Text(String(format: "%.2f miles (2,000 steps/mile)", Double(count)/2000))
                            .font(.caption)
                    }
                    Text(steps.status)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                    Button("Connect Apple Health") {
                        Task { await steps.requestAccess() }
                    }
                    .buttonStyle(.borderedProminent)
                    Button("Refresh step preview") {
                        Task { await steps.refresh() }
                    }
                    .disabled(!steps.connected)

                    Text("Preview only: steps are NOT being uploaded yet. We must first add a daily reconciliation system so re-syncs or manual entries cannot double-count walking.")
                        .font(.footnote)
                        .foregroundStyle(.orange)
                        .padding()
                        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 12))

                    Link("Open Fellowship website",
                         destination: URL(string: "https://bedlambrigade.github.io/middle-earth-adventure/")!)
                        .font(.footnote)
                }
                .padding(24)
            }
            .navigationTitle("Adventure")
            .navigationBarTitleDisplayMode(.inline)
        }
        .onAppear {
            if handle == nil {
                handle = Auth.auth().addStateDidChangeListener { _, authUser in
                    user = authUser
                }
            }
        }
    }

    private func authenticate(create: Bool) {
        authError = ""
        if create {
            Auth.auth().createUser(withEmail: email, password: password) { _, error in
                if let error { authError = error.localizedDescription }
            }
        } else {
            Auth.auth().signIn(withEmail: email, password: password) { _, error in
                if let error { authError = error.localizedDescription }
            }
        }
    }
}
