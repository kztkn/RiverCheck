import { index, route, type RouteConfig } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("error", "routes/error.tsx"),
  route("r/:resultCode", "routes/result-short-link.ts"),
  route("g/:groupCode", "routes/group-top.tsx"),
  route("g/:groupCode/groups", "routes/group-directory.tsx"),
  route("g/:groupCode/about", "routes/about.tsx"),
  route("g/:groupCode/stats", "routes/stats-index.tsx"),
  route("g/:groupCode/stats/:groupPlayerId", "routes/stats-player.tsx"),
  route("g/:groupCode/organizer-login", "routes/organizer-login.tsx"),
  route("g/:groupCode/organizer-logout", "routes/organizer-logout.ts"),
  route("g/:groupCode/manage", "routes/group-manage.tsx"),
  route("g/:groupCode/settings", "routes/group-settings.tsx"),
  route("g/:groupCode/players", "routes/players.tsx"),
  route("g/:groupCode/players/:groupPlayerId/avatar", "routes/player-avatar.ts"),
  route("g/:groupCode/profile", "routes/player-profile.tsx"),
  route("g/:groupCode/logout", "routes/player-logout.ts"),
  route("g/:groupCode/profile/claim/:claimToken", "routes/player-profile-claim.tsx"),
  route("g/:groupCode/games/new", "routes/game-new.tsx"),
  route(
    "g/:groupCode/games/:gameId/stories/:postId/photo",
    "routes/game-story-photo.ts",
  ),
  route(
    "g/:groupCode/games/:gameId/story-reactions",
    "routes/game-story-reactions.ts",
  ),
  route("g/:groupCode/games/:gameId/timeline", "routes/game-timeline.ts"),
  route(
    "g/:groupCode/games/:gameId/cost-share-receipts",
    "routes/game-cost-share-receipts.ts",
  ),
  route("g/:groupCode/games/:gameId", "routes/game-participant.tsx"),
  route("g/:groupCode/games/:gameId/admin", "routes/game-admin.tsx"),
  route("g/:groupCode/games/:gameId/admin/edit", "routes/game-edit.tsx"),
] satisfies RouteConfig;
