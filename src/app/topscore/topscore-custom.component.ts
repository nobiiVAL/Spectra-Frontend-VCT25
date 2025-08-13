import { animate, style, transition, trigger, state } from "@angular/animations";
import { Component, Input, SimpleChanges, OnChanges } from "@angular/core";
import { NgIf } from "@angular/common";

@Component({
  selector: "app-topscore",
  standalone: true,
  templateUrl: "./topscore-custom.component.html",
  styleUrls: ["./topscore-custom.component.scss"],
  animations: [
    trigger("spikeMoveUp", [
      state('*', style({
        transform: 'translateY(6px) scale(1.25)', // Final Y scaled up by 30%
        opacity: 1
      })),
      transition(':enter', [ 
        style({
          transform: 'translateY(84px) scale(1)', 
          opacity: 1 
        }),
        animate('500ms cubic-bezier(0.4, 0, 0.2, 1)')
      ]),
      transition(':leave', [ 
        animate('300ms ease-out', style({ opacity: 0 }))
      ]),
    ]),
  ],
  imports: [NgIf],
})
export class TopscoreComponent implements OnChanges {
  @Input() match!: any;

  spikePlanted = false;
  blinkState = false;

  detonationTime = 0;
  lastActedTime = 9999;
  blinkInterval: any = undefined;

  ngOnChanges(changes: SimpleChanges) {
    if (changes["match"]) {
      const match = changes["match"].currentValue;
      if (match["spikeState"]["planted"] != this.spikePlanted) {
        this.spikePlanted = match["spikeState"]["planted"];

        if (this.spikePlanted) {
          this.detonationTime = match["spikeDetonationTime"];
          this.blinkState = false;
          this.lastActedTime = 9999;
          this.initSpikeBlink();
        } else {
          clearInterval(this.blinkInterval);
          this.blinkState = false;
        }
      }
    }
  }

  initSpikeBlink() {
    this.blinkInterval = setInterval(() => {
      const timeLeft = (this.detonationTime - Date.now()) / 1000;
      if (timeLeft > 20) {
        if (this.lastActedTime >= timeLeft + 0.95) {
          this.blinkState = !this.blinkState;
          this.lastActedTime = timeLeft;
        }
      } else if (timeLeft > 10) {
        if (this.lastActedTime >= timeLeft + 0.45) {
          this.blinkState = !this.blinkState;
          this.lastActedTime = timeLeft;
        }
      } else if (timeLeft > 5) {
        if (this.lastActedTime >= timeLeft + 0.275) {
          this.blinkState = !this.blinkState;
          this.lastActedTime = timeLeft;
        }
      } else if (timeLeft > 0) {
        if (this.lastActedTime >= timeLeft + 0.125) {
          this.blinkState = !this.blinkState;
          this.lastActedTime = timeLeft;
        }
      } else {
        clearInterval(this.blinkInterval);
        this.blinkState = true;
      }
    }, 25);
  }
}
