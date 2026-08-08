import { index, route, type RouteConfig } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("g/:groupCode", "routes/group-top.tsx"),
  route("g/:groupCode/stats", "routes/stats-index.tsx"),
  route("g/:groupCode/stats/:groupPlayerId", "routes/stats-player.tsx"),
  route("g/:groupCode/organizer-login", "routes/organizer-login.tsx"),
  route("g/:groupCode/manage", "routes/group-manage.tsx"),
  route("g/:groupCode/players", "routes/players.tsx"),
  route("g/:groupCode/games/new", "routes/game-new.tsx"),
  route("g/:groupCode/games/:gameId", "routes/game-participant.tsx"),
  route("g/:groupCode/games/:gameId/admin", "routes/game-admin.tsx"),
] satisfies RouteConfig;
