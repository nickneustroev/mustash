import { Module } from "@nestjs/common";
import { AutoPlaylistsRuntimeModule } from "../runtime/auto-playlists-runtime.module.js";

@Module({
  imports: [AutoPlaylistsRuntimeModule],
})
export class AppModule {}
