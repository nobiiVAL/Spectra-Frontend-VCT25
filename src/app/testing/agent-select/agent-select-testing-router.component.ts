import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AgentSelectTestingComponent } from './agent-select-testing';
import { AgentSelectV2TestingComponent } from './v2/agent-select-v2.testing';
import { NgIf } from '@angular/common';

@Component({
  selector: 'app-agent-select-testing-router',
  template: `
    <app-agent-select-testing *ngIf="useLegacy"></app-agent-select-testing>
    <app-agent-select-v2-testing *ngIf="!useLegacy"></app-agent-select-v2-testing>
  `,
  standalone: true,
  imports: [NgIf, AgentSelectTestingComponent, AgentSelectV2TestingComponent]
})
export class AgentSelectTestingRouterComponent implements OnInit {
  useLegacy = false;

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      // Check if legacy flag is present (regardless of value)
      this.useLegacy = params.hasOwnProperty('legacy');
    });
  }
}
