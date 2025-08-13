import { Component, OnInit, ViewChild, AfterViewInit } from "@angular/core";
import { AgentSelectComponent } from "../../agent-select/agent-select.component";

@Component({
  selector: "app-agent-select-testing",
  imports: [AgentSelectComponent],
  template: `
    <div class="testing-controls">
      <div>
        <h3>Team 1</h3>
        <button class="dark-btn" (click)="addPlayer(0)" [disabled]="teamPlayers(0).length >= 5">Add Player</button>
        <button class="dark-btn" (click)="removePlayer(0)" [disabled]="teamPlayers(0).length === 0">Remove Player</button>
      </div>
      <div>
        <h3>Team 2</h3>
        <button class="dark-btn" (click)="addPlayer(1)" [disabled]="teamPlayers(1).length >= 5">Add Player</button>
        <button class="dark-btn" (click)="removePlayer(1)" [disabled]="teamPlayers(1).length === 0">Remove Player</button>
      </div>
      <button class="dark-btn" id="randomize" (click)="randomizeAgents()">Randomize Agents</button>
      <button class="dark-btn" id="fillAll" (click)="fillAllAgents()">Fill all agents</button>
      <button class="dark-btn" id="removeAll" (click)="removeAllPlayers()">Remove all players</button>
    </div>
    <div class="agent-select-animation">
      <app-agent-select></app-agent-select>
    </div>
  `,
  styles: [`
    .testing-controls {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      z-index: 100;
      background: rgba(34,34,34,0.85);
      padding: 12px 0 8px 12px;
      display: flex;
      flex-direction: row;
      gap: 32px;
      align-items: flex-start;
    }
    .testing-controls h3 {
      margin: 0 0 4px 0;
    }
    .dark-btn {
      background: #222;
      color: #fff;
      border: 1px solid #444;
      border-radius: 4px;
      padding: 6px 14px;
      margin: 2px 2px 8px 0;
      font-family: Montserrat, Helvetica, Arial, sans-serif;
      font-size: 1em;
      cursor: pointer;
    }
    #randomize {
      @extend .dark-btn;
      transform: translateY(10px);
    }
    #fillAll {
      @extend .dark-btn;
      transform: translateY(10px);
    }
    #removeAll {
      @extend .dark-btn;
      transform: translateY(10px);
    }
    .dark-btn:disabled {
      background: #444;
      color: #bbb;
      cursor: not-allowed;
    }
    .agent-select-animation {
      width: 100vw;
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      /* The canvas from AgentSelectComponent will be centered */
    }
  `]
})
export class AgentSelectTestingComponent implements OnInit, AfterViewInit {
  @ViewChild(AgentSelectComponent) agentSelectComponent!: AgentSelectComponent;

  readonly agentList = [
    "Wushu", "Pandemic", "Hunter", "Phoenix", "Thorne",
    "Sarge", "Gumshoe", "Vampire", "Killjoy", "Breach"
  ];

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    this.agentSelectComponent.match = {
      groupCode: "T",
      isRanked: false,
      isRunning: true,
      roundNumber: 0,
      roundPhase: "LOBBY",
      teams: [
        {
          teamName: "The Naturals",
          teamTricode: "INT",
          teamUrl: "assets/misc/icon.webp",
          players: [],
          isAttacking: true
        },
        {
          teamName: "The Zoologists",
          teamTricode: "ZOO",
          teamUrl: "assets/misc/icon.webp",
          players: [],
          isAttacking: false
        }
      ],
      spikeState: { planted: false },
      map: "Pearl",
      tools: { seriesInfo: { needed: 3, wonLeft: 2, wonRight: 2, mapInfo: [] } }
    };
    this.fillAllAgents();
  }

  teamPlayers(teamIndex: number) {
    return this.agentSelectComponent?.match?.teams?.[teamIndex]?.players || [];
  }

  addPlayer(teamIndex: number) {
    const team = this.agentSelectComponent.match.teams[teamIndex];
    if (team.players.length >= 5) return;

    // Find available agents for this team
    const usedAgents = new Set(team.players.map((p: any) => p.agentInternal));
    const availableAgents = this.agentList.filter(a => !usedAgents.has(a));
    const agentInternal = availableAgents[0] || this.agentList[0];

    const player = {
      playerId: Math.random().toString(36).substring(2),
      agentInternal,
      name: `Player ${teamIndex + 1}-${team.players.length + 1}`,
      locked: true
    };
    team.players.push(player);
    this.agentSelectComponent.updateMatch(this.agentSelectComponent.match);
  }

  removePlayer(teamIndex: number) {
    const team = this.agentSelectComponent.match.teams[teamIndex];
    if (team.players.length > 0) {
      team.players.pop();
      this.agentSelectComponent.updateMatch(this.agentSelectComponent.match);
    }
  }

  randomizeAgents() {
    for (let t = 0; t < 2; t++) {
      const team = this.agentSelectComponent.match.teams[t];
      const shuffled = [...this.agentList].sort(() => Math.random() - 0.5);
      for (let i = 0; i < team.players.length; i++) {
        team.players[i].agentInternal = shuffled[i % shuffled.length];
      }
    }
    this.agentSelectComponent.updateMatch(this.agentSelectComponent.match);
  }

  fillAllAgents() {
    // Shuffle agents and assign 5 to each team
    const shuffled = [...this.agentList].sort(() => Math.random() - 0.5);
    for (let t = 0; t < 2; t++) {
      const team = this.agentSelectComponent.match.teams[t];
      team.players = [];
      for (let i = 0; i < 5; i++) {
        team.players.push({
          playerId: Math.random().toString(36).substring(2),
          agentInternal: shuffled[t * 5 + i],
          name: `Player ${t + 1}-${i + 1}`,
          locked: true
        });
      }
    }
    this.agentSelectComponent.updateMatch(this.agentSelectComponent.match);
  }

  removeAllPlayers() {
    for (let t = 0; t < 2; t++) {
      this.agentSelectComponent.match.teams[t].players = [];
    }
    this.agentSelectComponent.updateMatch(this.agentSelectComponent.match);
  }
}