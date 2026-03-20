/**
 * Config-driven mapping from Aircall user names -> presidential-performance-hub rep/team.
 *
 * - `aircall_user_name`: exact name from Aircall (case-insensitive).
 * - `rep_name`: name the app should show.
 * - `team`: team label the app should show.
 * - `app_user_id`: optional user id in the app (stored in Supabase `user_id` column).
 */
module.exports = [
  // Example entries (replace with real mappings for your team).
  // {
  //   aircall_user_name: 'Derek',
  //   rep_name: 'Derek',
  //   team: 'dispo',
  //   app_user_id: null
  // },
  // {
  //   aircall_user_name: 'Lyka',
  //   rep_name: 'Lyka',
  //   team: 'dispo',
  //   app_user_id: null
  // },
  // {
  //   aircall_user_name: 'Alex',
  //   rep_name: 'Alex',
  //   team: 'acquisition',
  //   app_user_id: null
  // }
];

