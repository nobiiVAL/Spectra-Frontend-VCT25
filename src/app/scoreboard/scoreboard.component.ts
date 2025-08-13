import { Component, Input, OnChanges, SimpleChanges, Pipe, PipeTransform, forwardRef } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { trigger, transition, style, animate } from '@angular/animations';
import { NgIf, NgFor, SlicePipe } from "@angular/common";
import { RoundreasonsComponent } from "./roundreasons/roundreasons.component";
import {
  PlayerscoreComponent,
  PlayerscoreMinimalComponent,
} from "./playerscore/playerscore.component";

@Component({
  selector: "app-scoreboard",
  standalone: true,
  templateUrl: "./scoreboard.component.html",
  styleUrls: ["./scoreboard.component.scss"],
  imports: [
    NgIf,
    NgFor,
    SlicePipe,
    RoundreasonsComponent,
    PlayerscoreComponent,
    PlayerscoreMinimalComponent,
    forwardRef(() => ScoreboardOrderPipe),
  ],
  animations: [
    trigger("slideUpDown", [
      transition(":enter", [
        style({ transform: "translateY(100vh)", opacity: 0 }),
        animate("400ms cubic-bezier(0.4,0,0.2,1)", style({ transform: "translateY(0)", opacity: 1 })),
      ]),
      transition(":leave", [
        animate("400ms cubic-bezier(0.4,0,0.2,1)", style({ transform: "translateY(100vh)", opacity: 0 })),
      ]),
    ]),
  ],
})
export class ScoreboardComponent implements OnChanges {
  @Input() roundPhase!: string;
  @Input() match!: any;
  @Input() player!: any;
  @Input() hideAuxiliary = false;

  showScoreboard = false;

  constructor(private route: ActivatedRoute) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes["roundPhase"] && changes["roundPhase"].currentValue === "shopping") {
      this.showScoreboard = true;
    }
  }

  onAnimationDone(event: any) {
    if (event.toState === "void" || event.toState === "out") {
      this.showScoreboard = false;
    }
  }

  get scoreboardAnimationState(): string {
    return this.roundPhase === "shopping" ? "in" : "out";
  }

  isMinimal(): boolean {
    if (this.route.snapshot.data["minimal"]) {
      return this.route.snapshot.data["minimal"];
    } else {
      return false;
    }
  }

  get showAuxScoreboard(): boolean {
    // Returns true if at least one player has auxiliary abilities and hideAuxiliary is false
    return (
      !this.hideAuxiliary &&
      (
        this.match.teams[0].players.some((p: any) => p.auxiliaryAvailable?.abilities) ||
        this.match.teams[1].players.some((p: any) => p.auxiliaryAvailable?.abilities)
      )
    );
  }

  get numPlayersWithoutAbilities(): number {
    return [
      ...this.match.teams[0].players,
      ...this.match.teams[1].players,
    ].filter((p: any) => !p.auxiliaryAvailable?.abilities).length;
  }

  get totalPlayers(): number {
    return this.match.teams[0].players.length + this.match.teams[1].players.length;
  }

  trackByPlayerId(index: number, player: any) {
    return player.playerId;
  }

  numSequence(n: number): number[] {
    return Array(n);
  }
}

@Pipe({ name: "scoreboardOrder" })
export class ScoreboardOrderPipe implements PipeTransform {
  transform(players: any[]): any[] {
    if (!Array.isArray(players)) return [];
    return [...players].sort((a: any, b: any) => {
      if (a.kills < b.kills) return 1;
      if (a.kills > b.kills) return -1;
      return 0;
    });
  }
}