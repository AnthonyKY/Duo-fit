# notifications — step 5
Opt-in per space (`set_workout_sharing`): "share my workout start / finish" and "notify me". Events come from DUOFIT through
the read-only bridge (`legacyWorkoutEvents`), published with `publish_workout_event`. Push on iPhone requires the app to be
installed on the home screen (iOS 16.4+), permission asked at the moment it is useful, and a server function to send it.
Delivery is never guaranteed by Apple: the app also shows events when opened.
