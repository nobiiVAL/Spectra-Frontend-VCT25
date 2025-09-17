import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { TestingComponent } from "./testing/testing.component";
import { OverlayComponent } from "./overlay/overlay.component";
import { AgentSelectRouterComponent } from "./agent-select/agent-select-router.component";
import { AgentSelectComponent } from "./agent-select/agent-select.component";
import { AgentSelectV2Component } from "./agent-select/v2/agent-select-v2.component";
import { AgentSelectTestingComponent } from "./testing/agent-select/agent-select-testing";
import { AgentSelectV2TestingComponent } from "./testing/agent-select/v2/agent-select-v2.testing";
import { AutoswitchComponent } from "./autoswitch/autoswitch.component";
import { RedirectComponent } from "./redirect/redirect.component";
import { TimeoutComponent } from "./timeout/timeout.component";
import { AgentSelectTestingRouterComponent } from "./testing/agent-select/agent-select-testing-router.component";
import { MapbanUiComponent } from "./mapban-ui/mapban-ui.component";
import { MapbanFsComponent } from "./mapban-ui/mapban-fs/mapban-fs.component";

export const routes: Routes = [
  {
    path: "",
    component: RedirectComponent,
  },
  {
    path: "overlay",
    children: [
      {
        path: "",
        component: OverlayComponent,
      },
      {
        path: "minimal",
        component: OverlayComponent,
        data: {
          minimal: true,
        },
      },
    ],
  },
  {
    path: "testing",
    children: [
      {
        path: "",
        component: TestingComponent,
      },
      {
        path: "minimal",
        component: TestingComponent,
        data: {
          minimal: true,
        },
      },
    ],
  },
  {
    path: "agent-select",
    children: [
      {
        path: "",
        component: AgentSelectV2Component, // V2 is default
      },
      {
        path: "legacy",
        component: AgentSelectComponent, // V1/Legacy component
      },
    ],
  },
  {
    path: "autoswitch",
    children: [
      {
        path: "",
        component: AutoswitchComponent,
      },
      {
        path: "minimal",
        component: AutoswitchComponent,
        data: {
          minimal: true,
        },
      },
    ],
  },
  {
    path: "timeout",
    component: TimeoutComponent,
  },
  {
    path: "testing/agent-select",
    children: [
      {
        path: "",
        component: AgentSelectV2TestingComponent, // V2 testing is default
      },
      {
        path: "legacy",
        component: AgentSelectTestingComponent, // V1/Legacy testing component
      },
    ],
  },
  {
    path: "mapban",
    component: MapbanUiComponent,
  },
  {
    path: "mapban-fs",
    component: MapbanFsComponent,
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
