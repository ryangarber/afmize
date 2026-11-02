// swift-tools-version: 6.4

import PackageDescription

// afmize's core: FoundationModels behind a JSON protocol, with a C ABI
// (`include/afmize.h`). It depends on nothing, so any host can link it:
//
// - Swift (and the Capacitor plugin in `packages/capacitor`): `import afmize`.
// - Rust: swift-rs's `SwiftLinker` links the static `afmize` product; the C
//   ABI needs no SwiftRs types.
// - Bun/Node (`packages/node`): the dynamic `dynafmize` product, prebuilt.
let package = Package(
  name: "afmize",
  platforms: [.macOS(.v26), .iOS(.v26)],
  products: [
    .library(
      name: "afmize",
      type: .static,
      targets: ["afmize"]
    ),
    .library(
      name: "dynafmize",
      type: .dynamic,
      targets: ["afmize"]
    ),
  ],
  targets: [
    .target(
      name: "afmize",
      swiftSettings: [
        .enableUpcomingFeature("ApproachableConcurrency")
      ],
    ),
    .testTarget(
      name: "afmizeTests",
      dependencies: ["afmize"],
      swiftSettings: [
        .enableUpcomingFeature("ApproachableConcurrency")
      ],
    ),
  ]
)
