import { trigger, transition, style, animate, group, keyframes } from "@angular/animations";
import { Component, Input } from "@angular/core";
import { Config } from "../../shared/config";
import { AgentNameService } from "../../services/agentName.service";
import { CommonModule, NgIf, NgFor } from "@angular/common";
import { AbilitiesComponent } from "../../abilities/abilities.component";
import { ShieldIconComponent } from "./shield-icon/shield-icon.component";
import { UltimateComponent } from "../../ultimate/ultimate.component";
import { NameoverridePipe } from "../../pipes/nameoverride.pipe";

const componentAnimations = [
  trigger("deathAnimation", [
    transition("true => false, true => void", [
      style({ filter: "grayscale(50%)" }),
      animate("100ms ease-in", style({ width: "0", opacity: 0.5, filter: "grayscale(100%)" })),
    ]),
    transition("false => true, void => true", [
      style({ filter: "grayscale(50%)", width: "0", opacity: 0.5 }),
      animate("250ms ease-out", style({ width: "*", opacity: 1, filter: "grayscale(0%)" })),
    ]),
  ]),
  trigger("ultImageAnimation", [
    transition(":enter", [
      style({ opacity: 0, position: "absolute" }),
      animate("150ms", style({ opacity: 1 })),
    ]),
    transition(":leave", [
      style({ opacity: 1, position: "absolute" }),
      animate("150ms", style({ opacity: 0 })),
    ]),
  ]),
  trigger("healthChange", [
    transition("* <=> *", [
      style({ opacity: "0", filter: "brightness(80%)" }),
      animate("200ms", style({ opacity: "1" })),
    ]),
  ]),
  trigger("creditsDeathAnimation", [
    transition("false => true", [
      group([
        animate(
          "80ms cubic-bezier(0.4,0,0.2,1)",
          style({ transform: "translateY(52px)" })
        ),
        animate(
          "80ms cubic-bezier(0.4,0,0.2,1)",
          style({ opacity: 1 })
        ),
      ]),
      animate(
        "120ms cubic-bezier(0.4,0,0.2,1)",
        style({ transform: "translateY(52px) translateX(-140px)" })
      ),
      // Keep the final transform after animation
      style({ transform: "translateY(52px) translateX(-140px)" }),
    ]),
    transition("true => false", [
      // Animate back to original position
      animate(
        "120ms cubic-bezier(0.4,0,0.2,1)",
        style({ transform: "translateY(52px)" })
      ),
      animate(
        "80ms cubic-bezier(0.4,0,0.2,1)",
        style({ transform: "none" })
      ),
      // Ensure the transform is reset
      style({ transform: "none" }),
    ]),
  ]),
  trigger("kdaDeathAnimation", [
    transition(":enter", [
      style({
        opacity: 0,
        transform: "translateX(0px)",
      }),
      animate(
        "100ms 120ms cubic-bezier(0.4, 0, 0.2, 1)",
        style({
          opacity: 1,
          transform: "translateX(-40px)",
        })
      ),
    ]),
  ]),
  trigger("spectatorBoxGrow", [
    transition("void => true", [
      style({ width: 0 }),
      animate("80ms cubic-bezier(0.4,0,0.2,1)", style({ width: 25 })),
    ]),
    transition("true => void", [
      animate("80ms cubic-bezier(0.4,0,0.2,1)", style({ width: 0 })),
    ]),
  ]),
  trigger("spectatorIconFade", [
    transition(":enter", [
      style({ opacity: 0 }),
      animate("100ms cubic-bezier(0.4,0,0.2,1)", style({ opacity: 1 })),
    ]),
    transition(":leave", [
      animate("80ms cubic-bezier(0.4,0,0.2,1)", style({ opacity: 0 })),
    ]),
  ]),
];

@Component({
  selector: "app-playercard",
  standalone: true,
  templateUrl: "./playercard.component.html",
  styleUrls: ["./playercard.component.scss"],
  animations: componentAnimations,
  imports: [
    CommonModule,
    NgIf,
    NgFor,
    AbilitiesComponent,
    ShieldIconComponent,
    UltimateComponent,
    NameoverridePipe
  ],
})
export class InhouseTrackerPlayercardComponent {
  public readonly assets: string = "../../../assets";

  @Input() match!: any;
  @Input() color!: "attacker" | "defender";
  @Input() side!: "left" | "right";
  @Input() hideAuxiliary = false;

  private _player: any;

  constructor(private config: Config) {}

  @Input()
  set player(player: any) {
    this._player = player;
  }

  get spectatorBoxWidth() {
    return this.player?.isObserved ? 35 : 0;
  }

  get player() {
    return this._player;
  }

  get showAssistCounts() {
    return this.match.teams.findIndex((e: any) => e.hasDuplicateAgents) == -1;
  }

  get colorHex() {
    return this.color == "attacker"
      ? this.config.attackerColorShieldCurrency
      : this.config.defenderColorShieldCurrency;
  }

  numSequence(n: number): number[] {
    return Array(n);
  }

  capitalizeColor(s: string) {
    return s[0].toUpperCase() + s.substring(1);
  }

  getAgentName(agent: string) {
    return AgentNameService.getAgentName(agent);
  }

  clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  getOverrideNames(): Map<string, string> {
    let toReturn = this.match?.tools?.nameOverrides?.overrides;
    if (!toReturn) {
      toReturn = new Map<string, string>();
    }
    return toReturn;
  }
}

@Component({
  selector: "app-playercard-minimal",
  standalone: true,
  templateUrl: "./playercard-minimal.component.html",
  styleUrls: ["./playercard.component.scss"],
  animations: componentAnimations,
  imports: [CommonModule, NgIf, NameoverridePipe],
})
export class InhouseTrackerPlayercardMinimalComponent extends InhouseTrackerPlayercardComponent {}
