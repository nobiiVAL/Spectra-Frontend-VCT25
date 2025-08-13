import { ApplicationConfig } from "@angular/core";
import { provideRouter } from "@angular/router";
import { routes } from "./app-routing.module";
import { provideAnimations } from "@angular/platform-browser/animations";
import { provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    // Remove importProvidersFrom(AppRoutingModule), - this causes duplicate router registration
    provideAnimations(),
    provideHttpClient(withInterceptorsFromDi()),
  ],
};