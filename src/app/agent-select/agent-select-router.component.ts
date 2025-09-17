import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AgentSelectComponent } from './agent-select.component';
import { AgentSelectV2Component } from './v2/agent-select-v2.component';
import { NgIf } from '@angular/common';

@Component({
  selector: 'app-agent-select-router',
  template: `
    <app-agent-select *ngIf="useLegacy"></app-agent-select>
    <app-agent-select-v2 *ngIf="!useLegacy"></app-agent-select-v2>
  `,
  standalone: true,
  imports: [NgIf, AgentSelectComponent, AgentSelectV2Component]
})
export class AgentSelectRouterComponent implements OnInit {
  useLegacy = false;

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      // Check if legacy flag is present (regardless of value)
      this.useLegacy = params.hasOwnProperty('legacy');
    });
  }
}
