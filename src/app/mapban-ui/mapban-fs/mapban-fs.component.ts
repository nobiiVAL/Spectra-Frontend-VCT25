import { Component, inject, Input, OnChanges, OnInit, SimpleChanges, ViewChild, ElementRef, AfterViewInit, OnDestroy } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { SocketService } from "../../services/SocketService";
import { Config } from "../../shared/config";
import { RiveMapbanFsService, MapbanFsAssets, SponsorInfo, MapState, TeamInfo, SideSelection } from "../../services/rive-mapban-fs.service";
import { CommonModule } from "@angular/common";

@Component({
  standalone: true,
  imports: [CommonModule],
  selector: "app-mapban-fs",
  templateUrl: "./mapban-fs.component.html",
  styleUrls: ["./mapban-fs.component.scss"]
})
export class MapbanFsComponent implements OnInit, AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('riveCanvas', { static: true }) riveCanvas!: ElementRef<HTMLCanvasElement>;
  
  private route = inject(ActivatedRoute);
  private config = inject(Config);
  @Input() data!: ISessionData;

  sessionCode = "UNKNOWN";
  socketService!: SocketService;

  // Rive mapban fullscreen service
  private riveService = inject(RiveMapbanFsService);
  
  // Asset preloading
  private preloadedAssets: Map<string, Uint8Array> = new Map();
  private isPreloadingComplete = false;
  
  // Match data for assets
  private match: any = null;

  // Track if this is the first data load
  private isInitialLoad = true;
  private hasRealData = false; // Track if we've received actual data vs test data
  private hasSocketData = false; // Track if we've received data from socket

  // Track if this is a BO1 format (which should show message instead of Rive)
  public isBO1Format = false;

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
      this.hasSocketData = true; // Mark that we have socket data
      this.updateMapbanData(data);
    });
    
    // Check if we have real data from input
    if (this.data) {
      this.hasRealData = true;
      console.log('📡 Real data detected from input');
    }
    
    // Initialize Rive animation after view is ready
    this.initializeRiveAnimation();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["data"] && changes["data"].currentValue) {
      this.hasRealData = true; // Mark that we have real data from input
      console.log('📡 Real data received via input change');
      this.updateMapbanData({ data: changes["data"].currentValue });
    }
  }

  ngOnDestroy(): void {
    this.riveService.cleanup();
  }

  private hasCompleteMapData(): boolean {
    // Check if we have data with valid selectedMaps
    if (!this.data?.selectedMaps || this.data.selectedMaps.length === 0) {
      console.log('⏳ Missing selectedMaps data');
      return false;
    }
    
    // Check if we have format information (either explicit format or enough data to determine it)
    const hasExplicitFormat = this.data.format && (this.data.format === 'bo1' || this.data.format === 'bo3' || this.data.format === 'bo5');
    
    // For BO1, we can proceed immediately if we have explicit format
    if (this.data.format === 'bo1') {
      console.log('✅ BO1 format detected - complete data available for message display');
      return true;
    }
    
    // Check if at least some maps have valid names (required for BO3/BO5)
    const mapsWithNames = this.data.selectedMaps.filter(map => map && map.name && typeof map.name === 'string' && map.name.trim() !== '');
    if (mapsWithNames.length === 0) {
      console.log('⏳ No maps with valid names found');
      return false;
    }
    
    const totalBans = this.data.selectedMaps.filter(map => map.bannedBy !== undefined).length;
    const canDetermineFormat = totalBans === 4 || totalBans === 2 || totalBans === 0; // BO3, BO5, or BO1
    
    if (!hasExplicitFormat && !canDetermineFormat) {
      console.log('⏳ Cannot determine series format yet', {
        explicitFormat: this.data.format,
        totalBans,
        totalMaps: this.data.selectedMaps.length
      });
      return false;
    }
    
    console.log('✅ Complete map data available:', {
      totalMaps: this.data.selectedMaps.length,
      validMaps: mapsWithNames.length,
      mapNames: mapsWithNames.map(m => m.name),
      format: this.data.format,
      totalBans,
      hasExplicitFormat,
      canDetermineFormat
    });
    
    return true;
  }

  private async initializeRiveAnimation(): Promise<void> {
    try {
      console.log('🎬 Starting Rive mapban-fs animation initialization...');
      
      // Preload all assets first for performance
      await this.preloadAllAssets();
      
      console.log('🎯 Rive canvas ready:', this.riveCanvas.nativeElement);
      
      // Only initialize Rive if we have complete socket data with maps
      if (this.hasSocketData && this.hasCompleteMapData()) {
        console.log('📊 Initializing Rive with complete socket data...');
        await this.initializeRiveWithCompleteData();
      } else {
        console.log('⏳ Rive ready - waiting for complete socket data with maps before initializing animation...');
      }
      
    } catch (error) {
      console.error('❌ Failed to initialize Rive mapban-fs animation:', error);
    }
  }

  private getSeriesFormat(): 'BO1' | 'BO3' | 'BO5' {
    if (!this.data?.selectedMaps) {
      return 'BO3'; // Default to BO3 if no data available
    }
    
    // First check if format is explicitly set in the data
    if (this.data.format) {
      if (this.data.format === 'bo1') {
        return 'BO1';
      } else if (this.data.format === 'bo5') {
        return 'BO5';
      } else if (this.data.format === 'bo3') {
        return 'BO3';
      }
    }
    
    // Fallback: Count total bans to determine series format
    const totalBans = this.data.selectedMaps.filter(map => map.bannedBy !== undefined).length;
    
    // BO3: 4 bans total, BO5: 2 bans total, BO1: 0 bans (or very few maps)
    const isBO3 = totalBans === 4;
    const isBO5 = totalBans === 2;
    const isBO1 = totalBans === 0 || this.data.selectedMaps.length <= 1;
    
    if (isBO1) {
      return 'BO1';
    } else if (isBO5) {
      return 'BO5';
    } else if (isBO3) {
      return 'BO3';
    } else {
      return 'BO3'; // Default fallback
    }
  }

  private getRiveFileName(): string {
    const format = this.getSeriesFormat();
    
    if (format === 'BO1') {
      console.log('📁 BO1 format detected - no Rive file needed, showing message instead');
      this.isBO1Format = true;
      return ''; // No Rive file for BO1
    } else if (format === 'BO5') {
      console.log('📁 Using BO5 Rive file: mapban-fs-bo5.riv');
      this.isBO1Format = false;
      return '/assets/mapban/mapban-fs/mapban-fs-bo5.riv';
    } else {
      console.log('📁 Using BO3 Rive file: mapban-fs-bo3.riv');
      this.isBO1Format = false;
      return '/assets/mapban/mapban-fs/mapban-fs-bo3.riv';
    }
  }

  private async initializeRiveWithCompleteData(): Promise<void> {
    // Determine the series format to choose the correct Rive file
    const riveFileName = this.getRiveFileName();
    
    // If this is a BO1 format, don't initialize Rive
    if (this.isBO1Format) {
      console.log('📁 BO1 format detected - skipping Rive initialization, showing message instead');
      return;
    }
    
    console.log('📁 Using Rive file:', riveFileName);
    
    // Build complete assets with real map data
    const assets = this.buildMapbanAssets();
    
    console.log('🎯 Initializing Rive with complete assets:', assets);
    
    // Initialize Rive with preloaded assets containing real map data and format-specific file
    await this.riveService.initializeRive(
      this.riveCanvas.nativeElement,
      assets,
      this.preloadedAssets,
      riveFileName
    );
    
    console.log('🎬 Rive mapban-fs animation initialized with complete data');
    
    // Set the artboard name in the service to match the format
    const seriesFormat = this.getSeriesFormat();
    this.riveService.setArtboard(seriesFormat);
    console.log(`🎯 Set artboard format in service: ${seriesFormat}`);
    
    // Immediately update the animation with all the data
    await this.updateRiveAnimation();
  }

  private async preloadAllAssets(): Promise<void> {
    if (this.isPreloadingComplete) return;
    
    console.log('🔄 Starting asset preloading for mapban-fs...');
    const startTime = performance.now();
    
    // Get all possible asset URLs - include team logos and other assets
    const allAssetUrls = [
      '/assets/misc/icon.webp', // Default fallback
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
      '/assets/maps/wide/Corrode.webp'
    ];

    // Check if we have team data available for initial preloading
    const teams = this.data?.teams || [];
    const teamLogoUrls: string[] = [];
    
    // Only add team logos if we have team data during initial preload
    if (teams.length > 0) {
      console.log('🏷️ Team data available during initial preload, adding team logos...');
      if (teams[0]?.url) {
        allAssetUrls.push(teams[0].url);
        teamLogoUrls.push(teams[0].url);
      }
      if (teams[1]?.url) {
        allAssetUrls.push(teams[1].url);
        teamLogoUrls.push(teams[1].url);
      }
      console.log('🏷️ Team logos to be processed and resized:', teamLogoUrls);
    } else {
      console.log('⏳ No team data available during initial preload - team logos will be processed later when data arrives');
    }

    const preloadPromises = allAssetUrls.map(async (url) => {
      try {
        const isTeamLogo = teamLogoUrls.includes(url);
        if (isTeamLogo) {
          console.log(`🔧 Processing team logo with auto-resize: ${url}`);
        }
        
        const processedData = await this.riveService.preloadAndProcessAsset(url);
        this.preloadedAssets.set(url, processedData);
        
        if (isTeamLogo) {
          console.log(`✅ Team logo processed and resized: ${url}`);
        } else {
          console.log(`✅ Preloaded: ${url}`);
        }
        
        return { url, success: true };
      } catch (error) {
        console.warn(`❌ Failed to preload asset: ${url}`, error);
        return { url, success: false };
      }
    });

    const results = await Promise.all(preloadPromises);
    const successCount = results.filter(r => r.success).length;
    const loadTime = performance.now() - startTime;
    
    console.log(`✅ Preloaded ${successCount}/${allAssetUrls.length} assets for mapban-fs in ${loadTime.toFixed(2)}ms`);
    this.isPreloadingComplete = true;
  }

  /**
   * Process team logos with resizing when team data becomes available
   * This is called when we have actual team data to work with
   */
  private async processTeamLogos(): Promise<void> {
    const teams = this.data?.teams || [];
    
    if (teams.length === 0) {
      console.log('⏳ No team data available for team logo processing');
      return;
    }

    console.log('🏷️ Processing team logos with resizing now that team data is available...');
    
    const teamLogoPromises: Promise<void>[] = [];

    // Process team 1 logo
    if (teams[0]?.url && !this.preloadedAssets.has(teams[0].url)) {
      console.log(`🔧 Processing Team 1 logo with auto-resize: ${teams[0].url}`);
      teamLogoPromises.push(
        this.riveService.preloadAndProcessTeamLogo(teams[0].url).then(processedData => {
          this.preloadedAssets.set(teams[0].url, processedData);
          console.log(`✅ Team 1 logo processed and resized: ${teams[0].url}`);
        }).catch(error => {
          console.warn(`❌ Failed to process Team 1 logo: ${teams[0].url}`, error);
        })
      );
    }

    // Process team 2 logo
    if (teams[1]?.url && !this.preloadedAssets.has(teams[1].url)) {
      console.log(`🔧 Processing Team 2 logo with auto-resize: ${teams[1].url}`);
      teamLogoPromises.push(
        this.riveService.preloadAndProcessTeamLogo(teams[1].url).then(processedData => {
          this.preloadedAssets.set(teams[1].url, processedData);
          console.log(`✅ Team 2 logo processed and resized: ${teams[1].url}`);
        }).catch(error => {
          console.warn(`❌ Failed to process Team 2 logo: ${teams[1].url}`, error);
        })
      );
    }

    if (teamLogoPromises.length > 0) {
      await Promise.all(teamLogoPromises);
      console.log('🏷️ All team logos processed and resized');
    } else {
      console.log('ℹ️ Team logos already processed or no new team logos to process');
    }
  }

  private getMapImageUrls(): string[] {
    const mapNames = ['Ascent', 'Bind', 'Haven', 'Split', 'Lotus', 'Sunset', 'Icebox', 'Breeze', 'Fracture', 'Pearl', 'Abyss', 'Corrode'];
    return mapNames.map(name => `/assets/maps/wide/${name}.webp`);
  }

  private buildMapbanAssets(): MapbanFsAssets {
    const teams = this.data?.teams || [];
    const team1Url = teams[0]?.url || '/assets/misc/icon.webp';
    const team2Url = teams[1]?.url || '/assets/misc/logo.webp'; // Default to a different logo for debugging
    
    const assets: MapbanFsAssets = {
      team1Logo: team1Url,
      team2Logo: team2Url,
    };

    console.log('🏗️ Building mapban-fs assets with team logos:', {
      team1Logo: team1Url,
      team2Logo: team2Url,
      team1Name: teams[0]?.name,
      team2Name: teams[1]?.name,
    });

    // Only build map assets if we have selectedMaps data with valid names
    if (!this.data?.selectedMaps || this.data.selectedMaps.length === 0) {
      console.log('⚠️ No selectedMaps data available, returning basic assets (team logos only)');
      console.log('📊 Current data state:', {
        hasData: !!this.data,
        hasSelectedMaps: !!this.data?.selectedMaps,
        selectedMapsLength: this.data?.selectedMaps?.length
      });
      return assets;
    }

    // Filter out maps that don't have valid names
    const validMaps = this.data.selectedMaps.filter(map => map && map.name && typeof map.name === 'string' && map.name.trim() !== '');
    
    if (validMaps.length === 0) {
      console.log('⚠️ No maps with valid names found, returning basic assets (team logos only)');
      console.log('📊 Map validation failed:', {
        totalMaps: this.data.selectedMaps.length,
        invalidMaps: this.data.selectedMaps.map(map => ({
          hasMap: !!map,
          hasName: !!map?.name,
          nameType: typeof map?.name,
          name: map?.name
        }))
      });
      return assets;
    }

    console.log('📊 Raw selectedMaps data:', validMaps.map(map => ({
      name: map.name,
      bannedBy: map.bannedBy,
      pickedBy: map.pickedBy
    })));

    // Use validMaps instead of this.data.selectedMaps for filtering
    // Determine series format - prioritize explicit format over ban counting
    let isBO3 = false;
    let isBO5 = false;
    let totalBans = 0;
    
    if (this.data.format) {
      if (this.data.format === 'bo5') {
        isBO5 = true;
        console.log('🏗️ Using BO5 format from explicit data format for asset building (will use mapban-fs-bo5.riv)');
      } else if (this.data.format === 'bo3') {
        isBO3 = true;
        console.log('🏗️ Using BO3 format from explicit data format for asset building (will use mapban-fs-bo3.riv)');
      }
    } else {
      // Fallback: determine from ban count
      totalBans = validMaps.filter(map => map.bannedBy !== undefined).length;
      isBO3 = totalBans === 4;
      isBO5 = totalBans === 2;
      console.log('🏗️ Using fallback format detection from ban count for asset building:', {
        totalBans,
        isBO3,
        isBO5,
        riveFile: isBO5 ? 'mapban-fs-bo5.riv' : isBO3 ? 'mapban-fs-bo3.riv' : 'mapban-fs-bo3.riv (default)'
      });
    }

    // Separate maps by type from chronological order
    const bannedMaps = validMaps.filter(map => map.bannedBy !== undefined);
    const pickedMaps = validMaps.filter(map => map.pickedBy !== undefined);
    const deciderMaps = validMaps.filter(map => map.bannedBy === undefined && map.pickedBy === undefined);

    console.log('📊 Map distribution:', {
      banned: bannedMaps.map((m, idx) => ({ index: idx, name: m.name, bannedBy: m.bannedBy })),
      picked: pickedMaps.map((m, idx) => ({ index: idx, name: m.name, pickedBy: m.pickedBy })),
      decider: deciderMaps.map((m, idx) => ({ index: idx, name: m.name })),
      isBO3,
      isBO5,
      totalMaps: validMaps.length,
      totalBans: totalBans || validMaps.filter(map => map.bannedBy !== undefined).length,
      formatDetected: isBO3 ? 'BO3' : isBO5 ? 'BO5' : 'UNKNOWN',
      explicitFormat: this.data.format,
      originalOrder: validMaps.map((m, idx) => ({ index: idx, name: m.name, bannedBy: m.bannedBy, pickedBy: m.pickedBy }))
    });

    // Start with placeholder map assets to ensure all positions are filled
    assets.map_1 = '/assets/maps/wide/Ascent.webp';
    assets.map_2 = '/assets/maps/wide/Ascent.webp';
    assets.map_3 = '/assets/maps/wide/Ascent.webp';
    assets.map_4 = '/assets/maps/wide/Ascent.webp';
    assets.map_5 = '/assets/maps/wide/Ascent.webp';
    assets.map_6 = '/assets/maps/wide/Ascent.webp';
    assets.map_7 = '/assets/maps/wide/Ascent.webp';

    // Assign map images based on animation layout structure
    if (isBO3) {
      // BO3: Maps 1-4 are bans, Maps 5-7 are picks/decider
      
      // Assign banned maps to positions 1-4
      for (let i = 0; i < 4 && i < bannedMaps.length; i++) {
        const mapKey = `map_${i + 1}` as keyof MapbanFsAssets;
        const mapName = bannedMaps[i]?.name;
        if (mapName) {
          assets[mapKey] = `/assets/maps/wide/${mapName}.webp`;
          console.log(`🗺️ BO3 Ban ${i + 1}: ${mapName} -> ${assets[mapKey]}`);
        } else {
          console.warn(`⚠️ BO3 Ban ${i + 1}: Missing map name for banned map at index ${i}`);
        }
      }
      
      // Assign picked maps to positions 5-6
      for (let i = 0; i < 2 && i < pickedMaps.length; i++) {
        const mapKey = `map_${i + 5}` as keyof MapbanFsAssets;
        const mapName = pickedMaps[i]?.name;
        if (mapName) {
          assets[mapKey] = `/assets/maps/wide/${mapName}.webp`;
          console.log(`🗺️ BO3 Pick ${i + 1}: ${mapName} -> ${assets[mapKey]}`);
        } else {
          console.warn(`⚠️ BO3 Pick ${i + 1}: Missing map name for picked map at index ${i}`);
        }
      }
      
      // Assign decider to position 7
      if (deciderMaps.length > 0 && deciderMaps[0]?.name) {
        assets.map_7 = `/assets/maps/wide/${deciderMaps[0].name}.webp`;
        console.log(`🗺️ BO3 Decider: ${deciderMaps[0].name} -> ${assets.map_7}`);
      } else if (deciderMaps.length > 0) {
        console.warn(`⚠️ BO3 Decider: Missing map name for decider map`);
      }
    } else if (isBO5) {
      // BO5: Check if we need to adjust mapping for positions 2 and 3
      // Based on user feedback, map 2 and map 3 seem to be switched
      // Standard BO5 order: Ban1, Ban2, Pick1, Pick2, Pick3, Pick4, Decider
      // But the Rive file might expect: Ban1, Pick1, Ban2, Pick2, Pick3, Pick4, Decider
      
      console.log('🔧 BO5 Mapping: Adjusting for potential position 2/3 switch');
      
      // Assign first ban to position 1
      if (bannedMaps.length > 0 && bannedMaps[0]?.name) {
        assets.map_1 = `/assets/maps/wide/${bannedMaps[0].name}.webp`;
        console.log(`🗺️ BO5 Ban 1: ${bannedMaps[0].name} -> ${assets.map_1} (position 1)`);
      }
      
      // Assign first pick to position 2 (potential fix for the switch)
      if (pickedMaps.length > 0 && pickedMaps[0]?.name) {
        assets.map_2 = `/assets/maps/wide/${pickedMaps[0].name}.webp`;
        console.log(`🗺️ BO5 Pick 1: ${pickedMaps[0].name} -> ${assets.map_2} (position 2 - switched)`);
      }
      
      // Assign second ban to position 3 (potential fix for the switch)
      if (bannedMaps.length > 1 && bannedMaps[1]?.name) {
        assets.map_3 = `/assets/maps/wide/${bannedMaps[1].name}.webp`;
        console.log(`🗺️ BO5 Ban 2: ${bannedMaps[1].name} -> ${assets.map_3} (position 3 - switched)`);
      }
      
      // Assign remaining picks to positions 4-6
      for (let i = 1; i < 4 && i < pickedMaps.length; i++) {
        const mapKey = `map_${i + 3}` as keyof MapbanFsAssets;
        const mapName = pickedMaps[i]?.name;
        if (mapName) {
          assets[mapKey] = `/assets/maps/wide/${mapName}.webp`;
          console.log(`🗺️ BO5 Pick ${i + 1}: ${mapName} -> ${assets[mapKey]} (position ${i + 3})`);
        } else {
          console.warn(`⚠️ BO5 Pick ${i + 1}: Missing map name for picked map at index ${i}`);
        }
      }
      
      // Assign decider to position 7
      if (deciderMaps.length > 0 && deciderMaps[0]?.name) {
        assets.map_7 = `/assets/maps/wide/${deciderMaps[0].name}.webp`;
        console.log(`🗺️ BO5 Decider: ${deciderMaps[0].name} -> ${assets.map_7}`);
      } else if (deciderMaps.length > 0) {
        console.warn(`⚠️ BO5 Decider: Missing map name for decider map`);
      }
    } else {
      // Fallback: Use sequential order if format is unclear
      console.log('🔄 Using fallback sequential assignment');
      for (let i = 1; i <= 7; i++) {
        const mapKey = `map_${i}` as keyof MapbanFsAssets;
        const mapIndex = i - 1;
        const sessionMap = validMaps[mapIndex];
        if (sessionMap?.name) {
          assets[mapKey] = `/assets/maps/wide/${sessionMap.name}.webp`;
          console.log(`🗺️ Fallback Map ${i}: ${sessionMap.name} -> ${assets[mapKey]}`);
        } else if (sessionMap) {
          console.warn(`⚠️ Fallback Map ${i}: Missing map name for session map at index ${mapIndex}`);
        }
      }
    }

    console.log('🏗️ Built mapban-fs assets:', assets);
    return assets;
  }

  private async updateMapbanData(socketData: any): Promise<void> {
    let dataUpdated = false;
    
    if (socketData.data) {
      this.data = socketData.data;
      this.hasRealData = true; // Mark that we have real data
      this.hasSocketData = true; // Mark that we have socket data
      dataUpdated = true;
      console.log('📡 Real session data received via socket');
      
      // Debug the received data structure
      console.log('🔍 Socket data structure:', {
        hasData: !!socketData.data,
        hasSelectedMaps: !!socketData.data.selectedMaps,
        selectedMapsLength: socketData.data.selectedMaps?.length,
        selectedMaps: socketData.data.selectedMaps?.map((map: any) => ({
          name: map.name,
          bannedBy: map.bannedBy,
          pickedBy: map.pickedBy,
          hasName: !!map.name
        }))
      });
    }
    if (socketData.match) {
      this.match = socketData.match;
      this.hasSocketData = true; // Mark that we have socket data
      console.log('📡 Real match data received via socket');
    }
    
    // Handle Rive initialization and animation updates based on data completeness
    if (dataUpdated && this.hasSocketData && this.hasCompleteMapData()) {
      // Check if Rive is already initialized
      if (!this.riveService.getRive()) {
        console.log('🎬 Initializing Rive with complete socket data...');
        await this.initializeRiveWithCompleteData();
      } else {
        console.log('🔄 Updating animation with complete socket data');
        await this.updateRiveAnimation();
      }
    } else if (!this.hasSocketData) {
      console.log('⏳ Ignoring update - still waiting for socket data');
    } else if (!this.hasCompleteMapData()) {
      console.log('⏳ Ignoring update - still waiting for complete map data');
    }
  }

  private async updateRiveAnimation(): Promise<void> {
    if (!this.data || (!this.riveService.getRive() && !this.isBO1Format)) {
      console.log('⏸️ Skipping Rive update - missing data or Rive not initialized');
      return;
    }
    
    // If this is BO1 format, no Rive animation to update
    if (this.isBO1Format) {
      console.log('📁 BO1 format - no Rive animation to update, message is displayed');
      return;
    }
    
    console.log('🔄 Updating Rive animation with complete socket data:', this.data);
    
    // Handle differently for initial load vs subsequent updates
    const shouldPauseForUpdate = !this.isInitialLoad && this.riveService.isAnimationPlaying();
    
    if (shouldPauseForUpdate) {
      console.log('⏸️ Pausing animation for data update...');
      this.riveService.pauseAnimation();
    }
    
    try {
      // Process team logos with resizing now that we have team data
      await this.processTeamLogos();
      
      // Set team information
      this.setTeamInformation();
      
      // Process map states and update ban/pick information
      this.processMapStates();
      
      // Update sponsor information if available
      if (this.match?.tools?.sponsorInfo) {
        console.log('📢 Updating sponsor info:', this.match.tools.sponsorInfo);
        this.riveService.updateSponsorInfo(this.match.tools.sponsorInfo);
      }
      
      // Build and update assets with complete map data (we only reach here if we have complete data)
      console.log('� Building complete assets with map data...');
      const newAssets = this.buildMapbanAssets();
      
      // Debug: Log the exact assets being passed to Rive
      console.log('🎯 Final assets to be loaded:', newAssets);
      
      // Check if all map assets have valid URLs (not undefined)
      const mapAssetKeys = Object.keys(newAssets).filter(key => key.startsWith('map_'));
      const validMapAssets = mapAssetKeys.filter(key => newAssets[key as keyof MapbanFsAssets] && !newAssets[key as keyof MapbanFsAssets]?.includes('undefined'));
      const invalidMapAssets = mapAssetKeys.filter(key => !newAssets[key as keyof MapbanFsAssets] || newAssets[key as keyof MapbanFsAssets]?.includes('undefined'));
      
      console.log('🔍 Asset validation:', {
        totalMapAssets: mapAssetKeys.length,
        validMapAssets: validMapAssets.length,
        invalidMapAssets: invalidMapAssets.length,
        validAssets: validMapAssets.map(key => `${key}: ${newAssets[key as keyof MapbanFsAssets]}`),
        invalidAssets: invalidMapAssets.map(key => `${key}: ${newAssets[key as keyof MapbanFsAssets]}`)
      });
      
      this.riveService.updateAssetsFromPreloaded(newAssets, this.preloadedAssets);
      console.log('✅ Assets updated with complete map data');
      
      console.log('✅ All real data updated');
      
      // Start animation for initial load, or resume for subsequent updates
      setTimeout(() => {
        if (this.isInitialLoad) {
          this.riveService.startAnimationWithData();
          console.log('🎬 Animation started with complete socket data');
          this.isInitialLoad = false;
        } else if (shouldPauseForUpdate) {
          this.riveService.playAnimation();
          console.log('▶️ Animation resumed after socket data update');
        }
      }, this.isInitialLoad ? 100 : 50); // Longer delay for initial load
      
    } catch (error) {
      console.error('❌ Error during animation update:', error);
      // Still start/resume animation even if there was an error
      setTimeout(() => {
        if (this.isInitialLoad) {
          this.riveService.startAnimationWithData();
          this.isInitialLoad = false;
        } else if (shouldPauseForUpdate) {
          this.riveService.playAnimation();
        }
      }, this.isInitialLoad ? 100 : 50);
    }
  }

  private setTeamInformation(): void {
    if (!this.data?.teams) return;
    
    // Set TEAM 1 and TEAM 2 text runs
    this.riveService.setTextRun('TEAM 1', this.data.teams[0]?.name || 'TEAM 1');
    this.riveService.setTextRun('TEAM 2', this.data.teams[1]?.name || 'TEAM 2');
    
    // Store team info for later use
    for (let i = 0; i < this.data.teams.length; i++) {
      const teamInfo: TeamInfo = {
        tricode: this.data.teams[i].tricode || 'TEAM',
        name: this.data.teams[i].name || 'Team Name'
      };
      this.riveService.setTeamInfo(i, teamInfo);
    }
  }

  private processMapStates(): void {
    if (!this.data?.selectedMaps) return;
    
    const mapStates: MapState[] = [];
    
    // Determine series format - prioritize explicit format over ban counting
    let isBO3 = false;
    let isBO5 = false;
    
    if (this.data.format) {
      if (this.data.format === 'bo5') {
        isBO5 = true;
        console.log('📊 Using BO5 format from explicit data format');
      } else if (this.data.format === 'bo3') {
        isBO3 = true;
        console.log('📊 Using BO3 format from explicit data format');
      }
    } else {
      // Fallback: determine from ban count
      const totalBans = this.data.selectedMaps.filter(map => map.bannedBy !== undefined).length;
      isBO3 = totalBans === 4;
      isBO5 = totalBans === 2;
      console.log('📊 Using fallback format detection from ban count:', {
        totalBans,
        isBO3,
        isBO5
      });
    }

    // Separate maps by type from chronological order
    const bannedMaps = this.data.selectedMaps.filter(map => map.bannedBy !== undefined);
    const pickedMaps = this.data.selectedMaps.filter(map => map.pickedBy !== undefined);
    const deciderMaps = this.data.selectedMaps.filter(map => map.bannedBy === undefined && map.pickedBy === undefined);

    // Set text runs based on animation layout structure
    if (isBO3) {
      // BO3: Maps 1-4 are bans, Maps 5-7 are picks/decider
      
      // Set ban text runs for positions 1-4
      for (let i = 0; i < 4; i++) {
        const mapNumber = i + 1;
        const bannedMap = bannedMaps[i];
        
        if (bannedMap) {
          this.riveService.setTextRun(`MAP ${mapNumber} TEXT`, bannedMap.name.toUpperCase());
          
          const mapState: MapState = {
            mapNumber,
            mapName: bannedMap.name,
            isBanned: true,
            isPicked: false,
            bannedBy: bannedMap.bannedBy,
            pickedBy: undefined,
            isPastMap: this.isPastMap(bannedMap),
            mapScore: this.getMapScore(bannedMap)
          };
          mapStates.push(mapState);
        }
      }
      
      // Set pick text runs for positions 5-6
      for (let i = 0; i < 2; i++) {
        const mapNumber = i + 5;
        const pickedMap = pickedMaps[i];
        
        if (pickedMap) {
          this.riveService.setTextRun(`MAP ${mapNumber} TEXT`, pickedMap.name.toUpperCase());
          
          // Set pick team information
          const teamTricode = this.data.teams[pickedMap.pickedBy!]?.tricode || 'TEAM';
          
          // Calculate defending team using sidePickedBy and pickedAttack
          const defTeamTricode = this.getDefendingTeam(pickedMap);
          
          this.riveService.setTextRun(`MAP ${mapNumber} DEF TEAM`, defTeamTricode);
          this.riveService.setTextRun(`MAP ${mapNumber} PICK TEAM`, teamTricode);
          this.riveService.setTextRun(`MAP ${mapNumber} PICK`, 'PICK');
          
          // Handle pastMap and score display
          const isPastMap = this.isPastMap(pickedMap);
          const mapScore = this.getMapScore(pickedMap);
          
          console.log(`🔍 BO3 Map ${mapNumber} (${pickedMap.name}) debug:`, {
            score: pickedMap.score,
            isPastMap,
            mapScore,
            sidePickedBy: pickedMap.sidePickedBy,
            pickedAttack: pickedMap.pickedAttack,
            defTeam: defTeamTricode
          });
          
          if (isPastMap && mapScore) {
            // Use the new boolean team win approach instead of complex nested properties
            this.riveService.setMapTeamWinFromScore(mapNumber, mapScore, true);
            console.log(`📊 Map ${mapNumber} (${pickedMap.name}) team win status set based on score: ${mapScore}`);
          } else {
            // Explicitly reset team win status for maps without score data
            console.log(`⏭️ Map ${mapNumber} (${pickedMap.name}) no score data available for team win`);
          }
          
          const mapState: MapState = {
            mapNumber,
            mapName: pickedMap.name,
            isBanned: false,
            isPicked: true,
            bannedBy: undefined,
            pickedBy: pickedMap.pickedBy,
            isPastMap,
            mapScore
          };
          mapStates.push(mapState);
        }
      }
      
      // Set decider text run for position 7
      if (deciderMaps.length > 0) {
        const deciderMap = deciderMaps[0];
        this.riveService.setTextRun('MAP 7 TEXT', deciderMap.name.toUpperCase());
        this.riveService.setTextRun('MAP 7 PICK', 'DECIDER');
        
        // Set defending team for decider map if it has side selection data
        if (deciderMap.sidePickedBy !== undefined && deciderMap.pickedAttack !== undefined) {
          const defTeamTricode = this.getDefendingTeam(deciderMap);
          this.riveService.setTextRun('MAP 7 DEF TEAM', defTeamTricode);
          
          console.log(`🛡️ BO3 Decider Map 7 (${deciderMap.name}) defending team set:`, {
            sidePickedBy: deciderMap.sidePickedBy,
            pickedAttack: deciderMap.pickedAttack,
            defTeam: defTeamTricode
          });
        } else {
          console.log(`⚠️ BO3 Decider Map 7 (${deciderMap.name}) missing side selection data, no defending team set`);
        }
        
        // Handle pastMap and score display for decider
        const isPastMap = this.isPastMap(deciderMap);
        const mapScore = this.getMapScore(deciderMap);
        
        console.log(`🔍 BO3 Decider Map 7 (${deciderMap.name}) debug:`, {
          score: deciderMap.score,
          isPastMap,
          mapScore
        });
        
        if (isPastMap && mapScore) {
          // Use the new boolean team win approach for decider map
          this.riveService.setMapTeamWinFromScore(7, mapScore, true);
          console.log(`📊 Map 7 (${deciderMap.name}) team win status set based on score: ${mapScore}`);
        } else {
          // No score data available for team win
          console.log(`⏭️ Map 7 (${deciderMap.name}) no score data available for team win`);
        }
        
        const mapState: MapState = {
          mapNumber: 7,
          mapName: deciderMap.name,
          isBanned: false,
          isPicked: false,
          bannedBy: undefined,
          pickedBy: undefined,
          isPastMap,
          mapScore
        };
        mapStates.push(mapState);
      }
    } else if (isBO5) {
      // BO5: Adjust text runs to match the new asset mapping
      // Asset mapping: Position 1 = Ban1, Position 2 = Pick1, Position 3 = Ban2, Positions 4-6 = Pick2-4, Position 7 = Decider
      
      console.log('🔧 BO5 Text Runs: Adjusting to match asset mapping with position 2/3 switch');
      
      // Set ban text run for position 1 (first ban)
      if (bannedMaps.length > 0 && bannedMaps[0]) {
        this.riveService.setTextRun('MAP 1 TEXT', bannedMaps[0].name.toUpperCase());
        
        const mapState: MapState = {
          mapNumber: 1,
          mapName: bannedMaps[0].name,
          isBanned: true,
          isPicked: false,
          bannedBy: bannedMaps[0].bannedBy,
          pickedBy: undefined,
          isPastMap: this.isPastMap(bannedMaps[0]),
          mapScore: this.getMapScore(bannedMaps[0])
        };
        mapStates.push(mapState);
      }
      
      // Set pick text run for position 2 (first pick - but text shows second ban)
      if (bannedMaps.length > 1 && bannedMaps[1]) {
        this.riveService.setTextRun('MAP 2 TEXT', bannedMaps[1].name.toUpperCase());
        
        const mapState: MapState = {
          mapNumber: 2,
          mapName: bannedMaps[1].name,
          isBanned: true,
          isPicked: false,
          bannedBy: bannedMaps[1].bannedBy,
          pickedBy: undefined,
          isPastMap: this.isPastMap(bannedMaps[1]),
          mapScore: this.getMapScore(bannedMaps[1])
        };
        mapStates.push(mapState);
      }
      
      // Set ban text run for position 3 (second ban - but text shows first pick)
      if (pickedMaps.length > 0 && pickedMaps[0]) {
        const pickedMap = pickedMaps[0];
        this.riveService.setTextRun('MAP 3 TEXT', pickedMap.name.toUpperCase());
        
        // Set pick team information
        const teamTricode = this.data.teams[pickedMap.pickedBy!]?.tricode || 'TEAM';
        
        // Calculate defending team using sidePickedBy and pickedAttack
        const defTeamTricode = this.getDefendingTeam(pickedMap);
        
        this.riveService.setTextRun('MAP 3 DEF TEAM', defTeamTricode);
        this.riveService.setTextRun('MAP 3 PICK TEAM', teamTricode);
        this.riveService.setTextRun('MAP 3 PICK', 'PICK');
        
        // Handle pastMap and score display
        const isPastMap = this.isPastMap(pickedMap);
        const mapScore = this.getMapScore(pickedMap);
        
        console.log(`🔍 BO5 Map 3 (${pickedMap.name}) debug:`, {
          score: pickedMap.score,
          isPastMap,
          mapScore,
          sidePickedBy: pickedMap.sidePickedBy,
          pickedAttack: pickedMap.pickedAttack,
          defTeam: defTeamTricode
        });
        
        if (isPastMap && mapScore) {
          this.riveService.setMapTeamWinFromScore(3, mapScore, true);
          console.log(`📊 Map 3 (${pickedMap.name}) team win status set based on score: ${mapScore}`);
        } else {
          console.log(`⏭️ Map 3 (${pickedMap.name}) no score data available for team win`);
        }
        
        const mapState: MapState = {
          mapNumber: 3,
          mapName: pickedMap.name,
          isBanned: false,
          isPicked: true,
          bannedBy: undefined,
          pickedBy: pickedMap.pickedBy,
          isPastMap,
          mapScore
        };
        mapStates.push(mapState);
      }
      
      // Set pick text runs for positions 4-6 (picks 2-4)
      for (let i = 1; i < 4 && i < pickedMaps.length; i++) {
        const mapNumber = i + 3; // positions 4, 5, 6
        const pickedMap = pickedMaps[i];
        
        if (pickedMap) {
          this.riveService.setTextRun(`MAP ${mapNumber} TEXT`, pickedMap.name.toUpperCase());
          
          // Set pick team information
          const teamTricode = this.data.teams[pickedMap.pickedBy!]?.tricode || 'TEAM';
          
          // Calculate defending team using sidePickedBy and pickedAttack
          const defTeamTricode = this.getDefendingTeam(pickedMap);
          
          this.riveService.setTextRun(`MAP ${mapNumber} DEF TEAM`, defTeamTricode);
          this.riveService.setTextRun(`MAP ${mapNumber} PICK TEAM`, teamTricode);
          this.riveService.setTextRun(`MAP ${mapNumber} PICK`, 'PICK');
          
          // Handle pastMap and score display
          const isPastMap = this.isPastMap(pickedMap);
          const mapScore = this.getMapScore(pickedMap);
          
          console.log(`🔍 BO5 Map ${mapNumber} (${pickedMap.name}) debug:`, {
            score: pickedMap.score,
            isPastMap,
            mapScore,
            sidePickedBy: pickedMap.sidePickedBy,
            pickedAttack: pickedMap.pickedAttack,
            defTeam: defTeamTricode
          });
          
          if (isPastMap && mapScore) {
            this.riveService.setMapTeamWinFromScore(mapNumber, mapScore, true);
            console.log(`📊 Map ${mapNumber} (${pickedMap.name}) team win status set based on score: ${mapScore}`);
          } else {
            console.log(`⏭️ Map ${mapNumber} (${pickedMap.name}) no score data available for team win`);
          }
          
          const mapState: MapState = {
            mapNumber,
            mapName: pickedMap.name,
            isBanned: false,
            isPicked: true,
            bannedBy: undefined,
            pickedBy: pickedMap.pickedBy,
            isPastMap,
            mapScore
          };
          mapStates.push(mapState);
        }
      }
      
      // Set decider text run for position 7
      if (deciderMaps.length > 0) {
        const deciderMap = deciderMaps[0];
        this.riveService.setTextRun('MAP 7 TEXT', deciderMap.name.toUpperCase());
        this.riveService.setTextRun('MAP 7 PICK', 'DECIDER');
        
        // Set defending team for decider map if it has side selection data
        if (deciderMap.sidePickedBy !== undefined && deciderMap.pickedAttack !== undefined) {
          const defTeamTricode = this.getDefendingTeam(deciderMap);
          this.riveService.setTextRun('MAP 7 DEF TEAM', defTeamTricode);
          
          console.log(`🛡️ BO5 Decider Map 7 (${deciderMap.name}) defending team set:`, {
            sidePickedBy: deciderMap.sidePickedBy,
            pickedAttack: deciderMap.pickedAttack,
            defTeam: defTeamTricode
          });
        } else {
          console.log(`⚠️ BO5 Decider Map 7 (${deciderMap.name}) missing side selection data, no defending team set`);
        }
        
        const mapState: MapState = {
          mapNumber: 7,
          mapName: deciderMap.name,
          isBanned: false,
          isPicked: false,
          bannedBy: undefined,
          pickedBy: undefined,
          isPastMap: this.isPastMap(deciderMap),
          mapScore: this.getMapScore(deciderMap)
        };
        mapStates.push(mapState);
      }
    } else {
      // Fallback: Use chronological order if format is unclear
      this.data.selectedMaps.forEach((sessionMap, index) => {
        const mapNumber = index + 1;
        const mapState: MapState = {
          mapNumber,
          mapName: sessionMap.name,
          isBanned: sessionMap.bannedBy !== undefined,
          isPicked: sessionMap.pickedBy !== undefined,
          bannedBy: sessionMap.bannedBy,
          pickedBy: sessionMap.pickedBy,
          isPastMap: this.isPastMap(sessionMap),
          mapScore: this.getMapScore(sessionMap)
        };
        mapStates.push(mapState);
        
        // Set text runs
        if (mapState.isBanned) {
          this.riveService.setTextRun(`MAP ${mapNumber} TEXT`, sessionMap.name.toUpperCase());
        } else if (mapNumber >= 3 && mapNumber <= 7) {
          this.riveService.setTextRun(`MAP ${mapNumber} TEXT`, sessionMap.name.toUpperCase());
          
          if (mapState.isPicked && mapState.pickedBy !== undefined) {
            const teamTricode = this.data.teams[mapState.pickedBy]?.tricode || 'TEAM';
            
            // Calculate defending team using sidePickedBy and pickedAttack
            const defTeamTricode = this.getDefendingTeam(sessionMap);
            
            this.riveService.setTextRun(`MAP ${mapNumber} DEF TEAM`, defTeamTricode);
            this.riveService.setTextRun(`MAP ${mapNumber} PICK TEAM`, teamTricode);
            this.riveService.setTextRun(`MAP ${mapNumber} PICK`, mapNumber === 7 ? 'DECIDER' : 'PICK');
          }
        }
      });
    }
    
    // Update map states and ban texts with team data
    this.riveService.updateMapStates(mapStates, this.data.teams);
  }

  private getDefendingTeam(sessionMap: SessionMap): string {
    // Calculate defending team using sidePickedBy and pickedAttack
    // If sidePickedBy is undefined, fall back to the old logic
    if (sessionMap.sidePickedBy === undefined || sessionMap.pickedAttack === undefined) {
      // Fallback: opposite team of who picked the map
      const defTeamIndex = sessionMap.pickedBy === 0 ? 1 : 0;
      const fallbackTricode = this.data.teams[defTeamIndex]?.tricode || 'TEAM';
      console.log(`⚠️ Missing side selection data for ${sessionMap.name}, using fallback defense team: ${fallbackTricode}`);
      return fallbackTricode;
    }
    
    // Logic based on sidePickedBy and pickedAttack:
    // - sidePickedBy: which team (0 or 1) chose the side
    // - pickedAttack: true if the side-picking team chose to attack, false if they chose to defend
    
    let defendingTeamIndex: number;
    
    if (sessionMap.pickedAttack) {
      // Side-picking team chose to attack, so they are attacking
      // The defending team is the opposite team
      defendingTeamIndex = sessionMap.sidePickedBy === 0 ? 1 : 0;
    } else {
      // Side-picking team chose to defend, so they are defending
      defendingTeamIndex = sessionMap.sidePickedBy;
    }
    
    const defTeamTricode = this.data.teams[defendingTeamIndex]?.tricode || 'TEAM';
    
    console.log(`🛡️ Defending team for ${sessionMap.name}:`, {
      sidePickedBy: sessionMap.sidePickedBy,
      pickedAttack: sessionMap.pickedAttack,
      defendingTeamIndex,
      defTeamTricode
    });
    
    return defTeamTricode;
  }

  private isPastMap(sessionMap: SessionMap): boolean {
    // Check if this map has valid score data (indicating it's been played)
    return sessionMap.score && 
           sessionMap.score[0] !== undefined && 
           sessionMap.score[1] !== undefined &&
           typeof sessionMap.score[0] === 'number' &&
           typeof sessionMap.score[1] === 'number';
  }

  private getMapScore(sessionMap: SessionMap): { team1: number; team2: number } | string | null {
    // Extract score data from the session map
    if (!sessionMap.score || 
        sessionMap.score[0] === undefined || 
        sessionMap.score[1] === undefined) {
      return null;
    }
    
    const score1 = sessionMap.score[0];
    const score2 = sessionMap.score[1];
    
    // Return the original score object to preserve team identity
    // The service will handle formatting for display while preserving winner logic
    return {
      team1: score1,
      team2: score2
    };
  }
}

// Interface definitions (matching mapban-ui structure)
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
  score: (number | undefined)[] = [undefined, undefined];

  constructor(name: string) {
    this.name = name;
  }
}

export type Stage = "ban" | "pick" | "side";
