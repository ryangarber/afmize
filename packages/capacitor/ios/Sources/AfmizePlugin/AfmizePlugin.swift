import Capacitor
import Foundation
import Synchronization
import afmize

/// afmize for a Capacitor app's webview. `cap sync` finds and registers it.
///
/// - `availability()` resolves `{ json }`, afmize's availability report.
/// - `start({ key, request })` starts a stream for `request` (afmize's request
///   JSON), under the `key` the webview picked; its events arrive as `event`
///   notifications, `{ key, event }` with `event` as JSON, `finish` last.
/// - `cancel({ key })` cancels it; its `finish` still arrives.
@objc(AfmizePlugin)
public final class AfmizePlugin: CAPPlugin, CAPBridgedPlugin, @unchecked Sendable {
  public let identifier = "AfmizePlugin"
  public let jsName = "Afmize"
  public let pluginMethods: [CAPPluginMethod] = [
    CAPPluginMethod(name: "availability", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "cancel", returnType: CAPPluginReturnPromise),
  ]

  private let streams = Mutex<[Int: Task<Void, Never>]>([:])

  @objc func availability(_ call: CAPPluginCall) {
    call.resolve(["json": Afmize.availabilityJSON()])
  }

  @objc func start(_ call: CAPPluginCall) {
    guard let key = call.getInt("key"), let request = call.getString("request") else {
      call.reject("start takes a numeric `key` and a `request` JSON string")
      return
    }
    let started = streams.withLock { streams in
      guard streams[key] == nil else { return false }
      // Stored under the lock it is removed under, so a stream that finishes
      // at once cannot be removed before it is added.
      streams[key] = Task.detached { [self] in
        // Events come serially, `stream-start` first and `finish` last, even
        // on cancel or a request afmize can't decode.
        await Afmize.run(requestJSON: request) { event in
          self.notifyListeners("event", data: ["key": key, "event": event.jsonString()])
        }
        _ = self.streams.withLock { $0.removeValue(forKey: key) }
      }
      return true
    }
    if started {
      call.resolve()
    } else {
      call.reject("a stream with key \(key) is already running")
    }
  }

  @objc func cancel(_ call: CAPPluginCall) {
    guard let key = call.getInt("key") else {
      call.reject("cancel takes the `key` the stream started with")
      return
    }
    streams.withLock { $0[key] }?.cancel()
    call.resolve()
  }
}
