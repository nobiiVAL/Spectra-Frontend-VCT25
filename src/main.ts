import { enableProdMode } from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";

import { AppComponent } from "./app/app.component";
import { appConfig } from "./app/app.config";
import { environment } from "./environments/environment";
import { Config } from "./app/shared/config";

fetch("/assets/config/config.json")
  .then(async (res) => {
    const configuration = new Config(await res.json());

    if (environment.production) {
      enableProdMode();
    }

    bootstrapApplication(AppComponent, {
      ...appConfig,
      providers: [...appConfig.providers, { provide: Config, useValue: configuration }],
    }).catch((err) => console.error(err));
  })
  .catch((err) => console.error("Failed to load config", err));
