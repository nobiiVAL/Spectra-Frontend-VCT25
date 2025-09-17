import { Component, Input, OnChanges, SimpleChanges, OnInit, AfterViewChecked } from "@angular/core";
import {
  Rive,
  Fit,
  Alignment,
  Layout,
  decodeFont,
  ImageAsset,
  FontAsset,
  FileAsset,
  decodeImage,
 } from "@rive-app/canvas";
import { Image } from "@rive-app/canvas/rive_advanced.mjs";
import { Config } from "../shared/config";

import { NgIf } from "@angular/common";
@Component({
  selector: "app-endround",
  standalone: true,
  templateUrl: "./endround.component.html",
  styleUrls: ["./endround.component.scss"],
  imports: [NgIf],
})
export class EndroundComponent implements OnChanges, OnInit, AfterViewChecked {
  @Input() match!: any;
  tournamentUrl = "../../assets/misc/logo_endround.webp";
  tournamentBackgroundUrl = "../../assets/misc/backdrop.png";
  teamWonLogoUrl = "../../assets/misc/icon_endround.webp";

  // Add separate size variables for each asset
  private readonly tournamentBackgroundWidth = 830;
  private readonly tournamentBackgroundHeight = 250;
  private readonly tournamentLogoWidth = 2100;
  private readonly tournamentLogoHeight = 650;
  private readonly teamWonLogoWidth = 4000;
  private readonly teamWonLogoHeight = 4000;

  endRoundEnabled = false;
  teamWon = 0;
  private scoreboardCanvas!: HTMLCanvasElement | null;
  private canvasInitialized = false;
  private riveInstance!: Rive;
  private previousRoundPhase: string | null = null;
  private readonly desiredImageWidth = 512; // <-- SET your fixed width
  private readonly desiredImageHeight = 512; // <-- SET your fixed height
  
  // Preloaded assets cache
  private preloadedAssets: Map<string, Uint8Array> = new Map();
  private assetsPreloaded = false;

  /**
   * Converts a hex color string (e.g., "#FF0000") to Rive color format (e.g., 0xFFFF0000)
   */
  private hexToRiveColor(hexColor: string): number {
    // Remove the # if present and validate format
    const hex = hexColor.replace('#', '');
    
    // Validate hex format (6 characters, valid hex digits)
    if (!/^[0-9A-Fa-f]{6}$/.test(hex)) {
      throw new Error(`Invalid hex color format: ${hexColor}. Expected format: #RRGGBB`);
    }
    
    // Parse RGB values
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    // Convert to Rive format: 0xAARRGGBB (with full alpha)
    return 0xFF000000 | (r << 16) | (g << 8) | b;
  }

  /**
   * Validates and returns a team logo URL with robust fallback logic
   */
  private getValidTeamLogoUrl(team: any): string {
    // Check if team exists and has a valid teamUrl
    if (team && team.teamUrl) {
      const url = team.teamUrl.trim();
      // Check for non-empty string that's not just whitespace
      if (url && url !== "" && url !== "null" && url !== "undefined") {
        console.log(`✅ Using team logo: ${url}`);
        return url;
      }
    }
    
    console.log(`⚠️ No valid team logo found, using default. Team data:`, team);
    return "../../assets/misc/icon_endround.webp";
  }

  constructor(private config: Config) {}

  ngOnInit(): void {
    this.endRoundEnabled = this.match?.tools?.tournamentInfo?.enabled || false;
    if (!this.endRoundEnabled) return;

    this.tournamentUrl =
      this.match?.tools?.tournamentInfo?.logoUrl && this.match.tools.tournamentInfo.logoUrl !== ""
        ? this.match.tools.tournamentInfo.logoUrl
        : "../../assets/misc/logo_endround.webp";

    this.tournamentBackgroundUrl =
      this.match?.tools?.tournamentInfo?.backdropUrl &&
      this.match.tools.tournamentInfo.backdropUrl !== ""
        ? this.match.tools.tournamentInfo.backdropUrl
        : "../../assets/misc/backdrop.png";
    // Preload the Rive animation
    this.preloadRiveAnimation();

    // Initialize previousRoundPhase to the current phase if available
    this.previousRoundPhase = this.match?.roundPhase ?? null;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["match"]) {
      const match = changes["match"].currentValue;

      if (match) {
        console.log("Match data:", match);

        // Update tournament URLs whenever match data changes
        const previousTournamentUrl = this.tournamentUrl;
        const previousBackdropUrl = this.tournamentBackgroundUrl;
        
        this.tournamentUrl =
          match?.tools?.tournamentInfo?.logoUrl && match.tools.tournamentInfo.logoUrl !== ""
            ? match.tools.tournamentInfo.logoUrl
            : "../../assets/misc/logo_endround.webp";

        this.tournamentBackgroundUrl =
          match?.tools?.tournamentInfo?.backdropUrl && match.tools.tournamentInfo.backdropUrl !== ""
            ? match.tools.tournamentInfo.backdropUrl
            : "../../assets/misc/backdrop.png";

        // Clear cached assets if URLs changed
        if (previousTournamentUrl !== this.tournamentUrl) {
          console.log(`🔄 Tournament logo URL changed: ${previousTournamentUrl} -> ${this.tournamentUrl}`);
          this.preloadedAssets.delete("tournamentLogo");
        }
        if (previousBackdropUrl !== this.tournamentBackgroundUrl) {
          console.log(`🔄 Tournament backdrop URL changed: ${previousBackdropUrl} -> ${this.tournamentBackgroundUrl}`);
          this.preloadedAssets.delete("tournamentBackdrop");
        }

        // Determine winning team first
        if (match.attackersWon) {
          this.teamWon = match.teams[0].isAttacking ? 0 : 1;
        } else {
          this.teamWon = match.teams[0].isAttacking ? 1 : 0;
        }

        // Update the teamWonLogoUrl after teamWon is set with more robust validation
        const winningTeam = match.teams?.[this.teamWon];
        const previousTeamUrl = this.teamWonLogoUrl;
        this.teamWonLogoUrl = this.getValidTeamLogoUrl(winningTeam);

        console.log(`🏆 Team won: ${this.teamWon}, Team Logo URL: ${this.teamWonLogoUrl}, Tournament Logo URL: ${this.tournamentUrl}`);
        
        // Clear cached team logo if URL changed
        if (previousTeamUrl !== this.teamWonLogoUrl) {
          console.log(`🔄 Team logo URL changed: ${previousTeamUrl} -> ${this.teamWonLogoUrl}`);
          this.preloadedAssets.delete("icon");
        }

        // Reset assets if we're starting a new round (shopping phase indicates round start)
        if (match.roundPhase === "shopping" && this.previousRoundPhase !== "shopping") {
          console.log("🔄 New round detected - resetting asset preload status");
          this.assetsPreloaded = false;
          this.preloadedAssets.clear();
        }

        // Preload assets during combat phase
        if (match.roundPhase === "combat" && !this.assetsPreloaded) {
          console.log("🎯 Combat phase detected - preloading endround assets");
          this.preloadAssets();
        }

        // Only reset canvasInitialized if roundPhase transitions to "end"
        if (
          (this.previousRoundPhase !== "end" && match.roundPhase === "end") ||
          (this.previousRoundPhase === null && match.roundPhase === "end")
        ) {
          this.canvasInitialized = false;
        }
        this.previousRoundPhase = match.roundPhase;
      }
    }
  }

  ngAfterViewChecked(): void {
    if (!this.canvasInitialized && this.endRoundEnabled && this.match?.roundPhase === "end") {
      if (this.initializeScoreboardCanvas()) {
        this.scoreboardAnim();
      }
    }
  }

  private initializeScoreboardCanvas(): boolean {
    if (!this.scoreboardCanvas) {
      this.scoreboardCanvas = document.getElementById("scoreboardCanvas") as HTMLCanvasElement;

      if (!this.scoreboardCanvas) {
        console.error("Scoreboard canvas not found in the DOM.");
        return false;
      }
    }
    return true;
  }

  private preloadRiveAnimation(): void {
    // Create a temporary canvas for preloading
    const tempCanvas = document.createElement("canvas");

    this.riveInstance = new Rive({
      src: "/assets/roundEnd/round_win.riv",
      canvas: tempCanvas, // Use the temporary canvas
      autoplay: true, // Do not autoplay during preload
      onLoad: () => {
        console.log("Rive animation preloaded successfully.");
      },
    });
  }

  private async preloadAssets(): Promise<void> {
    if (this.assetsPreloaded) {
      console.log("⚠️ Assets already preloaded, skipping");
      return;
    }

    console.log("🚀 Starting asset preloading...");
    
    // Ensure we have the most current team logo URL before preloading
    const currentWinningTeam = this.match?.teams?.[this.teamWon];
    const refreshedTeamLogoUrl = this.getValidTeamLogoUrl(currentWinningTeam);
    
    if (refreshedTeamLogoUrl !== this.teamWonLogoUrl) {
      console.log(`🔄 Team logo URL updated during preload: ${this.teamWonLogoUrl} -> ${refreshedTeamLogoUrl}`);
      this.teamWonLogoUrl = refreshedTeamLogoUrl;
    }
    
    // Ensure we have the most current tournament logo URL before preloading
    const currentTournamentUrl = this.match?.tools?.tournamentInfo?.logoUrl && this.match.tools.tournamentInfo.logoUrl !== ""
      ? this.match.tools.tournamentInfo.logoUrl
      : "../../assets/misc/logo_endround.webp";
    
    if (currentTournamentUrl !== this.tournamentUrl) {
      console.log(`🔄 Tournament logo URL updated during preload: ${this.tournamentUrl} -> ${currentTournamentUrl}`);
      this.tournamentUrl = currentTournamentUrl;
    }

    // Ensure we have the most current backdrop URL before preloading
    const currentBackdropUrl = this.match?.tools?.tournamentInfo?.backdropUrl && this.match.tools.tournamentInfo.backdropUrl !== ""
      ? this.match.tools.tournamentInfo.backdropUrl
      : "../../assets/misc/backdrop.png";
    
    if (currentBackdropUrl !== this.tournamentBackgroundUrl) {
      console.log(`🔄 Tournament backdrop URL updated during preload: ${this.tournamentBackgroundUrl} -> ${currentBackdropUrl}`);
      this.tournamentBackgroundUrl = currentBackdropUrl;
    }
    
    try {
      // Preload all three assets in parallel
      const [backdropBytes, tournamentBytes, teamLogoBytes] = await Promise.all([
        this.resizeAndFetchImage(
          this.tournamentBackgroundUrl,
          this.tournamentBackgroundWidth,
          this.tournamentBackgroundHeight
        ),
        this.resizeAndFetchImage(
          this.tournamentUrl,
          this.tournamentLogoWidth,
          this.tournamentLogoHeight
        ),
        this.resizeAndFetchImage(
          this.teamWonLogoUrl,
          this.teamWonLogoWidth,
          this.teamWonLogoHeight
        )
      ]);

      // Store preloaded assets
      this.preloadedAssets.set("tournamentBackdrop", backdropBytes);
      this.preloadedAssets.set("tournamentLogo", tournamentBytes);
      this.preloadedAssets.set("icon", teamLogoBytes);
      
      this.assetsPreloaded = true;
      console.log("✅ All endround assets preloaded successfully");
    } catch (error) {
      console.error("❌ Failed to preload endround assets:", error);
      this.assetsPreloaded = false;
    }
  }

  private async resizeAndFetchImage(url: string, desiredWidth: number, desiredHeight: number): Promise<Uint8Array> {
    const img: HTMLImageElement = document.createElement('img');
    img.crossOrigin = "anonymous" as const;
    img.src = url;
    await img.decode();
  
    const canvas = document.createElement('canvas');
    canvas.width = desiredWidth;
    canvas.height = desiredHeight;
    const ctx = canvas.getContext('2d')!;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);

// Calculate scale factors separately
const scaleX = desiredWidth / img.width;
const scaleY = desiredHeight / img.height;

// Choose the smaller scale to make sure the image fits completely inside
const scale = Math.min(scaleX, scaleY);

// Calculate size after scaling
const drawWidth = img.width * scale;
const drawHeight = img.height * scale;

// Center the image inside the canvas (without cutting off any part)
const dx = (desiredWidth - drawWidth) / 2;
const dy = (desiredHeight - drawHeight) / 2;

ctx.drawImage(
  img,
  dx,
  dy,
  drawWidth,
  drawHeight
);


  
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Canvas toBlob() returned null."));
        }
      }, "image/png");
    });
  
    const arrayBuffer = await blob.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  }
  
  
  private backdropAsset = async (asset: ImageAsset) => {
    // Use preloaded asset if available, otherwise load on demand
    if (this.preloadedAssets.has("tournamentBackdrop")) {
      console.log("📦 Using preloaded backdrop asset");
      const bytes = this.preloadedAssets.get("tournamentBackdrop")!;
      asset.decode(bytes);
    } else {
      console.log("⏳ Loading backdrop asset on demand");
      const bytes = await this.resizeAndFetchImage(
        this.tournamentBackgroundUrl,
        this.tournamentBackgroundWidth,
        this.tournamentBackgroundHeight
      );
      asset.decode(bytes);
    }
  };

  private tournamentLogoAsset = async (asset: ImageAsset) => {
    try {
      // Always refresh the tournament logo URL to ensure we have the latest one
      const currentTournamentUrl = this.match?.tools?.tournamentInfo?.logoUrl && this.match.tools.tournamentInfo.logoUrl !== ""
        ? this.match.tools.tournamentInfo.logoUrl
        : "../../assets/misc/logo_endround.webp";
      
      console.log(`🏆 Loading tournament logo asset - Current URL: ${currentTournamentUrl}`);
      
      // Use preloaded asset if available AND the URL matches
      if (this.preloadedAssets.has("tournamentLogo") && currentTournamentUrl === this.tournamentUrl) {
        console.log("📦 Using preloaded tournament logo asset");
        const bytes = this.preloadedAssets.get("tournamentLogo")!;
        asset.decode(bytes);
      } else {
        console.log("⏳ Loading tournament logo asset on demand (URL changed or not preloaded)");
        // Update the stored URL and load fresh
        this.tournamentUrl = currentTournamentUrl;
        try {
          const bytes = await this.resizeAndFetchImage(
            this.tournamentUrl,
            this.tournamentLogoWidth,
            this.tournamentLogoHeight
          );
          asset.decode(bytes);
          
          // Update the preloaded cache with the new asset
          this.preloadedAssets.set("tournamentLogo", bytes);
        } catch (error) {
          console.error(`❌ Failed to load tournament logo from ${this.tournamentUrl}, using default:`, error);
          // Fallback to default logo if custom logo fails
          const defaultTournamentUrl = "../../assets/misc/logo_endround.webp";
          try {
            const defaultBytes = await this.resizeAndFetchImage(
              defaultTournamentUrl,
              this.tournamentLogoWidth,
              this.tournamentLogoHeight
            );
            asset.decode(defaultBytes);
          } catch (fallbackError) {
            console.error(`❌ Even default tournament logo failed to load:`, fallbackError);
            // If all fails, don't call decode - let Rive handle it
          }
        }
      }
    } catch (error) {
      console.error(`❌ Critical error in tournamentLogoAsset:`, error);
      // Don't throw errors that could break the Rive animation
    }
  };

  private teamLogoAsset = async (asset: ImageAsset) => {
    // Always refresh the team logo URL to ensure we have the latest one
    const currentWinningTeam = this.match?.teams?.[this.teamWon];
    const currentTeamLogoUrl = this.getValidTeamLogoUrl(currentWinningTeam);
    
    console.log(`🎯 Loading team logo asset - Current URL: ${currentTeamLogoUrl}`);
    
    // Use preloaded asset if available AND the URL matches
    if (this.preloadedAssets.has("icon") && currentTeamLogoUrl === this.teamWonLogoUrl) {
      console.log("📦 Using preloaded team logo asset");
      const bytes = this.preloadedAssets.get("icon")!;
      asset.decode(bytes);
    } else {
      console.log("⏳ Loading team logo asset on demand (URL changed or not preloaded)");
      // Update the stored URL and load fresh
      this.teamWonLogoUrl = currentTeamLogoUrl;
      const bytes = await this.resizeAndFetchImage(
        this.teamWonLogoUrl,
        this.teamWonLogoWidth,
        this.teamWonLogoHeight
      );
      asset.decode(bytes);
      
      // Update the preloaded cache with the new asset
      this.preloadedAssets.set("icon", bytes);
    }
  };

  public scoreboardAnim(): void {
    if (this.canvasInitialized) {
      console.warn("Rive animation is already initialized.");
      return;
    }

    if (!this.initializeScoreboardCanvas()) {
      console.error("Cannot initialize Rive animation because the canvas is not available.");
      return;
    }

    // Ensure `this.scoreboardCanvas` is not null
    if (!this.scoreboardCanvas) {
      console.error("Scoreboard canvas is null after initialization.");
      return;
    }

    console.log(`🎬 Starting endround animation - Assets preloaded: ${this.assetsPreloaded}`);
    
    // Reinitialize the Rive instance with the actual canvas
    this.riveInstance = new Rive({
      src: "/assets/roundEnd/round_win.riv",
      canvas: this.scoreboardCanvas, // Use the actual canvas
      autoplay: true,
      autoBind: true, // Enable view model binding for color customization
      assetLoader: (asset, bytes) => {
        console.log("Asset information: ", {
          name: asset.name,
          fileExtension: asset.fileExtension,
          cdnUuid: asset.cdnUuid,
          isFont: asset.isFont,
          isImage: asset.isImage,
          bytes,
        });
        if (asset.cdnUuid.length > 0 || bytes.length > 0) {
          return false
        }

        if (asset.isImage && asset.name === "tournamentBackdrop") {
          this.backdropAsset(asset as ImageAsset);
          return true;
        } else if (asset.isImage && asset.name === "tournamentLogo") {
          this.tournamentLogoAsset(asset as ImageAsset);
          return true;
        } else if (asset.isImage && asset.name === "icon") {
          this.teamLogoAsset(asset as ImageAsset);
          return true;
        } else {
          return false;
        }
      },
      onLoad: () => {
        console.log("Rive animation loaded successfully.");
        this.riveInstance.resizeDrawingSurfaceToCanvas();

        // Get the view model instance for setting colors
        const animInstance = this.riveInstance.viewModelInstance;
        
        // Set custom colors if available in config
        if (animInstance) {
          const mainColor = animInstance.color('color');
          const textColor = animInstance.color('textColor');
          
          // Apply custom colors from config
          if (this.config.endroundColor && mainColor) {
            try {
              const riveColor = this.hexToRiveColor(this.config.endroundColor);
              mainColor.value = riveColor;
              console.log(`🎨 Set custom endround color: ${this.config.endroundColor} -> 0x${riveColor.toString(16).toUpperCase()}`);
            } catch (error) {
              console.error(`Failed to parse endround color "${this.config.endroundColor}":`, error);
            }
          }
          
          if (this.config.endroundTextColor && textColor) {
            try {
              const riveTextColor = this.hexToRiveColor(this.config.endroundTextColor);
              textColor.value = riveTextColor;
              console.log(`🎨 Set custom text color: ${this.config.endroundTextColor} -> 0x${riveTextColor.toString(16).toUpperCase()}`);
            } catch (error) {
              console.error(`Failed to parse endround text color "${this.config.endroundTextColor}":`, error);
            }
          }
        } else {
          console.warn("Rive ViewModelInstance not found. Custom colors cannot be applied.");
        }

        if (this.match) {
          const winningTeam = this.match.teams[this.teamWon];
          const sideText = winningTeam.isAttacking ? "ATTACK" : "DEFENSE";
          this.riveInstance.setTextRunValue("sideRun", sideText);
          this.riveInstance.setTextRunValue("roundRun", "ROUND " + this.match.roundNumber.toString());
        }

        this.riveInstance.play();
      }
    });
    this.canvasInitialized = true;
  }
}
