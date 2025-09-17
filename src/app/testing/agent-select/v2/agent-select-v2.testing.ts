import { Component, OnInit, ViewChild, AfterViewInit } from "@angular/core";
import { AgentSelectV2Component } from "../../../agent-select/v2/agent-select-v2.component";
import { NgFor, NgIf } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { AgentRoleService } from "../../../services/agentRole.service";
import { AgentNameService } from "../../../services/agentName.service";

@Component({
  selector: "app-agent-select-v2-testing",
  standalone: true,
  imports: [AgentSelectV2Component, NgFor, NgIf, FormsModule],
  templateUrl: "./agent-select-v2.testing.html",
  styleUrls: ["./agent-select-v2.testing.scss"]
})
export class AgentSelectV2TestingComponent implements OnInit, AfterViewInit {
  @ViewChild(AgentSelectV2Component) agentSelectComponent!: AgentSelectV2Component;

  readonly agentList = [
    "Aggrobot", "BountyHunter", "Breach", "Cable", "Cashew", "Clay", 
    "Deadeye", "Grenadier", "Guide", "Gumshoe", "Hunter", "Killjoy", 
    "Mage", "Nox", "Pandemic", "Phoenix", "Rift", "Sarge", "Sequoia", 
    "Smonk", "Sprinter", "Stealth", "Terra", "Thorne", "Vampire", 
    "Wraith", "Wushu"
  ];

  // Player controls
  players: Array<{
    id: number;
    teamIndex: number;
    playerIndex: number;
    name: string;
    selectedAgent: string;
    locked: boolean;
  }> = [];

  // Timer simulation
  isTimerActive: boolean = false;

  ngOnInit(): void {
    this.initializePlayers();
  }

  ngAfterViewInit(): void {
    // Initialize match data
    this.agentSelectComponent.match = {
      groupCode: "T",
      isRanked: false,
      isRunning: true,
      roundNumber: 0,
      roundPhase: "LOBBY",
      teams: [
        {
          teamName: "Team Alpha",
          teamTricode: "ALPH",
          teamUrl: "assets/misc/icon.webp",
          players: [],
          isAttacking: true
        },
        {
          teamName: "Team Beta",
          teamTricode: "BETA",
          teamUrl: "assets/misc/icon.webp", 
          players: [],
          isAttacking: false
        }
      ],
      spikeState: { planted: false },
      map: "Corrode",
      tools: {
        seriesInfo: { needed: 2, wonLeft: 1, wonRight: 0, mapInfo: [] },
        tournamentInfo: { logoUrl: "", name: "Agent Select V2 Testing" }
      }
    };

    // Apply initial player data
    this.applyPlayersToMatch();
    
    console.log("🎮 Agent Select V2 Testing initialized with predefined agents");
    console.log("📝 Use the dropdown menus to change agents for each player");
    console.log("🔒 Use the checkboxes to toggle lock states");
  }

  private initializePlayers(): void {
    this.players = [];
    
    // Predefined agent assignments for consistent testing
    const predefinedAgents = [
      // Team Alpha (Players 1-5)
      'Wushu',      // Player 1 - Jett equivalent
      'Phoenix',    // Player 2 - Phoenix
      'Sarge',      // Player 3 - Sova equivalent  
      'Clay',       // Player 4 - Sage equivalent
      'Killjoy',    // Player 5 - Killjoy
      
      // Team Beta (Players 6-10)
      'Vampire',    // Player 6 - Reyna equivalent
      'Breach',     // Player 7 - Breach
      'Smonk',      // Player 8 - Omen equivalent
      'Hunter',     // Player 9 - Cypher equivalent
      'Rift',       // Player 10 - Raze equivalent
    ];
    
    // Create 10 players (5 per team) with predefined agents
    for (let team = 0; team < 2; team++) {
      for (let player = 0; player < 5; player++) {
        const playerId = team * 5 + player + 1;
        const agentIndex = (team * 5) + player;
        
        this.players.push({
          id: playerId,
          teamIndex: team,
          playerIndex: player,
          name: `Player ${playerId}`,
          selectedAgent: predefinedAgents[agentIndex],
          locked: false
        });
      }
    }
    
    console.log("📋 Initial player agents assigned:");
    this.players.forEach(player => {
      console.log(`  Player ${player.id} (${player.name}): ${player.selectedAgent} [${player.locked ? 'Locked' : 'Unlocked'}]`);
    });
  }

  onAgentChange(playerId: number, newAgent: string): void {
    const player = this.players.find(p => p.id === playerId);
    if (player) {
      const oldAgent = player.selectedAgent;
      player.selectedAgent = newAgent;
      console.log(`🔄 Player ${player.id} agent changed: ${oldAgent} → ${newAgent}`);
      this.applyPlayersToMatch();
    }
  }

  onLockStateChange(playerId: number, event: Event): void {
    const checkbox = event.target as HTMLInputElement;
    const player = this.players.find(p => p.id === playerId);
    if (player) {
      const oldState = player.locked;
      player.locked = checkbox.checked;
      const newState = player.locked ? "Locked" : "Unlocked";
      const oldStateText = oldState ? "Locked" : "Unlocked";
      console.log(`🔒 Player ${player.id} lock state: ${oldStateText} → ${newState}`);
      this.applyPlayersToMatch();
    }
  }

  onAgentSelectChange(playerId: number, event: Event): void {
    const select = event.target as HTMLSelectElement;
    const player = this.players.find(p => p.id === playerId);
    if (player) {
      const oldAgent = player.selectedAgent;
      player.selectedAgent = select.value;
      console.log(`🎯 Player ${player.id} selected: ${oldAgent} → ${select.value}`);
      this.applyPlayersToMatch();
    }
  }

  private applyPlayersToMatch(): void {
    if (!this.agentSelectComponent?.match) return;

    // Clear existing players
    this.agentSelectComponent.match.teams[0].players = [];
    this.agentSelectComponent.match.teams[1].players = [];

    // Apply players to teams
    this.players.forEach(player => {
      const matchPlayer = {
        playerId: player.id.toString(),
        agentInternal: player.selectedAgent,
        name: player.name,
        fullName: player.name,
        locked: player.locked
      };

      this.agentSelectComponent.match.teams[player.teamIndex].players.push(matchPlayer);
    });

    // Update the component
    this.agentSelectComponent.updateMatch(this.agentSelectComponent.match);
  }

  // Utility methods
  randomizeAllAgents(): void {
    console.log("🎲 Randomizing all agent selections...");
    this.players.forEach(player => {
      const oldAgent = player.selectedAgent;
      player.selectedAgent = this.agentList[Math.floor(Math.random() * this.agentList.length)];
      console.log(`  Player ${player.id}: ${oldAgent} → ${player.selectedAgent}`);
    });
    this.applyPlayersToMatch();
    console.log("✅ Agent randomization complete");
  }

  lockAllPlayers(): void {
    console.log("🔒 Locking all players...");
    this.players.forEach(player => {
      player.locked = true;
    });
    this.applyPlayersToMatch();
    console.log("✅ All players locked");
  }

  unlockAllPlayers(): void {
    console.log("🔓 Unlocking all players...");
    this.players.forEach(player => {
      player.locked = false;
    });
    this.applyPlayersToMatch();
    console.log("✅ All players unlocked");
  }

  logCurrentAgents(): void {
    console.log("📋 Current agent assignments:");
    this.players.forEach(player => {
      const team = player.teamIndex === 0 ? "Alpha" : "Beta";
      const status = player.locked ? "🔒 Locked" : "🔓 Unlocked";
      const agentDisplayName = AgentNameService.getAgentName(player.selectedAgent);
      const role = AgentRoleService.getAgentRole(agentDisplayName);
      const roleIcon = this.getRoleIcon(role);
      console.log(`  Player ${player.id} (Team ${team}): ${player.selectedAgent} (${agentDisplayName}) ${roleIcon} ${role} ${status}`);
    });
  }

  private getRoleIcon(role: string): string {
    switch (role) {
      case 'Controller': return '🎮';
      case 'Duelist': return '⚔️';
      case 'Initiator': return '🚀';
      case 'Sentinel': return '🛡️';
      default: return '❓';
    }
  }

  // Timer simulation methods
  startTimer(): void {
    if (this.isTimerActive) {
      console.log("⚠️ Timer is already active");
      return;
    }

    console.log("🕐 Starting agent select timer simulation...");
    this.isTimerActive = true;
    
    // Set agent select start time to current time
    if (this.agentSelectComponent?.match) {
      this.agentSelectComponent.match.agentSelectStartTime = Date.now();
      this.agentSelectComponent.updateMatch(this.agentSelectComponent.match);
      console.log("✅ Agent select timer started - 95 seconds countdown");
    }
  }

  stopTimer(): void {
    if (!this.isTimerActive) {
      console.log("⚠️ Timer is not active");
      return;
    }

    console.log("⏹️ Stopping agent select timer simulation...");
    this.isTimerActive = false;
    
    // Remove agent select start time
    if (this.agentSelectComponent?.match) {
      delete this.agentSelectComponent.match.agentSelectStartTime;
      this.agentSelectComponent.updateMatch(this.agentSelectComponent.match);
      console.log("✅ Agent select timer stopped");
    }
  }

  resetTimer(): void {
    console.log("🔄 Resetting agent select timer...");
    this.stopTimer();
    setTimeout(() => {
      this.startTimer();
    }, 100);
  }

  setTimerTo(seconds: number): void {
    if (!this.isTimerActive) {
      console.log("⚠️ Start the timer first before setting a specific time");
      return;
    }

    console.log(`⏱️ Setting timer to ${seconds} seconds remaining...`);
    
    if (this.agentSelectComponent?.match) {
      // Calculate what the start time should be to have 'seconds' remaining
      const targetStartTime = Date.now() - ((95 - seconds) * 1000);
      this.agentSelectComponent.match.agentSelectStartTime = targetStartTime;
      this.agentSelectComponent.updateMatch(this.agentSelectComponent.match);
      console.log(`✅ Timer set to ${seconds} seconds remaining (smooth countdown enabled)`);
    }
  }

  setTimerToPrecise(seconds: number): void {
    if (!this.isTimerActive) {
      console.log("⚠️ Start the timer first before setting a specific time");
      return;
    }

    console.log(`⏱️ Setting timer to ${seconds.toFixed(3)} seconds remaining (precise)...`);
    
    if (this.agentSelectComponent?.match) {
      // Calculate what the start time should be to have exact 'seconds' remaining
      const targetStartTime = Date.now() - ((95 - seconds) * 1000);
      this.agentSelectComponent.match.agentSelectStartTime = targetStartTime;
      this.agentSelectComponent.updateMatch(this.agentSelectComponent.match);
      console.log(`✅ Timer set to ${seconds.toFixed(3)} seconds remaining`);
    }
  }

  // Test smooth countdown at critical moments
  testSmoothCountdown(): void {
    if (!this.isTimerActive) {
      this.startTimer();
      setTimeout(() => this.testSmoothCountdown(), 100);
      return;
    }

    console.log("🧪 Testing smooth countdown at critical moments...");
    
    // Test sequence: 10.5s → 5.3s → 3.7s → 1.1s → 0.5s
    const testSequence = [10.5, 5.3, 3.7, 1.1, 0.5];
    let index = 0;
    
    const runNextTest = () => {
      if (index < testSequence.length) {
        const time = testSequence[index];
        this.setTimerToPrecise(time);
        console.log(`📍 Test ${index + 1}/${testSequence.length}: Timer at ${time}s`);
        index++;
        setTimeout(runNextTest, 2000); // Wait 2 seconds between tests
      } else {
        console.log("✅ Smooth countdown test sequence completed");
      }
    };
    
    runNextTest();
  }

  // Role analysis methods
  logRoleDistribution(): void {
    console.log("🎭 Role distribution analysis:");
    
    const roleCount = { Controller: 0, Duelist: 0, Initiator: 0, Sentinel: 0 };
    const teamRoles = { Alpha: { Controller: 0, Duelist: 0, Initiator: 0, Sentinel: 0 }, Beta: { Controller: 0, Duelist: 0, Initiator: 0, Sentinel: 0 } };
    
    this.players.forEach(player => {
      const agentDisplayName = AgentNameService.getAgentName(player.selectedAgent);
      const role = AgentRoleService.getAgentRole(agentDisplayName);
      const team = player.teamIndex === 0 ? 'Alpha' : 'Beta';
      
      if (role && roleCount.hasOwnProperty(role)) {
        roleCount[role as keyof typeof roleCount]++;
        teamRoles[team as keyof typeof teamRoles][role as keyof typeof roleCount]++;
      }
    });
    
    console.log("  Overall:");
    Object.entries(roleCount).forEach(([role, count]) => {
      const icon = this.getRoleIcon(role);
      console.log(`    ${icon} ${role}: ${count} players`);
    });
    
    console.log("  Team Alpha:");
    Object.entries(teamRoles.Alpha).forEach(([role, count]) => {
      const icon = this.getRoleIcon(role);
      console.log(`    ${icon} ${role}: ${count} players`);
    });
    
    console.log("  Team Beta:");
    Object.entries(teamRoles.Beta).forEach(([role, count]) => {
      const icon = this.getRoleIcon(role);
      console.log(`    ${icon} ${role}: ${count} players`);
    });
  }

  // Debug method to show name mappings
  logNameMappings(): void {
    console.log("🔄 Agent name mappings (Internal → Display → Role):");
    this.agentList.forEach(internalName => {
      const displayName = AgentNameService.getAgentName(internalName);
      const role = AgentRoleService.getAgentRole(displayName);
      const roleIcon = this.getRoleIcon(role);
      console.log(`  ${internalName} → ${displayName} → ${roleIcon} ${role}`);
    });
  }

  getTeamPlayers(teamIndex: number) {
    return this.players.filter(p => p.teamIndex === teamIndex);
  }
}