{ pkgs, ... }:

{
  # Enable JavaScript/TypeScript development
  languages.javascript = {
    enable = true;
    package = pkgs.nodejs_20;  # Project requires Node >= 18, using 20 for good measure
    
    # Enable pnpm since that's what the project uses
    pnpm = {
      enable = true;
      install.enable = true;  # Auto-install dependencies on shell entry
    };
  };

  # Project name from package.json
  name = "node-indexeddb";

  # Configure enterShell to ensure development environment is properly set up
  enterShell = ''
    echo "Node.js development environment ready"
  '';
} 