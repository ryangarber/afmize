// swift-tools-version: 6.4

import Foundation
import PackageDescription

/// afmize's version: the plugin is released in lockstep with the core, and
/// rylease writes it here.
let version: Version = "1.0.2"

/// Inside afmize's repository (developing it, or an app `link:`ed to it), the
/// core is the one beside the plugin; installed from npm, it is the release
/// tagged with the plugin's version. A `link:` reaches the plugin through a
/// symlink in node_modules, so the repository is found from its real path.
let repository = URL(fileURLWithPath: Context.packageDirectory)
  .resolvingSymlinksInPath()
  .deletingLastPathComponent()
  .deletingLastPathComponent()
let local = FileManager.default.fileExists(
  atPath: repository.appendingPathComponent("Sources/afmize/FFI.swift").path)

let package = Package(
  // What `cap sync` names it after the npm package, @afmize/capacitor.
  name: "AfmizeCapacitor",
  platforms: [.iOS(.v26)],
  products: [
    .library(
      name: "AfmizeCapacitor",
      targets: ["AfmizePlugin"]
    )
  ],
  dependencies: [
    .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0"),
    local
      ? .package(name: "afmize", path: repository.path)
      : .package(url: "https://github.com/ryangarber/afmize.git", exact: version),
  ],
  targets: [
    .target(
      name: "AfmizePlugin",
      dependencies: [
        .product(name: "Capacitor", package: "capacitor-swift-pm"),
        .product(name: "Cordova", package: "capacitor-swift-pm"),
        .product(name: "afmize", package: "afmize"),
      ],
      path: "ios/Sources/AfmizePlugin",
      swiftSettings: [
        .enableUpcomingFeature("ApproachableConcurrency")
      ]
    )
  ]
)
