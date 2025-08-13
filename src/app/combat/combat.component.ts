import { Component, Input, OnChanges, SimpleChanges } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { trigger, transition, style, animate } from "@angular/animations";
import { NgIf, NgFor } from "@angular/common";
import {
  InhouseTrackerPlayercardComponent,
  InhouseTrackerPlayercardMinimalComponent,
} from "./playercard/playercard.component";

@Component({
  selector: "app-combat",
  standalone: true,
  templateUrl: "./combat.component.html",
  styleUrls: ["./combat.component.scss"],
  imports: [
    NgIf,
    NgFor,
    InhouseTrackerPlayercardComponent,
    InhouseTrackerPlayercardMinimalComponent,
  ],
  animations: [
    trigger("slideInLeft", [
      transition("void => in", [
        style({ transform: "translateX(-100vw)", opacity: 0 }),
        animate("300ms cubic-bezier(0.4,0,0.2,1)", style({ transform: "translateX(0)", opacity: 1 })),
      ]),
      transition("in => out", [
        animate("300ms cubic-bezier(0.4,0,0.2,1)", style({ transform: "translateX(-100vw)", opacity: 0 })),
      ]),
      transition("static => out", [
        animate("300ms cubic-bezier(0.4,0,0.2,1)", style({ transform: "translateX(-100vw)", opacity: 0 })),
      ]),
      // No animation for static state
    ]),
    trigger("slideInRight", [
      transition("void => in", [
        style({ transform: "translateX(100vw)", opacity: 0 }),
        animate("300ms cubic-bezier(0.4,0,0.2,1)", style({ transform: "translateX(0)", opacity: 1 })),
      ]),
      transition("in => out", [
        animate("300ms cubic-bezier(0.4,0,0.2,1)", style({ transform: "translateX(100vw)", opacity: 0 })),
      ]),
      transition("static => out", [
        animate("300ms cubic-bezier(0.4,0,0.2,1)", style({ transform: "translateX(100vw)", opacity: 0 })),
      ]),
      // No animation for static state
    ]),
  ],
})
export class CombatComponent implements OnChanges {
  @Input() match!: any;
  @Input() hideAuxiliary = false;
  @Input() roundPhase!: string;
  hidePlayercards = false;

  constructor(private route: ActivatedRoute) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes["roundPhase"] && changes["roundPhase"].currentValue === "combat") {
      this.hidePlayercards = false;
    }
  }

  onAnimationDone(event: any) {
    if (event.toState === 'out') {
      this.hidePlayercards = true;
    }
    if (event.toState === 'in') {
      this.hidePlayercards = false;
    }
  }

  get playercardAnimationState(): string {
    if (this.roundPhase === "combat") {
      return "in";
    }
    if (this.roundPhase === "shopping") {
      return "out";
    }
    return "static";
  }

  isMinimal(): boolean {
    if (this.route.snapshot.data["minimal"]) {
      return this.route.snapshot.data["minimal"];
    } else {
      return false;
    }
  }

  trackByPlayerId(index: number, player: any) {
    return player.playerId;
  }

  numSequence(n: number): number[] {
    return Array(n);
  }
}
