import { Component, inject, Input, OnChanges, OnInit, SimpleChanges, ViewChild, ElementRef, AfterViewInit, OnDestroy } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { SocketService } from "../services/SocketService";
import { Config } from "../shared/config";
import { RiveMapbanService, MapbanAssets, SponsorInfo, MapState, TeamInfo, SideSelection } from "../services/rive-mapban.service";
import { CommonModule } from "@angular/common";

@Component({
  standalone: true,
  imports: [CommonModule],
  selector: "app-mapban-ui",
  template: `
    <div class="mapban-container">
      <canvas #riveCanvas class="mapban-canvas"></canvas>
    </div>
  `,
  styles: [`
    .mapban-container {
      width: 100vw;
      height: 100vh;
      position: relative;
      overflow: hidden;
    }
    
    .mapban-canvas {
      width: 100%;
      height: 100%;
      display: block;
    }
  `]
})
export class MapbanUiComponent implements OnInit, AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('riveCanvas', { static: true }) riveCanvas!: ElementRef<HTMLCanvasElement>;
  
  private route = inject(ActivatedRoute);
  private config = inject(Config);
  @Input() data!: ISessionData;

  sessionCode = "UNKNOWN";
  socketService!: SocketService;

  // Rive mapban service
  private riveService = inject(RiveMapbanService);
  
  // Asset preloading
  private preloadedAssets: Map<string, Uint8Array> = new Map();
  private isPreloadingComplete = false;
  
  // Match data for assets
  private match: any = null;  
  // Track Rive initialization status
  private isRiveInitialized = false;
  private pendingDataUpdate: { data: ISessionData } | null = null;

  constructor() {
    const params = this.route.snapshot.queryParams;
    this.sessionCode = params["sessionId"] || "UNKNOWN";
  }

  ngOnInit(): void {
    this.socketService = SocketService.getInstance();
    this.socketService.subscribeMapban((data: any) => {
      this.updateMapbanData(data);
    });
    this.socketService.connectMapban(this.config.mapbanEndpoint, {
      sessionId: this.sessionCode,
    });
  }

  ngAfterViewInit(): void {
    this.socketService.subscribeMatch((data: any) => {
      // Store match data for asset loading
      this.match = data;
      this.updateMapbanData(data);
    });
    
    // Initialize Rive animation after view is ready
    this.initializeRiveAnimation();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["data"] && changes["data"].currentValue) {
      this.updateMapbanData({ data: changes["data"].currentValue });
    }
  }

  ngOnDestroy(): void {
    this.riveService.cleanup();
  }

  private async initializeRiveAnimation(): Promise<void> {
    try {
      // Preload all assets first for performance
      await this.preloadAllAssets();
      
      // Set up initial mapban assets
      const assets = this.buildMapbanAssets();
      
      // Initialize Rive with preloaded assets
      await this.riveService.initializeRiveMapban(
        this.riveCanvas.nativeElement,
        assets,
        undefined,
        this.preloadedAssets
      );
      
      console.log('🎬 Rive mapban animation initialized');
      this.isRiveInitialized = true;
      
      // Process any pending data updates
      if (this.pendingDataUpdate) {
        console.log('🔄 Processing pending data update after Rive initialization');
        this.updateMapbanData(this.pendingDataUpdate);
        this.pendingDataUpdate = null;
      }
    } catch (error) {
      console.error('Failed to initialize Rive mapban animation:', error);
    }
  }

  private async preloadAllAssets(): Promise<void> {
    if (this.isPreloadingComplete) return;
    
    console.log('🔄 Starting asset preloading for mapban...');
    
    const assetsToPreload: string[] = [];
    
    // Add default assets
    assetsToPreload.push('/assets/misc/logo.webp'); // Default sponsor/event logo
    
    // Add team logos if available from match data
    if (this.match?.teams) {
      for (let i = 0; i < this.match.teams.length; i++) {
        const teamUrl = this.getProxiedImageUrl(this.match.teams[i]?.teamUrl);
        if (teamUrl && teamUrl !== '/assets/misc/icon.webp') {
          assetsToPreload.push(teamUrl);
        }
      }
    }
    
    // Add tournament logo if available
    const tournamentLogoUrl = this.getProxiedImageUrl(this.match?.tools?.tournamentInfo?.logoUrl);
    if (tournamentLogoUrl && tournamentLogoUrl !== '/assets/misc/icon.webp') {
      assetsToPreload.push(tournamentLogoUrl);
    }
    
    // Add map images - comprehensive list to cover all possible maps
    const mapAssets = [
      '/assets/maps/wide/Ascent.webp',
      '/assets/maps/wide/Bind.webp',
      '/assets/maps/wide/Haven.webp',
      '/assets/maps/wide/Split.webp',
      '/assets/maps/wide/Lotus.webp',
      '/assets/maps/wide/Sunset.webp',
      '/assets/maps/wide/Icebox.webp',
      '/assets/maps/wide/Breeze.webp',
      '/assets/maps/wide/Fracture.webp',
      '/assets/maps/wide/Pearl.webp',
      '/assets/maps/wide/Abyss.webp',
      '/assets/maps/wide/Corrode.webp'
    ];
    assetsToPreload.push(...mapAssets);
    
    // Preload all assets in parallel
    const preloadPromises = assetsToPreload.map(async (url) => {
      try {
        const processedData = await this.riveService.preloadAndProcessAsset(url);
        this.preloadedAssets.set(url, processedData);
        console.log(`✅ Preloaded: ${url}`);
      } catch (error) {
        console.warn(`⚠️ Failed to preload: ${url}`, error);
      }
    });
    
    await Promise.all(preloadPromises);
    this.isPreloadingComplete = true;
    console.log('🎯 Asset preloading complete');
  }

  private buildMapbanAssets(): MapbanAssets {
    const assets: MapbanAssets = {
      // Event/tournament logo
      eventLogo: this.getProxiedImageUrl(this.match?.tools?.tournamentInfo?.logoUrl) || '/assets/misc/icon.webp',
      
      // Team logos
      t1_logo: this.getProxiedImageUrl(this.match?.teams?.[0]?.teamUrl) || '/assets/misc/icon.webp',
      t2_logo: this.getProxiedImageUrl(this.match?.teams?.[1]?.teamUrl) || '/assets/misc/icon.webp',
      
      // Sponsor (can use tournament logo or default)
      sponsor: this.getProxiedImageUrl(this.match?.tools?.tournamentInfo?.logoUrl) || '/assets/misc/icon.webp',
      
      // Start with default map assets
      map_1: '/assets/maps/wide/Ascent.webp',
      map_2: '/assets/maps/wide/Bind.webp',
      map_3: '/assets/maps/wide/Haven.webp',
      map_4: '/assets/maps/wide/Split.webp',
      map_5: '/assets/maps/wide/Lotus.webp',
      map_6: '/assets/maps/wide/Sunset.webp',
      map_7: '/assets/maps/wide/Icebox.webp'
    };

    // Only build dynamic map assets if we have selectedMaps data with valid names
    if (!this.data?.selectedMaps || this.data.selectedMaps.length === 0) {
      console.log('⚠️ No selectedMaps data available, using default map assets');
      return assets;
    }

    // Filter out maps that don't have valid names
    const validMaps = this.data.selectedMaps.filter(map => 
      map && map.name && typeof map.name === 'string' && map.name.trim() !== ''
    );
    
    if (validMaps.length === 0) {
      console.log('⚠️ No maps with valid names found, using default map assets');
      return assets;
    }

    console.log('🗺️ Building dynamic map assets from selectedMaps:', validMaps.map(map => ({
      name: map.name,
      bannedBy: map.bannedBy,
      pickedBy: map.pickedBy
    })));

    // For mapban-ui, we use a different order than mapban-fs
    // This component has its own layout structure, so we assign maps sequentially
    // based on the chronological order from selectedMaps
    validMaps.forEach((map, index) => {
      if (map.name && index < 7) { // Only process up to 7 maps
        const mapKey = `map_${index + 1}` as keyof MapbanAssets;
        assets[mapKey] = `/assets/maps/wide/${map.name}.webp`;
        console.log(`🗺️ Map ${index + 1}: ${map.name} -> ${assets[mapKey]} (${map.bannedBy !== undefined ? 'banned' : map.pickedBy !== undefined ? 'picked' : 'neutral'})`);
      }
    });

    console.log('✅ Dynamic map assets built for mapban-ui:', {
      totalValidMaps: validMaps.length,
      mapAssets: {
        map_1: assets.map_1,
        map_2: assets.map_2,
        map_3: assets.map_3,
        map_4: assets.map_4,
        map_5: assets.map_5,
        map_6: assets.map_6,
        map_7: assets.map_7
      }
    });
    
    return assets;
  }

  private getProxiedImageUrl(url?: string): string | undefined {
    if (!url || url === '') return undefined;
    
    // If it's already a local asset or proxy URL, return as-is
    if (url.startsWith('/assets/') || url.startsWith('/proxy-image')) {
      return url;
    }
    
    // If it's an external URL, proxy it
    if (/^https?:\/\//.test(url)) {
      return `/proxy-image?url=${encodeURIComponent(url)}`;
    }
    
    return url;
  }

  public updateMapbanData(data: { data: ISessionData }): void {
    this.data = data.data;
    console.log('🔄 Mapban data updated:', this.data);
    
    // Check if Rive is initialized before updating animation
    if (!this.isRiveInitialized) {
      console.log('⏳ Rive not initialized yet, storing data for later processing');
      this.pendingDataUpdate = data;
      return;
    }
    
    // Update Rive animation based on the data
    this.updateRiveAnimation();
  }

  private updateRiveAnimation(): void {
    if (!this.data) {
      console.log('⏸️ No data available for Rive animation update');
      return;
    }

    if (!this.riveService.getRive()) {
      console.log('⚠️ Rive service not available, skipping update');
      return;
    }

    console.log('🎬 Updating Rive animation with data:', {
      hasTeams: !!this.data.teams,
      teamCount: this.data.teams?.length || 0,
      hasSelectedMaps: !!this.data.selectedMaps,
      selectedMapsCount: this.data.selectedMaps?.length || 0,
      format: this.data.format
    });
    
    // Set team information
    if (this.data.teams) {
      for (let i = 0; i < this.data.teams.length; i++) {
        const teamInfo: TeamInfo = {
          tricode: this.data.teams[i].tricode || 'TEAM',
          name: this.data.teams[i].name || 'Team Name'
        };
        this.riveService.setTeamInfo(i, teamInfo);
        console.log(`👥 Set team ${i} info:`, teamInfo);
      }
    }
    
    // Process map states from selected maps
    if (this.data.selectedMaps) {
      console.log('🗺️ Processing selectedMaps:', this.data.selectedMaps.map((map, idx) => ({
        index: idx,
        name: map.name,
        bannedBy: map.bannedBy,
        pickedBy: map.pickedBy,
        sidePickedBy: map.sidePickedBy,
        pickedAttack: map.pickedAttack
      })));

      const mapStates: MapState[] = [];
      
      this.data.selectedMaps.forEach((sessionMap, index) => {
        const mapNumber = index + 1;
        const mapState: MapState = {
          mapNumber,
          isBanned: sessionMap.bannedBy !== undefined,
          isPicked: sessionMap.pickedBy !== undefined,
          bannedBy: sessionMap.bannedBy,
          pickedBy: sessionMap.pickedBy
        };
        
        mapStates.push(mapState);
        console.log(`🗺️ Map ${mapNumber}: ${sessionMap.name || 'No name'} - ${mapState.isBanned ? 'BANNED' : mapState.isPicked ? 'PICKED' : 'NEUTRAL'}`);
        
        // Update map name text for each map
        if (sessionMap.name && sessionMap.name !== '' && sessionMap.name !== 'upcoming') {
          console.log(`📝 Updating map ${mapNumber} text to: ${sessionMap.name}`);
          this.riveService.updateMapNameText(mapNumber, sessionMap.name);
        }
        
        // Handle map status updates
        if (sessionMap.pickedBy !== undefined && sessionMap.sidePickedBy !== undefined) {
          const sideSelection: SideSelection = {
            team: sessionMap.sidePickedBy, // The team that picks the side (should be opposite to the team that picked the map)
            side: sessionMap.pickedAttack === true ? 'ATTACK' : 'DEFENSE'
          };
          
          console.log(`⚔️ Map ${mapNumber} picked by team ${sessionMap.pickedBy}, side picked by team ${sessionMap.sidePickedBy}: ${sideSelection.side}`);
          console.log(`🔍 Side selection validation: pickedBy=${sessionMap.pickedBy}, sidePickedBy=${sessionMap.sidePickedBy}, should be opposite=${sessionMap.pickedBy !== sessionMap.sidePickedBy ? 'YES' : 'NO'}`);
          
          this.riveService.updateMapStatus(
            mapNumber,
            false,
            true,
            sessionMap.pickedBy,
            sessionMap.name,
            sideSelection
          );
        } else if (sessionMap.bannedBy !== undefined) {
          console.log(`🚫 Map ${mapNumber} banned by team ${sessionMap.bannedBy}`);
          this.riveService.updateMapStatus(
            mapNumber,
            true,
            false,
            sessionMap.bannedBy,
            sessionMap.name
          );
        } else if (sessionMap.pickedBy !== undefined) {
          // Map was picked but no side has been selected yet
          // For display purposes, assume the opposite team will pick the side
          const oppositeSideTeam = sessionMap.pickedBy === 0 ? 1 : 0;
          
          // Check if sidePickedBy exists but is being processed separately
          const actualSidePickingTeam = sessionMap.sidePickedBy !== undefined ? sessionMap.sidePickedBy : oppositeSideTeam;
          const actualSide = sessionMap.pickedAttack !== undefined ? (sessionMap.pickedAttack ? 'ATTACK' : 'DEFENSE') : 'ATTACK';
          
          const defaultSideSelection: SideSelection = {
            team: actualSidePickingTeam,
            side: actualSide
          };
          
          console.log(`✅ Map ${mapNumber} picked by team ${sessionMap.pickedBy}`);
          console.log(`🔍 Side assignment: sidePickedBy=${sessionMap.sidePickedBy}, calculated opposite=${oppositeSideTeam}, using=${actualSidePickingTeam}, side=${actualSide}`);
          
          this.riveService.updateMapStatus(
            mapNumber,
            false,
            true,
            sessionMap.pickedBy,
            sessionMap.name,
            defaultSideSelection
          );
        }
      });
      
      // Update all map states at once
      console.log(`📊 Updating Rive with ${mapStates.length} map states:`, mapStates);
      this.riveService.updateMapStates(mapStates);
      
      console.log(`📊 Map states summary: ${mapStates.length} total maps, ${mapStates.filter(m => m.isBanned).length} banned, ${mapStates.filter(m => m.isPicked).length} picked`);
      
      // Check if there's a decider map (last map that's neither banned nor picked)
      const availableMapCount = this.data.availableMaps?.length || 7;
      const bannedCount = mapStates.filter(m => m.isBanned).length;
      const pickedCount = mapStates.filter(m => m.isPicked).length;
      
      if (bannedCount + pickedCount === availableMapCount - 1) {
        // Find the remaining map and set it as decider
        const deciderMapIndex = mapStates.findIndex(m => !m.isBanned && !m.isPicked);
        if (deciderMapIndex !== -1) {
          const deciderMapData = this.data.selectedMaps[deciderMapIndex];
          const deciderMapName = deciderMapData?.name;
          console.log(`🎯 Setting decider map: ${deciderMapName} at position ${deciderMapIndex + 1}`);
          
          // Check if someone picked a side on the decider map
          if (deciderMapData?.sidePickedBy !== undefined) {
            const sideSelection: SideSelection = {
              team: deciderMapData.sidePickedBy,
              side: deciderMapData.pickedAttack === true ? 'ATTACK' : 'DEFENSE'
            };
            
            console.log(`⚔️ Decider map (${deciderMapIndex + 1}) side picked by team ${deciderMapData.sidePickedBy}: ${sideSelection.side}`);
            
            // First set as decider map (this sets "DECIDER MAP" text)
            this.riveService.setDeciderMap(deciderMapIndex + 1, deciderMapName);
            
            // Then update the pick text to show side selection
            this.riveService.updatePickText(
              deciderMapData.sidePickedBy,
              sideSelection.side,
              `Pick ${deciderMapIndex + 1}`
            );
            
            // Trigger the pick animation for the decider map
            this.riveService.setRiveInput('isPicked', true, `Pick ${deciderMapIndex + 1}`);
          } else {
            // No side picked yet, just set as decider
            this.riveService.setDeciderMap(deciderMapIndex + 1, deciderMapName);
          }
        }
      }
    }
    
    // Update sponsor information if available
    if (this.match?.tools?.sponsorInfo) {
      console.log('📢 Updating sponsor info:', this.match.tools.sponsorInfo);
      this.riveService.updateSponsorInfo(this.match.tools.sponsorInfo);
    }
    
    // Update assets if they've changed
    console.log('🔄 Updating assets from preloaded cache...');
    const newAssets = this.buildMapbanAssets();
    this.riveService.updateAssetsFromPreloaded(newAssets, this.preloadedAssets);
    console.log('✅ Assets update completed');
  }
}

export interface ISessionData {
  sessionIdentifier: string;
  organizationName: string;
  teams: ISessionTeam[];
  format: "bo1" | "bo3" | "bo5" | undefined;
  availableMaps: SessionMap[];
  selectedMaps: SessionMap[];
  stage: Stage;
  actingTeamCode: string;
  actingTeam: 0 | 1;
}

export interface ISessionTeam {
  name: string;
  tricode: string;
  url: string;
}

export class SessionMap {
  name: string;
  bannedBy?: 0 | 1 = undefined; // 0 = left team, 1 = right team
  pickedBy?: 0 | 1 = undefined;
  sidePickedBy?: 0 | 1 = undefined;
  pickedAttack: boolean | undefined = undefined;

  constructor(name: string) {
    this.name = name;
  }
}

export type Stage = "ban" | "pick" | "side" | "decider";
