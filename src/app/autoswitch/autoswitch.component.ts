import { Component } from "@angular/core";
import { AgentSelectRouterComponent } from "../agent-select/agent-select-router.component";
import { OverlayComponent } from "../overlay/overlay.component";

@Component({
  selector: "app-autoswitch",
  standalone: true,
  templateUrl: "./autoswitch.component.html",
  styleUrl: "./autoswitch.component.scss",
  imports: [AgentSelectRouterComponent, OverlayComponent],
})
export class AutoswitchComponent {}
