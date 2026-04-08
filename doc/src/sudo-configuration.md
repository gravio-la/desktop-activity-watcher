# Sudo Configuration for Desktop Agent

The Desktop Agent uses `opensnoop` (an eBPF tool) to monitor file access. Since eBPF requires elevated privileges, the module provides an `opensnoop-user` wrapper that calls `sudo` internally.

## Required System Configuration

For the daemon to work without requiring manual password entry, you need to configure `sudo` to allow passwordless execution of `opensnoop`.

### Option 1: Using security.sudo.extraRules (Recommended)

Add this to your `configuration.nix`:

```nix
# configuration.nix
{ config, pkgs, ... }:

{
  # Allow your user to run opensnoop without password
  security.sudo.extraRules = [
    {
      users = [ "yourusername" ];  # Replace with your username
      commands = [
        {
          command = "${pkgs.linuxPackages.bcc}/bin/opensnoop";
          options = [ "NOPASSWD" ];
        }
      ];
    }
  ];
  
  # Optional: Also enable unprivileged BPF (alternative approach)
  # boot.kernel.sysctl."kernel.unprivileged_bpf_disabled" = 0;
}
```

### Option 2: Using security.sudo.extraConfig (Alternative)

```nix
# configuration.nix
{ config, pkgs, ... }:

{
  security.sudo.extraConfig = ''
    # Allow your user to run opensnoop without password
    yourusername ALL=(root) NOPASSWD: ${pkgs.linuxPackages.bcc}/bin/opensnoop
  '';
}
```

### Option 3: Manual sudoers File (Not Recommended)

If you prefer to edit sudoers manually:

```bash
sudo visudo -f /etc/sudoers.d/desktop-agent
```

Add this line (replace `yourusername`):
```
yourusername ALL=(root) NOPASSWD: /nix/store/*/bin/opensnoop
```

**Note**: This approach is fragile because the Nix store path changes with package updates.

## How It Works

1. **The Home Manager module** creates an `opensnoop-user` wrapper script:
   ```bash
   #!/usr/bin/env bash
   exec sudo opensnoop "$@"
   ```

2. **The daemon** calls `opensnoop-user` instead of `opensnoop` directly

3. **The wrapper** uses `sudo` to run `opensnoop` with root privileges

4. **With NOPASSWD configured**, sudo doesn't prompt for a password

5. **The daemon runs as your user**, not as root, improving security

## Verification

After configuring sudo and rebuilding your system, test the setup:

```bash
# Test that sudo works without password
opensnoop-user

# You should see file access events without a password prompt
# Press Ctrl+C to stop
```

If it prompts for a password, check:
1. Your username is correct in the sudo rule
2. You've rebuilt your system: `sudo nixos-rebuild switch`
3. The path to opensnoop is correct: `which opensnoop`

## Security Considerations

### Why NOPASSWD is Safe Here

1. **Limited scope**: Only `opensnoop` can be run without a password, not arbitrary commands
2. **Read-only operation**: `opensnoop` only monitors file access, it doesn't modify anything
3. **User-level daemon**: The daemon runs as your user, not as root
4. **Systemd isolation**: The daemon runs in a hardened systemd service

### What opensnoop Can Do

- ✅ Monitor which files are opened by processes
- ✅ See process IDs and file paths
- ✅ Track file access patterns

### What opensnoop Cannot Do

- ❌ Modify files
- ❌ Read file contents
- ❌ Execute commands
- ❌ Change system state

## Alternative: Unprivileged BPF

Instead of using sudo, you can enable unprivileged BPF:

```nix
# configuration.nix
{
  boot.kernel.sysctl."kernel.unprivileged_bpf_disabled" = 0;
}
```

This allows non-root users to load certain BPF programs.

**Pros:**
- No sudo needed
- Cleaner architecture

**Cons:**
- Broader permission (any BPF program, not just opensnoop)
- May not work with all kernels/configurations
- `opensnoop` specifically may still require root depending on kernel version

## Troubleshooting

### "sudo: no tty present and no askpass program specified"

This means sudo is trying to prompt for a password but can't because there's no terminal.

**Solution**: Configure NOPASSWD as shown above.

### "opensnoop: command not found"

The BCC tools aren't in the PATH.

**Solution**: The module should handle this, but you can test with:
```bash
nix-shell -p linuxPackages.bcc --run opensnoop
```

### "Failed to attach to kprobe"

The kernel may not support the required eBPF features.

**Solution**: Ensure you're running Linux kernel 5.4 or later:
```bash
uname -r
```

### Service fails to start with permission errors

Check the journal for details:
```bash
journalctl --user -u desktop-agent -n 50
```

Common issues:
- Sudo not configured correctly
- BCC tools not accessible
- Kernel doesn't support eBPF

## Complete Example Configuration

Here's a complete `configuration.nix` with all recommended settings:

```nix
# configuration.nix
{ config, pkgs, ... }:

{
  # Allow your user to run opensnoop without password
  security.sudo.extraRules = [
    {
      users = [ "yourusername" ];  # CHANGE THIS
      commands = [
        {
          command = "${pkgs.linuxPackages.bcc}/bin/opensnoop";
          options = [ "NOPASSWD" ];
        }
      ];
    }
  ];
  
  # Optional: Enable unprivileged BPF as backup/alternative
  boot.kernel.sysctl."kernel.unprivileged_bpf_disabled" = 0;
  
  # Ensure BCC tools are available system-wide (optional)
  environment.systemPackages = [ pkgs.linuxPackages.bcc ];
}
```

Then rebuild:
```bash
sudo nixos-rebuild switch
```

## Testing the Configuration

1. **Test sudo without password:**
   ```bash
   sudo opensnoop
   ```
   Should run without prompting for password. Press Ctrl+C to stop.

2. **Test the wrapper:**
   ```bash
   opensnoop-user
   ```
   Should also work without password (after `home-manager switch`).

3. **Test the daemon:**
   ```bash
   systemctl --user restart desktop-agent
   desktop-agent-status
   desktop-agent-logs
   ```
   Should show file access events in the logs.

## Summary

**Minimum required in `configuration.nix`:**

```nix
security.sudo.extraRules = [
  {
    users = [ "yourusername" ];
    commands = [
      {
        command = "${pkgs.linuxPackages.bcc}/bin/opensnoop";
        options = [ "NOPASSWD" ];
      }
    ];
  }
];
```

**Then:**
```bash
sudo nixos-rebuild switch
home-manager switch
desktop-agent-status
```

That's it! Your Desktop Agent will now run as your user and use the `opensnoop-user` wrapper to monitor file access.

