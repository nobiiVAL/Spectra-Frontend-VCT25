import { Injectable } from '@angular/core';
import { Rive, Layout, Fit, Alignment } from '@rive-app/canvas';
import { Config } from '../shared/config';

export interface MapbanAssets {
  sponsor?: string;
  eventLogo?: string;
  t2_logo?: string;
  t1_logo?: string;
  map_7?: string;
  map_6?: string;
  map_5?: string;
  map_4?: string;
  map_3?: string;
  map_2?: string;
  map_1?: string;
}

interface ResizeConfig {
  width: number;
  height: number;
  maintainAspectRatio: boolean;
}

// Interface for sponsor information from match data
export interface SponsorInfo {
  enabled: boolean;
  sponsors: string[];
  duration?: number;
}

// Interface for map states
export interface MapState {
  mapNumber: number;
  isBanned: boolean;
  isPicked: boolean;
  bannedBy?: number;
  pickedBy?: number;
}

// Interface for Rive input states
export interface RiveInputStates {
  sponsorsEnabled: boolean;
  currentSponsorImage?: string;
  mapStates: MapState[];
}

// Interface for team information
export interface TeamInfo {
  tricode: string;
  name: string;
}

// Interface for side selection (attack/defense)
export interface SideSelection {
  team: number;
  side: 'ATTACK' | 'DEFENSE';
}

@Injectable({
  providedIn: 'root'
})
export class RiveMapbanService {
  private rive: Rive | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private config: Config | null = null;
  private currentInputStates: RiveInputStates = {
    sponsorsEnabled: false,
    mapStates: []
  };
  
  // Store asset references for dynamic updates
  private assetReferences: Map<string, any> = new Map();
  private currentAssetUrls: Map<string, string> = new Map();
  
  // Store initial colors to be set when Rive loads
  private pendingColors: { primary?: number; secondary?: number } = {};
  
  // Store team information for text updates
  private teamInfo: { [teamNumber: number]: TeamInfo } = {};
  
  // Define standard sizes for different asset types
  private readonly assetSizeConfig: Record<string, ResizeConfig> = {
    // Logo assets - consistent size for team/sponsor logos
    sponsor: { width: 1000, height: 500, maintainAspectRatio: true },
    eventLogo: { width: 220, height: 220, maintainAspectRatio: true },
    t1_logo: { width: 220, height: 220, maintainAspectRatio: true },
    t2_logo: { width: 220, height: 220, maintainAspectRatio: true },
  };

  // Preloading methods for performance optimization
  async preloadAndProcessAsset(url: string): Promise<Uint8Array> {
    try {
      // Fetch the image
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      
      // Process the image immediately with proper resizing
      const processedData = await this.processImageAsset(arrayBuffer, url);
      return processedData;
    } catch (error) {
      console.error(`Error preloading asset ${url}:`, error);
      throw error;
    }
  }

  private async processImageAsset(arrayBuffer: ArrayBuffer, assetUrl: string): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      const blob = new Blob([arrayBuffer]);
      const imageUrl = URL.createObjectURL(blob);
      const img = new Image();
      
      img.onload = () => {
        try {
          // Get resize config for this asset type
          const assetType = this.getAssetType(assetUrl);
          const resizeConfig = this.assetSizeConfig[assetType];
          
          let { width, height } = resizeConfig || { width: img.width, height: img.height, maintainAspectRatio: true };
          
          // Calculate aspect ratio preserving dimensions
          if (resizeConfig?.maintainAspectRatio) {
            const aspectRatio = img.width / img.height;
            if (aspectRatio > 1) {
              height = width / aspectRatio;
            } else {
              width = height * aspectRatio;
            }
          }
          
          // Create canvas and resize
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d')!;
          
          // Enable high quality resizing
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          
          // Draw resized image
          ctx.drawImage(img, 0, 0, width, height);
          
          // Convert to blob and then to Uint8Array
          canvas.toBlob((blob) => {
            if (blob) {
              const reader = new FileReader();
              reader.onload = () => {
                const result = reader.result as ArrayBuffer;
                resolve(new Uint8Array(result));
                URL.revokeObjectURL(imageUrl);
              };
              reader.onerror = () => {
                reject(new Error('Failed to convert blob to ArrayBuffer'));
                URL.revokeObjectURL(imageUrl);
              };
              reader.readAsArrayBuffer(blob);
            } else {
              reject(new Error('Failed to create blob from canvas'));
              URL.revokeObjectURL(imageUrl);
            }
          }, 'image/webp', 0.95);
          
        } catch (error) {
          URL.revokeObjectURL(imageUrl);
          reject(error);
        }
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(imageUrl);
        reject(new Error(`Failed to load image: ${assetUrl}`));
      };
      
      img.src = imageUrl;
    });
  }

  private getAssetType(assetUrl: string): string {
    if (assetUrl.includes('sponsor') || assetUrl.includes('logo.webp')) return 'sponsor';
    if (assetUrl.includes('eventLogo') || assetUrl.includes('icon.webp')) return 'eventLogo';
    if (assetUrl.includes('t1_logo') || assetUrl.includes('t2_logo')) return 't1_logo';
    if (assetUrl.includes('map_') || assetUrl.includes('/maps/wide/')) return 'sponsor'; // Use same config as sponsor for maps
    return 'sponsor'; // Default
  }

  async initializeRiveMapban(canvas: HTMLCanvasElement, assets: MapbanAssets, resizeConfig?: ResizeConfig, preloadedAssets?: Map<string, Uint8Array>): Promise<Rive> {
    console.log('🚀 Starting Rive initialization with full asset preloading...');
    
    // First, ensure ALL assets are preloaded and processed before initializing Rive
    const finalPreloadedAssets = preloadedAssets || new Map<string, Uint8Array>();
    
    // Collect all asset URLs that need to be preloaded
    const assetsToPreload: Array<{ name: string, url: string }> = [];
    Object.entries(assets).forEach(([assetName, assetUrl]) => {
      if (assetUrl && !finalPreloadedAssets.has(assetUrl)) {
        assetsToPreload.push({ name: assetName, url: assetUrl });
      }
    });
    
    if (assetsToPreload.length > 0) {
      console.log(`📦 Preloading ${assetsToPreload.length} assets before Rive initialization:`, assetsToPreload.map(a => a.name));
      
      // Preload all assets in parallel
      const preloadPromises = assetsToPreload.map(async ({ name, url }) => {
        try {
          console.log(`⏳ Preloading asset '${name}' from: ${url}`);
          const processedData = await this.preloadAndProcessAsset(url);
          finalPreloadedAssets.set(url, processedData);
          console.log(`✅ Successfully preloaded and processed asset '${name}'`);
          return { name, url, success: true };
        } catch (error) {
          console.error(`❌ Failed to preload asset '${name}' from ${url}:`, error);
          return { name, url, success: false, error };
        }
      });
      
      const preloadResults = await Promise.allSettled(preloadPromises);
      const successfulPreloads = preloadResults.filter(result => 
        result.status === 'fulfilled' && result.value.success
      ).length;
      
      console.log(`📦 Asset preloading complete: ${successfulPreloads}/${assetsToPreload.length} successful`);
      
      if (successfulPreloads === 0) {
        console.warn('⚠️ No assets were successfully preloaded, but continuing with Rive initialization');
      }
    } else {
      console.log('📦 All assets already preloaded, proceeding with Rive initialization');
    }
    
    return new Promise((resolve, reject) => {
      this.canvas = canvas;
      
      // Set canvas to native resolution to prevent blurriness
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
      
      // Create optimized asset loader using fully preloaded assets
      const assetLoader = (asset: any): boolean => {
        const assetName = asset.name;
        const assetUrl = assets[assetName as keyof MapbanAssets];
        
        // Store the asset reference for later dynamic updates
        this.assetReferences.set(assetName, asset);
        
        if (assetUrl && finalPreloadedAssets.has(assetUrl)) {
          // Use preloaded asset - this should be instant since everything is preloaded!
          const processedImageData = finalPreloadedAssets.get(assetUrl)!;
          try {
            asset.decode(processedImageData);
            // Track the current asset URL
            this.currentAssetUrls.set(assetName, assetUrl);
            console.log(`✅ Loaded preloaded asset '${assetName}' instantly`);
            return true;
          } catch (error) {
            console.error(`❌ Failed to decode preloaded asset ${assetName}:`, error);
            return false;
          }
        } else if (assetUrl) {
          // This should rarely happen now since we preload everything
          console.warn(`⚠️ Asset ${assetName} not in preloaded cache, loading on demand (this may cause visual artifacts)`);
          this.loadAndResizeAsset(assetUrl, assetName)
            .then((processedImageData: Uint8Array) => {
              asset.decode(processedImageData);
              this.currentAssetUrls.set(assetName, assetUrl);
              console.log(`✅ Loaded on-demand asset '${assetName}' from: ${assetUrl}`);
            })
            .catch((error: any) => {
              console.error(`❌ Failed to load and resize asset ${assetName}:`, error);
            });
          return true;
        }
        
        console.warn(`❌ Asset not found: ${assetName}`);
        return false;
      };

      console.log('🎨 Initializing Rive with all assets preloaded...');
      this.rive = new Rive({
        src: '/assets/mapban/mapban.riv',
        canvas: canvas,
        layout: new Layout({
          fit: Fit.Cover,
          alignment: Alignment.Center,
        }),
        autoplay: true,
        autoBind: false, // Disable auto-binding so we can manually bind the "Colors" view model
        assetLoader: assetLoader,
        onLoad: () => {
          console.log('🎨 Rive loaded successfully with all assets preloaded - no mid-animation loading!');
          
          // Debug viewmodel information FIRST
          const viewModelInstance = this.rive!.viewModelInstance;
          if (viewModelInstance) {
            console.log('✅ ViewModelInstance available');
            
            // First, let's see what properties are available
            console.log('ViewModelInstance methods:', Object.getOwnPropertyNames(viewModelInstance));
            console.log('ViewModelInstance prototype:', Object.getOwnPropertyNames(Object.getPrototypeOf(viewModelInstance)));
            
            // Try to access the named view model "Colors" using correct API
            let namedViewModel = null;
            try {
              console.log('🔍 Trying to access named view model using correct API...');
              
              // Method 1: Use viewModelByName() - the correct API method
              try {
                namedViewModel = this.rive!.viewModelByName('Colors');
                if (namedViewModel) {
                  console.log('✅ Found named view model "Colors" via viewModelByName() method');
                  console.log('Named ViewModel methods:', Object.getOwnPropertyNames(namedViewModel));
                  console.log('Named ViewModel prototype:', Object.getOwnPropertyNames(Object.getPrototypeOf(namedViewModel)));
                }
              } catch (error) {
                console.log('❌ viewModelByName() method failed:', (error as Error).message);
              }
              
              // Method 2: Try viewModelByIndex() to see what view models are available
              if (!namedViewModel) {
                try {
                  const viewModelCount = this.rive!.viewModelCount;
                  console.log(`🔍 Found ${viewModelCount} view models, listing them:`);
                  
                  for (let i = 0; i < viewModelCount; i++) {
                    const vm = this.rive!.viewModelByIndex(i);
                    if (vm) {
                      console.log(`  - View Model ${i}: ${vm.name || 'unnamed'}`);
                      
                      if (vm.name === 'Colors') {
                        namedViewModel = vm;
                        console.log('✅ Found "Colors" view model by index');
                        break;
                      }
                    }
                  }
                } catch (error) {
                  console.log('❌ viewModelByIndex() method failed:', (error as Error).message);
                }
              }
              
              // Method 3: Try defaultViewModel() to see the default one
              if (!namedViewModel) {
                try {
                  const defaultVM = this.rive!.defaultViewModel();
                  if (defaultVM) {
                    console.log(`🔍 Default view model: ${defaultVM.name || 'unnamed'}`);
                    if (defaultVM.name === 'Colors') {
                      namedViewModel = defaultVM;
                      console.log('✅ "Colors" is the default view model');
                    }
                  }
                } catch (error) {
                  console.log('❌ defaultViewModel() method failed:', (error as Error).message);
                }
              }
              
              if (!namedViewModel) {
                console.log('🔍 Available methods on Rive instance:', Object.getOwnPropertyNames(this.rive));
                console.warn('❌ Named view model "Colors" not found with any method');
              }
            } catch (error) {
              console.log('❌ Error accessing named view model "Colors":', (error as Error).message);
            }
            
            try {
              // Try to access the color properties using both approaches
              console.log('🔍 Attempting to access color properties...');
              
              let primaryColorProperty = null;
              let secondaryColorProperty = null;
              
              // First try the named view model approach
              if (namedViewModel) {
                console.log('🔍 Trying named view model approach...');
                try {
                  // Create an instance from the view model to access properties
                  const namedViewModelInstance = namedViewModel.defaultInstance();
                  if (namedViewModelInstance) {
                    console.log('✅ Created instance from named view model "Colors"');
                    
                    // Manually bind the instance since autoBind is disabled
                    try {
                      this.rive!.bindViewModelInstance(namedViewModelInstance);
                      console.log('✅ Manually bound "Colors" view model instance');
                    } catch (bindError) {
                      console.log('❌ Could not bind view model instance:', (bindError as Error).message);
                    }
                    
                    try {
                      primaryColorProperty = namedViewModelInstance.color('primaryColor');
                      if (primaryColorProperty) {
                        console.log(`✅ Found primary color via named VM instance: current value: 0x${primaryColorProperty.value.toString(16).toUpperCase()}`);
                      }
                    } catch (error) {
                      console.log('❌ Named VM instance primary color not accessible:', (error as Error).message);
                    }
                    
                    try {
                      secondaryColorProperty = namedViewModelInstance.color('secondaryColor');
                      if (secondaryColorProperty) {
                        console.log(`✅ Found secondary color via named VM instance: current value: 0x${secondaryColorProperty.value.toString(16).toUpperCase()}`);
                      }
                    } catch (error) {
                      console.log('❌ Named VM instance secondary color not accessible:', (error as Error).message);
                    }
                  } else {
                    console.log('❌ Could not create instance from named view model');
                  }
                } catch (error) {
                  console.log('❌ Error creating instance from named view model:', (error as Error).message);
                }
              }
              
              // If named view model didn't work, fallback to default approach
              if (!primaryColorProperty || !secondaryColorProperty) {
                console.log('🔍 Trying default view model approach...');
                
                // Since autoBind is disabled, we need to manually get and bind the default view model
                let defaultViewModelInstance = this.rive!.viewModelInstance;
                
                if (!defaultViewModelInstance) {
                  console.log('🔍 No view model instance bound, trying to bind default...');
                  try {
                    const defaultVM = this.rive!.defaultViewModel();
                    if (defaultVM) {
                      defaultViewModelInstance = defaultVM.defaultInstance();
                      if (defaultViewModelInstance) {
                        this.rive!.bindViewModelInstance(defaultViewModelInstance);
                        console.log('✅ Manually bound default view model instance');
                      }
                    }
                  } catch (error) {
                    console.log('❌ Could not bind default view model:', (error as Error).message);
                  }
                }
                
                if (defaultViewModelInstance) {
                  const colorPropertyNames = ['primaryColor', 'mapbanPrimaryColor'];
                  const secondaryPropertyNames = ['secondaryColor', 'mapbanSecondaryColor'];
                  
                  for (const name of colorPropertyNames) {
                    try {
                      const prop = defaultViewModelInstance.color(name);
                      if (prop && !primaryColorProperty) {
                        primaryColorProperty = prop;
                        console.log(`✅ Found primary color property: '${name}'`);
                        console.log(`🔍 Before setting - ${name} value: 0x${prop.value.toString(16).toUpperCase()}`);
                        break;
                      }
                    } catch (error) {
                      console.log(`❌ Property '${name}' not found:`, (error as Error).message);
                    }
                  }
                  
                  for (const name of secondaryPropertyNames) {
                    try {
                      const prop = defaultViewModelInstance.color(name);
                      if (prop && !secondaryColorProperty) {
                        secondaryColorProperty = prop;
                        console.log(`✅ Found secondary color property: '${name}'`);
                        console.log(`🔍 Before setting - ${name} value: 0x${prop.value.toString(16).toUpperCase()}`);
                        break;
                      }
                    } catch (error) {
                      console.log(`❌ Property '${name}' not found:`, (error as Error).message);
                    }
                  }
                } else {
                  console.warn('❌ No view model instance available for fallback');
                }
              }
              
              console.log('Color properties found:', {
                primary: primaryColorProperty ? `0x${primaryColorProperty.value.toString(16).toUpperCase()}` : 'Not found',
                secondary: secondaryColorProperty ? `0x${secondaryColorProperty.value.toString(16).toUpperCase()}` : 'Not found'
              });
              
            } catch (error) {
              console.log('❌ Error accessing color properties:', error);
            }
            
            // Initialize team logos view model
            try {
              console.log('🏆 Initializing team logos view model...');
              
              let teamLogosViewModel = null;
              try {
                teamLogosViewModel = this.rive!.viewModelByName('teamLogos');
                if (teamLogosViewModel) {
                  console.log('✅ Found teamLogos view model');
                  
                  // Create and bind the instance
                  const teamLogosInstance = teamLogosViewModel.defaultInstance();
                  if (teamLogosInstance) {
                    console.log('✅ Created teamLogos view model instance');
                    
                    try {
                      this.rive!.bindViewModelInstance(teamLogosInstance);
                      console.log('✅ Manually bound teamLogos view model instance');
                    } catch (bindError) {
                      console.log('❌ Could not bind teamLogos view model instance:', (bindError as Error).message);
                    }
                    
                    // Test access to image properties
                    const mapLogoProperties = ['map1Logo', 'map2Logo', 'map3Logo', 'map4Logo', 'map5Logo', 'map6Logo'];
                    for (const propertyName of mapLogoProperties) {
                      try {
                        const imageProperty = teamLogosInstance.image(propertyName);
                        if (imageProperty) {
                          console.log(`✅ Found team logo property: ${propertyName}`);
                        }
                      } catch (error) {
                        console.log(`❌ Team logo property ${propertyName} not accessible:`, (error as Error).message);
                      }
                    }
                  } else {
                    console.warn('❌ Could not create teamLogos view model instance');
                  }
                } else {
                  console.warn('❌ TeamLogos view model not found');
                }
              } catch (error) {
                console.error('❌ Error accessing teamLogos view model:', (error as Error).message);
              }
              
            } catch (error) {
              console.log('❌ Error initializing team logos view model:', error);
            }
          } else {
            console.warn('❌ ViewModelInstance not available in onLoad');
          }
          
          // Use setTimeout to ensure Rive is fully ready before setting colors
          setTimeout(() => {
            console.log('🔄 Setting colors after Rive initialization...');
            
            // Set colors from config if available
            if (this.config) {
              const primaryColorHex = this.hexToNumber(this.config.mapbanPrimaryColor);
              const secondaryColorHex = this.hexToNumber(this.config.mapbanSecondaryColor);
              
              console.log('🎨 Setting colors from config:', {
                primary: `${this.config.mapbanPrimaryColor} -> 0x${primaryColorHex.toString(16).toUpperCase()}`,
                secondary: `${this.config.mapbanSecondaryColor} -> 0x${secondaryColorHex.toString(16).toUpperCase()}`
              });
              
              this.updateMapbanColors(primaryColorHex, secondaryColorHex);
            } else if (this.pendingColors.primary && this.pendingColors.secondary) {
              // Fallback to pending colors if no config
              this.updateMapbanColors(this.pendingColors.primary, this.pendingColors.secondary);
              this.pendingColors = {};
            }
          }, 100); // Small delay to ensure everything is ready
          
          resolve(this.rive!);
        },
        onLoadError: (error) => {
          console.error('Rive animation failed to load:', error);
          reject(error);
        },
      });
    });
  }

  updateAssetsFromPreloaded(assets: MapbanAssets, preloadedAssets: Map<string, Uint8Array>): void {
    if (!this.rive) return;
    
    console.log('🔄 Updating assets dynamically with preloaded data');
    
    // Check if we need to update any assets
    let needsUpdate = false;
    Object.entries(assets).forEach(([assetName, assetUrl]) => {
      if (assetUrl && this.currentAssetUrls.get(assetName) !== assetUrl) {
        needsUpdate = true;
      }
    });
    
    if (!needsUpdate) {
      console.log('No asset updates needed - all assets are current');
      return;
    }
    
    // Update each asset that has changed
    Object.entries(assets).forEach(([assetName, assetUrl]) => {
      if (assetUrl && this.currentAssetUrls.get(assetName) !== assetUrl) {
        const assetRef = this.assetReferences.get(assetName);
        if (assetRef && preloadedAssets.has(assetUrl)) {
          try {
            const processedImageData = preloadedAssets.get(assetUrl)!;
            
            // Use the asset's decode method to update the image
            assetRef.decode(processedImageData);
            this.currentAssetUrls.set(assetName, assetUrl);
            
            console.log(`✅ Successfully updated asset '${assetName}' with: ${assetUrl}`);
          } catch (error) {
            console.error(`Error updating asset '${assetName}':`, error);
          }
        } else if (!assetRef) {
          console.warn(`Asset reference '${assetName}' not found - asset was not loaded through assetLoader`);
        } else {
          console.warn(`Asset '${assetName}' not found in preloaded assets: ${assetUrl}`);
        }
      }
    });
  }

  updateAssets(assets: MapbanAssets): void {
    if (!this.rive) return;
    
    console.log('🔄 Loading assets on demand (slower than preloaded)');
    
    // For assets not preloaded, we need to load and update them individually
    Object.entries(assets).forEach(async ([assetName, assetUrl]) => {
      if (assetUrl && this.currentAssetUrls.get(assetName) !== assetUrl) {
        const assetRef = this.assetReferences.get(assetName);
        if (assetRef) {
          try {
            const processedImageData = await this.preloadAndProcessAsset(assetUrl);
            assetRef.decode(processedImageData);
            this.currentAssetUrls.set(assetName, assetUrl);
            
            console.log(`✅ Successfully loaded and updated asset '${assetName}' with: ${assetUrl}`);
          } catch (error) {
            console.error(`Error loading and updating asset '${assetName}':`, error);
          }
        } else {
          console.warn(`Asset reference '${assetName}' not found - asset was not loaded through assetLoader`);
        }
      }
    });
  }

  // Method that needs to exist for fallback loading
  private async loadAndResizeAsset(url: string, assetName: string): Promise<Uint8Array> {
    // This is the fallback method for when assets aren't preloaded
    return this.preloadAndProcessAsset(url);
  }

  /**
   * Update sponsor information and trigger sponsor artboard animations
   */
  updateSponsorInfo(sponsorInfo: SponsorInfo): void {
    this.currentInputStates.sponsorsEnabled = sponsorInfo.enabled;
    
    if (sponsorInfo.enabled && sponsorInfo.sponsors.length > 0) {
      // Set the first sponsor image as current
      this.currentInputStates.currentSponsorImage = sponsorInfo.sponsors[0];
      // Fire the sponsors trigger using the nested artboard path
      this.setRiveInput('sponsorsEnabled', true, 'Sponsors');
      console.log('Sponsors enabled, showing first sponsor:', sponsorInfo.sponsors[0]);
    } else {
      this.currentInputStates.currentSponsorImage = undefined;
      this.setRiveInput('sponsorsEnabled', false, 'Sponsors');
      console.log('Sponsors disabled');
    }
  }

  /**
   * Update map states for bans and picks
   */
  updateMapStates(mapStates: MapState[]): void {
    this.currentInputStates.mapStates = mapStates;
    
    // Update Rive inputs for each map state using correct nested artboard paths
    mapStates.forEach((mapState) => {
      // First set the map number on the main artboard
      this.setRiveInput('map', mapState.mapNumber);
      
      // Then trigger ban or pick animations using the correct nested artboard paths
      if (mapState.isBanned) {
        this.setRiveInput('isBanned', true, `Ban ${mapState.mapNumber}`);
      }
      if (mapState.isPicked) {
        this.setRiveInput('isPicked', true, `Pick ${mapState.mapNumber}`);
      }
      
      console.log(`Map ${mapState.mapNumber}: banned=${mapState.isBanned}, picked=${mapState.isPicked}`);
    });
  }

  /**
   * Update a specific map's ban/pick status
   */
  updateMapStatus(mapNumber: number, isBanned: boolean, isPicked: boolean, actionBy?: number, mapName?: string, sideSelection?: SideSelection): void {
    // Find and update the map state
    let mapState = this.currentInputStates.mapStates.find(m => m.mapNumber === mapNumber);
    
    if (!mapState) {
      mapState = { mapNumber, isBanned: false, isPicked: false };
      this.currentInputStates.mapStates.push(mapState);
    }
    
    mapState.isBanned = isBanned;
    mapState.isPicked = isPicked;
    
    if (isBanned && actionBy !== undefined) {
      mapState.bannedBy = actionBy;
    }
    if (isPicked && actionBy !== undefined) {
      mapState.pickedBy = actionBy;
    }
    
    // Update map name text if provided
    if (mapName) {
      this.updateMapNameText(mapNumber, mapName);
    }
    
    // Update team logo for this map based on who acted on it
    if (actionBy !== undefined && mapNumber >= 1 && mapNumber <= 6) {
      this.updateMapTeamLogo(mapNumber, actionBy);
    }
    
    // Update Rive using correct nested artboard paths
    if (isBanned) {
      this.setRiveInput('map', mapNumber);
      this.setRiveInput('isBanned', true, `Ban ${mapNumber}`);
      
      // Update veto text for ban action
      this.updateVetoText(mapNumber, 'VETO', actionBy);
      
      console.log(`Map ${mapNumber} banned by team ${actionBy}`);
    }
    
    if (isPicked) {
      this.setRiveInput('map', mapNumber);
      this.setRiveInput('isPicked', true, `Pick ${mapNumber}`);
      
      // Update veto text for pick action
      this.updateVetoText(mapNumber, 'SELECT', actionBy);
      
      // Update pick text with side selection if provided
      // Note: The team that picks the side is OPPOSITE to the team that picked the map
      if (sideSelection) {
        console.log(`📝 Updating pick text for map ${mapNumber}: team ${actionBy} picked map, team ${sideSelection.team} picks ${sideSelection.side} side`);
        this.updatePickText(sideSelection.team, sideSelection.side, `Pick ${mapNumber}`);
      }
      
      console.log(`Map ${mapNumber} picked by team ${actionBy}`);
    }
  }

  /**
   * Reset all map states
   */
  resetMapStates(): void {
    this.currentInputStates.mapStates = [];
    
    // Reset all map-related inputs in both Pick and Ban nested artboards
    for (let i = 1; i <= 7; i++) {
      this.setRiveInput('isBanned', false, `Ban ${i}`);
      this.setRiveInput('isPicked', false, `Pick ${i}`);
    }
    
    console.log('All map states reset');
  }

  /**
   * Cycle through sponsor images
   */
  cycleSponsor(sponsors: string[], currentIndex: number): void {
    if (sponsors.length > 0) {
      this.currentInputStates.currentSponsorImage = sponsors[currentIndex];
      console.log(`Cycling to sponsor: ${sponsors[currentIndex]}`);
    }
  }

  /**
   * Set a Rive input value with optional nested artboard path
   */
  setRiveInput(inputName: string, value: any, artboardPath?: string): void {
    if (!this.rive) return;

    try {
      if (artboardPath) {
        // Use the proper nested artboard API methods
        if (typeof value === 'boolean') {
          this.rive.setBooleanStateAtPath(inputName, value as boolean, artboardPath);
          console.log(`Set nested boolean input '${inputName}' to ${value} at path '${artboardPath}'`);
        } else if (typeof value === 'number') {
          this.rive.setNumberStateAtPath(inputName, value as number, artboardPath);
          console.log(`Set nested number input '${inputName}' to ${value} at path '${artboardPath}'`);
        } else if (typeof value === 'string') {
          // For trigger inputs, fire the state at the specified path
          this.rive.fireStateAtPath(inputName, artboardPath);
          console.log(`Fired nested trigger input '${inputName}' at path '${artboardPath}'`);
        }
      } else {
        // Use regular input setting for main artboard
        const inputs = this.rive.stateMachineInputs('State Machine 1');
        if (!inputs) {
          console.warn('No state machine inputs found for main artboard');
          return;
        }

        const input = inputs.find(i => i.name === inputName);
        if (input) {
          if (typeof value === 'boolean') {
            (input as any).value = value;
          } else if (typeof value === 'number') {
            (input as any).value = value;
          } else if (typeof value === 'string') {
            // For trigger inputs
            (input as any).fire();
          }
          console.log(`Set main artboard input '${inputName}' to ${value}`);
        } else {
          console.warn(`Input '${inputName}' not found in main artboard`);
        }
      }
    } catch (error) {
      console.error(`Error setting Rive input '${inputName}' at path '${artboardPath}':`, error);
    }
  }

  /**
   * Debug method to list all available inputs and test text runs
   */
  debugListInputs(): void {
    if (!this.rive) {
      console.log('Rive not initialized');
      return;
    }

    console.log('=== RIVE DEBUG INFO ===');
    console.log('Pending colors:', this.pendingColors);

    // Check main artboard inputs
    const mainInputs = this.rive.stateMachineInputs('State Machine 1');
    if (mainInputs) {
      console.log('Main artboard inputs:', mainInputs.map(input => ({
        name: input.name,
        type: input.constructor.name,
        value: (input as any).value
      })));
    } else {
      console.log('No main artboard inputs found');
    }

    // Check data binding view model
    try {
      const viewModelInstance = this.rive.viewModelInstance;
      if (viewModelInstance) {
        console.log('✅ Data binding view model instance found');
        
        // Try to access color properties
        try {
          const primaryColor = viewModelInstance.color('primaryColor');
          const secondaryColor = viewModelInstance.color('secondaryColor');
          
          console.log('Color properties:', {
            primaryColor: primaryColor ? `0x${primaryColor.value.toString(16).toUpperCase()}` : 'Not found',
            secondaryColor: secondaryColor ? `0x${secondaryColor.value.toString(16).toUpperCase()}` : 'Not found'
          });
          
          // Try to list all available properties on the viewModelInstance
          console.log('ViewModelInstance methods/properties:', Object.getOwnPropertyNames(viewModelInstance));
          console.log('ViewModelInstance prototype:', Object.getOwnPropertyNames(Object.getPrototypeOf(viewModelInstance)));
          
        } catch (error) {
          console.log('❌ Error accessing color properties:', error);
        }
      } else {
        console.log('❌ No data binding view model instance found');
      }
    } catch (error) {
      console.log('❌ Error accessing view model:', error);
    }

    // Test nested artboard paths to see what's available
    const testPaths = [
      'Pick 1', 'Pick 2', 'Pick 3', 'Pick 4', 'Pick 5', 'Pick 6', 'Pick 7',
      'Ban 1', 'Ban 2', 'Ban 3', 'Ban 4', 'Ban 5', 'Ban 6', 'Ban 7',
      'Sponsors'
    ];
    
    console.log('Testing nested artboard access:');
    testPaths.forEach(path => {
      try {
        // Try to access nested inputs using the path-based methods
        this.rive!.setBooleanStateAtPath('test', false, path);
        console.log(`✓ Path '${path}' is accessible`);
      } catch (error) {
        console.log(`✗ Path '${path}' is not accessible:`, (error as Error).message);
      }
    });

    // Test text runs
    console.log('Testing text run access:');
    const testTextRuns = ['MAP 1', 'MAP 2', 'VETO 1', 'VETO 2', 'PICK'];
    
    testTextRuns.forEach(textRunName => {
      try {
        this.rive!.setTextRunValue(textRunName, 'TEST');
        console.log(`✓ Text run '${textRunName}' is accessible`);
      } catch (error) {
        console.log(`✗ Text run '${textRunName}' is not accessible:`, (error as Error).message);
      }
    });
  }

  /**
   * Get current input states for debugging
   */
  getCurrentStates(): RiveInputStates {
    return { ...this.currentInputStates };
  }

  cleanup() {
    if (this.rive) {
      this.rive.cleanup();
      this.rive = null;
    }
  }

  getRive(): Rive | null {
    return this.rive;
  }

  /**
   * Set team information for text runs
   */
  setTeamInfo(teamNumber: number, teamInfo: TeamInfo): void {
    this.teamInfo[teamNumber] = teamInfo;
    console.log(`Team ${teamNumber} info set:`, teamInfo);
  }

  /**
   * Update map name text run
   */
  updateMapNameText(mapNumber: number, mapName: string): void {
    if (!this.rive) return;
    
    try {
      const textRunName = `MAP ${mapNumber}`;
      // Ensure map name is uppercase
      const upperMapName = mapName.toUpperCase();
      this.rive.setTextRunValue(textRunName, upperMapName);
      console.log(`Updated map text '${textRunName}' to: ${upperMapName}`);
    } catch (error) {
      console.error(`Error updating map name text for map ${mapNumber}:`, error);
    }
  }

  /**
   * Update veto/select text based on action type and team
   */
  updateVetoText(mapNumber: number, actionType: 'VETO' | 'SELECT' | 'DECIDER', teamNumber?: number): void {
    if (!this.rive) return;
    
    try {
      const textRunName = `VETO ${mapNumber}`;
      let textValue: string;
      
      if (actionType === 'DECIDER') {
        textValue = 'DECIDER\nMAP';
      } else {
        const team = (teamNumber !== undefined) ? this.teamInfo[teamNumber] : null;
        const teamTricode = team ? team.tricode : 'TEAM';
        textValue = `${teamTricode}\n${actionType} MAP`;
      }
      
      this.rive.setTextRunValue(textRunName, textValue);
      console.log(`Updated veto text '${textRunName}' to: ${textValue}`);
    } catch (error) {
      console.error(`Error updating veto text for map ${mapNumber}:`, error);
    }
  }

  /**
   * Set nested text run value (for text runs within nested artboards)
   * Based on working implementation from mapban-fs service
   */
  setNestedTextRun(textRunName: string, value: string, path: string): void {
    if (!this.rive) {
      console.error('Rive not initialized');
      return;
    }

    try {
      // For nested text runs, use the path-based API (simplified approach like mapban-fs)
      this.rive.setTextRunValueAtPath(textRunName, value.toUpperCase(), path);
      console.log(`✅ Set nested text run '${textRunName}' at path '${path}' to: ${value.toUpperCase()}`);
    } catch (error) {
      console.error(`Error setting nested text run '${textRunName}' at path '${path}':`, error);
    }
  }

  /**
   * Update pick animation text with team and side information
   */
  updatePickText(teamNumber: number, side: 'ATTACK' | 'DEFENSE', artboardPath: string): void {
    if (!this.rive) return;
    
    try {
      const team = this.teamInfo[teamNumber];
      const teamTricode = team ? team.tricode : 'TEAM';
      const textValue = `${teamTricode} PICKS\n${side}`;
      
      console.log(`📝 Updating PICK text for team ${teamNumber} (${teamTricode}) picking ${side} in artboard: ${artboardPath}`);
      
      // Use the new setNestedTextRun method based on mapban-fs pattern
      this.setNestedTextRun('PICK', textValue, artboardPath);
      
    } catch (error) {
      console.error(`Error updating pick text in ${artboardPath}:`, error);
    }
  }

  /**
   * Manually set team logos for specific maps (useful for initialization)
   */
  setTeamLogosForMaps(teamLogos: { mapNumber: number, teamNumber: number }[]): void {
    console.log('🏆 Setting team logos for maps:', teamLogos);
    
    teamLogos.forEach(({ mapNumber, teamNumber }) => {
      if (mapNumber >= 1 && mapNumber <= 6) {
        this.updateMapTeamLogo(mapNumber, teamNumber);
      }
    });
  }

  /**
   * Update team logo for a specific map in the teamLogos view model
   */
  updateMapTeamLogo(mapNumber: number, teamNumber: number): void {
    if (!this.rive) return;
    
    // Only update logos for maps 1-6 as specified
    if (mapNumber < 1 || mapNumber > 6) {
      console.warn(`Map number ${mapNumber} is out of range for team logo assignment (1-6)`);
      return;
    }
    
    try {
      // Access the teamLogos view model
      let teamLogosViewModel = null;
      try {
        teamLogosViewModel = this.rive.viewModelByName('teamLogos');
        if (!teamLogosViewModel) {
          console.warn('TeamLogos view model not found');
          return;
        }
      } catch (error) {
        console.error('Error accessing teamLogos view model:', error);
        return;
      }
      
      // Create or get the view model instance
      let teamLogosInstance = null;
      try {
        teamLogosInstance = teamLogosViewModel.defaultInstance();
        if (!teamLogosInstance) {
          console.warn('Could not create teamLogos view model instance');
          return;
        }
      } catch (error) {
        console.error('Error creating teamLogos view model instance:', error);
        return;
      }
      
      // Determine which asset to use based on team number
      const assetName = teamNumber === 0 ? 't1_logo' : 't2_logo';
      const logoPropertyName = `map${mapNumber}Logo`;
      
      try {
        // Get the image property for this map
        const imageProperty = teamLogosInstance.image(logoPropertyName);
        if (imageProperty) {
          // Get the asset reference for the team logo
          const assetRef = this.assetReferences.get(assetName);
          if (assetRef) {
            // Assign the team logo asset to this map's logo property
            imageProperty.value = assetRef;
            console.log(`✅ Set ${logoPropertyName} to ${assetName} for team ${teamNumber}`);
          } else {
            console.warn(`Asset reference for ${assetName} not found`);
          }
        } else {
          console.warn(`Image property ${logoPropertyName} not found in teamLogos view model`);
        }
      } catch (error) {
        console.error(`Error setting image property ${logoPropertyName}:`, error);
      }
      
    } catch (error) {
      console.error(`Error updating team logo for map ${mapNumber}:`, error);
    }
  }

  /**
   * Set a map as the decider map
   */
  setDeciderMap(mapNumber: number, mapName?: string): void {
    // Update map name if provided
    if (mapName) {
      this.updateMapNameText(mapNumber, mapName);
    }
    
    // Update veto text for decider
    this.updateVetoText(mapNumber, 'DECIDER');
    
    // Set the map number on the main artboard
    this.setRiveInput('map', mapNumber);
    
    console.log(`Map ${mapNumber} set as decider map`);
  }

  /**
   * Update mapban colors using direct viewModelInstance access (simplified)
   */
  updateMapbanColors(primaryColor: number, secondaryColor: number): void {
    if (!this.rive) {
      console.warn('Cannot update colors - Rive not initialized');
      return;
    }

    console.log(`🎨 Attempting to set colors: primary=0x${primaryColor.toString(16).toUpperCase()}, secondary=0x${secondaryColor.toString(16).toUpperCase()}`);

    try {
      let primaryColorProperty = null;
      let secondaryColorProperty = null;
      
      // First try to access the named view model "Colors"
      console.log('🔍 Trying named view model "Colors" approach...');
      try {
        let namedViewModel = null;
        
        // Try different methods to access the named view model using correct API
        try {
          namedViewModel = this.rive.viewModelByName('Colors');
          if (namedViewModel) {
            console.log('✅ Found named view model "Colors"');
            
            // Create an instance from the view model to access properties
            const namedViewModelInstance = namedViewModel.defaultInstance();
            if (namedViewModelInstance) {
              console.log('✅ Created instance from named view model');
              
              // Manually bind the instance to replace the auto-bound default instance
              try {
                // First, let's check what the current viewModelInstance is before binding
                const currentInstance = this.rive!.viewModelInstance;
                console.log('🔍 Current auto-bound instance before manual binding:', currentInstance ? 'exists' : 'null');
                
                this.rive!.bindViewModelInstance(namedViewModelInstance);
                console.log('✅ Bound named view model instance to Rive');
                
                // Verify the binding worked
                const newInstance = this.rive!.viewModelInstance;
                console.log('🔍 Instance after manual binding:', newInstance === namedViewModelInstance ? 'correctly bound' : 'binding may have failed');
                
                // Force a state machine restart to ensure the new binding takes effect
                setTimeout(() => {
                  try {
                    this.rive!.resizeDrawingSurfaceToCanvas();
                    console.log('✅ Triggered redraw after binding');
                  } catch (error) {
                    console.log('❌ Could not trigger redraw:', (error as Error).message);
                  }
                }, 10);
                
              } catch (bindError) {
                console.log('❌ Could not bind named view model instance:', (bindError as Error).message);
              }
              
              try {
                primaryColorProperty = namedViewModelInstance.color('primaryColor');
                if (primaryColorProperty) {
                  console.log(`✅ Found primary color via named VM instance, current value: 0x${primaryColorProperty.value.toString(16).toUpperCase()}`);
                }
              } catch (error) {
                console.log('❌ Named VM instance primary color not accessible:', (error as Error).message);
              }
              
              try {
                secondaryColorProperty = namedViewModelInstance.color('secondaryColor');
                if (secondaryColorProperty) {
                  console.log(`✅ Found secondary color via named VM instance, current value: 0x${secondaryColorProperty.value.toString(16).toUpperCase()}`);
                }
              } catch (error) {
                console.log('❌ Named VM instance secondary color not accessible:', (error as Error).message);
              }
            }
          }
        } catch (error) {
          console.log('❌ Named view model access failed:', (error as Error).message);
          
          // Try by index as fallback
          try {
            const viewModelCount = this.rive.viewModelCount;
            console.log(`🔍 Trying by index, found ${viewModelCount} view models`);
            
            for (let i = 0; i < viewModelCount; i++) {
              const vm = this.rive.viewModelByIndex(i);
              if (vm && vm.name === 'Colors') {
                namedViewModel = vm;
                console.log('✅ Found "Colors" view model by index');
                
                const namedViewModelInstance = vm.defaultInstance();
                if (namedViewModelInstance) {
                  // Manually bind the instance to replace the auto-bound default instance
                  try {
                    console.log('🔍 Binding named view model instance in updateMapbanColors (via index)...');
                    this.rive.bindViewModelInstance(namedViewModelInstance);
                    console.log('✅ Bound named view model instance to Rive (via index)');
                    
                    // Verify the binding worked
                    const boundInstance = this.rive.viewModelInstance;
                    console.log('🔍 Verified binding (via index):', boundInstance === namedViewModelInstance ? 'success' : 'failed');
                  } catch (bindError) {
                    console.log('❌ Could not bind named view model instance (via index):', (bindError as Error).message);
                  }
                  
                  try {
                    primaryColorProperty = namedViewModelInstance.color('primaryColor');
                    if (primaryColorProperty) {
                      console.log(`✅ Found primary color via indexed VM instance`);
                    }
                  } catch (error) {
                    console.log('❌ Indexed VM primary color not accessible:', (error as Error).message);
                  }
                  
                  try {
                    secondaryColorProperty = namedViewModelInstance.color('secondaryColor');
                    if (secondaryColorProperty) {
                      console.log(`✅ Found secondary color via indexed VM instance`);
                    }
                  } catch (error) {
                    console.log('❌ Indexed VM secondary color not accessible:', (error as Error).message);
                  }
                }
                break;
              }
            }
          } catch (indexError) {
            console.log('❌ Index-based access also failed:', (indexError as Error).message);
          }
        }
      } catch (error) {
        console.log('❌ Error accessing named view model:', (error as Error).message);
      }
      
      // Fallback to default viewModelInstance if named approach didn't work
      if (!primaryColorProperty || !secondaryColorProperty) {
        console.log('🔍 Falling back to default viewModelInstance approach...');
        let viewModelInstance = this.rive.viewModelInstance;
        
        // Since autoBind is disabled, manually bind default view model if needed
        if (!viewModelInstance) {
          console.log('🔍 No view model bound, trying to bind default...');
          try {
            const defaultVM = this.rive.defaultViewModel();
            if (defaultVM) {
              viewModelInstance = defaultVM.defaultInstance();
              if (viewModelInstance) {
                this.rive.bindViewModelInstance(viewModelInstance);
                console.log('✅ Manually bound default view model in updateMapbanColors');
              }
            }
          } catch (error) {
            console.log('❌ Could not bind default view model in updateMapbanColors:', (error as Error).message);
          }
        }
        
        if (viewModelInstance) {
          const primaryNames = ['primaryColor', 'mapbanPrimaryColor'];
          const secondaryNames = ['secondaryColor', 'mapbanSecondaryColor'];
          
          // Find primary color property
          if (!primaryColorProperty) {
            for (const name of primaryNames) {
              try {
                const prop = viewModelInstance.color(name);
                if (prop) {
                  primaryColorProperty = prop;
                  console.log(`✅ Found primary color property: '${name}', current value: 0x${prop.value.toString(16).toUpperCase()}`);
                  break;
                }
              } catch (error) {
                console.log(`❌ Primary property '${name}' not accessible: ${(error as Error).message}`);
              }
            }
          }
          
          // Find secondary color property
          if (!secondaryColorProperty) {
            for (const name of secondaryNames) {
              try {
                const prop = viewModelInstance.color(name);
                if (prop) {
                  secondaryColorProperty = prop;
                  console.log(`✅ Found secondary color property: '${name}', current value: 0x${prop.value.toString(16).toUpperCase()}`);
                  break;
                }
              } catch (error) {
                console.log(`❌ Secondary property '${name}' not accessible: ${(error as Error).message}`);
              }
            }
          }
        } else {
          console.warn('❌ ViewModelInstance not available');
        }
      }
        
      // Set primary color
      if (primaryColorProperty) {
        try {
          console.log(`🔄 Setting primary color from 0x${primaryColorProperty.value.toString(16).toUpperCase()} to 0x${primaryColor.toString(16).toUpperCase()}`);
          primaryColorProperty.value = primaryColor;
          console.log(`✅ Primary color set successfully. New value: 0x${primaryColorProperty.value.toString(16).toUpperCase()}`);
          
          // Verify the value was actually set correctly
          if (primaryColorProperty.value !== primaryColor) {
            console.warn(`⚠️ Primary color value mismatch! Expected: 0x${primaryColor.toString(16).toUpperCase()}, Got: 0x${primaryColorProperty.value.toString(16).toUpperCase()}`);
          }
        } catch (error) {
          console.error('❌ Error setting primary color:', error);
        }
      } else {
        console.warn('❌ Primary color property not found');
      }
      
      // Set secondary color
      if (secondaryColorProperty) {
        try {
          console.log(`🔄 Setting secondary color from 0x${secondaryColorProperty.value.toString(16).toUpperCase()} to 0x${secondaryColor.toString(16).toUpperCase()}`);
          secondaryColorProperty.value = secondaryColor;
          console.log(`✅ Secondary color set successfully. New value: 0x${secondaryColorProperty.value.toString(16).toUpperCase()}`);
          
          // Verify the value was actually set correctly
          if (secondaryColorProperty.value !== secondaryColor) {
            console.warn(`⚠️ Secondary color value mismatch! Expected: 0x${secondaryColor.toString(16).toUpperCase()}, Got: 0x${secondaryColorProperty.value.toString(16).toUpperCase()}`);
          }
        } catch (error) {
          console.error('❌ Error setting secondary color:', error);
        }
      } else {
        console.warn('❌ Secondary color property not found');
      }
      
      // Force the animation to advance to apply the color changes
      if (primaryColorProperty || secondaryColorProperty) {
        console.log('🔄 Triggering Rive updates to apply color changes...');
        try {
          // Resize the drawing surface to trigger a redraw
          this.rive.resizeDrawingSurfaceToCanvas();
          console.log('✅ Drawing surface resized successfully');
        } catch (resizeError) {
          console.log('❌ Could not resize drawing surface:', (resizeError as Error).message);
        }
        
        // Also check if we need to restart any state machines to apply data binding changes
        try {
          const stateMachines = this.rive.stateMachineInputs('State Machine 1');
          if (stateMachines && stateMachines.length > 0) {
            console.log('✅ State machine is active, data binding should update automatically');
          } else {
            console.log('⚠️ No active state machine found');
          }
        } catch (smError) {
          console.log('❌ Could not check state machine:', (smError as Error).message);
        }
        
        // Add a small delay and then double-check the color values
        setTimeout(() => {
          console.log('🔍 Double-checking color values after update...');
          if (primaryColorProperty) {
            console.log(`Primary color after update: 0x${primaryColorProperty.value.toString(16).toUpperCase()}`);
          }
          if (secondaryColorProperty) {
            console.log(`Secondary color after update: 0x${secondaryColorProperty.value.toString(16).toUpperCase()}`);
          }
        }, 50);
      }
        
    } catch (error) {
      console.error('❌ Error setting colors:', error);
    }
  }

  /**
   * Queue colors to be set when Rive loads (if not already loaded)
   * If config is set, uses config values instead
   */
  queueColors(primaryColor?: number, secondaryColor?: number): void {
    if (this.rive) {
      // Rive is already loaded, set colors immediately
      if (this.config) {
        const primaryColorHex = this.hexToNumber(this.config.mapbanPrimaryColor);
        const secondaryColorHex = this.hexToNumber(this.config.mapbanSecondaryColor);
        this.updateMapbanColors(primaryColorHex, secondaryColorHex);
      } else if (primaryColor && secondaryColor) {
        this.updateMapbanColors(primaryColor, secondaryColor);
      }
    } else {
      // Queue colors for when Rive loads (only if no config is set)
      if (!this.config && primaryColor && secondaryColor) {
        this.pendingColors = { primary: primaryColor, secondary: secondaryColor };
        console.log(`🔄 Queued colors for Rive load: primary=0x${primaryColor.toString(16).toUpperCase()}, secondary=0x${secondaryColor.toString(16).toUpperCase()}`);
      } else if (this.config) {
        console.log('🎨 Config colors will be used when Rive loads');
      }
    }
  }

  /**
   * Set the configuration for color values
   */
  setConfig(config: Config): void {
    this.config = config;
    console.log('🎨 Config set with mapban colors:', {
      primary: config.mapbanPrimaryColor,
      secondary: config.mapbanSecondaryColor
    });
  }

  /**
   * Convert hex color string to number
   */
  private hexToNumber(hexColor: string): number {
    // Remove # if present and convert to number
    const cleanHex = hexColor.replace('#', '');
    return parseInt(cleanHex, 16);
  }

}