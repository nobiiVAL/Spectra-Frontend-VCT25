import { AfterViewInit, Component, OnDestroy, OnInit, ViewChild, ElementRef } from "@angular/core";
import { TrackerComponent } from "../../tracker/tracker.component";
import { ActivatedRoute } from "@angular/router";
import { SocketService } from "../../services/SocketService";
import { Config } from "../../shared/config";
import { AutoswitchComponent } from "../../autoswitch/autoswitch.component";
import { NgIf } from "@angular/common";
import {
  Rive,
  ImageAsset,
  FontAsset,
  FileAsset,
  RiveParameters,
  Layout,
  Fit,
  Alignment,
  decodeImage
} from "@rive-app/webgl2";
import { AgentNameService } from "../../services/agentName.service";
import { AgentRoleService } from "../../services/agentRole.service";

// Hiragana and Katakana (Japanese specific scripts)
const JAPANESE_KANA_REGEX = /[\u3040-\u30ff\uFF66-\uFF9F]/;
// Hangul (Korean specific script) - Updated to include more comprehensive range
const KOREAN_HANGUL_REGEX = /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F\uA960-\uA97F\uD7B0-\uD7FF]/;
// CJK Unified Ideographs (covers Chinese Hanzi, Japanese Kanji)
const CJK_IDEOGRAPHS_REGEX = /[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]/;

// All available agent internal names mapped to their portrait files
const AGENT_PORTRAITS: { [key: string]: string } = {
  'Aggrobot': 'AggrobotPortrait.webp',
  'BountyHunter': 'BountyHunterPortrait.webp',
  'Breach': 'BreachPortrait.webp',
  'Cable': 'CablePortrait.webp',
  'Cashew': 'CashewPortrait.webp',
  'Clay': 'ClayPortrait.webp',
  'Deadeye': 'DeadeyePortrait.webp',
  'Grenadier': 'GrenadierPortrait.webp',
  'Guide': 'GuidePortrait.webp',
  'Gumshoe': 'GumshoePortrait.webp',
  'Hunter': 'HunterPortrait.webp',
  'Killjoy': 'KilljoyPortrait.webp',
  'Mage': 'MagePortrait.webp',
  'Nox': 'NoxPortrait.webp',
  'Pandemic': 'PandemicPortrait.webp',
  'Phoenix': 'PhoenixPortrait.webp',
  'Rift': 'RiftPortrait.webp',
  'Sarge': 'SargePortrait.webp',
  'Sequoia': 'SequoiaPortrait.webp',
  'Smonk': 'SmonkPortrait.webp',
  'Sprinter': 'SprinterPortrait.webp',
  'Stealth': 'StealthPortrait.webp',
  'Terra': 'TerraPortrait.webp',
  'Thorne': 'ThornePortrait.webp',
  'Vampire': 'VampirePortrait.webp',
  'Wraith': 'WraithPortrait.webp',
  'Wushu': 'WushuPortrait.webp'
};

// All available maps for agent select
const AGENT_SELECT_MAPS: { [key: string]: string } = {
  'Abyss': 'Abyss.webp',
  'Ascent': 'Ascent.webp',
  'Bind': 'Bind.webp',
  'Breeze': 'Breeze.webp',
  'Corrode': 'Corrode.webp',
  'Fracture': 'Fracture.webp',
  'Haven': 'Haven.webp',
  'Icebox': 'Icebox.webp',
  'Lotus': 'Lotus.webp',
  'Pearl': 'Pearl.webp',
  'Split': 'Split.webp',
  'Sunset': 'Sunset.webp'
};

// Map Rive font names to their actual file paths
const FONT_PATHS: { [key: string]: string } = {
  'FoundryGridnikW03-Bold': '/assets/fonts/FoundryGridnikW03/Foundry Gridnik W03 Bold.ttf',
  'dinnextw1g_medium': '/assets/fonts/DINNextW1G/dinnextw1g_medium.otf',
  'Replica-Bold': '/assets/fonts/Replica/Replica-Bold.ttf',
  'NotoSansJP-Medium': '/assets/fonts/NotoSansMono/NotoSansJP-Medium.ttf',
  'NotoSansKR-Medium': '/assets/fonts/NotoSansMono/NotoSansKR-Medium.ttf',
  'NotoSansSC-Medium': '/assets/fonts/NotoSansMono/NotoSansSC-Medium.ttf'
};

async function loadAndDecodeFontHelper(asset: FileAsset, url: string): Promise<boolean> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Failed to fetch font (HTTP status not OK): ${url}, status: ${response.status}`);
      return false;
    }

    const fontArrayBuffer = await response.arrayBuffer();
    const fontBytes = new Uint8Array(fontArrayBuffer);
    
    (asset as FontAsset).decode(fontBytes);
    return true;
  } catch (e) {
    console.warn(`Failed to load and decode font for ${url}`, e);
    return false;
  }
}

async function loadAndDecodeImageHelper(asset: FileAsset, url: string, targetWidth?: number, targetHeight?: number): Promise<boolean> {
  let imageBitmap: ImageBitmap | null = null;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Failed to fetch image (HTTP status not OK): ${url}, status: ${response.status}`);
      return false;
    }

    const contentType = response.headers.get("Content-Type");
    if (!contentType || !contentType.startsWith("image/")) {
      console.warn(`Fetched resource is not an image type: ${url}, Content-Type: ${contentType}`);
      return false;
    }

    const imageBlob = await response.blob();
    let imageBytesToDecode: Uint8Array;

    if (targetWidth && targetHeight) {
      imageBitmap = await createImageBitmap(imageBlob);
      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext("2d")!;
      
      const scale = Math.min(targetWidth / imageBitmap.width, targetHeight / imageBitmap.height);
      const drawWidth = imageBitmap.width * scale;
      const drawHeight = imageBitmap.height * scale;
      const dx = (canvas.width - drawWidth) / 2;
      const dy = (canvas.height - drawHeight) / 2;
      
      ctx.drawImage(imageBitmap, dx, dy, drawWidth, drawHeight);
      
      const resizedBlob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/png");
      });
      
      if (!resizedBlob) {
        console.warn(`Canvas toBlob returned null for ${url}`);
        return false;
      }
      imageBytesToDecode = new Uint8Array(await resizedBlob.arrayBuffer());
    } else {
      imageBytesToDecode = new Uint8Array(await imageBlob.arrayBuffer());
    }

    (asset as ImageAsset).decode(imageBytesToDecode);
    return true;
  } catch (e) {
    console.warn(`Failed to load and decode image for ${url}`, e);
    return false;
  } finally {
    if (imageBitmap) {
      imageBitmap.close();
    }
  }
}

// Performance optimization: Disable verbose logging in production
const ENABLE_VERBOSE_LOGGING = false;

@Component({
  selector: "app-agent-select-v2",
  templateUrl: "./agent-select-v2.component.html",
  styleUrls: ["./agent-select-v2.component.scss"],
  standalone: true,
  imports: [NgIf],
})
export class AgentSelectV2Component implements OnInit, AfterViewInit, OnDestroy {

  // Performance optimized logging
  private log(message: string, ...args: any[]): void {
    if (ENABLE_VERBOSE_LOGGING) {
      console.log(message, ...args);
    }
  }

  private logError(message: string, ...args: any[]): void {
    console.error(message, ...args);
  }

  // Performance optimization: Add frame skipping to reduce update frequency
  private lastUpdateTime = 0;
  private readonly UPDATE_THROTTLE_MS = 16; // ~60fps max update rate

  // Performance optimization: Asset preloading with Image objects for faster access
  private preloadedImages = new Map<string, HTMLImageElement>();

  private async preloadImageAsBlob(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  }
  @ViewChild('canvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;

  groupCode = "UNKNOWN";
  socketService!: SocketService;
  
  match: any;
  teamLeft: any;
  teamRight: any;
  
  private riveInstance: Rive | null = null;
  private riveInitialized = false;
  private isInitializing = false;
  private canvasElement: HTMLCanvasElement | null = null;
  
  // Asset loading tracking
  private assetsToLoad = new Set<string>();
  private assetsLoaded = new Set<string>();
  private allAssetsLoaded = false;
  
  // Store raw image bytes for live updates
  private decodedAgentImages = new Map<string, Uint8Array>();
  
  // Store role image bytes for live updates
  private decodedRoleImages = new Map<string, Uint8Array>();
  
  // Store map image bytes for live updates
  private decodedMapImages = new Map<string, Uint8Array>();
  
  // Track current player states to detect changes
  private previousPlayerStates = new Map<number, { agentInternal: string | null, isLocked: boolean }>();
  
  // Timer management
  private timerInterval: any = null;
  private agentSelectStartTime: number | null = null;
  
  // Track current map to avoid unnecessary updates
  private currentMap: string | null = null;
  
  // Team logo URLs for tracking
  team1Url: string = "";
  team2Url: string = "";
  
  // Logo dimensions (matching original component)
  logoWidth = 4600;
  logoHeight = 4600;

  constructor(private route: ActivatedRoute, private config: Config, private agentRoleService: AgentRoleService, private agentNameService: AgentNameService) {
    this.route.queryParams.subscribe((params) => {
      this.groupCode = params["groupCode"]?.toUpperCase() || "UNKNOWN";
    });
  }

  ngOnInit(): void {
    this.initMatch();
  }

  ngAfterViewInit(): void {
    // Use setTimeout to ensure the view is fully initialized
    setTimeout(() => {
      this.initializeComponent();
    }, 0);
  }

  private initializeComponent(): void {
    if (!this.canvasRef) {
      console.error("Canvas element not found, retrying...");
      setTimeout(() => this.initializeComponent(), 100);
      return;
    }
    
    this.canvasElement = this.canvasRef.nativeElement;
    
    // Preload all agent portrait images first
    this.preloadAgentPortraits()
      .then(() => {
        return this.preloadRoleImages();
      })
      .then(() => {
        return this.preloadMapImages();
      })
      .then(() => {
        this.socketService = SocketService.getInstance().connectMatch(
          this.config.serverEndpoint,
          this.groupCode,
        );
        this.socketService.subscribeMatch((data: any) => {
          this.updateMatch(data);
        });
      })
      .catch(error => {
        console.error("Error preloading agent portraits:", error);
      });
  }

  private initMatch(): void {
    this.match = {
      groupCode: "A",
      isRanked: false,
      isRunning: true,
      roundNumber: 0,
      roundPhase: "LOBBY",
      teams: [
        { players: [], teamUrl: "", teamName: "TEAM A", isAttacking: false },
        { players: [], teamUrl: "", teamName: "TEAM B", isAttacking: false }
      ],
      spikeState: { planted: false },
      map: "Ascent",
      tools: {
        seriesInfo: { needed: 0, wonLeft: 0, wonRight: 0, mapInfo: [] },
        tournamentInfo: { logoUrl: "", name: "" }
      },
    };
    this.teamLeft = this.match.teams[0];
    this.teamRight = this.match.teams[1];
  }

  private async preloadAgentPortraits(): Promise<void> {
    const promises = Object.entries(AGENT_PORTRAITS).map(async ([agentInternal, filename]) => {
      try {
        const url = `/assets/agent-portraits/${filename}`;
        const response = await fetch(url);
        if (!response.ok) {
          console.warn(`Failed to preload agent portrait: ${url}`);
          return;
        }
        
        const imageBlob = await response.blob();
        const imageBytesToDecode = new Uint8Array(await imageBlob.arrayBuffer());
        
        // Store the raw bytes for now - we'll decode them when needed
        this.decodedAgentImages.set(agentInternal, imageBytesToDecode);
      } catch (error) {
        console.warn(`Failed to preload agent portrait for ${agentInternal}:`, error);
      }
    });
    
    await Promise.all(promises);
  }

  private async preloadRoleImages(): Promise<void> {
    const roles = ['Controller', 'Duelist', 'Initiator', 'Sentinel'];
    
    const promises = roles.map(async (role) => {
      try {
        const url = `/assets/roles/${role}.webp`;
        const response = await fetch(url);
        if (!response.ok) {
          console.warn(`Failed to preload role image: ${url}`);
          return;
        }
        
        const imageBlob = await response.blob();
        const imageBytesToDecode = new Uint8Array(await imageBlob.arrayBuffer());
        
        // Store the raw bytes for role images
        this.decodedRoleImages.set(role, imageBytesToDecode);
      } catch (error) {
        console.warn(`Failed to preload role image for ${role}:`, error);
      }
    });

    await Promise.all(promises);
  }  private async preloadMapImages(): Promise<void> {
    const promises = Object.entries(AGENT_SELECT_MAPS).map(async ([mapName, filename]) => {
      try {
        const url = `/assets/maps/agent-select/${filename}`;
        const response = await fetch(url);
        if (!response.ok) {
          console.warn(`Failed to preload map image: ${url}`);
          return;
        }
        
        const imageBlob = await response.blob();
        const imageBytesToDecode = new Uint8Array(await imageBlob.arrayBuffer());
        
        // Store the raw bytes for map images
        this.decodedMapImages.set(mapName, imageBytesToDecode);
      } catch (error) {
        console.warn(`Failed to preload map image for ${mapName}:`, error);
      }
    });

    await Promise.all(promises);
  }  private populateExpectedAssets(): void {
    // Expected assets for this v2 component
    this.assetsToLoad.add('team1Logo');
    this.assetsToLoad.add('team2Logo');
    this.assetsToLoad.add('eventLogo');
    
    // All font assets
    Object.keys(FONT_PATHS).forEach(fontName => {
      this.assetsToLoad.add(fontName);
    });
    
    // All agent portraits are preloaded as referenced assets
    Object.keys(AGENT_PORTRAITS).forEach(agentInternal => {
      this.assetsToLoad.add(agentInternal + 'Portrait');
    });
    
    // All role images are preloaded
    const roles = ['Controller', 'Duelist', 'Initiator', 'Sentinel'];
    roles.forEach(role => {
      this.assetsToLoad.add(role + 'Role');
    });
    
    // Map image is preloaded
    this.assetsToLoad.add('map');
  }

  private markAssetAsLoaded(assetName: string): void {
    this.assetsLoaded.add(assetName);
    
    if (this.assetsLoaded.size === this.assetsToLoad.size && !this.allAssetsLoaded) {
      this.allAssetsLoaded = true;
      
      // Start playback now that all assets are loaded
      if (this.riveInitialized) {
        this.startRivePlayback();
      }
    }
  }

  private startRivePlayback(): void {
    if (!this.riveInstance || !this.canvasElement) {
      console.error("Cannot start playback: Rive instance or canvas not available");
      return;
    }

    // Make canvas visible and start playback
    this.canvasElement.style.visibility = 'visible';
    
    requestAnimationFrame(() => {
      if (this.riveInstance) {
        this.riveInstance.play();
        
        // Update all data bindings after animation starts
        this.updatePlayerAgentPortraits();
        this.updatePlayerRoles();
        this.updateTeamColors();
        this.updateTeamSides();
        this.updateTimer();
        this.updateMap();
        this.updateTeamNames();
        this.updatePlayerNames();
        this.updatePlayerAgentNames();
        this.updatePlayerLockedTextColors();
        this.updateMapVisualizer();
      }
    });
  }

  private initializeRive(): void {
    if (this.riveInitialized || !this.canvasElement || this.isInitializing) {
      return;
    }

    this.isInitializing = true;

    // Reset asset tracking
    this.assetsToLoad.clear();
    this.assetsLoaded.clear();
    this.allAssetsLoaded = false;
    
    this.populateExpectedAssets();

    // Add a timeout to ensure animation starts even if assets are slow to load
    setTimeout(() => {
      if (!this.allAssetsLoaded) {
        this.allAssetsLoaded = true;
        if (this.riveInitialized) {
          this.startRivePlayback();
        }
      }
    }, 5000);

    this.canvasElement.width = 1920;
    this.canvasElement.height = 1080;
    this.canvasElement.style.visibility = 'hidden';

    const riveParams: RiveParameters = {
      src: "/assets/agentSelect/v2/agent_select_v2.riv",
      canvas: this.canvasElement,
      artboard: "Artboard", // Specify the artboard name
      stateMachines: ["State Machine 1"],
      autoplay: false, // Prevent autoplay until assets are loaded
      autoBind: true,
      layout: new Layout({
        fit: Fit.FitWidth,
        alignment: Alignment.Center,
      }),
      // @ts-ignore - Rive runtime supports async assetLoader
      assetLoader: async (asset: FileAsset, bytes: Uint8Array) => {
        // Handle font assets
        if (asset.isFont && FONT_PATHS[asset.name]) {
          const fontUrl = FONT_PATHS[asset.name];
          const result = await loadAndDecodeFontHelper(asset, fontUrl);
          if (result) {
            this.markAssetAsLoaded(asset.name);
          }
          return result;
        }

        // Handle agent portrait assets
        const agentPortraitMatch = asset.name.match(/^(.+)Portrait$/);
        if (asset.isImage && agentPortraitMatch) {
          const agentInternal = agentPortraitMatch[1];
          if (AGENT_PORTRAITS[agentInternal]) {
            const url = `/assets/agent-portraits/${AGENT_PORTRAITS[agentInternal]}`;
            const result = await loadAndDecodeImageHelper(asset, url);
            if (result) {
              this.markAssetAsLoaded(asset.name);
            }
            return result;
          }
        }

        // Handle role assets
        const roleMatch = asset.name.match(/^(.+)Role$/);
        if (asset.isImage && roleMatch) {
          const roleName = roleMatch[1];
          const url = `/assets/roles/${roleName}.webp`;
          const result = await loadAndDecodeImageHelper(asset, url);
          if (result) {
            this.markAssetAsLoaded(asset.name);
          }
          return result;
        }

        // Handle team logos
        if (asset.isImage && asset.name === "team1Logo") {
          let url = this.match?.teams?.[0]?.teamUrl || "../../assets/misc/icon.webp";
          if (/^https?:\/\//.test(url) && !url.startsWith('/proxy-image')) {
            url = `/proxy-image?url=${encodeURIComponent(url)}`;
          }
          const result = await loadAndDecodeImageHelper(asset, url, this.logoWidth, this.logoHeight);
          if (result) {
            this.markAssetAsLoaded(asset.name);
          }
          return result;
        }

        if (asset.isImage && asset.name === "team2Logo") {
          let url = this.match?.teams?.[1]?.teamUrl || "../../assets/misc/icon.webp";
          if (/^https?:\/\//.test(url) && !url.startsWith('/proxy-image')) {
            url = `/proxy-image?url=${encodeURIComponent(url)}`;
          }
          const result = await loadAndDecodeImageHelper(asset, url, this.logoWidth, this.logoHeight);
          if (result) {
            this.markAssetAsLoaded(asset.name);
          }
          return result;
        }

        // Handle event logo
        if (asset.isImage && asset.name === "eventLogo") {
          let url = this.match?.tools?.tournamentInfo?.logoUrl && this.match.tools.tournamentInfo.logoUrl !== ""
              ? this.match.tools.tournamentInfo.logoUrl
              : "../../assets/misc/logo.webp";
          if (/^https?:\/\//.test(url) && !url.startsWith('/proxy-image')) {
            url = `/proxy-image?url=${encodeURIComponent(url)}`;
          }
          const result = await loadAndDecodeImageHelper(asset, url, 1400, 1400);
          if (result) {
            this.markAssetAsLoaded(asset.name);
          }
          return result;
        }

        // Handle map asset
        if (asset.isImage && asset.name === "map") {
          const currentMap = this.match?.map;
          if (currentMap && AGENT_SELECT_MAPS[currentMap]) {
            const url = `/assets/maps/agent-select/${AGENT_SELECT_MAPS[currentMap]}`;
            const result = await loadAndDecodeImageHelper(asset, url);
            if (result) {
              this.markAssetAsLoaded(asset.name);
            }
            return result;
          } else {
            // If no map is set, still mark as loaded to avoid blocking
            this.markAssetAsLoaded(asset.name);
            return false;
          }
        }

        console.warn(`Asset '${asset.name}' not handled by assetLoader.`);
        return false;
      },
      onLoad: () => {

        // Initialize all player locked states
        let vmi = (this.riveInstance as any).viewModelInstance;
        
        // Initialize Team 1 (players 1-5)
        if (this.match?.teams?.[0]?.players) {
          for (let i = 0; i < Math.min(5, this.match.teams[0].players.length); i++) {
            const player = this.match.teams[0].players[i];
            const playerIndex = i + 1;
            const propertyName = `p${playerIndex}Locked`;
            const booleanProperty = vmi.boolean(propertyName);
            
            if (booleanProperty) {
              const isLocked = player?.locked || false;
              booleanProperty.value = isLocked;
            }
          }
        }
        
        // Initialize Team 2 (players 6-10)
        if (this.match?.teams?.[1]?.players) {
          for (let i = 0; i < Math.min(5, this.match.teams[1].players.length); i++) {
            const player = this.match.teams[1].players[i];
            const playerIndex = i + 6; // Players 6-10
            const propertyName = `p${playerIndex}Locked`;
            const booleanProperty = vmi.boolean(propertyName);
            
            if (booleanProperty) {
              const isLocked = player?.locked || false;
              booleanProperty.value = isLocked;
            }
          }
        }
        
        // Don't make canvas visible or start animation yet - wait for assets
        this.riveInitialized = true;
        this.isInitializing = false;
        
        // Check if all assets are already loaded, if so start playback
        if (this.allAssetsLoaded) {
          this.startRivePlayback();
        }
      },
      onLoadError: (error: any) => {
        this.logError("Rive load error:", error);
        this.riveInitialized = false;
        this.isInitializing = false;
        if (this.canvasElement) {
          this.canvasElement.style.visibility = 'hidden';
        }
      }
    };

    this.riveInstance = new Rive(riveParams);
  }

  public updateMatch(data: any): void {
    delete data.eventNumber;
    delete data.replayLog;
    this.match = data;

    this.team1Url = this.match.teams[0].teamUrl || "../../assets/misc/icon.webp";
    this.team2Url = this.match.teams[1].teamUrl || "../../assets/misc/icon.webp";
    this.teamLeft = this.match.teams[0];
    this.teamRight = this.match.teams[1];

    // Only initialize Rive once, and only when both team URLs are set (not empty/default)
    if (
      !this.riveInitialized &&
      this.match.teams[0].teamUrl &&
      this.match.teams[1].teamUrl &&
      this.match.teams[0].teamUrl !== "" &&
      this.match.teams[1].teamUrl !== ""
    ) {
      this.initializeRive();
      return;
    }

    // Update live agent portraits if Rive is ready (only update what changed)
    if (this.riveInstance && this.riveInitialized) {
      this.updatePlayerAgentPortraitsSelectively();
      this.updatePlayerRolesSelectively();
      this.updateTeamColors();
      this.updateTeamSides();
      this.updateTimer();
      this.updateMap();
      this.updateTeamNames();
      this.updatePlayerNames();
      this.updatePlayerAgentNames();
      this.updatePlayerLockedTextColors();
      this.updateMapVisualizer();
    } else if (!this.riveInitialized) {
      // Waiting for team URLs
    }
  }

  private async updatePlayerAgentPortraits(): Promise<void> {
    if (!this.riveInstance || !this.riveInitialized) {
      return;
    }

    try {
      // Access the view model instance (auto-bound)
      const viewModelInstance = (this.riveInstance as any).viewModelInstance;
      if (!viewModelInstance) {
        console.error("ViewModelInstance not found");
        return;
      }

      // Access the nested view model for player agent portraits
      const playerAgentPortraitsVM = viewModelInstance.viewModel("playerAgentPortraits");
      if (!playerAgentPortraitsVM) {
        console.error("playerAgentPortraits view model not found");
        return;
      }

      // Update player portraits for both teams (players 1-10)
      let playerIndex = 1;
      
      // Team 1 (players 1-5)
      if (this.match.teams[0] && this.match.teams[0].players) {
        for (const [index, player] of this.match.teams[0].players.entries()) {
          if (index < 5) {
            await this.updatePlayerPortrait(playerAgentPortraitsVM, playerIndex, player);
            playerIndex++;
          }
        }
      }
      
      // Fill remaining slots for team 1 if needed
      while (playerIndex <= 5) {
        await this.updatePlayerPortrait(playerAgentPortraitsVM, playerIndex, null);
        playerIndex++;
      }

      // Team 2 (players 6-10)
      if (this.match.teams[1] && this.match.teams[1].players) {
        for (const [index, player] of this.match.teams[1].players.entries()) {
          if (index < 5) {
            await this.updatePlayerPortrait(playerAgentPortraitsVM, playerIndex, player);
            playerIndex++;
          }
        }
      }
      
      // Fill remaining slots for team 2 if needed
      while (playerIndex <= 10) {
        await this.updatePlayerPortrait(playerAgentPortraitsVM, playerIndex, null);
        playerIndex++;
      }

      // Update state tracking after full update
      this.updatePlayerStateTracking();

    } catch (error) {
      console.error("Error updating player agent portraits:", error);
    }
  }

  private async updatePlayerAgentPortraitsSelectively(): Promise<void> {
    if (!this.riveInstance || !this.riveInitialized) {
      return;
    }

    try {
      // Access the view model instance (auto-bound)
      const viewModelInstance = (this.riveInstance as any).viewModelInstance;
      if (!viewModelInstance) {
        console.error("ViewModelInstance not found");
        return;
      }

      // Access the nested view model for player agent portraits
      const playerAgentPortraitsVM = viewModelInstance.viewModel("playerAgentPortraits");
      if (!playerAgentPortraitsVM) {
        console.error("playerAgentPortraits view model not found");
        return;
      }

      let playerIndex = 1;
      const updatesNeeded: Array<{ playerIndex: number, player: any }> = [];
      
      // Team 1 (players 1-5)
      if (this.match.teams[0] && this.match.teams[0].players) {
        for (const [index, player] of this.match.teams[0].players.entries()) {
          if (index < 5) {
            if (this.hasPlayerChanged(playerIndex, player)) {
              updatesNeeded.push({ playerIndex, player });
            }
            playerIndex++;
          }
        }
      }
      
      // Fill remaining slots for team 1 if needed
      while (playerIndex <= 5) {
        if (this.hasPlayerChanged(playerIndex, null)) {
          updatesNeeded.push({ playerIndex, player: null });
        }
        playerIndex++;
      }

      // Team 2 (players 6-10)
      if (this.match.teams[1] && this.match.teams[1].players) {
        for (const [index, player] of this.match.teams[1].players.entries()) {
          if (index < 5) {
            if (this.hasPlayerChanged(playerIndex, player)) {
              updatesNeeded.push({ playerIndex, player });
            }
            playerIndex++;
          }
        }
      }
      
      // Fill remaining slots for team 2 if needed
      while (playerIndex <= 10) {
        if (this.hasPlayerChanged(playerIndex, null)) {
          updatesNeeded.push({ playerIndex, player: null });
        }
        playerIndex++;
      }

      // Only update players that have changed
      if (updatesNeeded.length > 0) {
        for (const update of updatesNeeded) {
          await this.updatePlayerPortrait(playerAgentPortraitsVM, update.playerIndex, update.player);
        }
        
        // Update state tracking after selective updates
        this.updatePlayerStateTracking();
      } else {
        // No player changes detected, skipping update
      }

    } catch (error) {
      console.error("Error updating player agent portraits selectively:", error);
    }
  }

  private hasPlayerChanged(playerIndex: number, currentPlayer: any): boolean {
    const previousState = this.previousPlayerStates.get(playerIndex);
    const currentAgentInternal = currentPlayer?.agentInternal || null;
    const currentIsLocked = currentPlayer?.locked || false;

    if (!previousState) {
      // First time checking this player
      this.updatePlayerLockedStateAndAdvance(playerIndex, currentIsLocked);
      
      return true;
    }

    const agentChanged = previousState.agentInternal !== currentAgentInternal;
    const lockedChanged = previousState.isLocked !== currentIsLocked;
    const hasChanged = agentChanged || lockedChanged;

    if (hasChanged) {
      // Update locked state and advance state machine when locked state changes
      if (lockedChanged) {
        this.updatePlayerLockedStateAndAdvance(playerIndex, currentIsLocked);
      }
    }

    return hasChanged;
  }

  private updatePlayerStateTracking(): void {
    // Clear previous states
    this.previousPlayerStates.clear();
    
    let playerIndex = 1;
    
    // Track Team 1 (players 1-5)
    if (this.match.teams[0] && this.match.teams[0].players) {
      for (const [index, player] of this.match.teams[0].players.entries()) {
        if (index < 5) {
          this.previousPlayerStates.set(playerIndex, {
            agentInternal: player?.agentInternal || null,
            isLocked: player?.locked || false
          });
          playerIndex++;
        }
      }
    }
    
    // Fill remaining slots for team 1
    while (playerIndex <= 5) {
      this.previousPlayerStates.set(playerIndex, {
        agentInternal: null,
        isLocked: false
      });
      playerIndex++;
    }

    // Track Team 2 (players 6-10)
    if (this.match.teams[1] && this.match.teams[1].players) {
      for (const [index, player] of this.match.teams[1].players.entries()) {
        if (index < 5) {
          this.previousPlayerStates.set(playerIndex, {
            agentInternal: player?.agentInternal || null,
            isLocked: player?.locked || false
          });
          playerIndex++;
        }
      }
    }
    
    // Fill remaining slots for team 2
    while (playerIndex <= 10) {
      this.previousPlayerStates.set(playerIndex, {
        agentInternal: null,
        isLocked: false
      });
      playerIndex++;
    }
  }

  private async updatePlayerRoles(): Promise<void> {
    if (!this.riveInstance || !this.riveInitialized) {
      return;
    }

    try {
      // Access the view model instance (auto-bound)
      const viewModelInstance = (this.riveInstance as any).viewModelInstance;
      if (!viewModelInstance) {
        console.error("ViewModelInstance not found for roles");
        return;
      }

      // Access the nested view model for player roles
      const playerRolesVM = viewModelInstance.viewModel("playerRoles");
      if (!playerRolesVM) {
        console.error("playerRoles view model not found");
        return;
      }

      // Update player roles for both teams (players 1-10)
      let playerIndex = 1;
      
      // Team 1 (players 1-5)
      if (this.match.teams[0] && this.match.teams[0].players) {
        for (const [index, player] of this.match.teams[0].players.entries()) {
          if (index < 5) {
            await this.updatePlayerRole(playerRolesVM, playerIndex, player);
            playerIndex++;
          }
        }
      }
      
      // Fill remaining slots for team 1 if needed
      while (playerIndex <= 5) {
        await this.updatePlayerRole(playerRolesVM, playerIndex, null);
        playerIndex++;
      }

      // Team 2 (players 6-10)
      if (this.match.teams[1] && this.match.teams[1].players) {
        for (const [index, player] of this.match.teams[1].players.entries()) {
          if (index < 5) {
            await this.updatePlayerRole(playerRolesVM, playerIndex, player);
            playerIndex++;
          }
        }
      }
      
      // Fill remaining slots for team 2 if needed
      while (playerIndex <= 10) {
        await this.updatePlayerRole(playerRolesVM, playerIndex, null);
        playerIndex++;
      }

      // Update state tracking after full update
      this.updatePlayerStateTracking();

    } catch (error) {
      console.error("Error updating player agent roles:", error);
    }
  }

  private async updatePlayerRolesSelectively(): Promise<void> {
    if (!this.riveInstance || !this.riveInitialized) {
      return;
    }

    try {
      // Access the view model instance (auto-bound)
      const viewModelInstance = (this.riveInstance as any).viewModelInstance;
      if (!viewModelInstance) {
        console.error("ViewModelInstance not found for roles");
        return;
      }

      // Access the nested view model for player roles
      const playerRolesVM = viewModelInstance.viewModel("playerRoles");
      if (!playerRolesVM) {
        console.error("playerRoles view model not found");
        return;
      }

      let playerIndex = 1;
      const roleUpdatesNeeded: Array<{ playerIndex: number, player: any }> = [];
      
      // Team 1 (players 1-5)
      if (this.match.teams[0] && this.match.teams[0].players) {
        for (const [index, player] of this.match.teams[0].players.entries()) {
          if (index < 5) {
            if (this.hasPlayerChanged(playerIndex, player)) {
              roleUpdatesNeeded.push({ playerIndex, player });
            }
            playerIndex++;
          }
        }
      }
      
      // Fill remaining slots for team 1 if needed
      while (playerIndex <= 5) {
        if (this.hasPlayerChanged(playerIndex, null)) {
          roleUpdatesNeeded.push({ playerIndex, player: null });
        }
        playerIndex++;
      }

      // Team 2 (players 6-10)
      if (this.match.teams[1] && this.match.teams[1].players) {
        for (const [index, player] of this.match.teams[1].players.entries()) {
          if (index < 5) {
            if (this.hasPlayerChanged(playerIndex, player)) {
              roleUpdatesNeeded.push({ playerIndex, player });
            }
            playerIndex++;
          }
        }
      }
      
      // Fill remaining slots for team 2 if needed
      while (playerIndex <= 10) {
        if (this.hasPlayerChanged(playerIndex, null)) {
          roleUpdatesNeeded.push({ playerIndex, player: null });
        }
        playerIndex++;
      }

      // Only update roles for players that have changed
      if (roleUpdatesNeeded.length > 0) {
        for (const update of roleUpdatesNeeded) {
          await this.updatePlayerRole(playerRolesVM, update.playerIndex, update.player);
        }
      } else {
        // No role changes detected, skipping role update
      }

    } catch (error) {
      console.error("Error updating player agent roles selectively:", error);
    }
  }

  private async updatePlayerRole(playerRolesVM: any, playerNumber: number, player: any): Promise<void> {
    try {
      const propertyName = `player${playerNumber}Role`;
      const imageProperty = playerRolesVM.image(propertyName);
      
      if (!imageProperty) {
        console.warn(`Role image property ${propertyName} not found`);
        return;
      }

      if (player && player.agentInternal) {
        // Convert internal name to display name first
        const agentDisplayName = AgentNameService.getAgentName(player.agentInternal);
        
        if (agentDisplayName) {
          // Get the role using the original internal name (not display name)
          const agentRole = AgentRoleService.getAgentRole(player.agentInternal);
          
          if (agentRole) {
            // Get the preloaded role image bytes
            const roleImageBytes = this.decodedRoleImages.get(agentRole);
            if (roleImageBytes) {
              try {
                // Decode the role image using Rive's decodeImage function
                const decodedRoleImage = await decodeImage(roleImageBytes);
                imageProperty.value = decodedRoleImage;
              } catch (decodeError) {
                console.error(`Failed to decode role image for ${agentRole}:`, decodeError);
                imageProperty.value = null;
              }
            } else {
              console.warn(`No preloaded role image found for: ${agentRole}`);
              imageProperty.value = null;
            }
          } else {
            console.warn(`No role found for agent: ${player.agentInternal} (display: ${agentDisplayName})`);
            imageProperty.value = null;
          }
        } else {
          console.warn(`No display name found for internal agent: ${player.agentInternal}`);
          imageProperty.value = null;
        }
      } else {
        // Clear the role image if no agent selected
        imageProperty.value = null;
      }
    } catch (error) {
      console.error(`Error updating player ${playerNumber} role:`, error);
    }
  }

  private async updatePlayerLockedStates(): Promise<void> {
    if (!this.riveInstance || !this.riveInitialized) {
      return;
    }

    try {
      // Access the auto-bound view model instance directly (this is the Default view model)
      const viewModelInstance = (this.riveInstance as any).viewModelInstance;
      if (!viewModelInstance) {
        console.error("ViewModelInstance not found for locked states");
        return;
      }

      let playerIndex = 1;
      
      // Update Team 1 (players 1-5)
      if (this.match.teams[0] && this.match.teams[0].players) {
        for (const [index, player] of this.match.teams[0].players.entries()) {
          if (index < 5) {
            await this.updatePlayerLockedState(viewModelInstance, playerIndex, player);
            playerIndex++;
          }
        }
        
        // Fill remaining slots for team 1
        while (playerIndex <= 5) {
          await this.updatePlayerLockedState(viewModelInstance, playerIndex, null);
          playerIndex++;
        }
      }
      // Update Team 2 (players 6-10)
      if (this.match.teams[1] && this.match.teams[1].players) {
        for (const [index, player] of this.match.teams[1].players.entries()) {
          if (index < 5) {
            await this.updatePlayerLockedState(viewModelInstance, playerIndex, player);
            playerIndex++;
          }
        }
        
        // Fill remaining slots for team 2
        while (playerIndex <= 10) {
          await this.updatePlayerLockedState(viewModelInstance, playerIndex, null);
          playerIndex++;
        }
      }

    } catch (error) {
      console.error("Error updating player locked states:", error);
    }
  }

  private async updatePlayerLockedState(viewModelInstance: any, playerNumber: number, player: any): Promise<void> {
    try {
      const propertyName = `p${playerNumber}locked`; // Lowercase to match Rive animation
      const booleanProperty = viewModelInstance.boolean(propertyName);
      
      if (!booleanProperty) {
        console.warn(`Boolean property ${propertyName} not found`);
        return;
      }

      const isLocked = player?.locked || false;
      const previousValue = booleanProperty.value;
      
      booleanProperty.value = isLocked;
      
      // Manually advance the state machine and artboard to apply property changes
      // Based on Rive docs: stateMachine.advance() -> artboard.advance()
      if (this.riveInstance) {
        try {
          // Access the underlying state machine and artboard instances
          const stateMachineInstance = (this.riveInstance as any).stateMachineInstances?.[0];
          const artboardInstance = (this.riveInstance as any).artboard;
          
          if (stateMachineInstance && artboardInstance) {
            // Advance by a small time delta to trigger property update
            const deltaTime = 0.016; // ~60fps frame time
            stateMachineInstance.advance(deltaTime);
            artboardInstance.advance(deltaTime);
          } else {
            console.warn('Could not access state machine or artboard instances');
          }
        } catch (error) {
          console.warn('Error advancing state machine/artboard:', error);
        }
      }
      
      // Verify the change was applied
      setTimeout(() => {
        const currentValue = booleanProperty.value;
        console.log(`� Verification - ${propertyName} is now: ${currentValue}`);
      }, 100);

    } catch (error) {
      console.error(`Error updating player ${playerNumber} locked state:`, error);
    }
  }

  private async updatePlayerPortrait(playerAgentPortraitsVM: any, playerNumber: number, player: any): Promise<void> {
    try {
      const propertyName = `p${playerNumber}AgentPortrait`;
      const imageProperty = playerAgentPortraitsVM.image(propertyName);
      
      if (!imageProperty) {
        console.warn(`Image property ${propertyName} not found`);
        return;
      }

      if (player && player.agentInternal) {
        // Get the preloaded image bytes
        const imageBytes = this.decodedAgentImages.get(player.agentInternal);
        if (imageBytes) {
          try {
            // Decode the image using Rive's decodeImage function
            const decodedImage = await decodeImage(imageBytes);
            imageProperty.value = decodedImage;
          } catch (decodeError) {
            console.error(`Failed to decode image for ${player.agentInternal}:`, decodeError);
            imageProperty.value = null;
          }
        } else {
          console.warn(`No preloaded image found for agent: ${player.agentInternal}`);
          imageProperty.value = null;
        }
      } else {
        // Clear the image if no agent selected
        imageProperty.value = null;
      }
    } catch (error) {
      console.error(`Error updating player ${playerNumber} portrait:`, error);
    }
  }

  private updateTeamColors(): void {
    if (!this.riveInstance || !this.riveInitialized) {
      return;
    }

    try {
      // Access the view model instance (auto-bound)
      const viewModelInstance = (this.riveInstance as any).viewModelInstance;
      if (!viewModelInstance) {
        console.error("ViewModelInstance not found for team colors");
        return;
      }

      // Team color logic
      const attackerColor = 0xFFE5375F;
      const defenderColor = 0xFF46F4CF;
      const team1IsAttacking = this.match?.teams?.[0]?.isAttacking || false;
      const team2IsAttacking = this.match?.teams?.[1]?.isAttacking || false;
      const leftTeamColor = team1IsAttacking ? attackerColor : defenderColor;
      const rightTeamColor = team2IsAttacking ? attackerColor : defenderColor;

      // Set team colors only
      const leftTeamColorProperty = viewModelInstance.color("leftTeam");
      if (leftTeamColorProperty) leftTeamColorProperty.value = leftTeamColor;
      const rightTeamColorProperty = viewModelInstance.color("rightTeam");
      if (rightTeamColorProperty) rightTeamColorProperty.value = rightTeamColor;

      // Access the teamGradients nested view model
      const teamGradientsVM = viewModelInstance.viewModel("teamGradients");
      if (!teamGradientsVM) {
        console.error("teamGradients view model not found!");
        return;
      }

      // Set leftGlowGradientStart - left team color at 56% opacity
      const leftGlowGradientStart = teamGradientsVM.color("leftGlowGradientStart");
      if (leftGlowGradientStart) {
        const leftStartColor = team1IsAttacking ? 0x8FE5375F : 0x8F46F4CF;
        leftGlowGradientStart.value = leftStartColor;
      }

      // Set leftGlowGradientEnd - left team color at 0% opacity
      const leftGlowGradientEnd = teamGradientsVM.color("leftGlowGradientEnd");
      if (leftGlowGradientEnd) {
        const leftEndColor = team1IsAttacking ? 0x00E5375F : 0x0046F4CF;
        leftGlowGradientEnd.value = leftEndColor;
      }

      // Set rightGlowGradientStart - right team color at 56% opacity
      const rightGlowGradientStart = teamGradientsVM.color("rightGlowGradientStart");
      if (rightGlowGradientStart) {
        const rightStartColor = team2IsAttacking ? 0x8FE5375F : 0x8F46F4CF;
        rightGlowGradientStart.value = rightStartColor;
      }

      // Set rightGlowGradientEnd - right team color at 0% opacity
      const rightGlowGradientEnd = teamGradientsVM.color("rightGlowGradientEnd");
      if (rightGlowGradientEnd) {
        const rightEndColor = team2IsAttacking ? 0x00E5375F : 0x0046F4CF;
        rightGlowGradientEnd.value = rightEndColor;
      }

      // Force animation refresh after setting gradient properties
      if (this.riveInstance) {
        try {
          const stateMachineInstance = (this.riveInstance as any).stateMachineInstances?.[0];
          const artboardInstance = (this.riveInstance as any).artboard;
          
          if (stateMachineInstance && artboardInstance) {
            const deltaTime = 0.016;
            stateMachineInstance.advance(deltaTime);
            artboardInstance.advance(deltaTime);
          }
        } catch (error) {
          console.warn("Error advancing animation for gradient refresh:", error);
        }
      }
    } catch (error) {
      console.error("Error updating team colors:", error);
    }
  }

  private updateTeamNames(): void {
    if (!this.riveInstance || !this.riveInitialized) {
      return;
    }

    try {
      // Access the view model instance (auto-bound)
      const viewModelInstance = (this.riveInstance as any).viewModelInstance;
      if (!viewModelInstance) {
        console.error("ViewModelInstance not found for team names");
        return;
      }

      // Update team 1 name
      const team1NameProperty = viewModelInstance.string("team1Name");
      if (team1NameProperty) {
        const team1Name = (this.match?.teams?.[0]?.teamName || "TEAM A").toUpperCase();
        team1NameProperty.value = team1Name;
      } else {
        console.warn("team1Name string property not found");
      }

      // Update team 2 name
      const team2NameProperty = viewModelInstance.string("team2Name");
      if (team2NameProperty) {
        const team2Name = (this.match?.teams?.[1]?.teamName || "TEAM B").toUpperCase();
        team2NameProperty.value = team2Name;
      } else {
        console.warn("team2Name string property not found");
      }

    } catch (error) {
      console.error("Error updating team names:", error);
    }
  }

  private updateTeamSides(): void {
    if (!this.riveInstance || !this.riveInitialized) {
      return;
    }

    try {
      // Access the view model instance (auto-bound)
      const viewModelInstance = (this.riveInstance as any).viewModelInstance;
      if (!viewModelInstance) {
        console.error("ViewModelInstance not found for team sides");
        return;
      }

      // Determine team sides based on attacking status
      const team1Side = this.match?.teams?.[0]?.isAttacking ? "ATK" : "DEF";
      const team2Side = this.match?.teams?.[1]?.isAttacking ? "ATK" : "DEF";

      // Update team1Side string property
      const team1SideProperty = viewModelInstance.string("team1Side");
      if (team1SideProperty) {
        team1SideProperty.value = team1Side;
      } else {
        console.warn("team1Side string property not found");
      }

      // Update team2Side string property
      const team2SideProperty = viewModelInstance.string("team2Side");
      if (team2SideProperty) {
        team2SideProperty.value = team2Side;
      } else {
        console.warn("team2Side string property not found");
      }

    } catch (error) {
      console.error("Error updating team sides:", error);
    }
  }

  private updatePlayerNames(): void {
    if (!this.riveInstance || !this.riveInitialized) {
      return;
    }

    try {
      // Access the view model instance (auto-bound)
      const viewModelInstance = (this.riveInstance as any).viewModelInstance;
      if (!viewModelInstance) {
        console.error("ViewModelInstance not found for player names");
        return;
      }

      // Access the nested view model for player names
      const playerNamesVM = viewModelInstance.viewModel("playerNames");
      if (!playerNamesVM) {
        console.error("playerNames view model not found");
        return;
      }

      let playerIndex = 1;
      
      // Team 1 (players 1-5)
      if (this.match.teams[0] && this.match.teams[0].players) {
        for (const [index, player] of this.match.teams[0].players.entries()) {
          if (index < 5) {
            this.updatePlayerName(playerNamesVM, playerIndex, player);
            playerIndex++;
          }
        }
      }
      
      // Fill remaining slots for team 1 if needed
      while (playerIndex <= 5) {
        this.updatePlayerName(playerNamesVM, playerIndex, null);
        playerIndex++;
      }

      // Team 2 (players 6-10)
      if (this.match.teams[1] && this.match.teams[1].players) {
        for (const [index, player] of this.match.teams[1].players.entries()) {
          if (index < 5) {
            this.updatePlayerName(playerNamesVM, playerIndex, player);
            playerIndex++;
          }
        }
      }
      
      // Fill remaining slots for team 2 if needed
      while (playerIndex <= 10) {
        this.updatePlayerName(playerNamesVM, playerIndex, null);
        playerIndex++;
      }

    } catch (error) {
      console.error("Error updating player names:", error);
    }
  }

  private updatePlayerName(playerNamesVM: any, playerNumber: number, player: any): void {
    try {
      const propertyName = `p${playerNumber}Name`;
      const stringProperty = playerNamesVM.string(propertyName);
      
      if (!stringProperty) {
        console.warn(`String property ${propertyName} not found`);
        return;
      }

      if (player) {
        const playerName = this.getPlayerDisplayName(player);
        stringProperty.value = playerName;
      } else {
        // Clear the name if no player
        stringProperty.value = "";
      }
    } catch (error) {
      console.error(`Error updating player ${playerNumber} name:`, error);
    }
  }

  private updatePlayerAgentNames(): void {
    if (!this.riveInstance || !this.riveInitialized) {
      return;
    }

    try {
      // Access the view model instance (auto-bound)
      const viewModelInstance = (this.riveInstance as any).viewModelInstance;
      if (!viewModelInstance) {
        console.error("ViewModelInstance not found for player agent names");
        return;
      }

      // Access the nested view model for player agents
      const playerAgentsVM = viewModelInstance.viewModel("playerAgents");
      if (!playerAgentsVM) {
        console.error("playerAgents view model not found");
        return;
      }

      let playerIndex = 1;
      
      // Team 1 (players 1-5)
      if (this.match.teams[0] && this.match.teams[0].players) {
        for (const [index, player] of this.match.teams[0].players.entries()) {
          if (index < 5) {
            this.updatePlayerAgentName(playerAgentsVM, playerIndex, player);
            playerIndex++;
          }
        }
      }
      
      // Fill remaining slots for team 1 if needed
      while (playerIndex <= 5) {
        this.updatePlayerAgentName(playerAgentsVM, playerIndex, null);
        playerIndex++;
      }

      // Team 2 (players 6-10)
      if (this.match.teams[1] && this.match.teams[1].players) {
        for (const [index, player] of this.match.teams[1].players.entries()) {
          if (index < 5) {
            this.updatePlayerAgentName(playerAgentsVM, playerIndex, player);
            playerIndex++;
          }
        }
      }
      
      // Fill remaining slots for team 2 if needed
      while (playerIndex <= 10) {
        this.updatePlayerAgentName(playerAgentsVM, playerIndex, null);
        playerIndex++;
      }

    } catch (error) {
      console.error("Error updating player agent names:", error);
    }
  }

  private updatePlayerAgentName(playerAgentsVM: any, playerNumber: number, player: any): void {
    try {
      const propertyName = `p${playerNumber}Agent`;
      const stringProperty = playerAgentsVM.string(propertyName);
      
      if (!stringProperty) {
        console.warn(`String property ${propertyName} not found`);
        return;
      }

      if (player && player.agentInternal) {
        // Convert internal agent name to display name and capitalize
        const agentDisplayName = AgentNameService.getAgentName(player.agentInternal);
        const agentName = (agentDisplayName || player.agentInternal).toUpperCase();
        stringProperty.value = agentName;
      } else {
        // Clear the agent name if no agent selected
        stringProperty.value = "";
      }
    } catch (error) {
      console.error(`Error updating player ${playerNumber} agent name:`, error);
    }
  }

  private updatePlayerLockedTextColors(): void {
    if (!this.riveInstance || !this.riveInitialized) {
      return;
    }

    try {
      // Access the view model instance (auto-bound)
      const viewModelInstance = (this.riveInstance as any).viewModelInstance;
      if (!viewModelInstance) {
        console.error("ViewModelInstance not found for player locked text colors");
        return;
      }

      // Access the nested view model for player locked text
      const playerLockedTextVM = viewModelInstance.viewModel("playerLockedText");
      if (!playerLockedTextVM) {
        console.error("playerLockedText view model not found");
        return;
      }

      let playerIndex = 1;
      
      // Team 1 (players 1-5)
      if (this.match.teams[0] && this.match.teams[0].players) {
        for (const [index, player] of this.match.teams[0].players.entries()) {
          if (index < 5) {
            this.updatePlayerLockedTextColor(playerLockedTextVM, playerIndex, player);
            playerIndex++;
          }
        }
      }
      
      // Fill remaining slots for team 1 if needed
      while (playerIndex <= 5) {
        this.updatePlayerLockedTextColor(playerLockedTextVM, playerIndex, null);
        playerIndex++;
      }

      // Team 2 (players 6-10)
      if (this.match.teams[1] && this.match.teams[1].players) {
        for (const [index, player] of this.match.teams[1].players.entries()) {
          if (index < 5) {
            this.updatePlayerLockedTextColor(playerLockedTextVM, playerIndex, player);
            playerIndex++;
          }
        }
      }
      
      // Fill remaining slots for team 2 if needed
      while (playerIndex <= 10) {
        this.updatePlayerLockedTextColor(playerLockedTextVM, playerIndex, null);
        playerIndex++;
      }

    } catch (error) {
      console.error("Error updating player locked text colors:", error);
    }
  }

  private updatePlayerLockedTextColor(playerLockedTextVM: any, playerNumber: number, player: any): void {
    try {
      const propertyName = `p${playerNumber}LockedText`;
      const colorProperty = playerLockedTextVM.color(propertyName);
      
      if (!colorProperty) {
        console.warn(`Color property ${propertyName} not found`);
        return;
      }

      const isLocked = player?.locked || false;
      
      if (isLocked) {
        // Locked: #D9CD8F (gold/yellow)
        colorProperty.value = 0xFFD9CD8F; // ARGB format: 0xAARRGGBB
      } else {
        // Not locked: #4E4E4E (gray)
        colorProperty.value = 0xFF616161; // ARGB format: 0xAARRGGBB
      }
    } catch (error) {
      console.error(`Error updating player ${playerNumber} locked text color:`, error);
    }
  }

  private updateTimer(): void {
    if (!this.riveInstance || !this.riveInitialized) {
      return;
    }

    try {
      // Access the view model instance (auto-bound)
      const viewModelInstance = (this.riveInstance as any).viewModelInstance;
      if (!viewModelInstance) {
        console.error("ViewModelInstance not found for timer");
        return;
      }

      // Check if agent select has started
      const matchStartTime = this.match?.agentSelectStartTime;
      
      if (matchStartTime && matchStartTime !== this.agentSelectStartTime) {
        // New agent select phase started
        this.agentSelectStartTime = matchStartTime;
        this.startAgentSelectTimer();
        console.log("🕐 Agent select timer started at:", new Date(matchStartTime).toISOString());
      } else if (!matchStartTime && this.agentSelectStartTime) {
        // Agent select phase ended
        this.stopAgentSelectTimer();
        this.agentSelectStartTime = null;
        console.log("⏹️ Agent select timer stopped");
      }

    } catch (error) {
      console.error("Error updating timer:", error);
    }
  }

  private async updateMap(): Promise<void> {
    if (!this.riveInstance || !this.riveInitialized) {
      return;
    }

    try {
      // Access the view model instance (auto-bound)
      const viewModelInstance = (this.riveInstance as any).viewModelInstance;
      if (!viewModelInstance) {
        console.error("ViewModelInstance not found for map");
        return;
      }

      // Get the default view model and access the map image property
      const defaultVM = viewModelInstance.viewModel("Default");
      if (!defaultVM) {
        console.error("Default view model not found for map");
        return;
      }

      const mapImageProperty = defaultVM.image("map");
      if (!mapImageProperty) {
        console.warn("Map image property not found in Rive animation");
        return;
      }

      const currentMap = this.match?.map;
      
      // Only update if map has changed
      if (currentMap === this.currentMap) {
        return;
      }
      
      if (currentMap && AGENT_SELECT_MAPS[currentMap]) {
        // Get the preloaded map image bytes
        const mapImageBytes = this.decodedMapImages.get(currentMap);
        if (mapImageBytes) {
          try {
            // Decode the map image using Rive's decodeImage function
            const decodedMapImage = await decodeImage(mapImageBytes);
            mapImageProperty.value = decodedMapImage;
            this.currentMap = currentMap; // Track the updated map
          } catch (decodeError) {
            console.error(`Failed to decode map image for ${currentMap}:`, decodeError);
            mapImageProperty.value = null;
          }
        } else {
          console.warn(`No preloaded map image found for: ${currentMap}`);
          mapImageProperty.value = null;
          this.currentMap = null;
        }
      } else {
        console.warn(`Invalid or missing map: ${currentMap}`);
        mapImageProperty.value = null;
        this.currentMap = null;
      }

    } catch (error) {
      console.error("Error updating map:", error);
    }
  }

  private startAgentSelectTimer(): void {
    if (!this.riveInstance || !this.riveInitialized) {
      return;
    }

    // Clear existing timer if any
    this.stopAgentSelectTimer();

    try {
      const viewModelInstance = (this.riveInstance as any).viewModelInstance;
      if (!viewModelInstance) {
        console.error("ViewModelInstance not found for timer start");
        return;
      }

      // Show timer
      const timerDisplayedProperty = viewModelInstance.boolean("timerDisplayed");
      if (timerDisplayedProperty) {
        timerDisplayedProperty.value = true;
      } else {
        console.warn("timerDisplayed boolean property not found");
      }

      // Start countdown timer
      this.timerInterval = setInterval(() => {
        this.updateTimerValue();
      }, 16); // Update every 16ms (~60fps) for smooth countdown

      console.log("⏱️ Agent select timer interval started (60fps smooth countdown)");

    } catch (error) {
      console.error("Error starting agent select timer:", error);
    }
  }

  private stopAgentSelectTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
      console.log("⏹️ Agent select timer interval stopped");
    }

    if (!this.riveInstance || !this.riveInitialized) {
      return;
    }

    try {
      const viewModelInstance = (this.riveInstance as any).viewModelInstance;
      if (!viewModelInstance) {
        return;
      }

      // Hide timer
      const timerDisplayedProperty = viewModelInstance.boolean("timerDisplayed");
      if (timerDisplayedProperty) {
        timerDisplayedProperty.value = false;
      }

      // Reset timer to 0
      const timeProperty = viewModelInstance.number("time");
      if (timeProperty) {
        timeProperty.value = 0;
      }

    } catch (error) {
      console.error("Error stopping agent select timer:", error);
    }
  }

  private updateTimerValue(): void {
    if (!this.riveInstance || !this.riveInitialized || !this.agentSelectStartTime) {
      return;
    }

    try {
      const viewModelInstance = (this.riveInstance as any).viewModelInstance;
      if (!viewModelInstance) {
        return;
      }

      const timeProperty = viewModelInstance.number("time");
      if (!timeProperty) {
        console.warn("time number property not found");
        return;
      }

      // Calculate remaining time (95 seconds total) with millisecond precision
      const currentTime = Date.now();
      const elapsedSeconds = (currentTime - this.agentSelectStartTime) / 1000;
      const remainingSeconds = Math.max(0, 95 - elapsedSeconds);

      // Use decimal precision for smooth countdown (2 decimal places for milliseconds)
      const smoothTime = Math.max(0, parseFloat(remainingSeconds.toFixed(3)));
      timeProperty.value = smoothTime;

      // Stop timer when it reaches 0
      if (remainingSeconds <= 0) {
        console.log("⏰ Agent select timer reached 0");
        this.stopAgentSelectTimer();
        this.agentSelectStartTime = null;
      }

    } catch (error) {
      console.error("Error updating timer value:", error);
    }
  }

  private getPlayerDisplayName(player: any): string {
    if (!player) return "";
    
    const nameOverrides = this.match?.tools?.nameOverrides?.overrides;
    if (nameOverrides && typeof nameOverrides.get === "function") {
      const overriddenName = nameOverrides.get(player.fullName || player.name);
      if (overriddenName) {
        return overriddenName.toUpperCase();
      }
    }
    
    return (player.name || "").toUpperCase();
  }

  private updateMapVisualizer(): void {
    if (!this.riveInstance || !this.riveInitialized) {
      return;
    }

    try {
      // Access the view model instance (auto-bound)
      const viewModelInstance = (this.riveInstance as any).viewModelInstance;
      if (!viewModelInstance) {
        console.error("ViewModelInstance not found for map visualizer");
        return;
      }

      console.log("🗺️ Updating map visualizer via data binding");

      const seriesInfo = this.match?.tools?.seriesInfo;
      if (!seriesInfo) {
        console.warn("No series info found in match data");
        return;
      }

      const mapsNeeded = seriesInfo.needed || 1;
      const mapsWonLeft = seriesInfo.wonLeft || 0;
      const mapsWonRight = seriesInfo.wonRight || 0;

      // Update map name string property
      this.updateMapName(viewModelInstance);

      // Update best-of number properties
      this.updateBestOfProperties(viewModelInstance, mapsNeeded);

      // Update team map color properties based on wins
      this.updateTeamMapColors(viewModelInstance, mapsWonLeft, mapsWonRight);

    } catch (error) {
      console.error("Error updating map visualizer:", error);
    }
  }

  private updateBestOfProperties(viewModelInstance: any, mapsNeeded: number): void {
    try {
      // Reset all bo properties to 0
      const bo1Property = viewModelInstance.number("bo1");
      const bo3Property = viewModelInstance.number("bo3");
      const bo5Property = viewModelInstance.number("bo5");

      if (bo1Property) bo1Property.value = 0;
      if (bo3Property) bo3Property.value = 0;
      if (bo5Property) bo5Property.value = 0;

      // Set properties based on maps needed to win
      if (mapsNeeded >= 1) {
        if (bo1Property) {
          bo1Property.value = 1;
        } else {
          console.warn("bo1 number property not found");
        }
      }

      if (mapsNeeded >= 2) {
        if (bo3Property) {
          bo3Property.value = 1;
        } else {
          console.warn("bo3 number property not found");
        }
      }

      if (mapsNeeded >= 3) {
        if (bo5Property) {
          bo5Property.value = 1;
        } else {
          console.warn("bo5 number property not found");
        }
      }

      this.log(`🎯 Updated best-of properties for ${mapsNeeded} maps needed`);
    } catch (error) {
      console.error("Error updating best-of properties:", error);
    }
  }

  private updateTeamMapColors(viewModelInstance: any, mapsWonLeft: number, mapsWonRight: number): void {
    try {
      // Reset all team map colors to 0% opacity (transparent white)
      const transparentWhite = 0x00FFFFFF; // ARGB: 0% opacity, white
      const opaqueWhite = 0xFFFFFFFF;      // ARGB: 100% opacity, white

      for (let mapIndex = 1; mapIndex <= 3; mapIndex++) {
        // Team 1 (Left) map colors
        const team1MapProperty = viewModelInstance.color(`team1Map${mapIndex}`);
        if (team1MapProperty) {
          if (mapIndex <= mapsWonLeft) {
            team1MapProperty.value = opaqueWhite; // 100% opacity for won maps
            this.log(`✅ Set team1Map${mapIndex} to 100% opacity (won)`);
          } else {
            team1MapProperty.value = transparentWhite; // 0% opacity for unwon maps
            this.log(`🔄 Set team1Map${mapIndex} to 0% opacity (not won)`);
          }
        } else {
          console.warn(`team1Map${mapIndex} color property not found`);
        }

        // Team 2 (Right) map colors
        const team2MapProperty = viewModelInstance.color(`team2Map${mapIndex}`);
        if (team2MapProperty) {
          if (mapIndex <= mapsWonRight) {
            team2MapProperty.value = opaqueWhite; // 100% opacity for won maps
            this.log(`✅ Set team2Map${mapIndex} to 100% opacity (won)`);
          } else {
            team2MapProperty.value = transparentWhite; // 0% opacity for unwon maps
            this.log(`🔄 Set team2Map${mapIndex} to 0% opacity (not won)`);
          }
        } else {
          console.warn(`team2Map${mapIndex} color property not found`);
        }
      }

      console.log(`🎨 Updated team map colors: Team1 won ${mapsWonLeft}, Team2 won ${mapsWonRight}`);
    } catch (error) {
      console.error("Error updating team map colors:", error);
    }
  }

  private updateMapName(viewModelInstance: any): void {
    try {
      const mapNameProperty = viewModelInstance.string("mapName");
      const currentMap = this.match?.map || "Unknown";
      const capitalizedMap = currentMap.toUpperCase();
      
      if (mapNameProperty) {
        mapNameProperty.value = capitalizedMap;
        console.log(`🗺️ Set mapName to: ${capitalizedMap}`);
      } else {
        console.warn("mapName string property not found");
      }
    } catch (error) {
      console.error("Error updating map name:", error);
    }
  }

  isAutoswitch(): boolean {
    return this.route.snapshot.url.some(segment => segment.path.includes('autoswitch'));
  }

  shouldDisplay(): boolean {
    if (this.isAutoswitch()) {
      return this.match?.roundPhase === "LOBBY";
    }
    return true;
  }

  /**
   * Updates any player's locked state in Rive and advances the appropriate artboard's state machine
   * to trigger visual changes based on the locked state change.
   * 
   * Players 1-5 (left team): artboard "lockedLeft", State Machine [1-5]
   * Players 6-10 (right team): artboard "lockedRight", State Machine [1-5]
   */
  private updatePlayerLockedStateAndAdvance(playerIndex: number, isLocked: boolean): void {
    console.log(`🎮 Updating Player ${playerIndex} locked state in Rive: ${isLocked}`);
    
    const viewModelInstance = (this.riveInstance as any).viewModelInstance;
    if (!this.riveInstance || !viewModelInstance) {
      console.warn(`⚠️ Rive instance or view model not available for Player ${playerIndex} locked state update`);
      return;
    }

    try {
      // Update the boolean property in Rive (p1Locked, p2Locked, etc.)
      const propertyName = `p${playerIndex}Locked`;
      const booleanProperty = viewModelInstance.boolean(propertyName);
      if (booleanProperty) {
        const oldValue = booleanProperty.value;
        booleanProperty.value = isLocked;
        console.log(`📝 Updated ${propertyName}: ${oldValue} → ${isLocked}`);
        
        // Advance the appropriate artboard's state machine
        this.advancePlayerStateMachine(playerIndex);
        
      } else {
        console.warn(`⚠️ ${propertyName} boolean property not found in Rive view model`);
      }
      
    } catch (error) {
      console.error(`❌ Error updating Player ${playerIndex} locked state:`, error);
    }
  }

  /**
   * Advances the appropriate state machine for a player's locked state change
   * Players 1-5: "lockedLeft" artboard, State Machine [1-5]
   * Players 6-10: "lockedRight" artboard, State Machine [1-5]
   */
  private advancePlayerStateMachine(playerIndex: number): void {
    try {
      // Determine artboard and state machine based on player index
      const isLeftTeam = playerIndex <= 5;
      const artboardName = isLeftTeam ? "lockedLeft" : "lockedRight";
      const stateMachineNumber = isLeftTeam ? playerIndex : playerIndex - 5; // 1-5 for both teams
      const stateMachineName = `State Machine ${stateMachineNumber}`;
      
      console.log(`⚡ Triggering render update for Player ${playerIndex} (${artboardName} - ${stateMachineName})`);
      
      // For now, we'll trigger a simple animation frame update to ensure the visual changes are applied
      // This should cause Rive to re-render with the updated boolean value
      if (this.riveInstance) {
        // The high-level API should automatically handle the state machine advancement
        // when the boolean property changes, but we can trigger a frame update
        (this.riveInstance as any).renderer?.save();
        (this.riveInstance as any).renderer?.restore();
        this.log(`✅ Render frame triggered for Player ${playerIndex} locked state visual update`);
      }
      
    } catch (error) {
      console.error(`❌ Error triggering render update for Player ${playerIndex}:`, error);
    }
  }

  ngOnDestroy(): void {
    // Stop timer
    this.stopAgentSelectTimer();
    
    if (this.riveInstance) {
      this.riveInstance.stop();
      this.riveInstance = null;
    }
    
    // Clear stored image bytes and caches
    this.decodedAgentImages.clear();
    this.decodedRoleImages.clear();
    this.decodedMapImages.clear();
    this.preloadedImages.clear();
    
    // Clear player state tracking
    this.previousPlayerStates.clear();
    
    // Reset all state flags
    this.riveInitialized = false;
    this.isInitializing = false;
    this.allAssetsLoaded = false;
    
    if (this.canvasElement) {
      this.canvasElement.remove();
    }
  }
}

