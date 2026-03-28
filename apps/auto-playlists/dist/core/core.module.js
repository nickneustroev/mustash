var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Module } from "@nestjs/common";
import { loadConfig } from "./config.js";
import { logger } from "./logger.js";
import { APP_CONFIG, APP_LOGGER, FETCH_IMPL } from "./nest.tokens.js";
let CoreModule = class CoreModule {
};
CoreModule = __decorate([
    Module({
        providers: [
            {
                provide: APP_CONFIG,
                useFactory: loadConfig,
            },
            {
                provide: APP_LOGGER,
                useValue: logger,
            },
            {
                provide: FETCH_IMPL,
                useValue: fetch,
            },
        ],
        exports: [APP_CONFIG, APP_LOGGER, FETCH_IMPL],
    })
], CoreModule);
export { CoreModule };
//# sourceMappingURL=core.module.js.map