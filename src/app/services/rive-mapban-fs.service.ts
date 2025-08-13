import { Injectable } from '@angular/core';
import { Rive, Layout, Fit, Alignment } from '@rive-app/canvas';
import { Config } from '../shared/config';

export interface MapbanData {
  map_0?: string;
  map_1?: string;
  map_2?: string;
  map_3?: string;
  map_4?: string;
  map_5?: string;
  map_6?: string;
  team1_score?: number;
  team2_score?: number;
  bans?: any[];
}

export interface MapState {
  mapName?: string;
  mapImage?: string;
  teamImage?: string;
  isPastMap: boolean;
  teamScore?: number;
  opponentScore?: number;
  mapNumber?: number;
  isBanned?: boolean;
  isPicked?: boolean;
  bannedBy?: number;
  pickedBy?: number;
  mapScore?: { team1: number; team2: number } | string | null;
}

export interface MapbanFsAssets {
  team1Logo?: string;  // Team 1 logo for past maps
  team2Logo?: string;  // Team 2 logo for past maps
  map_1?: string;      // Map images for maps 1-7
  map_2?: string;
  map_3?: string;
  map_4?: string;
  map_5?: string;
  map_6?: string;
  map_7?: string;
}

export interface SponsorInfo {
  enabled: boolean;
  sponsors: string[];
  duration?: number;
}

export interface TeamInfo {
  tricode: string;
  name: string;
  logo?: string;
}

export interface SideSelection {
  team1Side: 'Attack' | 'Defense';
  team2Side: 'Attack' | 'Defense';
}

@Injectable({
  providedIn: 'root'
})
export class RiveMapbanFsService {
  private canvas: HTMLCanvasElement | null = null;
  private rive: Rive | null = null;
  private currentArtboardName: string = 'BO3';
  private mapStates: MapState[] = [];
  private preloadedAssets: Map<string, Uint8Array> = new Map();
  private assetReferences: Map<string, any> = new Map();
  private currentAssetUrls: Map<string, string> = new Map();
  private readonly FRAMES_PER_SECOND = 60;
  private readonly FRAME_DURATION_MS = 1000 / this.FRAMES_PER_SECOND; // 16.67ms per frame

  constructor(private config: Config) {}

  async preloadAsset(url: string): Promise<Uint8Array> {
    try {
      console.log(`Preloading asset: ${url}`);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const processedData = new Uint8Array(arrayBuffer);
      return processedData;
    } catch (error) {
      console.error(`Error preloading asset ${url}:`, error);
      throw error;
    }
  }

  /**
   * Resize an image using the same method as agent-select component
   * @param imageData - The original image data as Uint8Array
   * @param isTeamLogo - Whether this is a team logo that needs resizing
   * @param targetWidth - Target width (default 512)
   * @param targetHeight - Target height (default 512)
   * @returns Promise<Uint8Array> - The resized image data
   */
  private async resizeImageData(imageData: Uint8Array, isTeamLogo: boolean = false, targetWidth: number = 200, targetHeight: number = 200): Promise<Uint8Array> {
    if (!isTeamLogo) {
      // For non-team logos (maps, etc.), return original data
      console.log('⏭️ Skipping resize for non-team logo asset');
      return imageData;
    }

    let imageBitmap: ImageBitmap | null = null;
    
    try {
      console.log(`🔧 STARTING resize for team logo: ${imageData.length} bytes → target ${targetWidth}x${targetHeight}`);
      
      // Create a blob from the image data
      const imageBlob = new Blob([imageData]);
      console.log(`📦 Created blob: ${imageBlob.size} bytes, type: ${imageBlob.type}`);
      
      // Create ImageBitmap from blob
      imageBitmap = await createImageBitmap(imageBlob);
      console.log(`🖼️ Created ImageBitmap: ${imageBitmap.width}x${imageBitmap.height}`);
      
      // Check if image dimensions are reasonable
      if (imageBitmap.width <= 0 || imageBitmap.height <= 0 || imageBitmap.width > 4096 || imageBitmap.height > 4096) {
        console.warn(`⚠️ Image dimensions out of range (${imageBitmap.width}x${imageBitmap.height}), using original data`);
        return imageData;
      }
      
      // Create canvas for resizing - same method as agent-select
      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext("2d");
      
      if (!ctx) {
        throw new Error('Could not get 2D context from canvas');
      }
      
      console.log(`🎨 Canvas created: ${canvas.width}x${canvas.height}`);
      
      // Calculate scaling to maintain aspect ratio - same as agent-select
      const scale = Math.min(targetWidth / imageBitmap.width, targetHeight / imageBitmap.height);
      const drawWidth = imageBitmap.width * scale;
      const drawHeight = imageBitmap.height * scale;
      const dx = (canvas.width - drawWidth) / 2;
      const dy = (canvas.height - drawHeight) / 2;
      
      console.log(`📐 Scaling calculation: scale=${scale.toFixed(3)}, drawSize=${drawWidth.toFixed(1)}x${drawHeight.toFixed(1)}, offset=(${dx.toFixed(1)}, ${dy.toFixed(1)})`);
      
      // Draw the resized image - same method as agent-select
      ctx.drawImage(imageBitmap, dx, dy, drawWidth, drawHeight);
      console.log(`✏️ Image drawn to canvas`);
      
      // Convert canvas to blob - same method as agent-select
      const resizedBlob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/png");
      });
      
      if (!resizedBlob) {
        console.warn('⚠️ Canvas toBlob returned null, using original data');
        return imageData;
      }
      
      console.log(`📤 Canvas converted to blob: ${resizedBlob.size} bytes`);
      
      // Convert blob to Uint8Array
      const resizedData = new Uint8Array(await resizedBlob.arrayBuffer());
      
      console.log(`✅ Team logo resized: ${imageBitmap.width}x${imageBitmap.height} → ${targetWidth}x${targetHeight} (scaled: ${drawWidth.toFixed(1)}x${drawHeight.toFixed(1)}) | Original: ${imageData.length} bytes → Resized: ${resizedData.length} bytes`);
      
      return resizedData;
      
    } catch (error) {
      console.error('❌ Error resizing image:', error);
      console.warn('⚠️ Image resizing failed, using original image data');
      return imageData;
    } finally {
      // Ensure imageBitmap is closed if it was created
      if (imageBitmap) {
        imageBitmap.close();
        console.log('🧹 ImageBitmap cleaned up');
      }
    }
  }

  /**
   * Determine if a URL is a team logo that should be resized
   * @param url - The asset URL
   * @returns boolean - True if this is a team logo
   */
  private isTeamLogoUrl(url: string): boolean {
    // Team logos are typically external URLs or not in standard asset paths
    // Standard asset paths include maps, misc, etc.
    const isStandardAsset = url.startsWith('/assets/maps/') || 
                           url.startsWith('/assets/misc/') ||
                           url.startsWith('/assets/ranks/') ||
                           url.startsWith('/assets/weapons/') ||
                           url.startsWith('/assets/agents/') ||
                           url.startsWith('/assets/backgrounds/');
    
    // Additional checks for common team logo patterns
    const hasTeamLogoPattern = url.includes('logo') || 
                              url.includes('team') || 
                              url.includes('clan') ||
                              url.includes('org') ||
                              url.includes('esports') ||
                              // External URLs (not starting with /)
                              (!url.startsWith('/') && (url.startsWith('http') || url.startsWith('//') || url.includes('.')));
    
    // If it's not a standard asset, it's likely a team logo
    const isTeamLogo = !isStandardAsset || hasTeamLogoPattern;
    
    if (isTeamLogo) {
      console.log(`🏷️ Detected team logo URL: ${url} (standard asset: ${isStandardAsset}, team pattern: ${hasTeamLogoPattern})`);
    }
    
    return isTeamLogo;
  }

  async preloadAssets(assets: MapbanFsAssets): Promise<Map<string, Uint8Array>> {
    const preloadedAssets = new Map<string, Uint8Array>();
    const assetPromises: Promise<void>[] = [];

    for (const [key, url] of Object.entries(assets)) {
      if (url) {
        // Check if this is a team logo asset that needs special processing
        const isTeamLogoAsset = key === 'team1Logo' || key === 'team2Logo';
        
        if (isTeamLogoAsset) {
          console.log(`🏷️ Preloading and resizing team logo asset '${key}': ${url}`);
          assetPromises.push(
            this.preloadAndProcessTeamLogo(url)
              .then((data) => {
                preloadedAssets.set(url, data);
                console.log(`✅ Preloaded and resized team logo '${key}': ${url} (${data.length} bytes)`);
              })
              .catch((error) => {
                console.error(`❌ Failed to preload team logo '${key}' (${url}):`, error);
              })
          );
        } else {
          // Regular asset preloading
          assetPromises.push(
            this.preloadAsset(url)
              .then((data) => {
                preloadedAssets.set(url, data);
                console.log(`✅ Preloaded asset '${key}': ${url}`);
              })
              .catch((error) => {
                console.error(`❌ Failed to preload asset '${key}' (${url}):`, error);
              })
          );
        }
      }
    }

    await Promise.all(assetPromises);
    this.preloadedAssets = preloadedAssets;
    console.log(`Preloaded ${preloadedAssets.size} assets (including resized team logos)`);
    return preloadedAssets;
  }

  initializeRive(canvas: HTMLCanvasElement, assets: MapbanFsAssets, preloadedAssets?: Map<string, Uint8Array>, riveFilePath?: string): Promise<Rive> {
    return new Promise((resolve, reject) => {
      this.canvas = canvas;
      
      // Set canvas to native resolution to prevent blurriness
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
      
      // Create optimized asset loader using preloaded assets
      const assetLoader = (asset: any): boolean => {
        const assetName = asset.name;
        const assetUrl = assets[assetName as keyof MapbanFsAssets];
        
        console.log(`🔍 Asset loader called for: '${assetName}' -> URL: ${assetUrl}`);
        
        // Store the asset reference for later dynamic updates
        this.assetReferences.set(assetName, asset);
        
        if (assetUrl && preloadedAssets?.has(assetUrl)) {
          // Use preloaded asset
          const processedImageData = preloadedAssets.get(assetUrl)!;
          try {
            asset.decode(processedImageData);
            this.currentAssetUrls.set(assetName, assetUrl);
            
            // Check if this is a team logo asset
            const isTeamLogoAsset = assetName === 'team1Logo' || assetName === 'team2Logo';
            if (isTeamLogoAsset) {
              console.log(`✅ Loaded TEAM LOGO asset '${assetName}' from: ${assetUrl} (${processedImageData.length} bytes)`);
            } else {
              console.log(`✅ Loaded preloaded asset '${assetName}' from: ${assetUrl}`);
            }
            return true;
          } catch (error) {
            console.error(`Failed to decode preloaded asset ${assetName}:`, error);
            return false;
          }
        } else if (assetUrl) {
          // Fallback to loading if not preloaded
          console.warn(`Asset ${assetName} not preloaded, loading on demand`);
          
          // Check if this is a team logo that needs special processing
          const isTeamLogoAsset = assetName === 'team1Logo' || assetName === 'team2Logo';
          
          if (isTeamLogoAsset) {
            console.log(`🏷️ Loading team logo asset on demand with resizing: ${assetName} -> ${assetUrl}`);
            this.preloadAndProcessTeamLogo(assetUrl)
              .then((processedImageData: Uint8Array) => {
                asset.decode(processedImageData);
                this.currentAssetUrls.set(assetName, assetUrl);
                console.log(`✅ Loaded and resized on-demand team logo '${assetName}' from: ${assetUrl}`);
              })
              .catch((error: any) => {
                console.error(`Failed to load team logo asset ${assetName}:`, error);
              });
          } else {
            this.preloadAsset(assetUrl)
              .then((processedImageData: Uint8Array) => {
                asset.decode(processedImageData);
                this.currentAssetUrls.set(assetName, assetUrl);
                console.log(`✅ Loaded on-demand asset '${assetName}' from: ${assetUrl}`);
              })
              .catch((error: any) => {
                console.error(`Failed to load asset ${assetName}:`, error);
              });
          }
          return true;
        }
        
        console.warn(`Asset not found: ${assetName}`);
        return false;
      };

      // Use provided Rive file path or default to the BO3 version
      const riveFile = riveFilePath || '/assets/mapban/mapban-fs/mapban-fs-bo3.riv';
      console.log('📁 Loading Rive file:', riveFile);

      this.rive = new Rive({
        src: riveFile,
        canvas: canvas,
        layout: new Layout({
          fit: Fit.Cover,
          alignment: Alignment.Center,
        }),
        autoplay: false, // Disable autoplay - we'll start manually after data is loaded
        assetLoader: assetLoader,
        onLoad: () => {
          console.log('✅ Rive mapban-fs loaded successfully');
          
          if (this.rive) {
            console.log('🎬 Rive instance created successfully');
            console.log('📊 Rive playback state:', this.rive.isPlaying);
            console.log('⏸️ Animation ready but not started (waiting for data)');
            
            resolve(this.rive);
          } else {
            reject(new Error('Rive instance is null after loading'));
          }
        },
        onLoadError: (error: any) => {
          console.error('❌ Failed to load Rive mapban-fs:', error);
          reject(error);
        }
      });
    });
  }

  setArtboard(artboardName: string): void {
    if (!this.rive) {
      console.error('Rive not initialized');
      return;
    }

    try {
      // For Rive, we typically work with artboards through the Rive instance
      // The artboard switching might be handled through state machine inputs or animations
      this.currentArtboardName = artboardName;
      console.log(`✅ Set current artboard to: ${artboardName}`);
      
      // If there are specific animations or state machine inputs for artboard switching,
      // they would be triggered here
      
      // Re-apply map state animations with the new artboard context
      if (this.mapStates.length > 0) {
        this.applyMapStateAnimations();
      }
    } catch (error) {
      console.error(`Error switching to artboard '${artboardName}':`, error);
    }
  }

  setDataBindingInput(inputName: string, value: any, delayFrames: number = 0): void {
    if (!this.rive) {
      console.error('Rive not initialized');
      return;
    }

    const delayMs = delayFrames * this.FRAME_DURATION_MS;

    setTimeout(() => {
      try {
        if (!this.rive) return;

        // Get the 'Default' view model from the Rive instance
        const viewModel = this.rive.viewModelByName('Default');
        if (!viewModel) {
          console.warn("View model 'Default' not found");
          return;
        }

        // Get or create a view model instance and bind it
        let viewModelInstance = this.rive.viewModelInstance;
        if (!viewModelInstance) {
          viewModelInstance = viewModel.defaultInstance();
          this.rive.bindViewModelInstance(viewModelInstance);
        }
        
        if (!viewModelInstance) {
          console.warn('Could not get or create view model instance');
          return;
        }

        // Check if this is a nested property path
        if (inputName.includes('/')) {
          // Try image property first
          const imageProperty = viewModelInstance.image(inputName);
          if (imageProperty && typeof value === 'string') {
            const assetRef = this.assetReferences.get(value);
            if (assetRef) {
              imageProperty.value = assetRef;
              console.log(`✅ Set nested image property '${inputName}' to asset: ${value}`);
              return;
            } else {
              console.warn(`Asset reference not found for '${value}'`);
              console.log('Available asset references:', Array.from(this.assetReferences.keys()));
              return;
            }
          }
          
          // Try string property
          const stringProperty = viewModelInstance.string(inputName);
          if (stringProperty && typeof value === 'string') {
            stringProperty.value = value;
            console.log(`✅ Set nested string property '${inputName}' to: ${value}`);
            return;
          }
          
          // Try boolean property
          const boolProperty = viewModelInstance.boolean(inputName);
          if (boolProperty && typeof value === 'boolean') {
            boolProperty.value = value;
            console.log(`✅ Set nested boolean property '${inputName}' to: ${value}`);
            return;
          }
          
          console.warn(`No matching nested property found at path: '${inputName}' for value type: ${typeof value}`);
          return;
        }

        // Handle top-level properties
        if (typeof value === 'boolean') {
          const boolInput = viewModelInstance.boolean(inputName);
          if (boolInput) {
            boolInput.value = value;
            console.log(`✅ Set boolean input '${inputName}' to: ${value}`);
            return;
          } else {
            console.warn(`Boolean input '${inputName}' not found`);
            return;
          }
        }
        
        if (typeof value === 'string') {
          // Try string property first
          const stringInput = viewModelInstance.string(inputName);
          if (stringInput) {
            stringInput.value = value;
            console.log(`✅ Set string input '${inputName}' to: ${value}`);
            return;
          }
          
          // Try image property with asset reference
          const imageInput = viewModelInstance.image(inputName);
          if (imageInput) {
            const assetRef = this.assetReferences.get(value);
            if (assetRef) {
              imageInput.value = assetRef;
              console.log(`✅ Set image input '${inputName}' to asset: ${value}`);
              return;
            } else {
              console.warn(`Asset reference not found for '${value}'`);
              return;
            }
          }
          
          console.warn(`String/image input '${inputName}' not found`);
          return;
        }
        
        console.warn(`Unsupported input type for '${inputName}': ${typeof value}`);
      } catch (error) {
        console.error(`Error setting data binding input '${inputName}':`, error);
      }
    }, delayMs);
  }

  updateMapStates(mapStates: MapState[], teams?: any[]): void {
    this.mapStates = mapStates;
    this.applyMapStateAnimations();
    
    // Update ban texts using the correct map positions
    this.updateBanTextsFromMapStates(teams);
  }

  private applyMapStateAnimations(): void {
    // Filter for picked maps only (not bans) - these are the ones that get pastMap inputs set
    const pickedMaps = this.mapStates.filter(mapState => mapState.isPicked && mapState.isPastMap);
    
    pickedMaps.forEach((mapState, pickedIndex) => {
      // Determine the correct map number based on the series type and picked index
      let mapNumber: number;
      if (this.currentArtboardName === 'BO3') {
        // BO3: pastMap5, pastMap6, pastMap7 (maps 1-4 are bans, maps 5-7 are picks)
        mapNumber = 5 + pickedIndex;
      } else {
        // BO5: pastMap3, pastMap4, pastMap5 (maps 1-2 are bans, maps 3-5 are picks in first 3 matches)
        // For BO5, the first 3 picked maps use pastMap3, pastMap4, pastMap5
        mapNumber = 3 + pickedIndex;
      }
      
      // Ensure map number is valid (3-7)
      if (mapNumber >= 3 && mapNumber <= 7) {
        const artboardName = `MAP ${mapNumber} SCORE`;
        const pastMapInputName = `pastMap${mapNumber}`;
        
        console.log(`🎯 Setting pastMap input for picked map ${pickedIndex + 1}: ${pastMapInputName} = true (${artboardName})`);
        
        // Set the individual pastMap boolean input (no delay - handled in Rive editor)
        this.setDataBindingInput(pastMapInputName, true, 0);
        
        // Set the score text run and winning team image for the nested artboard
        if (mapState.mapScore) {
          let scoreText = '';
          let winningTeamIndex: 0 | 1 | null = null;
          
          // FIRST: Determine the winner from the original score data
          winningTeamIndex = this.getWinningTeamFromScore(mapState.mapScore);
          
          // SECOND: Format the score display (higher score first for readability)
          if (typeof mapState.mapScore === 'string') {
            scoreText = mapState.mapScore;
          } else if (mapState.mapScore && typeof mapState.mapScore === 'object') {
            const team1Score = mapState.mapScore.team1;
            const team2Score = mapState.mapScore.team2;
            
            // Format score with HIGHER score first for better readability
            if (team1Score > team2Score) {
              scoreText = `${team1Score} - ${team2Score}`;
            } else if (team2Score > team1Score) {
              scoreText = `${team2Score} - ${team1Score}`;
            } else {
              // Tie case - keep original order
              scoreText = `${team1Score} - ${team2Score}`;
            }
          }
          
          if (scoreText) {
            // Set the score text run on the nested artboard
            this.setNestedTextRun('Score', scoreText, artboardName);
            
            // THIRD: Set the team win status based on the ORIGINAL winner determination
            // This ensures the correct team logo is shown regardless of score display format
            if (winningTeamIndex !== null) {
              this.setMapTeamWin(mapNumber, winningTeamIndex);
            }
            
            console.log(`✅ Set score "${scoreText}" and team win status for map ${mapNumber} (winner: Team ${winningTeamIndex !== null ? winningTeamIndex + 1 : 'unknown'} from original data)`);
          }
        }
      } else {
        console.warn(`Invalid map number ${mapNumber} for series ${this.currentArtboardName}`);
      }
    });
  }

  setTextRun(textRunName: string, value: string): void {
    if (!this.rive) {
      console.error('Rive not initialized');
      return;
    }

    try {
      // For text runs, use the high-level API
      this.rive.setTextRunValue(textRunName, value.toUpperCase());
      console.log(`✅ Set text run '${textRunName}' to: ${value.toUpperCase()}`);
    } catch (error) {
      console.error(`Error setting text run '${textRunName}':`, error);
    }
  }

  setNestedTextRun(textRunName: string, value: string, path: string): void {
    if (!this.rive) {
      console.error('Rive not initialized');
      return;
    }

    try {
      // For nested text runs, use the path-based API
      this.rive.setTextRunValueAtPath(textRunName, value.toUpperCase(), path);
      console.log(`✅ Set nested text run '${textRunName}' at path '${path}' to: ${value.toUpperCase()}`);
    } catch (error) {
      console.error(`Error setting nested text run '${textRunName}' at path '${path}':`, error);
    }
  }

  updateMapTexts(mapStates: MapState[]): void {
    mapStates.forEach((mapState, index) => {
      const mapName = mapState.mapName || 'UNKNOWN MAP';
      
      // For picked maps that are on nested artboards, use nested text run updates
      if (mapState.isPicked && mapState.isPastMap) {
        // Find the picked map index among all picked maps
        const pickedMaps = mapStates.filter(ms => ms.isPicked && ms.isPastMap);
        const pickedIndex = pickedMaps.findIndex(ms => ms === mapState);
        
        if (pickedIndex >= 0) {
          // Determine the correct map number for picks based on series type
          let mapNumber: number;
          if (this.currentArtboardName === 'BO3') {
            // BO3: picked maps are pastMap5, pastMap6, pastMap7
            mapNumber = 5 + pickedIndex;
          } else {
            // BO5: picked maps are pastMap3, pastMap4, pastMap5 (for first 3 matches)
            mapNumber = 3 + pickedIndex;
          }
          
          const artboardName = `MAP ${mapNumber} SCORE`;
          
          // Update the map name text run on the nested artboard
          this.setNestedTextRun('MapName', mapName, artboardName);
          
          // Update other pick-related text runs using the correct map number
          this.updatePickTextRuns(mapState, mapNumber);
        }
      } else if (mapState.isBanned) {
        // For banned maps, use standard ban text approach (handled in updateBanTexts)
        // No individual map text runs needed for bans as they use ban1, ban2, etc.
        console.log(`📝 Ban map ${index + 1}: ${mapName} (handled via updateBanTexts)`);
      } else {
        // For other maps (if any), use standard approach
        const textRunName = `map${index + 1}`;
        this.setTextRun(textRunName, mapName);
      }
    });
  }

  private updatePickTextRuns(mapState: MapState, mapNumber: number): void {
    if (!mapState.mapName) return;
    
    const mapName = mapState.mapName.toUpperCase();
    
    // Update pick-related text runs with correct map number
    // These text runs should exist for maps 5-7 in BO3 and maps 3-7 in BO5
    try {
      // Set the map pick text run: "MAP [NUMBER] PICK"
      this.setTextRun(`MAP ${mapNumber} PICK`, mapName);
      
      // Set the team that picked the map: "MAP [NUMBER] PICK TEAM"
      if (mapState.pickedBy !== undefined) {
        const teamName = mapState.pickedBy === 0 ? 'TEAM 1' : 'TEAM 2'; // This should be updated with actual team names
        this.setTextRun(`MAP ${mapNumber} PICK TEAM`, teamName);
      }
      
      // Set the defending team: "MAP [NUMBER] DEF TEAM"
      // This would typically be determined by side selection logic
      if (mapState.teamImage) {
        this.setTextRun(`MAP ${mapNumber} DEF TEAM`, 'DEF TEAM'); // Placeholder
      }
      
      // Set the map side: "MAP [NUMBER] SIDE"
      // This would be Attack/Defense based on side selection
      this.setTextRun(`MAP ${mapNumber} SIDE`, 'ATTACK'); // Placeholder
      
      console.log(`✅ Updated pick text runs for MAP ${mapNumber}: ${mapName}`);
    } catch (error) {
      console.error(`Error updating pick text runs for MAP ${mapNumber}:`, error);
    }
  }

  updateBanTexts(bans: any[]): void {
    // This method should actually receive the full mapStates array, not just banned maps
    // For now, we'll process what we get but the real fix should be in the component
    console.log('⚠️ updateBanTexts: This method needs mapStates, not just banned maps');
  }

  // New method to handle ban texts correctly using mapStates
  updateBanTextsFromMapStates(teams?: any[]): void {
    if (this.currentArtboardName === 'BO3') {
      // BO3: Maps 1, 2, 3, 4 are banned maps (positions 5, 6, 7 are picked maps)
      const banPositions = [1, 2, 3, 4];
      let banCounter = 1;
      
      banPositions.forEach(mapPosition => {
        const mapState = this.mapStates[mapPosition - 1]; // Convert to 0-based index
        if (mapState && mapState.mapName) {
          // Get team tricode from teams array if provided
          let teamTricode = 'TEAM';
          if (mapState.bannedBy !== undefined) {
            if (teams && teams[mapState.bannedBy]) {
              teamTricode = teams[mapState.bannedBy].tricode || teams[mapState.bannedBy].name || 'TEAM';
            } else {
              teamTricode = mapState.bannedBy === 0 ? 'TEAM 1' : 'TEAM 2';
            }
          } else {
            // Fallback if bannedBy is not set - alternate teams
            teamTricode = banCounter % 2 === 1 ? (teams?.[0]?.tricode || 'TEAM 1') : (teams?.[1]?.tricode || 'TEAM 2');
          }
          
          const banText = `${teamTricode.toUpperCase()} BAN ${mapState.mapName.toUpperCase()}`;
          this.setTextRun(`BAN ${banCounter} TEXT`, banText);
          console.log(`✅ Set BAN ${banCounter} TEXT (Map ${mapPosition}): ${banText}`);
        } else {
          console.warn(`Map at position ${mapPosition} has no mapName or mapState`);
        }
        banCounter++;
      });
      
    } else {
      // BO5: Maps 1, 2 are banned maps
      const banPositions = [1, 2];
      let banCounter = 1;
      
      banPositions.forEach(mapPosition => {
        const mapState = this.mapStates[mapPosition - 1]; // Convert to 0-based index
        if (mapState && mapState.mapName) {
          // Get team tricode from teams array if provided
          let teamTricode = 'TEAM';
          if (mapState.bannedBy !== undefined) {
            if (teams && teams[mapState.bannedBy]) {
              teamTricode = teams[mapState.bannedBy].tricode || teams[mapState.bannedBy].name || 'TEAM';
            } else {
              teamTricode = mapState.bannedBy === 0 ? 'TEAM 1' : 'TEAM 2';
            }
          } else {
            // Fallback if bannedBy is not set - alternate teams
            teamTricode = banCounter % 2 === 1 ? (teams?.[0]?.tricode || 'TEAM 1') : (teams?.[1]?.tricode || 'TEAM 2');
          }
          
          const banText = `${teamTricode.toUpperCase()} BAN ${mapState.mapName.toUpperCase()}`;
          this.setTextRun(`BAN ${banCounter} TEXT`, banText);
          console.log(`✅ Set BAN ${banCounter} TEXT (Map ${mapPosition}): ${banText}`);
        } else {
          console.warn(`Map at position ${mapPosition} has no mapName or mapState`);
        }
        banCounter++;
      });
    }
  }

  getCurrentArtboard(): string {
    return this.currentArtboardName;
  }

  getMapStates(): MapState[] {
    return [...this.mapStates];
  }

  reset(): void {
    this.mapStates = [];
    this.preloadedAssets.clear();
    this.assetReferences.clear();
    this.currentAssetUrls.clear();
    
    // Reset all pastMap inputs before cleanup
    if (this.rive) {
      this.resetAllPastMapInputs();
    }
    
    if (this.rive) {
      this.rive.cleanup();
      this.rive = null;
    }
    
    this.canvas = null;
    
    console.log('✅ Rive mapban-fs service reset');
  }

  cleanup(): void {
    this.reset();
  }

  getRive(): Rive | null {
    return this.rive;
  }

  async preloadAndProcessAsset(url: string): Promise<Uint8Array> {
    const originalData = await this.preloadAsset(url);
    const isTeamLogo = this.isTeamLogoUrl(url);
    
    if (isTeamLogo) {
      console.log(`🔧 Processing team logo: ${url}`);
      return await this.resizeImageData(originalData, true);
    }
    
    return originalData;
  }

  /**
   * Specifically process team logos with resizing
   * @param url - The team logo URL
   * @returns Promise<Uint8Array> - The resized team logo data
   */
  async preloadAndProcessTeamLogo(url: string): Promise<Uint8Array> {
    console.log(`🏷️ Explicitly processing team logo: ${url}`);
    console.log(`🔍 Team logo detection for ${url}: ${this.isTeamLogoUrl(url) ? 'YES' : 'NO'}`);
    
    const originalData = await this.preloadAsset(url);
    console.log(`📥 Original team logo data loaded: ${originalData.length} bytes`);
    
    const resizedData = await this.resizeImageData(originalData, true);
    console.log(`📤 Team logo processing complete: ${resizedData.length} bytes (change: ${resizedData.length - originalData.length > 0 ? '+' : ''}${resizedData.length - originalData.length})`);
    
    return resizedData;
  }

  updateSponsorInfo(sponsorInfo: SponsorInfo): void {
    console.log('📢 Updating sponsor info:', sponsorInfo);
    // Placeholder implementation
  }

  updateAssetsFromPreloaded(assets: MapbanFsAssets, preloadedAssets: Map<string, Uint8Array>): void {
    console.log('🔄 Updating assets from preloaded cache');
    // Placeholder implementation
  }

  setTeamInfo(teamIndex: number, teamInfo: TeamInfo): void {
    console.log(`🏆 Setting team ${teamIndex} info:`, teamInfo);
    // Placeholder implementation
  }

  setPastMapScore(mapNumber: number, mapScore: { team1: number; team2: number } | string | null, show: boolean): void {
    console.log(`📊 Setting past map ${mapNumber} score:`, mapScore, 'show:', show);
    
    if (!show || !mapScore) {
      return;
    }
    
    // FIRST: Determine the winner from the original score data
    const winningTeamIndex = this.getWinningTeamFromScore(mapScore);
    
    // SECOND: Format the score display (higher score first for readability)
    let scoreText = '';
    
    if (typeof mapScore === 'string') {
      scoreText = mapScore;
    } else if (mapScore && typeof mapScore === 'object') {
      const team1Score = mapScore.team1;
      const team2Score = mapScore.team2;
      
      // Format score with HIGHER score first for better readability
      if (team1Score > team2Score) {
        scoreText = `${team1Score} - ${team2Score}`;
      } else if (team2Score > team1Score) {
        scoreText = `${team2Score} - ${team1Score}`;
      } else {
        // Tie case - keep original order
        scoreText = `${team1Score} - ${team2Score}`;
      }
    }
    
    if (scoreText) {
      // Validate map number range (3-7)
      if (mapNumber >= 3 && mapNumber <= 7) {
        const artboardName = `MAP ${mapNumber} SCORE`;
        const pastMapInputName = `pastMap${mapNumber}`;
        
        // Set the pastMap input for this specific map
        this.setDataBindingInput(pastMapInputName, true, 0);
        
        // Set the score text run on the nested artboard
        this.setNestedTextRun('Score', scoreText, artboardName);
        
        // THIRD: Set the team win status based on the ORIGINAL winner determination
        // This ensures the correct team logo is shown regardless of score display format
        if (winningTeamIndex !== null) {
          this.setMapTeamWin(mapNumber, winningTeamIndex);
        }
        
        console.log(`✅ Set ${pastMapInputName} = true, score = "${scoreText}", and team win status for map ${mapNumber} (winner: Team ${winningTeamIndex !== null ? winningTeamIndex + 1 : 'unknown'} from original data)`);
      } else {
        console.warn(`Map number ${mapNumber} not valid (must be 3-7)`);
      }
    }
  }

  /**
   * Sets the team win status for a past map using boolean properties
   * 
   * New implementation based on simplified Rive structure:
   * - Uses single "Default" view model with boolean properties
   * - Properties are named "map[mapNumber]Team[1-2]"
   * - Only applies to picked maps (map numbers 3-7)
   * - Only the WINNING team's property is set to true, losing team is set to false
   * 
   * @param mapNumber - The map number (3-7)
   * @param teamWinner - The winning team index (0 = team1, 1 = team2)
   */
  setMapTeamWin(mapNumber: number, teamWinner: 0 | 1): void {
    if (!this.rive) {
      console.error('Rive not initialized');
      return;
    }

    // Validate map number range (only picked maps 3-7)
    if (mapNumber < 3 || mapNumber > 7) {
      console.warn(`Map number ${mapNumber} not valid for team win (must be 3-7)`);
      return;
    }

    try {
      console.log(`🏆 Setting team win for map ${mapNumber}: Team ${teamWinner + 1} wins`);

      // Get the view model instance
      let viewModelInstance = this.rive.viewModelInstance;
      if (!viewModelInstance) {
        const viewModel = this.rive.viewModelByName('Default');
        if (viewModel) {
          viewModelInstance = viewModel.defaultInstance();
          this.rive.bindViewModelInstance(viewModelInstance);
        }
      }

      if (!viewModelInstance) {
        console.warn('Could not get view model instance for setting team win');
        return;
      }

      // Set boolean properties for both teams - ONLY winning team gets true
      const team1PropertyName = `map${mapNumber}Team1`;
      const team2PropertyName = `map${mapNumber}Team2`;

      // Set team 1 boolean property - true only if team1 wins (teamWinner === 0)
      try {
        const team1Property = viewModelInstance.boolean(team1PropertyName);
        if (team1Property) {
          const team1Wins = teamWinner === 0;
          team1Property.value = team1Wins;
          console.log(`✅ Set ${team1PropertyName} = ${team1Wins} (Team 1 ${team1Wins ? 'WINS' : 'loses'})`);
        } else {
          console.warn(`❌ Could not find boolean property: ${team1PropertyName}`);
        }
      } catch (error) {
        console.warn(`❌ Error setting ${team1PropertyName}:`, error);
      }

      // Set team 2 boolean property - true only if team2 wins (teamWinner === 1)
      try {
        const team2Property = viewModelInstance.boolean(team2PropertyName);
        if (team2Property) {
          const team2Wins = teamWinner === 1;
          team2Property.value = team2Wins;
          console.log(`✅ Set ${team2PropertyName} = ${team2Wins} (Team 2 ${team2Wins ? 'WINS' : 'loses'})`);
        } else {
          console.warn(`❌ Could not find boolean property: ${team2PropertyName}`);
        }
      } catch (error) {
        console.warn(`❌ Error setting ${team2PropertyName}:`, error);
      }

      console.log(`🏆 Successfully set team win status for map ${mapNumber}: Team ${teamWinner + 1} wins, Team ${teamWinner === 0 ? 2 : 1} loses`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error setting team win for map ${mapNumber}:`, errorMessage);
    }
  }

  /**
   * Sets the team win status for a picked map based on score data
   * This is a wrapper method that the component can call directly
   * 
   * @param mapNumber - The map number (3-7) 
   * @param mapScore - The score data
   * @param isPastMap - Whether this is a past map (must be true to set team win)
   */
  setMapTeamWinFromScore(mapNumber: number, mapScore: { team1: number; team2: number } | string | null, isPastMap: boolean): void {
    if (!isPastMap || !mapScore) {
      console.log(`📊 Skipping team win for map ${mapNumber}: isPastMap=${isPastMap}, hasScore=${!!mapScore}`);
      return;
    }

    const winningTeamIndex = this.getWinningTeamFromScore(mapScore);
    if (winningTeamIndex !== null) {
      this.setMapTeamWin(mapNumber, winningTeamIndex);
    } else {
      console.warn(`Could not determine winning team for map ${mapNumber} from score:`, mapScore);
    }
  }

  /**
   * Debug helper to understand the nested view model structure
   */
  /**
   * Helper method to determine winning team from score data
   * @param mapScore - The score object or string
   * @returns The winning team index (0 or 1) or null if no winner can be determined
   */
  private getWinningTeamFromScore(mapScore: { team1: number; team2: number } | string | null): 0 | 1 | null {
    if (!mapScore) {
      console.log('🤔 No score data provided');
      return null;
    }

    console.log(`🔍 Determining winner from score:`, mapScore);

    if (typeof mapScore === 'string') {
      // Parse string format like "13 - 11" to determine winner
      const parts = mapScore.split(' - ').map(s => parseInt(s.trim()));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        const winner = parts[0] > parts[1] ? 0 : 1; // First score higher = team1 wins (index 0)
        console.log(`📊 String score "${mapScore}" → Team ${winner + 1} wins (${parts[0]} vs ${parts[1]})`);
        return winner;
      }
      console.warn(`⚠️ Could not parse string score: "${mapScore}"`);
      return null;
    }

    if (typeof mapScore === 'object' && mapScore.team1 !== undefined && mapScore.team2 !== undefined) {
      let winner: 0 | 1;
      if (mapScore.team1 > mapScore.team2) {
        winner = 0; // team1 wins
      } else if (mapScore.team2 > mapScore.team1) {
        winner = 1; // team2 wins  
      } else {
        winner = 0; // Tie defaults to team1
      }
      
      console.log(`📊 Object score {team1: ${mapScore.team1}, team2: ${mapScore.team2}} → Team ${winner + 1} wins`);
      return winner;
    }

    console.warn(`⚠️ Unrecognized score format:`, mapScore);
    return null;
  }

  resetAllPastMapInputs(): void {
    console.log('🔄 Resetting all pastMap inputs to false');
    
    // Reset all possible pastMap inputs (3-7)
    for (let mapNumber = 3; mapNumber <= 7; mapNumber++) {
      const pastMapInputName = `pastMap${mapNumber}`;
      this.setDataBindingInput(pastMapInputName, false, 0);
    }
  }

  // Helper method to build asset paths
  buildAssetPath(assetType: string, filename: string): string {
    // Use a default assets path since config doesn't have assetsUrl
    return `/assets/${assetType}/${filename}`;
  }

  // Animation control methods
  pauseAnimation(): void {
    if (this.rive && this.rive.isPlaying) {
      this.rive.pause();
      console.log('⏸️ Paused Rive animation');
    }
  }

  playAnimation(): void {
    if (this.rive && !this.rive.isPlaying) {
      this.rive.play();
      console.log('▶️ Started Rive animation');
    }
  }

  startAnimationWithData(): void {
    if (this.rive) {
      this.rive.play();
      console.log('🎬 Started Rive animation with data loaded');
    }
  }

  isAnimationPlaying(): boolean {
    return this.rive ? this.rive.isPlaying : false;
  }

  // Debug method to log all available elements
  debugArtboard(): void {
    if (!this.rive) {
      console.log('No Rive instance available for debugging');
      return;
    }

    console.log('=== Rive Mapban-FS Debug Information ===');
    console.log('Current Artboard:', this.currentArtboardName);
    console.log('Preloaded Assets:', Array.from(this.preloadedAssets.keys()));
    console.log('Asset References:', Array.from(this.assetReferences.keys()));
    console.log('Current Asset URLs:', Array.from(this.currentAssetUrls.entries()));
    console.log('Map States:', this.mapStates);
    
    // Show picked maps and their expected pastMap input names
    const pickedMaps = this.mapStates.filter(ms => ms.isPicked && ms.isPastMap);
    console.log('Picked Maps with PastMap Inputs:');
    pickedMaps.forEach((mapState, pickedIndex) => {
      let mapNumber: number;
      if (this.currentArtboardName === 'BO3') {
        mapNumber = 5 + pickedIndex;
      } else {
        mapNumber = 3 + pickedIndex;
      }
      
      if (mapNumber >= 3 && mapNumber <= 7) {
        const artboardName = `MAP ${mapNumber} SCORE`;
        const pastMapInputName = `pastMap${mapNumber}`;
        console.log(`  - Picked Map ${pickedIndex + 1}: ${pastMapInputName} → ${artboardName}`);
      }
    });
    
    console.log('==========================================');
  }
}
