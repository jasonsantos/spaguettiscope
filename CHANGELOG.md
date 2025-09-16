# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-09-16

### Added

- Initial release of SpaguettiScope
- Framework-agnostic code entropy analyzer
- 6-dimensional entropy scoring system
- NextJS plugin with comprehensive analysis
- Beautiful CLI interface with gradient colors
- HTML and JSON report generation
- Plugin architecture for extensible analysis
- Comprehensive test coverage
- Documentation website
- Professional open-source documentation

### Features

- **Core Analysis Engine** (`@spaguettiscope/core`)
  - Entropy calculation across 6 dimensions
  - File scanning and categorization
  - Dependency analysis and metrics
  - Complexity calculation (cyclomatic and cognitive)
  - Pluggable architecture
- **Command-Line Interface** (`@spaguettiscope/cli`)
  - Beautiful terminal output with colors and progress bars
  - Multiple output formats (terminal, JSON, HTML)
  - Plugin loading and validation
  - Comprehensive help system
- **NextJS Plugin** (`plugins/nextjs`)
  - App Router and Pages Router support
  - Component and route discovery
  - Server/Client component analysis
  - Test and story coverage metrics
- **Documentation Site** (`apps/docs`)
  - Interactive documentation with live examples
  - Beautiful UI built with React and Tailwind CSS
  - Plugin development guides
  - API reference documentation

### Security

- Local-only analysis (no external data transmission)
- Sandboxed plugin execution
- File system access limited to project scope
- No telemetry or data collection

### Development

- Monorepo structure with pnpm workspaces
- Turborepo for build orchestration
- ESLint and Prettier configuration
- Vitest for testing
- Husky for git hooks
- Conventional commits with commitlint
- Comprehensive CI/CD setup

[1.0.0]: https://github.com/your-org/spaguettiscope/releases/tag/v1.0.0
