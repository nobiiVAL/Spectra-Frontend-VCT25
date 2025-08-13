import { Component, Input, OnChanges } from "@angular/core";
import { CommonModule } from "@angular/common";

@Component({
  selector: "app-mapinfo",
  templateUrl: "./mapinfo.component.html",
  styleUrls: ["./mapinfo.component.scss"],
  imports: [CommonModule],
})
export class MapinfoComponent implements OnChanges {
  @Input() map!: string;
  @Input() mapinfo!: any;
  @Input() isDecider!: boolean;
  @Input() slotType!: 'past' | 'present' | 'future';
  type: "past" | "present" | "future" = "future";

  ngOnChanges(): void {
    this.type = this.mapinfo.type;
  }
}
