import { Component, Input } from "@angular/core";
import { NgIf, NgFor, SlicePipe, NgStyle, NgClass } from "@angular/common";

interface recordType {
  type: string;
  wasAttack: boolean;
  round: number;
}

interface matchType {
  switchRound: number;
  firstOtRound: number;
  roundNumber: number;
  teams: [
    {
      teamTricode: string;
      roundRecord: recordType[];
      roundsWon: number;
      isAttacking: boolean;
    },
    {
      teamTricode: string;
      roundRecord: recordType[];
      roundsWon: number;
      isAttacking: boolean;
    },
  ];
}

@Component({
  selector: "app-roundreasons",
  standalone: true,
  templateUrl: "./roundreasons.component.html",
  styleUrls: ["./roundreasons.component.scss"],
  imports: [NgIf, NgFor, SlicePipe, NgStyle, NgClass],
})
export class RoundreasonsComponent {
  @Input() match!: matchType;
  public readonly assets: string = "../../../assets";

  public readonly roundRecordLength: number = 14;

  getReasonStartIndex(): number {
    return this.match.roundNumber < this.roundRecordLength
      ? 0
      : this.match.roundNumber - this.roundRecordLength;
  }
}
