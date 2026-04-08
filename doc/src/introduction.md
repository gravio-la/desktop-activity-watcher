# Introduction

This book collects the **Desktop Agent** documentation: a prototype stack that tracks window focus and file access (eBPF / opensnoop) and stores events in time-series backends for analysis.

For the **project overview**, architecture, manual `docker-compose` setup, and repository layout, see the repository [README](../../README.md).

## How to use this book

| If you want to… | Start here |
|-----------------|------------|
| Install with Home Manager in a few minutes | [Quick start (Home Manager)](./quickstart-home-manager.md) |
| Run from source, databases, development shell | [Quick start (manual)](./quickstart-manual.md) |
| Every `services.desktopAgent` option | [Home Manager module reference](./home-manager-module.md) |
| Move from a manual install to the module | [Migration guide](./migration-to-home-manager.md) |
| InfluxDB / TimescaleDB / Redis | [Database setup](./database-setup.md), [Redis](./redis-usage-guide.md) |
| `opensnoop` and sudo | [Sudo configuration](./sudo-configuration.md) |
| Include/exclude paths and processes | [Configuration and filters](./config-filters.md) |
| Query commands | [CLI reference](./cli-complete.md) |

## Repository files not in this book

- Example Home Manager config: [`example-home.nix`](../../example-home.nix) (repository root)
- Daemon internals: [`daemon/README.md`](../../daemon/README.md), [`daemon/CLI.md`](../../daemon/CLI.md), [`daemon/CONFIG.md`](../../daemon/CONFIG.md)
