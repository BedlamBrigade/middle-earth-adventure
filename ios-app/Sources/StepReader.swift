import Foundation
import HealthKit

@MainActor
final class StepReader: ObservableObject {
    @Published var todaySteps: Int?
    @Published var status = "Connect Apple Health to preview your daily steps."
    @Published var connected = false

    private let store = HKHealthStore()
    private let stepsType = HKObjectType.quantityType(forIdentifier: .stepCount)!

    func requestAccess() async {
        guard HKHealthStore.isHealthDataAvailable() else {
            status = "Apple Health isn't available on this device."
            return
        }
        do {
            try await store.requestAuthorization(toShare: [], read: [stepsType])
            // HealthKit intentionally does not tell apps whether read access
            // was denied. A successful request is not proof of permission.
            connected = true
            await refresh()
        } catch {
            status = "Health permission request failed: \(error.localizedDescription)"
        }
    }

    func refresh() async {
        guard HKHealthStore.isHealthDataAvailable() else { return }
        let interval = Calendar.current.dateInterval(of: .day, for: Date())!
        let predicate = HKQuery.predicateForSamples(
            withStart: interval.start,
            end: interval.end,
            options: .strictStartDate
        )
        do {
            let total = try await withCheckedThrowingContinuation {
                (continuation: CheckedContinuation<Double, Error>) in
                let query = HKStatisticsQuery(
                    quantityType: stepsType,
                    quantitySamplePredicate: predicate,
                    options: .cumulativeSum
                ) { _, stats, error in
                    if let error {
                        continuation.resume(throwing: error)
                    } else {
                        continuation.resume(returning: stats?.sumQuantity()?.doubleValue(for: .count()) ?? 0)
                    }
                }
                store.execute(query)
            }
            todaySteps = Int(total.rounded())
            status = "Today’s HealthKit total. Compare with Apple Health before enabling uploads."
        } catch {
            status = "Couldn't read steps: \(error.localizedDescription)"
        }
    }
}
