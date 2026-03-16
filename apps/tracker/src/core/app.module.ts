import { Module } from "@nestjs/common";
import { TrackerRuntimeModule } from "../runtime/tracker-runtime.module.js";

@Module({
  imports: [TrackerRuntimeModule],
})
export class AppModule {}
