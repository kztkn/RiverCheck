import { index, route, type RouteConfig } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("g/:groupCode", "routes/group-top.tsx"),
  route("g/:groupCode/about", "routes/about.tsx"),
  route("g/:groupCode/stats", "routes/stats-index.tsx"),
  route("g/:groupCode/stats/:groupPlayerId", "routes/stats-player.tsx"),
  route("g/:groupCode/organizer-login", "routes/organizer-login.tsx"),
  route("g/:groupCode/manage", "routes/group-manage.tsx"),
  route("g/:groupCode/players", "routes/players.tsx"),
  route("g/:groupCode/players/:groupPlayerId/avatar", "routes/player-avatar.ts"),
  route("g/:groupCode/profile", "routes/player-profile.tsx"),
  route("g/:groupCode/profile/claim/:claimToken", "routes/player-profile-claim.tsx"),
  route("g/:groupCode/games/new", "routes/game-new.tsx"),
  route("g/:groupCode/games/:gameId/photo", "routes/game-photo.ts"),
  route("g/:groupCode/games/:gameId", "routes/game-participant.tsx"),
  route("g/:groupCode/games/:gameId/admin", "routes/game-admin.tsx"),
  route("g/:groupCode/games/:gameId/admin/edit", "routes/game-edit.tsx"),
] satisfies RouteConfig;
