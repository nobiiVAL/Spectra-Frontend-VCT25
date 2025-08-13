export class Config {
  serverEndpoint = "https://na.valospectra.com:5200";
  redirectUrl = "https://nobii.dev/src/landing";
  sponsorImageUrls: string[] = [];
  sponsorImageRotateSpeed = 5000; // in milliseconds

  mapbanEndpoint = "https://eu.valospectra.com:11201";

  attackerColorPrimary = "#b82e3c";
  attackerColorSecondary = "#ff4557";
  attackerColorShieldCurrency = "#ff838f";

  defenderColorPrimary = "#46F4CF";
  defenderColorSecondary = "#46F4CF";
  defenderColorShieldCurrency = "#46F4CF";

  mapbanPrimaryColor = "#80152D";
  mapbanSecondaryColor = "#1C8C74";

  endroundColor = "#0A0C14";
  endroundTextColor = "#FFFFFF";

  showEventName = false;
  eventName = "Spectra Invitational 2025";

  public constructor(init?: Partial<Config>) {
    Object.assign(this, init);
  }
}
