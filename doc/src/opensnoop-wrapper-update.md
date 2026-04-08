# OpenSnoop Wrapper Update

## Summary

The Desktop Agent module has been updated to use an `opensnoop-user` wrapper that handles privilege escalation internally. This allows the daemon to run as a normal user while still being able to monitor file access.

## What Changed

### Before
- Daemon needed to run as root or with elevated privileges
- Complex systemd service configuration
- Security concerns about running the entire daemon as root

### After
- ✅ Daemon runs as normal user
- ✅ Uses `opensnoop-user` wrapper for privilege escalation
- ✅ Wrapper calls `sudo opensnoop` internally
- ✅ Requires simple sudo NOPASSWD configuration
- ✅ Better security isolation

## Implementation Details

### 1. OpenSnoop Wrapper

Created in `flake.nix`:

```nix
opensnoopWrapper = pkgs.writeShellScriptBin "opensnoop-user" ''
  #!/usr/bin/env bash
  exec ${pkgs.sudo}/bin/sudo ${pkgs.linuxPackages.bcc}/bin/opensnoop "$@"
'';
```

This wrapper:
- Is installed as `opensnoop-user` command
- Calls `sudo` internally
- Passes all arguments to `opensnoop`
- Returns the same output as `opensnoop`

### 2. Daemon Integration

The daemon wrapper (`desktop-agent-daemon`) now includes the wrapper in PATH:

```nix
export PATH="${opensnoopWrapper}/bin:$PATH"
exec ${pkgs.bun}/bin/bun run $out/lib/desktop-agent/src/index.ts "$@"
```

### 3. Systemd Service

The systemd service includes the wrapper and system tools in PATH:

```nix
Environment = [
  "CONFIG_PATH=%h/.config/desktop-agent/config.json"
  "PATH=${opensnoopWrapper}/bin:${pkgs.systemd}/bin:/run/wrappers/bin"
];
```

### 4. User Packages

The wrapper is also added to user packages for manual testing:

```nix
home.packages = lib.mkIf cfg.daemon.enable [
  opensnoopWrapper  # opensnoop-user command
  # ... other helper scripts
];
```

## Required System Configuration

Users must add this to `configuration.nix`:

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

This allows `sudo opensnoop` to run without password prompts.

## Security Benefits

1. **Principle of Least Privilege**: Only `opensnoop` runs as root, not the entire daemon
2. **Systemd Hardening**: Can use security features like `ProtectHome`, `ProtectSystem`
3. **Isolation**: Daemon runs in user context with limited permissions
4. **Audit Trail**: sudo logs all opensnoop invocations
5. **Limited Scope**: NOPASSWD only applies to opensnoop, not other commands

## Usage

### For Users

After `home-manager switch`, the wrapper is automatically available:

```bash
# Test the wrapper (should NOT ask for password)
opensnoop-user

# The daemon uses this automatically
systemctl --user start desktop-agent
```

### For Daemon Code

The daemon code doesn't need changes. It calls `opensnoop` (or `opensnoop-user`) as before, and the wrapper is in PATH.

If the daemon uses a custom command, it can explicitly call:
```typescript
spawn('opensnoop-user', args)
```

Or rely on PATH:
```typescript
spawn('opensnoop', args)  // Will use opensnoop-user if in PATH
```

## Testing

### 1. Test Sudo Configuration

```bash
# Should work without password
sudo opensnoop
```

Press Ctrl+C after a few seconds.

### 2. Test Wrapper

```bash
# Should also work without password
opensnoop-user
```

### 3. Test Daemon

```bash
home-manager switch
systemctl --user restart desktop-agent
desktop-agent-logs
```

Should see file access events without permission errors.

## Troubleshooting

### "sudo: no tty present and no askpass program specified"

**Problem**: sudo trying to prompt for password

**Solution**: Add NOPASSWD rule to `configuration.nix` (see above)

### "opensnoop-user: command not found"

**Problem**: Wrapper not in PATH

**Solution**: Run `home-manager switch` to install the wrapper

### "Failed to attach to kprobe"

**Problem**: Kernel doesn't support required eBPF features

**Solution**: Check kernel version (need 5.4+): `uname -r`

### Permission denied even with sudo configured

**Problem**: sudo rule path doesn't match

**Solution**: Check the path in your sudo rule matches:
```bash
nix-build '<nixpkgs>' -A linuxPackages.bcc --no-out-link
```

Using `${pkgs.linuxPackages.bcc}` in the Nix expression ensures the path is always correct.

## Documentation

New and updated documentation:

1. **[SUDO_CONFIGURATION.md](./sudo-configuration.md)** - Complete sudo setup guide
   - Multiple configuration methods
   - Security considerations
   - Troubleshooting

2. **[QUICKSTART_HOME_MANAGER.md](./quickstart-home-manager.md)** - Updated
   - New system configuration step
   - Testing instructions

3. **[HOME_MANAGER_MODULE.md](./home-manager-module.md)** - Updated
   - Prerequisites section updated
   - References to SUDO_CONFIGURATION.md

4. **[README.md](../../README.md)** - Updated
   - System configuration section

5. **[DOCUMENTATION_INDEX.md](./introduction.md)** - Updated
   - Added SUDO_CONFIGURATION.md

## Migration for Existing Users

If you were running the daemon as root:

1. **Add sudo configuration** to `configuration.nix`:
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

2. **Rebuild system**:
   ```bash
   sudo nixos-rebuild switch
   ```

3. **Update Home Manager**:
   ```bash
   home-manager switch
   ```

4. **Restart daemon**:
   ```bash
   systemctl --user restart desktop-agent
   ```

That's it! The daemon now runs as your user instead of root.

## Future Enhancements

Possible future improvements:

1. **Alternative backends**: Support other file monitoring tools that don't need root
2. **BPF capabilities**: Use capabilities instead of sudo
3. **Kernel module**: Custom kernel module with proper permissions
4. **User namespaces**: Containerized execution

## Related Files

- `flake.nix` - Contains wrapper definition and integration
- `SUDO_CONFIGURATION.md` - Complete sudo setup guide
- `QUICKSTART_HOME_MANAGER.md` - Updated quick start
- `HOME_MANAGER_MODULE.md` - Updated module docs

## Questions?

See [SUDO_CONFIGURATION.md](./sudo-configuration.md) for detailed information about:
- Why NOPASSWD is safe
- Alternative approaches
- Security considerations
- Troubleshooting

