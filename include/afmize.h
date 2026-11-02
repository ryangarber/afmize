// afmize's C ABI, implemented in Swift (`Sources/afmize/FFI.swift`).
//
// Every string crossing it is NUL-terminated UTF-8 JSON; see README.md for
// the request and event shapes.

#ifndef AFMIZE_H
#define AFMIZE_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/// Called serially, once per event, from one of afmize's own threads.
///
/// `event_json` is heap-allocated and owned by the callee: free it with
/// `afmize_string_free` once done, which may be after the callback returns.
/// After the final `finish` event, the callback is called once more with
/// NULL; no calls follow it, so it is the point to free `context`.
typedef void (*afmize_event_callback)(void *context, char *event_json);

/// The availability report, e.g.
/// `{"onDevice":{"available":true},"privateCloudCompute":{"available":false,"reason":"..."}}`.
/// Free it with `afmize_string_free`.
char *afmize_availability(void);

/// Frees a string afmize returned or passed to a callback.
void afmize_string_free(char *ptr);

/// Starts a stream for `request_json`, returning its id, or -1 (with no
/// callbacks to follow) when `request_json` or `callback` is NULL.
int64_t afmize_stream_start(const char *request_json, void *context, afmize_event_callback callback);

/// Cancels a running stream. Its `finish` event (reason `other`) and the NULL
/// sentinel still follow.
void afmize_stream_cancel(int64_t stream_id);

#ifdef __cplusplus
}
#endif

#endif
